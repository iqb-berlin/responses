using System.Text.Json;
using System.Text.Json.Nodes;
using Xunit;

namespace Iqb.Responses.Tests;

public sealed class GoldenCodingTests
{
    [Fact]
    public void All_existing_coding_outcomes_match()
    {
        var root = FindRepositoryRoot();
        var fixtureRoot = Path.Combine(root, "test", "coding");
        var inputs = Directory.GetFiles(fixtureRoot, "*_input.json", SearchOption.AllDirectories);
        Assert.Equal(75, inputs.Length);

        foreach (var inputPath in inputs.Order(StringComparer.Ordinal))
        {
            var folder = Path.GetDirectoryName(inputPath)!;
            var id = Path.GetFileName(inputPath)[..^"_input.json".Length];
            var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
            var input = JsonSerializer.Deserialize<List<Response>>(File.ReadAllText(inputPath), IqbJson.Options)!;
            var actual = CodingSchemeFactory.Code(input, scheme.VariableCodings);

            var actualJson = JsonSerializer.SerializeToNode(actual, IqbJson.Options);
            var expectedJson = JsonNode.Parse(File.ReadAllText(Path.Combine(folder, $"{id}_outcome.json")));
            Assert.True(JsonNode.DeepEquals(expectedJson, actualJson),
                $"Coding result differs for {Path.GetRelativePath(root, inputPath)}.\nExpected: {expectedJson}\nActual: {actualJson}");
        }
    }

    [Fact]
    public void Coding_does_not_mutate_inputs()
    {
        var response = new Response { Id = "A", Status = ResponseStatus.ValueChanged, Value = "yes" };
        var coding = CodingFactory.CreateCodingVariable("A");
        coding.Codes =
        [
            new CodeData
            {
                Id = 1d,
                Score = 1,
                RuleSets = [new RuleSet { Rules = [new CodingRule { Method = "MATCH", Parameters = ["yes"] }] }]
            }
        ];
        var before = JsonSerializer.Serialize(response, IqbJson.Options);

        var result = CodingFactory.Code(response, coding);

        Assert.Equal(before, JsonSerializer.Serialize(response, IqbJson.Options));
        Assert.Equal(ResponseStatus.CodingComplete, result.Status);
        Assert.Equal(1d, result.Code);
    }

    [Fact]
    public void All_existing_text_outcomes_match()
    {
        var root = FindRepositoryRoot();
        var fixtureRoot = Path.Combine(root, "test", "coding");
        var outcomes = Directory.GetFiles(fixtureRoot, "coding-scheme.asText.json", SearchOption.AllDirectories);
        Assert.Equal(38, outcomes.Length);

        foreach (var expectedPath in outcomes.Order(StringComparer.Ordinal))
        {
            var folder = Path.GetDirectoryName(expectedPath)!;
            var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
            var actual = CodingSchemeTextFactory.AsText(scheme.VariableCodings);
            var actualJson = JsonSerializer.SerializeToNode(actual, IqbJson.Options);
            var expectedJson = JsonNode.Parse(File.ReadAllText(expectedPath));
            Assert.True(JsonNode.DeepEquals(expectedJson, actualJson),
                $"Text result differs for {Path.GetRelativePath(root, expectedPath)}.\nExpected: {expectedJson}\nActual: {actualJson}");
        }
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "package.json")))
        {
            current = current.Parent;
        }
        return current?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
