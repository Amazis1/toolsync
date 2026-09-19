# ToolSync – Werkzeugverwaltung

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 4 „Werkzeugverwaltung“, 5 „Werkzeugtypen“, 13 „Suche“, 18 „Datenbank“), `docs/13-decisions.md` (DEC-050, DEC-051, DEC-052), `docs/00-project-vision.md` (Abschnitt 6, 7), `.continue/rules/02-domain-rules.md`.
>
> **Ist-Stand-Quellen:** `backend/app/models/tool.py`, `models/enums.py`, `models/master_data.py`, `schemas/tool.py`, `routers/tools.py`, `services/tool_service.py`, `crud/crud_tool.py`; `frontend/src/pages/Tools.tsx`, `components/tools/ToolList.tsx`, `components/tools/ToolForm.tsx`, `api/tools.ts`, `api/types.ts`.
>
> Beschrieben wird der **tatsächlich implementierte** Stand. Abweichungen zu Anforderungen und Entscheidungen sind ausdrücklich als solche markiert.

## 1. Überblick und Ist-Stand-Artefakte

Der Bereich „Werkzeuge“ (`TabKey = 'werkzeuge'`) besteht aus: Route `routers/tools.py` (Präfix `/api/tools`, gesetzt in `main.py`), Service `ToolService` (Business-Logik, ID-Prüfung, Lagerplatz-Synchronisierung), CRUD `CRUDTool`, Model `Tool` (Tabelle `tools`), Schemas `ToolBase` / `ToolCreate` / `ToolUpdate` / `ToolRead` und im Frontend `pages/Tools.tsx`, `components/tools/ToolList.tsx`, `components/tools/ToolForm.tsx`.

## 2. Werkzeugfelder

Tabelle `tools` (`class Tool(Base, AuditMixin)`); `id`, `created_at`, `updated_at` kommen aus `AuditMixin`:

| Feld | Typ | Nullable | Pflicht im Formular | Bedeutung |
|---|---|---|---|---|
| `tool_id` | `String(50)` | nein | ja | Fachliche Werkzeug-ID, z. B. `TS-1004` oder `1075000` |
| `category` | Enum `ToolCategory` (`native_enum=False`, Länge 20) | nein | ja (Radio) | Fachliche Kategorie, siehe Abschnitt 4 |
| `status` | Enum `ToolStatus` (`native_enum=False`, Länge 20) | ja | nein | „— ohne Status —“ ist wählbar |
| `is_storage` | `Boolean` | nein, Default `False` | ja (Checkbox „Lager/Ersatz“) | Schaltet den Mehrfach-ID-Modus frei |
| `allow_duplicate_id` | `Boolean` | nein, Default `False` | abgeleitet | Wird im Formular aus der Checkbox gesetzt: `allow_duplicate_id: isStorage` |
| `measure_a` | `String(20)` | ja | **ja** | Maß A in mm, normalisiert auf `123,45` |
| `measure_b` | `String(20)` | ja | nein | Maß B in mm, gleiche Normalisierung |
| `description` | `String(500)` | ja | nein | Freitext; Spalte „Bezeichnung“ in der Liste |
| `plant_id` | `FK plants.id` (`RESTRICT`) | nein | ja | Werk |
| `tool_type_id` | `FK tool_types.id` (`RESTRICT`) | nein | ja | Werkzeugtyp |
| `position_id` | `FK positions.id` (`SET NULL`) | ja | bedingt | Lagerplatz; `NULL` = Werkzeug-Ablage (DEC-050) |
| `machine_id` | `FK machines.id` (`SET NULL`) | ja | nein | Optionale Maschine |
| `customer_id` | `FK customers.id` (`SET NULL`) | ja | nein | Optionaler Kunde (DEC-051) |

> **Wichtig:** Ein Lagerplatz (`Position`) kann nur **ein** Werkzeug halten. Die Belegung wird doppelt geführt – über `Tool.position_id` **und** über `Position.tool_id`. `create_tool()` / `update_tool()` prüfen `position.tool_id is not None` und antworten mit `ValueError` → HTTP 400 („Platz … ist bereits belegt.“). Beim Ändern oder Löschen gibt `_release_position()` den alten Platz frei. `Tool.plant`, `Tool.tool_type` und `Tool.customer` sind `lazy="joined"`, damit `GET /api/tools/` sie direkt mitliefert; `machine` ist lazy.

> **Hinweis (erledigt):** In `backend/app/schemas/tool.py` war ein Kommentar verstümmelt
> (das Wort „Für" war zu einem Ersatzzeichen zerstört). Behoben — ebenso vier
> gleichartige Stellen in `backend/app/crud/base.py`.

## 3. Werkzeug-ID, Eindeutigkeit und Typ-Code

`tool_id` ist ein freier `String(50)`; Format und Vergaberegeln werden **nicht** serverseitig erzwungen (Formular-Platzhalter: `z.B. TS-1004`). Die fachlich vorgesehene Struktur aus Anforderungen 5.2 / Vision 7 – eine ID wie `•1075000`, deren Anfang auf den Werkzeugtyp verweist (`•1` → Rund) – ist im Code **nicht** abgebildet. Logischer Schlüssel (DEC-052): `tool_id + category + plant_id + is_storage`.

> **Wichtig:** Die Eindeutigkeit ist **nicht** per Datenbank-Constraint abgesichert. `models/tool.py` enthält **kein** `UniqueConstraint`; geprüft wird ausschließlich in `ToolService.create_tool()` / `update_tool()` über `CRUDTool.get_by_tool_id()`. Anforderungen 18 („Kritische Constraints wie Eindeutigkeit müssen auf Datenbank- und/oder Backend-Ebene abgesichert werden“) sind damit nur über die Backend-Ebene erfüllt – und nur, solange alle Schreibpfade über `ToolService` laufen.

Regel im Service: `existing` Treffer **und** `not allow_duplicate_id` → `ValueError` → HTTP 400 („Werkzeug-ID … existiert bereits!“). Beim Bearbeiten nimmt `exclude_id=tool_id` das eigene Werkzeug aus, damit es sich nicht selbst blockiert.

> **Wichtig (DEC-052):** Bei `is_storage = true` ist die ID **nicht** eindeutig. Jedes Exemplar ist ein eigener Datensatz (eigene Zeile), kein Mengenzähler. `allow_duplicate_id` wird aus `is_storage` abgeleitet.

### 3.1 Live-Prüfung: `GET /api/tools/check-id`

Parameter: `tool_id` (Pflicht), `category` (Pflicht), `plant_id` (Pflicht), `is_storage` (Default `False`), `exclude_id` (Default `None`). Antwort (Frontend-Typ `ToolIdCheck`): `{ available: bool, existing_count: int, message: str }`.

| Fall | `available` | Meldung |
|---|---|---|
| `is_storage = true`, 0 Treffer | `true` | „ID ist frei - wird als 1. Exemplar angelegt.“ |
| `is_storage = true`, N Treffer | `true` | „ID existiert bereits Nx - wird als N+1. Exemplar angelegt.“ |
| `is_storage = false`, Treffer | `false` | „Werkzeug-ID … ist in diesem Werk bereits vergeben.“ |
| `is_storage = false`, kein Treffer | `true` | „Werkzeug-ID ist frei.“ |

Das Formular ruft die Route mit **400 ms Debounce** auf und blockiert nur normale Werkzeuge: `if (!isStorage && idState === 'error')`.

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
| `GET` | `/` | `require_active` | 200, `List[ToolRead]` | Filter + Pagination, siehe Abschnitt 6 |
| `GET` | `/check-id` | `require_active` | 200 | Live-ID-Prüfung (Abschnitt 3.1) |
| `GET` | `/{id}` | `require_active` | 200 / 404 | Einzelwerkzeug (`detail: "Tool not found"`) |
| `POST` | `/` | `require_active` | 201 / 400 | Anlegen; `ValueError` → HTTP 400 mit `detail` |
| `PUT` | `/{id}` | `require_active` | 200 / 400 / 404 | Ändern |
| `DELETE` | `/{id}` | **`require_admin`** | 204 | Löschen inkl. Platzfreigabe |

`create_tool()`: (1) Duplikatprüfung mit `is_storage`, (2) falls `position_id` gesetzt – Platz existiert? sonst `ValueError` „Angegebener Platz existiert nicht.“, (3) Platz frei? sonst `ValueError` „Platz … ist bereits belegt.“, (4) `crud.create(data)`, (5) `_set_position_tool()` setzt `Position.tool_id` und committet. `update_tool()` ergänzt die `exclude_id`-Duplikatprüfung, die Freigabe des alten Platzes bei Positionswechsel und ein explizites Nachziehen von `position_id = None`, weil `CRUDBase.update()` None-Werte überspringt. `delete_tool()` gibt zuerst den Platz frei und löscht danach; `Tool.movements` ist `cascade="all, delete-orphan"` – die Bewegungen des Werkzeugs verschwinden mit.

> **Wichtig:** Reads, `POST` und `PUT` verlangen **kein** feingranulares Recht, sondern nur einen aktiven Benutzer (`require_active`). Nur `DELETE` ist auf `require_admin` beschränkt.

## 6. Suche, Filter und Pagination

Backend `GET /api/tools/`: `tool_id` (Default `None`, `ILIKE '%wert%'`, case-insensitiv), `category` (`None`, exakter Vergleich), `plant_id` (`None`, Werk), `is_storage` (`None`, trennt normale Werkzeuge von Lager/Ersatz), `skip` (Default `0`, Offset) und `limit` (Default `100`, **kein** `le`-Limit im Router). `api/tools.ts` ruft fest `/tools/?limit=500` auf. Es gibt **kein** `order_by` (Reihenfolge nicht garantiert) und **keine** Suche über `description` oder `tool_type.name`.

`ToolList.load()` ruft `getTools()` ohne Parameter auf und filtert **vollständig clientseitig**: Das Suchfeld „Werkzeug-ID, Bezeichnung, Typ oder Werk…“ prüft `tool_id`, `description`, `tool_type.name` und `plant.name` (`toLowerCase().includes`); Kategorie- und Status-Dropdown vergleichen exakt. Die Leerzustände sind getrennt formuliert („Noch keine Werkzeuge vorhanden …“ gegen „Keine Werkzeuge für die aktuellen Filter gefunden.“).

> **Offen / Abweichung:** Es gibt **keine** echte Pagination in der Oberfläche. Der Backend-Parameter `skip` wird nie verwendet, `limit=500` ist eine feste Obergrenze – bei mehr als 500 Werkzeugen fehlen Datensätze stillschweigend. Das widerspricht Anforderungen 13.

> **Abweichung Code ↔ Anforderung:** Die Backend-Filter (`category`, `plant_id`, `is_storage`) werden vom Frontend **nicht** übergeben. Die serverseitige Suchfunktion ist vorhanden, aber ungenutzt.

## 7. Werkzeugliste und Anlege-Formular

**Seite `pages/Tools.tsx`:** Zustand `showForm`, `editingTool`, `refreshKey`. Der Tabbar-Button „+ Anlegen“ erhöht `createSignal`; ein `useEffect` ruft daraufhin `openCreateForm()`. Bei `showForm === true` wird der Listenblock **ersetzt** durch `.tool-form-card` (Inline-Formular, **kein** Modal) mit der Überschrift „Anlegen“ bzw. „Bearbeiten“. `handleSave()` ruft `updateTool(editingTool.id, data)` oder `createTool(data)`, erhöht `refreshKey` und schließt das Formular. `handleDelete()` fragt `window.confirm('Werkzeug wirklich löschen?')`.

**Liste `components/tools/ToolList.tsx`** – Spalten: Werkzeug-ID (Mono-Badge), Bezeichnung (`description || tool_type?.name || '—'`), Maße (`measure_a` / `measure_b` über `formatMeasureMm`), Standort (`plant?.name`), Status (Badge mit farbigem Punkt), Aktionen. Pro Zeile: „Ausleihen“ (nur bei `status === 'available'`, `ui-btn-primary`), „Bearbeiten“ (immer, `ui-btn-secondary`), „Löschen“ (immer, `ui-btn-danger-soft`). „Ausleihen“ öffnet das `LendModal`; nach Erfolg erscheint ein `ui-alert-success` („„TS-1004“ wurde ausgeliehen.“) für 4 Sekunden und die Liste lädt neu.

**Formular `components/tools/ToolForm.tsx`** – linke Sub-Tab-Leiste, rechts der Inhalt:

| Key | Label | Ist-Stand |
|---|---|---|
| `tool` | Werkzeug | vollständiges Formular |
| `series` | Serienartikel | **Platzhaltertext** („Hier können PDF-Einrichtepläne zugeordnet werden.“) |
| `help` | Info / Hilfe | **Platzhaltertext** |
| `storage` | Lager / Ersatz | **Platzhaltertext** |

Pflichtprüfungen in `handleSubmit()`: `tool_id` nicht leer; `plant_id` gewählt; `tool_type_id` gewählt; `!isStorage && idState === 'error'` blockiert; ohne „In Ablage legen“ müssen Schrank, Schublade und Platz gesetzt sein; `measure_a` muss normalisierbar sein, `measure_b` optional, aber gültig. `normalizeMeasure()` entfernt alles außer Ziffern und `.,`, ersetzt `.` → `,`, verlangt maximal 4 Vorkomma- und 2 Nachkommastellen und füllt auf zwei Stellen auf (`7` → `7,00`, `7.3` → `7,30`); Ungültiges ergibt `null`. Lagerplatz: Werk → Schrank → Schublade → Platz, es werden **nur freie** Plätze angeboten; beim Bearbeiten bleibt der eigene belegte Platz in der Liste (`p.tool_id === null || p.id === initial?.position_id`). Die Checkbox „In Ablage legen (kein fester Platz)“ setzt `position_id = null` und blendet die Dropdowns aus. Ohne Schränke erscheint „In diesem Werk sind keine Schränke angelegt (Admin → Lagerplätze).“

> **Abweichung Code ↔ UI:** Der Submit-Button trägt fest die Beschriftung „Anlegen“ – auch im Bearbeitungsmodus. Nur die Überschrift im Kartenkopf wechselt korrekt.

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
| Pagination | Vom Frontend nicht genutzt, hartes `limit=500` | `api/tools.ts:39` |
| Suchfilter | Backend-Filter ungenutzt, Client-Filterung stattdessen | `ToolList.tsx:50-66` |
| Werkzeugtyp löschen | Docstring behauptet „SET NULL“, real `RESTRICT` | `routers/tools.py:83` gegen `models/tool.py:25-27` |
| Sub-Tabs | `series`, `help`, `storage` ohne Funktion | `ToolForm.tsx:675-694` |

## 10. Offene Fragen

- Soll die Eindeutigkeit von `tool_id` durch einen Datenbank-Constraint abgesichert werden (z. B. `UNIQUE(tool_id, category, plant_id, is_storage)` mit Sonderbehandlung für `is_storage`)?
- Soll `allow_duplicate_id` unabhängig von `is_storage` bedienbar werden, oder entfällt das Feld zugunsten einer Regel, die ausschließlich aus `is_storage` abgeleitet wird?
- Sollen die Backend-Filter (`tool_id`, `category`, `plant_id`, `is_storage`) vom Frontend genutzt und die Client-Filterung entfernt werden?
- Wird eine echte Pagination (Seitengröße, `skip`/`limit`, Gesamtzahl) benötigt, oder bleibt `limit=500` die Obergrenze?
- Ist `description` als fachliches Feld „Bezeichnung“ bestätigt, und bleibt der Fallback auf `tool_type.name` in der Listenansicht korrekt?
- Soll das Löschen eines Werkzeugtyps bei zugeordneten Werkzeugen eine verständliche Antwort (HTTP 409) statt eines DB-Fehlers liefern?
- Bleibt `ToolCategory` mit `Stempel`, `Abstreifer`, `Matrize` bestehen, obwohl Anforderungen 5 und Vision 7 Matrize und Abstreifer nur aus den **Werkzeugtypen** heraushalten?
- Wird `ToolFormModal.tsx` gelöscht, oder bleibt die Datei als Reserve liegen?
