using System.Text;
using System.Text.RegularExpressions;

namespace Iqb.Responses;

internal enum PortableRegexStatus
{
    Portable,
    Invalid,
    Unsupported
}

internal static class PortableRegex
{
    private static readonly TimeSpan Timeout = TimeSpan.FromMilliseconds(500);
    private const RegexOptions Options = RegexOptions.ECMAScript | RegexOptions.CultureInvariant;
    private const string Word = "A-Za-z0-9_";
    private const string NonWord = @"\u0000-\u002f\u003a-\u0040\u005b-\u005e\u0060\u007b-\uffff";

    public static PortableRegexStatus Analyze(string pattern, bool allowNamedCaptures = false)
    {
        try
        {
            _ = new Regex(Translate(pattern, false, allowNamedCaptures), Options, Timeout);
            return PortableRegexStatus.Portable;
        }
        catch (NotSupportedException)
        {
            return PortableRegexStatus.Unsupported;
        }
        catch (ArgumentException)
        {
            return PortableRegexStatus.Invalid;
        }
    }

    public static Regex Create(string pattern, bool ignoreCase, bool allowNamedCaptures = false)
    {
        var status = Analyze(pattern, allowNamedCaptures);
        if (status == PortableRegexStatus.Unsupported)
            throw new NotSupportedException("Pattern is outside the .NET preview's portable ECMAScript subset.");
        if (status == PortableRegexStatus.Invalid)
            throw new ArgumentException("The regular expression is invalid.", nameof(pattern));
        return new Regex(Translate(pattern, ignoreCase, allowNamedCaptures), Options, Timeout);
    }

    private static string Translate(string pattern, bool ignoreCase, bool allowNamedCaptures)
    {
        if (pattern.Any(character => character > 0x7F)) throw Unsupported();
        var result = new StringBuilder();
        var classStart = -1;
        var names = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < pattern.Length; index++)
        {
            var character = pattern[index];
            var inClass = classStart >= 0;
            if (character == '\\' && index + 1 < pattern.Length)
            {
                var escaped = pattern[++index];
                if (escaped is >= '0' and <= '9' or 'k' or 'p' or 'P' or 'u' or 'x' or 'c') throw Unsupported();
                var ranges = escaped switch
                {
                    's' => EcmaScript.WhiteSpaceRanges,
                    'S' => EcmaScript.NonWhiteSpaceRanges,
                    'd' => "0-9",
                    'D' => @"\u0000-\u002f\u003a-\uffff",
                    'w' => Word,
                    'W' => NonWord,
                    _ => null
                };
                if (ranges is not null)
                    result.Append(inClass ? ranges : "[" + ranges + "]");
                else if (!inClass && (escaped is 'b' or 'B'))
                {
                    var afterWord = escaped == 'b' ? "?!" : "?=";
                    var afterNonWord = escaped == 'b' ? "?=" : "?!";
                    result.Append($"(?:(?<=[{Word}])({afterWord}[{Word}])|(?<![{Word}])({afterNonWord}[{Word}]))");
                }
                else if (escaped is 'f' or 'n' or 'r' or 't' or 'v' || inClass && escaped == 'b')
                    result.Append('\\').Append(escaped);
                else if (char.IsAsciiLetter(escaped))
                    AppendLiteral(result, escaped, ignoreCase && !inClass);
                else
                    result.Append('\\').Append(escaped);
                continue;
            }
            if (character == '[')
            {
                // .NET class subtraction is not JavaScript character-class syntax.
                if (inClass) throw Unsupported();
                classStart = result.Length;
                result.Append(character);
                continue;
            }
            if (inClass)
            {
                // A literal edge hyphen must stay literal when case pairs are appended.
                if (character == '-' && (result.Length == classStart + 1 ||
                    result.Length == classStart + 2 && result[classStart + 1] == '^' ||
                    index + 1 < pattern.Length && pattern[index + 1] == ']')) result.Append('\\');
                result.Append(character);
                if (character == ']')
                {
                    if (ignoreCase)
                    {
                        var expanded = ExpandAsciiCase(result.ToString(classStart, result.Length - classStart));
                        result.Length = classStart;
                        result.Append(expanded);
                    }
                    classStart = -1;
                }
                continue;
            }
            if (character == '(' && index + 1 < pattern.Length && pattern[index + 1] == '?')
            {
                if (index + 2 < pattern.Length && pattern[index + 2] == ':')
                {
                    result.Append("(?:");
                    index += 2;
                    continue;
                }
                if (!allowNamedCaptures || index + 2 >= pattern.Length || pattern[index + 2] != '<') throw Unsupported();
                if (index + 3 < pattern.Length && pattern[index + 3] is '=' or '!') throw Unsupported();
                var end = pattern.IndexOf('>', index + 3);
                if (end < 0) throw new ArgumentException("Invalid named capture.", nameof(pattern));
                var name = pattern[(index + 3)..end];
                if (name.Length == 0 || !(char.IsAsciiLetter(name[0]) || name[0] is '_' or '$') ||
                    name.Any(value => !(char.IsAsciiLetterOrDigit(value) || value is '_' or '$'))) throw Unsupported();
                if (!names.Add(name)) throw new ArgumentException("Duplicate named capture.", nameof(pattern));
                // Names are not referenced in this subset. Plain captures retain JS source order.
                result.Append('(');
                index = end;
                continue;
            }
            if (character == '.') result.Append(@"[^\n\r\u2028\u2029]");
            else if (character == '$') result.Append(@"\z");
            else AppendLiteral(result, character, ignoreCase);
        }
        return result.ToString();
    }

    private static void AppendLiteral(StringBuilder result, char value, bool ignoreCase)
    {
        if (ignoreCase && char.IsAsciiLetter(value))
            result.Append('[').Append(char.ToLowerInvariant(value)).Append(char.ToUpperInvariant(value)).Append(']');
        else result.Append(value);
    }

    private static string ExpandAsciiCase(string characterClass)
    {
        var matcher = new Regex(characterClass, Options, Timeout);
        var negated = characterClass.StartsWith("[^", StringComparison.Ordinal);
        var additions = new StringBuilder();
        for (var lower = 'a'; lower <= 'z'; lower++)
        {
            var upper = char.ToUpperInvariant(lower);
            var matchesLower = matcher.IsMatch(lower.ToString());
            var matchesUpper = matcher.IsMatch(upper.ToString());
            if (negated ? !matchesLower || !matchesUpper : matchesLower || matchesUpper)
            {
                additions.Append(lower).Append(upper);
            }
        }
        return characterClass[..^1] + additions + "]";
    }

    private static NotSupportedException Unsupported() =>
        new("Pattern is outside the .NET preview's portable ECMAScript subset.");
}
