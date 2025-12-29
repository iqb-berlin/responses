[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/%40iqb%2Fresponses)](https://www.npmjs.com/package/@iqb/responses)

This package contains of type definitions for processing assessment data. Additionally, you find TypeScript interfaces and classes, so these data structures can be used in a coherent way.

- [Iqb specifications](https://iqb-specifications.github.io/)
- [Ausführliche Darstellungen zum Kodieren](https://iqb-berlin.github.io/tba-info/coding/response-status.html)

## Installation

```bash
npm i @iqb/responses
```

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

## Versionsänderungen npm-package `@iqb/responses`

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
