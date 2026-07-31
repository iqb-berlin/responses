using System.Text.Json;
using System.Text.Json.Nodes;
using Iqb.Responses;
using Iqb.Responses.Differential;

if (args.Length == 1 && args[0] == "--jsonl")
{
    await RunJsonLines();
    return;
}

var fixtureOutput = args.Length switch
{
    1 => args[0],
    2 when args[0] == "--fixtures" => args[1],
    _ => throw new ArgumentException("Expected --jsonl or an output-file argument.")
};

RunFixtures(fixtureOutput);
return;

async Task RunJsonLines()
{
    var ready = new DifferentialEnvelope
    {
        ProtocolVersion = 1,
        Kind = "ready",
        Capabilities = CaseExecutor.Capabilities
    };
    await Console.Out.WriteLineAsync(JsonSerializer.Serialize(ready, IqbJson.Options));
    await Console.Out.FlushAsync();

    string? line;
    while ((line = await Console.In.ReadLineAsync()) is not null)
    {
        DifferentialEnvelope response;
        if (line.Length > 2 * 1024 * 1024)
        {
            response = DifferentialEnvelope.InvalidRequest(null, "Request exceeds the 2 MiB limit.");
        }
        else
        {
            try
            {
                var request = JsonSerializer.Deserialize<DifferentialRequest>(line, IqbJson.Options);
                response = request is null
                    ? DifferentialEnvelope.InvalidRequest(null, "Request is empty.")
                    : CaseExecutor.Execute(request);
            }
            catch (JsonException error)
            {
                response = DifferentialEnvelope.InvalidRequest(null, error.Message);
            }
            catch (Exception error)
            {
                response = DifferentialEnvelope.Unexpected(null, error);
            }
        }
        await Console.Out.WriteLineAsync(JsonSerializer.Serialize(response, IqbJson.Options));
        await Console.Out.FlushAsync();
    }
}

void RunFixtures(string outputPath)
{
    var repositoryRoot = FindRepositoryRoot();
    var fixtureRoot = Path.Combine(repositoryRoot, "test", "coding");
    var results = new JsonObject();

    foreach (var inputPath in Directory.GetFiles(fixtureRoot, "*_input.json", SearchOption.AllDirectories)
                 .Order(StringComparer.Ordinal))
    {
        var folder = Path.GetDirectoryName(inputPath)!;
        var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
        var input = JsonSerializer.Deserialize<List<Response>>(File.ReadAllText(inputPath), IqbJson.Options)!;
        results[RelativePath(repositoryRoot, inputPath)] = JsonSerializer.SerializeToNode(
            CodingSchemeFactory.Code(input, scheme.VariableCodings),
            IqbJson.Options);
    }

    foreach (var textPath in Directory.GetFiles(fixtureRoot, "coding-scheme.asText.json", SearchOption.AllDirectories)
                 .Order(StringComparer.Ordinal))
    {
        var folder = Path.GetDirectoryName(textPath)!;
        var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
        results[RelativePath(repositoryRoot, textPath)] = JsonSerializer.SerializeToNode(
            CodingSchemeTextFactory.AsText(scheme.VariableCodings),
            IqbJson.Options);
    }

    File.WriteAllText(outputPath, results.ToJsonString(IqbJson.Options));
}

static string RelativePath(string root, string path) => Path.GetRelativePath(root, path).Replace('\\', '/');

static string FindRepositoryRoot()
{
    var current = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "package.json")))
    {
        current = current.Parent;
    }
    return current?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
}
