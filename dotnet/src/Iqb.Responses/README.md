# Iqb.Responses

Native .NET 10 implementation of the IQB response coding engine. The package
accepts the same camel-case JSON models as `@iqb/responses` and has no Node.js
runtime dependency.

## Installation

```bash
dotnet add package Iqb.Responses --version 5.2.2-preview.1
```

## Code a complete response set

```csharp
using System.Text.Json;
using Iqb.Responses;

var scheme = CodingScheme.Parse(File.ReadAllText("coding-scheme.json"));
var responses = JsonSerializer.Deserialize<List<Response>>(
    File.ReadAllText("responses.json"),
    IqbJson.Options) ?? [];

var result = CodingSchemeFactory.Code(
    responses,
    scheme.VariableCodings,
    error => Console.Error.WriteLine(error));
```

## Code one response

```csharp
var coding = CodingFactory.CreateCodingVariable("A1");
var result = CodingFactory.Code(
    new Response
    {
        Id = "A1",
        Status = ResponseStatus.ValueChanged,
        Value = "answer"
    },
    coding);
```

`CodingFactory` and `CodingSchemeFactory` never mutate caller-owned inputs.
The package includes coding, derivation, validation, dependency inspection,
base-variable resolution and the SIMPLE/EXTENDED text renderers.

## SOLVER compatibility

The native parser supports numbers, `null`, `true`/`false`, parentheses,
arithmetic, comparisons, ternary expressions and the documented IQB
placeholder, fragment and policy syntax. Unsupported `mathjs` functions or
non-finite results produce `DERIVE_ERROR`.
