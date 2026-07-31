using System.Text.RegularExpressions;

namespace Iqb.Responses;

internal static class CodingSchemeValidation
{
    private static readonly IReadOnlyDictionary<string, int> ParameterCounts = new Dictionary<string, int>
    {
        ["MATCH"] = -1,
        ["MATCH_REGEX"] = -1,
        ["NUMERIC_MATCH"] = -1,
        ["NUMERIC_RANGE"] = 2,
        ["NUMERIC_FULL_RANGE"] = 2,
        ["NUMERIC_LESS_THAN"] = 1,
        ["NUMERIC_MORE_THAN"] = 1,
        ["NUMERIC_MAX"] = 1,
        ["NUMERIC_MIN"] = 1,
        ["IS_EMPTY"] = 0,
        ["IS_NULL"] = 0,
        ["IS_TRUE"] = 0,
        ["IS_FALSE"] = 0
    };
    private static readonly HashSet<string> NumericRules =
        ["NUMERIC_MATCH", "NUMERIC_RANGE", "NUMERIC_FULL_RANGE", "NUMERIC_MIN",
            "NUMERIC_MORE_THAN", "NUMERIC_LESS_THAN", "NUMERIC_MAX"];
    private static readonly HashSet<string> BooleanRules = ["IS_TRUE", "IS_FALSE"];

    public static List<CodingSchemeProblem> Validate(
        IReadOnlyList<VariableInfo> baseVariables,
        IReadOnlyList<VariableCodingData> codings)
    {
        var problems = new List<CodingSchemeProblem>();
        var baseById = baseVariables.GroupBy(item => item.Id).ToDictionary(group => group.Key, group => group.Last());
        var codingById = codings.GroupBy(item => item.Id).ToDictionary(group => group.Key, group => group.Last());
        var aliasGroups = codings.Where(item => !string.IsNullOrEmpty(item.Alias)).GroupBy(item => item.Alias!).ToDictionary(group => group.Key, group => group.ToList());

        foreach (var duplicate in baseVariables.GroupBy(item => item.Id).Where(group => group.Count() > 1))
            Add(problems, "INVALID_SOURCE", true, duplicate.Key, string.Empty);

        foreach (var coding in codings)
        {
            var publicId = coding.Alias ?? coding.Id;
            var label = coding.Label ?? string.Empty;
            if (codings.Count(item => item.Id == coding.Id) > 1) Add(problems, "INVALID_SOURCE", true, publicId, label);
            if (coding.Alias is not null && aliasGroups[coding.Alias].Count > 1 && !AllowedShadowGroup(coding.Alias, aliasGroups, codingById))
                Add(problems, "INVALID_SOURCE", true, publicId, label);
            if (HasPublicCollision(coding, codingById) && !ShadowsBase(coding, codingById))
                Add(problems, "INVALID_SOURCE", true, publicId, label);
        }

        var derivedIds = codings.Where(item => item.SourceType is not ("BASE" or "BASE_NO_VALUE")).Select(item => item.Id).ToHashSet();
        var baseIds = baseVariables.Select(item => item.Id).ToHashSet();
        var possibleSources = baseIds.Concat(derivedIds).ToHashSet();
        var copiedSources = codings.Where(item => item.SourceType == "COPY_VALUE").SelectMany(item => item.DeriveSources ?? []).ToHashSet();

        foreach (var coding in codings)
        {
            var publicId = coding.Alias ?? coding.Id;
            var label = coding.Label ?? string.Empty;
            ValidateSources(coding, publicId, label, baseById, baseIds, possibleSources, problems);
            var shape = GetShape(coding, baseById, codingById, []);
            if (coding.Codes is { Count: > 0 })
            {
                foreach (var code in coding.Codes)
                    foreach (var ruleSet in code.RuleSets ?? [])
                    {
                        ValidateArrayPosition(ruleSet, shape, publicId, label, CodeRef(code), problems);
                        foreach (var rule in ruleSet.Rules)
                            ValidateRule(coding, rule, shape, publicId, label, CodeRef(code), problems);
                    }
            }
            else if (!copiedSources.Contains(coding.Id) && coding.SourceType != "BASE_NO_VALUE")
            {
                Add(problems, "VACANT", false, publicId, label);
            }
        }
        return problems;
    }

    private static void ValidateSources(
        VariableCodingData coding, string publicId, string label,
        IReadOnlyDictionary<string, VariableInfo> baseById, HashSet<string> baseIds,
        HashSet<string> possibleSources, List<CodingSchemeProblem> problems)
    {
        if (coding.SourceType == "BASE")
        {
            if (!baseIds.Contains(coding.Id)) Add(problems, "SOURCE_MISSING", true, publicId, label);
            return;
        }
        if (coding.SourceType == "BASE_NO_VALUE")
        {
            if (baseById.TryGetValue(coding.Id, out var info) && info.Type != "no-value")
                Add(problems, "INVALID_SOURCE", true, publicId, label);
            if (!baseIds.Contains(coding.Id)) Add(problems, "SOURCE_MISSING", true, publicId, label);
            return;
        }
        var sources = coding.DeriveSources;
        if (sources is not { Count: > 0 })
        {
            Add(problems, "SOURCE_MISSING", true, publicId, label);
            return;
        }
        if (coding.SourceType == "COPY_VALUE")
        {
            if (sources.Count > 1) Add(problems, "MORE_THAN_ONE_SOURCE", false, publicId, label);
            if (possibleSources.Contains(sources[0]) && !baseIds.Contains(sources[0]))
                Add(problems, "VALUE_COPY_NOT_FROM_BASE", false, publicId, label);
        }
        else if (sources.Count == 1) Add(problems, "ONLY_ONE_SOURCE", false, publicId, label);
        foreach (var source in sources.Where(source => !possibleSources.Contains(source)))
            Add(problems, "SOURCE_MISSING", true, publicId, label);
    }

    private static void ValidateArrayPosition(
        RuleSet ruleSet, ValueShape shape, string id, string label, string code,
        List<CodingSchemeProblem> problems)
    {
        var position = ruleSet.ValueArrayPos;
        var allowed = position is null || position is double || position is string text &&
            text is "ANY" or "ANY_OPEN" or "SUM" or "LENGTH";
        if (!allowed) Add(problems, "RULESET_VALUE_ARRAY_POS_INVALID", true, id, label, code);
        if (position is double number && (number < 0 || number != Math.Truncate(number)))
            Add(problems, "RULESET_VALUE_ARRAY_POS_INVALID", true, id, label, code);
        if (position is not null && shape.Multiple == false)
            Add(problems, "RULESET_VALUE_ARRAY_POS_INVALID", true, id, label, code);
        if (position is double index && shape.Multiple == true && shape.PositionLabels.Count > 0 && index >= shape.PositionLabels.Count)
            Add(problems, "RULESET_VALUE_ARRAY_POS_INVALID", true, id, label, code);
    }

    private static void ValidateRule(
        VariableCodingData coding, CodingRule rule, ValueShape shape,
        string id, string label, string code, List<CodingSchemeProblem> problems)
    {
        var parameters = rule.Parameters ?? [];
        var hasKnownParameterCount = ParameterCounts.TryGetValue(rule.Method, out var expected);
        var parameterCountMismatch = !hasKnownParameterCount ||
                                     (expected < 0 ? parameters.Count < 1 : parameters.Count != expected);
        if (parameterCountMismatch)
        {
            Add(problems, "RULE_PARAMETER_COUNT_MISMATCH", true, id, label, code);
            return;
        }
        if (rule.Fragment is not null && (string.IsNullOrEmpty(coding.Fragmenting) ||
                                          rule.Fragment < -1 || rule.Fragment != Math.Truncate(rule.Fragment.Value)))
            Add(problems, "RULE_PARAMETER_INVALID", true, id, label, code);
        if ((NumericRules.Contains(rule.Method) || BooleanRules.Contains(rule.Method)) &&
            shape.Type is not ("unknown" or "numeric" or "boolean" or "string"))
            Add(problems, "RULE_PARAMETER_INVALID", true, id, label, code);
        if (rule.Method == "MATCH_REGEX")
        {
            foreach (var pattern in parameters.SelectMany(SplitLines))
            {
                try { _ = new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(500)); }
                catch (ArgumentException) { Add(problems, "RULE_REGEX_INVALID", true, id, label, code); }
            }
        }
        if (rule.Method is "NUMERIC_MATCH" or "NUMERIC_LESS_THAN" or "NUMERIC_MORE_THAN" or "NUMERIC_MAX" or "NUMERIC_MIN")
        {
            if (parameters.SelectMany(SplitLines).Any(value => ValueTransforms.ParseFloatPrefix(value) is not { } number || !double.IsFinite(number)))
                Add(problems, "RULE_PARAMETER_INVALID", true, id, label, code);
        }
        if (rule.Method is "NUMERIC_RANGE" or "NUMERIC_FULL_RANGE")
        {
            var lower = parameters.Count > 0 ? ValueTransforms.ParseFloatPrefix(parameters[0]) : null;
            var upper = parameters.Count > 1 ? ValueTransforms.ParseFloatPrefix(parameters[1]) : null;
            if (lower is null || upper is null || !double.IsFinite(lower.Value) || !double.IsFinite(upper.Value) || lower > upper)
                Add(problems, "RULE_NUMERIC_RANGE_INVALID", true, id, label, code);
        }
    }

    private static ValueShape GetShape(
        VariableCodingData coding,
        IReadOnlyDictionary<string, VariableInfo> baseById,
        IReadOnlyDictionary<string, VariableCodingData> codingById,
        HashSet<string> visited)
    {
        if (!visited.Add(coding.Id)) return ValueShape.Unknown;
        return coding.SourceType switch
        {
            "BASE" => baseById.TryGetValue(coding.Id, out var info) ? ShapeOf(info) : ValueShape.Unknown,
            "COPY_VALUE" when coding.DeriveSources is { Count: > 0 } =>
                GetSourceShape(coding.DeriveSources[0], baseById, codingById, visited),
            "CONCAT_CODE" => new ValueShape("string", false, []),
            "SUM_CODE" or "SUM_SCORE" or "SOLVER" => new ValueShape("numeric", false, []),
            "UNIQUE_VALUES" => new ValueShape("boolean", false, []),
            "BASE_NO_VALUE" => new ValueShape("other", false, []),
            _ => ValueShape.Unknown
        };
    }

    private static ValueShape ShapeOf(VariableInfo info) => info.Type switch
    {
        "no-value" => new ValueShape("string", true, []),
        "integer" or "number" => new ValueShape("numeric", info.Multiple, info.ValuePositionLabels),
        "boolean" => new ValueShape("boolean", info.Multiple, info.ValuePositionLabels),
        "string" => new ValueShape("string", info.Multiple, info.ValuePositionLabels),
        _ => new ValueShape("other", info.Multiple, info.ValuePositionLabels)
    };

    private static ValueShape GetSourceShape(
        string sourceId,
        IReadOnlyDictionary<string, VariableInfo> baseById,
        IReadOnlyDictionary<string, VariableCodingData> codingById,
        HashSet<string> visited)
    {
        if (codingById.TryGetValue(sourceId, out var sourceCoding))
            return GetShape(sourceCoding, baseById, codingById, visited);
        return baseById.TryGetValue(sourceId, out var sourceInfo) ? ShapeOf(sourceInfo) : ValueShape.Unknown;
    }

    private static bool ShadowsBase(VariableCodingData coding, IReadOnlyDictionary<string, VariableCodingData> byId) =>
        coding.Alias is not null && coding.Alias != coding.Id && coding.SourceType is not ("BASE" or "BASE_NO_VALUE") &&
        byId.TryGetValue(coding.Alias, out var shadowed) && shadowed.SourceType == "BASE" &&
        (coding.DeriveSources ?? []).Contains(shadowed.Id);

    private static bool AllowedShadowGroup(
        string alias,
        IReadOnlyDictionary<string, List<VariableCodingData>> aliases,
        IReadOnlyDictionary<string, VariableCodingData> byId) =>
        byId.TryGetValue(alias, out var shadowed) && shadowed.SourceType == "BASE" &&
        aliases[alias].Where(item => item.Id != shadowed.Id).ToList() is { Count: 1 } others && ShadowsBase(others[0], byId);

    private static bool HasPublicCollision(VariableCodingData coding, IReadOnlyDictionary<string, VariableCodingData> byId) =>
        coding.Alias is not null && coding.Alias != coding.Id && byId.TryGetValue(coding.Alias, out var match) &&
        match.SourceType != "BASE_NO_VALUE" && (match.Alias ?? match.Id) == coding.Alias;

    private static string CodeRef(CodeData code) => code.Id switch
    {
        double number => ValueTransforms.NumberToString(number),
        null => "null",
        _ => code.Id.ToString() ?? "null"
    };

    private static IEnumerable<string> SplitLines(string text) => text.Split(["\r\n", "\n"], StringSplitOptions.None);

    private static void Add(List<CodingSchemeProblem> result, string type, bool breaking, string id, string label, string? code = null) =>
        result.Add(new CodingSchemeProblem { Type = type, Breaking = breaking, VariableId = id, VariableLabel = label, Code = code });

    private readonly record struct ValueShape(string Type, bool? Multiple, IReadOnlyList<string> PositionLabels)
    {
        public static ValueShape Unknown => new("unknown", null, []);
    }
}
