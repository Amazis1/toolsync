# ToolSync – Werkzeugverwaltung

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 4 „Werkzeugverwaltung“, 5 „Werkzeugtypen“, 13 „Suche“, 18 „Datenbank“), `docs/13-decisions.md` (DEC-050, DEC-051, DEC-052), `docs/00-project-vision.md` (Abschnitt 6, 7), `.continue/rules/02-domain-rules.md`.
>
> **Ist-Stand-Quellen:** `backend/app/models/tool.py`, `models/enums.py`, `models/master_data.py`, `schemas/tool.py`, `routers/tools.py`, `services/tool_service.py`, `crud/crud_tool.py`; `frontend/src/pages/Tools.tsx`, `components/tools/ToolList.tsx`, `components/tools/ToolTable.tsx`, `components/tools/ToolFilterBar.tsx`, `components/tools/ToolPagination.tsx`, `components/tools/ToolForm.tsx`, `lib/toolQuery.ts`, `api/tools.ts`, `api/types.ts`.
>
> Beschrieben wird der **tatsächlich implementierte** Stand. Abweichungen zu Anforderungen und Entscheidungen sind ausdrücklich als solche markiert.

## 1. Überblick und Ist-Stand-Artefakte

Der Bereich „Werkzeuge“ (`TabKey = 'werkzeuge'`) besteht aus: Route `routers/tools.py` (Präfix `/api/tools`, gesetzt in `main.py`), Service `ToolService` (Business-Logik, ID-Prüfung, Lagerplatz-Synchronisierung), CRUD `CRUDTool`, Model `Tool` (Tabelle `tools`), Schemas `ToolBase` / `ToolCreate` / `ToolUpdate` / `ToolRead` und im Frontend `pages/Tools.tsx`, `components/tools/ToolList.tsx`, `components/tools/ToolForm.tsx`.

## 2. Werkzeugfelder

Tabelle `tools` (`class Tool(Base, AuditMixin)`); `id`, `created_at`, `updated_at` kommen aus `AuditMixin`:

| Feld | Typ | Nullable | Pflicht im Formular | Bedeutung |
|---|---|---|---|---|
| `tool_id` | `String(50)` | **ja** | nur bei `Stempel` | Fachliche Werkzeug-ID, z. B. `TS-1004` oder `1075000`; `NULL` = „ohne ID" (DEC-055) |
| `category` | Enum `ToolCategory` (`native_enum=False`, Länge 20) | nein | ja (Radio) | Fachliche Kategorie, siehe Abschnitt 4 |
| `status` | Enum `ToolStatus` (`native_enum=False`, Länge 20) | ja | nein | „— ohne Status —“ ist wählbar |
| `is_storage` | `Boolean` | nein, Default `False` | ja (Checkbox „Lager/Ersatz“) | Schaltet den Mehrfach-ID-Modus frei |
| `allow_duplicate_id` | `Boolean` | nein, Default `False` | abgeleitet | Wird im Formular aus der Checkbox gesetzt: `allow_duplicate_id: isStorage` |
| `measure_a` | `String(20)` | ja | **ja** | Maß A in mm, normalisiert auf `123,45` |
| `measure_b` | `String(20)` | ja | nein | Maß B in mm, gleiche Normalisierung |
| `description` | `String(500)` | ja | nein | Freitext; Spalte „Bezeichnung“ in der Liste |
| `plant_id` | `FK plants.id` (`RESTRICT`) | nein | ja | Werk |
| `tool_type_id` | `FK tool_types.id` (`RESTRICT`) | nein | ja | Werkzeugtyp |
| `coating_id` | `FK coatings.id` (`SET NULL`) | ja | nein (Dropdown, **nur** bei `Stempel`) | Stempel-Beschichtung unter der Dachmarke MultiDur (DEC-083); **voller** Name im Feld, „Standard" vorausgewählt, ein leeres Feld gibt es nicht |
| `position_id` | `FK positions.id` (`SET NULL`) | ja | bedingt | Lagerplatz; `NULL` = Werkzeug-Ablage (DEC-050) |
| `machine_id` | `FK machines.id` (`SET NULL`) | ja | nein | Optionale Maschine |
| `customer_id` | `FK customers.id` (`SET NULL`) | ja | nein | Optionaler Kunde (DEC-051) |
| `is_favorite` | `Boolean` | nein, Default `False` | nein (Stern in der Liste) | **Globaler** Favorit: gilt für alle Benutzer, siehe Abschnitt 6.3 |

> **Wichtig:** Ein Lagerplatz (`Position`) kann nur **ein** Werkzeug halten. Die Belegung wird doppelt geführt – über `Tool.position_id` **und** über `Position.tool_id`. `create_tool()` / `update_tool()` prüfen `position.tool_id is not None` und antworten mit `ValueError` → HTTP 400 („Platz … ist bereits belegt.“). Beim Ändern oder Löschen gibt `_release_position()` den alten Platz frei. `Tool.plant`, `Tool.tool_type`, `Tool.coating`, `Tool.customer` **und `Tool.machine`** sind `lazy="joined"`, damit `GET /api/tools/` sie direkt mitliefert (die Liste zeigt Kunde und Maschine als eigene Spalte).

> **Hinweis (erledigt):** In `backend/app/schemas/tool.py` war ein Kommentar verstümmelt
> (das Wort „Für" war zu einem Ersatzzeichen zerstört). Behoben — ebenso vier
> gleichartige Stellen in `backend/app/crud/base.py`.

## 3. Werkzeug-ID, Eindeutigkeit und Typ-Code

`tool_id` ist ein freier `String(50)`; Format und Vergaberegeln werden **nicht** serverseitig erzwungen (Formular-Platzhalter: `z.B. TS-1004`). Die fachlich vorgesehene Struktur aus Anforderungen 5.2 / Vision 7 – eine ID wie `•1075000`, deren Anfang auf den Werkzeugtyp verweist (`•1` → Rund) – ist im Code **nicht** abgebildet. Logischer Schlüssel (DEC-052): `tool_id + category + plant_id + is_storage`.

> **Wichtig (DEC-055):** Die ID ist **nur beim Stempel** Pflicht (Formular **und** Service über `assert_tool_identity()` → HTTP 400). Abstreifer und Matrize werden über ihr Maß geführt und dürfen ohne ID angelegt werden; gespeichert wird dann `NULL` („ohne ID"), nie der leere String. Ein leeres Feld wird in `ToolCreate`/`ToolUpdate` zu `None` normalisiert. Unverändert Pflicht für alle Kategorien: Maß A, Werk, Werkzeug-Typ.

> **Wichtig:** Die Eindeutigkeit ist **nicht** per Datenbank-Constraint abgesichert. `models/tool.py` enthält **kein** `UniqueConstraint`; geprüft wird ausschließlich in `ToolService.create_tool()` / `update_tool()` über `CRUDTool.get_by_tool_id()`. Anforderungen 18 („Kritische Constraints wie Eindeutigkeit müssen auf Datenbank- und/oder Backend-Ebene abgesichert werden“) sind damit nur über die Backend-Ebene erfüllt – und nur, solange alle Schreibpfade über `ToolService` laufen.

Regel im Service: `existing` Treffer **und** `not allow_duplicate_id` → `ValueError` → HTTP 400 („Werkzeug-ID … existiert bereits!“). Beim Bearbeiten nimmt `exclude_id=tool_id` das eigene Werkzeug aus, damit es sich nicht selbst blockiert.

> **Wichtig (DEC-052):** Bei `is_storage = true` ist die ID **nicht** eindeutig. Jedes Exemplar ist ein eigener Datensatz (eigene Zeile), kein Mengenzähler. `allow_duplicate_id` wird aus `is_storage` abgeleitet.

### 3.1 Live-Prüfung: `GET /api/tools/check-id`

Parameter: `tool_id` (Pflicht), `category` (Pflicht), `plant_id` (Pflicht), `is_storage` (Default `False`), `exclude_id` (Default `None`). Antwort (Frontend-Typ `ToolIdCheck`):
`{ available: bool, existing_count: int, message: str, locations: ToolIdLocation[], prefill: ToolIdPrefill | null }`.

| Fall | `available` | Meldung |
|---|---|---|
| `is_storage = true`, 0 Treffer | `true` | „Diese ID gibt es hier noch nicht.“ |
| `is_storage = true`, N Treffer | `true` | „Diese ID gibt es hier bereits N×.“ |
| `is_storage = false`, normales Werkzeug vorhanden | `false` | „Werkzeug-ID … ist in diesem Werk bereits vergeben.“ |
| `is_storage = false`, kein normales Werkzeug | `true` | „Werkzeug-ID ist frei.“ |
| ohne ID (Abstreifer/Matrize, DEC-055) | `true` | „Ohne Werkzeug-ID wird nichts geprüft – Maß A ist hier das Pflichtfeld.“ (`locations: []`, `prefill: null`) |

> **Wichtig:** `locations` enthält **alle** Datensätze dieser ID im Werk und in der Kategorie – normale Werkzeuge **und** Lager/Ersatz. Die Prüfung ruft dafür `CRUDTool.get_all_by_tool_id(..., is_storage=None)` auf; nur die Duplikat-Entscheidung (`available`) bleibt auf den getrennten ID-Bereich beschränkt (`is_storage = false` zählt nur normale Werkzeuge, siehe DEC-052). Grund: für den Benutzer ist „01020000“ dieselbe ID, egal ob das Werkzeug auf dem Lagerplatz liegt oder als Ersatz in der Ablage.

Felder je Eintrag in `locations` (`ToolIdLocation`):

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | `int` | Datensatz-ID |
| `location` | `string` | Platz-Code (z. B. `01-A-25`) oder `Ablage` (`position_id = NULL`) |
| `status` | `string \| null` | Werkzeugstatus-Enum oder `null` („ohne Status“) |
| `is_storage` | `bool` | `false` = normales Werkzeug, `true` = Lager/Ersatz |
| `position_id` | `int \| null` | roher Lagerplatz-Verweis |
| `measure_a` / `measure_b` | `string \| null` | Maße des Datensatzes |
| `description` | `string \| null` | Beschreibung des Datensatzes |
| `tool_type_id` | `int` | Werkzeugtyp |
| `tool_type_name` | `string \| null` | Typ-Bezeichnung (z. B. `01 Rund`) |

`prefill` (`ToolIdPrefill`) ist der Übernahme-Vorschlag für das Anlegeformular. Vorlage ist der Datensatz **mit festem Lagerplatz** – er hat Vorrang vor einem Exemplar in der Ablage; innerhalb dieser Gruppe gewinnt ein Lager/Ersatz-Exemplar, danach der zuletzt angelegte Datensatz. Enthalten sind `source_id`, `source_location`, `source_is_storage`, `measure_a`, `measure_b`, `description`, `tool_type_id` und `in_tray`. `prefill` ist `null`, wenn es zu der ID noch keinen Datensatz gibt.

> **Hinweis:** `in_tray = true` nur, wenn **kein** Datensatz der ID einen festen Lagerplatz hat (also alles in der Ablage liegt). Sobald ein Datensatz einen Platz hat, bleibt die Platzwahl im Formular offen – die Ablage soll nicht stiller Standard sein. Ein Platz kann ohnehin nur ein Werkzeug halten, das vorhandene Werkzeug bleibt also auf seinem Platz und das neue Exemplar bekommt einen anderen.

Das Formular ruft die Route mit **400 ms Debounce** auf und blockiert nur normale Werkzeuge: `if (!isStorage && idState === 'error')`. Bei Lager/Ersatz setzt das Formular bewusst **keinen** grünen Erfolgszustand (`idState = 'idle'`), weil eine bereits vorhandene ID dort kein Fehler ist.

> **Wichtig:** `/types` und `/check-id` müssen in `routers/tools.py` **vor** `/{id}` stehen. Sonst würde `check-id` als `id` geparst und die Anfrage mit HTTP 422 fehlschlagen. Der Code hält diese Reihenfolge ein und kommentiert sie.

### 3.2 Typ-Code und kombinierte Bezeichnung

> **Wichtig:** `ToolType` besitzt **genau ein** Feld: `name` (`String(100)`, `unique=True`). Es gibt **keine** getrennten Felder `code` und `name`. Der Typ-Code ist Bestandteil des Namens-Strings – die geforderte **kombinierte Bezeichnung** (`•1 Rund`, `•2 Quadrat`).

| Stelle | Darstellung |
|---|---|
| Admin-Panel (`AdminStammdaten.tsx`, `AdminToolTypes.tsx`) | Spaltenkopf „Typ-Code + Bezeichnung“, Platzhalter „Neuer Typ, z. B. 01 Rund“ |
| Anlege-/Bearbeitungsformular | `<select>` mit `{t.name}` als Optionstext |
| Werkzeugliste | Suchtreffer über `tool.tool_type?.name`; die Spalte „Bezeichnung“ nutzt `description` **oder** `tool_type?.name` |

Werkzeugtypen-Endpunkte (Präfix `/api/tools`): `GET /types` (`require_active`, sortiert nach `ToolType.name`), `POST /types` (`require_admin`, 201, HTTP 400 bei doppeltem Namen), `PUT /types/{id}` (`require_admin`, 404 unbekannt, 400 Namenskonflikt), `DELETE /types/{id}` (`require_admin`, 204).

> **Abweichung Code ↔ Kommentar:** Der Docstring von `delete_tool_type()` behauptet „entkoppelt zugeordnete Werkzeuge (SET NULL)“. Real ist `Tool.tool_type_id` `nullable=False` mit `ondelete="RESTRICT"`. Das Löschen eines zugeordneten Typs muss daher auf DB-Ebene scheitern; der Router fängt den Fehler **nicht** ab (kein 400/409, sondern Serverfehler).

> **Abweichung Code ↔ Anforderung:** Anforderungen 5 und Vision 7 verlangen, dass Matrize und Abstreifer **keine** Werkzeugtypen sind. Der Code erzwingt das nicht: Werkzeugtypen sind frei editierbare Freitext-Einträge – „Matrize“ oder „Abstreifer“ lassen sich unverändert als Typ anlegen.

## 4. Kategorien und Status

**`ToolCategory`** (`models/enums.py`): `Stempel`, `Abstreifer`, `Matrize` – im Frontend identisch beschriftet (`TOOL_CATEGORY_LABELS`).

> **Wichtig:** Anforderungen 5 / Vision 7 werden hier nicht abgebildet. Der Code führt Matrize und Abstreifer als **Kategorie** (`ToolCategory`), nicht als Werkzeugtyp. Der Werkzeugtyp ist eine separate Stammdaten-Tabelle (`ToolType`, freier Name). Beide Achsen existieren parallel und unabhängig.

**`ToolStatus`** (`models/enums.py`): `available` → „Verfügbar“ (`ui-badge-success`, `bg-emerald-500`); `lent` → „Ausgeliehen“ (`ui-badge-info`, `bg-teal-500`); `in_transit` → „In Transit“ (`ui-badge-danger`, `bg-rose-500`); `defective` → „Defekt“ (`ui-badge-danger`, `bg-rose-500`); `maintenance` → „In Wartung“ (`ui-badge-warning`, `bg-amber-500`); `null` → kein Badge, Anzeige „—“.

> **Offen:** `status` ist nullable und hat **keinen** DB-Default. Die Statusliste aus Anforderungen 12 (u. a. „in Reparatur“, „nicht verfügbar“) ist damit nur teilweise gedeckt. „Statuswechsel müssen fachlich nachvollziehbar sein“ ist im Werkzeugpfad nicht umgesetzt: `update_tool` schreibt `status` ohne Protokolleintrag. Der Verlauf (Aktion `status_change`, siehe `docs/09-admin-panel.md`) entsteht nur über die Lagerplatz-Routen in `routers/locations.py`.

## 5. CRUD-Abläufe und Endpunkte

Präfix `/api/tools` (`main.py`: `app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])`).

| Methode | Pfad | Recht | Antwort | Verhalten |
|---|---|---|---|---|
| `GET` | `/` | `require_active` | 200, `ToolPage` | Suche + Filter + Sortierung + Pagination, siehe Abschnitt 6 |
| `GET` | `/check-id` | `require_active` | 200 | Live-ID-Prüfung (Abschnitt 3.1) |
| `GET` | `/{id}` | `require_active` | 200 / 404 | Einzelwerkzeug (`detail: "Tool not found"`), inkl. `position_code` |
| `PUT` | `/{id}/favorite` | `require_active` | 200 / 404 | Favoriten-Markierung setzen (`{"is_favorite": bool}`), siehe Abschnitt 6.3 |
| `POST` | `/` | `require_active` | 201 / 400 | Anlegen; `ValueError` → HTTP 400 mit `detail` |
| `PUT` | `/{id}` | `require_active` | 200 / 400 / 404 | Ändern |
| `DELETE` | `/{id}` | **`require_admin`** | 204 | Löschen inkl. Platzfreigabe |

`create_tool()`: (1) Duplikatprüfung mit `is_storage`, (2) falls `position_id` gesetzt – Platz existiert? sonst `ValueError` „Angegebener Platz existiert nicht.“, (3) Platz frei? sonst `ValueError` „Platz … ist bereits belegt.“, (4) `crud.create(data)`, (5) `_set_position_tool()` setzt `Position.tool_id` und committet. `update_tool()` ergänzt die `exclude_id`-Duplikatprüfung, die Freigabe des alten Platzes bei Positionswechsel und ein explizites Nachziehen von `position_id = None`, weil `CRUDBase.update()` None-Werte überspringt. `delete_tool()` gibt zuerst den Platz frei und löscht danach; `Tool.movements` ist `cascade="all, delete-orphan"` – die Bewegungen des Werkzeugs verschwinden mit.

> **Wichtig:** Reads, `POST` und `PUT` verlangen **kein** feingranulares Recht, sondern nur einen aktiven Benutzer (`require_active`). Nur `DELETE` ist auf `require_admin` beschränkt.

## 6. Suche, Filter, Sortierung und Pagination

Suche, Filter, Sortierung und Ausschnitt passieren **in der Datenbank**. Die Oberfläche lädt immer nur eine Seite; die Filterlogik existiert damit genau einmal (Backend) und nicht zusätzlich im Browser.

### 6.1 Liste: `GET /api/tools/`

Antwort ist eine **Seitendarstellung** `ToolPage` statt einer nackten Liste:

| Feld | Typ | Bedeutung |
|---|---|---|
| `items` | `List[ToolRead]` | Datensätze dieser Seite, jeder mit `position_code` (Abschnitt 6.4) |
| `total` | `int` | Gesamtzahl der Treffer mit denselben Filtern (Grundlage für „1–25 von 342“ und die Seitenzahlen) |
| `skip` | `int` | Offset der Anfrage |
| `limit` | `int` | Seitengröße der Anfrage |

Parameter:

| Parameter | Typ | Default | Verhalten |
|---|---|---|---|
| `q` | `str` | – | `ILIKE '%wert%'` über `tool_id`, `description`, `tool_type.name`, `plant.name`, `customer.name`, `machine.name`; zusätzlich die **Kategorie**, wenn der Suchbegriff in ihrem Namen vorkommt (wer „Stempel“ tippt, meint die Stempel). Die Felder entsprechen den Spalten der Liste — was man sieht, findet man auch |
| `category` | `List[ToolCategory]` | – | mehrfach angebbar (= ODER innerhalb des Filters) |
| `status` | `List[ToolStatus]` | – | mehrfach angebbar |
| `plant_id` | `int` | – | Werk |
| `tool_type_id` | `int` | – | Werkzeugtyp |
| `is_storage` | `bool` | – | `true` = nur Lager/Ersatz, `false` = nur normale Werkzeuge |
| `has_place` | `bool` | – | `true` = nur mit festem Lagerplatz, `false` = nur Ablage |
| `favorites_only` | `bool` | `false` | nur Favoriten (Abschnitt 6.3) |
| `sort` | `Literal` | `tool_id` | Whitelist: `tool_id`, `description`, `measure_a`, `status`, `plant`, `tool_type`, `location`, `customer`, `machine`. Alles andere → **HTTP 422** |
| `order` | `Literal` | `asc` | `asc` / `desc` |
| `skip` | `int` ≥ 0 | `0` | Offset |
| `limit` | `int` 1…200 | `25` | Seitengröße; der Deckel verhindert, dass eine Anfrage die ganze Tabelle zieht |

**Wichtig — stabile Reihenfolge:** An jede Sortierung wird `id` als zweites Kriterium angehängt. Ohne diesen Tiebreaker kann dieselbe Zeile bei gleichen Sortierwerten auf zwei Seiten erscheinen oder zwischen zwei Seiten verschwinden.

**Wichtig — keine freien Spaltennamen:** `sort` und `order` sind `Literal`-Typen (`crud/crud_tool.py`, `ToolSortKey`/`ToolSortOrder`). Ein unbekannter Wert endet in HTTP 422, bevor eine Abfrage entsteht.

**Numerisch sortieren:** `measure_a` liegt als Text vor (normalisiert auf `7,00`). Textweise sortiert stünde `10,00` vor `7,00`, deshalb wird über `CAST(NULLIF(REPLACE(measure_a, ',', '.'), '') AS FLOAT)` sortiert. `NULLIF` schützt Postgres vor `CAST('' AS FLOAT)`.

**Leere Werte ans Ende:** Alle Sortierspalten nutzen `NULLS LAST` — in beide Richtungen. Sonst stünden Datensätze ohne Bezeichnung beim Absteigen ganz oben.

**Status fachlich sortieren:** `status` sortiert nicht nach dem Speicherwert (`AVAILABLE`, `DEFECTIVE`, … — alphabetisch wäre das willkürlich), sondern über einen `CASE`-Rang: Verfügbar → Ausgeliehen → In Transit → In Wartung → Defekt → ohne Status.

**Aliase statt Relationship-Joins:** Für Suche und Sortierung werden `Plant`, `ToolType`, `Position`, `Drawer`, `Cabinet`, `Customer` und `Machine` als `aliased()` gejoint. Die Beziehungen `Tool.plant` / `Tool.tool_type` / `Tool.customer` / `Tool.machine` sind `lazy="joined"`; ein zweiter Join auf dieselbe Tabelle ohne Alias wäre ein SQL-Fehler. Es sind ausschließlich n:1-Joins (Kunde und Maschine als LEFT JOIN, beide sind optional), die Zeilenzahl bleibt also korrekt.

### 6.2 Pagination in der Oberfläche

`components/tools/ToolPagination.tsx` nutzt `.ui-pagination` aus dem Styleguide und zeigt immer, wo man steht: „1–25 von 342“, „Seite 3 von 14“, Seitengröße 25/50/100, erste/vorherige/nächste/letzte Seite und ein Fenster von Seitennummern mit Auslassung. Die aktive Seite trägt `aria-current="page"`.

**Jeder Filterwechsel setzt auf Seite 1 zurück** (`withPageReset`). Ohne das landete man nach dem Verengen der Liste auf einer Seite 7, die es nicht mehr gibt.

Wird die aktuelle Seite durch eine Löschung oder eine engere Auswahl leer, obwohl es Treffer gibt, springt die Liste auf die letzte tatsächlich vorhandene Seite (`pageCount`) — statt eine leere Tabelle zu zeigen.

### 6.3 Favoriten (global)

Favoriten sind eine **Eigenschaft des Werkzeugs**, nicht des Kontos: Spalte `tools.is_favorite`, gesetzt über `PUT /api/tools/{id}/favorite` mit `{"is_favorite": true|false}`. Alle Benutzer sehen dieselben Favoriten. Begründung: in der Werkstatt arbeiten mehrere Personen an denselben Geräten; eine Markierung pro Konto müsste auf jedem Tablet neu gesetzt werden.

* **Eigener Endpunkt:** `PUT /{id}` (Bearbeiten) setzt `is_favorite` **nicht** — das Feld steht bewusst nur in `ToolRead`, nicht in `ToolBase`. Ein normales Bearbeiten kann die Markierung daher nicht zurücksetzen (durch einen Test abgesichert, `tests/test_tools_list.py`).
* **Kein Admin-Recht:** Favorisieren ändert nichts am Bestand, deshalb genügt `require_active` (anders als beim Löschen).
* **Filter:** `?favorites_only=true`.
* **Oberfläche:** Sternspalte als erste Spalte (`aria-pressed`, gefüllter/offener Stern — die Form trägt die Information, nicht nur die Farbe), optimistisches Umschalten mit Rollback und Fehlermeldung, plus Filter „Nur Favoriten“ (`.ui-switch`). Bewusst **keine** automatische Favoriten-Sortierung: die würde die gewählte Sortierung überschreiben.

### 6.4 Lagerplatz-Code in der Liste

`ToolRead.position_code` wird für die Liste aus `cabinet.name` / `drawer.name` / `position.name` gebildet (`01-A-25`) und ist `null`, wenn das Werkzeug keinen festen Platz hat (Ablage). Damit zeigt die Spalte „Lagerplatz“ den tatsächlichen Fundort statt nur des Werks, und die Liste braucht dafür keine Abfrage pro Zeile.

### 6.5 Zustand in der Adresszeile

`lib/toolQuery.ts` hält den Zustand der Liste (Suche, alle Filter, Sortierung, Seite, Seitengröße) und übersetzt ihn in beide Richtungen: in die Abfrage des Backends und in die Adresszeile. Nur vom Standard abweichende Werte erscheinen dort (`?q=rund&status=available&sort=description&richtung=desc&seite=2&groesse=50`).

Damit gilt: Neuladen behält die Ansicht, ein Link ist teilbar, die Zurück-Taste führt zum vorherigen Filterzustand — und der Zustand liegt in `pages/Tools.tsx` statt in der Liste, sodass der Weg ins Formular und zurück nichts verliert.

Tippen ersetzt den Verlaufseintrag (`replaceState`), ein Klick auf Filter, Sortierung oder Seite legt einen an (`pushState`) — sonst stünde nach „Stempel“ viermal derselbe Zwischenstand im Verlauf.

### 6.6 Tests

`backend/tests/test_tools_list.py` prüft Suche (alle vier Felder), Mehrfachfilter, `has_place`/`is_storage`, numerische Maß-Sortierung, die fachliche Status-Reihenfolge, `NULLS LAST`, `total` und Seitenschnitte, die stabile Reihenfolge über Seitengrenzen, den Lagerplatz-Code und die Favoriten.
`frontend/tests/tools-list.spec.ts` prüft dieselben Wege im Browser (Sortieren über die Spaltenköpfe inkl. fachlicher Status-Reihenfolge, Chips und Zurücksetzen, Status-Mehrfachmenü, Favoriten inkl. Neuladen, Blättern, Seitengröße, Zurück-Taste, 1440×900 und 390×844). Die Spec legt ihre Testdaten selbst an und räumt sie über die Suche wieder weg.

## 7. Werkzeugliste und Anlege-Formular

**Seite `pages/Tools.tsx`:** Zustand `query` (Suche, Filter, Sortierung, Seite, Seitengröße — siehe Abschnitt 6.5), `searchText`, `tools`, `total`, `listError`, `actionError`, `successMessage`, `plants`, `toolTypes`, `busyFavoriteId`, `reloadKey` sowie die Dialoge (`showForm`, `editingTool`, `toolToDelete`, `lendTool`). Der Tabbar-Button „+ Anlegen“ erhöht `createSignal`; ein `useEffect` ruft daraufhin `openCreateForm()`. Bei `showForm === true` wird der Listenblock **ersetzt** durch `.tool-form-card` (Inline-Formular, **kein** Modal) mit der Überschrift „Anlegen“ bzw. „Bearbeiten“. Der Filterzustand bleibt dabei erhalten, weil er in der Seite liegt und nicht in der Liste.

Die Liste wird **abgeleitet geladen**: „lädt gerade“ ergibt sich daraus, ob die aktuell angeforderte Abfrage schon beantwortet wurde (`loadedKey !== requestKey`). Damit kann der Ladezustand nicht zur angezeigten Seite auseinanderlaufen, und die alten Zeilen bleiben während des Nachladens stehen — die Tabelle springt beim Blättern nicht. Antworten werden über eine laufende Nummer (`requestId`) verworfen, wenn inzwischen eine neuere Anfrage läuft.

`handleSave()` ruft `updateTool(editingTool.id, data)` oder `createTool(data)`, lädt neu und schließt das Formular; Erfolgsmeldung als `ui-alert-success` („„TS-1004“ wurde gespeichert.“). Beim Löschen erscheint ein `ConfirmDialog` (kein `window.confirm` mehr).

**Liste `components/tools/ToolList.tsx`** ist die Komposition aus Filterleiste, Tabelle und Blätterleiste; sie lädt nichts selbst (Zustand und Abfrage liegen in `pages/Tools.tsx`) und enthält die drei Zustände:

| Zustand | Anzeige |
|---|---|
| keine Daten | „Noch keine Werkzeuge vorhanden“ + Knopf „Werkzeug anlegen“ |
| keine Treffer bei aktiver Suche/Filter | „Keine Treffer für „xyz““ bzw. „Keine Werkzeuge für die aktuellen Filter“ + „Alle Filter zurücksetzen“ |
| Seite leer, aber Treffer vorhanden | „Diese Seite ist leer“ + „Zur ersten Seite“ (Übergangszustand nach Löschungen) |

**Tabelle `components/tools/ToolTable.tsx`** – Aufbau nach den beiden Tabellen-Varianten des Styleguides („Tabellen & Status Badges“ und „Werkzeugübersicht – Variante 2“): **zweizeilige Zellen** statt einer Spalte pro Feld, Glasrahmen, Aktionsspalte mit `…`-Menü.

| Spalte | Hauptzeile | Unterzeile | sortierbar |
|---|---|---|---|
| Favorit | Stern (`aria-pressed`, gefüllt = gesetzt, mit amber getönter Fläche) | — | nein |
| Werkzeug-ID / Kategorie | farbiger Kategorie-Chip (Anfangsbuchstabe) + `tool_id` als Glas-Markierung in `text-sm` (14 px, Mono, teal-getönte Kante) | Kategorie, bei Lager/Ersatz zusätzlich „ · Lager/Ersatz"; bei gepflegter Beschichtung „ · MultiDur TiCN" (DEC-083, voller Name – paßt seit dem breiteren Seitenraster ohne Überlauf) | `tool_id` |
| Lagerplatz / Werk | `position_code` als Mono-Markierung („Ablage“ als neutrales Badge) | `plant.name` | `location` |
| Typ / Maße | Typ-Code als eigener kleiner Chip + Bezeichnung (`01` + `Rund`) | Maße (`2,00/4,00 mm`) oder „keine Maße“ | `tool_type` |
| Beschreibung | `description` (ohne Rückfall auf den Typ); leer = „—“; gekürzt auf 10 rem | — | `description` |
| Kunde / Maschine | Kundenname mit Farbpunkt aus `customer.color` (Stammdaten) | `machine.name` | `customer` |
| Aktionen | nur der `…`-Knopf; der **Spaltenkopf heißt ausgeschrieben „Aktionen"** (statt eines `…`-Symbols) | — | nein |

> **Reihenfolge nach Wichtigkeit für die Werkstatt:** erst **wo** das Werkzeug liegt (Lagerplatz mit Werk), dann was es ist (Typ, Maße), dann die Beschreibung und zuletzt die Zuordnung (Kunde, Maschine). Der Kategorie-Chip färbt nach Kategorie (Stempel = Teal, Abstreifer = Sky, Matrize = Amber, jeweils Textfarben aus §1.8); der Farbpunkt am Kunden kommt aus den Stammdaten und macht gleiche Kunden ohne Lesen erkennbar.

> **Werkzeug-ID und Lagerplatz hervorgehoben:** Beides sind Suchbegriffe. Die ID steht in einer weißen Glas-Markierung mit teal-getönter Kante in **14 px** (Tabellenschrift ist 12 px), der Lagerplatz-Code in einer ruhigeren Markierung in 12 px — eine Ebene darunter, aber sichtbar abgesetzt. „Ablage“ (kein fester Platz, DEC-050) steht als neutrales `.ui-badge`.

> **Kein Status in der Tabelle (bewusst):** Die Statusspalte ist entfallen. In der Praxis stand sie fast immer auf „Ohne Status“, und bei ausgeliehenen Werkzeugen wiederholte sie nur das Badge. Der Status lebt weiter im **Formular** (Feld „Status“, inkl. „— ohne Status —“) und als **Filter** über der Liste (`?status=lent`). Folge für die Aktionen: „Ausleihen“ erscheint im Zeilenmenü für alles, was **nicht** bereits ausgeliehen ist (`status !== 'lent'`) — vorher hing die Aktion an `status === 'available'` und verschwand bei ungepflegtem Status.

| Detail | Verhalten |
|---|---|
| Rahmen | `.glass-preview-card` + `overflow-x-auto` (Guide: „Rahmen, Radius und Glasfläche kommen aus dem Guide“); Zeilen über `divide-y divide-slate-200/50` |
| Zeilenverlauf | Jede Datenzeile trägt den **Glasverlauf** `.table-row-glass` — derselbe diagonale Verlauf wie `.glass-card` (`135deg`, Weiß → Hellgrau), deutlich schwächer dosiert. Als `background-image` liegt er über den Farbwerten, deshalb bleiben Zebra, Hover und Favoritenfarbe sichtbar. Gemessen innerhalb einer Zeile: oben links `rgb(250,251,251)` → unten rechts `rgb(241,235,226)` (Favoritenzeile), also 6–9 Stufen Verlauf |
| Seitengröße | **10 Werkzeuge** je Seite (Vorgabe), wählbar 10 / 25 / 50 / 100. Zehn Zeilen passen in die Seite, deshalb braucht die Tabelle **kein eigenes Scrollfeld** und keine zweite Bildlaufleiste |
| Kopfzeile | Ruhiges Band `bg-slate-200/40` über dem Kopf mit `border-b border-slate-300/60`. Bewusst **nicht** weiß (Weiß bei 95 % war der hellste Punkt der Seite) und bewusst **nicht klebend** – siehe Kasten unten |
| Zebra-Streifen | Jede zweite Zeile ein Hauch heller (`even:bg-white/40`, gemessen `rgb(250,251,251)` gegen `rgb(247,247,249)`). Der Verlauf hat den Unterschied zunächst auf zwei Stufen gedrückt, deshalb wurde die Tönung von 25 % auf 40 % angehoben. Hover `bg-white/70` (gemessen `rgb(253,253,253)`) bleibt deutlich stärker |
| Favoriten | Zeile in warmem Amber (`bg-amber-500/[0.08]`, gemessen `rgb(244,237,227)`), Hover `/0.14`; Stern gefüllt in sattem Gold `text-amber-600` (gemessen `rgb(225,113,0)`) mit `bg-amber-500/20` als Fläche. Favoritenzeilen bekommen **kein** Zebra – beides zusammen würde sich gegenseitig aufheben |
| Markierungen | Werkzeug-ID **und** Lagerplatz stehen als gleichartige Markierung in der Zeile: `rounded-lg`, Mono, fett, **14 px** (`text-sm`), weiße Fläche — unterschieden nur durch die Kante: ID = Teal (`border-teal-700/30`, Primär = Identität), Lagerplatz = Sky (`border-sky-500/30`, Info = Ort). Ohne festen Platz steht dort die gleich große Markierung „Ablage“ (neutral) |
| Sortierung zurücksetzen | **Ein** Weg zurück zur Standardsortierung (Werkzeug-ID aufsteigend): der **dritte Klick** auf denselben Spaltenkopf (aufsteigend → absteigend → Standard). Die Sortierung erscheint bewusst **nicht** in der Filterabwahl – kein Chip, kein Zurücksetzen-Knopf: sie ist keine Filterauswahl, sondern eine Sicht auf dieselbe Liste. Die Reihenfolge bleibt dabei immer bestimmt, sie fällt nie in eine unbestimmte Ordnung |
| Kategorie-Chip | Anfangsbuchstabe auf getönter Fläche: Stempel = Teal, Abstreifer = Sky, Matrize = Amber (nur Textfarben aus Guide §1.8) |
| Breite | Gemessen (Chromium): 780 px Mindestbreite, Container 695 px bei 1280, **815 px bei 1440 → Überlauf 0 px**, Hinweis bleibt aus. Bei 1280 fehlen ~85 px, dann erscheint der Hinweis. Die Beschreibungsspalte ist auf 10 rem (160 px) begrenzt, sonst schiebt ein langer Freitext die Tabelle über die Breite. |
| Aktionsspalte | nur `…` (`components/tools/RowActionMenu.tsx`): Das Menü enthält die Aktionen der Zeile — „Ausleihen“ (hervorgehoben), „Bearbeiten“, „Löschen“ (rot). Es liegt in einem **Portal an `<body>`**, wird aus der Position des Knopfes berechnet (`position: fixed`) und fährt **nach links** aus (`.ui-menu .ui-menu-left`). Portal, weil die Tabelle in einem Container mit `backdrop-filter` liegt: ein `backdrop-filter` macht das Element zum Bezugsrahmen für `position: fixed` (das Menü säße verschoben in der Zelle), und der Überlauf würde es abschneiden. Bei Scrollen/Größenänderung wandert das Menü mit; ist der Knopf aus dem Bild, schließt es. Escape, Klick außerhalb und jede Auswahl schließen es, der Fokus kehrt zum Knopf zurück. |
| Keine fixierte Spalte | Eine fixierte Aktionsspalte lag über den übrigen Zellen und brauchte eine deckende Fläche, die aus der Glasliste herausfiel. Läuft die Tabelle über, sagt der Hinweis unter der Tabelle das — der Überlauf wird per `ResizeObserver` **gemessen**. |
| Erste Ladung | Skelettzeilen (`ui-skeleton`) in Zeilenform, damit die Tabelle ihre Höhe behält |

> **Zurückgenommene Versuche (bewusst):** Eine Gruppenkopfzeile über den Spalten, eine farbige 3-px-Schiene am Zeilenrand je Kategorie, Gruppentrenner zwischen den Spaltenblöcken sowie Maße in Mono mit `tabular-nums` wurden ausprobiert und wieder entfernt — die Tabelle sollte ruhiger bleiben. Geblieben sind **Zebra-Streifen**, die **Favoritenfarbe** und die schlichte Kopfzeile.

> **Klebende Kopfzeile und eigenes Scrollfeld — warum nicht:** Beides wurde gebaut und wieder entfernt. Grund: Eine klebende Kopfzeile braucht einen Scrollbereich (sonst hat `position: sticky` keine Bezugsfläche), der Scrollbereich bringt aber eine **zweite Bildlaufleiste in der Tabelle** mit. Und `position: sticky` kann nicht am Fenster kleben, solange die Tabelle seitlich scrollbar ist — ein `overflow`-Container ist immer die Bezugsfläche. Bei zehn Werkzeugen je Seite ist ein eigenes Scrollfeld ohnehin unnötig. Entscheidung des Auftraggebers: **keine Leiste in der Tabelle**, Kopfzeile scrollt mit.

**Rückmeldungen als Toast (`components/ToastStack.tsx`, `lib/useToasts.ts`)** – Anlegen, Bearbeiten, Löschen und Ausleihen melden sich unten rechts mit `.ui-toast-stack` / `.ui-toast` (Guide „Feedback“: gestapelt, automatisch schließend nach 5 s, manuell schließbar, Fortschrittsbalken `.ui-toast-life`). Vorher stand die Meldung als `.ui-alert` im Block — sie schob die Liste nach unten und wurde beim Blättern übersehen. Fehler bleiben bewusst im Block stehen: sie verlangen eine Entscheidung und müssen auch später noch sichtbar sein. Der Toast-Stapel liegt in einem **Portal an `<body>`** — innerhalb von `.app-content-block` (mit `backdrop-filter`) würde `position: fixed` auf den Block wirken und der Toast landete außerhalb des Bildes.

**Kopfzeile der Liste (`components/tools/ToolQuickFilters.tsx`)** – sitzt in der Zeile mit der Überschrift „Werkzeuge“ und trägt die groben Filter, mit Trennstrichen zwischen den Gruppen (ab `lg`, weil die Zeile darunter umbricht):

| Gruppe | Feldtyp | Verhalten |
|---|---|---|
| Kategorie | **Kontrollkästchen** | mehrere Kategorien gleichzeitig („Stempel und Abstreifer“) |
| Werk | **Radio** (`name="werk-filter"`) | genau ein Werk, „Alle“ schließt es wieder ein |
| Favoriten | Kontrollkästchen | nur Favoriten |

Die Eingaben sind nativ und nur unsichtbar (`opacity-0` als Fläche über dem Segment): Semantik, Pfeiltasten und Fokus kommen vom Browser, `:has(input:checked)` färbt das Segment wie den aktiven Tab. Bewusst **nicht** `sr-only` — damit schrumpft die Eingabe auf 1×1 px, das Label liegt darüber und fängt jeden Klick ab.

Suche, Status (Mehrfachmenü), Werkzeugtyp, Bestand und Lagerplatz bleiben in der Filterleiste darunter; die Chip-Zeile zeigt nur noch diese Filter (Kategorie, Werk und Favoriten zeigen ihren Zustand als gedrücktes Segment in der Kopfzeile).

**Filterleiste `components/tools/ToolFilterBar.tsx`** – Suchfeld (350 ms Debounce, Löschknopf, Ladeanzeige), Status als Mehrfachmenü (`.ui-menu` mit Kontrollkästchen, Klick außerhalb und `Escape` schließen es), Auswahl für Werkzeugtyp, Bestand (Werkzeuge/Lager-Ersatz) und Lagerplatz (mit festem Platz / Ablage). Darunter eine Chip-Zeile „Aktive Filter“ mit jedem gesetzten Filter als entfernbarem `.ui-badge-neutral` und „Alle Filter zurücksetzen“ (setzt auch Kategorie, Werk und Favoriten aus der Kopfzeile zurück).

Beim ersten Laden erscheinen Skelettzeilen (`ui-skeleton`) in Zeilenform, damit die Tabelle ihre Höhe behält.

**Formular `components/tools/ToolForm.tsx`** – linke Sub-Tab-Leiste, rechts der Inhalt:

| Key | Label | Ist-Stand |
|---|---|---|
| `tool` | Werkzeug | vollständiges Formular |
| `series` | Serienartikel | **funktionsfähig** (TASK-016): eingebettetes `SerialArticleForm` mit Artikelnummer, Name, Werk, Kunde, Maschine, Beschreibung und PDF-Upload. Werk, Kunde und Maschine sind aus der Werkzeugmaske vorbelegt und dort änderbar; der eigene Speichern-Knopf legt **nur** den Serienartikel an (DEC-056 Punkte 5/6). |
| `help` | Info / Hilfe | **Platzhaltertext** |
| `storage` | Lager / Ersatz | **Platzhaltertext** |

Pflichtprüfungen in `handleSubmit()`: `tool_id` nur dann nicht leer, wenn die Kategorie `Stempel` ist (DEC-055 – bei Abstreifer und Matrize ist die ID freiwillig, ein leeres Feld wird als `null` gesendet); `plant_id` gewählt; `tool_type_id` gewählt; `!isStorage && idState === 'error'` blockiert; ohne „In Ablage legen“ müssen Schrank, Schublade und Platz gesetzt sein; `measure_a` muss normalisierbar sein, `measure_b` optional, aber gültig. Am ID-Feld hängt `required` ebenfalls nur bei `Stempel`; darunter erklärt der Hinweis „Abstreifer und Matrize brauchen keine ID – Pflichtfeld ist hier Maß A." den fehlenden Pflichtmarker. `normalizeMeasure()` entfernt alles außer Ziffern und `.,`, ersetzt `.` → `,`, verlangt maximal 4 Vorkomma- und 2 Nachkommastellen und füllt auf zwei Stellen auf (`7` → `7,00`, `7.3` → `7,30`); Ungültiges ergibt `null`. Lagerplatz: Werk → Schrank → Schublade → Platz, es werden **nur freie** Plätze angeboten; beim Bearbeiten bleibt der eigene belegte Platz in der Liste (`p.tool_id === null || p.id === initial?.position_id`). Die Checkbox „In Ablage legen (kein fester Platz)“ setzt `position_id = null` und blendet die Dropdowns aus. Ohne Schränke erscheint „In diesem Werk sind keine Schränke angelegt (Admin → Lagerplätze).“

> **Anzeige ohne ID (DEC-055):** `lib/toolLabel.ts#toolLabel()` liefert die ID oder „ohne ID" – benutzt in Tabelle (neutrale Markierung statt Mono-Kasten), Zeilenmenü, Ausleih- und Löschdialog, Toasts sowie Admin-Dashboard und Lagerplätze. Ohne diesen Helfer stünde nach dem Anlegen eines ID-losen Werkzeugs ein leerer Wert im Toast und in der Löschbestätigung.

> **Korrigiert (war eine Abweichung):** Der Submit-Knopf trägt jetzt den passenden Text — „Werkzeug anlegen“ beim Anlegen, „Änderungen speichern“ beim Bearbeiten („Wird gespeichert …“ während des Speicherns). Früher stand dort fest „Anlegen“.

> **Abweichung Code ↔ Code:** Der Debounce-`useEffect` der Live-Prüfung listet `[toolId, category, plantId, isStorage]`, verwendet im Rumpf aber `initial?.id`. Beim Wechsel zwischen Werkzeugen mit gleicher ID, Kategorie, Werk und `is_storage` wird die Prüfung daher nicht erneut ausgelöst.

> **Wichtig (Mehrfachanlage):** Bei `isStorage = true` sendet das Formular `copies = max(1, storageCount)` sequenzielle `onSave()`-Aufrufe. `pages/Tools.tsx#handleSave()` schließt nach dem **ersten** Aufruf das Formular und erhöht `refreshKey`; da `onSave` erst nach dem `await` zurückkehrt, laufen die weiteren Aufrufe weiter, die Liste lädt aber nur einmal neu.

## 8. Berechtigungen

| Aktion | Abhängigkeit | Durchsetzung |
|---|---|---|
| Liste, Detail, ID-Prüfung, Werkzeugtypen lesen | `require_active` | Server (`routers/tools.py`) |
| Werkzeug anlegen / bearbeiten | `require_active` | Server |
| Werkzeug löschen | `require_admin` | Server |
| Werkzeugtyp anlegen/ändern/löschen | `require_admin` | Server |
| „Admin-Panel“-Button in der Sidebar | `user.is_admin` | **nur** Frontend |

`require_active` (`dependencies/permissions.py`) baut auf `get_current_user` auf und wirft HTTP 403 („Benutzerkonto ist deaktiviert“), wenn `is_active` falsch ist. `require_admin` baut auf `require_active` auf und wirft HTTP 403 („Administrator-Rechte erforderlich“), wenn `is_admin` falsch ist.

> **Wichtig:** Das Ausblenden eines Buttons ist keine Sicherheitsmaßnahme. In `ToolList.tsx` wird der Löschen-Button **allen** aktiven Benutzern angezeigt; erst der Server lehnt ihn für Nicht-Admins mit HTTP 403 ab, und `pages/Tools.tsx#handleDelete()` meldet das nur allgemein („Löschen fehlgeschlagen. Bitte erneut versuchen.“) – ohne Hinweis auf fehlende Rechte.

> **Offen:** Ein feingranulares Recht (z. B. `tools:write`, `tools:delete`) existiert nicht. Die Routen nutzen ausschließlich die Admin-Flagge `User.is_admin`.

## 9. Abweichungen und toter Code

| Punkt | Befund | Beleg |
|---|---|---|
| `frontend/src/components/ToolFormModal.tsx` | **Nicht importiert – toter Code.** Kein Treffer für `import … ToolFormModal` / `from '…ToolFormModal'` in `frontend/src/**`; der Symbolname erscheint nur in der Datei selbst (Interface, Komponente, `export default`). Aktiv genutzt wird `components/tools/ToolForm.tsx` (`pages/Tools.tsx:3`). Bereits bestätigt in `docs/15-ui-styleguide.md` und `HANDOFF-toolsync.md:107`; Entscheidung über Löschen offen. | Grep über `frontend/src` |
| Werkzeugtypen | Kein getrenntes `code`-Feld, nur `name` | `models/master_data.py:34-38`, `schemas/master_data.py:85` |
| Eindeutigkeit | Nur Backend-Prüfung, kein DB-Constraint | `models/tool.py` ohne `UniqueConstraint` |
| Admin-Dashboard-Kennzahlen | `AdminDashboard.tsx` zählt „Gesamt/Frei/Ausgeliehen/Wartung" weiterhin über die **geladene Seite** (max. 200 Werkzeuge) statt über einen Statistik-Endpunkt. Bei sehr großem Bestand sind die Kennzahlen zu klein; `total` aus der Listen-Antwort wäre verfügbar, die Statuszahlen aber nicht. | `pages/admin/AdminDashboard.tsx` |
| Werkzeugtyp löschen | Docstring behauptet „SET NULL“, real `RESTRICT` | `routers/tools.py:83` gegen `models/tool.py:25-27` |
| Sub-Tabs | `help` und `storage` ohne Funktion; `series` ist seit TASK-016 funktionsfähig (`SerialArticleForm`, unabhängig vom Werkzeug) | `ToolForm.tsx` |
| Indizes | Nur `ix_tools_tool_id` (Migration `e4c7a15b8d20`). `plant_id`, `tool_type_id`, `status` und `is_favorite` sind unindexiert — bei den jetzigen Datenmengen unkritisch, bei wachsendem Bestand nachzuziehen. | Migration `e4c7a15b8d20` |
| Löschen meldet fehlende Rechte nicht | `ToolList` zeigt den Löschen-Knopf **allen** aktiven Benutzern; erst der Server lehnt mit 403 ab. Die Meldung nennt keinen Rechtegrund. | `components/tools/ToolTable.tsx`, `lib/api.ts` (`fallbackFor(403)`) |

## 10. Offene Fragen

- Soll die Eindeutigkeit von `tool_id` durch einen Datenbank-Constraint abgesichert werden (z. B. `UNIQUE(tool_id, category, plant_id, is_storage)` mit Sonderbehandlung für `is_storage`)?
- Soll `allow_duplicate_id` unabhängig von `is_storage` bedienbar werden, oder entfällt das Feld zugunsten einer Regel, die ausschließlich aus `is_storage` abgeleitet wird?
- Ist `description` als fachliches Feld „Bezeichnung“ bestätigt, und bleibt der Fallback auf `tool_type.name` in der Listenansicht korrekt?
- Soll das Löschen eines Werkzeugtyps bei zugeordneten Werkzeugen eine verständliche Antwort (HTTP 409) statt eines DB-Fehlers liefern?
- Bleibt `ToolCategory` mit `Stempel`, `Abstreifer`, `Matrize` bestehen, obwohl Anforderungen 5 und Vision 7 Matrize und Abstreifer nur aus den **Werkzeugtypen** heraushalten?
- Wird `ToolFormModal.tsx` gelöscht, oder bleibt die Datei als Reserve liegen?
- **Beantwortet und umgesetzt (DEC-056, TASK-016):** Die Bausteine gelten auch für „Serienartikel" – die Liste hat Suche über die Stammdatenfelder, Sortierung, Blätterleiste und Gesamtzahl; dafür wurde `ToolPagination` um die Beschriftungen erweitert (`ariaLabel`, `itemSingular`, `itemPlural`) und in `SerialArticleList` wiederverwendet. Für „Lager/Ersatz" bleibt die Frage bestehen.
- Braucht die Werkzeugliste eine Auswahl mehrerer Zeilen mit Sammelaktionen (z. B. mehrere Werkzeuge auf einmal einem Lagerplatz zuordnen)?
- Sollen weitere Spalten sortierbar sein (z. B. `created_at`/`updated_at`) oder Spalten ein- und ausgeblendet werden können?
- Braucht das Admin-Dashboard einen eigenen Statistik-Endpunkt, damit „Gesamt/Frei/Ausgeliehen/Wartung“ nicht von der geladenen Seite abhängen (Abschnitt 9)?
