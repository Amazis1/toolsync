# ToolSync – Lager und Ersatz

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 7, 8, 12, 13),
> `docs/13-decisions.md` (DEC-052 Mehrfach-ID, DEC-050 Werkzeug-Ablage,
> DEC-048 Lagerplatz-Matrix), `docs/14-architecture.md` (Abschnitt 3.3).
> Dieses Dokument beschreibt den **Ist-Stand der Implementierung** und benennt
> jede Abweichung ausdrücklich als solche.

## 1. Definition: Was ist ein Lager-/Ersatzobjekt?

Lager / Ersatz ist ein eigener Bereich (eigener Navigations-Tab) innerhalb der
Anwendung. Fachlich gehören dorthin Ersatzstempel, Matrizen, Maschinenteile,
Ersatzteile und weitere Lagerobjekte (Anforderung 7, Vision Abschnitt 9).
Im Code existieren dafür **zwei parallele Modellierungen**:

| Modell | Kennzeichen | Status im Code |
|---|---|---|
| `Tool` mit `is_storage = true` | Werkzeug-Datensatz mit Lagermarkierung | verbindlich (DEC-052) |
| `StorageItem` (`storage_items`) | eigene Entität mit `storage_id` | vorhanden, aber fachlich nicht entschieden |

> **Wichtig:** `docs/14-architecture.md` (DEC-035/036/037) und DEC-052 gehen von
> **`Tool` mit `is_storage = True`** aus. Die Tabelle `storage_items` samt
> `/api/storage` folgt dagegen der Task-Vorgabe 08.4. Der Docstring in
> `backend/app/models/storage_item.py` benennt diesen Konflikt selbst.
> Eine Zusammenführung ist **nicht entschieden**.

## 2. Feldmodell

### 2.1 Variante A – `Tool` (verbindlich nach DEC-052)

`backend/app/models/tool.py`, Tabelle `tools`:

| Feld | Typ | Bedeutung |
|---|---|---|
| `tool_id` | `String(50)`, NOT NULL | fachliche Werkzeug-/Lager-ID |
| `category` | Enum `ToolCategory` | `Stempel`, `Abstreifer`, `Matrize` |
| `is_storage` | `bool`, default `false` | `true` = Lager-/Ersatzobjekt |
| `allow_duplicate_id` | `bool`, default `false` | Checkbox „Gleiche ID mehrfach zulassen" |
| `status` | Enum `ToolStatus`, nullable | `available`, `lent`, `in_transit`, `defective`, `maintenance` |
| `position_id` | FK → `positions.id`, `SET NULL`, nullable | Lagerplatz; `NULL` = Werkzeug-Ablage |
| `plant_id` / `tool_type_id` | FK, NOT NULL | Werk / Werkzeugtyp |
| `measure_a` / `measure_b` | `String(20)` | Maße |
| `machine_id` / `customer_id` | FK, nullable | optionale Zuordnung |

### 2.2 Variante B – `StorageItem` (Task-Vorgabe, offen)

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

## 3. ID-Regel (Checkbox „Gleiche ID mehrfach zulassen")

Fachlich (Anforderung 7.1, Vision Abschnitt 9): Checkbox **aktiv** → dieselbe ID darf
mehrfach vorkommen; **inaktiv** → die ID muss eindeutig sein. Die Regel ist serverseitig
durchzusetzen. Umsetzung im Ist-Stand:

- Eindeutigkeitsbereich: **`tool_id` + `category` + `plant_id` + `is_storage`**
  (`CRUDTool.get_by_tool_id()`, `CRUDTool.count_by_tool_id()`).
- `allow_duplicate_id` wird im Frontend **aus `is_storage` abgeleitet**
  (`ToolForm.tsx`: `allow_duplicate_id: isStorage`).
- `ToolService.create_tool()` / `update_tool()` prüfen Duplikate und werfen
  `ValueError("Werkzeug-ID … existiert bereits!")`; beim Bearbeiten wird das eigene
  Werkzeug über `exclude_id=tool_id` ausgenommen.
- `StorageItemService._ensure_unique_storage_id()` prüft analog für `storage_id`.

> **Wichtig:** Es gibt **keinen** `UNIQUE`-Constraint auf `tools.tool_id`. Die
> Eindeutigkeit ist ausschließlich Anwendungslogik im Service; bei `is_storage = true`
> ist sie bewusst ausgesetzt (DEC-052). Für `storage_items` existiert ebenfalls kein
> Unique-Index.

Live-Prüfung im Formular: `GET /api/tools/check-id` mit `tool_id`, `category`,
`plant_id`, `is_storage`, optional `exclude_id` → `{ available, existing_count, message }`.

| Fall | `available` | Meldung |
|---|---|---|
| `is_storage = true`, 0 Treffer | immer `true` | „ID ist frei – wird als 1. Exemplar angelegt." |
| `is_storage = true`, N Treffer | immer `true` | „ID existiert bereits N× – wird als N+1. Exemplar angelegt." |
| `is_storage = false`, Treffer | `false` | „Werkzeug-ID … ist in diesem Werk bereits vergeben." |
| `is_storage = false`, kein Treffer | `true` | „Werkzeug-ID ist frei." |

`ToolForm.tsx` blockiert das Speichern nur bei `!isStorage && idState === 'error'`.

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
4. Backendseitig ist jeder Aufruf ein eigener `POST /api/tools/` – die Anlage ist damit
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
| `Lager/Ersatz`-Tab (Variante B) | `GET /api/storage/?search=…` | `storage_id`, `name`, `article_number` (jeweils `ilike`) |
| Werkzeugliste (Variante A) | `GET /api/tools/?tool_id=…&is_storage=…` | `tool_id` (`ilike`), `category`, `plant_id`, `is_storage` |

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

| Merkmal | Normales Werkzeug | Lager/Ersatz (`is_storage = true`) |
|---|---|---|
| ID-Eindeutigkeit | eindeutig je Werk + Kategorie | mehrfach erlaubt (DEC-052) |
| Bereich in der UI | Tab „Werkzeuge" (`Tools.tsx`, `ToolForm.tsx`) | Tab „Lager/Ersatz" (`StorageItemList`/`StorageItemForm`) |
| Status/Ausleihe | ja, `LendModal` pro Exemplar | formal möglich (gleiche Tabelle), fachlich nicht vorgesehen |
| Lagerplatz | fester Platz oder Ablage | erstes Exemplar Platz, weitere in der Ablage |
| Admin-Sicht | Werkzeug bearbeiten in der Lagerstruktur | Admin-Panel „Lagerplätze" |

- Der Admin-Editor für Werkzeuge im Lager (`AdminStorageLocations.tsx`) liest und
  schreibt `is_storage` und `allow_duplicate_id` unverändert mit (`getToolById` → `updateTool`).
- Der Tab „Lager/Ersatz" ist für angemeldete Benutzer sichtbar; die Anlage eines
  Lagerobjekts erfordert nur `require_active`, nicht `require_admin`.

## Offene Fragen

1. **Modellentscheidung:** Bleibt `StorageItem` (`storage_items`, `/api/storage`) bestehen oder geht es in `Tool.is_storage = true` auf (DEC-052)? Die Modelldatei nennt dies ausdrücklich eine offene Architekturfrage.
2. **Datenbank-Constraint:** Soll die ID-Eindeutigkeit zusätzlich per Unique-Index abgesichert werden (Anforderung 18 nennt „Datenbank- und/oder Backend-Ebene")?
3. **Lagerplatz:** Teilen normale Werkzeuge und Lager-/Ersatzobjekte einen Matrix-Platzbestand, oder erhält Lager/Ersatz einen eigenen Platzraum?
4. **Atomare Mehrfachanlage:** Soll das Backend eine transaktionale Sammelanlage für N Exemplare anbieten (statt der Schleife im Frontend)?
5. **Suche:** Bleibt der Tab „Lager/Ersatz" auf `storage_items` oder wechselt er auf `GET /api/tools?is_storage=true`? Derzeit sind die Suchfelder unterschiedlich.
6. **Mengenbestand:** Wie ist „Mengenbestand" (Anforderung 8) ohne Zähler abzubilden?
7. **Veraltetes Architektur-Dokument:** `docs/14-architecture.md` nennt weiterhin `… → Position → StorageLocation` und `/api/locations/storage-locations`; DEC-048 hat `StorageLocation` entfernt (Migration `c7d9e2f3a1b8`).