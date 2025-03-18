[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/%40iqb%2Fresponses)](https://www.npmjs.com/package/@iqb/responses)

This package contains of type definitions for processing assessment data. Additionally, you find TypeScript interfaces and classes, so these data structures can be used in a coherent way. 

* [specification of interfaces in Html format](https://iqb-berlin.github.io/responses)
* [Ausführliche Darstellungen zum Kodieren](https://iqb-berlin.github.io/coding-info)
* release notes for data structures (German only): [missing](release_notes/missing.md), [coding-scheme](release_notes/coding-scheme.md), [response](release_notes/response.md), [state-map](release_notes/state-map.md)

## Versionsänderungen npm-package `@iqb/responses`

### 4.0

Übernimmt folgende Spezifikation:
* @iqbspecs/coding-scheme 
* @iqbspecs/response 
* @iqbspecs/variable-info

### 3.7

* `TAKE_NOT_REACHED_AS_VALUE_CHANGED` neuer Parameter für die Verarbeitung von Quell-Variablen

### 3.6

* `NUMERIC_FULL_RANGE` Regel >= Wert <= hinzugefügt

### 3.5

* Antworten in Unterformularen werden kodiert
* Setze RuleMethodParameterCount -1 for NUMERIC_MATCH Regel

### 3.4

* `BASE_NO_VALUE` source type wird nicht zu den Antworten hinzugefügt
* Status `INTENDED_INCOMPLETE` und code type `INTENDED_INCOMPLETE` hinzugefügt

### 3.3

* [Ableitungsregeln angepasst](https://iqb-berlin.github.io/coding-info/coding/derive.html)


### 3.2

* manuell kodierte abgeleitete und eingespielte Variablen werden nicht versucht abzuleiten
* Missing Regeln werden bei der Ableitung beachtet
* Aliase aus dem CodingScheme werden berücksichtigt

### 3.1

* neuer Wert für Property `valueArrayPos`: `LENGTH`; Werte Array muss angebene Länge haben
* neuer Wert für Property `valueArrayPos`: `ANY_OPEN`; dann wird - im Gegensatz zu `ANY` - erlaubt, dass Werte im Array sind, für die der Regelsatz nicht zutrifft
* Funktionalität für `valueArrayPos` - `ANY_OPEN` und `ANY` hinzugefügt bzw. korrigiert
* `IGNORE_CASE` führt jetzt zum `i`-Flag bei RegEx
* ein Werte-Array mit Länge 0 wird jetzt auch als 'leer' klassifiziert

### 3.0

* neue Property `version`; daher ist das gesamte Coding Scheme nicht mehr ein Array, sondern ein Objekt!
* neue Werte für code `type`: `RESIDUAL`, `RESIDUAL_AUTO`; ersetzt `ELSE`-Regel
* `ELSE`-Regel entfernt
* codingModel ist jetzt beschränkt auf `NONE`, `RULES_ONLY` und `MANUAL_ONLY`

### 2.2

* Neuer Wert für `codeModel`: `RULES_ONLY` - Ausblenden der Controls für die manuelle Kodierung
* Variable erhält neben der ID einen `alias`
* Code erhält einen `type`, um die Dokumentation zu erleichtern und die UI zu vereinfachen. Werte `UNSET`, `FULL_CREDIT`, `PARTIAL_CREDIT`, `NO_CREDIT` - `label` wurde hierfür immer missbraucht

### 2.1

* Neue Funktion `getVariableDependencyTree()` im Kodierschema, um den Graph der Ableitungen abzubilden

### 2.0

* Umsetzung der Änderungen Datenstruktur coding-scheme v2.0: 
  * Neue Ableitungsmethoden `UNIQUE_VALUES`, `SOLVER`
  * neue Parameter 'sourceParameters' mit den Eigenschaften 'solverExpression' und 'processing' (mögliche Werte `TO_LOWER_CASE`, `TO_NUMBER`, `REMOVE_ALL_SPACES`, `REMOVE_DISPENSABLE_SPACES`, `TAKE_DISPLAYED_AS_VALUE_CHANGED`, `SORT`, `TAKE_EMPTY_AS_VALID`)
  * processing `REMOVE_WHITE_SPACES` entfernt; stattdessen `IGNORE_ALL_SPACES`, `IGNORE_DISPENSABLE_SPACES`, `SORT_ARRAY`
* Umbau der Tests auf Jest (für coding-scheme und die Validierung der JSON-Schema)
* Ersetzen `createCodingVariableFromVarInfo` mit `createCodingVariable` in `CodingFactory`
