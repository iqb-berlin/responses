# Entscheidungsnotiz zu `POST /schemes/code`

Stand: `2026-04-24`

Referenz:
- Vollbericht: [responses-schemes-code-report-2026-04-23.md](./responses-schemes-code-report-2026-04-23.md)

## Kurzfassung

Fuer die aktuelle lokale Testkonfiguration ist `complex x10` bis `200 req/s` pro Instanz belastbar validiert.

`275 req/s` und `300 req/s` sind nicht freigegeben. Im Wiederholungslauf mit hoeherem k6-VU-Deckel (`maxVUs=300`) traten dort klare Threshold-Verletzungen, `Insufficient VUs`, echte HTTP-Fehler und stark erhoehte Latenzen auf.

`250 req/s` bleibt eine Uebergangszone. Dieser Bereich wird vorerst nicht als betriebliche Grenze freigegeben und auch nicht weiter eingegrenzt.

## Entscheidung

- Fuer weitere Planung und Kommunikation gilt vorerst `200 req/s` pro Instanz als technische Oberkante fuer `complex x10` in dieser Testkonfiguration.
- Oberhalb davon wird aktuell keine Betriebsfreigabe ausgesprochen.
- Wenn ein operativer Sicherheitsabstand gewuenscht ist, sollte der produktive Zielwert unterhalb von `200 req/s` angesetzt werden.

## Tragende Messpunkte

- Lauf `100 -> 150 -> 200 -> 250 -> 300 req/s`: formal `PASS`, aber ab `250 req/s` deutlicher VU-Druck und Warnzone.
- Wiederholungslauf `225 -> 250 -> 275 -> 300 req/s`, `maxVUs=300`: `FAIL`.
- Kennzahlen aus dem Wiederholungslauf:
  - `12.54%` HTTP-Fehler
  - `p95 = 1187 ms`
  - `p99 = 2221 ms`
  - `241088` statt ca. `250500` Soll-Iterationen
  - Prozess-Stichprobe bis etwa `93.4% CPU` und `135 MB RSS`

## Einordnung

- Diese Aussage gilt fuer die vorliegende lokale Testumgebung, nicht direkt als Produktionsgrenze.
- Die Entscheidung ist bewusst defensiv: `200 req/s` ist freigegeben, die Zone darueber nicht.
- Weitere Grenzsuche ist aktuell nicht vorgesehen.

## Formulierung fuer PR, Ticket oder Team-Update

Die Lasttests fuer `POST /schemes/code` zeigen in der aktuellen Testkonfiguration eine belastbare Grenze von `200 req/s` pro Instanz fuer `complex x10`. Ein Wiederholungslauf im Bereich `225 -> 300 req/s` mit hoeherem k6-VU-Deckel (`maxVUs=300`) ist fehlgeschlagen und zeigte ab der Zone oberhalb von `250 req/s` klare Instabilitaet: `12.54%` HTTP-Fehler, `p95 = 1187 ms`, `p99 = 2221 ms`, `Insufficient VUs` und deutlichen CPU-Anstieg. Fuer die weitere Planung behandeln wir deshalb `200 req/s` als technische Oberkante; `250 req/s` bleibt eine nicht freigegebene Uebergangszone, `275` und `300 req/s` sind nicht freigegeben.
