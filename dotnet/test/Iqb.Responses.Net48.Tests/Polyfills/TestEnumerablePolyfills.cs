namespace System.Linq;

internal static class TestEnumerablePolyfills
{
    public static IOrderedEnumerable<T> Order<T>(this IEnumerable<T> source, IComparer<T>? comparer) =>
        source.OrderBy(item => item, comparer);
}
