[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/%40iqb%2Fresponses)](https://www.npmjs.com/package/@iqb/responses)

This package contains of type definitions for processing assessment data. Additionally, you find TypeScript interfaces and classes, so these data structures can be used in a coherent way.

- [Iqb specifications](https://iqb-specifications.github.io/)
- [Ausführliche Darstellungen zum Kodieren](https://iqb-berlin.github.io/tba-info/coding/response-status.html)

## Partial credit with empty sources (5.4)

For `SUM_SCORE`, `SUM_CODE` and `CONCAT_CODE`, set either or both of these
options on the **derived** variable in `sourceParameters.processing`:

- `TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL`: use a neutral contribution for sources
  with status `DISPLAYED`, including checkbox defaults such as `false`.
- `TAKE_EMPTY_AS_ZERO_IF_PARTIAL`: use a neutral contribution for `INVALID`
  sources whose value is exactly `null`, `""` or `[]`. `false`, `0` and nonempty
  invalid answers are not empty.

Both options are disabled by default. With at least one `CODING_COMPLETE`
source, enabled partials contribute score/code `0` to sums or placeholder `x`
to concatenation. `0_x` therefore remains distinct from `0_0`. A derived text
value containing `x` can be coded with ordinary text rules and numeric code IDs.
`SORT` also sorts placeholders. Pending answers are never replaced: a pending
answer plus otherwise coded or allowed partial sources yields `DERIVE_PENDING`,
including when no answer has completed coding yet. Existing error precedence
still applies.

Without a completed or pending answer, aggregation remains unchanged: all
`DISPLAYED` stays `DISPLAYED`; all empty `INVALID`, or a mix of `DISPLAYED` and
empty `INVALID`, stays `INVALID`. There is no automatic zero score or `x_x`.
Only the contribution to this derivation changes. Source status, value, code
and score, sibling derivations, base-variable normalization (including
`TAKE_EMPTY_AS_VALID`) and SOLVER policies remain unchanged.

The options require `@iqbspecs/coding-scheme` 3.5.0 or later. The native .NET
engine implements the same replacements and source descriptions.

Before publishing the new specification, package-consumer verification can use
its locally built tarball:

```bash
IQB_CODING_SCHEME_TARBALL=/absolute/path/to/iqbspecs-coding-scheme-3.5.0.tgz npm run test:package
```

The release lockfile contains the integrity of the prepared specification
tarball. Publish that exact artifact first, or refresh the lockfile after its
release before a registry-based `npm ci`.

## Installation

```bash
npm i @iqb/responses
```

### .NET 10

The repository also contains the preview of the native .NET package
`Iqb.Responses`. It uses the same camel-case JSON contracts and does not require
Node.js at runtime. Its supported feature set is narrower than the stable
JavaScript package; the preview does not establish full behavioral parity.

```bash
dotnet add package Iqb.Responses --version 5.2.2-preview.1
```

```csharp
using System.Text.Json;
using Iqb.Responses;

var scheme = CodingScheme.Parse(File.ReadAllText("coding-scheme.json"));
var responses = JsonSerializer.Deserialize<List<Response>>(
    File.ReadAllText("responses.json"),
    IqbJson.Options) ?? [];

var coded = CodingSchemeFactory.Code(responses, scheme.VariableCodings);
```

The native SOLVER supports numeric literals, `null`, booleans, parentheses,
arithmetic and comparison operators, ternary expressions, IQB placeholders,
fragment access, and the documented default/`ERROR`/`INC` policies. Its scalar
`mathjs` subset also includes:

- Constants: `pi`/`PI`, `e`/`E`, `tau`, `phi`, `Infinity`, and `NaN`.
- Numeric functions: `abs`, `sqrt`, `cbrt`, `ceil`, `floor`, `fix`, `round`,
  `sign`, `min`, `max`, `gcd`, `pow`, `mod`, `square`, `cube`, and `nthRoot`.
- Exponential and logarithmic functions: `exp`, `log`, `log10`, and `log2`.
- Trigonometric functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`,
  `atan2`, and `hypot`.

Matrices, units, assignments, user-defined functions and other unrestricted
`mathjs` syntax are not supported. Unknown syntax, complex values and
non-finite final results produce `DERIVE_ERROR`. Transcendental functions can
differ from V8 by one final IEEE-754 bit because .NET and JavaScript use
different platform math implementations. Direct, finite SOLVER results that
use `exp`, logarithmic, trigonometric or `hypot` functions may differ by at
most one IEEE-754 ULP in differential tests. Status, error and downstream
coding results are still compared exactly. `gcd` requires at least two finite
integer arguments and is always compared exactly.

Number-to-string conversion and Unicode lowercasing follow JavaScript semantics
in both runtimes. JavaScript `MATCH_REGEX` keeps the native `RegExp` behavior of
the stable 5.4.0 package, including non-ASCII patterns, lookaround,
backreferences, and Unicode/hex escapes. It uses no flags or `i` with
`IGNORE_CASE`; it does not enable the Unicode `u` flag. A pattern such as
`\p{L}+` therefore keeps its existing non-Unicode JavaScript interpretation.

The .NET preview limits `MATCH_REGEX` to a portable ASCII subset: character
classes, groups, alternation and ordinary quantifiers. Unsupported constructs
produce the .NET-specific validation problem `RULE_REGEX_UNSUPPORTED`.
Bypassing validation produces `CODING_ERROR` and reports a
`NotSupportedException` through the error callback. Malformed patterns within
the supported subset still produce `RULE_REGEX_INVALID` during validation.

### Differential parity testing

`npm run test:differential` compares all checked-in golden vectors and 20,000
reproducible generated cases in the shared feature set with the native .NET
preview. A failure is automatically minimized and written to
`artifacts/differential/`. Replay it with
`npm run test:differential:generated -- --case <minimized.request.json>`.

Before a stable .NET release, `npm run test:differential:stress` runs 100,000 cases.
Locale, Unicode, regex-dialect and SOLVER-language boundaries are tracked
separately in `test/differential/boundaries/manifest.json`. Large-number
formatting and Unicode lowercasing are blocking parity cases. Regex features
outside the preview's subset have exact expectations for each runtime; these
checks enforce JavaScript compatibility and explicit .NET rejection without
claiming full parity. Unknown boundary expectations fail the test run.

### Release policy

JavaScript and .NET share `master`, with independent package versions and release
decisions. The stable npm behavior remains the compatibility reference. Passing
the shared-feature differential tests does not promote the .NET preview to a
stable package. See [Release checks](./RELEASING.md) for the package-specific gates.

## Documentation

- **[Quick Reference Guide](./QUICK_REFERENCE.md)** - Common operations, examples, and troubleshooting
- **[Coding Process Documentation](./CODING_PROCESS.md)** - Detailed architecture and logic flow with diagrams
- [Iqb specifications](https://iqb-specifications.github.io/)
- [Ausführliche Darstellungen zum Kodieren](https://iqb-berlin.github.io/tba-info/coding/response-status.html)

## Public API (Exports)

The package exports (among others):

- **Coding responses**
  - `CodingFactory` (also exported as `CodingEngine` / `ResponseCoder`)
  - `CodingSchemeFactory` (also exported as `CodingSchemeEngine` / `SchemeCoder`)
- **Rendering / formatting**
  - `ToTextFactory` (also exported as `CodingTextRenderer` / `CodingFormatter`)
  - `CodingSchemeTextFactory` (also exported as `CodingSchemeTextRenderer`)
- **Utilities**
  - `VariableList`

## Concepts

### Core data model

- **`Response`** (`@iqbspecs/response`)
  - Identified by `id` (string)
  - Holds `value` (single value or array) and a `status`
  - May have `code`, `score` and (optionally) `subform`
- **`VariableCodingData`** (`@iqbspecs/coding-scheme`)
  - Defines how one variable is obtained and/or coded
  - Important fields you will see often:
    - `id` and `alias`
    - `sourceType` + `deriveSources` (for derived variables)
    - `codes` + `processing` + `fragmenting` (for rule-based coding)

### `id` vs `alias`

In many consuming applications variables are addressed by **alias**, while internally the coding scheme also has an **id**.

- When you call `CodingSchemeFactory.code()`, responses are temporarily mapped from alias to id, processed, and mapped back.
- When building tooling around this package, treat `alias` as the “external name” and `id` as the “stable internal key”.

### Coding pipeline (high level)

`CodingSchemeFactory.code()` processes a list of responses together with a coding scheme and runs the following steps:

1. **Group by subform**
   - Responses with a `subform` are coded per subform group.
2. **Normalize statuses**
   - Some statuses are normalized to `VALUE_CHANGED` depending on variable/source parameters.
3. **Resolve derived/base conflicts**
   - Base responses that are shadowed by derived variables can be removed before deriving/coding.
4. **Plan derivations**
   - A dependency graph is computed so derived variables are processed in the right order.
5. **Ensure responses exist**
   - If a variable is present in the coding scheme but missing from input responses, placeholder responses can be created.
6. **Derive values** (if configured)
   - Derived variables are computed from their source responses.
7. **Code values**
   - Rule-based coding is applied to responses with `status === VALUE_CHANGED`.

### Status and error handling

- Status strings are defined by the `@iqbspecs/response` / `@iqbspecs/coding-scheme` specs and are used throughout this package.
- Typical flow for base variables is:
  - `VALUE_CHANGED` -> `CODING_COMPLETE` / `CODING_INCOMPLETE` / `NO_CODING`
- For derived variables:
  - derivation may set `DERIVE_ERROR` (and value is cleared)
- If internal processing throws unexpectedly:
  - `CODING_ERROR` / `DERIVE_ERROR` is set and the optional `onError` callback is called.

### Debugging & internal extension points

If you are working on the internals:

- **Rule evaluation** is implemented in `src/rule-engine/*`.
- **Derivations** are implemented in `src/derive/*`.
- **Alias mapping** lives in `src/mapping/alias-mapper.ts`.
- **Subform grouping** lives in `src/subform/*`.

## Quick start: code all responses of a unit

Use `CodingSchemeFactory.code()` to apply derivations (if configured in the coding scheme) and then apply coding rules.

```ts
import type { Response } from '@iqbspecs/response/response.interface';
import type { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingSchemeFactory } from '@iqb/responses';

const responses: Response[] = [
  { id: 'A1', value: 'foo', status: 'VALUE_CHANGED' },
  { id: 'A2', value: 2, status: 'VALUE_CHANGED' }
];

const variableCodings: VariableCodingData[] = /* from a coding-scheme JSON */ [];

const coded = CodingSchemeFactory.code(responses, variableCodings, {
  onError: (err) => {
    // optional hook: called when derive/coding encounters unexpected errors
    console.error(err);
  }
});
```

### Notes

- **Aliases vs ids**: `CodingSchemeFactory.code()` maps response ids between `alias` and `id` internally and returns the final responses mapped back.
- **Subforms**: responses may include a `subform` property; coding is performed per subform group.
- **Missing responses**: for variables that are present in the coding scheme but missing from `responses`, placeholder responses may be created (except for `sourceType: 'BASE_NO_VALUE'`).

## Code a single response

If you already have a `VariableCodingData` for a base variable and want to code exactly one `Response`, use `CodingFactory.code()`.

```ts
import type { Response } from '@iqbspecs/response/response.interface';
import type { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingFactory } from '@iqb/responses';

const response: Response = { id: 'A1', value: 'foo', status: 'VALUE_CHANGED' };
const coding: VariableCodingData = /* coding for variable A1 */ {} as VariableCodingData;

const codedResponse = CodingFactory.code(response, coding);
```

## Validate a coding scheme against base variables

```ts
import type { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import type { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingSchemeFactory } from '@iqb/responses';

const baseVariables: VariableInfo[] = /* list of base variables */ [];
const codingScheme: VariableCodingData[] = /* coding scheme variables */ [];

const problems = CodingSchemeFactory.validate(baseVariables, codingScheme);
// each problem is a { type, breaking, variableId, variableLabel, ... }
```

## Derivation dependency tree

To inspect derivation order / dependencies:

```ts
import type { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingSchemeFactory } from '@iqb/responses';

const variableCodings: VariableCodingData[] = [];
const tree = CodingSchemeFactory.getVariableDependencyTree(variableCodings);
```

## Get required base variables for a set of target variables

This is useful if you want to load only the required base responses needed to derive/code a set of variables.

```ts
import type { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingSchemeFactory } from '@iqb/responses';

const targetVarAliases = ['V1', 'V2'];
const variableCodings: VariableCodingData[] = [];

const requiredBaseVarAliases = CodingSchemeFactory.getBaseVarsList(targetVarAliases, variableCodings);
```

## Render coding information as text

```ts
import type { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { ToTextFactory } from '@iqb/responses';

const varInfo: VariableInfo = /* ... */ {} as VariableInfo;
const lines = ToTextFactory.varInfoAsText(varInfo);
```

## Status values

Status strings used by this package include (among others) `VALUE_CHANGED`, `CODING_COMPLETE`, `CODING_INCOMPLETE`, `CODING_ERROR`, `DERIVE_ERROR`, `INVALID`, `NO_CODING`, `UNSET`, ...

## VariableInfo compatibility

Starting with Responses 5.5.0, `CodingSchemeFactory.validate`,
`ToTextFactory.varInfoAsText` and `VariableList` accept both VariableInfo 1.x
and 2.1. The dependency is 2.1, while existing consumers can keep their own
1.x declarations. The exported `LegacyVariableInfo` preserves the structural
1.x contract; `VariableInfoV2` names the published 2.1 interface.

`VariableInfoInput` also accepts minimal 2.1 schema data containing only `id`
and `type`, optional metadata and values without labels. Formatting handles
omitted value lists. Validation retains the existing treatment of omitted
`multiple` as unknown; explicitly setting it to `false` checks scalar rules.

`VariableList` retains the mutable 1.x output contract for legacy inputs,
empty lists and existing annotations. For new input shapes it infers the
metadata type. Legacy fields such as `page` and `visualAnchor` are retained.
It trims and deduplicates ids as before, while
preserving type/format spelling and extension fields. Normalization helpers
remain available for comparisons; ingestion does not rewrite stored data.

## JavaScript module formats

The package provides native ESM for `import` and the existing CommonJS files for
`require`. The package root and existing file subpaths such as
`@iqb/responses/coding-factory` and `@iqb/responses/value-transform.js` select the
appropriate format automatically. The `presentation` directory entry also
remains available. Type declarations support classic Node resolution, NodeNext
and bundlers.

The ESM build imports the full mathjs `evaluate` API. It preserves SOLVER
functions, configuration and tolerances; it does not substitute the reduced
`mathjs/number` entry. ESM lets browser bundlers remove unused module exports.

`npm run prepare_publish` builds both formats from the same TypeScript source.
`npm run test:package` installs the tarball in a fresh consumer and checks both
runtime formats, subpaths, type resolution, SOLVER results and golden coding
fixtures against the published 5.4.0 package. It also checks partial-credit
derivations, stable regex behavior and VariableInfo compatibility in both formats.
Type checks use the actual published 1.3, 1.4 and 2.1 declarations in all four
resolution modes, including assignments to the previous public API. Building and verifying
the package does not publish it to npm.

## Versionsänderungen npm-package `@iqb/responses`

### 5.3.1
- `normalizeVariableInfoFormat` versteht die Formate der Chemie-Widgets auch in 1.x-Schreibweise: `chem-element-symbols` und `chem-molecule`. Das Studio schreibt sie so in die Unit-XML, weil die Unit-XSD nur kleingeschriebene Formate zulässt. `varInfoAsText` benennt sie damit wie `CHEM_ELEMENT_SYMBOLS` und `CHEM_MOLECULE`; bisher hätte es `unbekannt "…"` angezeigt.
- .NET-Port: dasselbe in `VariableInfoSpelling.NormalizeFormat`.

### 5.3.0
- `type` und `format` einer VariableInfo werden in beiden Schreibweisen verstanden: 1.x (`no-value`, `ggb-file`) und 2.x (`NO_VALUE`, `GGB_FILE`). Das betrifft die Validierung des Coding-Schemes und `varInfoAsText`. Bisher galten großgeschriebene Typen bei der Prüfung als unbekannt: Regeln auf `NUMBER`, `BOOLEAN` oder `STRING` meldeten `RULE_PARAMETER_INVALID`, `BASE_NO_VALUE` auf `NO_VALUE` meldete `INVALID_SOURCE`, und die Anzeige zeigte `unbekannt "…"`.
- Neu exportiert: `normalizeVariableInfoType` und `normalizeVariableInfoFormat` bringen einen Wert in die Schreibweise von 2.x. Werte in 2.x-Schreibweise und unbekannte Werte bleiben unverändert. Gedacht für Vergleiche, nicht zum Umschreiben gespeicherter Daten: Ältere Leser verstehen nur die 1.x-Schreibweise.
- .NET-Port: dasselbe über `VariableInfoSpelling.NormalizeType` und `NormalizeFormat`.

### 5.2.3
- `varInfoAsText` benennt die Formate der Chemie-Widgets aus VariableInfo 2.1: `CHEM_ELEMENT_SYMBOLS` als „Chemische Elementsymbole (durch Leerzeichen getrennt)“, `CHEM_MOLECULE` als „Molekül mit Bild (JSON)“. Bisher erschienen sie als `unbekannt "…"`. Die Schlüssel sind großgeschrieben, weil das Studio Formate, die VariableInfo 1.x nicht kennt, unverändert durchreicht.

### 5.2.2
- Ein von einem SOLVER-Ausdruck explizit zurückgegebenes `null` wird als `VALUE_CHANGED` weitergegeben und kann über `IS_NULL` oder `RESIDUAL_AUTO` kodiert werden.
- `NaN`, positive und negative Unendlichkeit sowie andere nichtnumerische SOLVER-Ergebnisse führen weiterhin zu `DERIVE_ERROR`.

### 5.2.1
- Ein eindeutiger öffentlicher Alias darf der technischen ID einer anderen Variable entsprechen, sofern deren öffentlicher Bezeichner abweicht. Responses bleiben extern aliasbasiert, während `deriveSources` weiterhin technische IDs referenzieren.
- Doppelte IDs, doppelte Aliasse und echte öffentliche Kollisionen bleiben ungültig.
- Unerwartete `sourceType`-Werte führen kontrolliert zu `DERIVE_ERROR`, statt geerbte Object-Properties als Handler aufzulösen.

### 5.2
- SOLVER-Ausdrücke können jetzt Fragmente aus Quellvariablen referenzieren, z. B. `${VAR[0]}`.
- SOLVER-Placeholders unterstützen Policies für leere/fehlende und nicht-numerische Werte, z. B. `${VAR:0}`, `${VAR:INC}` oder `${VAR:0:INC}`.
- Die Validierung des Coding-Schemes prüft weitere Regelparameter, Numeric-Ranges, Fragment-Regeln, `valueArrayPos` und Typkompatibilität.
- Abgeleitete Variablen können gezielt den Alias ihrer Base-Source überschreiben; die Base-Response wird danach korrekt entfernt.
- `NUMERIC_MATCH` wertet `null` und leere Strings nicht mehr als numerische `0`.

### 5.1
- @iqbspecs/coding-scheme 3.4.0
- Implementiert die neuen CodingProblem Typen:
     - `RULE_REGEX_INVALID`,
     - `RULE_PARAMETER_INVALID`,
     - `RULE_NUMERIC_RANGE_INVALID`,
     - `RULESET_VALUE_ARRAY_POS_INVALID`



### 5.0

- umfangreiches Refactoring/Modularisierung (u. a. Ableitungen, Rule-Engine, Dependency-Planung)
- verbesserte Validierung des Coding-Schemes (z. B. doppelte IDs/Aliase, ungültige Quellen, `RULE_PARAMETER_COUNT_MISMATCH`)
- robustere Fehlerbehandlung (z. B. ungültige RegEx, ungültige Solver-Expressions)
- Performance-Verbesserungen durch `Map`-basierte Lookups
- deutlich erweiterte Unit-Tests sowie CI/Dependabot-Workflows

### 4.0

Übernimmt folgende Spezifikationen:

- @iqbspecs/coding-scheme
- @iqbspecs/response
- @iqbspecs/variable-info

### 3.7

- `TAKE_NOT_REACHED_AS_VALUE_CHANGED` neuer Parameter für die Verarbeitung von Quell-Variablen

### 3.6

- `NUMERIC_FULL_RANGE` Regel >= Wert <= hinzugefügt

### 3.5

- Antworten in Unterformularen werden kodiert
- Setze RuleMethodParameterCount -1 for NUMERIC_MATCH Regel

### 3.4

- `BASE_NO_VALUE` source type wird nicht zu den Antworten hinzugefügt
- Status `INTENDED_INCOMPLETE` und code type `INTENDED_INCOMPLETE` hinzugefügt

### 3.3

- [Ableitungsregeln angepasst](https://iqb-berlin.github.io/coding-info/coding/derive.html)

### 3.2

- manuell kodierte abgeleitete und eingespielte Variablen werden nicht versucht abzuleiten
- Missing Regeln werden bei der Ableitung beachtet
- Aliase aus dem CodingScheme werden berücksichtigt

### 3.1

- neuer Wert für Property `valueArrayPos`: `LENGTH`; Werte Array muss angebene Länge haben
- neuer Wert für Property `valueArrayPos`: `ANY_OPEN`; dann wird - im Gegensatz zu `ANY` - erlaubt, dass Werte im Array sind, für die der Regelsatz nicht zutrifft
- Funktionalität für `valueArrayPos` - `ANY_OPEN` und `ANY` hinzugefügt bzw. korrigiert
- `IGNORE_CASE` führt jetzt zum `i`-Flag bei RegEx
- ein Werte-Array mit Länge 0 wird jetzt auch als 'leer' klassifiziert

### 3.0

- neue Property `version`; daher ist das gesamte Coding Scheme nicht mehr ein Array, sondern ein Objekt!
- neue Werte für code `type`: `RESIDUAL`, `RESIDUAL_AUTO`; ersetzt `ELSE`-Regel
- `ELSE`-Regel entfernt
- codingModel ist jetzt beschränkt auf `NONE`, `RULES_ONLY` und `MANUAL_ONLY`

### 2.2

- Neuer Wert für `codeModel`: `RULES_ONLY` - Ausblenden der Controls für die manuelle Kodierung
- Variable erhält neben der ID einen `alias`
- Code erhält einen `type`, um die Dokumentation zu erleichtern und die UI zu vereinfachen. Werte `UNSET`, `FULL_CREDIT`, `PARTIAL_CREDIT`, `NO_CREDIT` - `label` wurde hierfür immer missbraucht

### 2.1

- Neue Funktion `getVariableDependencyTree()` im Kodierschema, um den Graph der Ableitungen abzubilden

### 2.0

- Umsetzung der Änderungen Datenstruktur coding-scheme v2.0:
  - Neue Ableitungsmethoden `UNIQUE_VALUES`, `SOLVER`
  - neue Parameter 'sourceParameters' mit den Eigenschaften 'solverExpression' und 'processing' (mögliche Werte `TO_LOWER_CASE`, `TO_NUMBER`, `REMOVE_ALL_SPACES`, `REMOVE_DISPENSABLE_SPACES`, `TAKE_DISPLAYED_AS_VALUE_CHANGED`, `SORT`, `TAKE_EMPTY_AS_VALID`)
  - processing `REMOVE_WHITE_SPACES` entfernt; stattdessen `IGNORE_ALL_SPACES`, `IGNORE_DISPENSABLE_SPACES`, `SORT_ARRAY`
- Umbau der Tests auf Jest (für coding-scheme und die Validierung der JSON-Schema)
- Ersetzen `createCodingVariableFromVarInfo` mit `createCodingVariable` in `CodingFactory`
