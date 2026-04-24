# Lasttest-Bericht fuer `POST /schemes/code`

Datum der Testserie: `2026-04-23`
Nachtrag mit Saettigungslauf: `2026-04-24`

Basisdokumentation:
- [k6 Testmatrix fuer POST /schemes/code](./responses-schemes-code-k6.md)

Messartefakte:
- [artifacts/k6-live](../../artifacts/k6-live)
- [artifacts/k6-live-series](../../artifacts/k6-live-series)
- [artifacts/k6-saturation-live](../../artifacts/k6-saturation-live)

Hinweis:
- Die Artefakte werden lokal oder im CI erzeugt und sind nicht Teil dieses Branches.

## Rahmenbedingungen

- Zielsystem: Responses-Microservice `1.0.0` mit Bibliothek `@iqb/responses 5.0.0`
- Endpunkt: `POST /schemes/code`
- Testtag: `2026-04-23`
- Ausfuehrung: `k6` im Docker-Container gegen einen lokal per Docker gestarteten Microservice
- Zieladresse aus Sicht von `k6`: `http://host.docker.internal:3000`

Wichtig:
- Die Ergebnisse sind fuer diese lokale Testumgebung reproduzierbar, aber nicht direkt als absolute Kapazitaetsgrenze fuer Produktion zu lesen.
- CPU-, RAM- und GC-Metriken des Service wurden in dieser Serie nicht separat erhoben.
- Die Serie zeigt deshalb vor allem eine validierte Stabilitaetsgrenze, noch keinen ausgereizten Saettigungspunkt.

Nachtrag `2026-04-24`:
- Die x10-Saettigungsprofile wurden lokal weitergefuehrt: zuerst das dokumentierte Profil `2 -> 6 req/s`, danach ein gezielter Suchlauf `7 -> 10 req/s`, anschliessend eine deutlich aggressivere Leiter `100 -> 150 -> 200 -> 250 -> 300 req/s` und danach ein Grenzsuchlauf `225 -> 250 -> 275 -> 300 req/s` mit hoeherem k6-VU-Deckel (`maxVUs=300`).
- Fuer die Suchlaeufe oberhalb von `6 req/s` wurde zusaetzlich eine einfache Prozess-Stichprobe des Node-Microservice mitgeschrieben. Das ist kein vollwertiges Profiling, aber ausreichend, um offensichtliche CPU- oder RAM-Spruenge zu erkennen.

## Ergebnisuebersicht

| Lauf | Payload | Scale | Lastprofil | Request-Bytes | Req/s | Avg ms | p95 ms | p99 ms | Fehlerquote | Ergebnis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `smoke` | `small` | `1` | `1 VU`, `30s` | `372` | `1022.07` | `0.84` | `1.40` | `1.86` | `0` | `PASS` |
| `baseline` | `medium` | `1` | `1 -> 8 req/s`, `5m` | `1251` | `4.30` | `2.49` | `3.24` | `3.86` | `0` | `PASS` |
| `spike` | `complex` | `1` | Peak `15 req/s`, `2m` | `3228` | `9.24` | `2.56` | `3.43` | `3.94` | `0` | `PASS` |
| `soak` | `medium` | `1` | `4 req/s`, `30m` | `1251` | `4.00` | `1.99` | `2.76` | `3.23` | `0` | `PASS` |
| `payload_scaling` | `complex` | `5` | `2 req/s`, `10m` | `16734` | `2.00` | `3.02` | `4.10` | `4.87` | `0` | `PASS` |
| `payload_scaling` | `complex` | `10` | `2 req/s`, `10m` | `33429` | `2.00` | `6.20` | `8.52` | `9.51` | `0` | `PASS` |
| `saturation_complex_x10` | `complex` | `10` | `2 -> 6 req/s`, `20m` | `33429` | `3.94` | `4.87` | `6.64` | `7.51` | `0` | `PASS` |
| `saturation_complex_x10_over6` | `complex` | `10` | `6 -> 7 -> 8 -> 9 -> 10 req/s`, `16m` | `33429` | `8.44` | `4.82` | `6.87` | `7.97` | `0` | `PASS` |
| `saturation_complex_x10_150_300` | `complex` | `10` | `100 -> 150 -> 200 -> 250 -> 300 req/s`, `16m` | `33429` | `211.78` | `168.45` | `439.93` | `585.36` | `0` | `PASS` |
| `saturation_complex_x10_225_300_vu300` | `complex` | `10` | `225 -> 250 -> 275 -> 300 req/s`, `16m`, `maxVUs=300` | `33429` | `251.13` | `379.13` | `1187.06` | `2220.54` | `0.1254` | `FAIL` |

## Interpretation

Die Serie zeigt bis `200 req/s` ein sehr stabiles Verhalten des Endpunkts. Oberhalb davon verdichtet sich die Warnzone im Nachtest zu einer echten Fehlerzone:

- Alle dokumentierten Laeufe bis einschliesslich `saturation_complex_x10_150_300` blieben formal ohne HTTP- oder Check-Fehler.
- Erst der Wiederholungslauf `saturation_complex_x10_225_300_vu300` reisst die gesetzten Thresholds klar: `12.54%` HTTP-Fehler, `checks rate = 0.8746`, `p95 = 1187 ms`, `p99 = 2221 ms`.
- Im `soak`-Lauf ueber `30 Minuten` trat keine sichtbare Drift auf. Weder die Zielrate von `4 req/s` noch die Latenzwerte verschlechterten sich ueber die Zeit.
- Die Latenz steigt mit der Payload-Groesse erwartbar an. Von `complex x5` zu `complex x10` verdoppelt sich die mittlere Latenz grob von `3.02 ms` auf `6.20 ms`.
- Auch die nachgezogenen x10-Saettigungslaeufe zeigen noch keine erkennbare Warnzone. Sowohl `2 -> 6 req/s` als auch der Suchlauf `7 -> 10 req/s` blieben fehlerfrei und ohne sichtbaren Nachzug von VUs.
- Der gezielte Suchlauf oberhalb von `6 req/s` bestaetigt damit nicht nur Stabilitaet bei `6 req/s`, sondern auch bei `7`, `8`, `9` und `10 req/s` in derselben lokalen Umgebung.
- Die deutlich aggressivere x10-Leiter `150 -> 200 -> 250 -> 300 req/s` blieb zwar formal fehlerfrei und unter den gesetzten Latenz-Thresholds, zeigte aber erstmals eine klare Warnzone: ab `250 req/s` stieg die Gesamtlatenz stark an, und k6 lief wiederholt am Limit von `100/100 VUs`.
- Im Run-Log dieses aggressiven Suchlaufs steht zusaetzlich die Warnung `Insufficient VUs, reached 100 active VUs and cannot initialize more`. Rechnerisch wurden `203388` Iterationen abgeschlossen, bei einem nominellen Soll von etwa `213000`. Das entspricht einem Fehlbetrag von rund `4.5%` und ist deshalb keine saubere Validierung von `250` oder `300 req/s` als belastbare Sustained-Betriebspunkte.
- Der Wiederholungslauf `225 -> 250 -> 275 -> 300 req/s` mit `maxVUs=300` bestaetigt, dass diese Warnzone kein reiner k6-Artefaktfall des frueheren `100`-VU-Deckels war. `225 req/s` blieb praktisch bei `1/100 VUs`, `250 req/s` brauchte bereits einen deutlich groesseren Pool (`117` initialisierte VUs), und ab `275 req/s` lief k6 erneut in `Insufficient VUs`.
- Im Re-Test wurden `241088` statt nominell etwa `250500` Iterationen abgeschlossen. Das ist ein Fehlbetrag von rund `3.8%`. Gleichzeitig stieg der Bedarf bis in die Zone `293/300` und spaeter `300/300` VUs. Spaetestens damit ist klar, dass `275` und `300 req/s` in dieser Konfiguration keine belastbaren Sustained-Betriebspunkte mehr sind.

Wichtig fuer die Einordnung:

- Der `baseline`-Lauf beweist Stabilitaet bis zum konfigurierten Maximum von `8 req/s`, nicht die tatsaechliche Obergrenze.
- Der `spike`-Lauf beweist, dass ein Burst auf `15 req/s` mit `complex`-Payload kurzzeitig stabil verarbeitet wurde.
- Der `payload_scaling`-Lauf mit `x10` beweist Stabilitaet bei sehr grossen Bodies bis `2 req/s`, aber ebenfalls noch keinen Grenzbereich.
- Der nachgezogene `saturation_complex_x10`-Lauf beweist Stabilitaet mit `complex x10` ueber die dokumentierte Leiter `2 -> 6 req/s`.
- Der Suchlauf `saturation_complex_x10_over6` verschiebt die validierte Oberkante dieser Serie auf `10 req/s`, ohne dass Fehlerquote, Latenz oder VU-Bedarf in eine erkennbare Warnzone liefen.
- Die einfache Prozess-Stichprobe zeigte im Suchlauf oberhalb von `6 req/s` ein weitgehend flaches Bild: RSS grob um `122 MB`, `%CPU` in `ps`-Snapshots grob bei `3.5-3.7`. Das ist nur eine grobe lokale Orientierung, aber kein Hinweis auf Ressourcenknappheit.
- Im aggressiven Lauf `150 -> 300 req/s` stieg dieselbe Stichprobe bis auf etwa `48.7% CPU` und `133 MB RSS`. Das ist weiterhin kein offensichtlicher CPU- oder RAM-Engpass des Node-Prozesses, aber zusammen mit dem VU-Limit und dem Latenzsprung ein deutlicher Hinweis auf eine neue Warnzone in dieser Testkonfiguration.
- Im Wiederholungslauf `225 -> 300 req/s` mit hoeherem VU-Deckel stieg dieselbe Stichprobe bis auf etwa `93.4% CPU` und `135 MB RSS`. Das passt dazu, dass die Kante oberhalb von `250 req/s` nicht nur vom Lastgenerator, sondern auch vom Service selbst spuerbar erreicht wird.

## Validierte Betriebsgrenzen

Die folgenden Grenzen sind aus dieser Serie belastbar ableitbar:

- `medium`-Payload, sustained: `4 req/s` pro Instanz sind fuer `30 Minuten` validiert.
- `medium`-Payload, kurzzeitig: der Endpunkt blieb im `baseline`-Profil bis `8 req/s` fehlerfrei.
- `complex`-Payload, Burst: `15 req/s` wurden im `spike`-Profil kurzzeitig fehlerfrei gehalten.
- `complex x5`, sustained: `2 req/s` fuer `10 Minuten` sind validiert.
- `complex x10`, sustained: `2 req/s` fuer `10 Minuten` sind validiert.
- `complex x10`, stufenweise: `2 -> 6 req/s` wurden ueber Haltephasen von jeweils `3m30s` fehlerfrei validiert.
- `complex x10`, erweitert: `7 -> 10 req/s` wurden ebenfalls ueber Haltephasen von jeweils `3m30s` fehlerfrei validiert.
- `complex x10`, aggressiv: `150` und `200 req/s` wurden in der Leiter `100 -> 150 -> 200 -> 250 -> 300 req/s` noch ohne Fehler und ohne dauerhafte Warnsignale validiert.

Diese Grenzen sind absichtlich defensiv formuliert:

- Sie beschreiben nur die Lastniveaus, die tatsaechlich gefahren wurden.
- Sie sind keine Aussage darueber, dass oberhalb davon ein Problem auftreten muss.
- `225` und `250 req/s` wirken im Wiederholungslauf noch unterhalb der eigentlichen Fehlerzone, werden hier aber bewusst noch nicht als belastbare Sustained-Grenze aufgefuehrt. Ohne stage-isolierte Einzellaeufe bleibt die exakte Oberkante zwischen `250` und `275 req/s` unscharf.
- `275` und `300 req/s` werden nach dem Re-Test mit `maxVUs=300` ausdruecklich nicht als belastbare Sustained-Grenze aufgefuehrt. Dort treten bereits `Insufficient VUs`, deutlicher VU-Druck, Threshold-Verletzungen und echte HTTP-Fehler auf.

## Empfehlung fuer den Betrieb

Wenn ihr auf Basis dieser Serie eine erste Betriebsgrenze pro Einzelinstanz festlegen wollt, wuerde ich so starten:

- Standardbetrieb mit typischem `medium`-Payload: `4 req/s` sustained pro Instanz als konservativer Startwert.
- Kurzfristige Lastspitzen mit kleinen bis mittleren Payloads: `8 req/s` koennen als derzeit validierte Burst-Groesse betrachtet werden.
- Sehr grosse Bodies oder stark vervielfachte Schemas: die fruehere konservative Annahme von `2 req/s` ist durch die Nachtests klar ueberholt. In dieser lokalen Testumgebung blieb `complex x10` nicht nur bis `10 req/s`, sondern auch bis mindestens `200 req/s` ohne klare Warnsignale stabil.
- Fuer eine vorsichtige Einzelinstanz-Planung wuerde ich `complex x10` aktuell bei `200 req/s` deckeln. Der Re-Test mit hoeherem VU-Deckel zeigt, dass die eigentliche Kippzone nicht erst bei `300`, sondern spaetestens im Bereich `275 req/s` liegt; `250 req/s` ist damit hoechstens noch ein Kandidat fuer gezielte Nachvalidierung, nicht fuer eine direkte Betriebsfreigabe.

Zusatzempfehlung:

- Wenn ihr produktiv Autoscaling oder Queueing davorsetzt, solltet ihr diese validierten Werte als Startpunkt fuer Kapazitaetsplanung verwenden, nicht als Endwert.
- Fuer produktionsnahe Limits fehlt noch ein echter Saettigungstest mit gleichzeitig erfassten Service-Ressourcen und hoeherem k6-VU-Deckel im Bereich oberhalb von `200 req/s`.

## Offene Naechste Schritte

Um aus diesem Bericht eine echte Kapazitaetsgrenze abzuleiten, fehlen noch drei Dinge:

1. Die Oberkante zwischen `250` und `275 req/s` mit stage-isolierten Einzeltests eingrenzen.
   Beispiel: getrennte Sustained-Laeufe fuer `225`, `240`, `250`, `260` und `270 req/s`, jeweils mit `preAllocatedVUs=100`, `maxVUs>=300` und laengerer Haltephase statt einer kombinierten Leiter.

2. Service-Metriken waehrend des Tests.
   Mindestens CPU, RAM, GC und optional Event-Loop-Lag des Node-Prozesses. Die einfache `ps`-Stichprobe aus dem Nachtrag ist nuetzlich, ersetzt das aber nicht.

3. Produktionsnaeheres Deployment.
   Dieselben Laeufe auf der geplanten vCPU-/RAM-Groesse oder auf der realen Kubernetes-/Docker-Instanzklasse.

## Artefakte

Direkte Reports:

- [smoke-summary.md](../../artifacts/k6-live/smoke-summary.md)
- [baseline-medium-summary.md](../../artifacts/k6-live/baseline-medium-summary.md)
- [spike-complex-summary.md](../../artifacts/k6-live-series/spike-complex-summary.md)
- [soak-medium-summary.md](../../artifacts/k6-live-series/soak-medium-summary.md)
- [payload-scaling-complex-x5-summary.md](../../artifacts/k6-live-series/payload-scaling-complex-x5-summary.md)
- [payload-scaling-complex-x10-summary.md](../../artifacts/k6-live-series/payload-scaling-complex-x10-summary.md)
- [saturation-complex-x10-summary.md](../../artifacts/k6-saturation-live/saturation-complex-x10-summary.md)
- [saturation-complex-x10-over6-summary.md](../../artifacts/k6-saturation-live/saturation-complex-x10-over6-summary.md)
- [saturation-complex-x10-over6-resource.log](../../artifacts/k6-saturation-live/saturation-complex-x10-over6-resource.log)
- [saturation-complex-x10-150-300-summary.md](../../artifacts/k6-saturation-live/saturation-complex-x10-150-300-summary.md)
- [saturation-complex-x10-150-300-resource.log](../../artifacts/k6-saturation-live/saturation-complex-x10-150-300-resource.log)
- [saturation-complex-x10-225-300-vu300-summary.md](../../artifacts/k6-saturation-live/saturation-complex-x10-225-300-vu300-summary.md)
- [saturation-complex-x10-225-300-vu300-resource.log](../../artifacts/k6-saturation-live/saturation-complex-x10-225-300-vu300-resource.log)
