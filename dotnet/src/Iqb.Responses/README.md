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
placeholder, fragment and policy syntax. It also supports the scalar constants
`pi`/`PI`, `e`/`E`, `tau`, `phi`, `Infinity`, `NaN` and these functions:

- `abs`, `sqrt`, `cbrt`, `ceil`, `floor`, `fix`, `round`, `sign`
- `min`, `max`, `pow`, `mod`, `square`, `cube`, `nthRoot`
- `exp`, `log`, `log10`, `log2`
- `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `hypot`

Matrices, units, assignments, user-defined functions, complex values and other
unrestricted `mathjs` features are not supported. Unsupported syntax and
non-finite final results produce `DERIVE_ERROR`. Transcendental results can
differ from V8 by one final IEEE-754 bit because the runtimes use different
math implementations; the differential boundary manifest tracks this case.

## Number, casing and regular-expression compatibility

Number-to-string conversion uses JavaScript thresholds and exponent notation,
and Unicode lowercasing follows ECMAScript default case conversion. Rule
`MATCH_REGEX` accepts the shared portable ASCII subset: character classes,
groups, alternation and ordinary quantifiers are supported. Lookaround,
backreferences, Unicode property classes, Unicode/hex escapes and non-ASCII
pattern text are rejected by validation and produce a controlled coding error
if an unvalidated scheme reaches the rule engine.
