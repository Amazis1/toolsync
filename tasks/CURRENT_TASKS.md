# ToolSync – Aktuelle Tasks

> **Diese Datei enthält genau eine aktive Aufgabe.**
> Abgeschlossene Aufgaben stehen in `tasks/archive/`.
>
> **Hinweis:** Die manuellen Browser-Prüfungen aus TASK-012 (AdminPanel) sind
> weiterhin offen, aber nicht die aktive Aufgabe – sie stehen am Ende der Datei.

**Stand:** Serienartikel sind fertig umgebaut: eigener Bereich mit Stammdatenbezug,
Verwaltung nur durch Admins, Artikelordner je Artikelnummer, Bilder mit
Vorschaubildern und Split-Screen-Viewer (DEC-056 bis DEC-059; TASK-016 bis TASK-018
abgeschlossen). Offen bleibt nur die Verifikation im AdminPanel (TASK-012).

---

## TASK-024 – Ersatzteile (Weg A) und Datenblatt (COMPLETED)

**Vollständiger Plan:** `tasks/24-ersatzteile-und-datenblatt.md`

**Auslöser (Projektinhaber):** Der Tab „Lager/Ersatz" wirkte wie ein Rest –
Ersatzwerkzeuge stehen ohnehin schon in der Werkzeugliste. Ersatz**teile** haben
eine Artikel-Nr. und keine Werkzeug-ID. Zusätzlich fehlt ein Bereich für die
**Werkzeug-Dokumentation** (PDFs mit den Einstellwerten, um ein Werkzeug in der
Maschine einzurichten); das Anlegeformular der Serienartikel soll dafür Vorbild
sein, nur mit „Werkzeug-ID" statt „Artikelnummer".

**Entschieden und dokumentiert (Schritt 1 ✅):**

| Entscheidung | Inhalt |
|---|---|
| **DEC-064** | Ersatz**werkzeuge** bleiben `Tool` mit `is_storage = true` in der Werkzeugliste; Ersatz**teile** werden die neue Entität `SparePart` (`spare_parts`) mit Tab „Ersatzteile". `storage_items` und `/api/storage` werden entfernt. Mengenbestand als Spalte `quantity` + `unit`, Werk Pflicht, Lagerort als Freitext, kein Mindestbestand. |
| **DEC-065** | Neuer Bereich **„Datenblatt"** (`data_sheets`, `/api/data-sheets`, Ablage `uploads/data_sheets/<id>/`), Feld **„Werkzeug-ID"** (empfohlen, nicht Pflicht), Werk Pflicht, Maschine optional, mehrere PDFs, Verwaltung nur Admin. Serienartikel-Logik bleibt unangetastet; nur der Datei-Betrachter wird generalisiert. |
| **DEC-066** | Tab-Leiste: **Werkzeuge · Serienartikel · Datenblätter · Ersatzteile · Historie**; „Lager/Ersatz" → „Ersatzteile"; ein Anlege-Einstieg mit Sub-Reitern; „Historie" bleibt Platzhalter. |

**Beleg für die Risikofreiheit:** `storage_items` enthält **0 Zeilen**
(`backend/toolsync.db`, nur lesend geprüft) – der Tab war deshalb dauerhaft leer.

**Ergebnis:** Beide Bereiche sind fertig. Der Tab „Lager/Ersatz" ist entfallen,
stattdessen gibt es **Ersatzteile** (Weg A) und **Datenblätter** (DEC-065); die
abgelöste `storage_items`-Welt ist entfernt. Das Bewegungspaket – Rückgabe-UI,
Benutzerzuordnung der Ausleihe, Historie/Logistik-Tab, Werkswechsel im
Datenmodell – ist **TASK-025** und kommt ausdrücklich zuletzt.

**Stand der Umsetzung – erledigt:**

| Prüfung | Ergebnis |
|---|---|
| Backend-Tests | **140 passed** (16 neue für Ersatzteile) |
| Browser-Tests | **78 passed** (9 Ersatzteile, 13 Datenblätter, Rest unverändert) |
| Migrationen | `a8f4c2d6e130` (Ersatzteile) und `c4b9e7a15f28` (Datenblätter) angewandt, auf- und abwärts geprüft, beide **idempotent** (halten `create_all` aus) |
| Typen/Lint | `npx tsc -b` und `npx eslint` ohne Fehler in den neuen Dateien |
| Datenbestand | unverändert: 16 Werkzeuge, 4 Serienartikel, 98 Bewegungen; keine Testdaten-Reste |
| Tab-Leiste | Werkzeuge · Serienartikel · Datenblätter · Ersatzteile · Historie |

> **Hinweis zur Browser-Prüfung:** Die Suite braucht einen laufenden Dev-Server
> auf `localhost:5173` und Unterprozesse (Playwright-Worker, Browser). Unter der
> Standard-Sandbox scheitert das mit `spawn EPERM`; der Lauf wurde deshalb
> einmalig mit weiterer Freigabe ausgeführt. Für eigene Läufe:
> `npx playwright test --workers=1` – die Projektkonfiguration prüft
> `127.0.0.1:5173`, der Dev-Server hier hört auf `localhost` (IPv6).

---

## TASK-027 – Ersatzteile: Feinschliff + Matrix-Lagerplatz (COMPLETED)

**Vollständiger Plan:** `tasks/27-ersatzteile-feinschliff.md`

**Auslöser (Projektinhaber):** „In Anlege-Formular Beschreibung aus dem
Eingabefeld raus holen und dadrüber schreiben. Freier Lagerort ist super! aber
bitte noch Lagerplätze der Werkzeug-Matrix hinzufügen! Die Tabelle anpassen, dass
sie wie andere aussieht."

**Erledigt:**

| Änderung | Ort |
|---|---|
| Beschriftung „Beschreibung" **über** dem Feld (nicht mehr als Innenlabel) | `SparePartForm.tsx` (und gleich im `DataSheetForm.tsx`) |
| Feldbezeichnung „Bezeichnung" → **„Name"** (wie in den anderen Formularen) | `SparePartForm.tsx` |
| Name als eigene Kennung (Mono-Kasten, Sky-Kante); **Spalten: Artikelnummer · Menge · Name/Typ · Lagerort · Werk · Maschine**; Lagerort als Mono-Kasten mit Sky-Kante (wie der Lagerplatz in der Werkzeugliste), Freitext daneben | `SparePartList.tsx` |
| Maschine mit **Farbpunkt aus den Stammdaten** (DEC-067) | `SparePartList.tsx` |
| **Matrix-Lagerplatz** (Variante A): Schrank/Schublade/Platz im Formular, nur freie Plätze; Platz gilt als **belegt**, erscheint in der Matrix als „Ersatzteil <Nr>" und ist für Werkzeuge gesperrt | Migration `f2a6c8d15b74`, `spare_part.py`, `storage.py`, `location_service.py`, `tool_service.py`, `spare_part_service.py`, `SparePartForm.tsx`, `ToolForm.tsx`, `SparePartList.tsx`, `AdminStorageLocations.tsx` |

**Belege:** Backend **150 passed** (10 neue in `tests/test_spare_part_position.py`),
Browser-Suite **77 passed / 7 skipped** (neu: „Anlegen mit Matrix-Platz"), `tsc`/`eslint`
fehlerfrei. DEC-064 und `docs/07` sind nachgezogen (der Satz „kein Matrix-Platz"
ist aufgehoben).

---

## TASK-026 – Datenblatt: Feinschliff nach der Abnahme (COMPLETED)

**Vollständiger Plan:** `tasks/26-datenblatt-feinschliff.md`

**Auslöser (Projektinhaber):** „Anlege-Formular: ‚Freiwillig: Abstreifer und
Matrize dürfen ohne ID existieren' weg. Beschreibung aus dem Feld nehmen. Bilder
auch möglich anzulegen machen. Liste: Name deutlich machen, Maschinen aus
Stammdaten mit Farbe, Favoriten-Hover prüfen."

**Ergebnis:**

| Änderung | Ort |
|---|---|
| Hinweis unter der Werkzeug-ID entfernt | `DataSheetForm.tsx` |
| Beschriftung aus dem Beschreibungsfeld entfernt (Feld bleibt, `aria-label` für Screenreader) | `DataSheetForm.tsx` |
| **Bilder** am Datenblatt: ein Dateifeld für PDF und Bilder, Vorschaubilder, einzelnes Löschen | `DataSheetForm.tsx`, `data_sheet_service.py`, `routers/data_sheets.py` |
| Name als eigene Kennung (Mono-Kasten, Sky-Kante) | `DataSheetList.tsx` |
| **Maschinenfarbe** aus den Stammdaten (`machines.color`, Migration `e7d1b9c34a52`, Farbwähler im Admin-Panel) | **DEC-067**, `master_data.py`, `AdminStammdaten.tsx`, `DataSheetList.tsx` |
| Maschinenfarbe im Admin-Panel gesetzt und in der Liste als Punkt sichtbar (eigener Browser-Test über den **Bedienweg**) | Browser-Test „Maschinenfarbe im Admin-Panel setzen" |
| Favoriten-Tönung überschreibt nicht mehr das Zebra, eigener Hover | `DataSheetList.tsx` |

**Belege:** Browser-Suite **81 passed** (16 Datenblätter, 4 neue), Backend
**140 passed**, `tsc`/`eslint` fehlerfrei. Die Spec setzt die Test-Maschinenfarbe
und gibt sie hinterher zurück (Datenbank danach: 0 Maschinen mit Farbe).

> **Befund:** `frontend/tests/` wird von `tsc -b` und `eslint` **nicht** geprüft
> (`tsconfig.app.json` hat `"include": ["src"]`) – ein Syntaxfehler in einer Spec
> fällt erst im Playwright-Lauf auf. Eigene Aufgabe, wenn das abgesichert werden
> soll.

---

## TASK-023 – Artikelnummer/Name deutlicher, Aktionen-Spalte ausgeschrieben (COMPLETED)

**Auslöser:** „Serienartikel: Artikelnummer und Name deutlich sichtbar machen.
Werkzeuge: Aktionen überschrift nicht als '…'."

### Umsetzung

- **`components/tools/ToolTable.tsx`** – der Spaltenkopf der letzten Spalte war
  `sr-only` und zeigte nur das Symbol `MoreHorizontalIcon` („…"). Jetzt steht dort
  das **Wort „Aktionen"** (rechtsbündig, gesperrt, wie die übrigen Köpfe); der
  unbenutzte Icon-Import ist entfernt. Die Spaltenbreite bleibt mit `w-[4.6rem]`
  fest, damit die Tabelle bei 1440 × 900 weiterhin ohne seitliches Scrollen passt.
- **`components/serial-articles/SerialArticleList.tsx`** – **Artikelnummer** und
  **Name** tragen jetzt **genau denselben Style wie Werkzeug-ID und Lagerplatz**
  in der Werkzeugliste: heller Kasten, `rounded-lg`, `px-2 py-0.5`, **Mono**,
  **14 px** (`text-sm`), fett, `tracking-tight`, dunkle Schrift. Unterschieden
  wird nur die Kante – **Teal = Nummer** (Identität, wie die Werkzeug-ID),
  **Sky = Name** (zweite Angabe, wie der Lagerplatz). Ohne Namen steht dort
  dieselbe ruhige neutrale Markierung wie für „Ablage"/„ohne ID"
  (DEC-055-Muster), nicht ein nacktes „—". Die Beschreibung steht klein und grau
  darunter – an der Stelle, wo in der Werkzeugliste Kategorie bzw. Werk stehen.
- **`SerialArticleList.tsx` (Typografie angeglichen)** – der eigentliche
  Unterschied lag nicht an der Markierung, sondern an der **Grundschrift der
  Tabelle**: die Serienartikel-Tabelle stand auf `text-sm` (14 px), die
  Werkzeugtabelle auf `text-xs` (12 px). Gemessen über `getComputedStyle`:
  Werkzeugzelle = Inter 12 px mit `padding: 8px 12px`, Serienartikelzelle =
  Inter 14 px mit `10px 12px`; die Markierungen selbst waren in beiden Listen
  identisch (ui-monospace, 14 px, 700, −0,35 px). Jetzt: `<table … text-left
  text-xs">` und Zellen `px-3 py-2` – die Markierungen stehen damit in beiden
  Listen gleich weit heraus.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` / `npx eslint` / `npm run build` | fehlerfrei |
| Browser-Prüfung (Playwright, `--workers=1`) | **38/38 grün** (16 Serienartikel + 22 Werkzeuge) |
| Neue Prüfung | `tools-list.spec.ts` (1440 × 900) **misst** jetzt Tabelle gegen ihren Bereich: die Tabelle darf nicht breiter sein als der sichtbare Platz – so fällt auf, wenn ein breiterer Aktionskopf die Spalte „Aktionen" aus dem Bild schiebt |
| Messung der Schriften | Einmalige Sonde über `getComputedStyle` in beiden Listen: Zelle Inter 12 px / `padding: 8px 12px`, Markierung ui-monospace 14 px / 700 / −0,35 px / `2px 8px` / Radius 8 px – **in beiden Listen gleich**. Die Sonde (`tests/_probe-font.spec.ts`) ist nach der Auswertung wieder gelöscht |
| Sichtprüfung | `.audit/shots/wt-09-1440.png` (Kopf „AKTIONEN" sichtbar, Tabelle passt), `sa-01-liste.png` (Artikelnummer im Kasten, Name fett) |

---

## TASK-022 – Serienartikel-Liste in Werkzeug-Optik (COMPLETED)

**Auslöser:** „Überschrift ‚Serienartikel durchsuchen' weg, Werk-Knöpfe so wie bei
Werkzeuge, Favoriten fehlen, Liste-Zebra fehlt – und schau, ob wir SVG in den
Listen nutzen können (Werkzeuge, Serienartikel)."

### Umsetzung

- **Backend (Favoriten, DEC-063)**
  - `models/serial_article.py`: `is_favorite` (`NOT NULL`, Default `false`),
    Migration `b6f2c8d41a77`.
  - `schemas/serial_article.py`: `is_favorite` in der Antwort,
    `SerialArticleFavoriteUpdate`.
  - `crud`/`service`: `favorites_only`-Filter und `set_favorite()`.
  - `routers/serial_articles.py`: `favorites_only` als Listenparameter und
    `PUT /{id}/favorite` (`require_active` – wie bei den Werkzeugen, kein
    Admin-Recht, weil die Markierung nichts am Bestand ändert).
- **Frontend**
  - `SerialArticleList.tsx`: Kopfzeile mit Überschrift + **Werk-Segmenten**
    (`.ui-segments`, Radios) + **Favoriten-Umschalter** + „Zurücksetzen";
    **Suchfeld ohne sichtbare Beschriftung** (Lupe, Löschknopf, Ladeanzeige,
    `aria-label`); **Zebra + Glasverlauf** (`table-row-glass`, `even:bg-white/40`);
    **Favoriten-Stern** je Zeile mit Amber-Zeilenfarbe und optimistischem
    Umschalten; **Sortierzeichen als SVG-Icons** statt `▲▼↕`; gemessener
    **Überlauf-Hinweis** wie in der Werkzeugliste.
  - `App.tsx`: Überschrift aus der Seite entfernt – sie kommt jetzt mit den
    Schnellfiltern in einer Zeile aus der Liste (wie bei den Werkzeugen).
  - `api/serialArticles.ts`: `setSerialArticleFavorite()`.

Details: `docs/13-decisions.md` → **DEC-063**.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **124 passed** (+3: Favorit setzen/filtern, Favorit überlebt das Bearbeiten, unbekannte ID) |
| Migration | `alembic upgrade head` auf der Dev-Datenbank (`a7c3e19f4b21 → b6f2c8d41a77`); `PRAGMA table_info(serial_articles)` zeigt `is_favorite` |
| Browser-Prüfung (Playwright, `--workers=1`) | **16/16 grün**; neu: „markiert Favoriten und filtert darauf" (Stern setzen → `aria-pressed`, Amber-Zeile, „Nur Favoriten" zeigt genau einen Eintrag, Stern wieder entfernen) |
| Regression | `tools-list.spec.ts` **22/22 grün** (beide Specs zusammen 38/38) |
| `npx tsc -b` / `npx eslint` / `npm run build` | fehlerfrei |
| Sichtprüfung | `.audit/shots/sa-01-liste.png` (Zebra, Sterne, Segmente), `sa-07-1440.png` (alle Spalten inkl. „Aktionen" sichtbar) |

**Zur SVG-Frage:** Beide Listen nutzen jetzt ausschließlich SVG-Icons aus
`components/icons.tsx` (Sortieren, Stern, Lupe, `XIcon`) – die Textglyphen `▲▼↕`
und `✕` in der Serienartikel-Liste sind ersetzt. Offen bleibt nur das `×` in den
Meldungsrahmen (`.ui-alert`), das projektweit an Audit **A-17** und die
Entscheidung **K-04/K-05** (Icon-Satz) hängt.

### Bekannte Grenzen (bewusst offen)

- **Keine** Favoriten pro Benutzer und **keine** Sortierung nach Favoriten.
- Bei Fenstern unter ~1300 px scrollt die Tabelle seitlich (Hinweis erscheint);
  bei 1440 × 900 passt sie vollständig.
- Die Chip-Zeile „Aktive Filter" der Werkzeugliste gibt es hier nicht – zwei
  Schnellfilter und die Suche plus „Zurücksetzen" genügen.

---

## TASK-021 – Mehrere Einrichtepläne und Dateiverwaltung in der Bearbeitung (COMPLETED)

**Auslöser:** „Was ist, wenn ich zwei Pläne habe für diesen Artikel?" und „Es muss
möglich sein, dass ich in der Bearbeitung etwas löschen oder ergänzen kann." Die
Bearbeitung zeigte nur Hinweissätze („Einrichteplan ist hinterlegt – eine neu
ausgewählte PDF ersetzt ihn", „3 Bilder sind hinterlegt – neue Bilder kommen
hinzu"), ein zweiter Upload ersetzte den Plan, und der Plan war einzeln nicht
löschbar.

### Umsetzung

- **Backend**
  - `services/serial_article_service.py`: `is_plan_name()` / `_plan_index()`
    (Altbestand `plan.pdf` = erster Plan), `_write_plans()` (`plan-2.pdf`,
    `plan-3.pdf` …), `_plan_names()`, `_next_plan_name()` (erster Plan bleibt
    `plan.pdf`), `_first_plan_path()`, `list_files()` (Pläne + Bilder),
    `sync_pdf_path()` und `delete_file()` (Plan **und** Bild, `pdf_path` wird
    nachgeführt). `_as_file_list()` nimmt eine oder mehrere Dateien – geprüft
    gegen die **Starlette**-Klasse, weil FastAPIs `UploadFile` eine Unterklasse
    ist (sonst schlug jeder Testaufruf mit einem einzelnen UploadFile fehl).
  - `schemas/serial_article.py`: `ArticleFileRead.kind` = `plan` | `image`,
    `plans` in der Antwort.
  - `routers/serial_articles.py`: `plans` (mehrfach) in POST/PUT,
    `DELETE /{id}/files/{name}` gilt auch für Pläne.
- **Frontend**
  - `SerialArticleForm.tsx`: Abschnitt **„Hinterlegte Dateien"** (Pläne und
    Bilder mit Name, Größe, Art und **Löschen**-Knopf, wirkt sofort) und
    **„Kommt beim Speichern dazu"** (neue Auswahl, einzeln entfernbar); die
    beiden Hinweissätze sind entfallen.
  - `PDFViewer.tsx`: linke Liste mit **allen** Plänen (je mit Dateiname) und
    Bildern; `PlanBuehne` lädt den gewählten Plan über `/files/{name}`;
    Kopfzeilen-Aktion „Einrichteplan entfernen" / „Bild entfernen"; der
    Bestätigungstext nennt die Folge („Das ist der letzte Einrichteplan …").
  - `SerialArticleList.tsx`: Spalte „Dateien" zeigt „PDF", „N Pläne" oder
    „Kein PDF" plus „1 Bild" / „N Bilder".
  - `api/serialArticles.ts`: `plans` + `images` im Formular,
    `getSerialArticleFile()` / `deleteSerialArticleFile()`;
    `getSerialArticlePdf()` entfernt (der Viewer lädt je Datei).

Details: `docs/13-decisions.md` → **DEC-062**.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **121 passed** (+5: zweiter Plan kommt hinzu, mehrere Pläne in einer Anfrage, Plan löschen führt `pdf_path` nach, letzter Plan hebt `has_pdf` auf, Plan ist einzeln löschbar) |
| Browser-Prüfung (Playwright, `--workers=1`) | **15/15 grün**; neu: „verwaltet mehrere Pläne und Dateien in der Bearbeitung" (Liste „2 Pläne"/„1 Bild", beide Pläne im Datei-Fenster auswählbar, Plan ergänzen → `plan-3.pdf`, Plan löschen → `plan-2.pdf` weg, Bild bleibt), Beleg `.audit/shots/sa-08-mehrere-plaene.png` |
| `npx tsc -b` / `npx eslint` / `npm run build` | fehlerfrei |
| Regression | `tools-list.spec.ts` **22/22 grün** |

### Bekannte Grenzen (bewusst offen)

- **Keine** Umbenennung bestehender Dateien und **keine** Migration: `plan.pdf`
  bleibt als erster Plan gültig.
- **Keine** Reihenfolge-Pflege (Sortieren/„nach oben") – die Nummer im Namen
  bestimmt die Reihenfolge.
- **Kein** Einzel-Download von Bildern (nur der Plan hat „Herunterladen").
- **Kein** Papierkorb: Löschen ist endgültig und wird bestätigt.
- Die Dateiliste wird je Artikel aus dem Ordner gelesen (ein `listdir` pro Zeile
  in der Liste) – bei sehr vielen Artikeln je Seite ist das ein eigener
  Optimierungspunkt.

---

## TASK-020 – Bildansicht: Zoom, Drehen, größeres Fenster (COMPLETED)

**Auslöser:** „Beim Vorschaun von Bild gibt es keine Möglichkeit zu zoomen, drehen
etc. Das View-Modal sollten wir auch ein bisschen größer machen."

### Umsetzung

- `frontend/src/components/serial-articles/PDFViewer.tsx`: `BildBuehne` mit
  Werkzeugleiste (Verkleinern / Prozentanzeige / Vergrößern, Drehen links und
  rechts, Zurücksetzen), Zoomstufen 50–400 % (100 % = eingepasst), Verschieben
  per Ziehen bei Zoom oder Drehung; Fenster auf `94dvh` / `95vw` bzw. `1400px`
  vergrößert, Dateiliste 16 rem.
- `frontend/src/components/icons.tsx`: vier neue Icons (ZoomIn, ZoomOut,
  RotateLeft, RotateRight) nach der Icon-Regel (24er viewBox, `currentColor`,
  `stroke-width="2"`).
- `frontend/src/components/serial-articles/SerialArticleList.tsx`: Beschreibung
  als zweite Zeile unter dem Namen („Name / Beschreibung"), Datei-Badges kurz
  („PDF", „Kein PDF", „N Bilder"), Aktionsspalte `w-14` – **gemessener Grund:**
  die Tabelle war 888 px breit bei 815 px Platz, dadurch lagen „Dateien" und
  „Aktionen" außerhalb des sichtbaren Bereichs.

Details und Begründung: `docs/13-decisions.md` → **DEC-061**.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| Browser-Prüfung (Playwright, `--workers=1`) | **14/14 grün**; neu: Zoom (100 → 125 → 150 %), Drehen (data-rotation 90), Zurücksetzen, „Ziehen verschiebt das Bild", sowie die Layout-Messung bei 1440 × 900 (`Tabelle ≤ Bereich`, alle Spalten sichtbar, „…"-Knopf sichtbar) |
| Belege | `.audit/shots/sa-06-zoom.png` (150 % und gedreht), `sa-07-1440.png` (Liste komplett) |
| `npx tsc -b` / `npx eslint` / `npm run build` | fehlerfrei |
| Regression | `tools-list.spec.ts` **22/22 grün**, `pytest tests/` **118 passed** (Backend unverändert) |

**Erkenntnis beim Testen:** Der erste Overflow-Test griff versehentlich die
Tab-Leiste (`div.overflow-x-auto` gibt es zweimal) und meldete fälschlich „passt".
Jetzt wird direkt die Tabelle gegen ihren Behälter gemessen (`getBoundingClientRect`).

---

## TASK-019 – Ein Dateifeld für Einrichteplan und Bilder (COMPLETED)

**Auslöser:** „Warum werden PDFs und Bilder getrennt hochgeladen? Kann man es
zusammenfassen?" – Verschickt wurden sie schon immer in **einer** Anfrage;
getrennt waren nur die zwei Auswahlflächen im Formular.

### Umsetzung

- `frontend/src/components/serial-articles/SerialArticleForm.tsx`: **eine**
  Dropzone mit `DOC_ACCEPT` (PDF **und** Bilder, Mehrfachauswahl), `isPlan()` und
  `isBild()` sortieren die Auswahl; erstes PDF wird der Plan (bei mehreren ein
  Info-Hinweis), alles andere wird Bild.
- Auswahlliste unter dem Feld: Plan-Zeile (Symbol, Name, KB, „Einrichteplan") und
  je Bild eine Zeile mit Vorschau, Name, KB, „Bild" – **einzeln entfernbar** (✕).
- Hinweiszeilen für hinterlegte Dateien unverändert; Rückfrage „Andere PDF wählen"
  entfällt, weil die Liste den Zustand zeigt.
- Backend unverändert: `POST`/`PUT` bekommen weiterhin `file` und `images`
  getrennt – die Zerlegung ist Oberflächenlogik.

Details: `docs/13-decisions.md` → **DEC-060**.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| Browser-Prüfung (Playwright, `--workers=1`) | **13/13 grün**; der Anlege-Test wählt PDF **und zwei Bilder in einem Schritt** (`getByLabel('Einrichteplan oder Bilder auswählen')`) und prüft die Auswahlliste samt Entfernen-Knopf |
| `npx tsc -b` / `npx eslint` | fehlerfrei |
| Regression | `tools-list.spec.ts` **22/22 grün**, `pytest tests/` **118 passed** (Backend unverändert) |

---

## TASK-018 – Vorschaubilder in fester Größe und Split-Screen-Viewer (COMPLETED)

**Auslöser:** „Kann zum Vorschau bestimmte Größe genommen werden?" und „Mache
bitte ein PDF/Bild-Viewer Split-Screen (mit Thumbnails)". Vorher lud das
Datei-Fenster jedes Bild in voller Größe (Handyfotos 5–8 MB) und wechselte
zwischen zwei Reitern, statt Plan und Bilder gleichzeitig zu zeigen.

### Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|---|---|
| Vorschaugröße | **Feste Größe**: maximal 400 × 400 px, JPEG (Qualität 80), Seitenverhältnis bleibt |
| Ablage der Vorschau | `.thumbs/<name>.jpg` im Artikelordner – Zwischenspeicher, zählt nicht als Bild |
| Großansicht | Weiterhin das **Original**; nur die Dateiliste lädt die kleine Vorschau |
| Aufbau des Fensters | **Split-Screen**: links Dateiliste mit Thumbnails, rechts die große Ansicht (ersetzt die Reiter) |
| Ohne Bildbibliothek | Rückfall auf das Original – kein Fehler |

Details und Begründung: `docs/13-decisions.md` → **DEC-059**.

### Umsetzung

- **Backend**
  - `services/serial_article_service.py`: `THUMB_DIR_NAME`, `THUMB_MAX_SIZE`
    (400 × 400), `THUMB_QUALITY`, `thumbnail_path()` (erzeugt einmal, merkt sich
    die Datei, prüft das Alter gegen das Original, fällt bei jedem Fehler auf das
    Original zurück) und `_remove_thumbnail()` beim Löschen eines Bildes.
    Pillow wird **optional** importiert.
  - `routers/serial_articles.py`: `GET /{id}/files/{name}?variant=thumb`.
  - `requirements.txt`: `Pillow==12.2.0` ergänzt.
- **Frontend**
  - `components/serial-articles/PDFViewer.tsx`: Split-Screen mit
    `nav aria-label="Dateien des Serienartikels"` (Einrichteplan + je Bild eine
    Kachel mit Vorschaubild, Name, Größe, `aria-current`), rechts die große
    Ansicht (iframe oder Originalbild), Kopfzeilen-Aktionen je Auswahl.
  - `api/serialArticles.ts`: `getSerialArticleImage(id, name, 'thumb')`.
- **Tests**
  - `backend/tests/test_serial_articles.py`: **5 neue Tests** (66 in dieser Datei).
  - `frontend/tests/serial-articles.spec.ts`: Split-Screen-Test ersetzt den Reiter-Test.

**Nacharbeit aus der Sichtprüfung:** Der „Ansehen"-Knopf (Menüeintrag „PDF
ansehen"/„Bilder ansehen") ist **entfallen** – ein Klick auf die **Zeile** öffnet
das Datei-Fenster (Plan, sonst erstes Bild), per Tastatur Tab + Enter/Leertaste.
Das Zeilenmenü „…" enthält nur noch „Bearbeiten"/„Löschen" und wird nur Admins
gezeigt; der umschließende Wrapper stoppt den Klick, damit das Menü nicht die
Vorschau mit öffnet.

**Beim Testen gefundener Fehler:** `bild.convert("RGB").thumbnail(...)` verkleinert
nur die **Kopie** – gespeichert wurde das unveränderte Original (Test schlug mit
1200 px statt 400 px fehl). Jetzt wird die Kopie in einer Variablen gehalten.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **118 passed** (vorher 113; + 5 neue) |
| `npx tsc -b` / `npx eslint` (geänderte Dateien) | keine Fehler |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| API-Probe (`GET …?variant=thumb`) | 1400 × 900 / 6.660 Bytes PNG → **400 × 257 / 925 Bytes JPEG**; Cache `.thumbs/bild-1.jpg` angelegt; Original unverändert (6.660 Bytes, `image/png`); unbekanntes Bild → 404; Artikel löschen → Ordner samt Cache weg |
| Browser-Prüfung (Playwright, `--workers=1`) | **13/13 grün**; Beleg `.audit/shots/sa-05-bilder.png` |
| Regression | `tools-list.spec.ts` **22/22 grün** |

> **Hinweis für den Betrieb:** Der Vorschau-Endpunkt ist neu. Läuft das Backend
> ohne `--reload`, muss es **einmal neu gestartet** werden – sonst liefert der
> Server weiterhin die Originale (die Anzeige funktioniert, lädt aber groß).

### Bekannte Grenzen (bewusst offen)

- **Eine** Vorschaugröße (400 px); keine Varianten und kein Lazy-Loading in der Liste.
- **Keine Vorschau des PDFs** (keine gerenderte erste Seite).
- Ohne installiertes Pillow bleibt es beim Original (dann lädt die Liste groß).
- HEIC (Apple) kann Pillow ohne Zusatzpaket nicht lesen → auch dort das Original.

---

## TASK-017 – Serienartikel: Formular in Werkzeug-Optik, Bilder zum Plan (COMPLETED)

**Auslöser:** Vier Nacharbeiten aus der Sichtprüfung durch den Auftraggeber:
(1) „Die Inputs so wie in Werkzeug – Überschrift im Input", (2) „Beschreibung
soll ein normales Feld zum Schreiben sein", (3) „Möglichkeit, auch Bilder mit dem
PDF hochzuladen", (4) drei Hilfetexte im Formular entfernen.

### Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|---|---|
| Feldaufbau | Innenlabel (`.ui-field`, Guide §1.9) wie im Werkzeugformular; Beschreibung als mehrzeiliges Feld mit Label darüber |
| Hilfetexte | Die drei Hinweise („Einrichtepläne sind ein eigener Bereich …", „Eigene Nummer des Einrichteplans …", „Ablage: eigener Ordner je Artikelnummer …") entfallen ersatzlos |
| Bilder | Mehrere Bilder je Artikel, hochladbar zusammen mit dem Plan; liegen im **Artikelordner** (kein Unterordner) |

Details und Begründung: `docs/13-decisions.md` → **DEC-058**.

### Umsetzung

- **Backend**
  - `services/serial_article_service.py`: `IMAGE_PREFIX`/`IMAGE_EXTENSIONS`,
    `_write_images()` (fortlaufender Name über **alle** Bilder, damit
    `skizze.PNG` neben `bild-1.jpg` nicht ebenfalls `bild-1.png` heißt),
    `list_images()` (nach Zahl sortiert, `bild-2` vor `bild-10`),
    `resolve_article_file()` (nur reiner Dateiname, nur im Artikelordner, nur
    Plan oder Bild), `delete_image()` (Plan ausgenommen), `media_type_for()`.
  - `schemas/serial_article.py`: `ArticleFileRead`, `SerialArticleRead.images`.
  - `routers/serial_articles.py`: `images` in POST und PUT, `GET /{id}/files/{name}`,
    `DELETE /{id}/files/{name}` (nur Admin), `_to_read()` setzt die Bildliste.
- **Frontend**
  - `components/serial-articles/SerialArticleForm.tsx`: `.ui-field`-Felder,
    Beschreibung als `textarea` (3 Zeilen), zweite Dropzone für Bilder (mehrere,
    Vorschau, vor dem Speichern entfernbar), Hilfetexte entfernt.
  - `components/serial-articles/PDFViewer.tsx`: zwei Reiter („Einrichteplan" /
    „Bilder (N)"), Vorschaugitter mit Großansicht, „Entfernen" je Bild (nur Admin)
    mit Bestätigungsdialog und `onImagesChanged`.
  - `components/serial-articles/SerialArticleList.tsx`: Spalte **Dateien** (Badge
    „PDF vorhanden"/„Kein PDF" plus „1 Bild"/„N Bilder"), Menüeinträge
    „PDF ansehen" und „Bilder ansehen (N)".
  - `api/serialArticles.ts`, `types/serial-article.ts`: `images` im Formular,
    `getSerialArticleImage()`, `deleteSerialArticleImage()`.
  - `App.tsx`: Datei-Fenster mit Startreiter und `onImagesChanged`.
- **Tests**
  - `backend/tests/test_serial_articles.py`: **17 neue Tests** (61 in dieser Datei).
  - `frontend/tests/serial-articles.spec.ts`: **13 Tests** (neu: Bilder ansehen und
    einzeln entfernen; der Anlege-Test lädt jetzt PDF **und zwei Bilder**).

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **113 passed** (vorher 96; + 17 neue) |
| `npx tsc -b` | keine Fehler |
| `npx eslint` (geänderte/neue Dateien) | **0 Treffer** |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| Browser-Prüfung (Playwright, `--workers=1`) | **13/13 grün** (`serial-articles.spec.ts`), Beleg `.audit/shots/sa-05-bilder.png` |
| Regression | `tools-list.spec.ts` **22/22 grün** |

**Falle beim Testen:** `getByLabel('Werk', { exact: true })` findet das Feld im
Formular **nicht** – Playwright gleicht den Label-**Text** ab, und mit dem
Pflichtmarker lautet er „Werk *". Im Formular deshalb ohne `exact`, in der
Filterleiste der Liste (Label exakt „Werk") mit `exact: true`.

### Bekannte Grenzen (bewusst offen)

- **Keine Größen- und Inhaltsprüfung** – auch für Bilder wird nur die Endung
  geprüft (DEC-056 Punkt 12, DEC-058 Punkt 5).
- **Keine Bildbearbeitung** (verkleinern, drehen) und keine serverseitigen
  Vorschaubilder; die Miniaturen rendert der Browser aus dem Bild.
- Bilder lassen sich **einzeln entfernen, nicht umbenennen oder sortieren** – die
  Nummer im Namen ergibt sich aus der Ablage.
- Jedes Bild wird als **ganzes Bild** geladen (Blob) – bei sehr vielen großen
  Fotos kann das Fenster träge werden.

---

## TASK-016 – Serienartikel: Stammdaten, Admin-Verwaltung, Artikelordner (COMPLETED)

**Auslöser:** Der Bereich war ein reines Dokumentenarchiv. `serial_articles` hatte
nur Artikelnummer, Beschreibung und PDF-Pfad – ein Plan war deshalb **nur über
die Artikelnummer** auffindbar; Kunde, Maschine und Werk standen im PDF und waren
nicht durchsuchbar. Die Routen prüften **nur** `require_active`: jeder aktive
Benutzer durfte PDFs hochladen und löschen (in `docs/14-architecture.md` §10 als
„Auth-Lücke `serial_articles`" geführt). Das in Anforderung 6.1 genannte
**Ersetzen** fehlte ganz, die Liste holte höchstens 100 Datensätze ohne
Gesamtzahl und ohne feste Sortierung, und der Sub-Reiter „Serienartikel" im
Werkzeugformular war ein Platzhaltertext. Die PDFs lagen flach als
`uploads/serial_articles/<uuid>.pdf` – ohne Bezug zum Artikel.

### Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|---|---|
| Verwalten (anlegen, bearbeiten, ersetzen, löschen) | **nur Admins**, serverseitig `require_admin` |
| Suchen / ansehen / herunterladen | alle aktiven Benutzer |
| Pflichtfelder | Artikelnummer und **Werk**; Name, Kunde, Maschine, Beschreibung freiwillig |
| Bezug zu Werkzeugen | **keiner** – Serienartikel sind eine eigene Kategorie, ohne Werkzeug-ID |
| Kunde/Maschine/Werk | Stammdaten aus dem Admin-Panel (Auswahl, kein Freitext) |
| Anlegen/Bearbeiten | im Serienartikel-Bereich **und** im Sub-Reiter des Werkzeugformulars; **getrennt** gespeichert |
| Vorbelegung im Werkzeugformular | Kunde/Maschine/Werk aus der Werkzeugmaske, dort änderbar, ohne Rückwirkung |
| Doppelte Artikelnummer | Prüfung **beim Tippen** (wie die Werkzeug-ID, DEC-054) und im Backend |
| Liste | Suche über Artikelnummer, Name, Beschreibung, Kunde, Maschine, Werk · Sortierung · Blätterleiste · Gesamtzahl · **keine 100er-Grenze** |
| Ersetzen der PDF | über `PUT`, alte Datei wird entfernt |
| Dateiablage | **Ordner je Artikelnummer** (`uploads/serial_articles/<Artikelnr>/`), Plan als `plan.pdf` |
| `extra_metadata` | entfällt |
| Größen-/MIME-Prüfung | **nicht** – bewusst akzeptiert |

Details und Begründung: `docs/13-decisions.md` → **DEC-056** und **DEC-057**.

### Umsetzung

- **Backend**
  - `models/serial_article.py`: `name`, `plant_id` (Pflicht, `RESTRICT`),
    `customer_id` / `machine_id` (`SET NULL`), `plant`/`customer`/`machine`
    `lazy="joined"`, Property `has_pdf`; `extra_metadata` entfällt.
  - Migration `a7c3e19f4b21_serial_articles_stammdaten.py` (Batch-Modus;
    bestehende Zeilen bekommen das erste Werk, danach `plant_id` NOT NULL).
  - `schemas/serial_article.py`: `SerialArticleCreate`/`Update`/`Read`
    (mit `has_pdf` statt Pfad), `SerialArticlePage`, `ArticleNumberCheck`;
    Normalisierung von Nummer und optionalen Texten.
  - `services/serial_article_service.py`: Artikelordner je Nummer
    (`sanitize_folder_name`, `article_dir`, Umbenennen, `rmtree` nur innerhalb der
    Ablage), Plan als `plan.pdf`, Pfadauflösung gegen `BACKEND_DIR` mit
    Wurzel-Prüfung, Stammdatenprüfung, Nummernprüfung.
  - `crud/crud_serial_article.py`: Suche über Artikelnummer, Name, Beschreibung,
    Werk, Kunde, Maschine; Filter; Sortier-Whitelist mit `NULLS LAST` und
    `id`-Tiebreaker; `total`; `apply_update()` übernimmt auch bewusst gesendete
    `None`-Werte.
  - `routers/serial_articles.py`: `require_admin` für POST/PUT/DELETE,
    neuer `PUT /{id}`, `GET /check-number`, Liste mit Filtern/Sortierung/Seite,
    `DELETE` mit 404; Multipart-Werte „fehlend = unverändert, leer = leeren“.
- **Frontend**
  - `api/client.ts`: Formulardaten-tauglich (kein `Content-Type` bei `FormData`,
    `http.blob()` für die PDF).
  - `api/serialArticles.ts` (neu), `types/serial-article.ts` (neu gefasst).
  - `components/serial-articles/SerialArticleForm.tsx` (neu): beide Einsatzorte,
    Live-Prüfung der Nummer (400 ms), Werk/Kunde/Maschine, PDF-Upload und
    -Ersetzen. **Ohne eigenes Fenster** – es sitzt im Anlege-Formular.
  - `components/serial-articles/SerialArticleList.tsx`: Suche, Werk-Filter,
    Sortierung mit `aria-sort`, Blätterleiste mit Gesamtzahl, **getrennte Spalten
    für Artikelnummer und Name**, Kunde mit **Farbpunkt aus den Stammdaten**
    (wie in der Werkzeugliste), Zeilenaktionen im „…"-Menü (`RowActionMenu`),
    Leerzustände mit Ausweg, Löschbestätigung mit Konsequenz.
  - `components/serial-articles/PDFViewer.tsx`: Kopfzeile mit Werk/Kunde/Maschine,
    Zustandsobjekt statt drei Flags.
  - `components/tools/ToolForm.tsx`: Sub-Reiter „Serienartikel" wird echt
    (Vorbelegung aus der Werkzeugmaske, eigener Speichern-Knopf); neue Props
    `initialSubTab` und `initialSerialArticle`, damit das **eine** Anlege-Formular
    auch das Bearbeiten aus dem Serienartikel-Bereich übernimmt.
  - `components/tools/ToolPagination.tsx`: `ariaLabel`/`itemSingular`/`itemPlural`
    als Props (Wiederverwendung durch die Serienartikel-Liste).
  - `components/ConfirmDialog.tsx`: rendert in einem Portal an `<body>`
    (Glasflächen mit `backdrop-filter` sind Bezugsrahmen für `position: fixed`).
  - `pages/Tools.tsx`: nimmt den Einmal-Auftrag `serialRequest` an, öffnet die
    Karte mit dem Reiter „Serienartikel" und führt nach dem Speichern bzw. über
    „Zurück" in den Serienartikel-Bereich zurück.
  - `App.tsx`: „+ Anlegen" und „Bearbeiten" legen nur noch den Auftrag an (kein
    Modal), Toasts, Verwaltungs-Knöpfe nur für Admins;
    `SerialArticleUpload.tsx` (alt) entfernt.
- **Tests**
  - `backend/tests/test_serial_articles.py` (neu, 44 Tests).
  - `frontend/tests/serial-articles.spec.ts` (neu, 12 Browser-Tests).

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **96 passed** (vorher 52; + 44 neue) |
| `npx tsc -b` | keine Fehler |
| `npx eslint` (geänderte/neue Dateien) | **0 Treffer**; offen bleiben nur die projektweit vorbestehenden Regeln (ToolForm.tsx, ToolFormModal.tsx, MovementLog.tsx, AuthContext.tsx, AdminStorageLocations.tsx, `tools-list.spec.ts`) |
| `npm run build` | fehlerfrei (vite v8.1.5, 68 Module) |
| Migration | `alembic upgrade head` auf der Dev-Datenbank (`c1d5f7a2e903 → a7c3e19f4b21`); `PRAGMA table_info(serial_articles)` zeigt `name`/`plant_id`/`customer_id`/`machine_id`, `extra_metadata` ist weg; drei Fremdschlüssel mit `SET NULL`/`RESTRICT` |
| API-Probe gegen das laufende Backend (`.audit/probe-serial-articles.ps1`) | Anlegen mit Werk/Kunde/Maschine/PDF → 201, Ordner `99887766/plan.pdf` auf der Platte; doppelte Nummer → 400; Nummernprüfung → deutsch; fehlendes Werk → 400; Nicht-PDF → 400; Nicht-Admin: Liste/Detail/PDF/Prüfung **200**, POST/PUT/DELETE **403**; PDF-Auslieferung `application/pdf` mit `filename="99887766.pdf"`; `PUT` benennt um (alter Ordner weg, neuer da), leert den Kunden und ersetzt den Plan (Inhalt B); ungueltige Sortierspalte → 422; `DELETE` → 204, Ordner weg, zweiter `DELETE` → 404 |
| Browser-Prüfung (Playwright, Chromium, `--workers=1`) | **12/12 grün** (`serial-articles.spec.ts`), Belege in `.audit/shots/sa-01…sa-04` |
| Regression der bestehenden Specs | `tools-list.spec.ts` **22/22 grün** (Werkzeugliste inkl. Speichern/Zurück-Weg und Admin-Dashboard). `login.spec.ts` und `admin-storage.spec.ts` haben **6 vorbestehende Fehler** (unveränderte Dateien: `getByRole('heading', { name: 'ToolSync Login' })` existiert nicht, `getByRole('textbox', { name: 'Admin-Passwort' })` greift nicht auf `input[type=password]`) – nicht durch diese Aufgabe verursacht, bereits in TASK-012 als offener Punkt geführt |

Beim Aufbau der Spec gefundene und behobene Testfallen (für spätere Specs wichtig):
Eine Suche darf nicht nur auf eine passende Zeile warten – bei 12 Datensätzen steht
sie schon in der ungefilterten ersten Seite, der Klick traf dann die erste Zeile der
alten Liste. `suche()` wartet deshalb, bis **alle** sichtbaren Zeilen den Suchbegriff
enthalten. Außerdem sind `getByLabel('Werk')` (drei Treffer im Werkzeugformular:
`Werkzeug-ID`, `Werkzeug-Typ`, `Werk`, dazu `Werk *` im Serienartikel-Reiter) und
`getByRole('button', { name: /Werk/ })` („Werkzeuge"-Tab) mehrdeutig – `exact: true`
bzw. `Werk *` sind nötig. Und: keine feste Gesamtzahl erwarten, im Bestand können
weitere Serienartikel liegen.

### Bekannte Grenzen (bewusst offen)

- **Kein Foto-Upload.** Der Artikelordner ist dafür vorbereitet (DEC-057), die
  Oberfläche kennt bisher nur den Einrichteplan.
- **Keine Größen- und Inhaltsprüfung** der hochgeladenen Datei (DEC-056 Punkt 12).
- **Keine feingranulare Berechtigung**: geprüft wird `User.is_admin`, nicht
  `Permission.codename` (`docs/02-domain-model.md` §9, offener Punkt 6).
- **Nur Werk-Filter in der Oberfläche**: das Backend kann bereits nach Kunde,
  Maschine und „mit/ohne PDF" filtern (`docs/06-serial-articles.md` §11).
- Die Kennzahl „Serienartikel" in der Statistikleiste zeigt weiterhin „—"
  (Audit A-27).
- Der Arbeitsordner `uploads/` bleibt ungetrackt und entsteht zur Laufzeit.

---

## TASK-015 – Anlegeformular: Werkzeug-ID je Kategorie (COMPLETED)

**Auslöser:** „Beim Abstreifer und Matrize ist es anders wie beim Stempel: ID ist
nicht Pflicht, Maß schon." Das Formular erzwang die Werkzeug-ID für **alle**
Kategorien (`required` am Feld plus Prüfung in `handleSubmit()`). Für Abstreifer
und Matrize – beide werden über ihr Maß geführt – musste sich der Benutzer eine
ID ausdenken oder den Datensatz im Altsystem suchen.

### Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|---|---|
| Leere ID | Leer erlaubt → `NULL` in der Datenbank, Anzeige „ohne ID" (keine automatische Vergabe) |
| Pflichtfelder | Maß A, Werk und Werkzeug-Typ bleiben für alle Kategorien Pflicht; Maß B bleibt freiwillig |

Details und Begründung: `docs/13-decisions.md` → **DEC-055**.

### Umsetzung

- **Backend**
  - `models/tool.py`: `tool_id` ist `nullable=True`; Migration
    `alembic/versions/c1d5f7a2e903_make_tool_id_nullable.py` (Batch-Modus,
    rückwärts mit Hinweis auf vorhandene ID-lose Datensätze).
  - `schemas/tool.py`: `tool_id: Optional[str]` plus `field_validator`, der ein
    leeres Feld (auch nur Leerzeichen) zu `None` normalisiert.
  - `services/tool_service.py`: neue Funktion `assert_tool_identity()`
    (Stempel → ID Pflicht, sonst `ValueError` → HTTP 400). `update_tool()`
    arbeitet mit **wirksamen** Werten aus `exclude_unset` – sonst käme ein
    Teil-Update an Regel und Duplikat-Prüfung vorbei. `check_tool_id()` liefert
    ohne ID eine Auskunft, die nicht blockiert.
  - `crud/crud_tool.py`: `get_by_tool_id()`, `get_all_by_tool_id()` und
    `count_by_tool_id()` liefern ohne ID leer/0 – ein Vergleich gegen `NULL`
    hätte alle ID-losen Datensätze füreinander als Dublette ausgewiesen. Suche:
    Wer „ohne" tippt, findet die ID-losen Datensätze (`tool_id IS NULL`), denn
    „ohne ID" steht als Wert in der Liste.
  - `schemas/storage.py`: `ToolLiteRead.tool_id` ist optional – sonst hätte die
    Antwortprüfung auf der Lagerplatz-Seite und in der Ablage HTTP 500 geworfen.
  - `services/movement_service.py`: Statusmeldungen nennen „ohne ID" statt `None`.
- **Frontend**
  - `components/tools/ToolForm.tsx`: `idRequired = category === 'Stempel'`;
    Pflichtmarker und `required` hängen davon ab, `tool_id` geht als `null`
    raus, der Hinweis „Abstreifer und Matrize brauchen keine ID – Pflichtfeld ist
    hier Maß A." steht unter dem Feld, der Kategorie-Wechsel löscht eine alte
    Pflichtfeld-Meldung.
  - `lib/toolLabel.ts` (neu): `toolLabel()` liefert die ID oder „ohne ID".
  - Anzeigeorte: `ToolTable` (neutrale Markierung statt leerem Mono-Kasten),
    `Tools.tsx` (Toasts, Löschdialog), `LendModal`, `AdminDashboard`,
    `AdminStorageLocations` (Ablage-Karte, Platz-Karte, Tooltips, Meldungen).
    `ToolFormModal.tsx` (toter Code) nur so weit angepasst, dass es typprüft.
- **Tests**
  - `backend/tests/test_tool_id_optional.py` (neu, 8 Tests): Stempel ohne ID
    abgelehnt (Anlegen **und** Bearbeiten), Abstreifer/Matrize ohne ID angelegt,
    ID-lose Datensätze sind keine Dubletten, Normalisierung, Teil-Update ohne
    ID-Feld, Suche nach „ohne", `ToolLiteRead` mit `NULL`.
  - `frontend/tests/tools-list.spec.ts`: neuer Test „legt einen Abstreifer ohne
    Werkzeug-ID an (ID freiwillig, Maß A Pflicht)".

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **52 passed** (vorher 43) |
| `npx tsc -b` | keine Fehler |
| `npx eslint` (geänderte Dateien) | nur die projektweit bestehenden Regeln (`react-hooks/set-state-in-effect`, `react-refresh/only-export-components`, `no-explicit-any` im toten `ToolFormModal`) – keine neuen Stellen |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| Migration | `alembic upgrade head` auf der Dev-Datenbank gelaufen (`e4c7a15b8d20 → c1d5f7a2e903`); `PRAGMA table_info(tools)` → `tool_id` nullable |
| API-Probe gegen das laufende Backend | Abstreifer ohne ID → `tool_id: null`, `measure_a: "12,00"`; zweiter ID-loser Datensatz → kein Duplikatfehler; Stempel ohne ID → **HTTP 400** „Für Stempel ist die Werkzeug-ID erforderlich – …"; `GET /tools/` liefert die ID-losen Zeilen; `GET /locations/tray` und `/locations/positions` antworten (ToolLiteRead); Testdaten danach gelöscht (Bestand wieder 12) |
| Browser-Prüfung (Playwright, Chromium) | **22/22 Tests grün** mit `--workers=1`, inkl. des neuen Tests (ID-Feld verliert `required`, Hinweis sichtbar, Anlage landet als `NULL` in der Datenbank, Toast und Liste zeigen „ohne ID") |

> **Hinweis zur Playwright-Ausführung mit mehreren Workern:** Mit der
> Standard-Parallelität (7 Worker) fielen 4 ältere Tests um
> („filtert nach Status", „blättert …", „zeigt eine leere Beschreibung …",
> „setzt den Status im Formular …"). Ursache ist nicht dieser Task: jeder Worker
> legt über `test.beforeAll` einen **eigenen** Seed-Satz mit eigenem
> `SEED_PREFIX` in **dieselbe** Datenbank, während mehrere Tests die gerenderte
> Seite (max. 10 Zeilen) gegen die API-Antwort über den **ganzen** Bestand
> vergleichen. Mit `--workers=1` ist die Datenlage eindeutig und alles grün.
> Wer die Parallelität behalten will, muss diese vier Vergleiche auf den eigenen
> `SEED_PREFIX` einschränken.

### Bekannte Grenzen (bewusst offen)

- Maß A wird weiterhin **nur im Formular** erzwungen; das Backend bleibt dort
  tolerant (`docs/05-tools.md` §7), damit Altdaten ohne Maß nicht brechen.
- Suche und Sortierung behandeln „ohne ID" wie einen leeren Wert: ID-lose
  Datensätze stehen in der Sortierung nach Werkzeug-ID am Ende (`NULLS LAST`).
- Die Historie (`MovementLog`) zeigt bei einem Werkzeug ohne ID weiterhin
  „Werkzeug #&lt;interne id&gt;" (vorhandener Ersatztext für gelöschte Werkzeuge).

---

## TASK-014 – Werkzeugtabelle: Sortierung, Filter, Favoriten, Pagination (COMPLETED)

**Auslöser:** Die Werkzeugliste hatte weder Sortierung noch echte Pagination.
`api/tools.ts` holte mit festem `limit=500`, gefiltert wurde vollständig im
Browser; bei mehr als 500 Werkzeugen fehlten Datensätze stillschweigend
(`docs/05-tools.md` §6, Anforderungen 13). Favoriten gab es nicht.

### Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|---|---|
| Favoriten-Speicherung | **In der Datenbank, global** (nicht pro Benutzer) |
| Filter-/Sortierzustand | **In der Adresszeile** (Reload, Link, Zurück-Taste) |
| Spalte „Lagerplatz“ | **Ja**, eigener Platz-Code (`01-A-25`) bzw. „Ablage“ |
| Umfang | Nur Werkzeugliste; Bausteine wiederverwendbar |

### Umsetzung

- **Backend**
  - `models/tool.py`: Spalte `is_favorite` (nicht pro Benutzer).
  - Migration `e4c7a15b8d20_add_is_favorite_to_tools.py` (+ Index `ix_tools_tool_id`).
  - `schemas/tool.py`: `ToolRead.is_favorite`, `ToolRead.position_code`,
    `ToolFavoriteUpdate`, **`ToolPage`** (`items`, `total`, `skip`, `limit`).
  - `crud/crud_tool.py`: `get_multi()` mit Suche (`q` über ID, Bezeichnung, Typ,
    Werk, Kategorie), Mehrfachfiltern (`category`, `status`), `plant_id`,
    `tool_type_id`, `is_storage`, `has_place`, `favorites_only`, Sortierung
    (Whitelist `ToolSortKey`, `NULLS LAST`, fachliche Status-Reihenfolge über
    `CASE`, **`id` als Tiebreaker**), `total` per zweiter `count()`-Abfrage,
    Lagerplatz-Code über Aliase-Joins. Neu: `set_favorite()`.
  - `services/tool_service.py`: `get_tools()` liefert die Seitendarstellung,
    `get_tool_read()` ergänzt `position_code` auch im Detail,
    `_compose_position_code()`.
  - `routers/tools.py`: `GET /` mit `Literal`-validierten `sort`/`order`
    (ungültig → HTTP 422), `limit` 1…200, neue Route
    `PUT /{id}/favorite` (`require_active`).
- **Frontend**
  - `lib/toolQuery.ts` (neu): Zustand der Liste ⇄ Adresszeile und Backend-Abfrage.
  - `api/tools.ts`: `getTools(query)` mit allen Parametern, `setToolFavorite()`.
  - `pages/Tools.tsx`: hält den Zustand (überlebt damit das Formular), 350 ms
    Debounce, Seiten-Korrektur nach Löschungen, optimistisches Favorisieren mit
    Rollback; Kopfzeile mit Überschrift + Schnellfiltern.
  - `components/tools/ToolQuickFilters.tsx` (neu): Kategorie als
    Kontrollkästchen, Werk als Radio, Favoriten als Umschalter – nativ, nur
    unsichtbar (`.ui-segments`), mit Trennstrichen zwischen den Gruppen.
  - `components/tools/ToolTable.tsx` (neu): Tabelle nach Guide „Tabellen &
    Status Badges" + „Variante 2" – zweizeilige Zellen, Kategorie-Chip,
    Ampel-Unterzeile unter dem Status, Aufmerksamkeitszeilen, sortierbare
    Spaltenköpfe mit `aria-sort`, Favoriten-Spalte (`aria-pressed`),
    Skelettzeilen, gemessener Scroll-Hinweis.
  - `components/tools/RowActionMenu.tsx` (neu): `…`-Knopf je Zeile, Menü im
    Portal an `<body>`, fährt nach links aus, wandert bei Scroll mit.
  - `components/tools/ToolFilterBar.tsx` (neu): Suche, Status als
    Mehrfachmenü, Werkzeugtyp, Bestand, Lagerplatz, Chip-Zeile.
  - `components/tools/ToolPagination.tsx` (neu): `.ui-pagination` mit Bereich,
    Seitengröße, Fenster-Seitenzahlen, `aria-current`.
  - `components/tools/ToolList.tsx`: Komposition + drei Leerzustände.
  - `components/icons.tsx`: 12 neue Icons (Stern, Sortierung, Chevron, X,
    Filter, Reset, drei Punkte) als Lucide-Inline-SVG.
  - `index.css`: `.ui-pagination` um `:disabled` und `:focus-visible` ergänzt,
    neu `.ui-segments` und `.ui-menu-left` (im Guide nachgetragen).
  - `pages/admin/AdminDashboard.tsx` an die neue Antwortform angepasst.
- **Tests**
  - `backend/tests/test_tools_list.py` (neu, 13 Tests).
  - `backend/tests/test_tool_update.py` (neu, 4 Tests: Status/Beschreibung/Maß B
    leeren, Platz freigeben, Favorit überlebt das Bearbeiten).
  - `frontend/tests/tools-list.spec.ts` (neu, 21 Browser-Tests; legt Testdaten
    selbst an und räumt sie über die Suche wieder weg).

### Nacharbeit nach Sichtprüfung (Tabelle in Guide-Optik)

| Punkt | Umsetzung |
|---|---|
| Aktionszellen wirkten als weiße Blöcke | Rahmen ist jetzt `.glass-preview-card`, Zeilen transparent mit `divide-y` – keine deckende Fläche mehr |
| Aktionen sollten ein `…`-Knopf sein, der nach links ausfährt | `RowActionMenu`: Menü im Portal, rechte Kante auf dem Knopf, Einfahrt von rechts (im Test gemessen: Kante ≤ 2 px Abweichung) |
| Guide-Varianten „Tabellen & Status Badges" und „Wartungsspalte mit Ampel-Unterzeile" | zweizeilige Zellen, Kategorie-Chip, Aufmerksamkeitszeilen |
| Werkzeug-ID soll deutlicher sein | ID in eigener Glas-Markierung, Mono fett in `text-sm` (14 px) statt 12 px |
| Spalte „Typ & Maße" war unklar, Typ stand doppelt | Typ oben, Maße darunter; **Beschreibung in eigener Spalte** (leer = „—", kein Rückfall auf den Typ) |
| Platz ist wichtiger als Werk | Zeilen getauscht: Hauptzeile `01-A-25`/„Ablage", Unterzeile Werk |
| Ampel war nicht verständlich | **entfernt**, ebenso die Statusspalte (stand fast immer auf „Ohne Status", wiederholte bei Ausleihen nur das Badge). Status bleibt im Formular und als Filter |
| Status im Formular | Feld war vorhanden – **Fehler behoben:** `status` (und Beschreibung, Maß B, Maschine, Kunde, `position_id`) ließen sich nicht leeren, weil `CRUDBase.update()` None-Werte überspringt. `ToolService.update_tool()` übernimmt jetzt alle bewusst gesendeten Felder, auch `null` (`tests/test_tool_update.py`) |
| Meldungen im Block | **Toasts** unten rechts (`.ui-toast-stack` aus dem Guide, jetzt in `index.css` umgesetzt), automatisch schließend nach 5 s; Fehler bleiben im Block |
| Tabelle wirkte schlicht | Kategorie-Chip **mit Farbe** (Teal/Sky/Amber je Kategorie), Typ-Code als eigener Chip („01" + „Rund"), ID- und Lagerplatz-Markierung, Farbpunkt am Kunden aus `customer.color`, favorisierter Stern mit eigener Fläche |
| Kunde und Maschine fehlten | Spalte **Kunde / Maschine**: `Tool.machine` ist jetzt `lazy="joined"` und in `ToolRead`; beide sortierbar (`sort=customer`, `sort=machine`) und in der Suche enthalten |
| Lagerplatz vor Typ, und deutlicher | Lagerplatz-Spalte steht **vor** Typ/Maße; Platz-Code in eigener Mono-Markierung, „Ablage" als neutrales Badge, Werk darunter |
| Tabelle soll ruhiger sein | Die Ausbau-Versuche (Gruppenkopfzeile, Kategorie-Schiene, Gruppentrenner, Maße in Mono) wurden **zurückgenommen**. Es bleiben die schlichte Tabelle mit **Zebra-Streifen** und **Favoritenfarbe** |
| Bildlaufleiste in der Tabelle | Das eigene Scrollfeld samt klebender Kopfzeile wurde **entfernt** — es brachte eine zweite Bildlaufleiste IN der Tabelle mit. Stattdessen **10 Werkzeuge je Seite** (wählbar 10/25/50/100); zehn Zeilen passen ohne eigenes Scrollen in die Seite. Eine klebende Kopfzeile ist mit seitlich scrollbarer Tabelle nicht möglich (ein `overflow`-Container ist immer die Bezugsfläche für `sticky`) |
| Kopfzeile zu hell | Statt Weiß bei 95 % jetzt ein ruhiges Band `bg-slate-200/40` — gemessen `rgb(236,239,244)`, dunkler als die Zeilen (`rgb(243,244,246)`) |
| Filter der Kopfzeile nicht rücksetzbar | Missverständnis geklärt: gemeint war die **Sortierung**. Sie wird mit dem **dritten Klick** auf denselben Spaltenkopf zurückgestellt (aufsteigend → absteigend → Standard) — das ist der **einzige** Weg, auf Wunsch **nicht** in der Filterabwahl (Sortier-Chip und Zurücksetzen-Knopf dafür wieder entfernt). Für die Filter selbst bleiben der Zurücksetzen-Knopf in der Kopfzeilen-Zeile (bei Kategorie, Werk oder Favoriten) und „Alle Filter zurücksetzen" in der Chip-Zeile |
| Favoritenfarbe nachgearbeitet | Stern jetzt sattes Gold (`text-amber-600`, gemessen `rgb(225,113,0)`) statt gedecktem Braun; die Zeile bekommt eine warme Tönung (`bg-amber-500/[0.08]`, gemessen `rgb(244,237,227)`) und **kein** Zebra |
| Lagerplatz deutlicher | Lagerplatz-Code steht jetzt in **derselben Markierung wie die Werkzeug-ID** (`rounded-lg`, Mono, fett, 14 px, weiße Fläche) — unterschieden nur durch die Kante: ID Teal (Primär = Identität), Platz Sky (Info = Ort) |
| Zeilen mit Glasverlauf | `.table-row-glass`: derselbe diagonale Verlauf wie `.glass-card`, schwach dosiert (gemessen 6–9 Stufen innerhalb einer Zeile). Das Zebra wurde von 25 % auf 40 % angehoben, weil der Verlauf den Unterschied sonst auf zwei Stufen gedrückt hätte |

Zur Breite gemessen (Chromium): Container 695 px bei 1280 px Fensterbreite,
815 px bei 1440 px; Tabelle 780 px Mindestbreite. Bei **1440×900 passt die
Liste ohne seitliches Scrollen** (Überlauf 0, Guide-Vorgabe); bei 1280 fehlen
~85 px, dann erscheint der Hinweis. Deshalb sitzt in der Zeile nur der
`…`-Knopf — „Ausleihen" steht als hervorgehobener erster Menüeintrag.

Zwei Fallen, die dabei aufgefallen sind und jetzt per Test abgesichert sind:
`backdrop-filter` macht ein Element zum Bezugsrahmen für `position: fixed`
(deshalb hängen Menü und Toast in einem Portal an `<body>`), und `sr-only` auf
einer Eingabe macht sie unklickbar (deshalb transparente Fläche als Klickziel).

> **Hinweis zur Sichtprüfung:** Die Screenshots in `.audit/shots/` kann der
> Agent nicht selbst betrachten (das Modell nimmt keine Bilder entgegen).
> Deshalb gibt es seit dieser Runde `.audit/pixel.py`: es liest RGB-Werte direkt
> aus einem PNG (nur Standardbibliothek) und macht Farbaussagen messbar. Damit
> belegt: Kopfband `rgb(236,239,244)`, Normalzeile `rgb(243,244,246)`,
> Zebra-Zeile `rgb(246,247,248)`, Favoritenzeile `rgb(244,237,227)`,
> Stern `rgb(225,113,0)`. Dazu die Geometrie-Messungen (Tabellenbreite,
> Überlauf, Spaltenbreiten, Positionen von Menü und Toast).

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **43 passed** |
| `npx tsc -b` | keine Fehler |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| `npx eslint` (geänderte Dateien) | nur die projektweit bestehende Regel `react-hooks/set-state-in-effect` – bereits in 7 unveränderten Dateien vorhanden |
| API-Probe gegen das laufende Backend | Suche (jetzt auch über Kunde und Maschine), alle Filter, Sortierung (Maß numerisch, Status fachlich, Kunde, Maschine, NULLS LAST), Pagination (5/5/2 Seiten, 12 eindeutige IDs), 422 bei ungültiger Sortierspalte und bei `limit=5000`, Favoriten setzen/entfernen/filtern/404, `PUT /{id}` setzt den Favoriten **nicht** zurück, Status/Beschreibung/Maß B lassen sich leeren, Kunde/Maschine samt Kundenfarbe in der Antwort |
| Browser-Prüfung (Playwright, Chromium) | **21/21 Tests grün** (Werkzeugliste, keine Bildlaufleiste bei 10 Werkzeugen, Zebra + Hover-Vorrang, Favoritenfarben, Sortierung zurücksetzen, Filter zurücksetzen, Kunde/Maschine gegen die API, Zeilenmenü-Geometrie, Toast-Position, Status im Formular bis in die Datenbank, Admin-Dashboard-Regression); Belege in `.audit/shots/wt-01…wt-13` |

### Bekannte Grenzen (bewusst offen)

- Das Admin-Dashboard zählt seine Kennzahlen weiterhin über die geladene Seite
  (max. 200 Werkzeuge) – für belastbare Zahlen braucht es einen eigenen
  Statistik-Endpunkt (`docs/05-tools.md` §9).
- Favoriten sind global. Sollten personenbezogene Favoriten gebraucht werden,
  ist das eine Datenmodell-Änderung (Zuordnungstabelle mit `user_id`).
- „Lager/Ersatz“ nutzt die neuen Bausteine noch nicht (Suchfeld und Filterung im
  Browser, ohne Pagination). Der **Serienartikel-Bereich** wurde zwischenzeitlich
  umgestellt (DEC-056/057, **TASK-016**): serverseitige Suche über alle Felder,
  Sortierung, Blätterleiste und Gesamtzahl.

---

## TASK-013 – Rollierende Sitzung + Sitzungs-Countdown (COMPLETED)

**Auslöser:** Im Anlegeformular erschien „Ungültiger Token“, und ID-Prüfung
sowie Lager/Ersatz-Anlage schienen nicht zu funktionieren. Ursache: Der JWT lief
starr nach 30 Minuten ab – bei längerem Ausfüllen ohne Request.

### Umsetzung

- **Backend:** `app/middleware/session.py` (neu) – hängt bei jeder gültigen
authentifizierten Anfrage einen frischen Token in den Header `X-New-Token`
(+ `X-Token-Expires-At`). Registriert in `app/main.py`; CORS `expose_headers`.
- **Frontend:** `lib/session.ts` (neu) – `decodeTokenExp` + `applyRenewedToken`.
`api/client.ts` und `lib/api.ts` übernehmen den Header und melden 401 zentral
(`auth:expired`). `AuthContext` hält `expiresAt`/`sessionExpired`.
- **Anzeige:** `components/SessionTimer.tsx` (neu) – Countdown „Sitzung läuft in
N Min ab“ in der Sidebar (Haupt-Frontend **und** AdminPanel).
- **Aktivität:** `lib/useSessionHeartbeat.ts` (neu) – bei Interaktion gedrosselt
`GET /api/auth/me`, ohne festes Intervall.
- **Auto-Logout:** Bei Countdown 0 oder 401 wird abgemeldet. Der Hinweis erscheint **nur bei echtem Zeitablauf** (Token-`exp` überschritten) – siehe Nachtrag unten.
- **Test:** `backend/tests/test_session_middleware.py` (neu) – 3 Tests.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | keine Fehler |
| `npm run build` | fehlerfrei |
| `pytest tests/` | 18 passed |
| Browser-Prüfung | offen (Teil von TASK-012) |

### Nachtrag: Ablauf-Hinweis präzisiert

Vorher löste **jede** 401-Antwort den Hinweis aus – auch falsche Zugangsdaten
und ein alter Token im Browser-Speicher. Dadurch stand „Sitzung abgelaufen“
schon beim ersten Öffnen der Login-Seite. Umgekehrt fehlte der Hinweis beim
echten Ablauf, weil der Countdown an `logout` verdrahtet war.

- `lib/session.ts`: neu `isTokenExpired` (nur eine überschrittene `exp` zählt)
  und `isLoginRequest` (401 der Login-Endpunkte = falsche Zugangsdaten).
- `lib/api.ts` + `api/client.ts`: `auth:expired` nur noch bei Anfragen **mit**
  Token und nie auf Login-Endpunkten.
- `AuthContext.expireSession` entscheidet den Hinweis aus dem abgelegten Token
  und wird jetzt auch von `SessionTimer.onExpire` (Countdown 0) benutzt.

Im Browser geprüft (Chromium, Backend :8000, dev-Server :5173):

| Fall | Ergebnis |
|---|---|
| Frischer Browser ohne Token | kein Hinweis |
| Falsche Personalnummer, danach Tabwechsel | nur Fehlermeldung |
| Falsches Admin-Passwort, danach Tabwechsel | nur Fehlermeldung |
| Alter/ungültiger Token beim Start | kein Hinweis, Token still verworfen |
| Erfolgreicher Login, Reload mit gültigem Token | eingeloggt, kein Hinweis |
| Token läuft während der Nutzung ab | Login-Fenster **mit** Hinweis |
| Erneuter Login nach Ablauf | Hinweis verschwindet |

### Entscheidungen

- Renew bei **jeder** Aktivität (nicht nur unter Schwellwert).
- **Kein** absolutes Maximum.
- Heartbeat **nur** bei Interaktion (kein Intervall).

---

## TASK-012 – Verifikation AdminPanel im Browser (IN_PROGRESS)

Diese Aufgabe sammelt die **offenen manuellen Prüfungen**, die aus TASK-010
übrig geblieben sind. Es sind ausschließlich Verifikationsschritte — es ist
kein neuer Code geplant.

### Ziel

Bestätigen, dass die vier umgebauten AdminPanel-Bereiche im Browser korrekt
aussehen und funktionieren.

### Offene Schritte

- [ ] **Lagerplatz-UI** nach dem Umbau prüfen
      – Schubladen-Zähler als Teal-Badge, Plätze als Sky-Badge
      – Buttons außerhalb des Aufklapp-Buttons (Schrank klappt nicht versehentlich um)
      – Soft-Danger-Buttons sichtbar rosa
      – `frontend/tests/admin-storage.spec.ts` erweitern und laufen lassen
- [ ] **Stammdaten** prüfen
      – vier Tabellenblöcke nebeneinander (Grid 1/2/3/4 Spalten)
      – Kebab-Menü pro Zeile: öffnet, schließt bei Klick außerhalb, bei `Esc` und nach Aktion
      – Kundenfarbe: Farbwähler, „Keine Farbe", Swatch in der Zeile
      – Maschinen: Werk-Dropdown beim Anlegen und Bearbeiten vorbelegt
- [ ] **Anlegeformular Werkzeug** prüfen
      – Werkzeug-ID: Live-Kontrolle beim Tippen (Debounce 400 ms)
      – Maß A Pflicht, Maß B optional, Anzeige mit Einheit (`7,30 mm`)
      – Werk-Block **vor** dem Lagerplatz-Block; erstes Werk vorausgewählt
      – Schrank/Schublade `disabled` mit erklärendem Placeholder
      – Lager/Ersatz: Checkbox steuert `allow_duplicate_id`, Anzahl legt N Exemplare an
- [ ] `npm run build` und `npx tsc -b` erneut laufen lassen
- [ ] `pytest tests/` im Backend erneut laufen lassen (zuletzt 15 passed)

### Bekannte Folgeschritte (nicht Teil dieser Aufgabe)

- [ ] Optional: Farbanzeige in `ToolList.tsx` aus `tool.customer.color`
- [ ] `frontend/src/components/ToolFormModal.tsx` — bestätigt toter Code,
      wird von keiner Stelle importiert. Entscheidung offen: löschen oder behalten.
- [ ] `tasks/06-security-and-permissions.md` ist leer (nur Titelzeile).

### Verifikationsstand

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | keine Fehler |
| `pytest tests/` | 15 passed |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| Browser-Prüfung | **offen** |

---

## Abgeschlossene Aufgaben

Die vollständigen Checklisten liegen in `tasks/archive/completed-tasks.md`.

| Task | Titel | Status |
|---|---|---|
| TASK-001 | Altsystem analysieren | COMPLETED |
| TASK-002 | Altsystem dokumentieren | COMPLETED |
| TASK-003 | Anforderungen vergleichen | COMPLETED |
| TASK-004 | Zielarchitektur | COMPLETED |
| TASK-005 | Domain Model | COMPLETED |
| TASK-006 | Security | COMPLETED |
| TASK-007 | Implementierungs-Roadmap | COMPLETED |
| TASK-009 | UI-Styleguide verbindlich umsetzen | COMPLETED |
| TASK-010 | AdminPanel umsetzen (Split-Tone) | COMPLETED |
| TASK-011 | Anlegeformular Werkzeug (Kategorie Stempel) | COMPLETED |
| TASK-014 | Werkzeugtabelle: Sortierung, Filter, Favoriten, Pagination | COMPLETED |
| TASK-015 | Anlegeformular: Werkzeug-ID je Kategorie | COMPLETED |
| TASK-016 | Serienartikel: Stammdaten, Admin-Verwaltung, Artikelordner | COMPLETED |
| TASK-017 | Serienartikel: Formular in Werkzeug-Optik, Bilder zum Plan | COMPLETED |
| TASK-018 | Vorschaubilder in fester Größe und Split-Screen-Viewer | COMPLETED |
| TASK-019 | Ein Dateifeld für Einrichteplan und Bilder | COMPLETED |
| TASK-020 | Bildansicht: Zoom, Drehen, größeres Fenster | COMPLETED |
| TASK-021 | Mehrere Einrichtepläne und Dateiverwaltung in der Bearbeitung | COMPLETED |
| TASK-022 | Serienartikel-Liste in Werkzeug-Optik (Favoriten, Zebra, SVG) | COMPLETED |

---

## Ist-Stand des Projekts

| Bereich | Stand |
|---|---|
| Backend-Router | `auth`, `users`, `roles`, `tools`, `locations`, `movements`, `master_data`, `serial_articles`, `spare_parts` |
| Backend-Modelle | `user`, `tool`, `master_data`, `storage`, `spare_part`, `movement`, `serial_article` |
| Migrationen | 9 (`f5b7b5192461` initial, `c7d9e2f3a1b8` Lager-Matrix, `d1a4f6b2c9e3` Kundenfarbe, `b2e8c1a4d9f7` Maß/Beschreibung, `e4c7a15b8d20` Favorit, `c1d5f7a2e903` Werkzeug-ID optional, `a7c3e19f4b21` Serienartikel-Stammdaten, `b6f2c8d41a77` Serienartikel-Favorit, `a8f4c2d6e130` Ersatzteile) |
| Frontend-Seiten | `Tools.tsx`, `pages/admin/*` |
| Frontend-Tests | `login.spec.ts`, `admin-storage.spec.ts`, `tools-list.spec.ts`, `serial-articles.spec.ts`, `spare-parts.spec.ts` |
| Backend-Tests | `test_tool_id_check.py`, `test_tool_id_optional.py`, `test_session_middleware.py`, `test_location_service.py`, `test_tools_list.py`, `test_tool_update.py`, `test_serial_articles.py`, `test_spare_parts.py` |
| Design-Systeme | Glas (`index.css`) und Split-Tone (`admin.css`) vollständig umgesetzt |
| SAP | nicht implementiert — bewusst, Core läuft ohne SAP |
