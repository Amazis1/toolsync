# TASK-024 – Ersatzteile (Weg A) und Datenblatt

**Status:** COMPLETED – Schritt 1 (Entscheidungen und Doku), Schritt 2
(Ersatzteile) und Schritt 3 (Datenblatt) erledigt. Offen bleibt allein das
Bewegungspaket als eigene Aufgabe **TASK-025**.
**Entschieden:** DEC-064 (Ersatzteile, `storage_items` wird abgelöst),
DEC-065 (Datenblatt), DEC-066 (Tab-Struktur) in `docs/13-decisions.md`
**Bereichsdokus:** `docs/07-stock-replacement.md`, `docs/20-datenblatt.md`,
`docs/01-requirements.md` (Abschnitt 7.0/7.3 und 23)
**Auftrag des Projektinhabers:** „Weg A", Mengenbestand als Spalte ohne
Mindestbestand, Werk Pflicht, Name überall **„Datenblatt"**, Bewegungspaket zuletzt.

---

## Schritt 1 – Entscheidungen und Doku ✅

- [x] `docs/13-decisions.md`: **DEC-064**, **DEC-065**, **DEC-066** ergänzt
- [x] `docs/07-stock-replacement.md`: Doppelmodellierung als aufgelöst markiert,
      Variante C (`SparePart`) ergänzt, Suche/Abgrenzung/offene Fragen aktualisiert
- [x] `docs/20-datenblatt.md`: Bereichsbeschreibung (Zielzustand) neu angelegt
- [x] `docs/01-requirements.md`: Abschnitt 7.0, 7.3 und 23 ergänzt; Suche,
      Datenbank- und Frontend-Liste erweitert
- [x] `docs/02-domain-model.md`: `StorageItem` als abgelöst markiert, 11.1
      (`SparePart`) und 11.2 (`DataSheet`) ergänzt, Migrationsstand, offene Fragen
- [x] `backend/toolsync.db` **nur lesend** geprüft: `storage_items` = 0 Zeilen,
      `tools` = 16 (davon `is_storage = 1`), `tool_movements` = 98,
      `serial_articles` = 4 → kein Datenverlust beim Umbau möglich

---

## Schritt 2 – Ersatzteile ✅

### 2.1 Backend

| Datei | Inhalt |
|---|---|
| `app/models/spare_part.py` | **neu** – `SparePart(Base, AuditMixin)`, Tabelle `spare_parts`, Felder nach DEC-064 |
| `app/schemas/spare_part.py` | **neu** – `SparePartCreate` / `Update` / `Read` / `Page` |
| `app/crud/crud_spare_part.py` | **neu** – Suche (`article_number`, `name`, `type`, `storage_place`), `plant_id`-Filter, Sortierung, Seitenausschnitt, `total` |
| `app/services/spare_part_service.py` | **neu** – Pflichtprüfungen (Artikelnummer, Werk), Stammdatenprüfung Werk/Maschine |
| `app/routers/spare_parts.py` | **neu** – Präfix `/api/spare-parts`; lesen/anlegen/ändern `require_active`, **löschen `require_admin`** |
| `alembic/versions/<neu>_spare_parts.py` | **neu** – `spare_parts` anlegen **und** `storage_items` entfernen (eine Revision) |
| `app/main.py` | Router `spare_parts` registrieren, `storage_items` entfernen |

### 2.2 Frontend

| Datei | Inhalt |
|---|---|
| `src/components/spare-parts/SparePartList.tsx` | **neu** – Werk-Segmente, Suche ohne sichtbare Beschriftung mit `aria-label`, Zebra + Glasverlauf, SVG-Sortierzeichen, Blätterleiste, Überlauf-Hinweis (Optik nach DEC-063) |
| `src/components/spare-parts/SparePartForm.tsx` | **neu** – Felder nach DEC-064, Innenlabel `.ui-field`, Meldungen am Feld |
| `src/api/spareParts.ts`, `src/types/spare-part.ts` | **neu** |
| `src/components/tools/ToolForm.tsx` | Sub-Reiter **„Ersatzteil"** ergänzen (Speichern unabhängig vom Werkzeug) |
| `src/App.tsx` | Tab „Lager/Ersatz" → **„Ersatzteile"**, auf `SparePartList` umstellen |

### 2.3 Entfernen (im selben Zug)

Backend: `models/storage_item.py`, `schemas/storage_item.py`,
`crud/crud_storage_item.py`, `services/storage_item_service.py`,
`routers/storage_items.py`, Einträge in `models/__init__.py` und `main.py`,
`check_db_tables.py` (Zeile 15).

Frontend: `types/storage-item.ts`, `api/storage.ts`,
`components/storage/StorageItemList.tsx`, `components/storage/StorageItemForm.tsx`,
Importe und Zustand in `App.tsx` (`editingStorageItem`, `handleStorageSave`,
`openStorageEdit`, `showStorageForm`).

Doku, die den abgelösten Stand nennt – **nachgezogen**: `docs/14-architecture.md`
(Router- und Modellliste, Befund „`storage_items` ohne Migration"),
`docs/11-sap-integration.md` (Router-Listen), `tasks/CURRENT_TASKS.md`
(Router-, Modell-, Migrations- und Testliste).
Historische Audits (`docs/19-frontend-ui-audit.md`, `tasks/09-ui-styleguide.md`,
`tasks/archive/`) bleiben **unverändert** – sie sind datierte Momentaufnahmen.

### 2.4 Prüfung ✅

- [x] `python -m py_compile` / Import-Probe: `app.main` lädt, nur
      `/api/spare-parts/*` registriert, `/api/storage` ist weg
- [x] `pytest tests/` – **140 passed** (16 neue in `tests/test_spare_parts.py`,
      die 66 Serienartikel-Tests unverändert grün)
- [x] `alembic upgrade head` – auf der Entwicklungsdatenbank angewandt:
      `alembic_version = a8f4c2d6e130`, `storage_items` entfernt, Bestand
      unverändert (16 Werkzeuge, 4 Serienartikel, 98 Bewegungen)
- [x] `alembic downgrade` + erneutes `upgrade` auf einer **Kopie** geprüft
      (auch zweimal hintereinander) – Revision ist umkehrbar
- [x] **Idempotenz**: Die Revision legt Tabelle und Index nur an, wenn sie fehlen.
      Grund: `Base.metadata.create_all` beim App-Start kann `spare_parts` bereits
      angelegt haben – ein blankes `op.create_table` brach genau daran ab
      („table spare_parts already exists").
- [x] `npx tsc -b` und `npx eslint` – keine Fehler in den neuen/geänderten Dateien
- [x] Browser: **9 Tests** in `frontend/tests/spare-parts.spec.ts` grün –
      eigener Tab, „Lager/Ersatz" nicht mehr vorhanden, Liste mit Menge und
      Lagerort, Anlegen mit Dubletten-**Hinweis** (kein Hindernis), Werk Pflicht,
      Bearbeiten, Löschen nur als Admin (403 für normale Benutzer am Endpunkt)
- [x] Gegenprobe: **gesamte** Browser-Suite **65 passed** (tools-list,
      serial-articles, login, admin-storage, session-expiry unverändert grün)

---

## Schritt 3 – Datenblatt ✅

### 3.1 Vorarbeit (kleinster gemeinsamer Eingriff) ✅

- [x] `PDFViewer.tsx`: Datei-Ladeschicht entkoppelt – das Fenster bekommt
      `document` und `source` als Props (`types/viewer.ts`,
      `lib/viewerSources.ts`). **Serienartikel-Logik, Ordner und Endpunkte blieben
      unangetastet.**
- [x] Sicherheitsnetz: 66 Backend- und 16 Browser-Tests der Serienartikel sind
      **vorher und nachher grün** (im Gesamtlauf 140 bzw. 78 Tests).

### 3.2 Backend

| Datei | Inhalt |
|---|---|
| `app/models/data_sheet.py` | **neu** – `DataSheet`, Tabelle `data_sheets`, Felder nach DEC-065 |
| `app/schemas/data_sheet.py` | **neu** – inkl. `has_pdf`, `plans`, `DataSheetPage`, Favorite-Update |
| `app/crud/crud_data_sheet.py` | **neu** – Suche über Werkzeug-ID, Name, Beschreibung, Werk- und Maschinenname; Sortierung mit NULLS LAST + `id`-Tiebreaker; `total` |
| `app/services/data_sheet_service.py` | **neu** – Ablage `uploads/data_sheets/<id>/`, `plan.pdf`, `plan-2.pdf` …; `_write_plan()`, `resolve_pdf_path()` mit Wurzelprüfung, `rename`/`rmtree` innerhalb der Ablage; Endungsprüfung `.pdf` |
| `app/routers/data_sheets.py` | **neu** – Präfix `/api/data-sheets`; lesen `require_active`, Verwaltung `require_admin`, Favorit `require_active`; `/check-tool-id` optional |
| `alembic/versions/<neu>_data_sheets.py` | **neu** |

Achtung Reihenfolge der Routen: spezifische Pfade (`/…/files/{name}`) **vor**
`/{id}` definieren – sonst wird `3/files/x` als `id="3/files/x"` geparst (422).

### 3.3 Frontend

| Datei | Inhalt |
|---|---|
| `src/components/data-sheets/DataSheetList.tsx` | **neu** – Optik und Bedienung wie `SerialArticleList` (DEC-063), Favoriten-Stern, Dateispalte („PDF", „Kein PDF", „N Pläne") |
| `src/components/data-sheets/DataSheetForm.tsx` | **neu** – Feld **„Werkzeug-ID"** (kein „Artikelnummer"), Werk Pflicht, Maschine, Name, Beschreibung, ein Dateifeld für mehrere PDFs |
| `src/api/dataSheets.ts`, `src/types/data-sheet.ts` | **neu** |
| `src/components/tools/ToolForm.tsx` | Sub-Reiter **„Datenblatt"** ergänzen |
| `src/App.tsx` | Tab **„Datenblätter"**, Datei-Fenster über den generalisierten Viewer |
| `src/components/tools/RowActionMenu.tsx` | Zeilenaktion **„Datenblatt"** → Liste gefiltert auf diese Werkzeug-ID |
| `src/components/serial-articles/PDFViewer.tsx` | Datei-Quelle als Prop (aus 3.1) |

### 3.4 Prüfung ✅

- [x] `pytest tests/` – **140 passed**, Serienartikel-Tests unverändert grün
- [x] `npx tsc -b` und `npx eslint` – fehlerfrei in den neuen Dateien
- [x] Migration `c4b9e7a15f28` angewandt und auf- und abwärts geprüft
- [x] Browser: **13 Tests** in `frontend/tests/data-sheets.spec.ts` grün –
      eigener Tab, Liste (Werkzeug-ID/„ohne ID", PDF-Zustand), Anlegen mit PDF
      (Werk Pflicht, Hinweis statt Blockade bei vorhandener ID), Zeilenklick öffnet
      den Split-Screen mit Beschriftung **„Datenblatt"**, Bearbeiten ergänzt ein
      zweites PDF (`2 Datenblätter`), Löschen mit Bestätigung, normaler Benutzer
      ohne Verwaltungs-Aktionen, **Zeilenaktion „Datenblatt"** aus der
      Werkzeugliste filtert auf die ID, Endpunkt-Rechte (403 für Anlegen/Löschen
      ohne Admin, 200 beim Lesen)
- [x] Gegenprobe: **gesamte** Browser-Suite **78 passed** (tools-list,
      serial-articles, login, admin-storage, session-expiry, spare-parts
      unverändert grün)

> **Beim Bauen gefunden und behoben:** Die Werkzeugliste wird an **zwei** Stellen
> gerendert (`activeTab === 'werkzeuge'` = Liste, `activeTab === 'create'` =
> Anlege-Karte). Die Zeilenaktion „Datenblatt" gehört an die **Listen**-Instanz –
> ohne sie dort läuft der Klick ins Leere. Beleg: eigener Browser-Test.

---

## Schritt 4 – Bewegungspaket (TASK-025, ausdrücklich später)

Nicht Teil dieser Aufgabe. Inhalt, wenn es soweit ist:

1. **Rückgabe-UI** – heute ruft kein Frontend-Teil `movement_type = "return"` auf;
   ausgeliehene Werkzeuge bleiben dauerhaft auf `lent` (verfälscht „Frei/
   Ausgeliehen/Wartung" im Admin-Dashboard).
2. **`user_id` aus dem Token** statt `user_id: null` + Personalnummer als Klartext
   in `note` (Anforderung 9 ist heute nicht erfüllt).
3. **Historie-Tab füllen** – `GET /api/movements/` kann lesen, filtern, blättern;
   es fehlt nur die Oberfläche außerhalb des Admin-Panels.
4. **Werkswechsel im Datenmodell** – `from_plant_id`/`to_plant_id` oder ein
   erzwungener, dokumentierter Werkswechsel; `transfer` hat heute keine Wirkung,
   und `plant_id` im Movement-Filter ist der **heutige** Standort des Werkzeugs,
   nicht der Ort der Bewegung. Ohne dieses Feld ist „Logistik zwischen Werken"
   nicht auswertbar.
5. **`tool_movements.tool_id` von `ON DELETE CASCADE` auf `SET NULL`** – sonst
   verschwindet der Verlauf mit dem Werkzeug.
6. Danach: Auswertung/Charts auf aggregierten Daten (eigener Statistik-Endpunkt;
   heute rechnet der Browser und „Gesamt" ist bei 500 Zeilen gekappt).

---

## Offene Punkte

- Soll der Tab „Werkzeuge" einen sichtbaren Filter **„Ersatz"** bekommen
  (`getTools()` ruft heute ohne `is_storage` auf – Werkzeuge und Lager/Ersatz
  erscheinen gemischt)? Empfehlung: ja, gehört zu Schritt 2.
- `docs/11-sap-integration.md` nennt `/api/storage` als integrationsrelevant –
  beim Entfernen prüfen, ob die SAP-Sicht auf „Lager" dann `spare_parts` meint.
- `ToolFormModal.tsx` ist weiterhin toter Code (offen seit TASK-011) – beim
  Anfassen des Werkzeugformulars in Schritt 2 endgültig löschen.
