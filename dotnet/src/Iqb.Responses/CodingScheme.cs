using System.Text.Json;

namespace Iqb.Responses;

/// <summary>Normalizes IQB coding-scheme JSON for use by the native engine.</summary>
public sealed class CodingScheme
{
    /// <summary>Gets the normalized coding definitions.</summary>
    public List<VariableCodingData> VariableCodings { get; }

    /// <summary>Creates and normalizes a coding scheme from coding definitions.</summary>
    public CodingScheme(IEnumerable<VariableCodingData>? variableCodings)
    {
        VariableCodings = Normalize(variableCodings ?? []);
    }

    /// <summary>Parses an array or coding-scheme object from JSON.</summary>
    public static CodingScheme Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        List<VariableCodingData> codings;
        if (root.ValueKind == JsonValueKind.Array)
        {
            codings = JsonSerializer.Deserialize<List<VariableCodingData>>(json, IqbJson.Options) ?? [];
        }
        else
        {
            codings = JsonSerializer.Deserialize<CodingSchemeData>(json, IqbJson.Options)?.VariableCodings ?? [];
        }
        return new CodingScheme(codings);
    }

    private static List<VariableCodingData> Normalize(IEnumerable<VariableCodingData> input)
    {
        var codings = IqbJson.Clone(input.ToList());
        foreach (var coding in codings)
        {
            coding.Alias ??= coding.Id;
            coding.Label ??= string.Empty;
            coding.SourceParameters ??= new VariableSourceParameters();
            coding.SourceParameters.SolverExpression ??= string.Empty;
            coding.SourceParameters.Processing ??= [];
            coding.DeriveSources ??= [];
            coding.Processing ??= [];
            coding.Fragmenting ??= string.Empty;
            coding.ManualInstruction ??= string.Empty;
            coding.Codes ??= [];

            for (var index = 0; index < coding.Codes.Count; index++)
            {
                var code = coding.Codes[index];
                if (code.Id is null) code.Id = ResponseStatus.Invalid;
                var hasElse = (code.RuleSets ?? []).Any(set => set.Rules.Any(rule => rule.Method == "ELSE"));
                if (hasElse)
                {
                    coding.Codes[index] = new CodeData
                    {
                        Id = code.Id,
                        Type = "RESIDUAL_AUTO",
                        Label = code.Label,
                        Score = 0,
                        RuleSetOperatorAnd = false,
                        RuleSets = [],
                        ManualInstruction = code.ManualInstruction
                    };
                    continue;
                }
                code.Type ??= "UNSET";
                foreach (var ruleSet in code.RuleSets ?? [])
                {
                    if (ruleSet.ValueArrayPos is double number && number == -1) ruleSet.ValueArrayPos = "ANY";
                }
            }

            if (coding.CodeModel is null or "NONE")
            {
                var hasRules = coding.Codes.Any(code => code.RuleSets is { Count: > 0 });
                var hasManual = coding.ManualInstruction.Length > 0 || coding.Codes.Any(code => !string.IsNullOrEmpty(code.ManualInstruction));
                coding.CodeModel = coding.SourceType == "MANUAL" || !hasRules && hasManual
                    ? "MANUAL_ONLY"
                    : hasRules && hasManual ? "MANUAL_AND_RULES" : "RULES_ONLY";
            }
        }
        return codings;
    }
}
