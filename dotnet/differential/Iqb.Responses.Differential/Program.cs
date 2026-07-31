using System.Text.Json;
using System.Text.Json.Nodes;
using Iqb.Responses;

if (args.Length != 1)
{
    throw new ArgumentException("Expected one output-file argument.");
}

var repositoryRoot = FindRepositoryRoot();
var fixtureRoot = Path.Combine(repositoryRoot, "test", "coding");
var results = new JsonObject();

foreach (var inputPath in Directory.GetFiles(fixtureRoot, "*_input.json", SearchOption.AllDirectories)
             .Order(StringComparer.Ordinal))
{
    var folder = Path.GetDirectoryName(inputPath)!;
    var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
    var input = JsonSerializer.Deserialize<List<Response>>(File.ReadAllText(inputPath), IqbJson.Options)!;
    results[RelativePath(inputPath)] = JsonSerializer.SerializeToNode(
        CodingSchemeFactory.Code(input, scheme.VariableCodings),
        IqbJson.Options);
}

foreach (var textPath in Directory.GetFiles(fixtureRoot, "coding-scheme.asText.json", SearchOption.AllDirectories)
             .Order(StringComparer.Ordinal))
{
    var folder = Path.GetDirectoryName(textPath)!;
    var scheme = CodingScheme.Parse(File.ReadAllText(Path.Combine(folder, "coding-scheme.json")));
    results[RelativePath(textPath)] = JsonSerializer.SerializeToNode(
        CodingSchemeTextFactory.AsText(scheme.VariableCodings),
        IqbJson.Options);
}

File.WriteAllText(args[0], results.ToJsonString(IqbJson.Options));
return;

string RelativePath(string path) => Path.GetRelativePath(repositoryRoot, path).Replace('\\', '/');

string FindRepositoryRoot()
{
    var current = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "package.json")))
    {
        current = current.Parent;
    }
    return current?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
}
