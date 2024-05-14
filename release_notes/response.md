# `response`
## Versionsänderungen der Datenstruktur

### 1.3

Bisher nicht verwendete States `SOURCE_MISSING` und `VALUE_DERIVED` werden entfernt. Sie würden die Ursache für ein Ableitungsproblem verschleiern. Stattdessen werden die States der Variablen gesetzt, die die Ursache für das Problem sind bzw. `DERIVE_ERROR`. Wenn erfolgreich abgeleitet wurde, wird jetzt `VALUE_CHANGED` gesetzt, wodurch auch die Programmierung klarer wird.

### 1.2

Neuer Status `INVALID` für eine während der Kodierung festgestellte ungültige Antwort (z. B. leer).

### 1.1

Neuer Parameter `subform`, um Unterformulare abzubilden. Dies ist also für den Fall, dass eine Variable in einer Unit mehrfach vorkommen kann.

### 1.0

* erste Version mit den Parametern `id`, `state`, `value`, `code`und `core`
* Status-Werte `UNSET`, `NOT_REACHED`, `DISPLAYED`, `VALUE_CHANGED`, `DERIVE_ERROR`, `NO_CODING`, `SOURCE_MISSING`, `VALUE_DERIVED`, `CODING_INCOMPLETE`, `CODING_ERROR`, `CODING_COMPLETE`
