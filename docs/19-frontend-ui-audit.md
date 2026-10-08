# Frontend-Audit gegen den UI-Styleguide

**Projekt:** ToolSync · **Stand:** Audit-Lauf vom aktuellen Working Tree
**Maßstab (verbindlich):**

| Quelle | Geltung |
|---|---|
| `docs/15-ui-styleguide.md` | Verbindlicher Guide, zwei getrennte Systeme |
| `.continue/rules/11-ui-hauptfrontend.md` | System A „Glas“ (Haupt-Frontend) |
| `.continue/rules/12-ui-adminpanel.md` | System B „Split-Tone Operational“ (AdminPanel) |
| `frontend/src/index.css` / `frontend/src/admin.css` | Die CSS-Dateien sind laut Guide §4 die *verbindliche Quelle* |
| Skills `better-ui`, `better-layout`, `better-typography`, `better-writing` | Handwerksmaßstab für das, was der Guide nicht regelt |

**Prüfumfang:** `frontend/src` vollständig — 29 Dateien Haupt-Frontend (Glas), 8 Dateien AdminPanel (Split-Tone) — plus `frontend/index.html`.

**Methode / Evidenz:** Zwei Ebenen, in diesem Report getrennt gekennzeichnet.
- **static** — Quellcode, CSS, berechnete Kontrastwerte (`.audit/frontend-audit.mjs`, `.audit/contrast.mjs`).
- **rendered** — echte DOM-Messungen und Screenshots in Chromium gegen die laufende App, 1440×900 / 390×844 / 375×667 (`.audit/rendered-check.mjs`, `rendered-check2.mjs`, `rendered-check3.mjs`, Bilder in `.audit/shots/`).

Nicht alle geprüften Punkte wurden zu Befunden: der **Fokusring auf Eingabefeldern funktioniert** (gemessen: `box-shadow rgba(15,118,110,0.15) 0 0 0 3px`, `border-color rgb(15,118,110)` am fokussierten Feld) — der Verdacht aus der reinen Code-Lesung hat sich damit erledigt. Der Login ist nur mit `admin1/123` möglich (die Personalnummer `1001` aus `frontend/tests/login.spec.ts` existiert in `backend/toolsync.db` nicht — Testdaten-Drift, kein UI-Befund).

---

## 0. Ergebnis in drei Sätzen

1. Das **AdminPanel ist der konforme Teil**: 18 von 18 Guide-Tokens wertgleich, 0 rohe Palettenfarben, 0 erfundene Klassen, 0 `!important` — dort ist der Guide eingehalten.
2. Das **Haupt-Frontend ist es nicht**: Die 36 Glas-Klassen existieren vollständig in `index.css`, werden aber nur zu 31 verschiedenen Klassen benutzt (18 davon gar nie), während **153 rohe Tailwind-Palettenfarben** und handgebaute Buttons, Tabs und Icons dieselben Aufgaben in abweichenden Werten lösen. Die Primärfarbe weicht an 7 Stellen von `#0f766e` ab.
3. Darüber hinaus gibt es **UX-Blocker**, die kein Design-System-Detail sind: abgeschnittene Modal-Aktionen auf kleinen Viewports, kein Logout auf Mobil, rohe englische Serverfehler im UI, native Browser-Dialoge für Löschbestätigungen und ein „Anlegen“-Button im Bearbeiten-Modus.

---

## 1. Verdikt

| System | Verdikt | Begründung |
|---|---|---|
| Haupt-Frontend (Glas) | **Needs changes** (vorher **Block**) | Alle 6 HIGH-Befunde behoben (Paket 1 + 2); offen sind MEDIUM/LOW: Guide-Abgleich, Kontrast, Beschriftungen, Platzhalterinhalte |
| AdminPanel (Split-Tone) | **Needs changes** | Tokens konform; 1 Systemleck, inkonsistente Icon-Strichgewichte, Doku-Drift, eigene `window.confirm`-Stellen |

Nach Skill-Skala (`Block` nur bei verbleibendem HIGH): **kein HIGH mehr offen**, das Gesamtergebnis ist **Needs changes**.

### 1.1 Umsetzungsstand: Paket 1 erledigt

Fünf Befunde sind umgesetzt und im Browser nachgeprüft (10/10 Prüfungen, `.audit/verify-paket1.mjs`):

| Befund | Änderung | Dateien | Verifikation |
|---|---|---|---|
| **A-01** | Panel höhenbegrenzt und innen scrollbar (`max-h-[calc(100dvh-2rem)] overflow-y-auto`), Aktionszeile sticky (`sticky bottom-0 … bg-white/95 backdrop-blur`), PDF-Viewer auf `dvh` | `StorageItemForm.tsx:64,166`, `SerialArticleUpload.tsx:67,138`, `LendModal.tsx:48`, `PDFViewer.tsx:58` | 375×667, 360×640, 390×560, 390×844: Titel sichtbar, **„Speichern" in allen vier Viewports sichtbar**, Panel intern scrollbar |
| **A-05** | Button benennt die Aktion: „Werkzeug anlegen" / **„Änderungen speichern"** | `ToolForm.tsx:669` | Im Bearbeiten-Modus gemessen: Überschrift „Bearbeiten", Submit-Button „Änderungen speichern" |
| **A-06** | Mobile Kopfzeile (`< md`) mit Branding, Nutzername, „Admin-Panel" und **„Abmelden"**; Desktop-Sidebar unverändert, deren Beschriftung von „Logout" auf „Abmelden" vereinheitlicht | `App.tsx:167-196,242`, `frontend/tests/login.spec.ts:60,75` | Kopfzeile bei 390×844 sichtbar (46 px, beide Buttons im Viewport); Klick setzt das Token zurück und zeigt das Login-Overlay; Desktop: Kopfzeile `display: none`, Sidebar unverändert |
| **A-08** | `<html lang="de">` | `frontend/index.html:2` | `document.documentElement.lang === "de"` |
| **A-09** | `<title>ToolSync – Werkzeug- &amp; Lagerverwaltung</title>` | `frontend/index.html:7` | gemessen, kein „frontend" mehr im Tab-Titel |

### 1.2 Umsetzungsstand: Paket 2 erledigt

Fehlertexte und Löschbestätigung — nachgeprüft mit 12/12 Prüfungen (`.audit/verify-paket2.mjs`), Fehlerpfade per Request-Interception erzeugt, die Datenbank blieb unberührt:

| Befund | Änderung | Dateien | Verifikation |
|---|---|---|---|
| **A-02** | Entwicklertext entfernt: netzwerkseitiger Fehler lautet jetzt „Keine Verbindung zum Server. Prüfe das Netzwerk und versuche es erneut." | `lib/api.ts` (`request`, `getSerialArticlePdf`), `api/client.ts` | Route abgebrochen: angezeigt wird exakt dieser Satz, „Läuft das Backend" erscheint nicht mehr |
| **A-03** | **Ein** Fehler-Mapper für beide API-Module: deutsche Meldung je HTTP-Status mit nächstem Schritt; Backend-`detail` wird nur übernommen, wenn es ein verständlicher deutscher Satz ist (technische Marker wie `sqlalchemy`, `constraint`, `not found`, `missing`, `{…}`, `=` werden erkannt und ersetzt). Dazu die 6 englischen Backend-Meldungen auf Deutsch umgestellt | `lib/api.ts` (neu: `getErrorMessage`, `fallbackFor`, `isUserFacingDetail`), `api/client.ts`, `backend/app/routers/{serial_articles,tools,users}.py` | gemessen: 404 `"Tool not found"` → „Der Eintrag existiert nicht mehr. Lade die Liste neu." · 500 mit SQLAlchemy-Text → „Der Server konnte die Anfrage nicht verarbeiten. Versuche es später erneut." · 422 (Liste) → „Die Eingaben sind unvollständig oder ungültig …" · deutscher 400 (`Werkzeugtyp existiert bereits`) bleibt unverändert · Login-401 bleibt „Ungültige Personalnummer" (Testkompatibilität) |
| **A-04** | Neue Komponente `ConfirmDialog.tsx` im Glas-System (`role="dialog"`, `aria-modal`, `.modal-panel`, `.ui-btn-danger`), genutzt für Werkzeug, Lager-/Ersatzobjekt und Serienartikel; `alert()` durch `.ui-alert ui-alert-error` in der Liste ersetzt | `components/ConfirmDialog.tsx` (neu), `pages/Tools.tsx`, `components/tools/ToolList.tsx`, `components/storage/StorageItemList.tsx`, `components/serial-articles/SerialArticleList.tsx` | gemessen: kein nativer Browser-Dialog mehr, Titel `Werkzeug „01025000" löschen?`, Buttons `["Abbrechen","Werkzeug löschen"]`, Hintergrund `rgb(225,29,72)` für „Werkzeug löschen", Startfokus auf „Abbrechen", Escape schließt, Bestätigen löst genau einen DELETE aus |

Zusätzlich in Paket 2 aufgeräumt: die Fallback-Texte der Komponenten sind jetzt handlungsfähig statt „Unbekannter Fehler" / „Laden fehlgeschlagen." (`ToolList`, `StorageItemList`, `SerialArticleList`, `PDFViewer`, `LendModal`, `StorageItemForm`, `SerialArticleUpload`, `ToolForm`, `LoginForm`).

**Reste von A-04 (bewusst offen):** Das AdminPanel hat **6 eigene** `window.confirm`-Stellen (`AdminStorageLocations.tsx:682,770,859`, `AdminUsers.tsx:221`, `AdminStammdaten.tsx:247`, `AdminToolTypes.tsx:53`). Sie gehören zu System B und brauchen den Admin-Dialog (`.admin-modal` + `.admin-btn-danger`) — dafür ist eine Entscheidung nötig, ob eine zweite Dialog-Komponente im Admin-System entsteht.

### 1.3 Umsetzungsstand: Paket 3 erledigt (Design-System-Angleichung)

14/14 Prüfungen (`.audit/verify-paket3.mjs`), alle Werte gerendert gemessen:

| Befund | Änderung | Dateien | Verifikation |
|---|---|---|---|
| **K-01** | `@theme` folgt jetzt Guide §1.1: `--text #0f172a`, `--text-strong #0f172a`, `--text-muted #64748b`, `--success #10b981`, `--warning #f59e0b`, `--error #e11d48`. Die Logo-Verläufe bekommen dafür **feste** Werte (`#707070`/`#1a1a1a`), damit die Logos unverändert bleiben (Regel 11 §Logos) | `frontend/src/index.css:3-21,747-793` | Tokens gelesen: `#0f172a`/`#64748b`/`#10b981`/`#f59e0b`/`#e11d48`; Fließtext rendert `rgb(15,23,42)` (vorher `rgb(58,58,58)`) |
| **A-11/A-12** | Primärfarbe durchgängig `#0f766e`: „+ Anlegen", Drag-&-Drop-Rahmen, Icons, Akzentfarben von Radios/Checkboxen. `teal-500/600` im lebenden Code auf **0** reduziert (die 3 Reste liegen ausschließlich in der toten Datei `ToolFormModal.tsx`) | `index.css`, `App.tsx`, `Tools.tsx`, `ToolForm.tsx`, `SerialArticleUpload.tsx` | „+ Anlegen" rendert `rgb(15,118,110)` (= `#0f766e`) mit `font-weight 700` (vorher `#14b8a6`, 600) |
| **A-13** | Buttons auf Systemklassen: „+ Anlegen" und Formular-Aktionen nutzen `.ui-btn*`, Sidebar-Zeilen „Admin-Panel"/„Abmelden" `.ui-btn-ghost`, der Avatar `.ui-avatar`. `.ui-btn-ghost`, `.ui-btn-danger` und `.ui-avatar` waren vorher **nie benutzt** | `App.tsx`, `Tools.tsx`, `ToolForm.tsx` | Signatur der Sidebar: `ui-btn ui-btn-ghost ui-btn-sm w-full justify-start`, Gewicht 700, Radius 12 px; Avatar 32 × 32 px `rgb(15,118,110)`; Tabs rendern aktiv `bg #fff` / `color rgb(15,118,110)` / Gewicht **700** (vorher 600) / Radius **10,4 px** (vorher 12 px) — der Textbreiten-Sprung beim Umschalten ist damit weg |
| **A-14** | Registerwechsel hat nur noch ein Muster: Tabbar **und** Formular-Subnav nutzen `.ui-tabs` + `.is-active` (der Punktmarker und der `border-l-4`-Sonderfall sind entfallen) | `App.tsx:255-284`, `ToolForm.tsx:319-341` | 8 Tab-Buttons gemessen, alle `font-weight 700`; Streifen als `.ui-tabs` vorhanden |
| **A-18** | Press-Feedback für **alle** Button-Varianten mit exakt `scale(0.96)` (vorher nur Primary, und dort 0,97) | `index.css:229-262` | `transition-property` der Hauptaktion = `background-color, color, border-color, box-shadow, transform` |
| **A-19** | `transition: all` aus dem System entfernt: `.ui-btn`, `.glass-card`, `.tool-form-card`, `.glass-item` animieren nur noch ihre echten Properties. Im JSX der Hauptansichten kein `transition-all` mehr | `index.css` | gemessen (s. o.); im geprüften Umfang keine `transition-all`-Treffer außerhalb der Admin-Dateien |
| **A-30** | Statuspunkt erbt die Farbe seines Badges (`bg-current`) statt eigener Palettenfarben — vorher widersprach z. B. ein teal-farbener Punkt dem blauen `.ui-badge-info` („Ausgeliehen"). Die Funktion `statusDotClass` mit 5 Palettenfarben ist entfallen | `ToolList.tsx:88-102,203` | Punkt-Hintergrund `rgb(15,118,110)` == Badge-Textfarbe `rgb(15,118,110)` |
| — | Nebenbei: `!important`-Utilities am Anzahl-Feld entfernt (`!w-20 !py-1` → `w-20 py-1`), hartkodierte Fehlerbox im Werkzeugformular durch `.ui-alert ui-alert-error` ersetzt, `.icon`-Farbklasse von den Login-Tabs entfernt (Icon erbt jetzt `currentColor` des Tabs) | `ToolForm.tsx:376`, `:334-337`, `LoginForm.tsx:73,83` | Anzahl-Feld bleibt bei 80 px Breite / 4 px Padding (Utilities greifen ohne `!`) |

**Zahlen vorher → nachher** (aus `.audit/frontend-audit.mjs`):

| Kennzahl | vorher | nachher |
|---|---|---|
| Verwendungen von Guide-Klassen | 115 | **146** |
| Verschiedene genutzte Guide-Klassen | 31 | **34** |
| Definierte, aber nie benutzte Guide-Klassen | 18 | **15** |
| Rohe Tailwind-Palettenfarben (Haupt-Frontend) | 153 | **141** (davon 17 in der toten Datei `ToolFormModal.tsx`) |

Hinweise zum Lauf:
- `npm run lint` meldet **20 Probleme (18 Fehler, 2 Warnungen)** — unverändert zum Ausgangsstand. `npx tsc -b` läuft mit Exit 0.
- `npm run build` kann in der Sandbox nicht durchlaufen (`vite` scheitert beim Realpath-Aufruf an `spawn EPERM`).
- Der Working Tree enthielt **bereits vorher** unversionierte Änderungen (`admin.css`, Admin-Seiten, `MovementLog.tsx`, die beiden Styleguide-HTMLs). Diese Patches berühren davon nichts.
- Offenes Detail aus Paket 1: `.app-tabbar` bezeichnet jetzt zwei Elemente (Tab-Leiste und mobile Kopfzeile). Selektoren müssen `nav.app-tabbar` bzw. `header.app-tabbar` verwenden.
- **Neue offene Frage (K-07):** 119 der 141 Palettenfarben sind **Text-Grautöne** (`slate-700` 44×, `slate-500` 27×, `slate-900` 21×, `slate-600` 13×, `slate-800` 8×, `slate-400` 6×). Der Guide kennt nur **zwei** Textwerte (#0f172a, #64748b). Eine strikte Angleichung würde die Hierarchie auf zwei Ebenen reduzieren — das ist eine sichtbare Designentscheidung und wurde **nicht** eigenmächtig vorgenommen. Vorschlag: Guide um eine dokumentierte Staffelung ergänzen (z. B. Text #0f172a · Sekundär #334155 · Muted #64748b) und die Nutzung darauf abbilden.
- **Offen aus dem Audit, bewusst nicht angefasst:** Icons (**A-15/A-16/A-17**, warten auf **K-04/K-05**: Lucide vs. gemischt, Strichstärke 1,5 vs. 2), Beschriftungen (**A-10**), Platzhalterinhalte und Leerzustände (**A-27, A-28**), tote Datei und tote CSS-Blöcke (**A-39, A-40**), Admin-Panel-Befunde (**B-02, B-03**).
- **Beobachtung zur Testsuite:** `frontend/tests/login.spec.ts` sucht Felder per `getByLabel('Personalnummer')` und eine Überschrift „ToolSync Login" — beides existiert nicht (die Felder haben keine Labels, siehe A-10; die Überschrift lautet „Anmeldung"). Zusammen mit der fehlenden Personalnummer `1001` in `backend/toolsync.db` können diese E2E-Tests derzeit nicht grün sein. Kein UI-Befund, aber ein guter Anlass, die Suite nach A-10 neu zu verankern.

### 1.4 Umsetzungsstand: Paket 4 erledigt (Lesbarkeit & Zugänglichkeit)

14/14 Prüfungen (`.audit/verify-paket4.mjs`). Grundlage ist die **neue Guide-Sektion §1.8 „Textskala und Kontrast"** — die Erweiterung, für die du dich entschieden hast:

| Ebene | Wert | Tailwind | Kontrast (gemessen) | vorher im Einsatz |
|---|---|---|---|---|
| 1 — Text | `#0f172a` | `slate-900` | **14,3:1** | `#3a3a3a` (9,1:1) |
| 2 — Sekundär | `#334155` | `slate-700` | **8,3:1** | (bereits genutzt) |
| 3 — Gedämpft | `#475569` | `slate-600` | **6,0:1** | `#64748b` (3,8:1) und `slate-400` (2,1:1) |

| Befund | Änderung | Verifikation |
|---|---|---|
| **A-07** | 46 Textfarben auf die drei Ebenen abgebildet (`slate-400/500 → slate-600`, `slate-800 → slate-900`, `rose-500/600 → rose-700`, `emerald-700 → emerald-800`, `amber-700 → amber-800`). Vorher lagen sechs Grautöne und vier zu helle Statusfarben im Einsatz, alle unter 4,5:1 | `td` rendert `rgb(15,23,42)`, Tabelle `th` `rgb(69,85,108)` (6,0:1), nichts mehr unter 6:1 |
| **A-21** | `.ui-alert` von `.72rem` (11,5 px) auf **`.8rem` (12,8 px)** — im Guide dokumentiert, weil Fehlermeldungen der zuerst gelesene Text sind | gemessen `font-size: 12.8px`, Farbe `rgb(153,27,27)` = `#991b1b` |
| **A-22** | Eingabefelder auf `text-base sm:text-sm` (16 px mobil / 14 px ab `sm`), 14 Stellen; `.input-bordered` setzt bewusst keine Größe | Desktop 14 px, **Mobil 16 px für alle 13 Textfelder/Selects** (Radio/Checkbox ausgenommen – dort irrelevant) |
| **A-23** | 10 × `text-[10px]` auf `text-xs` (12 px) angehoben, u. a. die Prüfrückmeldung des Pflichtfelds und die Pflichtmarker | Hinweise rendern mit 12 px |
| **A-28 (Teil)** | Widerspruch behoben: Nach einem Ladefehler zeigte die Liste zusätzlich „Noch keine Werkzeuge vorhanden. Lege das erste Werkzeug an." — Fehler und Leerzustand schlossen sich gegenseitig aus | im Fehlerfall erscheint nur noch die Meldung (`hatLeerzustand: false, hatFehler: true`) |
| **K-01 Folge** | Vollständig aufgelöst: `--text-muted` ist jetzt Ebene 3 (`#475569`), `.ui-tabs`-Inaktivfarbe ebenfalls; Primary als **Text**-Rolle ist überall `#115e59` (aktiver Tab, Ghost-Button, Badge-Erfolg, Breadcrumb) — `#0f766e` bleibt für Flächen, Rahmen und Fokus | aktiver Tab `rgb(17,94,89)`, Badge `rgb(17,94,89)`, inaktiver Tab `rgb(71,85,105)` |

**Ergebnis der Palette:** Im lebenden Code sind nur noch die drei Textstufen, die vier Statusfarben und strukturelle Rahmen (`slate-200/300`) im Einsatz. Die verbliebenen `teal-500/600` und `rose-500` liegen **ausschließlich** in der toten Datei `ToolFormModal.tsx`.

**Werkzeug:** `.audit/codemod-text.mjs` (mit Probelauf ohne `--write`) listet jede Ersetzung mit Datei und Zeile — 70 Änderungen in 10 Dateien, nachvollziehbar im Log `.audit/codemod-text.dry.log`. `.audit/text-scale-check.mjs` berechnet die Kontrastwerte der Skala gegen die Glasflächen.

### 1.5 Umsetzungsstand: Paket 5 erledigt (A-10 — Beschriftungen)

Zuerst neu gemessen statt geschätzt: `.audit/a11y-labels.mjs` liest die **Browser-Semantik** (`el.labels` berücksichtigt auch umschließende Labels) in neun Ansichten und listet jedes Bedienelement ohne zugänglichen Namen. Ergebnis vorher: **Feld-Namen fehlten in Login (3), Listen (4), Werkzeugformular (14), Modalen (15)** und **2 Symbol-Buttons** („✕") waren unbeschriftet.

| Änderung | Dateien | Umfang |
|---|---|---|
| **Feld-Beschriftungen verknüpft:** `<label htmlFor>` + `id` statt bloßer Nachbarschaft — Werkzeugformular (Werkzeug-ID, Typ, Maß A/B, Werk, Status, Schrank, Schublade, Platz, Kunde, Maschine, Beschreibung, „Anzahl", Checkbox „Lager/Ersatz"), Lager-/Ersatz-Formular (7 Felder), Serienartikel-Upload (2 Felder), Ausleih-Dialog (2 Felder) | `ToolForm.tsx`, `StorageItemForm.tsx`, `SerialArticleUpload.tsx`, `LendModal.tsx` | **27** `htmlFor`/`id`-Paare (vorher 0 verknüpft) |
| **Login-Formular:** sichtbare Labels „Personalnummer" und „Passwort", Platzhalter nur noch als Beispiel („z. B. 4711") | `LoginForm.tsx` | 2 Felder – die E2E-Suite sucht genau diese beiden Namen per `getByLabel` |
| **Suchfelder und Filter** mit `aria-label` versehen (sie haben sichtbar nur den Platzhalter): Werkzeuge durchsuchen, Nach Kategorie filtern, Nach Status filtern, Lager/Ersatz durchsuchen, Serienartikel durchsuchen | `ToolList.tsx`, `StorageItemList.tsx`, `SerialArticleList.tsx` | 5 Elemente |
| **Modale sind jetzt Dialoge:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` auf die Überschrift; Schließen-Knöpfe mit `aria-label="Schließen"` und `aria-hidden` für das „✕"-Zeichen | `LendModal.tsx`, `StorageItemForm.tsx`, `SerialArticleUpload.tsx`, `PDFViewer.tsx` | 4 Modale, 3 Symbol-Buttons |
| **Escape schließt Overlays** — beim Messen entdeckt: die Modale ließen sich nur per Maus schließen. Gemeinsamer Hook `useEscapeKey` (blockiert während des Speicherns); `ConfirmDialog` nutzt ihn jetzt ebenfalls statt eigener Kopie | `frontend/src/lib/useEscapeKey.ts` (neu), 4 Modale, `ConfirmDialog.tsx` | 5 Stellen |
| Kleinere Korrekturen: Tabbar-`<nav>` mit `aria-label="Bereiche wechseln"`, Login-Button zeigt „Wird angemeldet …" statt „Anmelden..." | `App.tsx`, `LoginForm.tsx` | 2 Stellen |

**Verifikation (statisch, weil der Dev-Server zwischenzeitlich beendet wurde):** `.audit/check-label-pairs.mjs` prüft Paarigkeit und Eindeutigkeit ohne laufenden Server — **27 `htmlFor` ↔ 27 Feld-`id`s, 0 doppelte IDs, 0 Probleme**; Felder ohne `id` sind ausschließlich umschließend beschriftet (Radios, Checkbox) oder per `aria-label` benannt (Suchfelder) bzw. der versteckte Dropzone-Input. `npx tsc -b` Exit 0, Lint unverändert bei 20 Problemen.

> **Gerenderte Gegenprüfung (nachgeholt, Server liefen wieder):** `.audit/a11y-labels.mjs` über neun Ansichten — **0 Elemente ohne zugänglichen Namen** (vorher 37: 3 Login + 4 Listen + 14 Werkzeugformular + 15 Modale + 2 Symbol-Buttons), **0 doppelte DOM-IDs**, und **3/3 Escape-Prüfungen** bestanden (Ausleih-Dialog, Lager-/Ersatz-Formular, Serienartikel-Formular schließen sich per Escape). Gemessen wird die Browser-Semantik (`el.labels`), also genau das, was Screenreader als Feldnamen sehen.
>
> **Regression nachgeprüft:** Nach den Änderungen liefen alle früheren Suiten erneut — Paket 1 **10/10**, Paket 2 **12/12**, Paket 3 **14/14**, Paket 4 **14/14**. Zwei Erwartungen mussten dabei nachgezogen werden, weil Paket 4 die Guide-Werte bewusst geändert hat: aktiver Tab ist jetzt `#115e59` (nicht `#0f766e`) und inaktiver Tab `#475569` (nicht `#64748b`); im Login-Test greift jetzt `getByLabel('Personalnummer')` statt des Platzhalters, weil das Feld ein echtes Label hat. Dabei ist **Befund A-41** aufgefallen (10 ungenutzte `@theme`-Variablen).
>
> **Bewusst nicht umgesetzt:** Die Tab-Leiste ist weiterhin eine Gruppe von Buttons, kein vollständiges ARIA-Tabs-Muster (`role="tablist"`/`role="tab"`/`aria-selected` + `tabpanel`). Ein halbes Muster wäre für Screenreader schlechter als keines; das ist eine eigene Aufgabe mit Auswirkung auf die Tab-Unterstützung (Pfeiltasten).

### 1.6 Anforderung des Auftraggebers: Anlegen-Formular ohne Scrollen

Ausgangslage: Das Anlegen-Formular war bei 1440×900 um 69 px, bei 1280×800 um 217 px und bei 1366×768 um 249 px zu hoch. Zwei Entwürfe des Auftraggebers (`input_test.html`) zeigen Labels **im** Feld statt darüber. Entscheidungen: **Variante 2.1 „High Contrast"**, **nur dieser Hebel** (kein Raster-Umbau), **feste Tag-Breite 7,5 rem**.

| Änderung | Dateien | Umfang |
|---|---|---|
| Neue Systemklasse `.ui-field` (Guide **§1.9**): Das Feld ist eine **Glasfläche** (`rgba(255,255,255,.52)` + `blur(8px)` + weiße Kante `.75`) mit dem weichen Schatten der `.app-stat-card`; das Label darin ist **reiner Text** (Ebene 3 `#475569`, 12 px, semibold, Satzschreibung, feste Breite 7,5 rem), ohne Fläche, ohne Farbe, ohne Trennlinie. Hover/Fokus auf dem **Wrapper** (Fokus = Guide-Ring `#0f766e` + `box-shadow 0 0 0 3px rgba(15,118,110,.15)` **plus** Glas-Schatten); Zustände `.is-error`/`.is-ok` auf dem Wrapper; Wert-Text 16 px mobil / 14 px ab `sm` in der Klasse selbst | `index.css`, `docs/15-ui-styleguide.md` (§1.9) | 1 neue Klasse + 5 Zustandsregeln |
| Umgestellt: Werkzeug-ID, Werkzeug-Typ, Maß A, Maß B, Werk, Status, Kunde, Maschine | `ToolForm.tsx` | 8 Felder in 4 Reihen |
| Bewusst **nicht** umgestellt (in §1.9 als Ausnahmen dokumentiert): Beschreibung (`textarea`), „Anzahl" (schmales Inline-Feld), Schrank/Schublade/Platz | `ToolForm.tsx` | 3 Begründungen |
| Abweichungen von den Entwürfen korrigiert: Label ist ein **echtes `<label for>`** statt `<span>` (sonst wäre A-10 wieder offen), Schriftgrößen auf 12 px Label / 16 px mobil angehoben, Fokusfarben `#0284c7`/`#2563eb` auf `#0f766e`, kein Monospace global. **Beschriftung in Satzschreibung** statt Großbuchstaben (Wunsch des Auftraggebers) | `ToolForm.tsx`, `index.css` | — |
| **Kürzungswunsch umgesetzt** (Guide §1.9 Regel 12): Badge „nur freie Plätze" entfernt, Hinweissatz „Freie Plätze erscheinen nach der Wahl von Werk und Schublade." unter „Platz" entfernt, Tooltip am Feld „Anzahl" entfernt. Zusätzlich zwei weitere redundante Tooltips im Haupt-Frontend: `title="Löschen"` am Lösch-Button (der Knopf ist beschriftet) und `title` am Avatar (der Name steht daneben) | `ToolForm.tsx`, `ToolList.tsx`, `App.tsx` | −43 px Höhe |
| Tooltips, die **bleiben** (bewusst): abgeschnittener Text in der Lager-Liste (`title` auf der `truncate`-Zelle — die einzige Möglichkeit, den vollen Wert zu erreichen) und der `title` am PDF-`<iframe>` (das ist laut WCAG der zugängliche Name des iframes, kein Tooltip) | `StorageItemList.tsx`, `PDFViewer.tsx` | — |

**Farbanalyse zum Label** (`.audit/analyze-tag-color.mjs`, liest die gerenderten Flächen und rechnet WCAG-Kontraste): **Drei** Anläufe wurden vom Auftraggeber als „sticht heraus / passt nicht" zurückgewiesen — solider Neutralblock `#0f172a`, solider Primaryblock `#0f766e`, 12-%-Teal-Tönung. Die Messung zeigt, dass nicht der Farbton das Problem war, sondern das **Gewicht**:

| Variante | Abstand Label ↔ Feld | Ergebnis |
|---|---|---|
| Solider Block `#0f172a` | 14,2:1 | verworfen |
| Solider Block `#0f766e` | 4,92:1 | verworfen |
| Teal-Tönung 12 % | 1,17:1 | verworfen (immer noch ein „Kästchen") |
| **Reiner Text im Glas-Feld** | **1,14:1** (Feldfläche gegen Karte) | **umgesetzt** |

Zum Vergleich: Das System trennt seine eigenen Zustände mit **1,15–1,17:1** (Eingabefeld/Karte 1,15:1, aktiver Tab/Streifen 1,17:1, Badge-Tönung/Fläche 1,17:1). Alles darüber ist lauter als die Oberfläche selbst. Der endgültige Stand: das **Feld** trägt die Abgrenzung (Glasfläche `rgb(241,242,244)` gegen Karte `rgb(225,228,232)` = **1,138:1**), das **Label** trägt nur Typografie (Ebene 3 `#475569` gegen Wert `#0f172a`). Damit sind es **15/15 Prüfungen**. Die Abweichung von Guide §1.3 („kein `backdrop-filter` auf Inputs") ist in §1.9 Regel 7 dokumentiert.


**Messung** (`.audit/measure-anlegen.mjs`, `.audit/verify-field.mjs` — 12/12 Prüfungen):

| Fenster | Scrollbedarf vorher | nachher | Formularhöhe |
|---|---|---|---|
| 1920×1080 | 0 px | **0 px** | 710 → 604 px |
| 1440×900 | 69 px | **0 px** ✅ | 726 → 604 px |
| 1366×768 | 249 px | 126 px | 774 → 652 px |
| 1280×800 | 217 px | 94 px | 774 → 652 px |
| 390×844 | 1115 px | 927 px | 1241 → 1053 px |

Belegt außerdem: alle 8 Tags exakt 120 px breit, kein Tag-Text abgeschnitten, jedes Innenlabel per `for`/`id` verknüpft, Feldtext 14 px (Desktop) / 16 px (Mobil), Fokus rendert `border rgb(15,118,110)` + Ring, Tag rendert die 12-%-Tönung mit Text `#115e59` in **Satzschreibung**, Optionstexte aller Selects passen bei 1440 **und** 1280, **Regressionslauf Paket 3 14/14, Paket 4 14/14, A-10 weiterhin 0 Elemente ohne Namen / 0 doppelte IDs / Escape 3/3**, Lint unverändert auf Baseline.

**Warum die 3-Spalten-Reihe außen vor bleibt:** Mit dem 120-px-Tag blieben dem Select im Lagerplatz-Block nur **65 px** (bei 1280 px Breite 33 px), während „Bitte zuerst Schrank wählen" **142 px** braucht — die Abhängigkeitshinweise der drei Selects wären abgeschnitten gewesen. Erste Umsetzung hatte genau das; die Prüfung hat es aufgedeckt und die Reihe wurde auf Labels darüber zurückgenommen. Nach dem Entfall des Hinweissatzes unter „Platz" sind die drei Selects zusätzlich breiter geworden (177 px bei 1440).

**Noch offen für kleinere Laptops** (auf Wunsch nicht umgesetzt, Bedarf jetzt 94–126 px): 3-spaltiges Raster für die Feldreihen (≈110 px), „Zuordnung (Kunde/Maschine)" in das Haupt-Raster statt eigener Block (≈44 px), Block-Innenabstände `p-3`→`p-2.5` und `space-y-4`→`space-y-3` (≈34 px) — zusammen ≈188 px, womit auch 1280×800 und 1366×768 ohne Scrollen auskämen. Auf dem Telefon bleibt Scrollen bei 13 Feldern unvermeidbar.

### 1.7 Umsetzungsstand: Werkzeugliste neu gebaut (TASK-014)

Die Werkzeugliste wurde vollständig ersetzt (Suche, Filter, Sortierung, Favoriten, Pagination; Details in `docs/05-tools.md` §6/§7). Tabelle und Kopfzeile folgen den beiden Tabellen-Varianten des Styleguides („Tabellen & Status Badges" und „Werkzeugübersicht – Variante 2": zweizeilige Zellen, Ampel-Unterzeile, `.glass-preview-card` als Rahmen, Aktionsspalte mit `…`-Menü) sowie nativem Kopfzeilenfilter (Kategorie als Kontrollkästchen, Werk als Radio, Favoriten). Damit sind fünf Befunde dieses Audits erledigt:

| Nr | Befund | Lösung | Beleg |
|---|---|---|---|
| **A-16** | Handgebaute Inline-SVGs ohne Pflichtattribute; `SearchIcon` ungenutzt | Das Suchfeld nutzt `SearchIcon` aus `components/icons.tsx`; für Sortierung, Favoriten, Chips, Pagination und Filter kamen **11 neue Icons** im selben Modul dazu (vollständiger Attributsatz nach Guide §1.7) | `components/icons.tsx`, `ToolFilterBar.tsx`, `ToolTable.tsx`, `ToolPagination.tsx` |
| **A-24** | Kein Hinweis auf den seitlichen Scroll; „Aktionen" unsichtbar | Der Überlauf wird per `ResizeObserver` **gemessen**; nur wenn die Tabelle wirklich überläuft, erscheint „Tabelle seitlich scrollbar …". Umgesetzt nach der Empfehlung dieses Audits (Hinweis auf den Scrollbereich) – **keine** fixierte Spalte: sie lag über den übrigen Zellen und brauchte eine deckende weiße Fläche, die aus der Glasliste herausfiel. Nach dem Spaltenumbau passt die Tabelle bei 1440×900 ohne Scrollen (gemessen 815 px Platz bei 660 px Mindestbreite) | `.audit/shots/wt-10-telefon.png`, `wt-09-1440.png`, `ToolTable.tsx` |
| **A-25** | 8 px zwischen „Bearbeiten" und „Löschen" | Aktionsgruppe mit `gap-2` (12 px) | `ToolTable.tsx` |
| **A-28** | Leerzustand ohne Suchbegriff und ohne Ausweg | Drei getrennte Zustände: keine Daten („Noch keine Werkzeuge vorhanden" + Knopf „Werkzeug anlegen"), keine Treffer („Keine Treffer für „xyz"" + „Alle Filter zurücksetzen"), leere Seite („Diese Seite ist leer" + „Zur ersten Seite"). Zusätzlich zeigt eine Chip-Zeile jeden gesetzten Filter mit Einzel-Entfernen | `.audit/shots/wt-04-kein-treffer.png`, `ToolList.tsx`, `ToolFilterBar.tsx` |
| **A-33** | `tracking-wider` fehlte in zwei von drei Tabellenköpfen | Die neue Werkzeugtabelle setzt es in allen sortierbaren Köpfen (die anderen beiden Tabellen bleiben offen) | `ToolTable.tsx` |

Zusätzlich adressiert: Der Fokus bleibt auf den 30-px-Knöpfen der Blätterleiste sichtbar (`.ui-pagination :focus-visible`), und die Blätterleiste bekam einen deaktivierten Zustand — der Guide kannte keinen (dort nachgetragen, §1.6).

**Nachtrag (nach der Sichtprüfung durch den Auftraggeber):** Die Tabelle wurde nach den beiden Tabellen-Varianten des Guides neu aufgebaut (zweizeilige Zellen, Glasrahmen, `…`-Menü, das nach links ausfährt) und die Statusspalte entfiel — sie stand fast immer auf „Ohne Status“ und wiederholte bei ausgeliehenen Werkzeugen nur das Badge. Aktions-Rückmeldungen laufen jetzt als **Toast** (`.ui-toast-stack`, Guide „Feedback“), nicht mehr als Meldung im Block.

> **Zwei Fallen, die dabei aufgefallen sind (beide betreffen das Glas-System):**
>
> 1. **`backdrop-filter` bricht `position: fixed`.** Ein Element mit `backdrop-filter`
>    wird zum Bezugsrahmen für absolut/fixiert positionierte Nachfahren. Das
>    Zeilenmenü saß dadurch verschoben in der Tabellenzelle (gemessen ~290 px
>    daneben), der Toast landete unten rechts im *Block* statt im Fenster — also
>    außerhalb des Bildes. Beide hängen jetzt in einem Portal an `<body>`.
> 2. **`sr-only` auf einer Eingabe macht sie unklickbar.** Schrumpft die Eingabe
>    auf 1×1 px, liegt das umschließende Label darüber und fängt jeden Klick ab
>    (Klick-Automatisierung scheitert mit „label intercepts pointer events“).
>    Die segmentierten Filter nutzen deshalb eine transparente Fläche
>    (`absolute inset-0 opacity-0`) als Klickziel bei gleicher Semantik.
>
> Beide Prüfungen sind als Test festgehalten (Position des Menüs und des Toasts
> werden im Browser **gemessen**), damit sie nicht zurückkommen.

> **Nachtrag 2 (Kunde/Maschine):** `Tool.machine` war nicht eager geladen —
> ein Zugriff auf `tool.machine` hätte pro Zeile eine eigene Abfrage ausgelöst.
> Die Beziehung ist jetzt `lazy="joined"` (n:1, keine doppelten Zeilen), Kunde
> und Maschine stehen als Spalte in der Liste und sind sortier- und suchbar.
> Der frühere offene Punkt „Farbanzeige aus `tool.customer.color`" ist damit
> umgesetzt — der Punkt vor dem Kundennamen kommt aus den Stammdaten.

> **Zur Sichtprüfung:** Der Agent konnte die Screenshots in `.audit/shots/`
> nicht selbst ansehen (das Modell nimmt keine Bilder entgegen). Belegt sind
> **gerenderte Kennzahlen** aus dem Browser: Spaltenbreiten und Überlauf,
> berechnete Schriftgrößen und Farben (ID-Markierung 14 px mit
> `teal-700/30`-Kante, Kategorie-Chip dreifach unterschiedlich gefärbt,
> Kundenpunkt `rgb(2, 242, 222)`), Positionen von Menü und Toast. Die optische
> Abnahme bleibt beim Auftraggeber.

**Zwischenzeitlich erledigt (TASK-016):** Der Serienartikel-Bereich nutzt die neuen Bausteine jetzt – Suche über Artikelnummer, Name, Beschreibung, Werk, Kunde und Maschine (serverseitig), Sortierung über die Spaltenköpfe mit `aria-sort`, Blätterleiste (`ToolPagination`, dafür um Beschriftungen erweitert) mit Gesamtzahl, Leerzustände mit „Filter zurücksetzen" und Aktions-Rückmeldungen als Toast. Damit sind die Serienartikel-Anteile von **A-25** (Aktionsabstand), **A-28** (Leerzustand mit Suchbegriff und Ausweg), **A-33** (`tracking-wider` im Tabellenkopf) und **A-38** („PDF ansehen", „Andere PDF wählen") erledigt; **A-17** (Unicode-Glyphen `✕`/`×` statt Icons) bleibt offen, weil die Entscheidung K-04/K-05 zum Icon-Satz weiter fehlt. Die Löschbestätigung liegt jetzt in einem **Portal an `<body>`** (`.app-content-block` mit `backdrop-filter` war Bezugsrahmen für `position: fixed`). **„Lager/Ersatz"** hat weiterhin Suchfeld und Filterung im Browser ohne Pagination; die Bausteine sind dafür ausgelegt, die Umstellung ist eine eigene Aufgabe.



---

## 2. Befunde Haupt-Frontend (System A „Glas“)

> Die Tabellen unten sind der **Befundstand des Audits**. Was davon bereits behoben ist, steht in §1.1 (Paket 1), §1.2 (Paket 2), §1.3 (Paket 3), §1.4 (Paket 4), §1.5 (Paket 5) und §1.7 (Werkzeugliste, TASK-014): A-01 bis A-09, A-10, A-11 bis A-14, A-16, A-18, A-19, A-21 bis A-23, A-24, A-25, A-28, A-30, A-33.

### 2.1 HIGH — blockiert Nutzer oder führt sie in die Irre

| Nr | Ort | Ist | Soll | Warum |
|---|---|---|---|---|
| A-01 | `frontend/src/components/storage/StorageItemForm.tsx:63-64`, `frontend/src/components/serial-articles/SerialArticleUpload.tsx:66-67`, `frontend/src/components/movements/LendModal.tsx:47-48` | **rendered gemessen:** Bei 390×844 passt das Panel (738 px, „Speichern" sichtbar). Bei **375×667** (iPhone SE) steht `panelTop = -36`: die **Überschrift ist abgeschnitten und nicht in den Blick scrollbar** (`titleTop = -11`), und der Speichern-Knopf bleibt mit `saveBottom = 678` unterhalb des Viewports — auch nach dem Scrollen im Overlay (`overlayScrollHeight 703` vs. `clientHeight 667`, `panelTopNow` unverändert −36). Bei 360×640 und 390×560 (Tastatur offen) identisch: `overflows: true`, `saveInViewport: false` | Panel begrenzen und innen scrollen lassen: `modal-panel … max-h-[100dvh] overflow-y-auto`, Overlay `items-start overflow-y-auto py-4` (statt `items-center`) | Auf kleinen Telefonen und bei eingeblendeter Tastatur ist das Lager-Formular höher als der Bildschirm. Der Kopf (Titel + Schließen) verschwindet oben **ohne Scrollmöglichkeit nach oben**, die Aktionszeile bleibt unterhalb — der Nutzer sieht weder wo er ist noch wie er speichert (better-layout #10). Belege: `.audit/shots/modal-375x667-ungescrollt.png`, `modal-375x667-gescrollt.png`, `modal-390x420.png` |
| A-02 | `frontend/src/lib/api.ts:44`, `frontend/src/api/client.ts:33` | `'Keine Verbindung zum Server. Läuft das Backend?'` | „Keine Verbindung. Prüfe das Netzwerk und versuche es erneut." | Die Fehlermeldung richtet sich an Entwickler, nicht an den Werker. „Läuft das Backend?“ ist für den Nutzer keine Information und keine Handlungsanweisung (better-writing #10). |
| A-03 | `frontend/src/lib/api.ts:29-37`, `frontend/src/api/client.ts:6-17` mit Backend `backend/app/routers/tools.py:147,177`, `backend/app/routers/serial_articles.py:39,41,45`, `backend/app/routers/users.py:32,57` | `getErrorMessage` gibt `detail` **unverändert** zurück (`if (typeof detail === 'string' && detail) return detail`), Backend liefert englische Sätze: `"Tool not found"`, `"Serial article not found"`, `"PDF file is missing on the server"` | Deutsche, handlungsfähige Sätze im Frontend, z. B. „Werkzeug existiert nicht mehr. Lade die Liste neu." / „Für diesen Artikel ist kein PDF hinterlegt. Lade es über „Serienartikel anlegen" hoch." | In der deutschsprachigen Oberfläche erscheint an der Stelle, an der Handlung fehlt, ein englischer Servertext. Zusätzlich haben `lib/api.ts` und `api/client.ts` **unterschiedliche** 401-Texte („Ungültige Personalnummer oder Passwort“ vs. „Nicht angemeldet oder Sitzung abgelaufen.") für denselben Zustand (better-writing #10). |
| A-04 | `frontend/src/pages/Tools.tsx:41,48`; `frontend/src/components/storage/StorageItemList.tsx:36`; `frontend/src/components/serial-articles/SerialArticleList.tsx:54` | **rendered bestätigt:** Klick auf „Löschen" öffnet einen nativen Browser-Dialog — abgefangen als `{ type: 'confirm', message: 'Werkzeug wirklich löschen?' }`. Dazu `alert('Löschen fehlgeschlagen. Bitte erneut versuchen.')` (`Tools.tsx:48`) | Bestätigung als `.modal-overlay` + `.modal-panel` (existiert im Guide), Titel „Werkzeug „TS-1004" löschen?", Konsequenz im Text, `.ui-btn-danger` „Werkzeug löschen" / `.ui-btn-secondary` „Abbrechen"; Fehler als `.ui-alert ui-alert-error` in der Liste | Der native Dialog bietet nur „OK"/„Abbrechen": die Konsequenz steht nicht auf dem Button, und beim Werkzeug wird nicht einmal benannt, welches Objekt verschwindet. `alert()` fällt aus dem Muster aller übrigen Rückmeldungen heraus (better-writing #5/#11). |
| A-05 | `frontend/src/components/tools/ToolForm.tsx:669` im Kontext der Überschrift `frontend/src/pages/Tools.tsx:72` | `{saving ? 'Wird gespeichert …' : 'Anlegen'}` — der Button sagt „Anlegen“, während die Überschrift „Bearbeiten" lautet | `{saving ? 'Wird gespeichert …' : initial ? 'Änderungen speichern' : 'Werkzeug anlegen'}` | Im Bearbeiten-Modus fürchtet der Nutzer berechtigt, mit „Anlegen" ein zweites Werkzeug zu erzeugen. Der Button benennt nicht seine tatsächliche Konsequenz (better-writing #5). |
| A-06 | `frontend/src/App.tsx:169` (`<aside className="app-sidebar hidden md:flex …">`), darin `:203-217` (Admin-Panel, Logout) und `:188-201` (Benutzername) | **rendered gemessen bei 390×844:** `sidebarDisplay: "none"`, `logoutVisible: 0`, `adminPanelVisible: 0` — die Buttons existieren im DOM, sind aber unsichtbar und nicht anklickbar. `grep md:hidden` findet im gesamten Haupt-Frontend **keine** mobile Alternative | Mobile Kopfzeile mit Nutzername, „Abmelden" und (für Admins) „Admin-Panel", oder Sidebar als aufklappbares Panel | Auf Telefon/Tablet gibt es **keinen Weg zum Abmelden** und keine Anzeige, wer angemeldet ist — bei geteilten Werkstatt-Geräten bleibt die Sitzung des Vorgängers offen (better-layout #8/#10). Beleg: `.audit/shots/rendered-2-mobil-390.png` |

### 2.2 MEDIUM — Lesbarkeit, Sprache und Zugänglichkeit

| Nr | Ort | Ist | Soll | Warum |
|---|---|---|---|---|
| A-07 | Berechnet aus den echten Farbwerten (`.audit/contrast.mjs`), Fläche `.app-content-block` = `rgb(227,230,233)` | `text-slate-400` **2,10:1** (6×), `text-teal-600` **2,92:1** (5×), `text-rose-500` **3,00:1** (7×), `text-rose-600` **3,60:1** (3×), `text-slate-500` **3,81:1** (29×), `text-teal-700` **4,30:1**, `--text-muted #707070` **3,95:1** | Für Text < 18,66 px mindestens 4,5:1: `text-slate-600` (6,04:1) bzw. `text-slate-700` (8,26:1) statt `slate-500`; für Statusfarben die Guide-Töne (`#0f766e`, `#92400e`, `#9f1239`) | Die am häufigsten verwendete Sekundärfarbe (`slate-500`, 29×, überwiegend bei 12–14 px) und die Status-Iconfarben liegen unter der Grenze für kleinen Text — Fehlermeldungen und Hinweise werden im Werkstattlicht schlecht gelesen (better-typography #16). |
| A-08 | `frontend/index.html:2` | `<html lang="en">` bei rein deutschsprachiger Oberfläche | `<html lang="de">` | Falsche Sprachgrundlage für Silbentrennung, Vorleseaussprache (Screenreader) und Übersetzungshilfen (better-typography #18). |
| A-09 | `frontend/index.html:7` | `<title>frontend</title>` (Template-Standardwert) | `<title>ToolSync – Werkzeug- & Lagerverwaltung</title>` | Der Browser-Tab, der Verlauf und jedes Lesezeichen heißen „frontend" — der Nutzer kann mehrere Tabs nicht unterscheiden. |
| A-10 | 36 `<label>` im Haupt-Frontend, **0 mit `htmlFor`**; 44 Felder ohne `aria-label`/`aria-labelledby`; insgesamt **1** `aria-label` im ganzen Haupt-Frontend; Platzhalter-Glyphen `×`/`✓` als Status- und Schließen-Symbole (`LoginForm.tsx:131`, `ToolList.tsx:154,161`, `LendModal.tsx:52`, `StorageItemForm.tsx:69`) | z. B. `ToolForm.tsx:396-407` (`<label className="font-semibold text-xs …">` + `<input …>` ohne `id`), `LendModal.tsx:71-79` | `id` + `<label htmlFor>` oder `aria-label`; Schließen-Knopf mit `aria-label="Schließen"`, Statuszeichen als Icon aus `components/icons.tsx` | Kein Feld hat einen programmatisch zugeordneten Namen: Screenreader lesen „Eingabefeld" ohne Bezeichnung vor, und ein Klick auf das Label fokussiert das Feld nicht (better-writing #12, better-ui #13/#14). |

### 2.3 MEDIUM — Abweichung vom Guide (System A)

| Nr | Ort | Ist | Soll (Guide / Regel 11) | Warum |
|---|---|---|---|---|
| A-11 | 11 Stellen, u. a. `frontend/src/App.tsx:247-251`, `frontend/src/components/tools/ToolForm.tsx:667`, `frontend/src/components/ToolFormModal.tsx:248`, `frontend/src/pages/Tools.tsx:69`, `frontend/src/components/auth/LoginForm.tsx:73` | **rendered gemessen:** „+ Anlegen" liefert `background: oklch(0.704 0.14 182.503)` = `#14b8a6` (tailwind `teal-500`) und `font-weight 600`; unmittelbar daneben liefert `.ui-btn-primary` („Ausleihen") `rgb(15, 118, 110)` = `#0f766e` und `font-weight 700` | Primary `#0f766e` (= `teal-700`, `rgb(0,120,111)`); Hover `#115e59` (`teal-800`) | Auf **einem** Bildschirm hat die Hauptaktion „+ Anlegen" eine andere Farbe als „Ausleihen"/„Speichern". Zwei Grüntöne für dieselbe Aktionsrolle lesen Nutzer als zwei Bedeutungen (Regel 11 „Farben", better-ui). |
| A-12 | 153 rohe Palettenfarben im Haupt-Frontend (`slate-700` 45×, `slate-500` 29×, `slate-900` 19×, `slate-600` 12×, `slate-800` 9×, `rose-500` 7×, `slate-400` 6×, …) gegenüber 115 Verwendungen von Guide-Klassen | Die Oberfläche wird überwiegend mit rohen Tailwind-Utilities gebaut | Guide-Klassen `.ui-*`, `.app-*`, `.glass-*` + `index.css`-Tokens | Die verbindlichen Werte des Systems (Rundungen, Gewichte, Schatten, Hover-Zustände) werden an der Verwendungsstelle neu erfunden, statt aus dem System zu kommen — daher weichen dieselben Elemente über die App hinweg voneinander ab. |
| A-13 | 15 von 31 `<button>` ohne Guide-Klasse, u. a. `frontend/src/App.tsx:203,211,233,245`, `frontend/src/components/tools/ToolForm.tsx:657,664`, `frontend/src/pages/Tools.tsx:74`, `frontend/src/components/movements/LendModal.tsx:51` | `bg-teal-500 hover:bg-teal-600 text-white **font-semibold** py-2 rounded-xl text-xs transition-all shadow-md … **disabled:opacity-50**` sowie rahmenlose Textbuttons als Zeilen. **rendered gemessen:** „Admin-Panel"/„Logout" sind `bg: rgba(0,0,0,0)`, `border-radius: 0px`, `font-weight 500` — optisch identisch mit der statischen Profilzeile darüber (`cursor-help`), während die Guide-Buttons `font-weight 700` tragen | `.ui-btn ui-btn-primary` — `border-radius .75rem`, `padding .55rem .9rem`, `font-size .75rem`, **`font-weight 700`**, `:disabled opacity .45` (§1.4) | Die handgebauten Buttons haben Gewicht **600 statt 700**, `disabled:opacity-50` statt `0.45`, `transition-all` statt exakter Properties und keine Hover-/Press-Sprache der Guide-Klassen. Sichtbare Folge: „+ Anlegen" und „Anlegen" sehen anders aus als „Ausleihen" und „Speichern"; die Sidebar-Zeilen sind nicht als Bedienelemente erkennbar (better-layout #2). |
| A-14 | Dasselbe Konzept „Registerwechsel" hat **drei** Umsetzungen: `.ui-tabs` (`frontend/src/components/auth/LoginForm.tsx:66-87`), handgerollte Tabbar (`frontend/src/App.tsx:28-33,228-256`), handgerollte Subnav mit Punktmarker (`frontend/src/components/tools/ToolForm.tsx:305-313,318-335`) | Unterschiedliche Abstände (4 px vs. 6,4 px), Radien (12 px vs. 12,8 px), Aktiv-Flächen (`bg-white/80` vs. `#fff`) und Schriftgewichte (500 → 600 beim Aktivieren, dadurch Textbreiten-Sprung). **rendered gemessen:** aktiver Tab `font-weight 600`, `border-radius 12px`, `background rgba(255,255,255,0.8)`; inaktiver Tab `font-weight 500`; Guide-Vorgabe `.ui-tabs button` wäre Gewicht **700**, Radius **10,4 px**, aktiv **`#fff`** — und die Login-Tabs rendern genau so | Überall `.ui-tabs` mit `.is-active` (§1.5: `#fff`/`#0f766e`, konstantes `font-weight 700`) | Dasselbe Bedienkonzept sieht an drei Orten unterschiedlich aus und springt beim Umschalten in der Textbreite (better-ui „Ein Muster pro Konzept", Guide §1.5). |
| A-15 | `frontend/src/components/icons.tsx` — 11 von 12 Icons, z. B. `:29,48,70,91,110,131,151,170,192,211,232` | `strokeWidth="1.5"` (11×) neben `strokeWidth="2"` (1×, `ToolIcon`) | `stroke-width="2"` **für alle Icons** (§1.7 / Regel 11 „Pflichtattribute"): `xmlns`, `width="24"`, `height="24"`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"` | Auf derselben Fläche stehen Strichstärken 1,5 und 2 nebeneinander; Icons wirken je nach Herkunft unterschiedlich schwer (Regel 11, better-ui #13). |
| A-16 | `frontend/src/pages/Tools.tsx:69-71,79-81`, `frontend/src/components/tools/ToolList.tsx:105-117` | Handgebaute Inline-SVGs (Heroicons-Pfade), denen `xmlns`, `width="24"`, `height="24"`, `strokeLinecap`, `strokeLinejoin` fehlen; `SearchIcon` existiert in `components/icons.tsx:108`, wird aber nicht benutzt | Ausschließlich Icons aus `components/icons.tsx` mit vollständigem Attributsatz | Pflichtattribute fehlen (Regel 11 §Icons) und es entsteht ein zweiter Icon-Vorrat neben dem gepflegten Modul (better-ui #13 „ein Icon-Set"). |
| A-17 | `frontend/src/components/movements/LendModal.tsx:52`, `frontend/src/components/storage/StorageItemForm.tsx:69`, `frontend/src/components/serial-articles/SerialArticleUpload.tsx:70`, `frontend/src/components/ToolFormModal.tsx` | Unicode-Glyphen `✕`, `×`, `✓` als Schließen- und Statussymbole | Icons aus `components/icons.tsx` als Inline-SVG mit `currentColor` | Die Glyphen werden aus der Systemschrift gerendert (Größe, Strichstärke, Grundlinie je Plattform verschieden), gehören zu keinem Set, und das `×` in einer Fehlermeldung liest sich wie ein Schließen-Knopf (better-ui #13/#14). |
| A-18 | `frontend/src/index.css:227-294` | Nur `.ui-btn-primary:active { transform: scale(0.97) }`; `.ui-btn-secondary/-ghost/-danger/-danger-soft` haben **keinen** Press-Zustand | `scale(0.96)` (genau dieser Wert) auf allen Button-Varianten | Nur „Ausleihen" reagiert auf den Druck — „Bearbeiten", „Löschen", „Abbrechen" und „+ Anlegen" nicht; der eine vorhandene Wert weicht zusätzlich vom festgelegten `0.96` ab (better-ui #9). |
| A-19 | `transition-all` / `transition: all` an 9 Stellen: `frontend/src/index.css:129,163,238`, `frontend/src/App.tsx:29,247`, `frontend/src/pages/Tools.tsx:77`, `frontend/src/components/tools/ToolForm.tsx:306,660,667` | `transition: all 0.18s ease` (`.ui-btn`), `@apply … transition-all …` (`.glass-card`), `transition: all 0.2s ease-in-out` (`.tool-form-card`), `transition-all` in JSX | Exakte Properties: `transition-property: background-color, color, box-shadow, transform` bzw. Tailwinds `transition-colors` / `transition-transform` | `transition: all` animiert auch Layout- und Paint-Properties, die sich nie ändern; jeder Zustandswechsel erzeugt unnötige Style-/Paint-Arbeit und macht die Bewegungsabsicht unlesbar (better-ui #11). |
| A-20 | `frontend/src/index.css:63-71` und `:581-584` | Jede Glasfläche bekommt `isolation: isolate; contain: layout style paint; transform: translateZ(0);` — dauerhaft | Layer-Promotion nur bei tatsächlich beobachtetem First-Frame-Stutter, gezielt per `will-change: transform` | Alle Glasflächen hängen permanent in eigenen Compositor-Ebenen: GPU-Speicher, abweichende Text- und Blur-Rasterung. `will-change` kommt im Projekt an keiner Stelle vor (better-ui #12). |
| A-21 | `frontend/src/index.css:334` (`.ui-alert { font-size: 0.72rem; }`), verwendet in `ToolList.tsx:160`, `StorageItemList.tsx:59`, `SerialArticleList.tsx:81`, `LoginForm.tsx:130`, `PDFViewer.tsx:94`, `StorageItemForm.tsx:160`, `LendModal.tsx:93`, `SerialArticleUpload.tsx:132` | Jede Fehler- und Erfolgsmeldung rendert mit **11,5 px** | `text-sm` (14 px) am Verwendungsort bzw. Anhebung im Guide | Die Meldung, die am schnellsten gelesen werden muss, ist der kleinste Text der Oberfläche. **Achtung Konfliktregel:** der Guide schreibt `.72rem` selbst vor → zu melden, nicht eigenmächtig zu ändern (siehe §4). |
| A-22 | `frontend/src/components/tools/ToolForm.tsx:57-58` (`inputClass`/`selectClass`), `:380`, `:400,426,447,468,490,510,546,561,576,610,623`, `ToolList.tsx:123,129,141`, `StorageItemList.tsx:54`, `StorageItemForm.tsx:60`, `SerialArticleList.tsx:76`, `SerialArticleUpload.tsx:63`, `LendModal.tsx:18` | Feldtexte mit `text-xs` (12 px) bzw. `text-sm` (14 px); `.input-bordered` setzt selbst keine Größe (`index.css:169-182`) | `text-base sm:text-sm` (16 px mobil, 14 px ab `sm`) | iOS Safari zoomt beim Fokussieren die ganze Seite, sobald Feldtext < 16 px ist — auf dem Werkstatt-Tablet verschiebt sich das Layout bei jedem Tippen (better-typography #15). |
| A-23 | `frontend/src/components/tools/ToolForm.tsx:387,397,415,418,421,444,465,588,594,605` | 10 Stellen mit `text-[10px]`, u. a. die Live-Prüfrückmeldung zur Pflicht-ID (`:415,418`) und die Pflichtmarker (`:397,444`) | Prüfrückmeldung `text-sm`, übrige Hinweise `text-xs` (12 px Untergrenze) | Ausgerechnet das Ergebnis der Pflichtfeld-Prüfung ist der kleinste Text der Seite (better-typography #16). |
| A-24 | `frontend/src/components/tools/ToolList.tsx:178-179`; `frontend/src/components/storage/StorageItemList.tsx:77-78`; `frontend/src/App.tsx:229` | `<div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">` um `<table className="w-full min-w-[760px] whitespace-nowrap …">` bzw. `min-w-[800px]` — ohne Scroll-Andeutung. **rendered gemessen bei 390×844:** Tab-Leiste `scrollWidth 363` vs. `clientWidth 235`; „Lager/Ersatz" ragt über die Kante hinaus, **„Historie" liegt vollständig außerhalb** (links 321 px bei Strip-Ende 264 px) und existiert damit nur als Scrollziel ohne Hinweis | Scrollbereich erkennbar machen: Spalte anschneiden (Peek), Hinweis „seitlich scrollen" oder Scroll-Schatten; Tab-Leiste umbrechen (`flex-wrap`) | Die Kante sieht wie das Ende aus: Auf dem Telefon sind **zwei von vier Hauptnavigationseinträgen nicht sichtbar**, und in der Werkzeugliste ist die Spalte „Aktionen" (Bearbeiten/Löschen/Ausleihen) verborgen. Eine einzige lange Beschreibung schiebt sie zusätzlich aus dem Sichtfeld, weil die ganze Tabelle `whitespace-nowrap` trägt (better-layout #5/#10, better-typography #12). Beleg: `.audit/shots/tabbar-390.png` |
| A-25 | `frontend/src/components/tools/ToolList.tsx:226,233` (`mr-2`), `frontend/src/components/storage/StorageItemList.tsx:118`, `SerialArticleList.tsx:127` (`gap-2`) | 8 px zwischen „Ausleihen", „Bearbeiten" und „Löschen" | 12 px zwischen gerahmten/gefüllten Controls | Direkt neben der destruktiven Aktion liegt der Nachbarknopf nur 8 px entfernt — auf einem Werkstatt-Tablet mit Handschuhen zu nah (better-layout #6). |
| A-26 | `frontend/src/App.tsx:228` (Tabbar mit „+ Anlegen”), `:169` (Sidebar-Fuß mit „Admin-Panel"/„Logout") | Kein `sticky`; bei langer Werkzeugliste scrollen Tabbar und Sidebar-Fuß aus dem Bild (`grep sticky` findet im Haupt-Frontend keinen Treffer, im AdminPanel schon) | Tabbar `sticky top-0 z-20`, Sidebar-Fuß dauerhaft erreichbar | Zwei Daueraufgaben des Chromes hängen an der Listenlänge; nach 30 Werkzeugen ist „+ Anlegen" nicht mehr sichtbar (better-layout #8/#10). |
| A-27 | `frontend/src/App.tsx:295` + `:39-48`; `frontend/src/App.tsx:56,60,64,68`; `frontend/src/components/tools/ToolForm.tsx:675-694` | Der Hauptnavigationseintrag „Historie" führt in einen Platzhalter: „Dieser Bereich folgt in einem späteren Schritt." Vier Kennzahlkarten zeigen dauerhaft „—". Drei Sub-Reiter des Anlege-Formulars („Serienartikel", „Info / Hilfe", „Lager / Ersatz") zeigen nur Stichpunkte | Historie aus `TABS` nehmen, bis es sie gibt (oder Aussage mit Rückweg); Kennzahlen mit „Noch keine Daten" bzw. `.ui-skeleton` beim Laden; Sub-Reiter erst zeigen, wenn befüllbar | Ein Hauptnavigationseintrag führt in eine Sackgasse; dieselbe Karte „—" hat drei Bedeutungen (lädt / leer / fehlt) — der Nutzer kann sie nicht unterscheiden (better-writing #11, Regel §1.6 `.ui-skeleton` existiert, wird nie benutzt). |
| A-28 | `frontend/src/components/tools/ToolList.tsx:172-176`, `StorageItemList.tsx:73-74`, `SerialArticleList.tsx:96-97` | „Keine Werkzeuge für die aktuellen Filter gefunden." — ohne Suchbegriff und ohne Ausweg; Erstbefüllung nur als Satz („… Lege das erste Werkzeug an.") | Gefiltert: `Keine Treffer für „${search}"` + Button „Filter zurücksetzen"; Erstbefüllung: Überschrift + Orientierungssatz + Button „Werkzeug anlegen" | Bei aktiver Suche erfährt der Nutzer nicht, wonach gesucht wurde und wie er zurückkommt — bei Werkzeugen kommen zwei Selects hinzu, die er selbst wiederfinden muss (better-writing #11). |
| A-29 | Vokabular über die App: `frontend/src/App.tsx:216` („Logout") vs. `pages/admin/AdminLayout.tsx:132` („Abmelden"); `LoginForm.tsx:33/63/137` („Login fehlgeschlagen" / „Anmeldung" / „Anmelden"); `pages/Tools.tsx:82` („Zurück") vs. `ToolForm.tsx:662` („Abbrechen"); „Lager/Ersatz" (`App.tsx:23`, `ToolForm.tsx:372`) vs. „Lager-/Ersatzobjekt" (`StorageItemForm.tsx:67`) vs. „Ersatzteil / Lagerware" (`ToolFormModal.tsx:223`) | Drei Paare für je eine Sache, derselbe Gegenstand in vier Schreibweisen | „Abmelden", „Anmeldung fehlgeschlagen. Prüfe deine Personalnummer.", „Abbrechen" auch im Formularkopf, ein Begriff „Lager/Ersatz" | Nutzer fragen sich, ob Unterschiedliches gemeint ist — und die Wörter stehen teils auf demselben Bildschirm (better-writing #1/#2/#6). |
| A-30 | `frontend/src/components/tools/ToolForm.tsx:305-313`, `frontend/src/App.tsx:28-33` | Der Aktiv-Marker nutzt `border-teal-500`, `bg-teal-500`; die Statuspunkte in `ToolList.tsx:84-98` nutzen `bg-emerald-500`, `bg-teal-500`, `bg-amber-500`, `bg-rose-500`, `bg-slate-400` — neben Badges aus `.ui-badge-*`, die `#0f766e`, `#1e40af`, `#92400e`, `#9f1239` verwenden | Farben aus den Guide-Klassen (Punkt und Badge derselben Zeile müssen dieselbe Familie sein) | In einer Zeile steht ein blaues `.ui-badge-info` („Ausgeliehen") neben einem **teal-500**-Punkt, ein teal-farbenes `.ui-badge-success` neben einem **emerald-500**-Punkt: Der Punkt widerspricht dem Badge, das er illustriert (Regel §1.5, better-ui „ein Token pro Bedeutung"). |

### 2.4 LOW — Politur

| Nr | Ort | Ist | Soll | Warum |
|---|---|---|---|---|
| A-31 | `frontend/src/App.tsx:223` | `<main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px]">` — ohne `mx-auto` | `mx-auto` ergänzen (oder Deckel entfernen) | Auf sehr breiten Bildschirmen (> 1600 px) klebt der Inhalt am linken Rand, rechts bleibt eine leere Fläche (better-layout #3/#9). |
| A-32 | `frontend/src/components/tools/ToolForm.tsx:337,347,524,603` | Außenfläche `p-4 rounded-xl`, innere Flächen `bg-white/40 p-3 rounded-xl` — gleicher 12-px-Radius | Innen `rounded-lg` (8 px) bei 12 px Abstand | Gleicher Radius innen wie außen lässt die innere Ecke eingeklemmt wirken (better-ui #1 „konzentrische Radien"). |
| A-33 | `frontend/src/components/storage/StorageItemList.tsx:79`, `SerialArticleList.tsx:103` | `uppercase` ohne Sperrung; `ToolList.tsx:180` hat `tracking-wider` | `tracking-wider` in allen drei Tabellenköpfen | Versalien brauchen positive Sperrung; zwei von drei Köpfen weichen ab (better-typography #8). |
| A-34 | `frontend/src/index.css:28` | `@apply min-h-screen text-[var(--text)];` — ohne Font-Smoothing | `antialiased` am Root ergänzen (das AdminPanel hat es in `admin.css:160`) | Dieselbe 14-px-Schrift wiegt im Haupt-Frontend anders als im AdminPanel (better-typography #17). |
| A-35 | `frontend/src/components/tools/ToolForm.tsx:389`, `frontend/src/App.tsx:56,60,64,68` | Dynamischer Zähler („existiert bereits ${existingCount}×") und vier Kennzahlen ohne `tabular-nums` | `tabular-nums` auf wechselnde Zahlen (AdminPanel nutzt es bereits, `admin.css:638`) | Proportionale Ziffern verschieben den Wert bei jeder Aktualisierung (better-typography #11). |
| A-36 | `frontend/src/components/auth/LoginForm.tsx:137` (`'Anmelden...'`), `ToolForm.tsx:432` (`'Bitte wählen...'`), `:646` (`placeholder="Zusätzliche Informationen..."`); `SerialArticleList.tsx:118` (`'–'`) vs. `ToolList.tsx:202`/`StorageItemList.tsx:101` (`'—'`); `z.B.` 13× vs. `z. B.` 1× (`SerialArticleUpload.tsx:88`); `ToolList.tsx:258` (gerade Anführungszeichen `"…"`) vs. `ToolForm.tsx:252` (`„…“`) | Zwei Schreibweisen für dasselbe Zeichen, drei Varianten des Leerwerts | Durchgängig `…`, `—`, `z. B.`, deutsche Anführungszeichen | Sechs andere Stellen nutzen bereits das korrekte Auslassungszeichen — die Mischung wirkt unsauber (better-typography #13). |
| A-37 | `frontend/src/App.tsx:228` vs. `frontend/src/pages/Tools.tsx:98` | Textkante der Tabbar ≈ 26 px, darunter Bereichsüberschrift ≈ 20 px | Beide Kanten auf dieselbe Flucht bringen | Zwei übereinanderstehende Texte derselben Spalte weichen um 6 px ab — liest sich als schiefe Flucht (better-layout #3). |
| A-38 | `frontend/src/components/serial-articles/SerialArticleList.tsx:133` („Vorschau"), `SerialArticleUpload.tsx:121` („Klicken, um zu ersetzen"), `:125` („PDF hierher ziehen oder klicken zum Auswählen") | Nomen als Buttonlabel; „klicken“ als Geräteverb | „PDF ansehen", „Andere PDF wählen", „PDF hierher ziehen oder auswählen" | Buttons sollen mit einem Verb beginnen und geräteunabhängig formuliert sein (better-writing #5/#4). |
| A-39 | `frontend/src/components/ToolFormModal.tsx` (259 Zeilen) | Wird **nirgends importiert** (`grep ToolFormModal` findet nur die Datei selbst), enthält 17 rohe Palettenfarben und eigene Glas-Inputs (`rounded-xl border border-white/80 bg-white/60 px-3 py-2 … backdrop-blur-sm`) | Datei entfernen oder bewusst als Variante einführen | Toter Code: Er verdoppelt das Anlege-Formular mit einem zweiten, abweichenden Stil und verfälscht jede künftige Messung (u. a. 6 der 7 Felder ohne Guide-Input-Klasse stammen von hier). |
| A-40 | `frontend/src/index.css` | 18 definierte Guide-Klassen ohne jede Verwendung im Haupt-Frontend: `glass-card-hover`, `glass-item`, `glass-panel`, `glass-preview-card`, `stat-card`, `ui-alert-info`, `ui-alert-warning`, `ui-avatar`, `ui-badge-danger`, `ui-badge-info`, `ui-breadcrumbs`, `ui-btn-danger`, `ui-btn-ghost`, `ui-menu`, `ui-pagination`, `ui-progress`, `ui-skeleton`, `ui-switch`; dazu die Glas-Blöcke `.login-card`, `.btn-login`, `.sidebar`, `.sidebar-nav-item`, `.search-container`, `.glass-item`, `.glass-card-hover` (0 Verwendungen) | Entweder einführen, wo sie die Aufgabe lösen (z. B. `.ui-btn-danger`, `.ui-skeleton`, `.ui-switch`), oder die toten CSS-Blöcke entfernen | Das System behauptet 36 von 36 umgesetzten Klassen; tatsächlich sind 18 ohne Anwendung, während ihre Aufgaben handgebaut gelöst werden — auch `.ui-btn-danger` bleibt ungenutzt, obwohl die Löschaktion sie bräuchte (Guide §1.6/§1.4). Nach Paket 3 sind es noch **15** ungenutzte Guide-Klassen (`.ui-avatar`, `.ui-btn-danger`, `.ui-btn-ghost` werden jetzt verwendet). |
| A-41 | `frontend/src/index.css:3-21` | **10 von 17** Variablen des `@theme` werden nirgends per `var()` referenziert: `--primary`, `--primary-hover`, `--success`, `--warning`, `--error`, `--surface`, `--surface-light`, `--surface-dark`, `--accent-orange`, `--accent-purple`. Tailwind v4 liefert ungenutzte Theme-Variablen deshalb nicht nach `:root` aus — im Browser gelesen kommen sie leer zurück. Alle Farben stehen stattdessen als Literal in den Regeln (`#0f766e` in `.ui-btn-primary`, `#065f46` in `.ui-alert-success` …) | Variablen entweder verdrahten (Werte in den `.ui-*`-Regeln auf `var(...)` umstellen, für Text-Rollen mit eigenen `-text`-Variablen nach Guide §1.8) oder aus dem `@theme` entfernen | Die Tokens suggerieren eine zentrale Farbsteuerung, die es nicht gibt: Wer `--primary` ändert, ändert nichts. Für die geplanten Wiederholungen (Guide-Angleichung) ist das eine Stolperfalle (gefunden beim Nachlauf von Paket 5). |

---

## 3. Befunde AdminPanel (System B „Split-Tone Operational“)

| Nr | Schwere | Ort | Ist | Soll | Warum |
|---|---|---|---|---|---|
| B-01 | — | `frontend/src/admin.css` | **Konform:** 18 von 18 Guide-Tokens wertgleich (§2.1/§2.2), 0 rohe Palettenfarben, 0 `!important`, 0 benutzte-aber-undefinierte `admin-*`-Klassen, kein Dark Mode | — | Das ist der Teil der Anwendung, der den Guide vollständig einhält (Beleg: `.audit/guide-check.mjs`, `guide-check`-Ausgabe). |
| B-02 | MEDIUM | `frontend/src/components/movements/MovementLog.tsx:349` | `<div className="ui-spinner" />` — eine **Glas-Klasse aus `index.css`** im AdminPanel. `admin.css` hat keine Spinner-Klasse (nur `admin-shimmer` für `admin-skel`) | `admin-skel` bzw. eine eigene `admin-*`-Ladeanzeige | Regel 12: Eine Komponente benutzt **entweder** `.admin-*` **oder** `.ui-*`, niemals beide. Es ist das einzige Leck, aber es bedeutet, dass `admin.css` allein nicht genügt, um die Admin-Seite zu stylen (Regel 12 „Nicht vermischen“). |
| B-03 | LOW | `frontend/src/pages/admin/AdminLayout.tsx:18,30,42` (`width="17" strokeWidth="1.75"`), `:154` (`width="18" strokeWidth="1.9"`), `frontend/src/pages/admin/AdminStorageLocations.tsx:1160,1284` (`width="14" height="14"`), `AdminDashboard.tsx:96` (ohne `width`/`height`, ohne `strokeWidth`) | Vier verschiedene Strichgewichte/Festgrößen im selben Panel | Ein Strichgewicht pro Set, Größe über CSS-Klassen statt `width`-Attribut (wie Regel 11 §Icons es für Glas fordert) | Die Admin-Icons wirken uneinheitlich — **und Regel 12 enthält dazu gar keine Regel** (siehe §4, Lücke im Guide). |
| B-04 | LOW | `docs/15-ui-styleguide.md` §2.4, §0 | Der Guide nennt für `admin.css` **109** `admin-*`-Klassen; tatsächlich sind es **111**. Der Guide nennt die Vorlagen mit 55 KB und 151 KB; tatsächlich sind `UI-Styleguide.html` 116 KB und `AdminPanel-Styleguide.html` 203 KB | Zahlen im Guide aktualisieren | Der Guide dient als Nachschlagewerk; falsche Mengenangaben kosten bei jeder Prüfung Zeit (12 Klassen erscheinen zudem nur unter Sammel-Schreibweise, z. B. `admin-line*`). |

---

## 4. Konflikte im Guide selbst — bitte klären, nicht eigenmächtig entscheiden

Die Konfliktregel (`docs/15-ui-styleguide.md` §4, Regel 11 §Konfliktregel, Regel 12 §Konfliktregel) verlangt: **melden und fragen**. Diese Widersprüche sind im Audit aufgetreten:

| Nr | Widerspruch | Betroffene Stellen | Status |
|---|---|---|---|
| K-01 | Drei verschiedene Text-/Status-Skalen: Guide §1.1 nennt Text `#0f172a`, Muted `#64748b`, Success `#10b981`, Warning `#f59e0b`, Danger `#e11d48`. `index.css` (`@theme`) setzte `--text: #3a3a3a`, `--text-muted: #707070`, `--success: #1fc96d`, `--warning: #e6a21d`, `--error: #e23a3a`. Regel 11 §Farben nennt Success `#059669`/`bg-emerald-600`, Warning `bg-amber-500`, Info `bg-sky-600` | `frontend/src/index.css:3-21` vs. Guide §1.1 vs. Regel 11 §Farben | **Erledigt** (Paket 3): `@theme` folgt dem Guide. Offen bleibt nur die Regel-11-Nebenliste (`bg-emerald-600`/`bg-amber-500`/`bg-sky-600`), die der Guide §1.1 mit anderen Hex-Werten beschreibt — sie wird praktisch nicht mehr verwendet. |
| K-02 | `.ui-alert` ist im Guide mit `font-size: .72rem` (11,5 px) festgelegt — dem kleinsten Text der Oberfläche und unter der Lesbarkeitsgrenze | Guide §1.5, `frontend/src/index.css` | **Erledigt** (Paket 4): Guide §1.5 und CSS stehen jetzt gemeinsam auf **`.8rem` (12,8 px)**, dokumentiert in §1.8. Keine stille CSS-Abweichung. |
| K-03 | Guide §1.2 nennt für `.glass-card` eine flache Fläche (`rgba(255,255,255,0.40)`); `index.css` setzt einen Verlauf (`rgba(255,255,255,.40) → rgba(220,220,220,.3)`) | Guide §1.2 vs. `frontend/src/index.css:120-130` | offen, unkritisch (Sichtentscheidung) |
| K-04 | Regel 11 §Icons fordert „ausschließlich **Lucide**-Icons“ und `stroke-width="2"`. `icons.tsx` mischt Pfade mehrerer Quellen und Strichstärken 1,5 und 2 | `frontend/src/components/icons.tsx`, Regel 11 §Icons | **offen — blockiert A-15/A-16/A-17** |
| K-05 | Regel 12 regelt Icons **nicht** — das AdminPanel hat aber die uneinheitlichsten Icon-Gewichte der Anwendung | Regel 12 (keine Icon-Sektion), `AdminLayout.tsx:18,30,42,154` | **offen — blockiert B-03** |
| K-06 | Der Guide beschreibt `.ui-badge-*`-Farben, aber der Statuspunkt innerhalb des Badges nutzte eine andere Farbfamilie | `frontend/src/components/tools/ToolList.tsx` | **Erledigt** (Paket 3, A-30): Punkt erbt die Badge-Farbe per `currentColor`. Die Regel ist in Guide §1.8 nicht ausdrücklich ergänzt — bewusst, weil die Umsetzung die Frage gegenstandslos macht. |
| **K-07** | Der Guide kannte nur **zwei** Textwerte (`#0f172a`, `#64748b`); der Code nutzte **sechs** Grautöne, davon mehrere unter 4,5:1 (`slate-400` 2,1:1, `slate-500` 3,8:1) | 119 Stellen in 12 Dateien | **Erledigt** (Paket 4): Guide **§1.8 „Textskala und Kontrast"** neu angelegt — drei Ebenen (`#0f172a` / `#334155` / `#475569`) plus Statusfarben-Tabelle, alle Werte gemessen ≥ 4,8:1. Nutzung per Codemod darauf abgebildet. |

---

## 5. Verifikation — was geprüft wurde und was offen bleibt

### 5.1 Gerendert gemessen (Chromium, gegen die laufende App)

| Prüfung | Ergebnis |
|---|---|
| Primärfarbe der Hauptaktion | „+ Anlegen" = `oklch(0.704 0.14 182.503)` (`#14b8a6`), `font-weight 600`; `.ui-btn-primary` „Ausleihen" = `rgb(15,118,110)` (`#0f766e`), `font-weight 700` → A-11/A-13 belegt |
| Tab-System | aktiv: `font-weight 600`, `radius 12px`, `background rgba(255,255,255,0.8)`; inaktiv: `font-weight 500`; Login-Tabs dagegen `.ui-tabs` mit `font-weight 700`, `radius 10,4px`, aktiv `#fff` → A-14 belegt |
| Logout mobil (390×844) | Sidebar `display: none`, `logoutVisible: 0`, `adminPanelVisible: 0` → A-06 belegt |
| Tab-Leiste mobil (390×844) | `scrollWidth 363` / `clientWidth 235`; „Lager/Ersatz" angeschnitten, „Historie" vollständig außerhalb → A-24 belegt |
| Lager-Modal, Viewport-Matrix | 390×844 passt (738 px, Speichern sichtbar); 375×667, 360×640, 390×560: Panel 738 px > Viewport, Titel abgeschnitten (`titleTop −11`), Speichern unterhalb und **auch nach dem Scrollen nicht im Viewport** → A-01 belegt |
| Löschbestätigung | abgefangener Dialog: `{ type: "confirm", message: "Werkzeug wirklich löschen?" }` → A-04 belegt |
| Kennzahlkarten | alle vier rendern das Literal „—" („Aktive Ausleihen—", „Verfügbare Werkzeuge—", …) → A-27 belegt |
| Fokusring Eingabefeld | **funktioniert**: `box-shadow rgba(15,118,110,0.15) 0 0 0 3px`, `border-color rgb(15,118,110)`, `outline: none` → **kein** Befund, Verdacht aus der Code-Lesung widerlegt |
| Tastatur-Reihenfolge | 8 Tab-Schritte: Admin-Panel → Logout → 4 Tabs → Anlegen → Suchfeld. Buttons erhalten den Browser-Standardring (`outline-style: auto`, 3 px); im Haupt-Frontend existiert **keine** eigene `:focus-visible`-Regel, im AdminPanel schon (`.admin-shell … :focus-visible { outline: 2px solid var(--admin-primary) }`) → leichte Asymmetrie zwischen den Systemen, kein Fehler |
| Login bei 390×844 | Karte 431 px, passt; Feld `type="password"`, `font-size 16px`, `label: false`, `aria-label: null` → A-10 belegt (und: das Login-Feld zoomt auf iOS nicht, weil es keine Größen-Utility trägt) |
| Console-Fehler | keine |
| Kontrast der Sekundärtexte | Alle gemessenen Paare im Toolbar/KPI/Tabellenbereich liegen über 4,5:1, **weil** dort überwiegend `slate-600/700/900` und `--text` verwendet werden; die problematischen Werte aus A-07 (`slate-500` 3,81:1, `slate-400` 2,10:1, `teal-600` 2,92:1) sind **berechnete** Werte, keine Pixelmessung |

### 5.2 Weiterhin offen (ehrlich ausgewiesen)

1. **Kontrast (A-07)** ist exakt berechnet (OKLCH → linear-sRGB → WCAG-Luminanz, `.audit/contrast.mjs`), aber nicht am gerenderten Pixel nachgemessen; die Flächen sind als Glasweiß über `#c5cbd3` modelliert, die Verlaufs-Radials der Seite können lokal heller sein.
2. **iOS-Zoom (A-22)** ist aus den Klassenwerten abgeleitet (`text-xs` = 12 px, `text-sm` = 14 px, im kompilierten CSS verifiziert) — in Chromium nicht reproduzierbar.
3. **Interaktive Abläufe** (Speichern, Ausleihen, Upload, PDF-Vorschau) wurden nicht vollständig durchgespielt; Fehlerpfad-Befunde (A-02/A-03) stammen aus dem Code und der Backend-Gegenprobe.
4. **Nicht geprüft:** Bildschirmleser-Ausgabe, `prefers-reduced-motion`, Zoom auf 200 %, Eingabe mit eingeblendeter Bildschirmtastatur (nur als kleine Viewporthöhe angenähert), RTL/i18n (nicht anwendbar, einsprachig).

### 5.3 Reproduzierbare Prüfmittel

| Datei | Prüft | Ergebnis |
|---|---|---|
| `.audit/frontend-audit.mjs` | Systemtrennung, Guide-Klassen vs. Tailwind, Tokens, Icons, Motion, Typografie, Formulare, Dark Mode, Zustandsabdeckung, Buttons/Inputs, Platzhalter | `frontend-audit.log`, `frontend-audit.json` |
| `.audit/contrast.mjs` | Kontrast gegen die Glasflächen mit echten Tailwind-v4-Werten (OKLCH) | `contrast.log` |
| `.audit/guide-check.mjs` | AdminPanel: Palettenfarben, `title`-Attribute, undefinierte Klassen, `!important` | 0 Palettenfarben · 3 echte `title`-Attribute (dazu 4 Component-Props) · 0 undefinierte Klassen · 0 `!important` |
| `.audit/rendered-check.mjs` | Gerenderte Buttons, Tabs, KPI-Inhalte, Mobil-Sichtbarkeit, Modal bei 390×844, Console | `rendered-check.log`, `rendered-check.json` |
| `.audit/rendered-check2.mjs` | Modal-Schwellwert über 5 Viewports, Fokus-Sequenz, gerenderte Farbpaare, Login mobil | `rendered-check2.log/json` |
| `.audit/rendered-check3.mjs` | Fokusring-Nachweis, geclipptes Modal + Scrollverhalten, Tab-Leiste, Löschdialog | `rendered-check3.log/json` |
| `.audit/verify-paket1.mjs` | Nachprüfung Paket 1: Modal über 4 Viewports, `lang`, Titel, mobile Kopfzeile, Abmelden wirkt, Bearbeiten-Button | `verify-paket1.log/json`, `paket1-*.png` |
| `.audit/verify-paket2.mjs` | Nachprüfung Paket 2: Dialog-Verhalten (Fokus, Escape, DELETE) und 6 Fehlerpfade per Request-Interception | `verify-paket2.log/json`, `paket2-bestaetigung.png` |
| `.audit/verify-paket3.mjs` | Nachprüfung Paket 3: Tabs/Buttons/Sidebar/Avatar/Statuspunkt gerendert, Tokens, `transition-property`, `!important`-Entfernung, mobile Tab-Leiste | `verify-paket3.log/json`, `paket3-desktop.png`, `paket3-formular.png`, `paket3-mobil.png` |
| `.audit/verify-paket4.mjs` | Nachprüfung Paket 4: Textskala gerendert, Fehlermeldungsgröße/Farbe, 14 px Desktop / 16 px Mobil, Fehler ohne Leerzustand | `verify-paket4.log/json`, `paket4-*.png` |
| `.audit/text-scale-check.mjs` | Kontrastrechnung der Textskala und Statusfarben gegen die Glasflächen (Worst-Case-Fläche) | Konsolenausgabe |
| `.audit/codemod-text.mjs` | Textfarben/Schriftgrößen auf die Guide-Skala abbilden – mit Probelauf und Änderungsprotokoll je Datei | `codemod-text.dry.log` |
| `.audit/a11y-labels.mjs` | Zugängliche Namen aller Felder und Symbol-Buttons in 9 Ansichten (Browser-Semantik, `el.labels`) | `a11y-labels.log/json` |
| `.audit/check-label-pairs.mjs` | Paarigkeit `htmlFor` ↔ `id`, doppelte DOM-IDs, unbeschriftete Felder – **ohne** laufenden Server | Konsolenausgabe |
| `.audit/shots/` | `rendered-*.png`, `modal-*.png`, `tabbar-390.png`, `focus-input.png`, `paket1-*.png`, `paket2-bestaetigung.png`, `paket3-*.png`, `paket4-*.png` | Belege |

---

## 6. Empfohlene Reihenfolge

**Erledigt:** A-01, A-05, A-06, A-08, A-09 (Paket 1) · A-02, A-03, A-04 (Paket 2) · A-11 … A-14, A-18, A-19, A-30 (Paket 3) · A-07, A-21, A-22, A-23, A-28 (Teil) (Paket 4) · A-10 (Paket 5) · dazu K-01, K-02, K-06, K-07 im Guide geklärt. **Alle 6 HIGH-Befunde, die Design-System-Abweichung, die Lesbarkeitsmängel und die Beschriftungen sind abgearbeitet.**

**Offen, nach Wirkung sortiert:**

1. **Nachlauf Paket 5:** E2E-Suite neu verankern — `getByLabel('Personalnummer')`/`getByLabel('Passwort')` funktionieren jetzt (Browserprüfung bestanden); die fehlende Personalnummer `1001` in `backend/toolsync.db` bleibt ein eigenes Thema.
2. **A-15/A-16/A-17** (Icons) — braucht die Entscheidung **K-04/K-05** (Lucide vs. gemischt, Strichstärke 1,5 vs. 2, Icon-Regel fürs AdminPanel).
3. **A-27/A-28 (Rest)** (Platzhalterinhalte: „Historie"-Sackgasse, vier „—"-Kennzahlen, drei Stub-Sub-Reiter; Leerzustände mit Suche/Ausweg) und **A-39/A-40** (tote Datei `ToolFormModal.tsx` samt 17 Palettenfarben, 15 ungenutzte Guide-Klassen).
4. **A-20** (dauerhafte Layer-Promotion auf allen Glasflächen) und **A-24/A-25/A-26** (Scroll-Andeutung, 8 px Abstand neben „Löschen", Sticky-Chrome) — Handwerkspolitur.
5. **ARIA-Tabs-Muster** (eigene Aufgabe): `role="tablist"`/`role="tab"`/`aria-selected` + `tabpanel` samt Pfeiltasten-Navigation für Tabbar und Formular-Subnav.
6. **AdminPanel:** **B-02** (Einzeiler: `.ui-spinner` durch `admin-skel` ersetzen), **B-03** (Icon-Gewichte, nach K-05), **B-04** (Guide-Zahlen); die 6 `window.confirm`-Stellen brauchen eine Entscheidung zur Admin-Dialog-Komponente.

---

## 7. Abschluss-Stand

**Dieses Audit ist abgeschlossen.** Der Stand je Bereich:

| Bereich | Stand | Beleg |
|---|---|---|
| Nutzer-blockierende Befunde (HIGH) | **behoben** — A-01 Modal-Clipping, A-02/A-03 Fehlertexte, A-04 Löschbestätigung, A-05 Button-Beschriftung, A-06 Abmelden mobil | `.audit/verify-paket1.mjs` 10/10, `verify-paket2.mjs` 12/12 |
| Design-System-Angleichung | **behoben** — A-11 … A-14, A-18, A-19, A-30; Guide-Klassen **34 statt 31** genutzt, Palettenfarben **153 → 141** | `.audit/verify-paket3.mjs` 14/14, `.audit/frontend-audit.mjs` |
| Lesbarkeit & Kontrast | **behoben** — A-07, A-21 … A-23, A-28 (Teil); neue Guide-Textskala §1.8, alle Werte ≥ 4,8:1 | `.audit/verify-paket4.mjs` 14/14, `.audit/text-scale-check.mjs` |
| Barrierefreiheit | **behoben** — A-10; Felder ohne zugänglichen Namen **37 → 0**, Escape schließt alle Overlays | `.audit/a11y-labels.mjs`, `.audit/check-label-pairs.mjs` |
| Anlegen-Formular ohne Scrollen | **umgesetzt** — neues Feldmuster `.ui-field` (Guide §1.9), Formular 726 → **604 px**, 1440×900 scrollfrei | `.audit/verify-field.mjs` 15/15, `.audit/measure-anlegen.mjs` |
| AdminPanel (System B) | **konform** laut Tokens/Klassen; nur B-02 … B-04 offen | `.audit/guide-check.mjs` |

**Offen (bewusst, siehe §6):** Icons (A-15/16/17 + K-04/K-05) · tote `@theme`-Tokens (A-41) · Platzhalterinhalte (A-27/28 Rest) · tote Reste (A-39/40) · Politur (A-20/24/25/26, ARIA-Tabs) · AdminPanel B-02/03/04 und die 6 `window.confirm` · E2E-Testdaten (`1001` fehlt in `backend/toolsync.db`) · optionale Feinheiten (leere Selects dimmen, `.ui-field` in den Modalen).

**Zwei Entscheidungen sind absichtlich so geblieben** und nicht als Versehen zu lesen:
1. `.ui-field` gilt nur für lange Formulare — die Modale behalten Labels darüber (Guide §1.9 Regel 8), weil die Sparform dort nichts spart und die Abhängigkeitstexte der Lagerplatz-Selects sonst abgeschnitten würden.
2. Die Tooltips in der Lager-Liste (abgeschnittener Text) und am PDF-`<iframe>` (zugänglicher Name des iframes) sind geblieben; alle redundanten Tooltips im Formular sind entfernt.

### 7.1 Prüfungen wiederholen

Voraussetzung: `vite` auf **Port 5173** und das Backend auf **8000** laufen. Die Prüfskripte benötigen Chromium und (in dieser Umgebung) eine Freigabe, weil der Browserstart sonst an `spawn EPERM` scheitert.

```powershell
node .audit/frontend-audit.mjs      # Konformität, Klassen, Farben, Zustände  -> .audit/frontend-audit.log
node .audit/guide-check.mjs         # AdminPanel: Palettenfarben, Klassen, !important
node .audit/text-scale-check.mjs    # Kontrast der Textskala
node .audit/contrast.mjs            # Kontrast gegen die Glasflächen
node .audit/measure-anlegen.mjs     # Formularhöhe/Scrollbedarf über 5 Fenstergrößen
node .audit/verify-paket1.mjs       # Modal, mobil, index.html, Button-Label
node .audit/verify-paket2.mjs       # Dialoge und 6 Fehlerpfade
node .audit/verify-paket3.mjs       # Tabs, Buttons, Tokens, Motion
node .audit/verify-paket4.mjs       # Textskala, Schriftgrößen, Kontrast
node .audit/a11y-labels.mjs         # zugängliche Namen in 9 Ansichten + Escape
node .audit/check-label-pairs.mjs   # Label-/ID-Paare (ohne laufenden Server)
node .audit/verify-field.mjs        # Innenlabel-Feld: Layout, Glas, Fokus, Texte
node .audit/analyze-tag-color.mjs   # Farbkandidaten-Analyse zum Innenlabel
```

Die Skripte, Logs und Screenshots liegen bewusst **ungetrackt** in `.audit/`; dieser Report ist der festgehaltene Teil davon. Bei Änderungen am Frontend bittet `verify-field.mjs`/`verify-paket*.mjs` als Erstes um Nachlauf — die Suiten prüfen gerenderte Werte, nicht Quellcode-Text.

