# ToolSync – Lager und Ersatz

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 7, 8, 12, 13),
> `docs/13-decisions.md` (DEC-052 Mehrfach-ID, DEC-050 Werkzeug-Ablage,
> DEC-048 Lagerplatz-Matrix), `docs/14-architecture.md` (Abschnitt 3.3).
> Dieses Dokument beschreibt den **Ist-Stand der Implementierung** und benennt
> jede Abweichung ausdrücklich als solche.

> ## Umgesetzt am 2026-10-04 – DEC-064 (TASK-024, Schritt 2)
>
> Die bis dahin offene Doppelmodellierung ist **aufgelöst**:
>
> | Gegenstand | Künftig verbindlich |
> |---|---|
> | Ersatzwerkzeug, Ersatzstempel, Matrize als Lagerexemplar | `Tool` mit `is_storage = true`, **in der Werkzeugliste** (DEC-052 unverändert) |
> | Ersatzteil (Dichtung, Sensor, Normteil) | neue Entität **`SparePart`** (`spare_parts`), eigener Tab **„Ersatzteile"** – **umgesetzt** |
> | `StorageItem` / `storage_items` / `/api/storage` | **entfernt** (Revision `a8f4c2d6e130`) |
>
> **Gemessener Grund:** `storage_items` enthielt **0 Zeilen** (`backend/toolsync.db`,
> nur lesend geprüft). Der Tab „Lager/Ersatz" war deshalb dauerhaft leer – er las
> eine Tabelle, in die nie geschrieben wurde, während die echten Lager/Ersatz-Objekte
> als `tools` in der Werkzeugliste lagen.
>
> **Die Abschnitte 2.2, 3 (Zeile zu `StorageItemService`), 7, 8 und die offenen
> Fragen 1, 5 und 6 dieses Dokuments beschreiben einen Stand, der damit abgelöst
> ist.** Sie bleiben als Ist-Stand-Vermerk stehen und sind dort einzeln markiert.
> Verbindlich sind **DEC-064** (Feldmodell, Rechte, Migration), **DEC-066**
> (Tab-Struktur) und die Umsetzung in `models/spare_part.py`,
> `routers/spare_parts.py` und `frontend/src/components/spare-parts/`.

## 1. Definition: Was ist ein Lager-/Ersatzobjekt?

Lager / Ersatz ist ein eigener Bereich (eigener Navigations-Tab) innerhalb der
Anwendung. Fachlich gehören dorthin Ersatzstempel, Matrizen, Maschinenteile,
Ersatzteile und weitere Lagerobjekte (Anforderung 7, Vision Abschnitt 9).
Im Code existieren dafür **zwei parallele Modellierungen**:

| Modell | Kennzeichen | Status im Code |
|---|---|---|
| `Tool` mit `is_storage = true` | Werkzeug-Datensatz mit Lagermarkierung | verbindlich (DEC-052) |
| `StorageItem` (`storage_items`) | eigene Entität mit `storage_id` | **abgelöst (DEC-064)** – wird durch `SparePart` ersetzt |

> **Wichtig:** `docs/14-architecture.md` (DEC-035/036/037) und DEC-052 gehen von
> **`Tool` mit `is_storage = True`** aus. Die Tabelle `storage_items` samt
> `/api/storage` folgt dagegen der Task-Vorgabe 08.4. Der Docstring in
> `backend/app/models/storage_item.py` benennt diesen Konflikt selbst.
> **Erledigt:** Der Konflikt ist mit **DEC-064** entschieden – `Tool.is_storage`
> bleibt für Ersatz**werkzeuge**, `storage_items` wird durch die neue Tabelle
> `spare_parts` (Ersatz**teile**) ersetzt und entfernt (TASK-024).

## 2. Feldmodell

### 2.1 Variante A – `Tool` (verbindlich nach DEC-052)

`backend/app/models/tool.py`, Tabelle `tools`:

| Feld | Typ | Bedeutung |
|---|---|---|
| `tool_id` | `String(50)`, nullable | fachliche Werkzeug-/Lager-ID; `NULL` = „ohne ID" (Abstreifer/Matrize, DEC-055) |
| `category` | Enum `ToolCategory` | `Stempel`, `Abstreifer`, `Matrize` |
| `is_storage` | `bool`, default `false` | `true` = Lager-/Ersatzobjekt |
| `allow_duplicate_id` | `bool`, default `false` | Checkbox „Gleiche ID mehrfach zulassen" |
| `status` | Enum `ToolStatus`, nullable | `available`, `lent`, `in_transit`, `defective`, `maintenance` |
| `position_id` | FK → `positions.id`, `SET NULL`, nullable | Lagerplatz; `NULL` = Werkzeug-Ablage |
| `plant_id` / `tool_type_id` | FK, NOT NULL | Werk / Werkzeugtyp |
| `measure_a` / `measure_b` | `String(20)` | Maße |
| `machine_id` / `customer_id` | FK, nullable | optionale Zuordnung |

### 2.2 Variante B – `StorageItem` (abgelöst durch DEC-064)

`backend/app/models/storage_item.py`, Tabelle `storage_items`: `storage_id`
(`String(50)`, indexiert, NOT NULL), `name` (`String(200)`, NOT NULL), `type`
(`String(100)`), `article_number` (`String(100)`), `description` (`Text`),
`allow_duplicate_id` (`Boolean`, default `false`), `machine_id` und `location_id`
(`Integer`, nullable).

> **Wichtig:** `machine_id` und `location_id` in `StorageItem` sind reine Zahlen
> **ohne ForeignKey** (bewusst, laut Modelldocstring) – Verweise auf gelöschte
> Stammdaten bleiben gültig und werden nicht erzwungen. Zudem existiert für
> `storage_items` **keine Alembic-Migration**; die Tabelle entsteht nur über
> `Base.metadata.create_all` beim App-Start (`main.py`, `lifespan`).

### 2.3 Variante C – `SparePart` (verbindlich nach DEC-064, **umgesetzt**)

`backend/app/models/spare_part.py`, Tabelle `spare_parts` – **Ersatzteile**, die
Nachfolge von `StorageItem`. Das vollständige Feldmodell, die Rechte und die
Begründung stehen in **DEC-064**; hier nur die Abgrenzung zum Werkzeug-Weg:

| Merkmal | `Tool` (`is_storage = true`) | `SparePart` (`spare_parts`) |
|---|---|---|
| Identität | Werkzeug-ID, mehrfach erlaubt | **Artikelnummer** (Pflicht) |
| Menge | eine Zeile je Exemplar (DEC-052) | **`quantity` als Spalte** + `unit` |
| Lagerort | Matrix-Platz oder Ablage | **Freitext** `storage_place` **und/oder Matrix-Platz** `position_id` (Nachtrag zu DEC-064: ein belegter Platz ist für Werkzeuge gesperrt) |
| Werk | Pflicht | **Pflicht** |
| Status / Ausleihe | ja (formal) | **nein** – Bestand, kein Leihobjekt |
| Migration | Teil der `tools`-Revisionen | **eigene Alembic-Revision** (Pflicht) |
| Bereich in der UI | Tab „Werkzeuge" (Filter „Ersatz") | Tab „Ersatzteile" |

## 3. ID-Regel (Checkbox „Gleiche ID mehrfach zulassen")

Fachlich (Anforderung 7.1, Vision Abschnitt 9): Checkbox **aktiv** → dieselbe ID darf
mehrfach vorkommen; **inaktiv** → die ID muss eindeutig sein. Die Regel ist serverseitig
durchzusetzen. Umsetzung im Ist-Stand:

- Eindeutigkeitsbereich: **`tool_id` + `category` + `plant_id` + `is_storage`**
  (`CRUDTool.get_by_tool_id()`, `CRUDTool.count_by_tool_id()`).
- **Ohne ID wird nicht geprüft** (DEC-055): Abstreifer und Matrize dürfen ohne
  ID angelegt werden. `get_by_tool_id()`, `get_all_by_tool_id()` und
  `count_by_tool_id()` liefern bei `tool_id = None` leer bzw. `0` – sonst
  verglichen alle ID-losen Datensätze gegen `NULL` und wären füreinander
  Dubletten.
- `allow_duplicate_id` wird im Frontend **aus `is_storage` abgeleitet**
  (`ToolForm.tsx`: `allow_duplicate_id: isStorage`).
- `ToolService.create_tool()` / `update_tool()` prüfen Duplikate und werfen
  `ValueError("Werkzeug-ID … existiert bereits!")`; beim Bearbeiten wird das eigene
  Werkzeug über `exclude_id=tool_id` ausgenommen.
- `StorageItemService._ensure_unique_storage_id()` prüft analog für `storage_id`.
  → **entfällt mit DEC-064:** Ersatzteile haben keine `storage_id` und kein
  `allow_duplicate_id`; ihre Identität ist die Artikelnummer.

> **Wichtig:** Es gibt **keinen** `UNIQUE`-Constraint auf `tools.tool_id`. Die
> Eindeutigkeit ist ausschließlich Anwendungslogik im Service; bei `is_storage = true`
> ist sie bewusst ausgesetzt (DEC-052). Für `storage_items` existiert ebenfalls kein
> Unique-Index.

Live-Prüfung im Formular: `GET /api/tools/check-id` mit `tool_id`, `category`,
`plant_id`, `is_storage`, optional `exclude_id` →
`{ available, existing_count, message, locations?, prefill? }`.

> **Wichtig:** Die Anzeige im Formular folgt der Sicht des Benutzers, die
> Duplikat-Entscheidung folgt dem logischen Schlüssel. `locations` listet
> **alle** Datensätze der ID im Werk + Kategorie – normale Werkzeuge **und**
> Lager/Ersatz (`get_all_by_tool_id(..., is_storage=None)`). Blockiert wird
> dagegen weiterhin nur innerhalb des eigenen ID-Bereichs: bei
> `is_storage = false` zählen ausschließlich normale Werkzeuge, bei
> `is_storage = true` wird nie blockiert (DEC-052).

Je Eintrag in `locations` werden Fundort, Status und die Felder geliefert, die
beim Anlegen eines weiteren Exemplars übernommen werden können:

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | `int` | Datensatz-ID des Exemplars |
| `location` | `string` | Platz-Code (z. B. `01-A-25`) oder `Ablage` (`position_id = NULL`) |
| `status` | `string \| null` | Werkzeugstatus-Enum oder `null` („ohne Status“) |
| `is_storage` | `bool` | `false` = normales Werkzeug, `true` = Lager/Ersatz |
| `position_id` | `int \| null` | roher Lagerplatz-Verweis |
| `measure_a` / `measure_b` | `string \| null` | Maße |
| `description` | `string \| null` | Beschreibung |
| `tool_type_id` | `int` | Werkzeugtyp |
| `tool_type_name` | `string \| null` | Typ-Bezeichnung |

`prefill` bündelt den Übernahme-Vorschlag: `{ source_id, source_location,
source_is_storage, measure_a, measure_b, description, tool_type_id, in_tray }`.
`prefill` ist `null`, wenn es zu der ID noch keinen Datensatz gibt.

**Wahl der Vorlage (Vorrang in dieser Reihenfolge):**

1. Datensätze **mit festem Lagerplatz** – ein Exemplar in der Ablage hat keinen
   Vorrang. Innerhalb dieser Gruppe gewinnt ein Lager/Ersatz-Exemplar.
2. Gibt es keinen Datensatz mit Platz, dient die Ablage als Vorlage.
3. Innerhalb der gewählten Gruppe gewinnt der zuletzt angelegte Datensatz.

Beispiel: Ein aktiver Stempel auf `01-A-25`, ein Ersatz in der Ablage und ein
Ersatz auf `01-A-24` → Vorlage ist der Ersatz auf `01-A-24`.

| Fall | `available` | Meldung |
|---|---|---|
| `is_storage = true`, 0 Treffer | immer `true` | „Diese ID gibt es hier noch nicht." |
| `is_storage = true`, N Treffer | immer `true` | „Diese ID gibt es hier bereits N×." |
| `is_storage = false`, normales Werkzeug vorhanden | `false` | „Werkzeug-ID … ist in diesem Werk bereits vergeben." |
| `is_storage = false`, kein normales Werkzeug | `true` | „Werkzeug-ID ist frei." |

`ToolForm.tsx` blockiert das Speichern nur bei `!isStorage && idState === 'error'`.
Bei Lager/Ersatz setzt das Formular `idState = 'idle'` – eine bereits vorhandene
ID ist dort kein Fehler und bekommt deshalb **kein** grünes Erfolgs-Signal.

### 3.1 Darstellung im Anlegeformular

`ToolForm.tsx` zeigt bei aktiver Checkbox „Lager/Ersatz" genau **eine** Meldung
zur ID – als Guide-konformer Alert (`.ui-alert ui-alert-info`, Aufbau wie in
`UI-Styleguide.html`, Abschnitt „Tooltips & Alerts": Icon-Span + `<strong>` +
Body mit `opacity-80`):

- `<strong>` = `message` aus der Prüfung („Diese ID gibt es hier bereits 2×."
  bzw. „Diese ID gibt es hier noch nicht.")
- Body = je Treffer eine Zeile mit dem Platz-Code (Chip im App-Muster aus
  `ToolList.tsx`) und dahinter `Werkzeug`/`Ersatz` · Status bzw. „ohne Status"
- darunter ein Satz, was beim Speichern entsteht, z. B. „Beim Speichern
  entsteht 1 weiteres Exemplar in der Ablage."

Der Alert steht direkt unter der ID-/Typ-Zeile. Bei `is_storage = false` bleibt
es beim bisherigen grünen bzw. roten Hinweis unter dem ID-Feld.

Zuvor standen dieselbe Information zweimal im Formular (Erklärblock über dem
ID-Feld plus grüne Zeile darunter) und der Zähler erfasste nur die
Lager/Ersatz-Exemplare – das aktive Werkzeug auf seinem Lagerplatz fehlte. Für
den Benutzer ergab „Diese ID existiert bereits 1×" deshalb keinen Sinn, obwohl
er zwei Datensätze kannte.

### 3.2 Automatische Übernahme vorhandener Daten

Beim Anlegen von Lager/Ersatz füllt das Formular Felder aus einem vorhandenen
Datensatz derselben ID vor – **nur bei `Lager/Ersatz` und nur beim Anlegen**
(nicht beim Bearbeiten):

| Feld | Quelle |
|---|---|
| Maß A, Maß B | `prefill.measure_a` / `prefill.measure_b` |
| Werkzeug-Typ | `prefill.tool_type_id` |
| Beschreibung | `prefill.description` |
| Lagerplatz | `prefill.in_tray = true` → „In Ablage legen" wird aktiviert |

Regeln:

- Ein Feld wird nur gefüllt, wenn es leer ist **und** der Benutzer es nicht
  selbst bearbeitet hat (`touchedFields`); bereits übernommene Werte dürfen bei
  einer korrigierten ID erneut überschrieben werden (`prefillOwned`).
- Jeder Übernahme-Vorschlag wird pro ID genau einmal angewendet
  (`prefilledFor`).
- Ein Hinweis unter der ID nennt Vorlage und Felder („Von vorhandenem
  Ersatz-Exemplar (01-A-24) übernommen: Maß A, Werkzeug-Typ.") und bietet
  „Übernahme verwerfen" an.
- `in_tray` wird nur gesetzt, wenn die Checkbox „In Ablage legen" noch nicht
  angefasst wurde **und** kein Datensatz der ID einen Platz hat.
- Ist kein Platz gewählt, sagt der Alert das offen: „Noch kein Lagerplatz
  gewählt – ohne Auswahl geht das Exemplar in die Ablage." Die Ablage ist damit
  kein stiller Standard (Regel aus DEC-054).


## 4. Bestandsmodell (Mehrfachobjekte, kein Zähler)

> **Wichtig:** Mehrfachobjekte werden als **eigene Datensätze** geführt.
> Es gibt **keinen** `storage_count`-Zähler (DEC-052, Architektur 3.3).
> Die Bestandsmenge ergibt sich aus der Anzahl der Zeilen mit derselben ID.

- Ein Exemplar = eine Zeile in `tools` mit eigenem `id`, eigenem `status` und
  eigenem `position_id`. Ausleihe und Rückgabe arbeiten dadurch **pro Exemplar** –
  keine Teilausleihe und kein Umbau der Ausleihlogik nötig (DEC-052).
- Der Mengenstand ist abfragbar, aber nicht gespeichert: `existing_count` aus
  `/api/tools/check-id` bzw. `count_by_tool_id()`. Verworfen wurde die Variante
  „Mengenspalte `storage_count` in einer Zeile" (hätte Migration, Anzeige-Umbau und
  Teilausleihe erfordert).

### Anlage mehrerer Exemplare in einem Zug (`ToolForm.tsx`)

1. Checkbox **„Lager/Ersatz"** aktivieren → Zahlenfeld (min. 1, Standard 1) wird
   freigeschaltet (`title`: „Anzahl der Exemplare, die in einem Zug angelegt werden").
2. Beim Speichern entstehen `copies = Math.max(1, storageCount)` Datensätze.
3. **Nur das erste Exemplar** erhält den gewählten `position_id`; alle weiteren werden
   mit `position_id = null` angelegt (Werkzeug-Ablage), da ein Platz nur ein Werkzeug
   halten kann.
4. Die **Platzwahl ist bei Lager/Ersatz nicht Pflicht**. Wird kein Platz gewählt,
   entstehen alle Exemplare in der Ablage (`position_id = null`). Die serverseitige
   Prüfung „Platz belegt" greift weiterhin, sobald ein Platz angegeben ist. Bei
   normalen Werkzeugen (`is_storage = false`) bleibt der Platz Pflicht (oder „In Ablage
   legen").
5. Backendseitig ist jeder Aufruf ein eigener `POST /api/tools/` – die Anlage ist damit
   **nicht atomar**: bricht ein Aufruf ab, bleiben die vorherigen Exemplare bestehen.

## 5. Mengenbestand vs. Einzelobjekt

| Art | Modellierung | Erkennungsmerkmal |
|---|---|---|
| Einzelnes identifizierbares Werkzeug | eine Zeile, eindeutige ID | `is_storage = false` |
| Werkzeug mit Seriennummer | eine Zeile je Stück | eigene `tool_id` je Stück |
| Lager-/Ersatzobjekt (Mehrfach) | **eine Zeile je Exemplar** | `is_storage = true`, gleiche `tool_id` mehrfach |
| Mengenbestand ohne Einzelidentität | **nicht umgesetzt** | – |

> **Offen:** Für echten Mengenbestand (z. B. „200 Schrauben") gibt es kein Modell.
> DEC-052 schließt einen Zähler ausdrücklich aus; ob eine eigene Bestandsentität
> nötig ist, ist nicht entschieden.

## 6. Lagerplatzbelegung

> **Wichtig:** Ein konkreter Lagerplatz darf **nicht doppelt belegt** sein
> (Anforderung 7.2). Die Belegung wird an genau zwei Stellen synchron gehalten:
> `Position.tool_id` und `Tool.position_id`.

Serverseitige Absicherungen:

| Stelle | Prüfung |
|---|---|
| `ToolService.create_tool()` / `update_tool()` | „Angegebener Platz existiert nicht." / „Platz … ist bereits belegt." |
| `LocationService.move_position()` | Ziel belegt → „Bitte die Aktion als 'Tausch' ausführen." |
| `LocationService.swap_positions()` | Quelle und Ziel müssen belegt sein |
| `LocationService.insert_at_position()` | Quelle muss aus **anderer** Schublade kommen |
| `delete_position` (`DELETE /api/locations/positions/{id}`) | belegter Platz → HTTP 400 |

Plätze entstehen nicht manuell, sondern als Matrix aus
`POST /api/locations/cabinets/matrix` bzw. `POST /api/locations/drawers`: pro Schublade
`cols` (X) × `rows` (Y) Plätze mit fortlaufenden Namen `01`, `02`, … (`UNIQUE(drawer_id, name)`).
Beim Löschen eines Schranks oder einer Schublade werden Werkzeuge **nicht** gelöscht:
`LocationService._release_tools_from_positions()` setzt beide Seiten auf `NULL`, die
Werkzeuge liegen danach in der **Werkzeug-Ablage** (DEC-050). Die Antwort enthält
`{ "released_tools": <n> }`.

## 7. Suche im Bereich Lager/Ersatz

| Pfad | Endpunkt | Suchfelder |
|---|---|---|
| `Lager/Ersatz`-Tab (Variante B, **abgelöst**) | `GET /api/storage/?search=…` | `storage_id`, `name`, `article_number` (jeweils `ilike`) |
| Werkzeugliste (Variante A) | `GET /api/tools/?tool_id=…&is_storage=…` | `tool_id` (`ilike`), `category`, `plant_id`, `is_storage` |
| Tab `Ersatzteile` (**geplant, DEC-064**) | `GET /api/spare-parts/?search=…` | `article_number`, `name`, `type`, `storage_place` + `plant_id` |

- `StorageItemList.tsx`: Suchfeld mit Platzhalter „Lager/Ersatz durchsuchen
  (ID, Name, Typ, Artikelnummer) …", **300 ms Debounce**, `limit` serverseitig mit
  `ge=1, le=500` begrenzt (Standard 100).
- Rechte: `/api/storage` ist mit `require_active` geschützt – **jeder aktive Benutzer**
  darf suchen, lesen, anlegen, ändern und löschen (kein `require_admin`).
- `skip`/`limit` sind vorhanden, im Frontend aber noch nicht verdrahtet.

> **Abweichung:** `frontend/src/api/tools.ts` ruft `getTools()` **ohne**
> `is_storage`-Parameter auf (`/tools/?limit=500`). Die Werkzeugliste zeigt damit
> normale Werkzeuge und Lager-/Ersatzobjekte gemischt, obwohl `GET /api/tools` und
> `CRUDTool.get_multi()` den Filter `is_storage` bereits unterstützen.

## 8. Abgrenzung zum normalen Werkzeugbereich

| Merkmal | Normales Werkzeug | Ersatzwerkzeug (`is_storage = true`) | Ersatzteil (`SparePart`) |
|---|---|---|---|
| ID-Eindeutigkeit | eindeutig je Werk + Kategorie | mehrfach erlaubt (DEC-052) | Artikelnummer, mehrfach erlaubt |
| Bereich in der UI | Tab „Werkzeuge" (`Tools.tsx`, `ToolForm.tsx`) | Tab „Werkzeuge", Filter „Ersatz" (**DEC-066**) | Tab „Ersatzteile" (`SparePartList`/`SparePartForm`, **geplant**) |
| Status/Ausleihe | ja, `LendModal` pro Exemplar | formal möglich (gleiche Tabelle), fachlich nicht vorgesehen | nein |
| Lagerplatz | fester Platz oder Ablage | erstes Exemplar Platz, weitere in der Ablage | Freitext `storage_place` und/oder Matrix-Platz `position_id` |
| Menge | eine Zeile je Werkzeug | eine Zeile je Exemplar | `quantity`-Spalte |
| Admin-Sicht | Werkzeug bearbeiten in der Lagerstruktur | Admin-Panel „Lagerplätze" | – |

- Der Admin-Editor für Werkzeuge im Lager (`AdminStorageLocations.tsx`) liest und
  schreibt `is_storage` und `allow_duplicate_id` unverändert mit (`getToolById` → `updateTool`).
- Der Tab „Lager/Ersatz" ist für angemeldete Benutzer sichtbar; die Anlage eines
  Lagerobjekts erfordert nur `require_active`, nicht `require_admin`.
  → **Künftig:** Der Tab heißt „Ersatzteile"; Ersatzteile darf jeder aktive Benutzer
  lesen, anlegen und ändern, **löschen nur Admin** (DEC-064, wie in `routers/tools.py`).

## Offene Fragen

1. ~~**Modellentscheidung:** Bleibt `StorageItem` (`storage_items`, `/api/storage`) bestehen oder geht es in `Tool.is_storage = true` auf (DEC-052)?~~ **Entschieden (DEC-064):** Beides bleibt, aber getrennt nach Gegenstand – `Tool.is_storage` für Ersatz**werkzeuge**, `SparePart` (`spare_parts`) für Ersatz**teile**; `storage_items` und `/api/storage` werden entfernt.
2. **Datenbank-Constraint:** Soll die ID-Eindeutigkeit zusätzlich per Unique-Index abgesichert werden (Anforderung 18 nennt „Datenbank- und/oder Backend-Ebene")?
3. **Lagerplatz:** Teilen normale Werkzeuge und Lager-/Ersatzobjekte einen Matrix-Platzbestand, oder erhält Lager/Ersatz einen eigenen Platzraum?
4. **Atomare Mehrfachanlage:** Soll das Backend eine transaktionale Sammelanlage für N Exemplare anbieten (statt der Schleife im Frontend)?
5. ~~**Suche:** Bleibt der Tab „Lager/Ersatz" auf `storage_items` oder wechselt er auf `GET /api/tools?is_storage=true`? Derzeit sind die Suchfelder unterschiedlich.~~ **Entschieden (DEC-064/066):** Der Tab „Ersatzteile" sucht über `GET /api/spare-parts/`; Ersatzwerkzeuge werden über die Werkzeugliste mit `is_storage`-Filter gesucht.
6. ~~**Mengenbestand:** Wie ist „Mengenbestand" (Anforderung 8) ohne Zähler abzubilden?~~ **Entschieden (DEC-064):** Für Ersatzteile als Spalte `quantity` + `unit` (eine Zeile je Artikel und Lagerort); für Werkzeuge bleibt es bei „eine Zeile je Exemplar" (DEC-052).
7. **Veraltetes Architektur-Dokument:** `docs/14-architecture.md` nennt weiterhin `… → Position → StorageLocation` und `/api/locations/storage-locations`; DEC-048 hat `StorageLocation` entfernt (Migration `c7d9e2f3a1b8`).