namespace Iqb.Responses;

/// <summary>Formats coding definitions, rules and variable information as German text.</summary>
public static class ToTextFactory
{
    private static readonly IReadOnlyDictionary<string, string> TypeText = new Dictionary<string, string>
    {
        ["string"] = "String/Text",
        ["integer"] = "Ganze Zahl",
        ["number"] = "Zahl (Fließkomma)",
        ["boolean"] = "Ja/Nein",
        ["attachment"] = "Datei",
        ["json"] = "Daten im JSON-Format",
        ["no-value"] = "Ohne Antwortwert"
    };
    private static readonly IReadOnlyDictionary<string, string> FormatText = new Dictionary<string, string>
    {
        ["text-selection"] = "Textmarkierung",
        ["image"] = "Bild",
        ["capture-image"] = "Foto",
        ["audio"] = "Sprachaufnahme",
        ["ggb-file"] = "GeoGebra-Definition",
        ["ggb-variable"] = "GeoGebra-Variable",
        ["non-negative"] = "Nicht negativ",
        ["latex"] = "Mathematische Formel im LaTeX-Format",
        ["math-ml"] = "Mathematische Formel im Html-Format, MathML eingebettet",
        ["math-table"] = "Tabelle mit Zahlen für Rechenkästchen (JSON)",
        ["math-text-mix"] = "Text und mathematische Formeln gemischt"
    };
    private static readonly IReadOnlyDictionary<string, string> RuleText = new Dictionary<string, string>
    {
        ["MATCH"] = "Übereinstimmung (Zahl/Text) mit",
        ["MATCH_REGEX"] = "Übereinstimmung (reg. Ausdruck) mit",
        ["NUMERIC_MATCH"] = "Übereinstimmung (numerisch) mit",
        ["NUMERIC_RANGE"] = "..Kombi..",
        ["NUMERIC_FULL_RANGE"] = "..Kombi..",
        ["NUMERIC_LESS_THAN"] = "Wert geringer als",
        ["NUMERIC_MORE_THAN"] = "Wert größer als",
        ["NUMERIC_MAX"] = "Wert ist maximal",
        ["NUMERIC_MIN"] = "Wert ist mindestens",
        ["IS_EMPTY"] = "Leerer Wert",
        ["IS_NULL"] = "Wert ist NULL",
        ["IS_TRUE"] = "Wert ist WAHR",
        ["IS_FALSE"] = "Wert ist FALSCH"
    };
    private static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        ["UNSET"] = "-",
        ["FULL_CREDIT"] = "richtig",
        ["PARTIAL_CREDIT"] = "teilweise richtig",
        ["NO_CREDIT"] = "falsch",
        ["TO_CHECK"] = "zu prüfen",
        ["INTENDED_INCOMPLETE"] = "absichtlich unvollständig",
        ["RESIDUAL"] = "falsch",
        ["RESIDUAL_AUTO"] = "falsch"
    };

    /// <summary>Describes the source of a coding variable.</summary>
    public static string SourceAsText(
        string variableId,
        string sourceType,
        IReadOnlyList<string> sources,
        VariableSourceParameters? parameters = null)
    {
        switch (sourceType)
        {
            case "BASE":
                var baseMessages = new Dictionary<string, string>
                {
                    ["TAKE_DISPLAYED_AS_VALUE_CHANGED"] = "stets als geändert gesehen",
                    ["TAKE_EMPTY_AS_VALID"] = "leerer Wert ist gültig",
                    ["TAKE_NOT_REACHED_AS_VALUE_CHANGED"] = "stets als geändert gesehen"
                };
                var baseTexts = (parameters?.Processing ?? []).Where(baseMessages.ContainsKey).Select(key => baseMessages[key]).ToList();
                return $"Basisvariable '{variableId}'" + (baseTexts.Count > 0 ? $" ({string.Join("; ", baseTexts)})" : string.Empty);
            case "COPY_VALUE":
                return sources.Count > 0 ? $"Kopie von Variable '{sources[0]}'" : "Kopie, aber keine Quelle angegeben";
            case "CONCAT_CODE":
                var sorted = parameters?.Processing?.Contains("SORT") == true ? " (sortiert)" : string.Empty;
                return $"Codes von Variablen '{string.Join(", ", sources)}' aneinandergehängt mit Trennzeichen '_'{sorted}";
            case "SUM_CODE":
                return $"Codes von Variablen '{string.Join(", ", sources)}' summiert";
            case "SUM_SCORE":
                return $"Scores von Variablen '{string.Join(", ", sources)}' summiert";
            case "UNIQUE_VALUES":
                var uniqueMessages = new Dictionary<string, string>
                {
                    ["REMOVE_ALL_SPACES"] = "alle Leerzeichen werden entfernt",
                    ["REMOVE_DISPENSABLE_SPACES"] = "alle Leerzeichen vorn und hinten sowie die doppelten werden entfernt",
                    ["TO_NUMBER"] = "Umwandlung vorher in numerischen Wert",
                    ["TO_LOWER_CASE"] = "Umwandlung vorher in Kleinbuchstaben"
                };
                var uniqueTexts = uniqueMessages.Where(item => parameters?.Processing?.Contains(item.Key) == true).Select(item => item.Value).ToList();
                return $"Prüft, ob die Werte der Variablen '{string.Join(", ", sources)}' unique/einzigartig sind" +
                    (uniqueTexts.Count > 0 ? $" ({string.Join("; ", uniqueTexts)})" : string.Empty);
            case "SOLVER":
                var expression = !string.IsNullOrEmpty(parameters?.SolverExpression) ? $"\"{parameters.SolverExpression}\"" : "FEHLT";
                return $"Werte von Variablen '{string.Join(", ", sources)}' werden über einen mathematischen Ausdruck verknüpft (Ausdruck: {expression})";
            default:
                return "Unbekannte Quelle";
        }
    }

    /// <summary>Describes response-processing parameters.</summary>
    public static string ProcessingAsText(IReadOnlyList<string> processing, string? fragmenting = null)
    {
        var descriptions = new Dictionary<string, string>
        {
            ["REPLAY_REQUIRED"] = "Zur Kodierung muss die Antwort mit der Aufgabe angezeigt werden (Replay)",
            ["IGNORE_CASE"] = "Groß-/Kleinschreibung wird ignoriert",
            ["IGNORE_ALL_SPACES"] = "Entfernen aller Leerzeichen vor Kodierung",
            ["IGNORE_DISPENSABLE_SPACES"] = "Entfernen unnötiger Leerzeichen vor Kodierung",
            ["SORT_ARRAY"] = "Sortieren von Listenwerten vor Kodierung",
            ["ATTACHMENT"] = "Zur Kodierung ist eine separate Datei erforderlich (Bild, Audio)"
        };
        var text = string.Join(", ", processing.Select(value => descriptions.TryGetValue(value, out var description)
            ? description : $"?? unbekannter Wert für Prozessparameter '{value}'"));
        if (!string.IsNullOrEmpty(fragmenting))
        {
            if (text.Length > 0) text += "; ";
            text += $"Es wurde ein Ausdruck festgelegt, mit dem Teile der Antwort\n        vor der Kodierung extrahiert werden (Fragmentierung): '{fragmenting}'";
        }
        return text;
    }

    /// <summary>Formats one code definition in SIMPLE or EXTENDED mode.</summary>
    public static CodeAsText CodeAsText(CodeData code, string mode = "EXTENDED")
    {
        var type = code.Type ?? "UNSET";
        string? label = type == "UNSET" ? code.Label : Labels.GetValueOrDefault(type);
        if (mode == "SIMPLE" && type != "UNSET") label = label?.ToUpperInvariant();
        var descriptions = (code.RuleSets ?? []).Select((set, index) => RuleSetDescription(code, set, index, mode)).ToList();
        return new CodeAsText
        {
            Id = CodeId(code.Id),
            Score = code.Score,
            Label = label,
            RuleSetOperatorAnd = code.RuleSetOperatorAnd,
            HasManualInstruction = !string.IsNullOrEmpty(code.ManualInstruction),
            RuleSetDescriptions = descriptions
        };
    }

    private static string RuleSetDescription(CodeData code, RuleSet set, int index, string mode)
    {
        var rules = set.Rules;
        var prefix = (code.RuleSets?.Count ?? 0) > 1 && mode == "EXTENDED" ? $"Regelset {index + 1}: " : string.Empty;
        if (mode == "EXTENDED" && rules.Count == 0) return prefix + "Keine Regeln definiert.";
        if (code.Type is "RESIDUAL" or "RESIDUAL_AUTO") return prefix + "Alle anderen Antworten.";
        if (code.Type == "INTENDED_INCOMPLETE") return prefix + "Kodierung soll unvollständig sein.";

        var description = prefix;
        for (var ruleIndex = 0; ruleIndex < rules.Count; ruleIndex++)
        {
            var rule = rules[ruleIndex];
            if (rules.Count > 1 && mode == "EXTENDED")
                description += $"{(ruleIndex > 0 ? "; " : string.Empty)}(R{ruleIndex + 1}) ";
            description = AppendRule(description, rule, mode);
            var notLast = ruleIndex + 1 < rules.Count;
            var nextMethod = notLast ? rules[ruleIndex + 1].Method : null;
            if (mode == "SIMPLE" && rules.Count > 1 && notLast && nextMethod != "MATCH_REGEX")
                description += $"\n\n{(set.RuleOperatorAnd == true ? "UND" : "ODER")}\n\n";
        }
        var connector = rules.Count > 1 && mode == "EXTENDED" ? (set.RuleOperatorAnd == true ? "UND" : "ODER") + "-Verknüpfung" : string.Empty;
        var position = set.ValueArrayPos switch
        {
            double number when number >= 0 => $"A{number + 1:R}".Replace(".0", string.Empty, StringComparison.Ordinal),
            "SUM" => "A S",
            "LENGTH" => "A L",
            "ANY_OPEN" => "A O",
            _ => string.Empty
        };
        if (connector.Length > 0 || position.Length > 0)
            description += $" ({connector}{(connector.Length > 0 && position.Length > 0 ? "; " : string.Empty)}{position})";
        return description;
    }

    private static string AppendRule(string description, CodingRule rule, string mode)
    {
        var parameters = rule.Parameters ?? [];
        switch (rule.Method)
        {
            case "MATCH":
            case "MATCH_REGEX":
                if (parameters.Count > 0 && parameters[0].Length > 0)
                {
                    if (mode == "SIMPLE")
                    {
                        if (rule.Method == "MATCH") description += System.Text.RegularExpressions.Regex.Replace(parameters[0], "[\\r\\n]", "\nODER\n");
                    }
                    else description += $"{RuleText.GetValueOrDefault(rule.Method, "Unbekannte Regel")} '{parameters[0].Replace("\n", "', '", StringComparison.Ordinal)}'";
                }
                else description += "FALSCHE PARAMETERZAHL/TYPFEHLER";
                break;
            case "NUMERIC_MATCH":
            case "NUMERIC_LESS_THAN":
            case "NUMERIC_MORE_THAN":
            case "NUMERIC_MAX":
            case "NUMERIC_MIN":
                if (parameters.Count == 1)
                {
                    var number = ValueTransforms.GetValueAsNumber(parameters[0]);
                    description += number is null ? "VERGLEICHSWERT NICHT NUMERISCH" : $"{RuleText[rule.Method]} '{ValueTransforms.NumberToString(number.Value)}'";
                }
                else description += "FALSCHE PARAMETERZAHL";
                break;
            case "NUMERIC_RANGE":
            case "NUMERIC_FULL_RANGE":
                if (parameters.Count == 2)
                {
                    var lower = ValueTransforms.GetValueAsNumber(parameters[0]);
                    var upper = ValueTransforms.GetValueAsNumber(parameters[1]);
                    if (lower is null || upper is null) description += "VERGLEICHSWERT NICHT NUMERISCH";
                    else if (lower >= upper) description += "VERGLEICHSWERTE UNGÜLTIG";
                    else if (rule.Method == "NUMERIC_RANGE") description += $"{RuleText["NUMERIC_MORE_THAN"]} '{ValueTransforms.NumberToString(lower.Value)}' und {RuleText["NUMERIC_MAX"]} '{ValueTransforms.NumberToString(upper.Value)}'";
                    else description += $"{RuleText["NUMERIC_MIN"]} '{ValueTransforms.NumberToString(lower.Value)}' und {RuleText["NUMERIC_MAX"]} '{ValueTransforms.NumberToString(upper.Value)}'";
                }
                break;
            case "IS_EMPTY":
            case "IS_NULL":
            case "IS_TRUE":
            case "IS_FALSE":
                description += RuleText[rule.Method];
                break;
            default:
                description += $"{(description.Length > 0 ? "; " : string.Empty)}Problem: unbekannte Regel '{rule.Method}'";
                break;
        }
        if (rule.Fragment is >= 0) description += $" - F{ValueTransforms.NumberToString(rule.Fragment.Value + 1)}";
        return description;
    }

    /// <summary>Formats variable metadata as display-ready lines.</summary>
    public static List<string> VarInfoAsText(VariableInfo info)
    {
        var type = TypeText.GetValueOrDefault(info.Type, $"unbekannt \"{info.Type}\"");
        var format = info.Format.Length > 0 ? $"; Format: {FormatText.GetValueOrDefault(info.Format, $"unbekannt \"{info.Format}\"")}" : string.Empty;
        var result = new List<string> { $"Datentyp: {type}{format}{(info.Multiple ? "; Liste/mehrfach" : string.Empty)}{(info.Nullable ? "; \"null\"-Wert möglich" : string.Empty)}" };
        if (info.Values.Count > 0)
        {
            var values = info.Values.Select(item =>
            {
                var value = item.Value switch { double number => ValueTransforms.NumberToString(number), bool flag => flag ? "Ja/Wahr" : "Nein/Falsch", _ => item.Value.ToString() ?? string.Empty };
                return $"\"{value}{(item.Label.Length > 0 ? $" - {item.Label}" : string.Empty)}\"";
            });
            result.Add($"Mögliche Werte: {string.Join("; ", values)}");
        }
        if (info.ValuePositionLabels.Count > 0) result.Add($"Bezeichnungen der Werte-Positionen in der Liste: {string.Join("; ", info.ValuePositionLabels)}");
        if (info.ValuesComplete == true) result.Add("Es sind keine anderen als die gelisteten Werte möglich (geschlossenes Format).");
        if (!string.IsNullOrEmpty(info.Page)) result.Add($"Variable ist auf Seite \"{info.Page}\" verortet");
        return result;
    }

    private static string CodeId(object id) => id switch
    {
        double number => ValueTransforms.NumberToString(number),
        null => "null",
        _ => id.ToString() ?? "null"
    };
}

/// <summary>Formats a complete coding scheme.</summary>
public static class CodingSchemeTextFactory
{
    /// <summary>Formats every variable coding in SIMPLE or EXTENDED mode.</summary>
    public static List<CodingAsText> AsText(IReadOnlyList<VariableCodingData> codings, string mode = "EXTENDED") =>
        codings.Select(coding => new CodingAsText
        {
            Id = coding.Alias ?? coding.Id,
            Label = coding.Label ?? string.Empty,
            Source = ToTextFactory.SourceAsText(
                coding.Alias ?? coding.Id,
                coding.SourceType,
                (coding.DeriveSources ?? []).Select(source => codings.FirstOrDefault(item => item.Alias == source)?.Alias ?? source).ToList(),
                coding.SourceParameters),
            Processing = ToTextFactory.ProcessingAsText(coding.Processing ?? [], coding.Fragmenting),
            HasManualInstruction = !string.IsNullOrEmpty(coding.ManualInstruction),
            Codes = (coding.Codes ?? []).Select(code => ToTextFactory.CodeAsText(code, mode)).ToList()
        }).ToList();
}

/// <summary>Stores the first valid variable definition for each trimmed identifier.</summary>
public sealed class VariableList
{
    /// <summary>Gets the normalized, unique variables.</summary>
    public List<VariableInfo> Variables { get; }

    /// <summary>Creates a normalized variable list.</summary>
    public VariableList(IEnumerable<VariableInfo>? variables)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        Variables = [];
        foreach (var variable in variables ?? [])
        {
            var id = variable.Id.Trim();
            if (id.Length == 0 || !seen.Add(id)) continue;
            var copy = IqbJson.Clone(variable);
            copy.Id = id;
            Variables.Add(copy);
        }
    }
}
