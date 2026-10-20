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

    [Theory]
    [InlineData("^.$", "\r", false)]
    [InlineData("^.$", "\n", false)]
    [InlineData("^.$", "\u2028", false)]
    [InlineData("^.$", "\u2029", false)]
    [InlineData("^.$", "a", true)]
    [InlineData("^a$", "a\n", false)]
    [InlineData("^\\s$", "\u00a0", true)]
    [InlineData("^[\\s]$", "\ufeff", true)]
    [InlineData("^\\s$", "\u0085", false)]
    [InlineData("^[\\S]$", "\u0085", true)]
    [InlineData("^[^\\S]$", "\u00a0", true)]
    [InlineData("^\\w$", "İ", false)]
    [InlineData("^\\W$", "İ", true)]
    [InlineData("^\\D$", "١", true)]
    [InlineData("\\b.\\b", "İ", false)]
    [InlineData("\\b.\\b", "a", true)]
    [InlineData("\\B.\\B", "İ", true)]
    [InlineData("^\\a\\e\\A\\Z\\G\\z$", "aeAZGz", true)]
    [InlineData("^[\\B]$", "B", true)]
    [InlineData("^\\.$", ".", true)]
    [InlineData("^\\$$", "$", true)]
    [InlineData("^\\f\\n\\r\\t\\v$", "\f\n\r\t\v", true)]
    [InlineData("^[\\b]$", "\b", true)]
    [InlineData("^(?:a|b)+$", "abba", true)]
    [InlineData("^(?:a|b)+$", "abc", false)]
    public void Portable_patterns_keep_JavaScript_line_and_whitespace_semantics(string pattern, string value, bool matches)
    {
        var coding = Coding(new CodingRule { Method = "MATCH_REGEX", Parameters = [pattern] });
        Assert.Empty(CodingSchemeFactory.Validate([new VariableInfo { Id = "v", Type = "STRING" }], [coding]));
        Assert.Equal(matches ? ResponseStatus.CodingComplete : ResponseStatus.CodingIncomplete, Code(value, coding).Status);
    }

    [Theory]
    [InlineData("^k$", "K", true)]
    [InlineData("^k$", "K", false)]
    [InlineData("^s$", "ſ", false)]
    [InlineData("^[A-Z]$", "İ", false)]
    [InlineData("^[a-z]$", "A", true)]
    [InlineData("^[^a]$", "A", false)]
    [InlineData("^[Z-a]$", "z", true)]
    [InlineData("^[A-Za-z0-9 _.,-]*$", "?", false)]
    [InlineData("^[a-]$", "-", true)]
    [InlineData("^[-a]$", "-", true)]
    [InlineData("^[-a]$", "?", false)]
    [InlineData("^\\a$", "A", true)]
    [InlineData("^[\\a]$", "A", true)]
    [InlineData("^[0-9]$", "5", true)]
    public void Ignore_case_preserves_non_unicode_JavaScript_canonicalization(string pattern, string value, bool matches)
    {
        var coding = Coding(new CodingRule { Method = "MATCH_REGEX", Parameters = [pattern] });
        coding.Processing = ["IGNORE_CASE"];
        Assert.Equal(matches ? ResponseStatus.CodingComplete : ResponseStatus.CodingIncomplete, Code(value, coding).Status);
    }

    [Fact]
    public void Captured_empty_strings_remain_distinct_from_absent_groups()
    {
        var coding = Coding(new CodingRule { Method = "IS_EMPTY", Fragment = 0 });
        coding.Fragmenting = "(a*)(b)";
        Assert.Equal(ResponseStatus.CodingComplete, Code("b", coding).Status);
    }

    [Fact]
    public void An_absent_solver_fragment_uses_the_empty_default()
    {
        var source = CodingFactory.CreateCodingVariable("v");
        source.Fragmenting = "(a)?(b)";
        var coding = CodingFactory.CreateBaseCodingVariable("d", "SOLVER");
        coding.DeriveSources = ["v"];
        coding.SourceParameters!.SolverExpression = "${v[0]:7:9}";
        var result = CodingSchemeFactory.DeriveValue([source, coding], coding,
            [new Response { Id = "v", Status = ResponseStatus.NoCoding, Value = "b" }]);
        Assert.Equal(ResponseStatus.ValueChanged, result.Status);
        Assert.Equal(7d, result.Value);
    }

    [Theory]
    [InlineData("(?=a)(a)", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?<=a)(b)", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("[", "FRAGMENT_REGEX_INVALID")]
    [InlineData("[a[b]", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?<first", "FRAGMENT_REGEX_INVALID")]
    [InlineData("(?<>a)", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?<1first>a)", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?<first-name>a)", "FRAGMENT_REGEX_UNSUPPORTED")]
    [InlineData("(?<same>a)(?<same>b)", "FRAGMENT_REGEX_INVALID")]
    public void Fragment_validation_rejects_unsupported_and_malformed_patterns(string pattern, string problem)
    {
        var coding = Coding(new CodingRule { Method = "MATCH", Parameters = ["a"], Fragment = 0 });
        coding.Fragmenting = pattern;
        Assert.Contains(CodingSchemeFactory.Validate([new VariableInfo { Id = "v", Type = "STRING" }], [coding]),
            item => item.Type == problem && item.Breaking);
        Exception? reported = null;
        var response = new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = "a" };
        Assert.Equal(ResponseStatus.CodingError, CodingFactory.Code(response, coding, error => reported = error).Status);
        Assert.NotNull(reported);
    }

    [Theory]
    [InlineData("IS_EMPTY", null, "CODING_INCOMPLETE")]
    [InlineData("IS_NULL", null, "CODING_INCOMPLETE")]
    [InlineData("MATCH_REGEX", "^undefined$", "CODING_COMPLETE")]
    [InlineData("NUMERIC_MATCH", "0", "CODING_ERROR")]
    public void Optional_capture_preserves_an_absent_fragment(string method, string? parameter, string expectedStatus)
    {
        var coding = Coding(new CodingRule { Method = method, Fragment = 0, Parameters = parameter is null ? [] : [parameter] });
        coding.Fragmenting = "(a)?(b)";
        Assert.Equal(expectedStatus, Code("b", coding).Status);
    }

    [Theory]
    [InlineData("(?<first>a)(b)", "ab", "a", true)]
    [InlineData("(a)(?<last>b)", "ab", "a", true)]
    [InlineData("(\\d+)", "١٢", "١٢", false)]
    [InlineData("(\\d+)", "12", "12", true)]
    [InlineData("(?<_>a)(b)", "ab", "a", true)]
    [InlineData("(?<$>a)(b)", "ab", "a", true)]
    [InlineData("(?<first_1$>a)(b)", "ab", "a", true)]
    public void Fragmentation_preserves_JavaScript_group_order_and_character_classes(string pattern, string value, string expected, bool matches)
    {
        var coding = Coding(new CodingRule { Method = "MATCH", Parameters = [expected], Fragment = 0 });
        coding.Fragmenting = pattern;
        Assert.Empty(CodingSchemeFactory.Validate([new VariableInfo { Id = "v", Type = "STRING" }], [coding]));
        Assert.Equal(matches ? ResponseStatus.CodingComplete : ResponseStatus.CodingIncomplete, Code(value, coding).Status);
    }

    [Theory]
    [InlineData("true ? 1 : nthRoot(4,0)", 1d)]
    [InlineData("false ? gcd(1.5,2) : 2", 2d)]
    [InlineData("true ? (false ? nthRoot(4,0) : 3) : gcd(1.5,2)", 3d)]
    [InlineData("false ? -null ^ null + null * null : 4", 4d)]
    [InlineData("true ? 1 : missing(2)", 1d)]
    [InlineData("1 < 2 < 3 ? 1 : 0", 1d)]
    [InlineData("3 > 2 >= 2 ? 1 : 0", 1d)]
    [InlineData("1 < 2 > 3 ? 1 : 0", 0d)]
    [InlineData("1 == 1 == 1 ? 1 : 0", 1d)]
    [InlineData("1 < 2 == 2 ? 1 : 0", 1d)]
    [InlineData("3 < 2 < nthRoot(4,0) ? 1 : 0", 0d)]
    [InlineData("3 < 2 < missing(1) ? 1 : 0", 0d)]
    [InlineData("false ? missing : 5", 5d)]
    [InlineData("false ? +null : 6", 6d)]
    [InlineData("true ? 7 : (false ? gcd(1.5,2) : nthRoot(4,0))", 7d)]
    [InlineData("false ? (true ? nthRoot(4,0) : gcd(1.5,2)) : 8", 8d)]
    public void Solver_executes_only_selected_branches_and_compares_adjacent_operands(string expression, double expected)
    {
        var coding = CodingFactory.CreateBaseCodingVariable("d", "SOLVER");
        coding.SourceParameters!.SolverExpression = expression;
        var result = CodingSchemeFactory.DeriveValue([coding], coding, []);
        Assert.Equal(ResponseStatus.ValueChanged, result.Status);
        Assert.Equal(expected, result.Value);
    }

    [Fact]
    public void Unselected_solver_branches_still_require_valid_syntax()
    {
        Assert.Throws<FormatException>(() => SolverExpression.Evaluate("true ? 1 : (2 + )"));
        Assert.Throws<FormatException>(() => SolverExpression.Evaluate("false ? (2 + ) : 1"));
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

    [Theory]
    [InlineData("1\u00852", null)]
    [InlineData("\ufeff1", 1d)]
    [InlineData("1\u00a02", 12d)]
    public void Number_normalization_uses_ECMAScript_whitespace(string value, double? expected) =>
        Assert.Equal(expected, CodingFactory.GetValueAsNumber(value));

    [Theory]
    [InlineData(" A\u0085B ", "A\u0085B")]
    [InlineData("\ufeffA\u00a0B\ufeff", "AB")]
    public void String_normalization_uses_the_same_whitespace_set(string value, string expected) =>
        Assert.Equal(expected, CodingFactory.GetValueAsString(value, ["REMOVE_ALL_SPACES"]));

    public static TheoryData<char> JavaScriptWhitespace => new()
    {
        '\u0009', '\u000a', '\u000b', '\u000c', '\u000d', '\u0020', '\u00a0', '\u1680',
        '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007',
        '\u2008', '\u2009', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff'
    };

    [Theory]
    [MemberData(nameof(JavaScriptWhitespace))]
    public void Every_JavaScript_whitespace_character_is_trimmed_and_collapsed(char whitespace)
    {
        var value = $"{whitespace}1{whitespace}{whitespace}2{whitespace}";
        Assert.Equal("1 2", CodingFactory.GetValueAsString(value, ["REMOVE_DISPENSABLE_SPACES"]));
        Assert.Equal(12d, CodingFactory.GetValueAsNumber(value));
    }

    [Theory]
    [InlineData('\u0008')]
    [InlineData('\u000e')]
    [InlineData('\u0085')]
    [InlineData('\u167f')]
    [InlineData('\u1681')]
    [InlineData('\u1fff')]
    [InlineData('\u200b')]
    [InlineData('\u2027')]
    [InlineData('\u202a')]
    [InlineData('\u202e')]
    [InlineData('\u2030')]
    [InlineData('\u205e')]
    [InlineData('\u2060')]
    [InlineData('\u2fff')]
    [InlineData('\u3001')]
    [InlineData('\ufefe')]
    [InlineData('\uff00')]
    public void Characters_outside_JavaScript_whitespace_are_preserved(char character)
    {
        var value = $"{character}1{character}";
        Assert.Equal(value, CodingFactory.GetValueAsString(value, ["REMOVE_DISPENSABLE_SPACES"]));
        Assert.Null(CodingFactory.GetValueAsNumber(value));
    }

    [Theory]
    [InlineData("IS_EMPTY", null, "CODING_INCOMPLETE")]
    [InlineData("MATCH_REGEX", "^undefined$", "CODING_COMPLETE")]
    [InlineData("NUMERIC_MATCH", "0", "CODING_ERROR")]
    public void Missing_fragments_in_array_members_keep_undefined_semantics(string method, string? parameter, string expectedStatus)
    {
        var coding = Coding(new CodingRule { Method = method, Fragment = 2, Parameters = parameter is null ? [] : [parameter] });
        coding.Fragmenting = "(.)";
        Assert.Equal(expectedStatus, Code(new List<object?> { "a", "b" }, coding).Status);
    }

    [Theory]
    [InlineData(null, 7d)]
    [InlineData(2d, 2d)]
    [InlineData("", 7d)]
    [InlineData("\ufeff", 7d)]
    [InlineData("\u0085", 9d)]
    public void Solver_distinguishes_empty_numeric_and_non_numeric_source_values(object? value, double expected)
    {
        var source = CodingFactory.CreateCodingVariable("v");
        var coding = CodingFactory.CreateBaseCodingVariable("d", "SOLVER");
        coding.DeriveSources = ["v"];
        coding.SourceParameters!.SolverExpression = "${v:7:9}";
        var result = CodingSchemeFactory.DeriveValue([source, coding], coding,
            [new Response { Id = "v", Status = ResponseStatus.NoCoding, Value = value }]);
        Assert.Equal(ResponseStatus.ValueChanged, result.Status);
        Assert.Equal(expected, result.Value);
    }

    [Theory]
    [InlineData("\ufeff", 7d)]
    [InlineData("\u0085", 9d)]
    [InlineData("2", 2d)]
    public void Solver_applies_empty_and_non_numeric_policies_to_captured_text(string value, double expected)
    {
        var source = CodingFactory.CreateCodingVariable("v");
        source.Fragmenting = "([\\s\\S]*)";
        var coding = CodingFactory.CreateBaseCodingVariable("d", "SOLVER");
        coding.DeriveSources = ["v"];
        coding.SourceParameters!.SolverExpression = "${v[0]:7:9}";
        var result = CodingSchemeFactory.DeriveValue([source, coding], coding,
            [new Response { Id = "v", Status = ResponseStatus.NoCoding, Value = value }]);
        Assert.Equal(ResponseStatus.ValueChanged, result.Status);
        Assert.Equal(expected, result.Value);
    }

    [Theory]
    [InlineData(null, "Datentyp: String/Text")]
    [InlineData(false, "Datentyp: String/Text")]
    [InlineData(true, "Datentyp: String/Text; Liste/mehrfach")]
    public void Variable_info_renders_a_list_only_when_multiple_is_explicitly_true(bool? multiple, string expected) =>
        Assert.Equal(expected, ToTextFactory.VarInfoAsText(new VariableInfo { Id = "v", Type = "STRING", Multiple = multiple })[0]);

    private static VariableCodingData Coding(CodingRule rule)
    {
        var coding = CodingFactory.CreateCodingVariable("v");
        coding.Codes = [new CodeData { Id = 1, Type = "FULL_CREDIT", Score = 1, RuleSets = [new RuleSet { Rules = [rule] }] }];
        return coding;
    }

    private static Response Code(object value, VariableCodingData coding) =>
        CodingFactory.Code(new Response { Id = "v", Status = ResponseStatus.ValueChanged, Value = value }, coding);
}
