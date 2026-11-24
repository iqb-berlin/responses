namespace System.Linq
{
    internal static class EnumerablePolyfills
    {
        public static HashSet<TSource> ToHashSet<TSource>(this IEnumerable<TSource> source) => new(source);
    }
}

namespace System.Collections.Generic
{
    internal static class CollectionPolyfills
    {
        public static TValue? GetValueOrDefault<TKey, TValue>(this IReadOnlyDictionary<TKey, TValue> dictionary, TKey key) =>
            dictionary.TryGetValue(key, out var value) ? value : default;

        public static TValue GetValueOrDefault<TKey, TValue>(
            this IReadOnlyDictionary<TKey, TValue> dictionary, TKey key, TValue defaultValue) =>
            dictionary.TryGetValue(key, out var value) ? value : defaultValue;

        public static bool TryAdd<TKey, TValue>(this Dictionary<TKey, TValue> dictionary, TKey key, TValue value)
            where TKey : notnull
        {
            if (dictionary.ContainsKey(key)) return false;
            dictionary.Add(key, value);
            return true;
        }
    }
}
