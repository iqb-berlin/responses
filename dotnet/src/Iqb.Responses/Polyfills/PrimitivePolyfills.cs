namespace System;

internal static class PrimitivePolyfills
{
    extension(double)
    {
        public static bool IsFinite(double d) => !double.IsNaN(d) && !double.IsInfinity(d);
    }

    extension(Math)
    {
        public static double Tau => 2d * Math.PI;
    }

    extension(char)
    {
        public static bool IsAsciiLetter(char c) => (uint)((c | 0x20) - 'a') <= 'z' - 'a';

        public static bool IsAsciiDigit(char c) => (uint)(c - '0') <= '9' - '0';

        public static bool IsAsciiLetterOrDigit(char c) => IsAsciiLetter(c) || IsAsciiDigit(c);
    }

    extension(string)
    {
        public static string Join(char separator, IEnumerable<string?> values) =>
            string.Join(separator.ToString(), values);
    }

    extension(string text)
    {
        public bool EndsWith(char value) => text.Length > 0 && text[text.Length - 1] == value;


        public string Replace(string oldValue, string? newValue, StringComparison comparisonType) =>
            comparisonType == StringComparison.Ordinal
                ? text.Replace(oldValue, newValue)
                : throw new NotSupportedException("Only ordinal replacement is supported on netstandard2.0.");
    }
}
