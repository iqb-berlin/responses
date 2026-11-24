using System.Globalization;

namespace System.Text;

/// <summary>
/// Minimal netstandard2.0 replacement for <c>System.Text.Rune</c>, limited to the members used by this library.
/// Invalid UTF-16 sequences are enumerated as U+FFFD, matching <c>string.EnumerateRunes()</c>.
/// </summary>
internal readonly struct Rune : IEquatable<Rune>
{
    private const int ReplacementCharValue = 0xFFFD;

    public Rune(int value)
    {
        Value = value;
    }

    public int Value { get; }

    public static Rune ToLowerInvariant(Rune value) =>
        FromString(CultureInfo.InvariantCulture.TextInfo.ToLower(value.ToString()));

    public static Rune ToUpperInvariant(Rune value) =>
        FromString(CultureInfo.InvariantCulture.TextInfo.ToUpper(value.ToString()));

    public static UnicodeCategory GetUnicodeCategory(Rune value) =>
        CharUnicodeInfo.GetUnicodeCategory(value.ToString(), 0);

    public static bool operator ==(Rune left, Rune right) => left.Value == right.Value;

    public static bool operator !=(Rune left, Rune right) => left.Value != right.Value;

    public bool Equals(Rune other) => Value == other.Value;

    public override bool Equals(object? obj) => obj is Rune other && Equals(other);

    public override int GetHashCode() => Value;

    public override string ToString() => char.ConvertFromUtf32(Value);

    internal static IEnumerable<Rune> Enumerate(string value)
    {
        for (var index = 0; index < value.Length; index++)
        {
            var current = value[index];
            if (char.IsHighSurrogate(current) && index + 1 < value.Length && char.IsLowSurrogate(value[index + 1]))
            {
                yield return new Rune(char.ConvertToUtf32(current, value[index + 1]));
                index++;
            }
            else if (char.IsSurrogate(current))
            {
                yield return new Rune(ReplacementCharValue);
            }
            else
            {
                yield return new Rune(current);
            }
        }
    }

    private static Rune FromString(string value) => new(char.ConvertToUtf32(value, 0));
}

internal static class RuneStringExtensions
{
    public static IEnumerable<Rune> EnumerateRunes(this string value) => Rune.Enumerate(value);
}
