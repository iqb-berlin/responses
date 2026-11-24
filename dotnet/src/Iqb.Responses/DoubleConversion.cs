using System.Globalization;
using System.Numerics;
using System.Text;

namespace Iqb.Responses;

/// <summary>
/// Exact conversions between <see cref="double"/> and decimal text that behave identically on every runtime.
/// .NET Framework neither formats nor parses doubles with more than 15 significant digits correctly, so the
/// netstandard2.0 build cannot rely on the runtime for ECMAScript-compatible results.
/// </summary>
internal static class DoubleConversion
{
    private static readonly BigInteger TwoPow52 = BigInteger.One << 52;
    private static readonly BigInteger TwoPow53 = BigInteger.One << 53;

    private static readonly double[] ExactPowersOfTen =
    [
        1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11,
        1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22
    ];

    /// <summary>
    /// Returns the digits of the shortest decimal that reads back as the finite, positive <paramref name="value"/>;
    /// among equally short ones the closest, and on a tie the even one, as ECMAScript's Number::toString requires.
    /// The value equals <c>0.Digits × 10^PointPosition</c>.
    /// </summary>
    /// <remarks>The free-format algorithm of Burger and Dybvig, using exact integer arithmetic.</remarks>
    internal static (string Digits, int PointPosition) ShortestDigits(double value)
    {
        var bits = BitConverter.DoubleToInt64Bits(value);
        var biasedExponent = (int)((bits >> 52) & 0x7FF);
        var fraction = bits & 0xFFFFFFFFFFFFFL;
        var mantissa = biasedExponent == 0 ? fraction : fraction | (1L << 52);
        var exponent = biasedExponent == 0 ? -1074 : biasedExponent - 1075;
        // A reader rounding half to even maps the interval boundaries to this value iff its mantissa is even.
        var inclusive = (mantissa & 1) == 0;
        // At an exact power of two the next smaller double is only half as far away as the next larger one.
        var asymmetric = fraction == 0 && biasedExponent > 1;

        // value = r / s; the boundaries of its rounding interval are (r - mMinus) / s and (r + mPlus) / s.
        BigInteger r, s, mPlus, mMinus;
        if (exponent >= 0)
        {
            var ulp = BigInteger.One << exponent;
            if (asymmetric)
            {
                r = mantissa * ulp * 4; s = 4; mPlus = ulp * 2; mMinus = ulp;
            }
            else
            {
                r = mantissa * ulp * 2; s = 2; mPlus = ulp; mMinus = ulp;
            }
        }
        else if (asymmetric)
        {
            r = new BigInteger(mantissa) * 4; s = BigInteger.One << (2 - exponent); mPlus = 2; mMinus = BigInteger.One;
        }
        else
        {
            r = new BigInteger(mantissa) * 2; s = BigInteger.One << (1 - exponent); mPlus = BigInteger.One; mMinus = BigInteger.One;
        }

        // Scale so that 0.1 <= upper boundary < 1, i.e. the first generated digit is the leading one.
        var pointPosition = (int)Math.Ceiling(Math.Log10(value) - 1e-10);
        if (pointPosition >= 0)
        {
            s *= BigInteger.Pow(10, pointPosition);
        }
        else
        {
            var scale = BigInteger.Pow(10, -pointPosition);
            r *= scale; mPlus *= scale; mMinus *= scale;
        }
        while (ReachesOne(r + mPlus))
        {
            s *= 10;
            pointPosition++;
        }
        while (!ReachesOne((r + mPlus) * 10))
        {
            r *= 10; mPlus *= 10; mMinus *= 10;
            pointPosition--;
        }

        var digits = new StringBuilder(17);
        while (true)
        {
            r *= 10; mPlus *= 10; mMinus *= 10;
            var digit = (int)BigInteger.DivRem(r, s, out r);
            var lowerFits = inclusive ? r <= mMinus : r < mMinus;
            var upperFits = ReachesOne(r + mPlus);
            if (!lowerFits && !upperFits)
            {
                digits.Append((char)('0' + digit));
                continue;
            }
            if (lowerFits && upperFits)
            {
                var comparison = (r * 2).CompareTo(s);
                if (comparison > 0 || (comparison == 0 && digit % 2 == 1)) digit++;
            }
            else if (upperFits)
            {
                digit++;
            }
            digits.Append((char)('0' + digit));
            return (digits.ToString(), pointPosition);
        }

        bool ReachesOne(BigInteger numerator) => inclusive ? numerator >= s : numerator > s;
    }

    /// <summary>
    /// Formats the finite <paramref name="value"/> exactly as <c>double.ToString("R")</c> does on .NET Core 3.0 and
    /// later (<c>"1E+21"</c>, <c>"1E-07"</c>, <c>"0.0001"</c>, <c>"-0"</c>), but with the digits of
    /// <see cref="ShortestDigits"/>: .NET 10 up to 10.0.14 misformats some exact powers of two, and .NET Framework
    /// emits up to 17 digits that are not always correctly rounded and drops the sign of negative zero.
    /// </summary>
    internal static string ToRoundTripString(double value)
    {
        if (value == 0d) return BitConverter.DoubleToInt64Bits(value) < 0 ? "-0" : "0";
        var sign = value < 0 ? "-" : string.Empty;
        var (digits, pointPosition) = ShortestDigits(Math.Abs(value));
        if (pointPosition > 17 || pointPosition < -3)
        {
            var exponent = pointPosition - 1;
            var mantissa = digits.Length == 1 ? digits : digits[0] + "." + digits.Substring(1);
            return sign + mantissa + "E" + (exponent < 0 ? "-" : "+") +
                   Math.Abs(exponent).ToString("00", CultureInfo.InvariantCulture);
        }
        if (pointPosition <= 0) return sign + "0." + new string('0', -pointPosition) + digits;
        if (pointPosition >= digits.Length) return sign + digits + new string('0', pointPosition - digits.Length);
        return sign + digits.Substring(0, pointPosition) + "." + digits.Substring(pointPosition);
    }

    /// <summary>
    /// Parses ASCII decimal text (<c>[+-]digits[.digits][e[+-]digits]</c>, either digit part may be empty but not
    /// both) to the nearest double, rounding half to even; overflow yields an infinity. The results equal those of
    /// <c>double.TryParse</c> on .NET Core 3.0 and later, but unlike the runtime this is exact on .NET Framework too.
    /// </summary>
    internal static bool TryParse(string text, out double value)
    {
        value = 0d;
        var position = 0;
        var negative = false;
        if (position < text.Length && text[position] is '+' or '-')
        {
            negative = text[position] == '-';
            position++;
        }

        var significand = new StringBuilder();
        var decimalExponent = 0L;
        var hasDigits = false;
        while (position < text.Length && IsAsciiDigit(text[position]))
        {
            if (significand.Length > 0 || text[position] != '0') significand.Append(text[position]);
            hasDigits = true;
            position++;
        }
        if (position < text.Length && text[position] == '.')
        {
            position++;
            while (position < text.Length && IsAsciiDigit(text[position]))
            {
                if (significand.Length > 0 || text[position] != '0') significand.Append(text[position]);
                decimalExponent--;
                hasDigits = true;
                position++;
            }
        }
        if (!hasDigits) return false;
        if (position < text.Length && text[position] is 'e' or 'E')
        {
            position++;
            var negativeExponent = false;
            if (position < text.Length && text[position] is '+' or '-')
            {
                negativeExponent = text[position] == '-';
                position++;
            }
            var exponentStart = position;
            var exponent = 0L;
            while (position < text.Length && IsAsciiDigit(text[position]))
            {
                // Saturate; any exponent this large already decides between zero and infinity.
                if (exponent < 1_000_000_000L) exponent = exponent * 10 + (text[position] - '0');
                position++;
            }
            if (position == exponentStart) return false;
            decimalExponent += negativeExponent ? -exponent : exponent;
        }
        if (position != text.Length) return false;

        var digitCount = significand.Length;
        while (digitCount > 0 && significand[digitCount - 1] == '0')
        {
            digitCount--;
            decimalExponent++;
        }
        significand.Length = digitCount;

        double magnitude;
        if (digitCount == 0 || digitCount + decimalExponent < -324)
        {
            // Below 10^-324, less than half the smallest subnormal.
            magnitude = 0d;
        }
        else if (digitCount - 1 + decimalExponent > 309)
        {
            magnitude = double.PositiveInfinity;
        }
        else if (digitCount <= 15 && decimalExponent is >= -22 and <= 22)
        {
            // Both operands are exact doubles, so a single correctly rounded operation gives the result.
            var digits = (double)long.Parse(significand.ToString(), NumberStyles.None, CultureInfo.InvariantCulture);
            magnitude = decimalExponent < 0
                ? digits / ExactPowersOfTen[-decimalExponent]
                : digits * ExactPowersOfTen[decimalExponent];
        }
        else
        {
            var digits = BigInteger.Parse(significand.ToString(), NumberStyles.None, CultureInfo.InvariantCulture);
            magnitude = decimalExponent < 0
                ? FromRatio(digits, BigInteger.Pow(10, (int)-decimalExponent))
                : FromRatio(digits * BigInteger.Pow(10, (int)decimalExponent), BigInteger.One);
        }
        value = negative ? -magnitude : magnitude;
        return true;
    }

    /// <summary>Rounds the positive rational <paramref name="numerator"/> / <paramref name="denominator"/> to the nearest double, half to even.</summary>
    private static double FromRatio(BigInteger numerator, BigInteger denominator)
    {
        // Find the binary exponent for which the quotient is a 53-bit mantissa (fewer bits only when subnormal).
        var binaryExponent = Math.Max(BitLength(numerator) - BitLength(denominator) - 53, -1074);
        while (true)
        {
            var scaledNumerator = binaryExponent >= 0 ? numerator : numerator << -binaryExponent;
            var scaledDenominator = binaryExponent >= 0 ? denominator << binaryExponent : denominator;
            var quotient = BigInteger.DivRem(scaledNumerator, scaledDenominator, out var remainder);
            if (quotient >= TwoPow53)
            {
                binaryExponent++;
                continue;
            }
            if (quotient < TwoPow52 && binaryExponent > -1074)
            {
                binaryExponent--;
                continue;
            }

            var comparison = (remainder * 2).CompareTo(scaledDenominator);
            if (comparison > 0 || (comparison == 0 && !quotient.IsEven)) quotient++;
            if (quotient == TwoPow53)
            {
                quotient = TwoPow52;
                binaryExponent++;
            }
            if (binaryExponent > 971) return double.PositiveInfinity;

            var mantissa = (long)quotient;
            var bits = mantissa < (1L << 52)
                ? mantissa
                : ((long)(binaryExponent + 1075) << 52) | (mantissa - (1L << 52));
            return BitConverter.Int64BitsToDouble(bits);
        }
    }

    private static int BitLength(BigInteger value)
    {
        var bytes = value.ToByteArray();
        var length = (bytes.Length - 1) * 8;
        for (int top = bytes[bytes.Length - 1]; top > 0; top >>= 1) length++;
        return length;
    }

    private static bool IsAsciiDigit(char c) => c is >= '0' and <= '9';
}
