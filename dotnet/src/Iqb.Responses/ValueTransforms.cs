using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Iqb.Responses;

internal static partial class ValueTransforms
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(500);

    public static string NumberToString(double value)
    {
        if (double.IsNaN(value)) return "NaN";
        if (double.IsPositiveInfinity(value)) return "Infinity";
        if (double.IsNegativeInfinity(value)) return "-Infinity";
        if (value == 0d) return "0";

        var sign = value < 0 ? "-" : string.Empty;
        var raw = Math.Abs(value).ToString("R", CultureInfo.InvariantCulture);
        var exponentMarker = raw.IndexOfAny(['e', 'E']);
        var mantissa = exponentMarker < 0 ? raw : raw[..exponentMarker];
        var exponent = exponentMarker < 0
            ? 0
            : int.Parse(raw[(exponentMarker + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture);
        var dot = mantissa.IndexOf('.');
        var decimalPoint = (dot < 0 ? mantissa.Length : dot) + exponent;
        var digits = mantissa.Replace(".", string.Empty, StringComparison.Ordinal);

        var leadingZeros = 0;
        while (leadingZeros < digits.Length - 1 && digits[leadingZeros] == '0') leadingZeros++;
        if (leadingZeros > 0)
        {
            digits = digits[leadingZeros..];
            decimalPoint -= leadingZeros;
        }
        digits = digits.TrimEnd('0');
        if (digits.Length == 0) digits = "0";

        var length = digits.Length;
        if (length <= decimalPoint && decimalPoint <= 21)
            return sign + digits + new string('0', decimalPoint - length);
        if (0 < decimalPoint && decimalPoint <= 21)
            return sign + digits[..decimalPoint] + "." + digits[decimalPoint..];
        if (-6 < decimalPoint && decimalPoint <= 0)
            return sign + "0." + new string('0', -decimalPoint) + digits;

        var scientificExponent = decimalPoint - 1;
        var scientificMantissa = length == 1 ? digits : digits[0] + "." + digits[1..];
        return sign + scientificMantissa + "e" + (scientificExponent >= 0 ? "+" : string.Empty) +
               scientificExponent.ToString(CultureInfo.InvariantCulture);
    }

    public static double? GetValueAsNumber(object? value)
    {
        switch (value)
        {
            case null:
                return 0d;
            case string text when text.Length == 0:
                return 0d;
            case double number:
                return number;
            case float number:
                return number;
            case int number:
                return number;
            case long number:
                return number;
            case bool flag:
                return flag ? 1d : 0d;
            case string text:
                var normalized = WhiteSpaceRegex().Replace(text.Trim(), string.Empty).Replace(',', '.');
                if (!StrictNumberRegex().IsMatch(normalized))
                {
                    return null;
                }
                return double.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
                    ? parsed
                    : null;
            default:
                return null;
        }
    }

    public static double? ParseFloatPrefix(string? text)
    {
        if (text is null)
        {
            return null;
        }
        var match = ParseFloatRegex().Match(text.TrimStart());
        return match.Success && double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    public static string? GetValueAsString(object? value, IReadOnlyCollection<string>? processing = null)
    {
        switch (value)
        {
            case double number:
                return NumberToString(number);
            case float number:
                return NumberToString(number);
            case int number:
                return NumberToString(number);
            case long number:
                return NumberToString(number);
            case bool flag:
                return flag ? "true" : "false";
            case string text:
                processing ??= [];
                if (processing.Contains("REMOVE_ALL_SPACES") || processing.Contains("IGNORE_ALL_SPACES"))
                {
                    text = WhiteSpaceRegex().Replace(text, string.Empty);
                }
                else if (processing.Contains("REMOVE_DISPENSABLE_SPACES") ||
                         processing.Contains("IGNORE_DISPENSABLE_SPACES"))
                {
                    text = WhiteSpaceRegex().Replace(text.Trim(), " ");
                }
                if (processing.Contains("TO_LOWER_CASE"))
                {
                    text = EcmaScriptToLower(text);
                }
                return text;
            default:
                return null;
        }
    }

    public static object TransformString(string value, IReadOnlyCollection<string> processing, Regex? fragmentRegex = null)
    {
        if (fragmentRegex is not null)
        {
            var match = fragmentRegex.Match(value);
            if (!match.Success)
            {
                return new List<object?>();
            }
            return match.Groups.Cast<Group>().Skip(1).Select(group => (object?)group.Value).ToList();
        }

        if (processing.Contains("REMOVE_ALL_SPACES") || processing.Contains("IGNORE_ALL_SPACES"))
        {
            value = WhiteSpaceRegex().Replace(value, string.Empty);
        }
        if (processing.Contains("REMOVE_DISPENSABLE_SPACES") || processing.Contains("IGNORE_DISPENSABLE_SPACES"))
        {
            value = WhiteSpaceRegex().Replace(value.Trim(), " ");
        }
        if (processing.Contains("IGNORE_CASE") || processing.Contains("TO_LOWER_CASE"))
        {
            value = EcmaScriptToLower(value);
        }
        return value;
    }

    public static object? TransformValue(object? value, string fragmenting, bool sortArray)
    {
        Regex? regex = string.IsNullOrEmpty(fragmenting)
            ? null
            : new Regex(fragmenting, RegexOptions.None, RegexTimeout);

        if (value is IEnumerable<object?> sequence)
        {
            var values = sequence.ToList();
            if (sortArray)
            {
                values.Sort((left, right) => string.Compare(
                    GetValueAsString(left) ?? string.Empty,
                    GetValueAsString(right) ?? string.Empty,
                    StringComparison.CurrentCulture));
            }
            return values.Select(item => item is string text ? TransformString(text, [], regex) : item).ToList();
        }

        return value is string scalar ? TransformString(scalar, [], regex) : value;
    }

    public static bool IsEmptyValue(object? value) =>
        value is string { Length: 0 } || value is IEnumerable<object?> sequence && !sequence.Any();

    public static bool IsArray(object? value) => value is IEnumerable<object?>;

    internal static string EcmaScriptToLower(string value)
    {
        var runes = value.EnumerateRunes().ToList();
        var result = new StringBuilder(value.Length);
        for (var index = 0; index < runes.Count; index++)
        {
            var rune = runes[index];
            if (rune.Value == 0x0130)
            {
                result.Append("i\u0307");
            }
            else if (rune.Value == 0x03A3 && IsFinalSigma(runes, index))
            {
                result.Append('\u03C2');
            }
            else
            {
                result.Append(Rune.ToLowerInvariant(rune));
            }
        }
        return result.ToString();
    }

    private static bool IsFinalSigma(IReadOnlyList<Rune> runes, int index)
    {
        var hasCasedBefore = false;
        for (var before = index - 1; before >= 0; before--)
        {
            if (IsCaseIgnorable(runes[before])) continue;
            hasCasedBefore = IsCased(runes[before]);
            break;
        }
        if (!hasCasedBefore) return false;
        for (var after = index + 1; after < runes.Count; after++)
        {
            if (IsCaseIgnorable(runes[after])) continue;
            return !IsCased(runes[after]);
        }
        return true;
    }

    private static bool IsCased(Rune rune) =>
        Rune.ToLowerInvariant(rune) != Rune.ToUpperInvariant(rune);

    private static bool IsCaseIgnorable(Rune rune)
    {
        var category = Rune.GetUnicodeCategory(rune);
        return category is UnicodeCategory.NonSpacingMark or UnicodeCategory.EnclosingMark or
               UnicodeCategory.Format or UnicodeCategory.ModifierLetter or UnicodeCategory.ModifierSymbol ||
               rune.Value is 0x0027 or 0x2019;
    }

    public static List<object?> AsArray(object value) => ((IEnumerable<object?>)value).ToList();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpaceRegex();

    [GeneratedRegex(@"^[-+]?\d+(\.\d+)?$")]
    private static partial Regex StrictNumberRegex();

    [GeneratedRegex(@"^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?")]
    private static partial Regex ParseFloatRegex();
}
