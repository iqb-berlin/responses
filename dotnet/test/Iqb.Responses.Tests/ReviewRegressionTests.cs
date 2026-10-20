using System.Text.Json;
using Xunit;

namespace Iqb.Responses.Tests;

public sealed class ReviewRegressionTests
{
    public static TheoryData<object> NumericPositions => new()
    {
        (byte)0, (sbyte)0, (short)0, (ushort)0, 0, 0u, 0L, 0UL, 0f, 0d, 0m
    };

    [Theory]
    [MemberData(nameof(NumericPositions))]
    public void Numeric_array_positions_select_the_same_member_for_native_and_json_inputs(object position)
    {
        var coding = Coding(new CodingRule { Method = "MATCH", Parameters = ["b"] });
        var code = coding.Codes![0];
        var ruleSet = code.RuleSets![0];
        ruleSet.ValueArrayPos = position;
        var input = new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = new List<object?> { "a", "b" } };

        Assert.Empty(CodingSchemeFactory.Validate([new VariableInfo { Id = "v", Type = "STRING", Multiple = true }], [coding]));
        Assert.Equal(ResponseStatus.CodingIncomplete, CodingFactory.Code(input, coding).Status);
        ruleSet.ValueArrayPos = 1;
        Assert.Equal(1d, CodingFactory.Code(input, coding).Code);
        Assert.Contains("(A2)", ToTextFactory.CodeAsText(code).RuleSetDescriptions[0]);
    }

    [Fact]
    public void Validation_accepts_empty_alias_without_throwing()
    {
        var coding = Coding(new CodingRule { Method = "MATCH", Parameters = ["a"] });
        coding.Alias = string.Empty;
        Assert.Empty(CodingSchemeFactory.Validate([new VariableInfo { Id = "v", Type = "STRING" }], [coding]));
        Assert.Contains(CodingSchemeFactory.Validate([], [coding]), problem => problem.VariableId == "v");
        var response = new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = "a" };
        Assert.Equal("v", Assert.Single(CodingSchemeFactory.Code([response], [coding])).Id);
        Assert.Equal("v", Assert.Single(CodingSchemeTextFactory.AsText([coding])).Id);
        Assert.Equal(string.Empty, coding.Alias);
    }

    [Fact]
    public void Missing_multiple_stays_unknown_while_explicit_false_rejects_array_positions()
    {
        var info = JsonSerializer.Deserialize<VariableInfo>("{\"id\":\"v\",\"type\":\"NUMBER\"}", IqbJson.Options)!;
        var coding = Coding(new CodingRule { Method = "NUMERIC_MATCH", Parameters = ["1"] });
        coding.Codes![0].RuleSets![0].ValueArrayPos = 0d;
        Assert.Empty(CodingSchemeFactory.Validate([info], [coding]));
        Assert.DoesNotContain("multiple", JsonSerializer.Serialize(info, IqbJson.Options));
        info.Multiple = false;
        Assert.Contains(CodingSchemeFactory.Validate([info], [coding]), problem => problem.Type == "RULESET_VALUE_ARRAY_POS_INVALID");
        Assert.Contains("\"multiple\":false", JsonSerializer.Serialize(info, IqbJson.Options));
    }

    private static VariableCodingData Coding(CodingRule rule)
    {
        var coding = CodingFactory.CreateCodingVariable("v");
        coding.Codes = [new CodeData { Id = 1, Type = "FULL_CREDIT", Score = 1, RuleSets = [new RuleSet { Rules = [rule] }] }];
        return coding;
    }

    private static Response Code(object value, VariableCodingData coding) =>
        CodingFactory.Code(new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = value }, coding);
}
