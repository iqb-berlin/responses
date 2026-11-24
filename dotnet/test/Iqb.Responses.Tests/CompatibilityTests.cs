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
    [InlineData(9223372036854775808d, "9223372036854776000")]
    [InlineData(-9223372036854775808d, "-9223372036854776000")]
    [InlineData(1d / 3d, "0.3333333333333333")]
    [InlineData(0.1d + 0.2d, "0.30000000000000004")]
    [InlineData(5e-324, "5e-324")]
    [InlineData(double.MaxValue, "1.7976931348623157e+308")]
    // Exact powers of two have an asymmetric round-trip interval; .NET's "R" format gets these wrong.
    [InlineData(2.9802322387695312e-8, "2.9802322387695312e-8")]
    [InlineData(7.120236347223045e-307, "7.120236347223045e-307")]
    [InlineData(-0d, "0")]
    [InlineData(double.NaN, "NaN")]
    [InlineData(double.PositiveInfinity, "Infinity")]
    [InlineData(double.NegativeInfinity, "-Infinity")]
    public void Number_formatting_matches_ECMAScript(double value, string expected) =>
        Assert.Equal(expected, ValueTransforms.NumberToString(value));

    // The expected values are C# literals, which the compiler rounds correctly independent of the test runtime.
    [Theory]
    [InlineData("0.1", 0.1d)]
    [InlineData("-.5e-3", -0.0005d)]
    [InlineData("1e23", 1e23d)]
    [InlineData("9007199254740993", 9007199254740992d)]
    [InlineData("9007199254740995", 9007199254740996d)]
    [InlineData("0.30000000000000004", 0.30000000000000004d)]
    [InlineData("2.9802322387695312e-8", 2.9802322387695312e-8d)]
    [InlineData("7.120236347223045e-307", 7.120236347223045e-307d)]
    [InlineData("2.2250738585072011e-308", 2.2250738585072011e-308d)]
    [InlineData("2.4703282292062327e-324", 0d)]
    [InlineData("2.4703282292062328e-324", 5e-324d)]
    [InlineData("1.7976931348623158e308", double.MaxValue)]
    [InlineData("1.7976931348623159e308", double.PositiveInfinity)]
    [InlineData("1e400", double.PositiveInfinity)]
    [InlineData("1e-400", 0d)]
    [InlineData("00012.3400e002", 1234d)]
    public void Number_parsing_is_correctly_rounded(string text, double expected)
    {
        Assert.True(DoubleConversion.TryParse(text, out var actual));
        Assert.Equal(BitConverter.DoubleToInt64Bits(expected), BitConverter.DoubleToInt64Bits(actual));
    }

    [Theory]
    [InlineData("")]
    [InlineData(".")]
    [InlineData("-")]
    [InlineData("e5")]
    [InlineData("1e")]
    [InlineData("1e+")]
    [InlineData(" 1")]
    [InlineData("١")]
    public void Number_parsing_rejects_malformed_text(string text) =>
        Assert.False(DoubleConversion.TryParse(text, out _));

    [Fact]
    public void Number_formatting_and_parsing_round_trip_and_round_half_to_even()
    {
        var random = new Random(20261124);
        for (var i = 0; i < 20_000; i++)
        {
            var bits = (long)(random.NextDouble() * 0x7FEFFFFFFFFFFFFFL) + 1;
            var value = BitConverter.Int64BitsToDouble(bits);
            Assert.True(DoubleConversion.TryParse(ValueTransforms.ToShortestRoundTripString(value), out var parsed));
            Assert.Equal(bits, BitConverter.DoubleToInt64Bits(parsed));

            // The exact midpoint between value and its successor rounds to the one with the even mantissa.
            var biasedExponent = (int)((bits >> 52) & 0x7FF);
            var mantissa = biasedExponent == 0 ? bits & 0xFFFFFFFFFFFFFL : (bits & 0xFFFFFFFFFFFFFL) | (1L << 52);
            var exponent = (biasedExponent == 0 ? -1074 : biasedExponent - 1075) - 1;
            var twiceMidpoint = new System.Numerics.BigInteger(2 * mantissa + 1);
            var midpoint = exponent >= 0
                ? (twiceMidpoint << exponent).ToString()
                : (twiceMidpoint * System.Numerics.BigInteger.Pow(5, -exponent)) + "e" + exponent;
            Assert.True(DoubleConversion.TryParse(midpoint, out var rounded));
            Assert.Equal(bits % 2 == 0 ? bits : bits + 1, BitConverter.DoubleToInt64Bits(rounded));
        }
    }

    [Fact]
    public void Json_numbers_round_trip_exactly()
    {
        const string json = "{\"id\":\"x\",\"status\":\"VALUE_CHANGED\",\"value\":[2.9802322387695312e-8,0.30000000000000004,-0]," +
                            "\"score\":7.120236347223045e-307}";
        var response = JsonSerializer.Deserialize<Response>(json, IqbJson.Options)!;
        var values = Assert.IsType<List<object?>>(response.Value);
        Assert.Equal(2.9802322387695312e-8d, values[0]);
        Assert.Equal(0.30000000000000004d, values[1]);
        Assert.Equal(7.120236347223045e-307d, response.Score);

        var clone = IqbJson.Clone(response);
        var cloned = Assert.IsType<List<object?>>(clone.Value);
        Assert.Equal(BitConverter.DoubleToInt64Bits(2.9802322387695312e-8d), BitConverter.DoubleToInt64Bits((double)cloned[0]!));
        Assert.Equal(BitConverter.DoubleToInt64Bits(0.30000000000000004d), BitConverter.DoubleToInt64Bits((double)cloned[1]!));
        Assert.Equal(BitConverter.DoubleToInt64Bits(-0d), BitConverter.DoubleToInt64Bits((double)cloned[2]!));
        Assert.Equal(BitConverter.DoubleToInt64Bits(7.120236347223045e-307d), BitConverter.DoubleToInt64Bits(clone.Score!.Value));
    }

    [Theory]
    [InlineData(0d, "0")]
    [InlineData(-0d, "-0")]
    [InlineData(123.456d, "123.456")]
    [InlineData(-1.5d, "-1.5")]
    [InlineData(0.0001d, "0.0001")]
    [InlineData(0.00001d, "1E-05")]
    [InlineData(1e15d, "1000000000000000")]
    [InlineData(72057594037927936d, "72057594037927940")]
    [InlineData(1e17d, "1E+17")]
    [InlineData(1e21d, "1E+21")]
    [InlineData(0.30000000000000004d, "0.30000000000000004")]
    [InlineData(2.9802322387695312e-8d, "2.9802322387695312E-08")]
    [InlineData(7.120236347223045e-307d, "7.120236347223045E-307")]
    [InlineData(double.MaxValue, "1.7976931348623157E+308")]
    [InlineData(5e-324d, "5E-324")]
    public void Json_numbers_are_written_like_System_Text_Json_on_NET_10(double value, string expected)
    {
        Assert.Equal(expected, JsonSerializer.Serialize(value, IqbJson.Options));
        var response = new Response { Id = "x", Status = ResponseStatus.Unset, Value = new List<object?> { value }, Score = value };
        Assert.Equal("{\"id\":\"x\",\"status\":\"UNSET\",\"value\":[" + expected + "],\"score\":" + expected + "}",
            JsonSerializer.Serialize(response, IqbJson.Options));
    }

    [Fact]
    public void Json_numbers_keep_the_System_Text_Json_contract()
    {
        var overflow = JsonSerializer.Deserialize<Response>("{\"id\":\"x\",\"value\":[1e400,-1e400],\"score\":1e400}", IqbJson.Options)!;
        Assert.Equal([double.PositiveInfinity, double.NegativeInfinity], Assert.IsType<List<object?>>(overflow.Value));
        Assert.Equal(double.PositiveInfinity, overflow.Score);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Response>("{\"id\":\"x\",\"score\":\"1\"}", IqbJson.Options));
        Assert.Null(JsonSerializer.Deserialize<Response>("{\"id\":\"x\",\"score\":null}", IqbJson.Options)!.Score);
    }

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

    // Expected values are V8's Math.cbrt and Math.log2; .NET's Math.Cbrt and Math.Log2 differ in the last bit here.
    [Theory]
    [InlineData("cbrt(-486)", -7.86222418262669d)]
    [InlineData("cbrt(812)", 9.329363390985685d)]
    [InlineData("cbrt(3051.8446667361277)", 14.505102709418592d)]
    [InlineData("cbrt(-231)", -6.135792439661959d)]
    [InlineData("log2(2.723193961532422)", 1.4452997430777266d)]
    [InlineData("log2(0.8452806602443008)", -0.2424976530024595d)]
    [InlineData("log2(0.08035121792012412)", -3.637536298120694d)]
    [InlineData("log2(0.3622858030080264)", -1.4647998232701231d)]
    public void Solver_cbrt_and_log2_match_V8_exactly(string expression, double expected) =>
        Assert.Equal(BitConverter.DoubleToInt64Bits(expected),
            BitConverter.DoubleToInt64Bits((double)SolverExpression.Evaluate(expression)!));

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
