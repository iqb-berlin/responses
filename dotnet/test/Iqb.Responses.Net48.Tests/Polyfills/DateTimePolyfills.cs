namespace System;

internal static class DateTimePolyfills
{
    extension(DateTime)
    {
        public static DateTime UnixEpoch => new(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    }
}
