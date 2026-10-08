# TASK-026 – Datenblatt: Feinschliff nach der Abnahme

**Status:** COMPLETED
**Basis:** DEC-065 (Datenblatt), DEC-067 (Maschinenfarbe), DEC-060 (ein Dateifeld)
**Auslöser (Projektinhaber):** „Anlege-Formular: ‚Freiwillig: Abstreifer und
Matrize dürfen ohne ID existieren' weg. Beschreibung aus dem Feld nehmen. Bilder
auch möglich anzulegen machen. Liste: Name deutlich machen, Maschinen aus
Stammdaten mit Farbe, Favoriten-Hover prüfen."

---

## Änderungen

### Formular (`components/data-sheets/DataSheetForm.tsx`)

- [x] Der Hinweis „Freiwillig: Abstreifer und Matrize dürfen ohne ID existieren"
      ist entfernt. Er erklärte eine Regel, die das Formular ohnehin befolgt –
      unter dem Feld steht jetzt nur noch die Live-Meldung zur Werkzeug-ID.
- [x] **Beschriftung über dem Beschreibungsfeld.** Das Feld bleibt und wird
      gespeichert; die Beschriftung „Beschreibung" steht jetzt **über** dem Feld
      (mehrzeiliges Feld mit `textarea-bordered`, dasselbe Muster wie im
      Serienartikel-Formular) statt als Innenlabel darin.
      *Korrekturverlauf:* Die erste Umsetzung hatte das Feld ganz aus dem Formular
      genommen, die zweite die Beschriftung ersatzlos gestrichen. Gemeint war von
      Anfang an „Beschriftung raus aus dem Feld, darüber schreiben" – klar geworden
      anlässlich derselben Vorgabe für das Ersatzteil-Formular.
- [x] **Bilder möglich:** Ein Dateifeld nimmt PDF **und** Bilder (Mehrfachauswahl
      und Drag & Drop, wie DEC-060 beim Serienartikel). Die Auswahl wird beim
      Ablegen sortiert: PDF → Datenblatt, alles andere → Bild; die Zeile unter
      „Kommt beim Speichern dazu" nennt die Art. „Hinterlegte Dateien" zeigt
      Datenblätter und Bilder (Bilder mit Vorschaubild) und erlaubt das einzelne
      Löschen.

### Liste (`components/data-sheets/DataSheetList.tsx`)

- [x] **Name deutlich:** Der Name steht jetzt in einem eigenen Mono-Kasten mit
      **Sky-Kante** – dieselbe Behandlung wie der Name in der Serienartikel-Liste
      (DEC-063). Die Werkzeug-ID trägt die Teal-Kante; unterschieden wird nur die
      Kante. Die Spaltenüberschrift heißt deshalb „Name" statt „Name /
      Beschreibung".
- [x] **Maschinenfarbe:** Die Maschine zeigt den Farbpunkt aus den Stammdaten –
      wie der Kunde in der Serienartikel-Liste. Dafür gibt es jetzt
      `machines.color` (DEC-067) samt Migration und Farbwähler im Admin-Panel.
- [x] **Favoriten-Hover:** Die Zeilenklassen sind jetzt **entweder** Zebra
      **oder** Favoriten-Tönung (`bg-amber-500/[0.08]` mit eigenem
      `hover:bg-amber-500/[0.14]`). Vorher standen `bg-amber-100/50`,
      `even:bg-white/40` und `hover:bg-white/70` nebeneinander – das
      `:nth-child(even)` ist stärker als eine einfache Klasse und hat die
      Favoriten-Tönung in **geraden** Zeilen überschrieben; der Hover sprang auf
      Weiß statt auf eine stärkere Tönung.
- [x] Dateispalte zeigt zusätzlich die Bilder („N Bilder") neben „PDF" /
      „Kein PDF" / „N PDFs".

### Backend

- [x] `services/data_sheet_service.py`: Bilder (`bild-1.jpg`, `bild-2.png` …),
      `is_image_name`, `_write_images`, `_next_image_name`, `list_files` liefert
      (Datenblätter, Bilder), `thumbnail_path` (400 px JPEG, Zwischenspeicher
      `.thumbs`, ohne Pillow das Original), `media_type_for`, Bild-Löschung räumt
      das Vorschaubild mit weg, `resolve_file` erlaubt Bilder.
- [x] `routers/data_sheets.py`: `images` beim Anlegen und Ändern,
      `variant=thumb` am Datei-Endpunkt, `_to_read` liefert `images`.
- [x] `schema/data_sheet.py`: `DataSheetFileRead.kind` ist
      `Literal["plan", "image"]`, `DataSheetRead.images`.
- [x] `machines.color`: Modell, Schema, Router (`POST`/`PUT /api/machines`),
      Migration `e7d1b9c34a52` (idempotent).

## Prüfung

| Prüfung | Ergebnis |
|---|---|
| `pytest tests/` | **140 passed** (unverändert grün) |
| Browser-Suite | **81 passed** – 16 Datenblätter, davon **4 neue**: Namens-Kennung, Maschinenfarbpunkt, Favoriten-Tönung + Hover, Anlegen mit PDF **und** Bild |
| `npx tsc -b` / `eslint` | fehlerfrei in allen geänderten Dateien |
| Migration | `e7d1b9c34a52` angewandt; die Spec setzt die Test-Maschinenfarbe über die API und **gibt sie hinterher zurück** (Datenbank danach: 0 Maschinen mit Farbe) |
| Datenbestand | keine Testreste; die vom Anwender angelegten Datenblätter („Senker", „Test") unberührt |

## Hinweise

- **Die Testdateien (`frontend/tests/`) werden von `tsc -b` und `eslint` nicht
  geprüft** – `tsconfig.app.json` hat `"include": ["src"]`. Ein Syntaxfehler in
  einer Spec fällt deshalb erst im Playwright-Lauf auf (in dieser Aufgabe genau so
  passiert). Eigene Aufgabe wert, wenn Tests abgesichert werden sollen.
- Der Hover-Test vergleicht bewusst **zwei gerade Zeilen** (Favorit und
  Nicht-Favorit): ohne diesen Aufbau hätte der Zebra-Fehler nicht auffallen
  können.
- Nicht umgesetzt (nicht gefordert): Werkzeugliste und Serienartikel-Liste zeigen
  den Maschinenpunkt noch nicht – als offene Frage in DEC-067 notiert.
