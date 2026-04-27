# k6 Testmatrix fuer `POST /schemes/code`

Die Artefakte in diesem Ordner fokussieren nur den Responses-Microservice-Endpunkt `POST /schemes/code`.

`k6` ist nicht Teil der Repository-Dependencies und muss separat installiert oder per Docker ausgefuehrt werden.

Skript:
- [scripts/load-tests/responses-schemes-code.js](../../scripts/load-tests/responses-schemes-code.js)
- [run-responses-schemes-code.sh](../../scripts/load-tests/run-responses-schemes-code.sh)

Payloads:
- [scripts/load-tests/payloads/schemes-code-small.json](../../scripts/load-tests/payloads/schemes-code-small.json)
- [scripts/load-tests/payloads/schemes-code-medium.json](../../scripts/load-tests/payloads/schemes-code-medium.json)
- [scripts/load-tests/payloads/schemes-code-complex.json](../../scripts/load-tests/payloads/schemes-code-complex.json)

## Microservice lokal starten

Fuer lokale Lasttests muss der Microservice dieses Repos auf Port `3000` oder auf einer anderen erreichbaren Basis-URL laufen.

Direkt ueber `npm`:

```bash
npm --prefix microservice install
npm --prefix microservice run build
npm --prefix microservice run start
```

Oder ueber die schlanke Make-Huelle in diesem Branch:

```bash
make microservice-install
make microservice-build
make microservice-start
```

## Payload-Klassen

| Klasse | Quelle | Charakteristik | Einsatz |
| --- | --- | --- | --- |
| `small` | minimales BASE-Array-Beispiel | 1 Response, 1 VariableCoding, kleine JSON-Body | schneller Smoke-Test und Transport-Check |
| `medium` | Arrays-/Ruleset-Beispiel | 3 Responses, 4 VariableCodings, mehrere RuleSets und Array-Auswertungen | erste Baseline fuer typische CPU-Last |
| `complex` | Subform-/Ableitungs-Beispiel | 9 Responses, 7 VariableCodings, Subforms und Ableitung (`SUM_CODE`) | realistischere Last mit Gruppenbildung und Derivation |
| `large` | `complex` mit `SCALE_FACTOR=5` | 5x geklonter `complex`-Payload, IDs und `deriveSources` werden umbenannt | Payload-Wachstum und Body-Groesse |
| `xlarge` | `complex` mit `SCALE_FACTOR=10` | 10x geklonter `complex`-Payload | Saettigungspunkt mit grossen Bodies |

## Standard-Thresholds

Das Skript verwendet konservative Default-Grenzen, die ihr per Env-Variablen ueberschreiben koennt:

- `MAX_FAILURE_RATE=0.01`
- `P95_MS=1000`
- `P99_MS=1500`

Testergebnisse:
- [Lasttest-Bericht 2026-04-23](./responses-schemes-code-report-2026-04-23.md)

Saettigungstest:
- [Saettigungsmatrix fuer POST /schemes/code](./responses-schemes-code-saturation-k6.md)

## Konkrete Testmatrix

Diese Matrix ist fuer stabile Betriebsprofile gedacht. Die getrennte Saettigungsmatrix liegt in
[responses-schemes-code-saturation-k6.md](./responses-schemes-code-saturation-k6.md).

| Lauf | Profil | Payload | Scale | Lastmodell | Default-Last | Dauer | Ziel |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `smoke` | `small` | `1` | `constant-vus` | `1` VU | `30s` | URL, Headers und JSON-Parsing pruefen |
| 2 | `baseline` | `small` | `1` | `ramping-arrival-rate` | `1 -> 2 -> 5 -> 8 req/s` | `5m` | technische Baseline fuer kleinen Request |
| 3 | `baseline` | `medium` | `1` | `ramping-arrival-rate` | `1 -> 2 -> 5 -> 8 req/s` | `5m` | typische Baseline fuer Ruleset-Last |
| 4 | `spike` | `complex` | `1` | `ramping-arrival-rate` | `1 -> 3 -> 15 -> 3 req/s` | `2m` | Burst-Verhalten des Endpunkts pruefen |
| 5 | `soak` | `medium` | `1` | `constant-arrival-rate` | `4 req/s` | `30m` | Speicher-/GC-Stabilitaet unter Dauerlast |
| 6 | `payload_scaling` | `complex` | `5` | `constant-arrival-rate` | `2 req/s` | `10m` | grosse Request-Bodies ohne Peak-Burst |
| 7 | `payload_scaling` | `complex` | `10` | `constant-arrival-rate` | `2 req/s` | `10m` | Worst-Case fuer Body-Groesse und CPU |

## Beispielkommandos

```bash
BASE_URL=http://localhost:3000 \
PROFILE=smoke \
PAYLOAD=small \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=baseline \
PAYLOAD=medium \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=spike \
PAYLOAD=complex \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=soak \
PAYLOAD=medium \
DURATION=45m \
RATE=5 \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=payload_scaling \
PAYLOAD=complex \
SCALE_FACTOR=5 \
RATE=2 \
k6 run scripts/load-tests/responses-schemes-code.js
```

## Wrapper ohne lokale k6-Installation

Direkter Aufruf:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=baseline \
PAYLOAD=medium \
./scripts/load-tests/run-responses-schemes-code.sh
```

Via Make:

```bash
make load-test-responses-schemes-code \
  BASE_URL=http://localhost:3000 \
  PROFILE=baseline \
  PAYLOAD=medium
```

Der Wrapper nutzt lokal installiertes `k6`, falls vorhanden. Sonst startet er `grafana/k6` per Docker.
Wenn `BASE_URL` auf `localhost` oder `127.0.0.1` zeigt, schreibt der Wrapper die Adresse im Docker-Fall auf
`host.docker.internal` um, damit ein lokal laufender Microservice aus dem Container erreichbar bleibt.

## Summary-Export

Das Skript erzeugt ueber `handleSummary()` einen kompakten End-of-Test-Report.

- `SUMMARY_STDOUT=true|false`: schreibt die Markdown-Zusammenfassung auf `stdout`
- `SUMMARY_JSON=<pfad>`: schreibt eine maschinenlesbare JSON-Zusammenfassung
- `SUMMARY_MD=<pfad>`: schreibt eine Markdown-Zusammenfassung
- `SUMMARY_DIR=<ordner>` und `SUMMARY_BASENAME=<name>`: Komfortvariante fuer `<ordner>/<name>.json` und `<ordner>/<name>.md`

Beispiel:

```bash
mkdir -p artifacts/k6

BASE_URL=http://localhost:3000 \
PROFILE=baseline \
PAYLOAD=medium \
SUMMARY_STDOUT=false \
SUMMARY_JSON=artifacts/k6/summary.json \
SUMMARY_MD=artifacts/k6/summary.md \
./scripts/load-tests/run-responses-schemes-code.sh
```

Hinweis:
- Wenn `SUMMARY_DIR` verwendet wird, muss das Verzeichnis bereits existieren.

## Wichtige Parameter

- `BASE_URL`: Basis-URL des Microservice, zum Beispiel `http://localhost:3000`
- `PROFILE`: `smoke`, `baseline`, `spike`, `soak`, `payload_scaling`, `saturation_medium`, `saturation_complex`, `saturation_complex_x5`, `saturation_complex_x10`
- `PAYLOAD`: `small`, `medium`, `complex`
- `SCALE_FACTOR`: vervielfacht den gewaehlten Payload synthetisch
- `SATURATION_START_RATE`: ueberschreibt die Start-Rate fuer Saettigungsprofile
- `SATURATION_TARGETS`: komma-separierte Zielraten fuer Saettigungsprofile, zum Beispiel `4,8,12,16`
- `SATURATION_RAMP_DURATION`, `SATURATION_HOLD_DURATION`: Dauer der Ramp- und Haltephasen in Saettigungsprofilen
- `RATE_SCALE`: multipliziert nur die vorkonfigurierten Profil-Raten
- `RATE`: ueberschreibt die feste Rate bei `soak` und `payload_scaling`
- `PRE_ALLOCATED_VUS`, `MAX_VUS`, `DURATION`, `P95_MS`, `P99_MS`, `MAX_FAILURE_RATE`: Laufzeit-Tuning
- `PARSE_RESPONSE=false`: spart Parsing-Overhead des Load-Generators, falls nur HTTP/Latenz interessiert

## Hinweise

- Die synthetische Skalierung benennt `id`, `alias`, `deriveSources` und `subform` pro Kopie um.
- Freitext-Referenzen in `solverExpression` werden bewusst nicht umgeschrieben. Fuer Payloads mit solchen Abhaengigkeiten sollte die Groessenklasse besser als eigene JSON-Datei gepflegt werden.
- Die Beispiel-Payloads sind aus realen Testdaten der `@iqb/responses`-Bibliothek abgeleitet und fuer `CodingSchemeFactory.code()` lokal validierbar.
- Fuer CI gibt es einen manuellen Workflow in [.github/workflows/load-test-responses-schemes-code.yml](../../.github/workflows/load-test-responses-schemes-code.yml).
- Im GitHub-Workflow muss `base_url` von GitHub Actions aus erreichbar sein. Ein lokales `http://localhost:3000` auf dem Entwicklerrechner funktioniert dort nicht.
