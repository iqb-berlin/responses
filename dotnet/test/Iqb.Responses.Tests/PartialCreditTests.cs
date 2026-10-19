using System.Text.Json;
using Xunit;

namespace Iqb.Responses.Tests;

public sealed class PartialCreditTests
{
    private static VariableCodingData Coding(string method, List<string>? processing = null) => new()
    {
        Id = "derived", SourceType = method, DeriveSources = ["a", "b"],
        SourceParameters = new VariableSourceParameters
        {
            Processing = processing ?? ["TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL", "TAKE_EMPTY_AS_ZERO_IF_PARTIAL"]
        }
    };

    [Theory]
    [InlineData("SUM_SCORE")]
    [InlineData("SUM_CODE")]
    [InlineData("CONCAT_CODE")]
    public void Replacements_are_local_and_require_a_coded_answer(string method)
    {
        var completed = new Response { Id = "a", Status = ResponseStatus.CodingComplete, Value = 1d, Code = 2d, Score = 3d };
        var displayed = new Response { Id = "b", Status = ResponseStatus.Displayed, Value = false };
        var before = JsonSerializer.Serialize(new[] { completed, displayed }, IqbJson.Options);
        var result = CodingSchemeFactory.DeriveValue([], Coding(method), [completed, displayed]);
        Assert.Equal(ResponseStatus.ValueChanged, result.Status);
        Assert.Equal(method == "CONCAT_CODE" ? (object)"2_x" : method == "SUM_CODE" ? 2d : 3d, result.Value);
        Assert.Equal(before, JsonSerializer.Serialize(new[] { completed, displayed }, IqbJson.Options));

        Assert.Equal(ResponseStatus.Invalid,
            CodingSchemeFactory.DeriveValue([], Coding(method, []), [completed, displayed]).Status);
        completed.Status = ResponseStatus.Displayed;
        Assert.Equal(ResponseStatus.Displayed,
            CodingSchemeFactory.DeriveValue([], Coding(method), [completed, displayed]).Status);
        displayed.Status = ResponseStatus.Invalid;
        displayed.Value = string.Empty;
        Assert.Equal(ResponseStatus.Invalid,
            CodingSchemeFactory.DeriveValue([], Coding(method), [completed, displayed]).Status);
    }

    [Theory]
    [InlineData("SUM_SCORE")]
    [InlineData("SUM_CODE")]
    [InlineData("CONCAT_CODE")]
    public void Empty_invalid_sources_are_distinct_from_nonempty_invalid_and_pending(string method)
    {
        var completed = new Response { Id = "a", Status = ResponseStatus.CodingComplete, Value = 1d, Code = 0d, Score = 0d };
        var partial = new Response { Id = "b", Status = ResponseStatus.Invalid };
        foreach (var value in new object?[] { null, string.Empty, new List<object?>() })
        {
            partial.Value = value;
            Assert.Equal(ResponseStatus.ValueChanged,
                CodingSchemeFactory.DeriveValue([], Coding(method), [completed, partial]).Status);
        }
        foreach (var value in new object[] { false, 0d, "wrong", " " })
        {
            partial.Value = value;
            Assert.Equal(ResponseStatus.Invalid,
                CodingSchemeFactory.DeriveValue([], Coding(method), [completed, partial]).Status);
        }
        partial.Value = string.Empty;
        completed.Status = ResponseStatus.CodingIncomplete;
        Assert.Equal(ResponseStatus.DerivePending,
            CodingSchemeFactory.DeriveValue([], Coding(method), [completed, partial]).Status);
    }

    [Fact]
    public void Concat_placeholder_is_distinct_from_zero_and_participates_in_sorting()
    {
        var coding = Coding("CONCAT_CODE", ["TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL", "SORT"]);
        var completed = new Response { Id = "b", Status = ResponseStatus.CodingComplete, Value = false, Code = 0d, Score = 0d };
        var partial = new Response { Id = "a", Status = ResponseStatus.Displayed };
        Assert.Equal("0_x", CodingSchemeFactory.DeriveValue([], coding, [completed, partial]).Value);
        partial.Status = ResponseStatus.CodingComplete;
        partial.Code = 0d;
        Assert.Equal("0_0", CodingSchemeFactory.DeriveValue([], coding, [completed, partial]).Value);
        Assert.Contains("angezeigte Quellantworten als x",
            ToTextFactory.SourceAsText("derived", "CONCAT_CODE", ["a", "b"], coding.SourceParameters));
    }
}
