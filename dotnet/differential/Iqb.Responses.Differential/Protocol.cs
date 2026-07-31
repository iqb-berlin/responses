using System.Text.Json;
using System.Text.Json.Serialization;
using Iqb.Responses;

namespace Iqb.Responses.Differential;

internal sealed class DifferentialRequest
{
    public int ProtocolVersion { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? Id { get; set; }
    public DifferentialInput Input { get; set; } = new();
    public List<DifferentialCall> Calls { get; set; } = [];
}

internal sealed class DifferentialInput
{
    public List<VariableInfo> BaseVariables { get; set; } = [];
    public List<VariableCodingData> VariableCodings { get; set; } = [];
    public List<Response> Responses { get; set; } = [];
}

internal sealed class DifferentialCall
{
    public string Op { get; set; } = string.Empty;
    public int? CodingIndex { get; set; }
    public int? ResponseIndex { get; set; }
    public List<int> SourceResponseIndexes { get; set; } = [];
    public List<string> Aliases { get; set; } = [];
    public List<string> Processing { get; set; } = [];
    public string? Mode { get; set; }
}

internal sealed class DifferentialEnvelope
{
    public int ProtocolVersion { get; set; } = 1;
    public string Kind { get; set; } = "result";
    public string? Id { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Capabilities { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<DifferentialCallResult>? Calls { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DifferentialOutcome? Outcome { get; set; }

    public static DifferentialEnvelope InvalidRequest(string? id, string message) => new()
    {
        Kind = "error",
        Id = id,
        Outcome = DifferentialOutcome.Error("request", "INVALID_REQUEST", message)
    };

    public static DifferentialEnvelope Unexpected(string? id, Exception error) => new()
    {
        Kind = "error",
        Id = id,
        Outcome = DifferentialOutcome.Error("worker", "UNEXPECTED", error.Message)
    };
}

internal sealed class DifferentialCallResult
{
    public string Op { get; set; } = string.Empty;
    public DifferentialOutcome Outcome { get; set; } = new();
    public List<DifferentialDiagnostic> Diagnostics { get; set; } = [];
}

internal sealed class DifferentialOutcome
{
    public string Kind { get; set; } = "value";
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public JsonElement? Value { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Phase { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Category { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Detail { get; set; }

    public static DifferentialOutcome FromValue(object? value) => new()
    {
        Value = JsonSerializer.SerializeToElement(value, IqbJson.Options)
    };
    public static DifferentialOutcome Error(string phase, string category, string? detail = null) => new()
    {
        Kind = "error",
        Phase = phase,
        Category = category,
        Detail = detail
    };
}

internal sealed class DifferentialDiagnostic
{
    public string Phase { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}
