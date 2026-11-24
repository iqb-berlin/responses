// Cbrt is a C# port of FreeBSD lib/msun/src/s_cbrt.c, which carries this notice:
//
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//
// Developed at SunPro, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
//
// Optimized by Bruce D. Evans.
//
// Log2 and KernelLog1P are C# ports of FreeBSD lib/msun/src/e_log2.c and
// lib/msun/src/k_log.h, which carry this notice:
//
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================

namespace Iqb.Responses;

/// <summary>
/// Managed ports of the FreeBSD msun (fdlibm-derived) <c>cbrt</c> and <c>log2</c> implementations,
/// which are also used by V8 for <c>Math.cbrt</c> and <c>Math.log2</c>.
/// They are used on every target: .NET's <c>Math.Cbrt</c> and <c>Math.Log2</c> differ from V8 in the last bit for
/// many inputs, and netstandard2.0 has neither (approximations such as <c>Math.Pow(x, 1d / 3d)</c> or
/// <c>Math.Log(x) / Math.Log(2d)</c> do not round like the TypeScript reference either).
/// </summary>
internal static class Fdlibm
{
    // FreeBSD lib/msun/src/s_cbrt.c
    private const uint CbrtB1 = 715094163; // (1023 - 1023/3 - 0.03306235651) * 2**20
    private const uint CbrtB2 = 696219795; // (1023 - 1023/3 - 54/3 - 0.03306235651) * 2**20
    private const double CbrtP0 = 1.87595182427177009643;
    private const double CbrtP1 = -1.88497979543377169875;
    private const double CbrtP2 = 1.621429720105354466140;
    private const double CbrtP3 = -0.758397934778766047437;
    private const double CbrtP4 = 0.145996192886612446982;

    // FreeBSD lib/msun/src/e_log2.c and k_log.h
    private const double Two54 = 1.80143985094819840000e+16;
    private const double InvLn2Hi = 1.44269504072144627571e+00;
    private const double InvLn2Lo = 1.67517131648865118353e-10;
    private const double Lg1 = 6.666666666666735130e-01;
    private const double Lg2 = 3.999999999940941908e-01;
    private const double Lg3 = 2.857142874366239149e-01;
    private const double Lg4 = 2.222219843214978396e-01;
    private const double Lg5 = 1.818357216161805012e-01;
    private const double Lg6 = 1.531383769920937332e-01;
    private const double Lg7 = 1.479819860511658591e-01;

    public static double Cbrt(double x)
    {
        var hx = HighWord(x);
        var low = LowWord(x);
        var sign = hx & 0x80000000u;
        hx ^= sign;
        if (hx >= 0x7ff00000u) return x + x; // NaN, +-Infinity

        double t;
        if (hx < 0x00100000u)
        {
            if ((hx | low) == 0) return x; // +-0
            t = FromWords(0x43500000u, 0) * x; // scale subnormal by 2**54
            var high = HighWord(t);
            t = FromWords(sign | ((high & 0x7fffffffu) / 3 + CbrtB2), 0);
        }
        else
        {
            t = FromWords(sign | (hx / 3 + CbrtB1), 0);
        }

        var r = (t * t) * (t / x);
        t = t * ((CbrtP0 + r * (CbrtP1 + r * CbrtP2)) + ((r * r) * r) * (CbrtP3 + r * CbrtP4));

        var bits = (ulong)BitConverter.DoubleToInt64Bits(t);
        bits = (bits + 0x80000000UL) & 0xffffffffc0000000UL;
        t = BitConverter.Int64BitsToDouble((long)bits);

        var s = t * t;
        r = x / s;
        var w = t + t;
        r = (r - t) / (w + r);
        return t + t * r;
    }

    public static double Log2(double x)
    {
        var hx = (int)HighWord(x);
        var lx = LowWord(x);
        var k = 0;
        if (hx < 0x00100000)
        {
            if (((hx & 0x7fffffff) | (int)lx) == 0) return double.NegativeInfinity; // log(+-0)
            if (hx < 0) return double.NaN; // log(negative)
            k -= 54;
            x *= Two54;
            hx = (int)HighWord(x);
        }
        if (hx >= 0x7ff00000) return x + x;
        if (hx == 0x3ff00000 && lx == 0) return 0d;

        k += (hx >> 20) - 1023;
        hx &= 0x000fffff;
        var i = (hx + 0x95f64) & 0x100000;
        x = WithHighWord(x, (uint)(hx | (i ^ 0x3ff00000)));
        k += i >> 20;
        double y = k;
        var f = x - 1.0;
        var hfsq = 0.5 * f * f;
        var r = KernelLog1P(f);

        var hi = f - hfsq;
        hi = WithLowWord(hi, 0);
        var lo = (f - hi) - hfsq + r;
        var valHi = hi * InvLn2Hi;
        var valLo = (lo + hi) * InvLn2Lo + lo * InvLn2Hi;

        var sum = y + valHi;
        valLo += (y - sum) + valHi;
        valHi = sum;
        return valLo + valHi;
    }

    private static double KernelLog1P(double f)
    {
        var s = f / (2.0 + f);
        var z = s * s;
        var w = z * z;
        var t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
        var t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
        var r = t2 + t1;
        var hfsq = 0.5 * f * f;
        return s * (hfsq + r);
    }

    private static uint HighWord(double value) => (uint)((ulong)BitConverter.DoubleToInt64Bits(value) >> 32);

    private static uint LowWord(double value) => (uint)BitConverter.DoubleToInt64Bits(value);

    private static double FromWords(uint high, uint low) =>
        BitConverter.Int64BitsToDouble((long)(((ulong)high << 32) | low));

    private static double WithHighWord(double value, uint high) => FromWords(high, LowWord(value));

    private static double WithLowWord(double value, uint low) => FromWords(HighWord(value), low);
}
