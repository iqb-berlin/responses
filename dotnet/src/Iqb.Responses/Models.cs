using System.Text.Json.Serialization;

namespace Iqb.Responses;

public sealed class Response
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = ResponseStatus.Unset;

    [JsonPropertyName("value")]
    [JsonConverter(typeof(ResponseValueJsonConverter))]
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public object? Value { get; set; }

    [JsonPropertyName("subform")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Subform { get; set; }

    [JsonPropertyName("code")]
    [JsonConverter(typeof(ScalarUnionJsonConverter))]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Code { get; set; }

    [JsonPropertyName("score")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Score { get; set; }
}

public sealed class CodingRule
{
    [JsonPropertyName("method")]
    public string Method { get; set; } = string.Empty;

    [JsonPropertyName("parameters")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Parameters { get; set; }

    [JsonPropertyName("fragment")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Fragment { get; set; }
}

public sealed class RuleSet
{
    [JsonPropertyName("rules")]
    public List<CodingRule> Rules { get; set; } = [];

    [JsonPropertyName("ruleOperatorAnd")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? RuleOperatorAnd { get; set; }

    [JsonPropertyName("valueArrayPos")]
    [JsonConverter(typeof(ScalarUnionJsonConverter))]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? ValueArrayPos { get; set; }
}

public sealed class CodeData
{
    [JsonPropertyName("id")]
    [JsonConverter(typeof(ScalarUnionJsonConverter))]
    public object Id { get; set; } = 0d;

    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Type { get; set; }

    [JsonPropertyName("label")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Label { get; set; }

    [JsonPropertyName("score")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Score { get; set; }

    [JsonPropertyName("manualInstruction")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ManualInstruction { get; set; }

    [JsonPropertyName("ruleSetOperatorAnd")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? RuleSetOperatorAnd { get; set; }

    [JsonPropertyName("ruleSets")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<RuleSet>? RuleSets { get; set; }
}

public sealed class VariableSourceParameters
{
    [JsonPropertyName("solverExpression")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SolverExpression { get; set; }

    [JsonPropertyName("processing")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Processing { get; set; }
}

public sealed class VariableCodingData
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("sourceType")]
    public string SourceType { get; set; } = string.Empty;

    [JsonPropertyName("alias")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Alias { get; set; }

    [JsonPropertyName("label")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Label { get; set; }

    [JsonPropertyName("sourceParameters")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public VariableSourceParameters? SourceParameters { get; set; }

    [JsonPropertyName("deriveSources")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? DeriveSources { get; set; }

    [JsonPropertyName("processing")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Processing { get; set; }

    [JsonPropertyName("fragmenting")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Fragmenting { get; set; }

    [JsonPropertyName("manualInstruction")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ManualInstruction { get; set; }

    [JsonPropertyName("codeModel")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CodeModel { get; set; }

    [JsonPropertyName("page")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Page { get; set; }

    [JsonPropertyName("codes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<CodeData>? Codes { get; set; }
}

public sealed class CodingSchemeData
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("variableCodings")]
    public List<VariableCodingData> VariableCodings { get; set; } = [];
}

public sealed class VariableValue
{
    [JsonPropertyName("value")]
    [JsonConverter(typeof(ScalarUnionJsonConverter))]
    public object Value { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;
}

public sealed class VariableInfo
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("alias")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Alias { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("format")]
    public string Format { get; set; } = string.Empty;

    [JsonPropertyName("multiple")]
    public bool Multiple { get; set; }

    [JsonPropertyName("nullable")]
    public bool Nullable { get; set; }

    [JsonPropertyName("values")]
    public List<VariableValue> Values { get; set; } = [];

    [JsonPropertyName("valuePositionLabels")]
    public List<string> ValuePositionLabels { get; set; } = [];

    [JsonPropertyName("valuesComplete")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ValuesComplete { get; set; }

    [JsonPropertyName("page")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Page { get; set; }
}

public sealed class CodingSchemeProblem
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("breaking")]
    public bool Breaking { get; set; }

    [JsonPropertyName("variableId")]
    public string VariableId { get; set; } = string.Empty;

    [JsonPropertyName("variableLabel")]
    public string VariableLabel { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Code { get; set; }
}

public sealed class VariableGraphNode
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("level")]
    public int Level { get; set; }

    [JsonPropertyName("sources")]
    public List<string> Sources { get; set; } = [];

    [JsonPropertyName("page")]
    public string Page { get; set; } = string.Empty;
}

public sealed class CodeAsText
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("score")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Score { get; set; }

    [JsonPropertyName("label")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Label { get; set; }

    [JsonPropertyName("hasManualInstruction")]
    public bool HasManualInstruction { get; set; }

    [JsonPropertyName("ruleSetOperatorAnd")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? RuleSetOperatorAnd { get; set; }

    [JsonPropertyName("ruleSetDescriptions")]
    public List<string> RuleSetDescriptions { get; set; } = [];
}

public sealed class CodingAsText
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("processing")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Processing { get; set; }

    [JsonPropertyName("hasManualInstruction")]
    public bool HasManualInstruction { get; set; }

    [JsonPropertyName("codes")]
    public List<CodeAsText> Codes { get; set; } = [];
}
