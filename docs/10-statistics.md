# ToolSync – Statistik und Auswertungen

> Verbindliche Quellen: `docs/01-requirements.md` (13, 14, 16),
> `docs/00-project-vision.md` (4, 15), `docs/13-decisions.md` (DEC-048…052),
> `docs/09-admin-panel.md`, `docs/15-ui-styleguide.md`,
> `AdminPanel-Styleguide.html` (Chart-Referenz, Konventionen Nr. 2–5, 8),
> `frontend/src/admin.css`, `frontend/src/pages/admin/AdminDashboard.tsx`,
> `frontend/src/api/admin.ts`, `frontend/src/api/tools.ts`,
> `backend/app/routers/`. Kennzahlen, Endpunkte und Klassennamen sind gegen den
> Code geprüft; Abweichungen Referenz ↔ Code sind als **Abweichung** markiert.

## 1. Ist-Stand

| Ort | Datei | Umfang |
|---|---|---|
| Admin-Panel → Übersicht | `frontend/src/pages/admin/AdminDashboard.tsx` | 4 KPI-Kacheln, clientseitig berechnet |
| Haupt-Frontend, rechte Spalte | `frontend/src/App.tsx`, `StatisticsSidebar()` | 4 Karten, Werte fest `—` |

Charts (Donut, Sparkline, Balken) sind im Stil-Guide definiert und in
`frontend/src/admin.css` umgesetzt, werden im Admin-Panel aber **nicht
gerendert**.

> **Wichtig:** Es gibt **keinen** Backend-Endpunkt für Statistik. Kein Router
> unter `backend/app/routers/` liefert Kennzahlen; alle Zahlen entstehen im
> Browser.

## 2. Tatsächliche KPIs (Admin-Dashboard)

`AdminDashboard.tsx` rendert vier `.admin-kpi`-Kacheln:

| Kachel | Akzent-Token | Berechnung |
|---|---|---|
| `Gesamt` | `--admin-neutral` | `tools.length` |
| `Frei` | `--admin-success` | `t.status === 'available'` |
| `Ausgeliehen` | `--admin-danger` | `t.status === 'lent'` |
| `Wartung` | `--admin-warning` | `t.status === 'maintenance' \|\| 'defective'` |

Aufbau je Kachel: `.admin-kpi` mit `--kpi-accent`, darin `.admin-kpi-label`
und `.admin-kpi-value tnum` (Akzent nur über die CSS-Variable, Konvention
Nr. 3; `tnum` für Tabellenziffern, Konvention Nr. 8). Raster `grid-cols-2`, ab
`sm` `grid-cols-4`. **Datenquelle:** `getTools()` → intern
`GET /tools/?limit=500` (`frontend/src/api/tools.ts`) — keine weiteren
Parameter, alle Werke zusammen, Lager/Ersatz enthalten, Route prüft nur
`require_active`, keine Admin-spezifische Route.

> **Wichtig:** „Gesamt" ist damit kein Systemgesamtwert, sondern „höchstens die
> ersten 500 Werkzeuge" — Bestand darüber wird stillschweigend abgeschnitten.
> Ein KPI ohne Bezugsgröße ist laut Konvention Nr. 5 eine Behauptung.

`backend/app/models/enums.py`, `ToolStatus`: `available`, `lent`, `in_transit`,
`defective`, `maintenance`. `in_transit` zählt in **keiner** Kachel;
`defective` und `maintenance` werden addiert. Die Summe
`Frei + Ausgeliehen + Wartung` ergibt deshalb **nicht** zwingend `Gesamt`.

> **Abweichung:** `StatisticsSidebar()` zeigt vier `.app-stat-card`
> (Glas-System, `frontend/src/index.css`) mit den Beschriftungen „Aktive
> Ausleihen", „Verfügbare Werkzeuge", „Lagerbestand", „Serienartikel" — alle
> vier Werte sind hart `—` verdrahtet: kein `useEffect`, kein API-Aufruf, kein
> Ladezustand, reiner Platzhalter.

## 3. Chart-Typen und `admin-*`-Klassen

Alle Klassen liegen in `frontend/src/admin.css`, Abschnitt `CHARTS`.

| Typ | Klassen | Maße / Verhalten |
|---|---|---|
| Balken („Ausleihen pro Tag") | `.admin-chart-card`, `.admin-chart-header`, `.admin-chart-title`, `.admin-chart-sub`, `.admin-chart-plot`, `.admin-bars`, `.admin-bar-wrap`, `.admin-bar`, `.admin-bar.is-peak` (`--admin-primary-hover`), `.admin-bar.is-muted` (`--admin-primary-soft`), `.admin-bar-label` (+`.is-peak`), `.admin-chart-yaxis-labels` | Höhe `var(--admin-chart-h)` = **128px**, Lücke 7px, Balken `max-width: 26px` / `min-height: 4px`; `.admin-chart-plot` mit Rasterlinien alle 25 %, Y-Achse 22px (unter 640px ausgeblendet) |
| Donut („Auslastung") | `.admin-donut`, `.admin-donut::after`, `.admin-donut-value`, `.admin-donut-caption` | 96 × 96 px, `border-radius: 999px`, `conic-gradient`; Aussparung `inset: 15px` (`--admin-surface`); Zentrum `.9375rem`/800, Caption `uppercase` `.5rem` |
| Sparkline („Rückgaben", „Offene Alerts", „Ø Ausleihdauer") | `.admin-spark` | SVG, `width: 100%`, `height: 40px`, `overflow: visible`; `linearGradient`-Fläche, Linie `stroke-width: 1.75` + `vector-effect="non-scaling-stroke"`, Endpunkt-Kreis `r="2.5"`, `role="img"` + `aria-label` |
| Legende / Leerzustand | `.admin-legend`, `.admin-legend-item`, `.admin-legend-item .admin-dot`, `.admin-empty-chart`, `.admin-empty-icon` | Punkt 8 × 8 px; Leerzustand `min-height: 148px` gestrichelt, Icon 38 × 38 px |

## 4. Regel für Donut-Charts (verbindlich)

> **Wichtig:** Die Teilmengen eines Donuts müssen ihre Bezugsgröße ergeben.
> Ein Ring mit 47 % verträgt keine Legende, die auf 68 % kommt — und umgekehrt.

Der Stil-Guide nennt die Regel zweimal: als **Konvention Nr. 4** („Teilmengen
müssen ihre Bezugsgröße ergeben") und als Warnhinweis am Donut-Beispiel. Das
Referenzbeispiel ist konsistent: Bezugsgröße `128` (buchbare Werkzeuge),
Teilmengen „In Nutzung" `41` und „Frei" `19`, Summe `41 + 19 = 60`, Ringwert
und Zentrum `47 %`, `.admin-chart-sub` „60 von 128 buchbar", Rest
`68 = 128 − 60`. Passend dazu in `frontend/src/admin.css`:
`conic-gradient(var(--admin-primary) 0 32%, var(--admin-track) 32% 47%,
var(--admin-border) 47% 100%)` — 41 von 128 ≈ 32 %, 60 von 128 ≈ 47 %, der
Rest schließt den Ring bei 100 %.

Abgeleitete Pflichten: (1) Zentrums-Prozentsatz aus
`Teilmenge / Bezugsgröße` berechnen, nicht aus einer zweiten Quelle.
(2) Legende und Zentrum auf **derselben** Basis — zwei Prozentsätze aus
unterschiedlichen Nennern sind ein Fehler, keine Rundungsfrage. (3) Rest
schließt die Bezugsgröße: `Teilmenge + Rest = Bezugsgröße`, als **sichtbarer**
Ringabschnitt (`--admin-border`). (4) `.admin-chart-sub` nennt die absolute
Bezugsgröße, damit der Prozentwert nachrechenbar ist. (5) Alle Segmente auf
dieselbe Bezugsgröße normieren, sonst kippt der Ring.

> **Abweichung:** Der Codeblock am Ende des Chart-Abschnitts von
> `AdminPanel-Styleguide.html` zeigt ein **anderes** Beispiel
> (`--admin-primary 0 68%`, Rest bei 70 %) und widerspricht damit dem
> 47-%-Referenzbeispiel derselben Datei sowie `admin.css`. Verbindlich ist
> `41 + 19 = 60 von 128` → 47 %; der Codeblock ist fehlerhaft.

## 5. Zeiträume und Filter

Im Code vorhanden: eine Suche (`admin-input`) im `AdminDashboard`, die als
Teilstring über `tool.tool_id`, `tool.description` und `tool.tool_type?.name`
filtert, sowie die Tabelle, die maximal die ersten **20** Treffer zeigt
(`filteredTools.slice(0, 20)`), mit Zähler `{filteredTools.length} Einträge`.
Der Suchfilter wirkt **nicht** auf die KPI-Kacheln. Zeitraum-, Werk- und
Kategoriefilter gibt es nicht.

> **Abweichung:** `AdminPanel-Styleguide.html` zeigt zusätzlich Zeitraum-Chips
> (`Tag`/`Woche`/`Monat`/`Jahr`), ein Bereichs-Dropdown (`admin-select`, „Alle
> Bereiche / Lager 1 / Lager 2") und „Letzte 7 Tage · Operations". Diese Filter
> existieren **ausschließlich** im HTML-Entwurf. Eine Zeitreihe („Ausleihen pro
> Tag") ist heute nicht umsetzbar, weil keine Zeitreihendaten geladen werden.

## 6. Exportfunktionen

> **Wichtig:** Es gibt **keine** Exportfunktion — kein CSV, kein PDF, kein
> Excel. Belege: kein `csv`-, `download`- oder Export-Pfad in
> `frontend/src/pages/admin/`; `frontend/src/api/admin.ts` enthält nur
> Stammdaten-Funktionen (`getPlants`, `createPlant`, `updatePlant`,
> `deletePlant`, `getToolTypes`, `createToolType`, `updateToolType`,
> `deleteToolType`) plus Re-Exports aus `./masterData`. Das einzige
> Blob-Handling (`getSerialArticlePdf(id)` in `frontend/src/lib/api.ts`) dient
> der PDF-Anzeige. Auch `docs/01-requirements.md` fordert keinen Export:
> Abschnitt 13 fordert „Pagination und Filter", 14 Verwaltungsfunktionen.

## 7. Regeln für korrekte Charts

1. **Bezugsgröße zuerst** — Teilmengen ergeben ihre Bezugsgröße (Nr. 4, → Abschnitt 4).
2. **Achse, Skala, Textalternative** (Nr. 5): Höhen ohne Bezug sind
   Behauptungen — `.admin-chart-yaxis-labels`, `.admin-bar-label`, `role="img"`
   + `aria-label` auf `.admin-chart-plot` / `.admin-spark`.
3. **Farbe trägt Bedeutung** (Nr. 2): Höchstwert über `.admin-bar.is-peak`,
   nicht über Zufallsfarben.
4. **Nur Tokens** (Nr. 3): `--admin-primary`, `--admin-primary-hover`,
   `--admin-primary-soft`, `--admin-track`, `--admin-border`,
   `--admin-grid-line`, `--admin-success`, `--admin-warning`, `--admin-danger`,
   `--admin-neutral`.
5. **`tnum` für jede Zahl** in KPI und Zentrum (Nr. 8); **Leerzustand mit
   Icon, Aussage, Handlung** (Nr. 6) über `.admin-empty-chart` +
   `.admin-empty-icon`.
6. **`--admin-chart-h: 128px`** ist konstant; Balken ohne diese Höhe brechen
   die Rasterlinien.
7. **Klassenschichten nicht mischen**: Charts nutzen `.admin-*` (Split-Tone);
   `.app-stat-card` gehört zum Glas-System (`docs/00-project-vision.md` 15).

## 8. Abweichungen Doku ↔ Code

| # | Doku / Referenz | Code | Status |
|---|---|---|---|
| 1 | Donut: `41 + 19 = 60 von 128` → 47 % | kein Donut gerendert | nicht implementiert |
| 2 | Balken „Ausleihen pro Tag", letzte 7 Tage | fehlt, keine Zeitreihendaten | nicht implementiert |
| 3 | Drei Sparklines (Rückgaben, Alerts, Ausleihdauer) | fehlen | nicht implementiert |
| 4 | Zeitraum-Chips, Bereichs-Dropdown | fehlen | nur Entwurf |
| 5 | Statistik-Sidebar mit vier Kennzahlen | vier Karten mit hartem `—` | Platzhalter |
| 6 | Stil-Guide-Codeblock: Donut mit 68 % | `admin.css` + Referenz: 47 % | Widerspruch in der Referenz |
| 7 | KPI „Gesamt" als Systemkennzahl | `GET /tools/?limit=500` | Kappung bei 500 |
| 8 | „Zahlen nur mit Bezugsgröße" | Kachelsumme ≠ `Gesamt` (`in_transit` fehlt) | Regelverstoß |
## 9. Offene Fragen

> **Offen:** Soll es einen Backend-Endpunkt für Statistik geben (z. B.
> `GET /api/statistics/summary`)? Heute existiert keiner.
>
> **Offen:** Wie ist die Bezugsgröße eines Donuts fachlich definiert —
> „buchbar" wie im Referenzbeispiel oder „alle Werkzeuge des Werks"?
>
> **Offen:** Wie ist `in_transit` in den KPIs zu behandeln? Der Status
> existiert, wird aber nicht gezählt; ebenso unklar ist, ob die Kappung bei
> 500 Werkzeugen durch Pagination oder einen serverseitigen Zähler ersetzt
> wird.
>
> **Offen:** Welche Zeiträume sind verbindlich? Der Entwurf nennt „Letzte
> 7 Tage", die Kacheln sind Momentaufnahmen; eine Zeitreihe bräuchte
> aggregierte `Movement`-Daten (`backend/app/routers/movements.py`).
>
> **Offen:** Ist die Statistik-Sidebar in `App.tsx` noch gewollt oder ein Rest
> aus dem Prototyp `test.html`, und soll Statistik nur für Admins sichtbar
> sein?
