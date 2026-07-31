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

    public static PortableRegexStatus Analyze(string pattern)
    {
        if (pattern.Any(character => character > 0x7F) || ContainsUnsupportedConstruct(pattern))
            return PortableRegexStatus.Unsupported;
        try
        {
            _ = new Regex(pattern, RegexOptions.ECMAScript, Timeout);
            return PortableRegexStatus.Portable;
        }
        catch (ArgumentException)
        {
            return PortableRegexStatus.Invalid;
        }
    }

    public static Regex Create(string pattern, bool ignoreCase)
    {
        var status = Analyze(pattern);
        if (status == PortableRegexStatus.Unsupported)
            throw new InvalidOperationException("Pattern is outside the portable ECMAScript subset.");
        if (status == PortableRegexStatus.Invalid)
            throw new ArgumentException("The regular expression is invalid.", nameof(pattern));
        var options = RegexOptions.ECMAScript | (ignoreCase ? RegexOptions.IgnoreCase : RegexOptions.None);
        return new Regex(pattern, options, Timeout);
    }

    private static bool ContainsUnsupportedConstruct(string pattern)
    {
        for (var index = 0; index < pattern.Length; index++)
        {
            if (pattern[index] == '\\' && index + 1 < pattern.Length)
            {
                var escaped = pattern[index + 1];
                if (escaped is >= '1' and <= '9' or 'k' or 'p' or 'P' or 'u' or 'x') return true;
                index++;
                continue;
            }
            if (pattern[index] == '(' && index + 1 < pattern.Length && pattern[index + 1] == '?')
            {
                if (index + 2 >= pattern.Length || pattern[index + 2] != ':') return true;
            }
        }
        return false;
    }
}
