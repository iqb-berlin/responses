namespace Iqb.Responses;

/// <summary>Provides value conversion and rule-based coding for one response.</summary>
public static class CodingFactory
{
    /// <summary>Creates a base-variable coding definition with default values.</summary>
    public static VariableCodingData CreateBaseCodingVariable(string variableId, string sourceType)
    {
        return new VariableCodingData
        {
            Id = variableId,
            Alias = variableId,
            Label = string.Empty,
            SourceType = sourceType,
            SourceParameters = new VariableSourceParameters { SolverExpression = string.Empty, Processing = [] },
            DeriveSources = [],
            Processing = [],
            Fragmenting = string.Empty,
            ManualInstruction = string.Empty,
            CodeModel = "RULES_ONLY",
            Codes = []
        };
    }

    /// <summary>Creates a standard <c>BASE</c> coding definition.</summary>
    public static VariableCodingData CreateCodingVariable(string variableId) =>
        CreateBaseCodingVariable(variableId, "BASE");

    /// <summary>Converts a response scalar using the IQB/JavaScript-compatible numeric rules.</summary>
    public static double? GetValueAsNumber(object? value) => ValueTransforms.GetValueAsNumber(value);

    /// <summary>Converts a response scalar to its invariant string representation.</summary>
    public static string? GetValueAsString(object? value, IReadOnlyCollection<string>? processing = null) =>
        ValueTransforms.GetValueAsString(value, processing);

    /// <summary>Returns whether a response value is an empty string or empty list.</summary>
    public static bool IsEmptyValue(object? value) => ValueTransforms.IsEmptyValue(value);

    /// <summary>Codes one response without mutating the supplied response.</summary>
    public static Response Code(Response response, VariableCodingData? coding, Action<Exception>? onError = null)
    {
        var result = IqbJson.Clone(response);
        if (coding?.Codes is not { Count: > 0 })
        {
            result.Status = ResponseStatus.NoCoding;
            return result;
        }

        object? transformed;
        try
        {
            transformed = ValueTransforms.TransformValue(
                result.Value,
                coding.Fragmenting ?? string.Empty,
                coding.Processing?.Contains("SORT_ARRAY") == true);
        }
        catch (Exception error) when (error is ArgumentException or System.Text.RegularExpressions.RegexMatchTimeoutException)
        {
            onError?.Invoke(error);
            result.Status = ResponseStatus.CodingError;
            return result;
        }

        var residual = default(CodeData);
        try
        {
            var isArray = ValueTransforms.IsArray(result.Value);
            foreach (var code in coding.Codes)
            {
                if (code.Type is "RESIDUAL_AUTO" or "INTENDED_INCOMPLETE")
                {
                    residual = code;
                    continue;
                }
                var ruleSets = code.RuleSets ?? [];
                var matches = code.RuleSetOperatorAnd == true
                    ? ruleSets.Count > 0 && ruleSets.All(set => RuleEngine.IsMatchRuleSet(transformed, set, isArray, coding.Processing ?? []))
                    : ruleSets.Any(set => RuleEngine.IsMatchRuleSet(transformed, set, isArray, coding.Processing ?? []));
                if (!matches)
                {
                    continue;
                }
                ApplyCode(result, code, false);
                return result;
            }
        }
        catch (Exception error)
        {
            onError?.Invoke(error);
            result.Status = ResponseStatus.CodingError;
            return result;
        }

        if (residual is null)
        {
            result.Status = ResponseStatus.CodingIncomplete;
            return result;
        }
        ApplyCode(result, residual, true);
        return result;
    }

    private static void ApplyCode(Response response, CodeData code, bool isResidual)
    {
        var id = code.Id is string text ? text : null;
        if (id == ResponseStatus.Invalid)
        {
            response.Status = ResponseStatus.Invalid;
            response.Code = 0;
            response.Score = 0;
            return;
        }
        if (code.Type == ResponseStatus.IntendedIncomplete || id == ResponseStatus.IntendedIncomplete)
        {
            response.Status = ResponseStatus.IntendedIncomplete;
            response.Code = isResidual ? code.Id : 0d;
            response.Score = code.Score ?? 0;
            return;
        }
        response.Status = ResponseStatus.CodingComplete;
        response.Code = NumericCode(code.Id);
        response.Score = code.Score ?? 0;
    }

    private static double NumericCode(object id) => id switch
    {
        double number => number,
        int number => number,
        long number => number,
        _ => 0d
    };
}
