# Saettigungsmatrix fuer `POST /schemes/code`

Diese Matrix ist getrennt von den normalen Stabilitaetsprofilen dokumentiert. Ziel ist nicht ein
einfaches `PASS`, sondern der Bereich, in dem `POST /schemes/code` von einer stabilen Zone in eine
Warn- oder Kippzone uebergeht.

Grundlage:
- [Allgemeine k6-Testmatrix](./responses-schemes-code-k6.md)
- [Lasttest-Bericht 2026-04-23](./responses-schemes-code-report-2026-04-23.md)

## Zielbild

Die Saettigungsprofile fahren die Last stufenweise hoch. Jede Stufe besteht aus:

- einer kurzen Rampe, damit die Last nicht schlagartig springt
- einer Haltephase, in der sich Latenz, Fehlerquote und VU-Bedarf sichtbar einpendeln koennen

Standardmaessig verwendet jedes Profil:

- `SATURATION_RAMP_DURATION=30s`
- `SATURATION_HOLD_DURATION=3m30s`

Damit ergibt sich pro Zielrate ein `4m`-Block.

## Profile

| Profil | Default Payload | Default Scale | Zielraten (req/s) | Gesamtdauer | Zweck |
| --- | --- | --- | --- | --- | --- |
| `saturation_medium` | `medium` | `1` | `4, 8, 12, 16, 20, 24, 30` | `28m` | Kapazitaetskurve fuer typische Ruleset-Last |
| `saturation_complex` | `complex` | `1` | `4, 8, 12, 16, 20` | `20m` | Kipppunkt fuer komplexere Ableitungen und Subforms |
| `saturation_complex_x5` | `complex` | `5` | `2, 4, 6, 8` | `16m` | Grenzbereich fuer grosse Bodies bei moderater Rate |
| `saturation_complex_x10` | `complex` | `10` | `2, 3, 4, 5, 6` | `20m` | Worst-Case fuer sehr grosse Bodies |

Hinweise:
- Die vier Profile setzen `PAYLOAD` und `SCALE_FACTOR` nur dann automatisch, wenn diese Variablen
  nicht explizit gesetzt werden.
- `RATE_SCALE` wirkt auch auf die Saettigungsprofile und skaliert alle vorkonfigurierten Zielraten.
- `DURATION` wird von den Saettigungsprofilen nicht verwendet; die Laufzeit ergibt sich aus den
  Stufen.

## Beispielkommandos

Direkt mit `k6`:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=saturation_medium \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex \
PAYLOAD=complex \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex_x5 \
k6 run scripts/load-tests/responses-schemes-code.js
```

Mit Wrapper:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=saturation_medium \
SUMMARY_DIR=artifacts/k6-saturation \
./scripts/load-tests/run-responses-schemes-code.sh
```

Via Make:

```bash
make load-test-responses-schemes-code \
  BASE_URL=http://localhost:3000 \
  PROFILE=saturation_complex_x10 \
  SUMMARY_DIR=artifacts/k6-saturation
```

## Sinnvolle Overrides

- `SATURATION_TARGETS`: eigene Ratenleiter als komma-separierte Ganzzahlen, zum Beispiel
  `SATURATION_TARGETS=6,10,14,18`
- `SATURATION_START_RATE`: eigene Start-Rate vor der ersten Stufe
- `SATURATION_RAMP_DURATION`: Rampe pro Stufe, zum Beispiel `20s`
- `SATURATION_HOLD_DURATION`: Haltezeit pro Stufe, zum Beispiel `5m`
- `PRE_ALLOCATED_VUS`, `MAX_VUS`: hochziehen, wenn die Ankunftsrate wegen zu weniger VUs nicht
  sauber gehalten wird
- `P95_MS`, `P99_MS`, `MAX_FAILURE_RATE`: enger oder lockerer setzen, je nachdem ob der Lauf als
  reiner Suchlauf oder bereits als betriebliches Gate dienen soll

Beispiel mit engeren Plateaus:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex \
SATURATION_TARGETS=6,10,14,18,22 \
SATURATION_HOLD_DURATION=5m \
MAX_VUS=150 \
SUMMARY_DIR=artifacts/k6-saturation \
./scripts/load-tests/run-responses-schemes-code.sh
```

## Auswertung

Bei Saettigungstests reichen aggregierte Mittelwerte nicht aus. Relevant sind vor allem:

- `p95` und `p99` der Request-Dauer
- `http_req_failed`
- `checks`
- `vus` und `vus_max`
- Container-Metriken wie `CPU`, `RAM`, `GC` und Event-Loop-Lag, falls verfuegbar

Ein pragmatischer Abbruch- oder Kippindikator ist:

- Fehlerquote steigt ueber die definierte Grenze
- `p95` oder `p99` machen einen deutlichen Sprung
- die Zielrate laesst sich nur noch mit stark wachsendem VU-Bedarf halten
- der Container laeuft sichtbar ins CPU- oder RAM-Limit

## CI

Der manuelle Workflow
[.github/workflows/load-test-responses-schemes-code.yml](../../.github/workflows/load-test-responses-schemes-code.yml)
unterstuetzt dieselben Profile und Saettigungs-Overrides:

- `payload=auto` und leerer `scale_factor` verwenden die Profil-Defaults
- `saturation_start_rate`
- `saturation_targets`
- `saturation_ramp_duration`
- `saturation_hold_duration`

Damit kann die Saettigungsmatrix auch ohne lokale `k6`-Installation reproduzierbar gefahren werden,
sofern `base_url` vom GitHub-Runner aus erreichbar ist.
