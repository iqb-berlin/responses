namespace Iqb.Responses;

internal static class DictionaryHelpers
{
    public static Dictionary<string, T> LastById<T>(this IEnumerable<T> values, Func<T, string> keySelector)
    {
        var result = new Dictionary<string, T>(StringComparer.Ordinal);
        foreach (var value in values) result[keySelector(value)] = value;
        return result;
    }
}
