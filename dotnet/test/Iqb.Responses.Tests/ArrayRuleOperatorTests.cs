using Xunit;

namespace Iqb.Responses.Tests;

public sealed class ArrayRuleOperatorTests
{
    [Theory]
    [InlineData("ANY", false, true)]
    [InlineData("ANY", true, false)]
    [InlineData("ANY_OPEN", true, true)]
    [InlineData(null, true, true)]
    public void Fragmented_markings_apply_OR_to_each_selected_range(string? position, bool includeTarget, bool matches)
    {
        var coding = CodingFactory.CreateCodingVariable("v");
        coding.Fragmenting = "^(\\d+)-(\\d+)-#";
        coding.Codes = [new CodeData
        {
            Id = 41d,
            RuleSets = [new RuleSet
            {
                ValueArrayPos = position,
                RuleOperatorAnd = false,
                Rules = [
                    new CodingRule { Method = "NUMERIC_MORE_THAN", Parameters = ["74"], Fragment = 0 },
                    new CodingRule { Method = "NUMERIC_LESS_THAN", Parameters = ["74"], Fragment = 1 }
                ]
            }]
        }];
        var values = new List<object?> { "69-70-#f9f871", "78-79-#f9f871" };
        if (includeTarget) values.Add("74-74-#f9f871");
        var result = CodingFactory.Code(new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = values }, coding);
        Assert.Equal(matches ? ResponseStatus.CodingComplete : ResponseStatus.CodingIncomplete, result.Status);
    }

    [Theory]
    [InlineData("ANY", false, true)]
    [InlineData("ANY_OPEN", false, true)]
    [InlineData("ANY", true, false)]
    [InlineData("ANY_OPEN", true, false)]
    [InlineData(null, false, true)]
    [InlineData(null, true, true)]
    public void Array_references_respect_OR_and_AND_without_changing_omitted_references(
        string? position, bool and, bool matches)
    {
        var coding = CodingFactory.CreateCodingVariable("v");
        coding.Codes = [new CodeData
        {
            Id = 41d,
            Type = "NO_CREDIT",
            Score = 0,
            RuleSets = [new RuleSet
            {
                ValueArrayPos = position,
                RuleOperatorAnd = and,
                Rules = [
                    new CodingRule { Method = "MATCH", Parameters = ["A"] },
                    new CodingRule { Method = "MATCH", Parameters = ["B"] }
                ]
            }]
        }];
        var response = new Response
        {
            Id = "v", Status = ResponseStatus.ValueChanged, Value = new List<object?> { "A", "B" }
        };

        var result = CodingFactory.Code(response, coding);
        Assert.Equal(matches ? ResponseStatus.CodingComplete : ResponseStatus.CodingIncomplete, result.Status);
        if (matches) Assert.Equal(41d, result.Code);
        Assert.Equal(position, coding.Codes[0].RuleSets![0].ValueArrayPos);
    }
}
