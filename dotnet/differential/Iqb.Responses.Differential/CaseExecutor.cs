using System.Text.Json;
using System.Text.RegularExpressions;
using Iqb.Responses;

namespace Iqb.Responses.Differential;

internal static class CaseExecutor
{
    public static List<string> Capabilities { get; } =
    [
        "normalizeScheme", "validate", "dependencyTree", "code", "deriveValue", "getBaseVarsList",
        "schemeText", "singleCode", "getValueAsNumber", "getValueAsString", "isEmptyValue", "variableList"
    ];

    public static DifferentialEnvelope Execute(DifferentialRequest request)
    {
        if (request.ProtocolVersion != 1 || request.Kind != "case")
            return DifferentialEnvelope.InvalidRequest(request.Id, "Unsupported protocol or request kind.");

        var calls = request.Calls.Select(call => ExecuteCall(request.Input, call)).ToList();
        return new DifferentialEnvelope { Id = request.Id, Calls = calls };
    }

    private static DifferentialCallResult ExecuteCall(DifferentialInput input, DifferentialCall call)
    {
        var diagnostics = new List<DifferentialDiagnostic>();
        try
        {
            object? value = call.Op switch
            {
                "normalizeScheme" => new CodingScheme(input.VariableCodings).VariableCodings,
                "validate" => CodingSchemeFactory.Validate(input.BaseVariables, Normalized(input)),
                "dependencyTree" => CodingSchemeFactory.GetVariableDependencyTree(Normalized(input)),
                "code" => CodingSchemeFactory.Code(input.Responses, Normalized(input), Capture(diagnostics, "code")),
                "deriveValue" => Derive(input, call),
                "getBaseVarsList" => CodingSchemeFactory.GetBaseVarsList(call.Aliases, Normalized(input)),
                "schemeText" => CodingSchemeTextFactory.AsText(Normalized(input), call.Mode ?? "EXTENDED"),
                "singleCode" => SingleCode(input, call, diagnostics),
                "getValueAsNumber" => CodingFactory.GetValueAsNumber(ResponseAt(input, call).Value),
                "getValueAsString" => CodingFactory.GetValueAsString(ResponseAt(input, call).Value, call.Processing),
                "isEmptyValue" => CodingFactory.IsEmptyValue(ResponseAt(input, call).Value),
                "variableList" => new VariableList(input.BaseVariables).Variables,
                _ => throw new NotSupportedException($"Unknown operation '{call.Op}'.")
            };
            return new DifferentialCallResult
            {
                Op = call.Op,
                Outcome = DifferentialOutcome.FromValue(value),
                Diagnostics = diagnostics
            };
        }
        catch (Exception error)
        {
            return new DifferentialCallResult
            {
                Op = call.Op,
                Outcome = DifferentialOutcome.Error(call.Op, Category(error)),
                Diagnostics = diagnostics
            };
        }
    }

    private static List<VariableCodingData> Normalized(DifferentialInput input) =>
        new CodingScheme(input.VariableCodings).VariableCodings;

    private static Response Derive(DifferentialInput input, DifferentialCall call)
    {
        var codings = Normalized(input);
        var coding = CodingAt(codings, call);
        var sources = call.SourceResponseIndexes.Select(index => At(input.Responses, index, "response")).ToList();
        return CodingSchemeFactory.DeriveValue(codings, coding, sources);
    }

    private static Response SingleCode(
        DifferentialInput input,
        DifferentialCall call,
        List<DifferentialDiagnostic> diagnostics) =>
        CodingFactory.Code(ResponseAt(input, call), CodingAt(Normalized(input), call), Capture(diagnostics, "singleCode"));

    private static VariableCodingData CodingAt(IReadOnlyList<VariableCodingData> codings, DifferentialCall call) =>
        At(codings, call.CodingIndex ?? 0, "coding");

    private static Response ResponseAt(DifferentialInput input, DifferentialCall call) =>
        At(input.Responses, call.ResponseIndex ?? 0, "response");

    private static T At<T>(IReadOnlyList<T> values, int index, string kind) =>
        index >= 0 && index < values.Count ? values[index] : throw new IndexOutOfRangeException($"Invalid {kind} index.");

    private static Action<Exception> Capture(List<DifferentialDiagnostic> diagnostics, string phase) => error =>
        diagnostics.Add(new DifferentialDiagnostic { Phase = phase, Category = Category(error) });

    private static string Category(Exception error) => error switch
    {
        JsonException => "INPUT_DESERIALIZATION",
        RegexMatchTimeoutException => "REGEX_TIMEOUT",
        ArgumentException when error.Message.Contains("regular expression", StringComparison.OrdinalIgnoreCase) => "REGEX_SYNTAX",
        InvalidOperationException when error.Message.Contains("Circular dependency", StringComparison.OrdinalIgnoreCase) => "DEPENDENCY_CYCLE",
        FormatException => "SOLVER_SYNTAX",
        NotSupportedException => "INVALID_OPERATION",
        IndexOutOfRangeException => "INVALID_REQUEST",
        _ => "UNEXPECTED"
    };
}
