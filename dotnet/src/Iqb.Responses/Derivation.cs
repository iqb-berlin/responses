using System.Text.RegularExpressions;

namespace Iqb.Responses;

internal static class Derivation
{
    private static readonly HashSet<string> ValidStatesForDerivingValue =
        [ResponseStatus.ValueChanged, ResponseStatus.NoCoding, ResponseStatus.CodingIncomplete,
            ResponseStatus.CodingError, ResponseStatus.CodingComplete];
    private static readonly HashSet<string> PendingStartStates =
        [ResponseStatus.CodingIncomplete, ResponseStatus.CodingComplete, ResponseStatus.DerivePending,
            ResponseStatus.IntendedIncomplete];

    public static Response DeriveValue(
        IReadOnlyList<VariableCodingData> variableCodings,
        VariableCodingData coding,
        IReadOnlyList<Response> sourceResponses)
    {
        var subform = sourceResponses.FirstOrDefault(response => response.Subform is not null)?.Subform;
        var codingById = variableCodings.LastById(item => item.Id);
        var precedence = new (string From, string To)[]
        {
            (ResponseStatus.Unset, ResponseStatus.Unset),
            (ResponseStatus.DeriveError, ResponseStatus.DeriveError),
            (ResponseStatus.NoCoding, ResponseStatus.DeriveError),
            (ResponseStatus.CodingError, ResponseStatus.CodingError),
            (ResponseStatus.Invalid, ResponseStatus.Invalid)
        };

        foreach (var mapping in precedence)
        {
            if (sourceResponses.Any(response => AppliesPrecedence(response, mapping.From, coding, codingById)))
            {
                return NewResponse(coding, mapping.To, subform);
            }
        }

        var hasPending = sourceResponses.Any(response =>
            response.Status is ResponseStatus.CodingIncomplete or ResponseStatus.DerivePending);
        if (hasPending && sourceResponses.All(response => PendingStartStates.Contains(response.Status)) &&
            coding.SourceType is not ("MANUAL" or "COPY_VALUE" or "UNIQUE_VALUES" or "SOLVER"))
        {
            return NewResponse(coding, ResponseStatus.DerivePending, subform);
        }

        var falseStates = AmountFalseStates(coding, sourceResponses, variableCodings);
        if (sourceResponses.Count >= falseStates && falseStates > 0)
        {
            if (sourceResponses.All(response => response.Status == sourceResponses[0].Status))
            {
                return NewResponse(coding, sourceResponses[0].Status, subform);
            }
            if (sourceResponses.All(response => ResponseStatus.PartlyDisplayedStatuses.Contains(response.Status)))
            {
                return NewResponse(coding, ResponseStatus.PartlyDisplayed, subform);
            }
            return NewResponse(coding, ResponseStatus.Invalid, subform);
        }

        var responseById = sourceResponses.LastById(response => response.Id);
        return coding.SourceType switch
        {
            "MANUAL" => HandleManual(coding, sourceResponses, subform),
            "COPY_VALUE" => HandleCopyValue(coding, sourceResponses, subform),
            "CONCAT_CODE" => HandleConcatCode(coding, responseById, subform),
            "SUM_CODE" => HandleSum(coding, responseById, subform, score: false),
            "SUM_SCORE" => HandleSum(coding, responseById, subform, score: true),
            "UNIQUE_VALUES" => HandleUniqueValues(coding, sourceResponses, subform),
            "SOLVER" => HandleSolver(variableCodings, coding, responseById, subform),
            _ => Error(coding, subform)
        };
    }

    private static bool AppliesPrecedence(
        Response response,
        string sourceStatus,
        VariableCodingData coding,
        IReadOnlyDictionary<string, VariableCodingData> codingById)
    {
        if (coding.SourceType != "SOLVER") return response.Status == sourceStatus;
        codingById.TryGetValue(response.Id, out var sourceCoding);
        if (sourceStatus == ResponseStatus.NoCoding)
        {
            return response.Status == sourceStatus && sourceCoding?.SourceType != "BASE";
        }
        if (sourceStatus == ResponseStatus.Invalid && response.Status == sourceStatus &&
            sourceCoding?.SourceType == "BASE" && IsSolverEmpty(response.Value))
        {
            return false;
        }
        return response.Status == sourceStatus;
    }

    private static int AmountFalseStates(
        VariableCodingData coding,
        IReadOnlyList<Response> responses,
        IReadOnlyList<VariableCodingData> variableCodings)
    {
        if (coding.SourceType == "MANUAL")
        {
            return responses.Count(response => !ResponseStatus.ManualValid.Contains(response.Status) &&
                !(response.Status == ResponseStatus.Displayed && HasSourceProcessing(coding, "TAKE_DISPLAYED_AS_VALUE_CHANGED")) &&
                !(response.Status == ResponseStatus.NotReached && HasSourceProcessing(coding, "TAKE_NOT_REACHED_AS_VALUE_CHANGED")));
        }
        if (coding.SourceType is "COPY_VALUE" or "UNIQUE_VALUES" or "SOLVER")
        {
            var codingById = variableCodings.LastById(item => item.Id);
            return responses.Count(response =>
            {
                var solverEmptyBase = coding.SourceType == "SOLVER" && response.Status == ResponseStatus.Invalid &&
                    codingById.TryGetValue(response.Id, out var sourceCoding) && sourceCoding.SourceType == "BASE" &&
                    IsSolverEmpty(response.Value);
                return !ResponseStatus.CopySolverValid.Contains(response.Status) && !solverEmptyBase;
            });
        }
        if (coding.SourceType is "CONCAT_CODE" or "SUM_CODE" or "SUM_SCORE")
        {
            return responses.Count(response => !ResponseStatus.ConcatSumValid.Contains(response.Status));
        }
        return 0;
    }

    private static Response HandleManual(VariableCodingData coding, IReadOnlyList<Response> responses, string? subform) =>
        NewResponse(coding,
            responses.All(response => response.Status == ResponseStatus.IntendedIncomplete)
                ? ResponseStatus.CodingIncomplete
                : ResponseStatus.CodingComplete,
            subform);

    private static Response HandleCopyValue(VariableCodingData coding, IReadOnlyList<Response> responses, string? subform)
    {
        if (responses.Any(response => response.Status == ResponseStatus.DerivePending))
        {
            return NewResponse(coding, ResponseStatus.DerivePending, subform);
        }
        if (responses.Count == 0) return Error(coding, subform);
        var value = IsTruthy(responses[0].Value) ? IqbJson.Clone(responses[0]).Value : null;
        return NewResponse(coding, ResponseStatus.ValueChanged, subform, value);
    }

    private static Response HandleConcatCode(
        VariableCodingData coding,
        IReadOnlyDictionary<string, Response> responseById,
        string? subform)
    {
        var values = (coding.DeriveSources ?? []).Select(sourceId =>
            responseById.TryGetValue(sourceId, out var response) && response.Code is not null
                ? CodeAsString(response.Code)
                : "?").ToList();
        if (HasSourceProcessing(coding, "SORT")) values.Sort(StringComparer.Ordinal);
        return NewResponse(coding, ResponseStatus.ValueChanged, subform, string.Join('_', values));
    }

    private static Response HandleSum(
        VariableCodingData coding,
        IReadOnlyDictionary<string, Response> responseById,
        string? subform,
        bool score)
    {
        var sources = coding.DeriveSources ?? [];
        if (sources.Any(source => !responseById.ContainsKey(source))) return Error(coding, subform);
        var value = sources.Sum(source => score
            ? responseById[source].Score ?? 0d
            : NumericCode(responseById[source].Code));
        return NewResponse(coding, ResponseStatus.ValueChanged, subform, value);
    }

    private static string CodeAsString(object code) => code switch
    {
        double number => ValueTransforms.NumberToString(number),
        string text => text,
        _ => code.ToString() ?? string.Empty
    };

    private static double NumericCode(object? code) => code switch
    {
        double number => number,
        int number => number,
        long number => number,
        _ => 0d
    };

    private static Response HandleUniqueValues(VariableCodingData coding, IReadOnlyList<Response> responses, string? subform)
    {
        var processing = coding.SourceParameters?.Processing ?? [];
        var toNumber = processing.Contains("TO_NUMBER");
        var values = responses.Where(response => ValidStatesForDerivingValue.Contains(response.Status)).Select(response =>
        {
            if (response.Value is IEnumerable<object?> sequence)
            {
                return string.Join("##", sequence.Select(value => toNumber
                    ? ValueTransforms.NumberToString(ValueTransforms.GetValueAsNumber(value) ?? 0d)
                    : ValueTransforms.GetValueAsString(value, processing) ?? string.Empty));
            }
            return toNumber
                ? ValueTransforms.NumberToString(ValueTransforms.GetValueAsNumber(response.Value) ?? 0d)
                : ValueTransforms.GetValueAsString(response.Value, processing) ?? string.Empty;
        }).ToList();
        var unique = values.Distinct(StringComparer.Ordinal).Count() == values.Count;
        return NewResponse(coding, ResponseStatus.ValueChanged, subform, unique);
    }

    private static Response HandleSolver(
        IReadOnlyList<VariableCodingData> variableCodings,
        VariableCodingData coding,
        IReadOnlyDictionary<string, Response> responseById,
        string? subform)
    {
        var parameters = coding.SourceParameters;
        if (string.IsNullOrEmpty(parameters?.SolverExpression)) return Error(coding, subform);
        var expression = parameters.SolverExpression;
        var tokens = ParseSolverTokens(expression);
        if (tokens is null) return Error(coding, subform);

        var codingById = variableCodings.LastById(item => item.Id);
        var sources = new HashSet<string>();
        var replacements = new Dictionary<string, SolverReplacement>(StringComparer.Ordinal);
        foreach (var token in tokens)
        {
            var sourceId = variableCodings.FirstOrDefault(item => item.Alias == token.Alias)?.Id ?? token.Alias;
            sources.Add(sourceId);
            replacements.TryAdd(token.Text, new SolverReplacement(sourceId, token.Fragment, token.EmptyPolicy, token.NonNumericPolicy));
        }
        if (sources.Any(source => !(coding.DeriveSources ?? []).Contains(source))) return Error(coding, subform);

        foreach (var replacement in replacements)
        {
            var resolution = ResolveSolverValue(replacement.Value, responseById, codingById);
            if (resolution.Kind == ResolutionKind.DeriveError) return Error(coding, subform);
            double number;
            if (resolution.Kind == ResolutionKind.Empty)
            {
                var policyResult = ApplyPolicy(coding, subform, replacement.Value.EmptyPolicy);
                if (policyResult.Response is not null) return policyResult.Response;
                number = policyResult.Number;
            }
            else if (resolution.Kind == ResolutionKind.NonNumeric)
            {
                var policyResult = ApplyPolicy(coding, subform, replacement.Value.NonNumericPolicy);
                if (policyResult.Response is not null) return policyResult.Response;
                number = policyResult.Number;
            }
            else number = resolution.Number;
            expression = expression.Replace(replacement.Key, ValueTransforms.NumberToString(number), StringComparison.Ordinal);
        }

        try
        {
            var result = SolverExpression.Evaluate(expression);
            if (result is null) return NewResponse(coding, ResponseStatus.ValueChanged, subform, null);
            if (result is not double number || !double.IsFinite(number)) return Error(coding, subform);
            return NewResponse(coding, ResponseStatus.ValueChanged, subform, number);
        }
        catch (Exception error) when (error is FormatException or OverflowException)
        {
            return Error(coding, subform);
        }
    }

    private static List<SolverToken>? ParseSolverTokens(string expression)
    {
        var result = new List<SolverToken>();
        var position = 0;
        while (position < expression.Length)
        {
            var start = expression.IndexOf("${", position, StringComparison.Ordinal);
            if (start < 0) break;
            var end = expression.IndexOf('}', start + 2);
            if (end < 0) break;
            var text = expression[start..(end + 1)];
            var token = ParseSolverToken(text, expression[(start + 2)..end]);
            if (token is null) return null;
            result.Add(token.Value);
            position = end + 1;
        }
        return result;
    }

    private static SolverToken? ParseSolverToken(string text, string content)
    {
        var parts = content.Split(':');
        if (parts.Length > 3) return null;
        var alias = parts[0].Trim();
        int? fragment = null;
        var empty = parts.Length > 1 ? ParsePolicy(parts[1]) : SolverPolicy.Error;
        var nonNumeric = parts.Length > 2 ? ParsePolicy(parts[2]) : SolverPolicy.Error;
        if (empty is null || nonNumeric is null) return null;
        if (alias.EndsWith(']'))
        {
            var bracket = alias.LastIndexOf('[');
            if (bracket < 0 || !int.TryParse(alias[(bracket + 1)..^1].Trim(), out var index) || index < 0) return null;
            fragment = index;
            alias = alias[..bracket].Trim();
        }
        if (alias.Length == 0 || alias.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '_' or ',' or '-')))
            return null;
        return new SolverToken(text, alias, fragment, empty.Value, nonNumeric.Value);
    }

    private static SolverPolicy? ParsePolicy(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Equals("ERROR", StringComparison.OrdinalIgnoreCase)) return SolverPolicy.Error;
        if (trimmed.Equals("INC", StringComparison.OrdinalIgnoreCase)) return SolverPolicy.Incomplete;
        if (trimmed.Length == 0) return null;
        var number = ValueTransforms.GetValueAsNumber(trimmed);
        return number is null ? null : new SolverPolicy(PolicyKind.Default, number.Value);
    }

    private static SolverResolution ResolveSolverValue(
        SolverReplacement replacement,
        IReadOnlyDictionary<string, Response> responseById,
        IReadOnlyDictionary<string, VariableCodingData> codingById)
    {
        if (!responseById.TryGetValue(replacement.SourceId, out var response)) return SolverResolution.Empty;
        if (replacement.Fragment is not null)
        {
            if (!codingById.TryGetValue(replacement.SourceId, out var sourceCoding) || response.Value is IEnumerable<object?>)
                return SolverResolution.DeriveError;
            object? transformed;
            try
            {
                transformed = ValueTransforms.TransformValue(response.Value, sourceCoding.Fragmenting ?? string.Empty, false);
            }
            catch (ArgumentException)
            {
                return SolverResolution.DeriveError;
            }
            if (transformed is not IEnumerable<object?> fragments) return SolverResolution.Empty;
            var list = fragments.ToList();
            if (replacement.Fragment.Value >= list.Count) return SolverResolution.Empty;
            var fragment = list[replacement.Fragment.Value];
            if (fragment is string text && string.IsNullOrWhiteSpace(text)) return SolverResolution.Empty;
            if (fragment is IEnumerable<object?>) return SolverResolution.DeriveError;
            var fragmentNumber = ValueTransforms.GetValueAsNumber(fragment);
            return fragmentNumber is null ? SolverResolution.NonNumeric : SolverResolution.Value(fragmentNumber.Value);
        }
        if (response.Value is IEnumerable<object?>) return SolverResolution.DeriveError;
        if (IsSolverEmpty(response.Value)) return SolverResolution.Empty;
        var number = ValueTransforms.GetValueAsNumber(response.Value);
        return number is null ? SolverResolution.NonNumeric : SolverResolution.Value(number.Value);
    }

    private static PolicyResult ApplyPolicy(VariableCodingData coding, string? subform, SolverPolicy policy) => policy.Kind switch
    {
        PolicyKind.Default => new PolicyResult(policy.Number, null),
        PolicyKind.Incomplete => new PolicyResult(0, NewResponse(coding, ResponseStatus.CodingIncomplete, subform)),
        _ => new PolicyResult(0, Error(coding, subform))
    };

    private static bool IsSolverEmpty(object? value) => value is null || value is string text && string.IsNullOrWhiteSpace(text);
    private static bool HasSourceProcessing(VariableCodingData coding, string processing) =>
        coding.SourceParameters?.Processing?.Contains(processing) == true;

    private static bool IsTruthy(object? value) => value switch
    {
        null => false,
        bool flag => flag,
        double number => number != 0 && !double.IsNaN(number),
        string text => text.Length > 0,
        _ => true
    };

    private static Response Error(VariableCodingData coding, string? subform) =>
        NewResponse(coding, ResponseStatus.DeriveError, subform);

    private static Response NewResponse(VariableCodingData coding, string status, string? subform, object? value = null) =>
        new() { Id = coding.Id, Value = value, Status = status, Subform = subform };

    private enum PolicyKind { Error, Incomplete, Default }
    private enum ResolutionKind { Value, Empty, NonNumeric, DeriveError }
    private readonly record struct SolverPolicy(PolicyKind Kind, double Number = 0)
    {
        public static SolverPolicy Error => new(PolicyKind.Error);
        public static SolverPolicy Incomplete => new(PolicyKind.Incomplete);
    }
    private readonly record struct SolverToken(string Text, string Alias, int? Fragment, SolverPolicy EmptyPolicy, SolverPolicy NonNumericPolicy);
    private readonly record struct SolverReplacement(string SourceId, int? Fragment, SolverPolicy EmptyPolicy, SolverPolicy NonNumericPolicy);
    private readonly record struct SolverResolution(ResolutionKind Kind, double Number = 0)
    {
        public static SolverResolution Empty => new(ResolutionKind.Empty);
        public static SolverResolution NonNumeric => new(ResolutionKind.NonNumeric);
        public static SolverResolution DeriveError => new(ResolutionKind.DeriveError);
        public static SolverResolution Value(double value) => new(ResolutionKind.Value, value);
    }
    private readonly record struct PolicyResult(double Number, Response? Response);
}
