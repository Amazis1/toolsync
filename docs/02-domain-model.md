# ToolSync – Domänenmodell

> **Verbindliche Quellen für dieses Dokument**
>
> - `docs/01-requirements.md` – höchste fachliche Instanz (Rangfolge: Abschnitt 20)
> - `docs/13-decisions.md` – verbindliche Projektentscheidungen (DEC-048 … DEC-052)
> - `docs/00-project-vision.md` – Kontext
> - `backend/app/models/` – **tatsächlicher Ist-Stand** (SQLAlchemy 2.0)
> - `.continue/rules/02-domain-rules.md`, `.continue/rules/04-database.md`
>
> Abweichungen zwischen Doku und Code sind als `> **Abweichung:**` markiert,
> Unklares als `> **Offen:**`. Bei Widersprüchen gilt die Rangfolge aus
> `docs/01-requirements.md` Abschnitt 20.

## 1. Entitäten im Überblick

| Entität | Tabelle | Datei | Rolle |
|---|---|---|---|
| `Plant` / `Customer` / `Machine` | `plants` / `customers` / `machines` | `models/master_data.py` | Stammdaten (Werk, Kunde, Maschine) |
| `ToolType` | `tool_types` | `models/master_data.py` | Werkzeugtyp |
| `ToolCategory` | – (Enum) | `models/enums.py` | Werkzeugkategorie auf `Tool` |
| `Tool` | `tools` | `models/tool.py` | Werkzeug bzw. Lager-/Ersatzobjekt |
| `Cabinet` / `Drawer` / `Position` | `cabinets` / `drawers` / `positions` | `models/storage.py` | Lagerstruktur; `Position` = Lagerort |
| `ToolMovement` | `tool_movements` | `models/movement.py` | Bewegung / Historie |
| `User` / `Role` / `Permission` | `users` / `roles` / `permissions` | `models/user.py` | Benutzer, Rollen, Rechte |
| `SerialArticle` | `serial_articles` | `models/serial_article.py` | Serienartikel (PDF-Einrichteplan) |
| `StorageItem` | `storage_items` | `models/storage_item.py` | Lager-/Ersatzobjekt (paralleler Ansatz) |

Alle Tabellen erben von `Base` (`models/base.py`) und – außer `ToolMovement` – von
`AuditMixin` (`created_at` / `updated_at`, `DateTime(timezone=True)`,
`server_default=func.now()`). Primärschlüssel sind projektweit `Integer`-Serials
(`id`), keine UUIDs.

> **Abweichung:** `.continue/rules/04-database.md` fordert „UUID oder Serial –
> projektweit einheitlich"; der Code ist einheitlich auf `Integer`-Serials.

## 2. Werkzeug (`Tool`, Tabelle `tools`)

| Feld | Typ | Nullable | Constraint / Hinweis |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel (intern) |
| `tool_id` | `String(50)` | nein | fachliche Werkzeug-ID, z. B. `1075000` |
| `category` | `ToolCategory` | nein | `native_enum=False`, `length=20` |
| `status` | `ToolStatus` | **ja** | Default `NULL` – nicht `available` |
| `is_storage` / `allow_duplicate_id` | `Boolean` | nein | Default je `False`; `is_storage=True` = Lager/Ersatz |
| `measure_a` / `measure_b` | `String(20)` | ja | Maß A / Maß B |
| `description` | `String(500)` | ja | Beschreibung |
| `plant_id` | FK → `plants.id` | nein | `ondelete="RESTRICT"` |
| `tool_type_id` | FK → `tool_types.id` | nein | `ondelete="RESTRICT"` |
| `position_id` | FK → `positions.id` | ja | `ondelete="SET NULL"`; `NULL` = Werkzeug-Ablage |
| `machine_id` | FK → `machines.id` | ja | `ondelete="SET NULL"` |
| `customer_id` | FK → `customers.id` | ja | `ondelete="SET NULL"` |

Beziehungen: `plant`, `tool_type` und `customer` sind `lazy="joined"` (Listenansicht),
`machine` lazy, `movements` mit `cascade="all, delete-orphan"`.

> **Wichtig:** Es gibt **keinen** `UNIQUE`-Constraint auf `tools.tool_id`. Die
> Eindeutigkeit wird ausschließlich im Backend geprüft (Abschnitt 5).

> **Abweichung:** `docs/14-architecture.md` nennt für `Tool` u. a.
> `storage_location_id` und `storage_count`. Beide Spalten existieren **nicht** –
> DEC-048 ersetzte `storage_location_id` durch `position_id`, DEC-052 verwarf den
> Mengenzähler zugunsten von Einzelzeilen.

## 3. Werkzeugkategorie (`ToolCategory`)

Enum **auf `Tool`** (`models/enums.py`), keine eigene Tabelle und **kein** FK auf
`ToolType`: `"Stempel"`, `"Abstreifer"`, `"Matrize"`.

> **Wichtig:** Matrize und Abstreifer sind laut `docs/01-requirements.md` Abschnitt 5
> und `docs/00-project-vision.md` Abschnitt 7 **keine Werkzeugtypen**. Der Code hält
> das ein: sie sind `ToolCategory`-Werte, keine `ToolType`-Zeilen.

> **Abweichung:** `docs/archive/14-gap-analysis.md` nennt `ToolType` zusätzlich mit
> `category` (Stempel/Abstreifer/Matrize). Heute liegt `category` nur auf `Tool`.

## 4. Werkzeugtyp (`ToolType`) und Typ-Code

| Feld | Typ | Nullable | Constraint |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `name` | `String(100)` | nein | `unique=True` |

`name` enthält den **mehrstelligen Typ-Code zusammen mit der Bezeichnung** als eine
Zeichenkette, z. B. `010 Rund` – so dokumentiert als Kommentar an
`ToolTypeBase.name` in `schemas/master_data.py`. Beziehung: `tools` (1:n).

> **Wichtig:** Es gibt **keine getrennte Spalte** `code` und **keine** Spalte
> `bezeichnung`. Die Anforderung „Kombination aus Code und Bezeichnung"
> (`docs/01-requirements.md` Abschnitt 5.1) ist über das kombinierte `name`-Feld
> umgesetzt (so auch DEC-034 in `docs/14-architecture.md` Zeile 91).

> **Offen:** Die Anforderung nennt die Darstellung `•1 Rund`. Im Code gibt es kein
> Präfix-Zeichen und keine Formatvalidierung – nur `String(100)` ohne Musterprüfung.

## 5. Werkzeug-ID und Eindeutigkeitsregeln

Fachlicher Schlüssel: `tool_id + category + plant_id + is_storage`.

| Fall | Regel | Durchsetzung |
|---|---|---|
| `is_storage = false` | `tool_id` eindeutig innerhalb Werk + Kategorie | `ToolService.create_tool()` / `update_tool()` |
| `is_storage = true` | Mehrfach-IDs erlaubt, jedes Exemplar = eigene Zeile | dito, mit `allow_duplicate_id = true` |
| `allow_duplicate_id = true` | Duplikatprüfung wird übersprungen | `if existing and not data.allow_duplicate_id` |

- `ToolService.check_tool_id()` liefert `available`, `existing_count`, `message`.
  Bei `is_storage=True` ist `available` **immer** `True`; Meldung: „ID existiert
  bereits N× – wird als N+1. Exemplar angelegt."
- `CRUDTool.get_by_tool_id()` / `count_by_tool_id()` filtern alle vier Schlüsselteile;
  `exclude_id` blendet beim Bearbeiten das eigene Werkzeug aus.
- Frontend (`ToolForm.tsx`): `allow_duplicate_id = isStorage`; mehrere Exemplare
  entstehen durch eine Schleife (`copies = isStorage ? max(1, storageCount) : 1`).
  Nur das **erste** Exemplar erhält `position_id`, alle weiteren `null` (DEC-052).
- Ein angegebener `position_id` wird gegen `Position.tool_id` geprüft – belegter
  Platz ⇒ Abbruch mit „Platz … ist bereits belegt".

> **Wichtig:** Die ID-Eindeutigkeit ist **nicht** auf DB-Ebene abgesichert (kein
> partieller Unique-Index). `docs/01-requirements.md` Abschnitt 18 fordert die
> Absicherung „auf Datenbank- und/oder Backend-Ebene" – erfüllt ist nur das Backend.

> **Abweichung:** DEC-052 nennt vier Schlüsselteile; `docs/14-architecture.md`
> Zeile 206 verkürzt auf „Werk + Kategorie" und lässt `is_storage` weg.

> **Offen:** Die ID-Struktur selbst (`•1075000`, Anfangsstelle als Typverweis) ist
> nicht implementiert: `tool_id` ist ein freies `String(50)`-Feld ohne Ableitung
> aus `ToolType` und ohne Validierung.

## 6. Werke, Kunden, Maschinen

| Entität | Felder | Constraints | Beziehungen |
|---|---|---|---|
| `Plant` | `id`, `name` (`String(100)`) | `name` `unique=True` | `machines`, `cabinets`, `tools` |
| `Customer` | `id`, `name` (`String(100)`), `color` (`String(7)`) | `name` `unique=True`; `color` nullable, `#RRGGBB`, `None` = keine Farbe | – (werkunabhängig) |
| `Machine` | `id`, `name` (`String(100)`), `plant_id` | `plant_id` FK → `plants.id`, nullable, `SET NULL`; `name` **nicht** unique | `plant`, `tools` |

`customers.color` wurde mit Migration `d1a4f6b2c9e3` (`add_color_to_customers`,
`down_revision = 'c7d9e2f3a1b8'`) ergänzt.

> **Offen:** `Machine.name` ist nicht eindeutig – gleichnamige Maschinen sind möglich.
> Ob das fachlich gewollt ist, ist nicht dokumentiert.

## 7. Lagerstruktur (Kurzfassung)

Detail siehe `docs/04-warehouse.md`. Im Domänenmodell gilt:

```
Plant ──1:n── Cabinet      UNIQUE (plant_id, name)
              └── Drawer   UNIQUE (cabinet_id, name), cols (Default 5), rows (Default 2)
                  └── Position  UNIQUE (drawer_id, name), x, y, tool_id
```

`Cabinet.plant_id` ist FK mit `ondelete="CASCADE"`; `drawers` und `positions` sind
`cascade="all, delete-orphan"`. `Position.tool_id` ist FK → `tools.id`
`ondelete="SET NULL"`.

> **Wichtig – DEC-048:** `StorageLocation` wurde **entfernt**; `grep` über
> `backend/app` liefert dafür **keinen Treffer**. Der Platz (`Position`) ist der
> Lagerort. `Tool.position_id` ersetzt `tool_id` auf `StorageLocation`; die Tabelle
> `storage_locations` wurde in der Migration `c7d9e2f3a1b8` gedroppt.

> **Abweichung:** `docs/14-architecture.md` (Zeilen 80, 98, 104, 164, 181, 214)
> führt die Hierarchie weiterhin als
> `Plant → Cabinet → Drawer → Position → StorageLocation` und nennt den Endpunkt
> `GET/POST /api/locations/storage-locations`. Beides entspricht nicht mehr dem Code.

> **Offen:** Werkzeug ↔ Platz ist **beidseitig** modelliert (`Tool.position_id` und
> `Position.tool_id`). Eine DB-seitige Garantie für Einzelbelegung oder Konsistenz
> beider Seiten existiert nicht – das leisten `ToolService` und `LocationService`
> manuell.

## 8. Werkzeugbewegung (`ToolMovement`, Tabelle `tool_movements`)

| Feld | Typ | Nullable | Hinweis |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `movement_type` | `MovementType` | nein | `native_enum=False`, `length=20` |
| `from_location` / `to_location` | `String(50)` | ja | **Freitext**, z. B. `03-C-02` oder `Ablage` |
| `status` | `MovementStatus` | nein | Default `OPEN` |
| `note` | `String(500)` | ja | Aktionskennung, z. B. `move`, `swap` |
| `timestamp` | `DateTime(timezone=True)` | nein | `server_default=func.now()` |
| `tool_id` | FK → `tools.id` | nein | `ondelete="CASCADE"` |
| `user_id` | FK → `users.id` | ja | `ondelete="SET NULL"` |

`ToolMovement` hat **kein** `AuditMixin`; Zeitachse ist `timestamp`. Abgeleitete
Lesefelder (Properties, nicht in der Tabelle): `tool_code` (= `tool.tool_id`),
`tool_description`, `user_display_name`.

| Enum | Werte |
|---|---|
| `MovementType` | `lend`, `return`, `transfer`, `relocate`, `status_change` |
| `MovementStatus` | `open`, `completed`, `cancelled` |

> **Wichtig:** `MovementService.create_movement()` setzt `status` **immer** auf
> `COMPLETED` und ignoriert den Wert aus dem Request-Body. `lend` ist nur bei
> `Tool.status == AVAILABLE` erlaubt (danach `LENT`), `return` nur bei `LENT`
> (danach `AVAILABLE`); `transfer`/`relocate` lassen den Status unverändert.

> **Wichtig:** `status_change` liest den neuen Status **aus `note`**; nur bei exakter
> Übereinstimmung mit einem `ToolStatus`-Wert wird er übernommen, sonst bleibt der
> Status stumm unverändert (TODO im Code).

> **Wichtig:** Lageraktionen erzeugen `MovementType.RELOCATE` mit den `note`-Werten
> `move`, `swap`, `insert_at`, `insert_at shift`, `insert_from_tray`,
> `insert_from_tray shift`, `place`, `release` (`LocationService`).

> **Abweichung:** `docs/01-requirements.md` Abschnitte 9–11 fordern Ausgangs- und
> Zielort als Beziehung; im Modell sind es Freitextfelder ohne FK auf `Position`.
> Ortsangaben sind Momentaufnahmen und überleben das Löschen eines Schranks.

> **Abweichung:** `MovementService` übernimmt `user_id` aus dem Request-Body statt
> aus dem Token (TODO im Code).

## 9. Benutzer, Rollen, Berechtigungen

| Entität | Felder | Constraints |
|---|---|---|
| `User` | `id`, `personal_number`, `first_name`, `last_name`, `display_name`, `hashed_password`, `is_active`, `is_admin`, `role_id` | `personal_number` `String(50)` `unique=True` + `index=True`; `display_name` (`String(200)`) und `hashed_password` (`String(255)`) **nullable**; `is_active` Default `True`, `is_admin` Default `False`; `role_id` FK → `roles.id` nullable, `SET NULL` |
| `Role` | `id`, `name` | `name` `unique=True`; `users` (1:n), `permissions` (n:m) |
| `Permission` | `id`, `name`, `codename` | `name` und `codename` je `unique=True` |
| `role_permissions` | `role_id`, `permission_id` | zusammengesetzter Primärschlüssel, beide FKs `ondelete="CASCADE"`, keine eigenen Felder |

Beziehungen: `Role.permissions` ↔ `Permission.roles` (`secondary=role_permissions`),
`User.role` (n:1, genau **eine** Rolle pro Benutzer), `User.movements`.

> **Wichtig:** Login normaler Benutzer ausschließlich über `personal_number` ohne
> Passwort (`docs/01-requirements.md` Abschnitt 2). `hashed_password` ist nullable
> und nur für den geschützten Admin-Login vorgesehen.

> **Wichtig:** Die wirksame Autorisierung nutzt `User.is_admin` und `User.is_active`
> (`dependencies/permissions.py`: `require_active`, `require_admin`) – **nicht**
> `Role` / `Permission`.

> **Abweichung:** `docs/01-requirements.md` Abschnitt 15 fordert ein serverseitig
> durchgesetztes Berechtigungssystem; der Ist-Stand ist ein binäres
> `is_admin`-Flag. Das `codename`-basierte System ist noch nicht verdrahtet.

> **Offen:** `display_name` ist nullable und wird **nicht** automatisch aus
> `first_name` + `last_name` gebildet – die Ableitung liegt beim Aufrufer.

## 10. Serienartikel (`SerialArticle`, Tabelle `serial_articles`)

| Feld | Typ | Nullable | Constraint |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `article_number` | `String(100)` | nein | `unique=True` |
| `description` | `String(500)` | ja | – |
| `pdf_path` | `String(500)` | ja | Pfad zur PDF |
| `extra_metadata` | `JSON` | ja | freies JSON |

Erbt von `AuditMixin`.

> **Wichtig:** Ein Serienartikel ist ein **PDF-basierter Einrichteplan**. Die im PDF
> enthaltenen Angaben (Programmname, Bearbeitungszeit, benötigte Werkzeug-IDs,
> Anzahl der Hübe, Material, Maschine) sind **keine** strukturierten Spalten und
> werden nicht automatisch extrahiert (`docs/01-requirements.md` Abschnitt 6.3).

> **Wichtig:** Das Feld heißt `extra_metadata`, **nicht** `metadata` – `metadata` ist
> in SQLAlchemy reserviert (Kommentar im Modell).

> **Offen:** Es gibt **keine** FK-Verknüpfung zu `Machine`, `Tool` oder `Plant`;
> `extra_metadata` ist freies JSON ohne dokumentiertes Schema.

## 11. Lager-/Ersatzobjekt (`StorageItem`) – konkurrierender Ansatz

| Feld | Typ | Nullable | Hinweis |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `storage_id` | `String(50)` | nein | `index=True`, **nicht** unique |
| `name` | `String(200)` | nein | – |
| `type` | `String(100)` | ja | freies Feld, z. B. `Stempel`, `Abstreifer`, `Matrize` |
| `article_number` | `String(100)` | ja | – |
| `machine_id` / `location_id` | `Integer` | ja | **ohne** FK-Constraint |
| `description` | `Text` | ja | – |
| `allow_duplicate_id` | `Boolean` | nein | Default `False` |

> **Wichtig – offener Widerspruch im Datenmodell:** Für Lager/Ersatz existieren
> **zwei** Ansätze parallel: (1) `Tool` mit `is_storage = True` – verbindlich nach
> DEC-052 inkl. Ausleihlogik pro Exemplar; (2) `StorageItem` mit eigener Tabelle und
> eigenem `/api/storage`-Backend. Der Docstring in `models/storage_item.py` benennt
> den Konflikt selbst und verweist auf `docs/07-stock-replacement.md`.

> **Offen:** `machine_id` und `location_id` sind bewusst FK-los, verwaiste Verweise
> also möglich. Eine Alembic-Revision für `storage_items` wurde in den gesichteten
> Migrationen **nicht** gefunden.

## 12. Beziehungen

```
Plant ─1:n─ Cabinet ─1:n─ Drawer ─1:n─ Position ─0/1─ Tool ─1:n─ ToolMovement ─n:1─ User ─n:1─ Role
  ├─1:n─ Machine ─0:n─ Tool                              (ToolType ─1:n─ Tool)         n:m Permission
  └─1:n─ Tool                          Customer ─0:n─ Tool
SerialArticle (isoliert, article_number unique)   StorageItem (isoliert, FK-lose Referenzen)
```

> **Wichtig:** `Position` ↔ `Tool` ist beidseitig abgebildet (`Position.tool_id` und
> `Tool.position_id`), beide `SET NULL`;
> `LocationService._release_tools_from_positions()` pflegt beide Seiten manuell.

## 13. Wertebereiche und Migrationsstand

| Enum | Werte |
|---|---|
| `ToolCategory` | `Stempel`, `Abstreifer`, `Matrize` |
| `ToolStatus` | `available`, `lent`, `in_transit`, `defective`, `maintenance` |
| `MoveAction` (`schemas/storage.py`) | `move`, `swap`, `insert_at` |

> **Wichtig:** Alle Enums sind mit `native_enum=False` als `VARCHAR` abgelegt (keine
> PostgreSQL-Enums). `ToolCategory` ist deutsch, alle übrigen Werte englisch.

> **Offen:** `Tool.status` ist nullable. Ein Werkzeug ohne Status kann weder
> ausgeliehen noch zurückgegeben werden (`MovementService` vergleicht mit
> `ToolStatus.AVAILABLE` bzw. `LENT`) – ein Default beim Anlegen ist nicht festgelegt.

> **Offen:** Der von `docs/01-requirements.md` Abschnitt 12 genannte Status „nicht
> verfügbar" existiert **nicht** im Enum; abgedeckt wird er derzeit nur durch
> `defective` / `maintenance` / `in_transit`.

| Revision | Inhalt |
|---|---|
| `f5b7b5192461` | Initialmigration – **inklusive** `storage_locations` und `tools.storage_location_id` |
| `c7d9e2f3a1b8` | `remove_storage_location_add_grid`: Tabelle entfernt, `drawers.cols` / `drawers.rows`, `positions.x` / `positions.y`, `tools.position_id` (FK `SET NULL`) |
| `d1a4f6b2c9e3` | `add_color_to_customers`: `customers.color String(7)` |

## Offene Fragen

1. **`StorageItem` vs. `Tool.is_storage`** – welcher Ansatz ist verbindlich? Beide existieren parallel; DEC-052 beschreibt nur den `Tool`-Weg (`docs/07-stock-replacement.md`).
2. **Werkzeug-ID-Struktur** – wird `tool_id` aus `ToolType` abgeleitet oder bleibt es ein freies Feld ohne Validierung?
3. **Typ-Code-Format** – wird `ToolType.name` (z. B. `010 Rund`) validiert (Muster, Präfix `•`, führende Nullen)?
4. **Status-Default** – mit welchem `Tool.status` wird ein Werkzeug angelegt? Aktuell `NULL`, was Ausleihe und Rückgabe blockiert.
5. **„Nicht verfügbar"** – braucht es einen eigenen `ToolStatus`-Wert?
6. **Berechtigungssystem** – ab wann wird `Permission.codename` statt `User.is_admin` geprüft?
7. **DB-Absicherung der ID-Eindeutigkeit** – kommt ein partieller Unique-Index auf `(tool_id, category, plant_id)` für `is_storage = false`?
8. **`Machine.name`** – soll ein werkweiter Unique-Constraint gelten?
9. **`status_change`** – wann erhält `ToolMovement` ein echtes Feld `new_status` statt der Auswertung von `note`?
10. **`from_location` / `to_location`** – bleiben sie Freitext oder werden sie auf `Position` verlinkt?
11. **`storage_items`-Migration** – fehlt die Alembic-Revision?
12. **Rollenmodell** – reicht eine Rolle pro Benutzer (`User.role_id`) dauerhaft?
