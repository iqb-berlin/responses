namespace Iqb.Responses;

public static class CodingEngine
{
    public static VariableCodingData CreateBaseCodingVariable(string variableId, string sourceType) =>
        CodingFactory.CreateBaseCodingVariable(variableId, sourceType);
    public static VariableCodingData CreateCodingVariable(string variableId) => CodingFactory.CreateCodingVariable(variableId);
    public static double? GetValueAsNumber(object? value) => CodingFactory.GetValueAsNumber(value);
    public static string? GetValueAsString(object? value, IReadOnlyCollection<string>? processing = null) =>
        CodingFactory.GetValueAsString(value, processing);
    public static bool IsEmptyValue(object? value) => CodingFactory.IsEmptyValue(value);
    public static Response Code(Response response, VariableCodingData coding, Action<Exception>? onError = null) =>
        CodingFactory.Code(response, coding, onError);
}

public static class ResponseCoder
{
    public static VariableCodingData CreateBaseCodingVariable(string variableId, string sourceType) =>
        CodingFactory.CreateBaseCodingVariable(variableId, sourceType);
    public static VariableCodingData CreateCodingVariable(string variableId) => CodingFactory.CreateCodingVariable(variableId);
    public static double? GetValueAsNumber(object? value) => CodingFactory.GetValueAsNumber(value);
    public static string? GetValueAsString(object? value, IReadOnlyCollection<string>? processing = null) =>
        CodingFactory.GetValueAsString(value, processing);
    public static bool IsEmptyValue(object? value) => CodingFactory.IsEmptyValue(value);
    public static Response Code(Response response, VariableCodingData coding, Action<Exception>? onError = null) =>
        CodingFactory.Code(response, coding, onError);
}

public static class CodingSchemeEngine
{
    public static List<VariableGraphNode> GetVariableDependencyTree(IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.GetVariableDependencyTree(codings);
    public static Response DeriveValue(IReadOnlyList<VariableCodingData> codings, VariableCodingData coding, IReadOnlyList<Response> sources) =>
        CodingSchemeFactory.DeriveValue(codings, coding, sources);
    public static List<Response> Code(IReadOnlyList<Response> responses, IReadOnlyList<VariableCodingData> codings, Action<Exception>? onError = null) =>
        CodingSchemeFactory.Code(responses, codings, onError);
    public static List<CodingSchemeProblem> Validate(IReadOnlyList<VariableInfo> variables, IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.Validate(variables, codings);
    public static List<string> GetBaseVarsList(IReadOnlyList<string> aliases, IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.GetBaseVarsList(aliases, codings);
}

public static class SchemeCoder
{
    public static List<VariableGraphNode> GetVariableDependencyTree(IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.GetVariableDependencyTree(codings);
    public static Response DeriveValue(IReadOnlyList<VariableCodingData> codings, VariableCodingData coding, IReadOnlyList<Response> sources) =>
        CodingSchemeFactory.DeriveValue(codings, coding, sources);
    public static List<Response> Code(IReadOnlyList<Response> responses, IReadOnlyList<VariableCodingData> codings, Action<Exception>? onError = null) =>
        CodingSchemeFactory.Code(responses, codings, onError);
    public static List<CodingSchemeProblem> Validate(IReadOnlyList<VariableInfo> variables, IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.Validate(variables, codings);
    public static List<string> GetBaseVarsList(IReadOnlyList<string> aliases, IReadOnlyList<VariableCodingData> codings) =>
        CodingSchemeFactory.GetBaseVarsList(aliases, codings);
}

public static class CodingFormatter
{
    public static string SourceAsText(string variableId, string sourceType, IReadOnlyList<string> sources, VariableSourceParameters? parameters = null) =>
        ToTextFactory.SourceAsText(variableId, sourceType, sources, parameters);
    public static string ProcessingAsText(IReadOnlyList<string> processing, string? fragmenting = null) =>
        ToTextFactory.ProcessingAsText(processing, fragmenting);
    public static CodeAsText CodeAsText(CodeData code, string mode = "EXTENDED") => ToTextFactory.CodeAsText(code, mode);
    public static List<string> VarInfoAsText(VariableInfo variable) => ToTextFactory.VarInfoAsText(variable);
}

public static class CodingTextRenderer
{
    public static string SourceAsText(string variableId, string sourceType, IReadOnlyList<string> sources, VariableSourceParameters? parameters = null) =>
        ToTextFactory.SourceAsText(variableId, sourceType, sources, parameters);
    public static string ProcessingAsText(IReadOnlyList<string> processing, string? fragmenting = null) =>
        ToTextFactory.ProcessingAsText(processing, fragmenting);
    public static CodeAsText CodeAsText(CodeData code, string mode = "EXTENDED") => ToTextFactory.CodeAsText(code, mode);
    public static List<string> VarInfoAsText(VariableInfo variable) => ToTextFactory.VarInfoAsText(variable);
}

public static class CodingSchemeTextRenderer
{
    public static List<CodingAsText> AsText(IReadOnlyList<VariableCodingData> codings, string mode = "EXTENDED") =>
        CodingSchemeTextFactory.AsText(codings, mode);
}
