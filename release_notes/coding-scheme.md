# `coding-scheme`
## Versionsänderungen der Datenstruktur

### 2.0

* Neue Ableitungsmethoden `UNIQUE_VALUES`, `SOLVER`
* neue Parameter 'sourceParameters' mit den Eigenschaften 'solverExpression' und 'processing' (mögliche Werte `TO_LOWER_CASE`, `TO_NUMBER`, `REMOVE_ALL_SPACES`, `REMOVE_DISPENSABLE_SPACES`, `TAKE_DISPLAYED_AS_VALUE_CHANGED`, `SORT`, `TAKE_EMPTY_AS_VALID`)
* processing `REMOVE_WHITE_SPACES` entfernt; stattdessen `IGNORE_ALL_SPACES`, `IGNORE_DISPENSABLE_SPACES`, `SORT_ARRAY`
* codeModelParameters entfernt

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
