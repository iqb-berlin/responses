namespace Iqb.Responses;

/// <summary>
/// Maps VariableInfo type and format values from the 1.x spelling (<c>no-value</c>, <c>ggb-file</c>)
/// to the 2.x spelling (<c>NO_VALUE</c>, <c>GGB_FILE</c>). Use it for decisions and lookups only;
/// data that is stored or passed on keeps the spelling it came with.
/// </summary>
public static class VariableInfoSpelling
{
    private static readonly IReadOnlyDictionary<string, string> TypeV1ToV2 = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["string"] = "STRING",
        ["integer"] = "INTEGER",
        ["number"] = "NUMBER",
        ["boolean"] = "BOOLEAN",
        ["attachment"] = "ATTACHMENT",
        ["json"] = "JSON",
        ["no-value"] = "NO_VALUE",
        ["coded"] = "CODED"
    };
    private static readonly IReadOnlyDictionary<string, string> FormatV1ToV2 = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["text-selection"] = "TEXT_SELECTION",
        ["image"] = "IMAGE",
        ["capture-image"] = "CAPTURE_IMAGE",
        ["audio"] = "AUDIO",
        ["ggb-file"] = "GGB_FILE",
        ["non-negative"] = "NON_NEGATIVE",
        ["latex"] = "LATEX",
        ["math-ml"] = "MATH_ML",
        ["math-table"] = "MATH_TABLE",
        ["math-text-mix"] = "MATH_TEXT_MIX",
        ["ggb-variable"] = "GGB_VARIABLE"
    };

    /// <summary>Returns the 2.x spelling of a type; 2.x and unknown values are returned unchanged.</summary>
    public static string NormalizeType(string type) => LookUp(TypeV1ToV2, type);

    /// <summary>Returns the 2.x spelling of a format; 2.x, unknown and empty values are returned unchanged.</summary>
    public static string NormalizeFormat(string format) => LookUp(FormatV1ToV2, format);

    // Deserialized JSON can carry null despite the annotation; it passes through like any unknown value.
    private static string LookUp(IReadOnlyDictionary<string, string> table, string value) =>
        value is not null && table.TryGetValue(value, out var v2) ? v2 : value!;
}
