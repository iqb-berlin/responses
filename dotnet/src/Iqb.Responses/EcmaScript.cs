namespace Iqb.Responses;

internal static class EcmaScript
{
    internal static readonly object Undefined = new();

    // ECMAScript WhiteSpace and LineTerminator, including BOM and excluding NEL.
    internal const string WhiteSpaceRanges = @"\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
    internal const string NonWhiteSpaceRanges = @"\u0000-\u0008\u000e-\u001f\u0021-\u009f\u00a1-\u167f\u1681-\u1fff\u200b-\u2027\u202a-\u202e\u2030-\u205e\u2060-\u2fff\u3001-\ufefe\uff00-\uffff";

    internal static bool IsWhiteSpace(char value) => value is
        >= '\u0009' and <= '\u000d' or '\u0020' or '\u00a0' or '\u1680' or
        >= '\u2000' and <= '\u200a' or '\u2028' or '\u2029' or '\u202f' or
        '\u205f' or '\u3000' or '\ufeff';

    internal static bool IsWhiteSpaceOnly(string value) => value.All(IsWhiteSpace);

    internal static string Trim(string value)
    {
        var start = 0;
        var end = value.Length;
        while (start < end && IsWhiteSpace(value[start])) start++;
        while (end > start && IsWhiteSpace(value[end - 1])) end--;
        return value[start..end];
    }

    internal static string TrimStart(string value)
    {
        var start = 0;
        while (start < value.Length && IsWhiteSpace(value[start])) start++;
        return value[start..];
    }
}
