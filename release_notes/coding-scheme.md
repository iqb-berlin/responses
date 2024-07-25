# `coding-scheme`
## Versionsänderungen der Datenstruktur

### 3.1

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

* Neue Funktion `getVariableDependencyTree()`, um Zirkularbezüge festzustellen und die Reihenfolge der Ableitung bzw. Kodierung zu ermitteln. Außerdem werden hier Orte (page) abgeleiteter Variablen gesetzt. 

### 2.0

* Neue Ableitungsmethoden `UNIQUE_VALUES`, `SOLVER`
* neue Parameter 'sourceParameters' mit den Eigenschaften 'solverExpression' und 'processing' (mögliche Werte `TO_LOWER_CASE`, `TO_NUMBER`, `REMOVE_ALL_SPACES`, `REMOVE_DISPENSABLE_SPACES`, `TAKE_DISPLAYED_AS_VALUE_CHANGED`, `SORT`, `TAKE_EMPTY_AS_VALID`)
* Für Ableitungsmethode `CONCAT_CODE` eine Sortierungsoption `SORT` eingeführt
* processing `REMOVE_WHITE_SPACES` entfernt; stattdessen `IGNORE_ALL_SPACES`, `IGNORE_DISPENSABLE_SPACES`, `SORT_ARRAY`
* codeModelParameters entfernt
* Regel `NO_OTHER_MATCHES` entfernt (vorerst keine Unterstützung)

### 1.0

* id
* label
* sourceType `BASE`, `COPY_VALUE`, `CONCAT_CODE`, `SUM_CODE`, `SUM_SCORE`
* deriveSources
* processing `IGNORE_CASE`, `REPLAY_REQUIRED`, `ATTACHMENT`, `REMOVE_WHITE_SPACES`
* fragmenting
* manualInstruction
* codeModel `NONE`, `CHOICE`, `VALUE_LIST`, `NUMBER`, `MANUAL`
* codeModelParameters
* codes
  + id String | null
  + label
  + score
  + manualInstruction
  + ruleSetOperatorAnd
  + ruleSets
* page
