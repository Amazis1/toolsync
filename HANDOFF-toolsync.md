# Übergabe: ToolSync · Continue-Steuerung aufräumen

**Stand:** 2026-09-19
**Nutzer:** Abenzer — Anfänger, arbeitet mit VS Code + **Continue V2.1.0**, Modell **DeepSeek 4.1 Flash**
**Projekt:** `D:\toolsync` — React 19 SPA + FastAPI + PostgreSQL

---

## 1. Auftrag

Regeln, Docs und Tasks so abstimmen, dass DeepSeek 4.1 Flash **deterministisch und ohne Token-Verschwendung** arbeitet. Zusätzlich die zwei UI-Styleguide-**Kopien** so umbauen, dass sie nicht mehr ~58.000 Tokens pro Zugriff fressen.

### Harte Randbedingungen

- **Originale nicht ändern:** `UI-Styleguide.html` und `AdminPanel-Styleguide.html` bleiben unangetastet. Nur die **Kopien** werden umgebaut.
- **`D:\Web` ist Altlast und fliegt komplett raus.** Es war ToolSync v1 (Django 5.1.5) und hat mit dem neuen Projekt nichts mehr zu tun. Alle Erwähnungen in `.continue/rules/`, `docs/`, `tasks/` werden entfernt (Details in Abschnitt 5).
  - `D:\Web` wird **nicht gelesen** und **nicht betreten** — es ist kein Teil dieses Projekts mehr. Einziges Ziel ist, die Verweise darauf aus dem Projekt zu entfernen.
  - `D:\Web` ist **nicht** als „read-only Referenz" zu behandeln. Diese alte Regel wird aus `08-file-safety.md` und den anderen Dateien **gestrichen**, nicht umformuliert.
- **AdminPanel folgt `AdminPanel-Styleguide.html`** (Split-Tone). Entscheidung des Nutzers.
- **Dark Mode wird nicht gebraucht.**
- Erst analysieren, dann ändern. Bei Unklarheit fragen, nicht entscheiden.
- Getrennte Design-Systeme nicht vermischen: Haupt-Frontend = Glas, AdminPanel = Split-Tone.

---

## 2. Gemessene Ausgangslage

Tokens geschätzt über Zeichen/3,6.

| Bereich | Umfang | Tokens |
|---|---|---|
| `.continue/rules/` (13 Dateien) | 33,6 KB | 9.544 |
| `docs/` (19 Dateien, davon 10 leer) | 102,5 KB | 29.146 |
| `tasks/` (14 Dateien) | 79,1 KB | 22.498 |
| `AdminPanel-Styleguide.html` | 151,2 KB | 42.878 |
| `UI-Styleguide.html` | 53,7 KB | 15.243 |
| **Gesamt** | 419,4 KB | **≈ 119.310** |

Automatisch pro Request geladen werden aktuell nur **148 Tokens** (`08-file-safety`, `12-tool-call-format`).

---

## 3. Die drei Design-Systeme

| # | System | Datei | Klassen | Gilt für |
|---|---|---|---|---|
| 1 | Glas / Split-Tone | `frontend/src/index.css` | 64: `.ui-*`, `.app-*`, `.glass-*`, `.input-*`, `.modal-*` | Haupt-UI |
| 2 | Split-Tone Operational | `frontend/src/admin.css` | 109 × `.admin-*` | AdminPanel |
| 3 | Vite-Template-Reste | `frontend/src/App.css` | `.counter`, `.hero`, … | **nichts — wird nirgends importiert** |

- `frontend/src/main.tsx` importiert `index.css` **und** `admin.css`. Beide sauber getrennt, **null Klassenüberschneidung**.
- `index.css` nutzt **Tailwind v4** (`@import "tailwindcss"`, `@theme`, 23 × `@apply`).
- `admin.css` ist **handgeschriebenes CSS**, gekapselt, keine globalen `body`-Regeln. Kopfzeile zitiert korrekt `D:\toolsync\AdminPanel-Styleguide.html` als Quelle.
- **`admin.css` enthält bereits alle 90 Tokens und 109 Klassen des AdminPanel-Guides** — Umsetzung ~95 % fertig. Es fehlen nur 7 Bequemlichkeitsklassen: `.admin-input-icon`, `.admin-search-sm`, `.admin-select-auto`, `.admin-icon-btn-outline`, `.admin-icon-btn-danger`, `.admin-legend-xs`, `.admin-toast-success`.
- `admin.css` enthält einen **Dark-Mode-Block** (`html[data-theme="dark"]`), der nicht gebraucht wird.

**Konsequenz:** Kein Agent muss den 151-KB-Guide lesen. `admin.css` ist die Quelle.

---

## 4. Defekte, die behoben werden müssen

### 4.1 Korrupte Dateien — für Agenten unlesbar

| Datei | Befund |
|---|---|
| `.continue/rules/10-analysis-workflow.md` | **18,2 KB / 5.117 Tokens** — UTF-8-BOM + **Null-Byte an Position 6754** (unmittelbar vor der ID `1075000`). Read-Tool meldet `binary file`; die Regel wird komplett ignoriert. |
| `docs/00-project-vision.md` | 5 Null-Bytes (Positionen 4488, 4497, 4594, 4774, 4873) + BOM |
| `docs/01-requirements.md` | 5 Null-Bytes (Positionen 3135, 3144, 3268, 3497, 3595) + BOM |

Diese drei Dateien enthalten Anforderungen, Vision und Analyse-Workflow — der Agent liest sie derzeit **nicht**.

### 4.2 Regel-Aktivierung ist Glückssache

| Regel | Aktivierung | Tokens |
|---|---|---|
| `08-file-safety` | `alwaysApply: true` | 82 |
| `12-tool-call-format` | `alwaysApply: true` | 66 |
| `06-backend` | `globs: **/*.py` … | 115 |
| `07-testing` | `globs` | 100 |
| `02-domain-rules` | nur `description` | 162 |
| `00, 01, 03, 04, 05, 09, 10, 11` | **nur `description`** | 8.552 |

**Neun von dreizehn Regeln** haben nur ein `description`-Feld → in Continue „Agent Requested" → werden **nicht automatisch** geladen. Das ist die Ursache für „mal so, mal so" und für verschwendete Tokens. Nicht zu viel Kontext ist das Problem, sondern **unzuverlässiger** Kontext.

### 4.3 Falsche Anleitung für das AdminPanel

`.continue/rules/11-ui-styleguide.md` beschreibt unter „Design-Tokens", „Buttons", „Badges", „Inputs" das **Glas-System** statt des AdminPanel-Systems:

| Regel 11 sagt | Guide sagt |
|---|---|
| `.ui-btn`, radius `.75rem`, padding `.55rem .9rem`, weight 700 | `.admin-btn`, `.55rem`, `.5rem .9rem`, weight **600** |
| `.ui-btn-secondary` = `rgba(255,255,255,.55)` Glas | `.admin-btn-secondary` = **`#ffffff`**, Border `#c3d1d1` |
| Sidebar-BG `#0f172a` | `--admin-sidebar-bg` = **`#0e1a1a`** |
| Content-BG `#f1f5f9` | `--admin-content-bg` = **`#f4f7f7`** |
| Cards-Border `#e2e8f0` | `--admin-border` = **`#dfe7e7`** |
| Inputs: `rgba(15,118,110,.25)`, Radius `0.5rem` | `.admin-input`: weiß, Border `#c3d1d1`, Radius `.55rem` |

**Das ist die Hauptursache für „Button sieht nicht aus wie im Guide":** Der Agent baut korrekt nach einer falschen Anweisung.

### 4.4 Weitere Defekte

- **`12-tool-call-format.md` ist abgeschnitten** — der Code-Block wird nie geschlossen, lädt aber bei jedem Request.
- **`09-sap-optional.md` hat den Inhalt doppelt** (Zeilen 2–4 und 11–15).
- **`docs/02`–`docs/08`, `10`, `11`** sind 0 KB — leere Platzhalter.
- **`frontend/src/App.css`** (2,8 KB) tote Vite-Vorlage, kein Import.
- **`frontend/src/components/ToolFormModal.tsx`** wird nirgends importiert — bestätigt toter Code.
- **`tasks/CURRENT_TASKS.md` widersprüchlich:** TASK-007 IN_PROGRESS, TASK-010 IN_PROGRESS, gleichzeitig `tasks/09-ui-styleguide.md` `COMPLETED`; `PROJECT-PLAN.md` sagt „Phase 4 IN_PROGRESS".
- **Keine `config.yaml` im Projekt** — Modellwahl liegt global im Nutzerprofil.
- **`.continue/prompts/` und `.continue/docs/` sind leer.**
- **`frontend/src/components/icons.tsx`** trägt in Zeile 2 einen Legacy-Kommentar (Verweis auf `D:\Web\staticfiles\icons\`) — im Zuge der Legacy-Bereinigung entfernen.
- **Sicherheit:** `.continue/mcpServers/GitHub.yaml`, `context7.yaml`, `TavilySearch.yaml` enthalten **API-Keys im Klartext und sind in Git versioniert** (`git ls-files` bestätigt). `.gitignore` deckt `.continue/` nicht ab. **Vor jeder Weitergabe des Repos müssen GitHub-Token, Context7-Key und Tavily-Key widerrufen und auf Umgebungsvariablen umgestellt werden.**
- **`formatter.yaml` ist nutzlos** — nutzt `@modelcontextprotocol/server-everything`, den MCP-Referenzserver zum Testen.

---

## 5. Legacy-Bereinigung: `D:\Web` komplett entfernen

`D:\Web` war ToolSync v1 (Django 5.1.5, SQLite). Es gehört **nicht** mehr zum Projekt. Vollständige Erhebung — **189 Nennungen in 22 Dateien**:

### 5.1 Reine Altprojekt-Dateien → archivieren

| Datei | Umfang | Nennungen |
|---|---|---|
| `docs/12-old-django-analysis.md` | 19,3 KB / 5.412 Tokens | 37 |
| `docs/14-gap-analysis.md` | 8,2 KB / 2.296 Tokens | 12 |
| `tasks/01-analyze-old-project.md` | 24,0 KB / 6.747 Tokens | 25 |
| `tasks/02-document-old-project.md` | 1,8 KB | 3 |
| `tasks/03-compare-requirements.md` | 1,1 KB | 2 |

Zusammen **≈ 15.000 Tokens**. Diese Dateien haben mit dem neuen Projekt nichts zu tun.

### 5.2 Gemischte Dateien → Legacy-Teile herausschneiden

| Datei | Nennungen |
|---|---|
| `.continue/rules/10-analysis-workflow.md` | 22 |
| `docs/00-project-vision.md` | 22 |
| `docs/01-requirements.md` | 13 |
| `tasks/PROJECT-PLAN.md` | 19 |
| `docs/14-architecture.md` | 4 |
| `tasks/00-project-setup.md` | 4 |
| `.continue/rules/00-project-overview.md` | 4 |
| `.continue/rules/08-file-safety.md` | 2 |
| `.continue/rules/01-architecture.md` | 1 |
| `docs/18-context-lagerverschiebung.md` | 1 |
| `tasks/05-domain-model.md` | 2 |
| `tasks/CURRENT_TASKS.md` | 2 |
| `tasks/04-target-architecture.md` | 1 |

**Die kritischen Stellen, die beim Entfernen beachtet werden müssen:**

**a) `docs/00-project-vision.md`, Abschnitt 18 „Source of Truth"** — hier steht `D:\Web` auf **Prioritätsstufe 6 von 7**:

```
1. Anforderungen des Projektinhabers
2. docs/13-decisions.md
3. docs/01-requirements.md
4. weitere ToolSync-Dokumentation
5. Continue Rules
6. Analyse des Altsystems D:\Web      ← entfernen
7. Technische Empfehlungen des Modells
```
Nach dem Entfernen rutschen die Continue Rules auf Stufe 5. **Diese Hierarchie ist wichtig — sie ist die Konfliktregel des Projekts.**

**b) `docs/00-project-vision.md`, Abschnitt 3** — Unterabschnitt „Altsystem / D:\Web … READ-ONLY" ersatzlos streichen.

**c) `docs/00-project-vision.md`, Abschnitte 16 und 17** — „Analyse des Altsystems" und „Ziel der Altprojektanalyse" ersatzlos streichen.

**d) `docs/01-requirements.md`, Abschnitte 20, 21, 22** — „Altsystemanalyse", „Analyse gegen Anforderungen", „Nicht automatisch übernehmen" streichen.

**e) `.continue/rules/08-file-safety.md`** — die Sicherheitsregel bleibt, aber **allgemein formuliert**: „Nur unter `D:\toolsync` schreiben. Außerhalb des Projektordners nichts schreiben." **Keine Nennung von `D:\Web` mehr.**

**f) `.continue/rules/10-analysis-workflow.md`** — diese Datei ist zu **zwei Dritteln** Altprojekt-Analyse (Phasen 1–16, Sicherheitsregel, Definition einer vollständigen Analyse). Da die Analysephase abgeschlossen ist: **Datei auflösen.** Prüfen, ob darin eine wiederverwendbare Methodik steckt, die in eine schlanke Regel oder einen Prompt übernommen werden soll.

**g) `docs/15-ui-styleguide.md` und `.continue/rules/11-ui-styleguide.md`** — beide enthalten **keine** `D:\Web`-Nennung, müssen aber wegen 4.3 ohnehin neu geschrieben werden.

### 5.3 Nebenbefund: Doppelung Vision ↔ Requirements

`docs/00-project-vision.md` (614 Zeilen) und `docs/01-requirements.md` (25 Abschnitte) überschneiden sich erkennbar bei Benutzerverwaltung, Admin und Sicherheit.

Das ist ein guter Moment zum Zusammenführen: **beide Dateien müssen ohnehin angefasst werden** (Null-Bytes + Legacy). Vorschlag: eine verbindliche Anforderungs-Quelle, die Vision wird schlank (Zweck, Grundprinzipien, Zusammenarbeit mit Continue).

---

## 6. Geplante Umsetzung

### A. Korruption reparieren (zuerst, kein Anwendungscode betroffen)
Null-Bytes und BOMs entfernen aus `10-analysis-workflow.md`, `docs/00-project-vision.md`, `docs/01-requirements.md`.

### B. Legacy-Bereinigung
Abschnitt 5 abarbeiten: archivieren (5.1), herausschneiden (5.2), Source-of-Truth-Hierarchie neu nummerieren.

### C. Regeln neu ordnen — 13 → 10 Dateien

| Regel | Neue Aktivierung |
|---|---|
| `08-file-safety` | `alwaysApply: true` (bleibt, Text verallgemeinert) |
| `12-tool-call-format` | `alwaysApply: true` + **reparieren** |
| `00-project-overview` | `alwaysApply: true` (431 Tok — billig, verhindert Grundfehler) |
| `02-domain-rules` | `globs: ["**/*.py","**/*.tsx","**/*.ts"]` |
| `04-database` | `globs: ["**/models/**","**/migrations/**","**/*.py"]` |
| `05-frontend` | `globs: ["**/*.tsx","**/*.css"]` |
| `07-testing` | `globs: ["**/tests/**","**/*.spec.*","**/*.test.*"]` |
| `09-sap-optional` | `globs: ["**/*sap*","**/*integration*"]`, Duplikat raus |
| `10-analysis-workflow` | **aufgelöst** (Abschnitt 5.2 f) |
| `11-ui-styleguide` | **aufteilen in zwei Regeln** ↓ |

**Aufteilung der UI-Regel:**
- `11-ui-hauptfrontend` → `globs: ["frontend/src/components/{auth,tools,movements,storage,serial-articles}/**"]` — Glas-System, `.ui-*`
- `12-ui-adminpanel` → `globs: ["frontend/src/pages/admin/**","frontend/src/admin.css"]` — Split-Tone, `.admin-*`, mit den **echten Werten** aus `AdminPanel-Styleguide.html`

Ziel: statt 8.552 Tokens unsicher mitgeschleppt → **~600 Tokens präzise geladen**, genau bei der passenden Datei.

### D. Docs aufräumen
10 leere Platzhalter auflösen (füllen oder löschen). `docs/14-architecture.md` als verbindliche Architektur-Quelle festlegen. Vision und Requirements zusammenführen (Abschnitt 5.3).

### E. Tasks aufräumen
Eine `CURRENT_TASKS.md` mit **genau einer** aktiven Aufgabe. `PROJECT-PLAN.md` (19,9 KB) und alle abgeschlossenen Altprojekt-Tasks ins Archiv.

### F. Styleguide-Kopien umbauen
Kopie so umbauen, dass sie nur die **Regeln** enthält und nur das Markup-Beispiel der Komponente, an der gearbeitet wird. Ziel: von 42.878 auf wenige Tausend Tokens.

Auf `C:` existiert ein fertiger Prototyp (siehe Abschnitt 7): `toolsync-ui.css` (39,7 KB, 113 Klassen, mit Reset), `AGENTS.md` (10,2 KB Regelschicht), `ui-check.ps1` (Regelprüfer).

### G. Dark-Mode-Block aus `admin.css` entfernen — nach Bestätigung.

### H. Sicherheit
API-Keys widerrufen, MCP-Konfiguration auf Umgebungsvariablen umstellen, `.continue/mcpServers/` in `.gitignore` aufnehmen.

---

## 7. Vorhandene Werkzeuge auf `C:` (anderer Workspace)

In `C:\Users\abenz\Desktop\UI-Styleguide_ToolSync\AdminPanel-Styleguide\`:

- `toolsync-ui.css` — bereinigte Neuauflage der AdminPanel-Tokenschicht, 113 Klassen, mit eigenem Reset (self-contained), freie Farbwerte über 20 neue Tokens ersetzt
- `toolsync-showcase.css` — nur Guide-Gerüst
- `styleguide.html` — Guide, der `toolsync-ui.css` importiert statt eigener Kopien
- `AGENTS.md` — kompakte Regelschicht (Token-Tabellen, Vokabular, 12 Konventionen)
- `ui-check.ps1` + `_ui-check-core.js` — prüft HTML gegen die Regeln
- `_build_styleguide.js` — reproduzierbarer Umbau des Guides aus dem Original
- `_token_report.js` — erzeugt den Token-Budget-Bericht (Abschnitt 2)
- `HANDOFF-toolsync.md` — dieses Dokument
- `_pngregions.js`, `_pngprobe.js`, `_pngshift.js`, `_pngdiff.js` — Pixel-Vergleich von Screenshots
- `_shots/` — Vorher/Nachher-Screenshots

**Verifikationsergebnis des dortigen Umbaus:** Klassen-Diff 255 → 256 (entfernt: genau 3 `!important`-Utilities; neu: genau 4 Ersatzklassen), Element-Zählung in 11 HTML-Tags mit Diff = 0, `ui-check.ps1` gegen den neuen Guide: **0 Fehler**. Restabweichung ~14 % Pixel, eingegrenzt als Textmetrik-/Zeilenumbruch-Differenz — **nicht** als Layoutverschiebung (KPI-Kanten und Tabellenzeilen sitzen pixelgleich).

Diese Werkzeuge haben **keine** Abhängigkeit zum alten Ordner und können im neuen Workspace neu erzeugt werden.

---

## 8. Umgebung

- Node v24.18.0, npx, PowerShell 5.1
- Chrome + Edge headless vorhanden
- Frontend-Stack: **Tailwind v4.3.3**, React 19, Vite 8, TypeScript 6, Playwright 1.62, ESLint 10
- Playwright-CLI lokal: `frontend/node_modules/.bin/playwright.cmd`
- **DSH-Modell ist text-only** → Screenshots können nicht angesehen werden. Für visuelle Prüfung: entweder Nutzer lässt ein Vision-Modell wählen (`deepseek-v4-flash-vision-exp` ist in der DSH-Konfiguration vorhanden) oder Pixel-Diff in Zahlen nutzen.

---

## 9. Offene Fragen an den Nutzer

1. Wohin mit den reinen Altprojekt-Dateien (Abschnitt 5.1)? `docs/archive/` anlegen, außerhalb des Projekts verschieben, oder löschen?
2. Sollen Vision und Requirements zusammengeführt werden (Abschnitt 5.3)?
3. Sollen die 7 fehlenden `admin-*`-Klassen in `frontend/src/admin.css` ergänzt werden?
4. API-Keys zuerst widerrufen, bevor die MCP-Konfiguration umgestellt wird?
5. `docs/02`–`08`, `10`, `11` füllen oder löschen?
6. Dark-Mode-Block aus `admin.css` endgültig entfernen?

---

## 10. Reihenfolge für den Start

1. **Korruption reparieren** — 3 Dateien, größter Einzeleffekt, kein Anwendungscode betroffen
2. **Legacy-Bereinigung** — Abschnitt 5, inkl. Neunummerierung der Source-of-Truth-Hierarchie
3. **Regeln neu aufteilen** und Aktivierung festlegen
4. **`admin.css` gegen den Guide abgleichen**, 7 Klassen ergänzen
5. **Styleguide-Kopien umbauen**
6. **Docs und Tasks aufräumen**
7. **Keys widerrufen**, MCP auf Umgebungsvariablen
