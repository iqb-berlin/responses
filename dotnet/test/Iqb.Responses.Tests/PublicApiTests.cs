using System.Globalization;
using System.Text.Json;
using Xunit;

namespace Iqb.Responses.Tests;

public sealed class PublicApiTests
{
    [Fact]
    public void Validation_reports_source_and_identity_problems()
    {
        var baseInfo = Info("base", "string");
        var baseCoding = Coding("base", "BASE");
        baseCoding.Codes = null;
        var missingBase = Coding("missing", "BASE");
        var copied = Coding("copy", "COPY_VALUE", "derived", "base");
        var derived = Coding("derived", "SUM_CODE", "base");
        var missingSource = Coding("missing-source", "SUM_CODE", "absent", "base");
        var noValue = Coding("base", "BASE_NO_VALUE");

        var problems = CodingSchemeFactory.Validate(
            [baseInfo, Info("base", "string")],
            [baseCoding, missingBase, copied, derived, missingSource, noValue]);

        Assert.Contains(problems, item => item.Type == "INVALID_SOURCE" && item.Breaking);
        Assert.Contains(problems, item => item.Type == "SOURCE_MISSING" && item.Breaking);
        Assert.Contains(problems, item => item.Type == "MORE_THAN_ONE_SOURCE" && !item.Breaking);
        Assert.Contains(problems, item => item.Type == "VALUE_COPY_NOT_FROM_BASE" && !item.Breaking);
        Assert.Contains(problems, item => item.Type == "ONLY_ONE_SOURCE" && !item.Breaking);
        Assert.Contains(problems, item => item.Type == "VACANT" && !item.Breaking);
    }

    [Fact]
    public void Validation_reports_rule_problems()
    {
        var info = Info("x", "attachment", multiple: false);
        var coding = Coding("x", "BASE");
        coding.Codes =
        [
            new CodeData
            {
                Id = 7d,
                RuleSets =
                [
                    new RuleSet
                    {
                        ValueArrayPos = "WRONG",
                        Rules =
                        [
                            new CodingRule { Method = "NUMERIC_MIN", Parameters = ["not-a-number"], Fragment = 0 },
                            new CodingRule { Method = "NUMERIC_RANGE", Parameters = ["4", "2"] },
                            new CodingRule { Method = "MATCH_REGEX", Parameters = ["["] },
                            new CodingRule { Method = "IS_TRUE", Parameters = ["extra"] }
                        ]
                    },
                    new RuleSet { ValueArrayPos = -1d, Rules = [new CodingRule { Method = "IS_EMPTY" }] }
                ]
            }
        ];

        var problems = CodingSchemeFactory.Validate([info], [coding]);

        Assert.Contains(problems, item => item.Type == "RULESET_VALUE_ARRAY_POS_INVALID");
        Assert.Contains(problems, item => item.Type == "RULE_PARAMETER_COUNT_MISMATCH");
        Assert.Contains(problems, item => item.Type == "RULE_PARAMETER_INVALID");
        Assert.Contains(problems, item => item.Type == "RULE_NUMERIC_RANGE_INVALID");
        Assert.Contains(problems, item => item.Type == "RULE_REGEX_INVALID");
        Assert.All(problems.Where(item => item.Type.StartsWith("RULE", StringComparison.Ordinal)), item => Assert.Equal("7", item.Code));
    }

    [Fact]
    public void Validation_handles_fractional_fragments_unknown_rules_and_uncoded_copy_shapes()
    {
        const string json = """
            {
              "id": "x",
              "sourceType": "BASE",
              "fragmenting": "(.*)",
              "codes": [{
                "id": 1,
                "ruleSets": [{
                  "rules": [{ "method": "MATCH", "parameters": ["x"], "fragment": 0.5 }]
                }]
              }]
            }
            """;
        var fractionalFragment = JsonSerializer.Deserialize<VariableCodingData>(json, IqbJson.Options)!;
        var unknownRule = Coding("unknown", "BASE");
        unknownRule.Codes =
        [
            new CodeData
            {
                Id = 2d,
                RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "FUTURE_RULE", Parameters = ["value"] }] }]
            }
        ];
        var copiedAttachment = Coding("copy", "COPY_VALUE", "attachment");
        copiedAttachment.Codes =
        [
            new CodeData
            {
                Id = 3d,
                RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "NUMERIC_MIN", Parameters = ["1"] }] }]
            }
        ];

        var problems = CodingSchemeFactory.Validate(
            [Info("x", "string"), Info("unknown", "string"), Info("attachment", "attachment")],
            [fractionalFragment, unknownRule, copiedAttachment]);

        Assert.Contains(problems, item => item.VariableId == "x" && item.Type == "RULE_PARAMETER_INVALID");
        Assert.Contains(problems, item => item.VariableId == "unknown" && item.Type == "RULE_PARAMETER_COUNT_MISMATCH");
        Assert.Contains(problems, item => item.VariableId == "copy" && item.Type == "RULE_PARAMETER_INVALID");
    }

    [Fact]
    public void Validation_accepts_supported_array_positions_and_detects_bounds()
    {
        var info = Info("x", "number", multiple: true);
        info.ValuePositionLabels = ["first", "second"];
        var coding = Coding("x", "BASE");
        coding.Fragmenting = "(\\d+)";
        coding.Codes =
        [
            new CodeData
            {
                Id = "INVALID",
                RuleSets =
                [
                    new RuleSet { ValueArrayPos = 3d, Rules = [new CodingRule { Method = "NUMERIC_MATCH", Parameters = ["2"], Fragment = -1 }] },
                    new RuleSet { ValueArrayPos = "SUM", Rules = [new CodingRule { Method = "NUMERIC_MIN", Parameters = ["1"] }] },
                    new RuleSet { ValueArrayPos = "ANY", Rules = [new CodingRule { Method = "IS_TRUE" }] }
                ]
            }
        ];

        var problems = CodingSchemeFactory.Validate([info], [coding]);

        Assert.Contains(problems, item => item.Type == "RULESET_VALUE_ARRAY_POS_INVALID");
        Assert.DoesNotContain(problems, item => item.Type == "RULE_PARAMETER_COUNT_MISMATCH");
    }

    [Fact]
    public void Utility_and_alias_APIs_are_callable()
    {
        var info = Info(" value ", "boolean");
        info.Nullable = true;
        info.Format = "image";
        info.Values = [new VariableValue { Value = true, Label = "yes" }];
        info.ValuePositionLabels = ["one"];
        info.ValuesComplete = true;
        info.Page = "P1";
        var list = new VariableList([info, Info("value", "string"), Info("", "string")]);

        Assert.Single(list.Variables);
        Assert.Equal("value", list.Variables[0].Id);
        var text = CodingFormatter.VarInfoAsText(info);
        Assert.Contains(text, line => line.Contains("Ja/Nein", StringComparison.Ordinal));
        Assert.Contains(text, line => line.Contains("Mögliche Werte", StringComparison.Ordinal));
        Assert.Contains(text, line => line.Contains("geschlossenes Format", StringComparison.Ordinal));
        Assert.Equal(text, CodingTextRenderer.VarInfoAsText(info));

        var coding = CodingFactory.CreateCodingVariable("value");
        coding.SourceParameters!.Processing = ["TAKE_EMPTY_AS_VALID"];
        Assert.Contains("leerer Wert", ToTextFactory.SourceAsText("value", "BASE", [], coding.SourceParameters));
        Assert.Contains("unbekannter Wert", ToTextFactory.ProcessingAsText(["UNKNOWN"]));
        Assert.Equal("Unbekannte Quelle", ToTextFactory.SourceAsText("x", "UNKNOWN", []));
        Assert.Empty(CodingSchemeTextRenderer.AsText([]));

        var response = new Response { Id = "value", Status = ResponseStatus.ValueChanged, Value = "x" };
        Assert.Equal(ResponseStatus.NoCoding, CodingEngine.Code(response, coding).Status);
        Assert.Equal(ResponseStatus.NoCoding, ResponseCoder.Code(response, coding).Status);
        Assert.Equal("1", CodingFormatter.CodeAsText(new CodeData { Id = 1d }).Id);
        Assert.Equal("1", CodingTextRenderer.CodeAsText(new CodeData { Id = 1d }).Id);
    }

    [Fact]
    public void Alias_types_forward_the_complete_factory_APIs()
    {
        var info = Info("x", "string");
        var coding = CodingEngine.CreateBaseCodingVariable("x", "BASE");
        coding.Codes = [new CodeData { Id = 1d, RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "MATCH", Parameters = ["x"] }] }] }];
        var response = new Response { Id = "x", Status = ResponseStatus.ValueChanged, Value = "x" };

        Assert.Equal("x", CodingEngine.CreateCodingVariable("x").Id);
        Assert.Equal(1d, CodingEngine.GetValueAsNumber("1"));
        Assert.Equal("1", CodingEngine.GetValueAsString(1d));
        Assert.True(CodingEngine.IsEmptyValue(""));
        Assert.Equal(ResponseStatus.CodingComplete, CodingEngine.Code(response, coding).Status);

        Assert.Equal("x", ResponseCoder.CreateBaseCodingVariable("x", "BASE").Id);
        Assert.Equal("x", ResponseCoder.CreateCodingVariable("x").Id);
        Assert.Equal(1d, ResponseCoder.GetValueAsNumber("1"));
        Assert.Equal("1", ResponseCoder.GetValueAsString(1d));
        Assert.True(ResponseCoder.IsEmptyValue(""));
        Assert.Equal(ResponseStatus.CodingComplete, ResponseCoder.Code(response, coding).Status);

        Assert.Single(CodingSchemeEngine.GetVariableDependencyTree([coding]));
        Assert.Equal("derived", CodingSchemeEngine.DeriveValue([], Coding("derived", "CONCAT_CODE", "x"), []).Id);
        Assert.Single(CodingSchemeEngine.Code([response], [coding]));
        Assert.Empty(CodingSchemeEngine.Validate([info], [coding]));
        Assert.Equal(["x"], CodingSchemeEngine.GetBaseVarsList(["x"], [coding]));

        Assert.Single(SchemeCoder.GetVariableDependencyTree([coding]));
        Assert.Equal("derived", SchemeCoder.DeriveValue([], Coding("derived", "CONCAT_CODE", "x"), []).Id);
        Assert.Single(SchemeCoder.Code([response], [coding]));
        Assert.Empty(SchemeCoder.Validate([info], [coding]));
        Assert.Equal(["x"], SchemeCoder.GetBaseVarsList(["x"], [coding]));

        Assert.NotEmpty(CodingFormatter.SourceAsText("x", "BASE", []));
        Assert.NotEmpty(CodingFormatter.ProcessingAsText(["IGNORE_CASE"]));
        Assert.Equal("1", CodingFormatter.CodeAsText(new CodeData { Id = 1d }).Id);
        Assert.NotEmpty(CodingFormatter.VarInfoAsText(info));
        Assert.NotEmpty(CodingTextRenderer.SourceAsText("x", "BASE", []));
        Assert.NotEmpty(CodingTextRenderer.ProcessingAsText(["IGNORE_CASE"]));
        Assert.Equal("1", CodingTextRenderer.CodeAsText(new CodeData { Id = 1d }).Id);
        Assert.NotEmpty(CodingTextRenderer.VarInfoAsText(info));
    }

    [Fact]
    public void Base_variable_dependencies_are_resolved_recursively_and_uniquely()
    {
        var a = Coding("a", "BASE");
        a.Alias = "A";
        var b = Coding("b", "BASE");
        b.Alias = "B";
        var middle = Coding("middle", "SUM_CODE", "a", "b");
        middle.Alias = "M";
        var target = Coding("target", "SUM_SCORE", "middle", "a");
        target.Alias = "T";

        Assert.Equal(["A", "B"], CodingSchemeFactory.GetBaseVarsList(["T", "missing"], [a, b, middle, target]));
    }

    [Fact]
    public void Coding_reports_invalid_fragment_regex_and_handles_symbolic_codes()
    {
        var response = new Response { Id = "x", Status = ResponseStatus.ValueChanged, Value = "x" };
        var coding = Coding("x", "BASE");
        coding.Fragmenting = "[";
        coding.Codes = [new CodeData { Id = 1d, RuleSets = [] }];
        Exception? reported = null;
        Assert.Equal(ResponseStatus.CodingError, CodingFactory.Code(response, coding, error => reported = error).Status);
        Assert.NotNull(reported);
        Assert.Equal(ResponseStatus.NoCoding, CodingFactory.Code(response, null).Status);

        coding.Fragmenting = string.Empty;
        coding.Codes = [new CodeData { Id = ResponseStatus.Invalid, RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "MATCH", Parameters = ["x"] }] }] }];
        Assert.Equal(ResponseStatus.Invalid, CodingFactory.Code(response, coding).Status);
        coding.Codes = [new CodeData { Id = ResponseStatus.IntendedIncomplete, Type = "INTENDED_INCOMPLETE", Score = 2 }];
        Assert.Equal(ResponseStatus.IntendedIncomplete, CodingFactory.Code(response, coding).Status);
    }

    [Fact]
    public void Intended_incomplete_residual_preserves_the_reference_string_code()
    {
        var coding = Coding("x", "BASE");
        coding.Codes =
        [
            new CodeData
            {
                Id = ResponseStatus.IntendedIncomplete,
                Type = ResponseStatus.IntendedIncomplete,
                RuleSets = []
            }
        ];
        var result = CodingFactory.Code(
            new Response { Id = "x", Status = ResponseStatus.ValueChanged, Value = "unmatched" },
            coding);

        Assert.Equal(ResponseStatus.IntendedIncomplete, result.Status);
        Assert.Equal(ResponseStatus.IntendedIncomplete, result.Code);
        var json = JsonSerializer.Serialize(result, IqbJson.Options);
        Assert.Equal(json, JsonSerializer.Serialize(JsonSerializer.Deserialize<Response>(json, IqbJson.Options), IqbJson.Options));
    }

    [Fact]
    public void Complete_coding_is_non_mutating_and_safe_for_parallel_calls()
    {
        var coding = Coding("x", "BASE");
        coding.Codes = [new CodeData { Id = 1d, RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "MATCH", Parameters = ["x"] }] }] }];
        var responses = new List<Response> { new() { Id = "x", Status = ResponseStatus.ValueChanged, Value = "x" } };
        var before = JsonSerializer.Serialize(responses, IqbJson.Options);

        Parallel.For(0, 100, _ =>
        {
            var result = CodingSchemeFactory.Code(responses, [coding]);
            Assert.Equal(ResponseStatus.CodingComplete, result.Single().Status);
        });

        Assert.Equal(before, JsonSerializer.Serialize(responses, IqbJson.Options));
    }

    [Fact]
    public void Simple_text_mode_joins_rules_and_describes_invalid_rules()
    {
        var code = new CodeData
        {
            Id = 1d,
            RuleSets =
            [
                new RuleSet
                {
                    RuleOperatorAnd = true,
                    Rules =
                    [
                        new CodingRule { Method = "MATCH", Parameters = ["a\r\nb"] },
                        new CodingRule { Method = "NUMERIC_MIN", Parameters = [] },
                        new CodingRule { Method = "UNKNOWN" }
                    ]
                }
            ]
        };
        var text = ToTextFactory.CodeAsText(code, "SIMPLE").RuleSetDescriptions.Single();
        Assert.Contains("UND", text);
        Assert.Contains("FALSCHE PARAMETERZAHL", text);
        Assert.Contains("unbekannte Regel", text);
        Assert.Equal("null", ToTextFactory.CodeAsText(new CodeData { Id = null! }).Id);
    }

    [Fact]
    public void Json_union_values_round_trip_and_culture_does_not_change_numbers()
    {
        var response = new Response { Id = "x", Status = ResponseStatus.ValueChanged, Value = new List<object?> { null, "1", 2d, true } };
        var json = JsonSerializer.Serialize(response, IqbJson.Options);
        var copy = JsonSerializer.Deserialize<Response>(json, IqbJson.Options)!;
        Assert.Equal(json, JsonSerializer.Serialize(copy, IqbJson.Options));

        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("de-DE");
            Assert.Equal(1.5d, CodingFactory.GetValueAsNumber("1,5"));
            Assert.Equal("1.5", CodingFactory.GetValueAsString(1.5d));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void Dependency_cycles_are_reported_through_callback()
    {
        var first = Coding("a", "SUM_CODE", "b", "b2");
        var second = Coding("b", "SUM_CODE", "a", "a2");
        Exception? reported = null;

        var result = CodingSchemeEngine.Code([], [first, second], error => reported = error);

        Assert.NotNull(reported);
        Assert.All(result, response => Assert.Equal(ResponseStatus.DeriveError, response.Status));
        Assert.Equal(
            JsonSerializer.Serialize(result, IqbJson.Options),
            JsonSerializer.Serialize(SchemeCoder.Code([], [first, second]), IqbJson.Options));
    }

    [Theory]
    [InlineData("2 + 3 * 4", 14d)]
    [InlineData("2 ^ 3", 8d)]
    [InlineData("-2 + 5", 3d)]
    [InlineData("2 > 1 ? 7 : 9", 7d)]
    [InlineData("false ? 7 : null", null)]
    public void Solver_supports_documented_expressions(string expression, double? expected)
    {
        var coding = Coding("d", "SOLVER", "a", "b");
        coding.SourceParameters!.SolverExpression = expression;
        var result = CodingSchemeFactory.DeriveValue([], coding, []);
        if (expected is null)
        {
            Assert.Null(result.Value);
        }
        else
        {
            Assert.Equal(expected, result.Value);
        }
    }

    [Fact]
    public void Invalid_fractional_fragment_follows_the_JavaScript_runtime()
    {
        var coding = Coding("x", "BASE");
        coding.Fragmenting = "(.)";
        coding.Codes =
        [
            new CodeData
            {
                Id = 7d,
                Type = "UNSET",
                RuleSets =
                [
                    new RuleSet
                    {
                        Rules =
                        [
                            new CodingRule
                            {
                                Method = "MATCH_REGEX",
                                Parameters = ["^[A-Za-z]*$"],
                                Fragment = 0.5d
                            }
                        ]
                    }
                ]
            }
        ];

        var result = CodingFactory.Code(new Response { Id = "x", Status = "VALUE_CHANGED", Value = "0" }, coding);

        Assert.Equal(7d, result.Code);
        Assert.Equal(ResponseStatus.CodingComplete, result.Status);
    }

    private static VariableCodingData Coding(string id, string sourceType, params string[] sources) => new()
    {
        Id = id,
        Alias = id,
        SourceType = sourceType,
        SourceParameters = new VariableSourceParameters { Processing = [], SolverExpression = string.Empty },
        DeriveSources = [.. sources],
        Processing = [],
        Codes = []
    };

    private static VariableInfo Info(string id, string type, bool multiple = false) => new()
    {
        Id = id,
        Type = type,
        Format = string.Empty,
        Multiple = multiple,
        Values = [],
        ValuePositionLabels = []
    };
}
