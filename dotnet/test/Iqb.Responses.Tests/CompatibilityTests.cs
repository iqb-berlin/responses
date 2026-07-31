using System.Text.Json;
using System.Text.RegularExpressions;
using Xunit;

namespace Iqb.Responses.Tests;

public sealed class CompatibilityTests
{
    [Theory]
    [InlineData(null, 0d)]
    [InlineData("", 0d)]
    [InlineData(" 1 234,5 ", 1234.5d)]
    [InlineData(true, 1d)]
    [InlineData(false, 0d)]
    [InlineData("not numeric", null)]
    public void Number_conversion_matches_reference(object? input, double? expected) =>
        Assert.Equal(expected, ValueTransforms.GetValueAsNumber(input));

    [Fact]
    public void Numeric_and_string_runtime_types_are_supported()
    {
        Assert.Equal(2d, ValueTransforms.GetValueAsNumber(2f));
        Assert.Equal(2d, ValueTransforms.GetValueAsNumber(2));
        Assert.Equal(2d, ValueTransforms.GetValueAsNumber(2L));
        Assert.Null(ValueTransforms.GetValueAsNumber(new object()));
        Assert.Null(ValueTransforms.ParseFloatPrefix(null));
        Assert.Equal(12.5d, ValueTransforms.ParseFloatPrefix(" 12.5suffix"));
        Assert.Null(ValueTransforms.ParseFloatPrefix("suffix"));
        Assert.Equal("2", ValueTransforms.GetValueAsString(2f));
        Assert.Equal("2", ValueTransforms.GetValueAsString(2));
        Assert.Equal("2", ValueTransforms.GetValueAsString(2L));
        Assert.Equal("9223372036854776000", ValueTransforms.GetValueAsString(long.MaxValue));
        Assert.Equal("true", ValueTransforms.GetValueAsString(true));
        Assert.Null(ValueTransforms.GetValueAsString(new object()));
        Assert.Equal("abc", ValueTransforms.GetValueAsString(" A B C ", ["REMOVE_ALL_SPACES", "TO_LOWER_CASE"]));
        Assert.Equal("a b", ValueTransforms.GetValueAsString("  a   b ", ["REMOVE_DISPENSABLE_SPACES"]));
    }

    [Theory]
    [InlineData(1e21, "1e+21")]
    [InlineData(1e20, "100000000000000000000")]
    [InlineData(1e-6, "0.000001")]
    [InlineData(1e-7, "1e-7")]
    [InlineData(1_000_000_000_000_000_100d, "1000000000000000100")]
    [InlineData(-0d, "0")]
    [InlineData(double.NaN, "NaN")]
    [InlineData(double.PositiveInfinity, "Infinity")]
    [InlineData(double.NegativeInfinity, "-Infinity")]
    public void Number_formatting_matches_ECMAScript(double value, string expected) =>
        Assert.Equal(expected, ValueTransforms.NumberToString(value));

    [Theory]
    [InlineData("İ", "i\u0307")]
    [InlineData("ΟΣ", "ος")]
    [InlineData("ΟΣΑ", "οσα")]
    [InlineData("AΣ\u0301", "aς\u0301")]
    public void Lowercasing_matches_ECMAScript(string value, string expected) =>
        Assert.Equal(expected, ValueTransforms.GetValueAsString(value, ["TO_LOWER_CASE"]));

    [Fact]
    public void Portable_regex_analysis_rejects_runtime_specific_patterns()
    {
        Assert.Equal(PortableRegexStatus.Portable, PortableRegex.Analyze("^[A-Za-z0-9 _.,-]*$"));
        Assert.Equal(PortableRegexStatus.Invalid, PortableRegex.Analyze("["));
        Assert.Equal(PortableRegexStatus.Unsupported, PortableRegex.Analyze("\\p{L}+"));
        Assert.Equal(PortableRegexStatus.Unsupported, PortableRegex.Analyze("(?=a)"));
        Assert.Equal(PortableRegexStatus.Unsupported, PortableRegex.Analyze("é"));
    }

    [Fact]
    public void String_transforms_cover_fragments_sorting_and_empty_values()
    {
        Assert.Equal("ab", ValueTransforms.TransformString(" A B ", ["IGNORE_ALL_SPACES", "IGNORE_CASE"]));
        Assert.Equal("a b", ValueTransforms.TransformString("  A   B ", ["IGNORE_DISPENSABLE_SPACES", "IGNORE_CASE"]));
        var fragments = Assert.IsType<List<object?>>(ValueTransforms.TransformString("A12", [], new Regex("([A-Z])(\\d+)", RegexOptions.None, TimeSpan.FromMilliseconds(500))));
        Assert.Equal(["A", "12"], fragments);
        Assert.Empty(Assert.IsType<List<object?>>(ValueTransforms.TransformString("none", [], new Regex("(\\d+)", RegexOptions.None, TimeSpan.FromMilliseconds(500)))));
        var sorted = Assert.IsType<List<object?>>(ValueTransforms.TransformValue(new List<object?> { "b", "a" }, string.Empty, true));
        Assert.Equal(["a", "b"], sorted);
        Assert.True(ValueTransforms.IsEmptyValue(new List<object?>()));
        Assert.True(ValueTransforms.IsArray(sorted));
        Assert.Equal(2, ValueTransforms.AsArray(sorted).Count);
    }

    [Theory]
    [InlineData("1 == 1", true)]
    [InlineData("1 != 2", true)]
    [InlineData("1 <= 2", true)]
    [InlineData("2 >= 1", true)]
    [InlineData("1 < 2", true)]
    [InlineData("2 > 1", true)]
    [InlineData("5 % 2", 1d)]
    [InlineData("+2", 2d)]
    [InlineData("(2 + .5) * 2", 5d)]
    [InlineData("1e2", 100d)]
    [InlineData("null == null", true)]
    [InlineData("true != false", true)]
    public void Solver_parser_supports_its_declared_grammar(string expression, object expected) =>
        Assert.Equal(expected, SolverExpression.Evaluate(expression));

    [Theory]
    [InlineData("garbage")]
    [InlineData("1 +")]
    [InlineData("1e")]
    [InlineData("true ? 1")]
    [InlineData("1 ? 2 : 3")]
    [InlineData("true + 1")]
    [InlineData("true false")]
    public void Solver_parser_rejects_invalid_input(string expression) =>
        Assert.Throws<FormatException>(() => SolverExpression.Evaluate(expression));

    [Fact]
    public void Solver_parser_enforces_limits()
    {
        Assert.Throws<FormatException>(() => SolverExpression.Evaluate(new string('1', 16_385)));
        Assert.Throws<FormatException>(() => SolverExpression.Evaluate(new string('(', 65) + "1" + new string(')', 65)));
    }

    [Fact]
    public void Json_writer_supports_scalar_union_runtime_types()
    {
        foreach (var value in new object[] { (byte)1, 2, 3L, 4f, 5d, 6m, "x", true })
        {
            var json = JsonSerializer.Serialize(new CodeData { Id = value }, IqbJson.Options);
            Assert.NotEmpty(json);
        }
        var custom = JsonSerializer.Serialize(new VariableValue { Value = DateTime.UnixEpoch, Label = string.Empty }, IqbJson.Options);
        Assert.Contains("1970", custom);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Response>("{\"id\":\"x\",\"status\":\"UNSET\",\"value\":{}}", IqbJson.Options));
    }

    [Fact]
    public void Derivation_handles_status_propagation_and_source_variants()
    {
        var manual = Coding("m", "MANUAL", "a", "b");
        Assert.Equal(ResponseStatus.PartlyDisplayed, CodingSchemeFactory.DeriveValue([], manual,
            [Response("a", ResponseStatus.Displayed), Response("b", ResponseStatus.NotReached)]).Status);
        Assert.Equal(ResponseStatus.CodingIncomplete, CodingSchemeFactory.DeriveValue([], manual,
            [Response("a", ResponseStatus.IntendedIncomplete), Response("b", ResponseStatus.IntendedIncomplete)]).Status);

        var copy = Coding("c", "COPY_VALUE", "a");
        Assert.Equal(ResponseStatus.DerivePending, CodingSchemeFactory.DeriveValue([], copy,
            [Response("a", ResponseStatus.DerivePending)]).Status);
        Assert.Null(CodingSchemeFactory.DeriveValue([], copy, [Response("a", ResponseStatus.ValueChanged, 0d)]).Value);

        var unknown = Coding("u", "UNKNOWN", "a");
        Assert.Equal(ResponseStatus.DeriveError, CodingSchemeFactory.DeriveValue([], unknown,
            [Response("a", ResponseStatus.CodingComplete)]).Status);

        var unique = Coding("q", "UNIQUE_VALUES", "a", "b");
        unique.SourceParameters!.Processing = ["TO_NUMBER"];
        var uniqueResult = CodingSchemeFactory.DeriveValue([], unique,
            [Response("a", ResponseStatus.CodingComplete, new List<object?> { "1", "2" }), Response("b", ResponseStatus.CodingComplete, new List<object?> { 1d, 3d })]);
        Assert.Equal(true, uniqueResult.Value);
    }

    [Theory]
    [InlineData("${a:4} + 1", null, ResponseStatus.NoCoding, 5d)]
    [InlineData("${a:INC} + 1", null, ResponseStatus.NoCoding, null)]
    [InlineData("${a:ERROR:3} + 1", "text", ResponseStatus.NoCoding, 4d)]
    [InlineData("${a:ERROR:INC} + 1", "text", ResponseStatus.NoCoding, null)]
    public void Solver_placeholder_policies_are_applied(string expression, object? value, string status, double? expected)
    {
        var sourceCoding = Coding("a", "BASE");
        var solver = Coding("d", "SOLVER", "a");
        solver.SourceParameters!.SolverExpression = expression;
        var result = CodingSchemeFactory.DeriveValue([sourceCoding, solver], solver, [Response("a", status, value)]);
        if (expected is not null) Assert.Equal(expected, result.Value);
        else Assert.Contains(result.Status, new[] { ResponseStatus.CodingIncomplete, ResponseStatus.DeriveError });
    }

    [Fact]
    public void Invalid_solver_tokens_and_fragments_fail_deterministically()
    {
        var source = Coding("a", "BASE");
        source.Fragmenting = "([A-Z])(\\d+)";
        foreach (var expression in new[] { "${a:}", "${a::INC}", "${a[bad]}", "${bad alias}", "${a:1:2:3}", "${missing} + 1" })
        {
            var solver = Coding("d", "SOLVER", "a");
            solver.SourceParameters!.SolverExpression = expression;
            Assert.Equal(ResponseStatus.DeriveError, CodingSchemeFactory.DeriveValue([source, solver], solver,
                [Response("a", ResponseStatus.NoCoding, "A12")]).Status);
        }
        var fragmentSolver = Coding("d", "SOLVER", "a");
        fragmentSolver.SourceParameters!.SolverExpression = "${a[1]} + 1";
        Assert.Equal(13d, CodingSchemeFactory.DeriveValue([source, fragmentSolver], fragmentSolver,
            [Response("a", ResponseStatus.NoCoding, "A12")]).Value);

        fragmentSolver.SourceParameters.SolverExpression = "${a[5]:9} + 1";
        Assert.Equal(10d, CodingSchemeFactory.DeriveValue([source, fragmentSolver], fragmentSolver,
            [Response("a", ResponseStatus.NoCoding, "A12")]).Value);
        source.Fragmenting = "[";
        fragmentSolver.SourceParameters.SolverExpression = "${a[0]} + 1";
        Assert.Equal(ResponseStatus.DeriveError, CodingSchemeFactory.DeriveValue([source, fragmentSolver], fragmentSolver,
            [Response("a", ResponseStatus.NoCoding, "A12")]).Status);
    }

    private static VariableCodingData Coding(string id, string sourceType, params string[] sources) => new()
    {
        Id = id,
        Alias = id,
        SourceType = sourceType,
        DeriveSources = [.. sources],
        SourceParameters = new VariableSourceParameters { Processing = [], SolverExpression = string.Empty },
        Processing = [],
        Codes = []
    };

    private static Response Response(string id, string status, object? value = null) => new() { Id = id, Status = status, Value = value };
}
