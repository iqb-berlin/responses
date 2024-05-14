[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/%40iqb%2Fresponses)](https://www.npmjs.com/package/@iqb/responses)

This package contains of type definitions for processing assessment data. Additionally, you find TypeScript interfaces and classes, so these data structures can be used in a coherent way. 

* [specification of interfaces in Html format](https://iqb-berlin.github.io/responses)
* [Ausführliche Darstellungen zum Kodieren](https://iqb-berlin.github.io/coding-info)
* release notes for data structures (German only): [missing](release_notes/missing.md), [coding-scheme](release_notes/coding-scheme.md), [response](release_notes/response.md), [state-map](release_notes/state-map.md)

## Versionsänderungen npm-package `@iqb/responses`

### 2.0

* Umsetzung der Änderungen Datenstruktur coding-scheme v2.0: 
  * Neue Ableitungsmethoden `UNIQUE_VALUES`, `SOLVER`
  * neue Parameter 'sourceParameters' mit den Eigenschaften 'solverExpression' und 'processing' (mögliche Werte `TO_LOWER_CASE`, `TO_NUMBER`, `REMOVE_ALL_SPACES`, `REMOVE_DISPENSABLE_SPACES`, `TAKE_DISPLAYED_AS_VALUE_CHANGED`, `SORT`, `TAKE_EMPTY_AS_VALID`)
  * processing `REMOVE_WHITE_SPACES` entfernt; stattdessen `IGNORE_ALL_SPACES`, `IGNORE_DISPENSABLE_SPACES`, `SORT_ARRAY`
* Umbau der Tests auf Jest (für coding-scheme und die Validierung der JSON-Schema)
* Ersetzen `createCodingVariableFromVarInfo` mit `createCodingVariable` in `CodingFactory`
