# ToolSync – Lager und Standorte

> **Verbindliche Quellen für dieses Dokument**
>
> - `docs/13-decisions.md` – **DEC-048** (Lagerplatz als generierte Matrix),
>   **DEC-050** (Werkzeug-Ablage), **DEC-049** (Stammdaten als Tabellen)
> - `docs/01-requirements.md` – Abschnitte 3 (Werke und Standorte), 7 (Lager/Ersatz)
> - `docs/00-project-vision.md` – Abschnitt 10 (Werke und Lagerorte)
> - `backend/app/models/storage.py` und `models/master_data.py` – Ist-Stand
> - `backend/app/services/location_service.py`, `backend/app/routers/locations.py`
> - `docs/09-admin-panel.md` (UI-Sicht), `docs/16-perlenkette-dnd-agent-doku.md`
>
> Abweichungen zwischen Doku und Code sind als `> **Abweichung:**` markiert,
> Unklares als `> **Offen:**`. Backend-Pfade unten ohne Präfix `/api`.

## 1. Werke (`Plant`, Tabelle `plants`)

| Feld | Typ | Nullable | Constraint |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `name` | `String(100)` | nein | `unique=True` |
| `created_at` / `updated_at` | `DateTime(timezone=True)` | nein | aus `AuditMixin` |

- Beziehungen: `machines`, `cabinets`, `tools` (jeweils 1:n).
- Endpunkte: `GET /locations/plants` (**ohne** Auth-Dependency, für Dropdowns),
  `POST` / `PUT /{id}` / `DELETE /{id}` (nur Admin).
- Doppelte Werknamen werden im Router mit HTTP 400 „Werk existiert bereits" abgewiesen
  (zusätzlich zum DB-`UNIQUE`).

> **Wichtig:** Ein Lagerort gehört eindeutig zu einem Werk – umgesetzt über
> `Cabinet.plant_id`. `Tool.plant_id` ist ebenfalls **nicht nullable**.

> **Offen:** `DELETE /locations/plants/{id}` fängt Integritätsfehler nicht ab.
> `cabinets.plant_id` ist `ondelete="CASCADE"`, `tools.plant_id` dagegen
> `ondelete="RESTRICT"` – das Löschen eines Werks mit Werkzeugen schlägt daher als
> DB-Fehler durch, statt eine verständliche Meldung zu liefern.

## 2. Lagerhierarchie

```
Plant (Werk)
 └── Cabinet       plant_id, name                     UNIQUE (plant_id, name)
      └── Drawer   cabinet_id, name, cols, rows       UNIQUE (cabinet_id, name)
           └── Position  drawer_id, name, x, y, tool_id   UNIQUE (drawer_id, name)
```

| Entität | Tabelle | FK | Cascade |
|---|---|---|---|
| `Cabinet` | `cabinets` | `plant_id` → `plants.id` | `ondelete="CASCADE"`, ORM `cascade="all, delete-orphan"` |
| `Drawer` | `drawers` | `cabinet_id` → `cabinets.id` | `ondelete="CASCADE"`, ORM `cascade="all, delete-orphan"` |
| `Position` | `positions` | `drawer_id` → `drawers.id` | `ondelete="CASCADE"` |

`Drawer`: `cols` (`Integer`, Default `5`, Breite X), `rows` (`Integer`, Default `2`,
Tiefe Y). `Position`: `name` (`String(50)`, Platznummer z. B. `"01"`), `x` (`Integer`,
Default `1`, Spalte), `y` (`Integer`, Default `1`, Reihe), `tool_id`
(FK → `tools.id`, nullable, `ondelete="SET NULL"`).

> **Wichtig – DEC-048:** `StorageLocation` wurde **entfernt**. Prüfung am echten
> Modell: `backend/app/models/` enthält **keine** Klasse `StorageLocation`, und
> `grep` über `backend/app` liefert dafür keinen Treffer. Der **Platz (`Position`) ist
> der Lagerort**. Die Tabelle `storage_locations` wurde in der Migration
> `c7d9e2f3a1b8` (`remove_storage_location_add_grid`) gedroppt; dieselbe Migration
> führte `drawers.cols` / `drawers.rows`, `positions.x` / `positions.y` und
> `tools.position_id` ein.

> **Abweichung:** `docs/14-architecture.md` beschreibt die Hierarchie weiterhin als
> `Plant → Cabinet → Drawer → Position → StorageLocation` (Zeilen 80, 98, 104, 164,
> 181) und nennt den Endpunkt `GET/POST /api/locations/storage-locations`
> (Zeile 214). `backend/app/routers/locations.py` kennt keine
> `storage-locations`-Route.

> **Abweichung:** `docs/01-requirements.md` Abschnitt 7.2 fordert, dass ein Lagerplatz
> nicht mehrfach belegt sein darf. Im Schema existiert dafür **kein** Constraint
> (kein `UNIQUE` auf `positions.tool_id`, keiner auf `tools.position_id`). Geprüft
> wird ausschließlich im Service (`ToolService.create_tool()` / `update_tool()`:
> „Platz … ist bereits belegt").

## 3. Generierte Matrix aus DEC-048

Ein Schrank wird **als Matrix** angelegt – einzelne Plätze werden **nie manuell**
erzeugt.

**Fluss im Admin-Panel** (`AdminStorageLocations.tsx`):

1. Werk (Plant) auswählen
2. Schrank-Nummer eingeben (`3` → `03`, zweistellig aufgefüllt via `pad2`)
3. Anzahl Schubladen festlegen → Namen werden automatisch mit **A, B, C …** vorbelegt
   (`String.fromCharCode(65 + i)`, maximal 26)
4. Pro Schublade `cols` (Anzahl X) und `rows` (Anzahl Y) angeben, Default **5 × 2**
5. Schrank anlegen → `POST /locations/cabinets/matrix` mit `CabinetMatrixCreate`
   (`name`, `plant_id`, `drawers: [{name, cols, rows}]`)

**Platzerzeugung im Backend** – identische Schleife in `create_cabinet_matrix` und
`create_drawer`:

```python
counter = 1
for x in range(1, data.cols + 1):
    for y in range(1, data.rows + 1):
        pos_name = str(counter).zfill(2)          # "01", "02", ...
        db.add(Position(name=pos_name, x=x, y=y, drawer_id=drawer.id))
        counter += 1
```

- Nummerierung **spaltenweise**: erst alle `y` für `x = 1`, dann `x = 2` usw.;
  Anzahl Plätze = `cols × rows`.
- `create_cabinet_matrix` legt Schrank **und** alle Schubladen samt Plätzen in einem
  Aufruf an (`db.flush()` je Ebene, ein `commit` am Ende). Die Antwort ist ein
  `CabinetRead` **ohne** verschachtelte Schubladen/Plätze – der Client lädt die
  Lagerstruktur danach neu.
- Doppelte Schranknamen im Werk bzw. Schubladennamen im Schrank werden mit HTTP 400
  abgewiesen; zusätzlich greifen `UNIQUE(plant_id, name)` und `UNIQUE(cabinet_id, name)`.

**Nachträglich eine Schublade** hinzufügen: `POST /locations/drawers` erzeugt sie
inklusive aller Plätze in einem Schritt. Die Antwort (`DrawerRead`) enthält
`positions`; der Client übernimmt sie direkt in den lokalen State – kein Neuladen
der Lagerstruktur nötig.

**Darstellung:** `LocationService._get_ordered_positions()` sortiert nach `(-y, x)` –
die **unterste Reihe erscheint zuerst** (bei 5 × 2 also `01`–`05` unten, `06`–`10`
oben). `GET /locations/positions?drawer_id=…` liefert diese Reihenfolge.

> **Offen:** `PUT /locations/drawers/{id}` schreibt `cols` / `rows` neu
> (`drawer.cols = data.cols`), erzeugt aber **keine** fehlenden Plätze und löscht
> **keine** überzähligen. Eine Matrixänderung führt damit zu einer Schublade, deren
> `cols` × `rows` nicht mehr zu ihren `Position`-Zeilen passt.

> **Offen:** `POST /locations/positions` legt weiterhin einen **einzelnen** Platz an –
> laut DEC-048 („kein manuelles Anlegen einzelner Lagerorte") ist das nicht vorgesehen.

> **Offen:** Werden in **einem** `cabinets/matrix`-Aufruf zwei Schubladen mit
> demselben Namen übergeben, fällt das erst im Schleifendurchlauf auf;
> `create_cabinet_matrix` wirft dann einen `HTTPException` **ohne** Rollback. Ob der
> Aufruf sauber verworfen wird, ist nicht abgesichert.

## 4. Code-System

| Ebene | Beispiel | Herkunft |
|---|---|---|
| Schrank | `03` | `Cabinet.name`, im UI zweistellig aufgefüllt (`pad2`) |
| Schublade | `C` | `Drawer.name`, Buchstabe oder frei editierbar (auch Zahlen) |
| Platz | `01` | `Position.name`, `zfill(2)` |
| **Kurzcode** | `03-C-01` | `LocationService._position_code()`: `f"{cabinet.name}-{drawer.name}-{position.name}"` |
| **Vollcode** | `Schrank 03 - Schublade C - Platz 01` | Anzeigeform (DEC-048) |

Der Kurzcode wird **nicht gespeichert**, sondern bei Bedarf berechnet. Fehlt ein Teil,
liefert `_position_code()` Platzhalter: `??-??-{position.name}` bzw.
`??-{drawer.name}-{position.name}`. Er wandert als `from_location` / `to_location` in
`ToolMovement` (Freitext, `String(50)`); die Ablage hat den festen Text `"Ablage"`.

**Auflösung Platz → Schrank:** `GET /locations/positions/{position_id}/context`
liefert `PositionContext` (`position_id`, `position_name`, `drawer_id`, `drawer_name`,
`cabinet_id`, `cabinet_name`, `plant_id`) – genutzt für die Vorbelegung im
Werkzeugformular. Zugriff: `require_active`.

> **Offen:** Der Kurzcode ist nicht eindeutig abgesichert – `Cabinet.name` ist frei
> (`String(50)`, nur `UNIQUE(plant_id, name)`). Zwei Schränke mit den Namen `3` und
> `03` ergäben denselben Kurzcode; eine Formatvalidierung gibt es nur im Frontend.

## 5. Perlenketten-Verschiebung

Verschiebe-Operationen laufen über `POST /locations/positions/move` mit
`PositionMoveRequest` (`source_position_id`, `target_position_id`,
`action: Literal["move", "swap", "insert_at"]`). Alle drei sind **Admin-only**
(`require_admin`).

| Aktion | Vorbedingung | Wirkung | `note` in der Historie |
|---|---|---|---|
| `move` | Quelle belegt, Ziel **frei** | Werkzeug wandert zum Ziel, Quelle frei | `move` |
| `swap` | **beide** Plätze belegt | nur die beiden Werkzeuge tauschen | `swap` (2 Einträge) |
| `insert_at` | Quelle belegt, **andere** Schublade als Ziel | ab Ziel rücken alle einen Platz weiter | `insert_at` + `insert_at shift` |

Details zu `insert_at`:

- Ziel frei ⇒ verhält sich wie `move` (kein Shift).
- Ziel belegt ⇒ Block, wenn der **letzte Platz der Ziel-Schublade belegt ist**
  (`Einreihen nicht möglich: Der letzte Platz (…) ist belegt.`).
- Einreihen **innerhalb derselben Schublade** ist nicht erlaubt – die Meldung verweist
  auf „Verschieben" oder „Tausch".
- Das Shift selbst läuft nur **innerhalb der Ziel-Schublade**; jedes weitergeschobene
  Werkzeug erhält einen eigenen Historieneintrag.

**Per Klick:** Quelle antippen, dann Ziel antippen. **Per Drag & Drop:** Karte direkt
auf das Ziel ziehen. Abbruch mit `Esc`. Es wird **natives HTML5 Drag & Drop** ohne
externe Bibliothek verwendet (DEC-048, DEC-021).

> **Wichtig:** `move` und `swap` pflegen **beide** Seiten der Beziehung
> (`Position.tool_id` und `Tool.position_id`); `insert_at` synchronisiert nach dem
> Shift alle Plätze der Ziel-Schublade in einer Schleife nach.

## 6. Werkzeug-Ablage (`Tool.position_id = NULL`)

Die Werkzeug-Ablage ist keine eigene Tabelle, sondern die Menge aller Werkzeuge
**ohne gültigen Lagerplatz** (DEC-050).

`LocationService.get_tray_tools(plant_id)`:

1. lädt alle Werkzeuge des Werks (`Tool.plant_id == plant_id`), sortiert nach `tool_id`
2. nimmt alle mit `position_id IS NULL` in die Ablage auf
3. **korrigiert** Werkzeuge, deren `position_id` auf eine nicht existierende `Position`
   zeigt (Altdaten/Lösch-Reste): `position_id` wird auf `NULL` gesetzt und das Werkzeug
   in die Ablage aufgenommen – inklusive `commit`

**Woher kommen Ablage-Werkzeuge?**

- Anlage im Werkzeugformular mit „In Ablage legen (kein fester Platz)"
  (`position_id = null`).
- Löschen eines Schranks oder einer Schublade (siehe Abschnitt 8).
- Weitere Exemplare eines Lager/Ersatz-Datensatzes: nur das **erste** Exemplar erhält
  den gewählten Platz, alle übrigen gehen in die Ablage (DEC-052).
- Manuelles Entfernen eines Werkzeugs von seinem Platz (Abschnitt 7).

> **Wichtig:** Die Ablage ist an das Werk gebunden (`Tool.plant_id`) – es gibt keine
> werkübergreifende Ablage.

## 7. Regeln für freie und belegte Plätze

| Quelle → Ziel | Aktion | Endpunkt | Verhalten |
|---|---|---|---|
| Ablage → freier Platz | Ablegen | `POST /locations/positions/place-tool` | `note = "place"`, `from_location = "Ablage"` |
| Ablage → belegter Platz | Einreihen | `POST /locations/positions/place-tool` | Shift innerhalb der Ziel-Schublade, `note = "insert_from_tray"` |
| Ablage → belegter Platz (letzter Platz belegt) | **blockiert** | – | HTTP-Fehler, damit kein Werkzeug verloren geht |
| Platz → freier Platz | Verschieben | `POST /locations/positions/move` (`move`) | Werkzeug wandert zum Ziel |
| Platz → belegter Platz | Tausch | `POST /locations/positions/move` (`swap`) | nur die beiden Werkzeuge tauschen |
| Platz → Ablage | Entfernen | `POST /locations/positions/release-tool` | Platz wird frei, Werkzeug bleibt erhalten (`note = "release"`, `to_location = "Ablage"`) |

Weitere Absicherungen im Code:

- `place_tool_at_position()` bricht ab, wenn das Werkzeug bereits eingelagert ist
  („Das Werkzeug ist bereits eingelagert.") – geprüft wird gegen eine **existierende**
  `Position`; eine tote Referenz wird vorher über die Ablage-Logik korrigiert.
- `move_position()` und `swap_positions()` brechen bei identischer Quelle und Ziel ab
  („Quelle und Ziel sind identisch.").
- `ToolService.delete_tool()` gibt den Platz frei, bevor das Werkzeug gelöscht wird.
- `DELETE /locations/positions/{id}` ist gesperrt, solange der Platz belegt ist
  (HTTP 400 „Platz ist belegt und kann nicht gelöscht werden.").

> **Wichtig:** Die Einzelbelegung eines Platzes wird **nur im Backend** geprüft –
> `positions` hat keinen Unique-Index auf `tool_id`, `tools` keinen auf `position_id`.

> **Wichtig:** Plätze entstehen ausschließlich über die Matrix
> (`cabinets/matrix`, `drawers`).

## 8. Löschen von Schrank und Schublade

`DELETE /locations/cabinets/{id}` und `DELETE /locations/drawers/{id}` (Admin) liefern
`ReleaseResult` mit `released_tools: int`. Ablauf in
`LocationService.delete_cabinet()` / `delete_drawer()`:

1. alle Plätze der Ebene laden (Schrank: `selectinload(Cabinet.drawers)`
   → `Drawer.positions`; Schublade: `selectinload(Drawer.positions)`)
2. `released_tools` zählen = Anzahl der Plätze mit `tool_id IS NOT NULL`
3. `_release_tools_from_positions()`: je belegtem Platz `Position.tool_id = None`
   **und** `Tool.position_id = None`
4. `db.delete(...)` + `commit` – die Werkzeuge bleiben erhalten
5. Antwort: `{"released_tools": N}`

> **Wichtig – DEC-050:** Beim Löschen eines Schranks oder einer Schublade werden
> eingelagerte Werkzeuge **nicht** gelöscht; sie landen in der Werkzeug-Ablage
> (`position_id = NULL`).

> **Wichtig:** Ein fehlender Schrank bzw. eine fehlende Schublade wird als HTTP 404
> „… nicht gefunden" beantwortet (`ValueError` → `HTTPException`).

> **Wichtig:** Beim Löschen eines **Werkzeugs** (nicht des Platzes) wird nur
> `Position.tool_id` geleert – siehe `ToolService.delete_tool()` / `_release_position()`.

> **Offen:** Ob in Altdatenbanken `positions`-Zeilen ohne `x` / `y` existieren, ist
> nicht dokumentiert; die Spalten sind im Modell `nullable=False` mit Default `1`.

## 9. Endpunkte im Überblick

| Methode | Pfad (Präfix `/api/locations`) | Recht |
|---|---|---|
| `GET` | `/plants`, `/cabinets?plant_id=`, `/drawers?cabinet_id=`, `/positions?drawer_id=` | – (offen) |
| `GET` | `/positions/{position_id}/context` | `require_active` |
| `GET` | `/tray?plant_id=` | `require_admin` |
| `POST` / `PUT` / `DELETE` | `/plants[/{id}]`, `/cabinets[/{id}]`, `/drawers[/{id}]` | `require_admin` |
| `POST` | `/cabinets/matrix`, `/positions`, `/positions/move`, `/positions/place-tool`, `/positions/release-tool` | `require_admin` |
| `DELETE` | `/positions/{id}` | `require_admin` (nur freie Plätze) |

> **Abweichung:** Die `GET`-Routen für `plants`, `cabinets`, `drawers` und `positions`
> haben **keine** Auth-Dependency (kein `require_active`) – im Gegensatz zu
> `docs/01-requirements.md` Abschnitt 15 („geschützte API-Endpunkte müssen
> Authentifizierung und Autorisierung serverseitig prüfen").

## 10. Historie der Lagerbewegungen

Jede Lageraktion schreibt einen `ToolMovement`-Eintrag mit `movement_type = relocate`,
`status = completed` und einer `note` als Aktionskennung:

| `note` | Aktion |
|---|---|
| `move` | Verschieben auf freien Platz |
| `swap` | Tausch zweier belegter Plätze |
| `insert_at` | Einreihen von einem anderen Platz |
| `insert_at shift` | Weitergerücktes Werkzeug beim Einreihen |
| `insert_from_tray` | Ablegen/Einreihen aus der Ablage |
| `insert_from_tray shift` | Weitergerücktes Werkzeug dabei |
| `place` | Ablegen aus der Ablage auf freien Platz |
| `release` | In die Ablage entfernen |

Der Verlauf im Admin-Panel filtert nach dem **ersten Wort** der `note`
(`docs/09-admin-panel.md`).

> **Offen:** Die `note`-Werte sind nirgends als Enum oder Konstante hinterlegt – es
> sind String-Literale in `location_service.py`. Der Model-Default von
> `ToolMovement.status` ist `open`; `LocationService._add_movement()` setzt ihn
> explizit auf `completed`. Das Admin-Panel ordnet die Farbe über das **erste Wort**
> der `note` zu (siehe `docs/09-admin-panel.md`).

## Offene Fragen

1. **Einzelbelegung** – kommt ein DB-Constraint bzw. partieller Unique-Index auf
   `positions.tool_id` / `tools.position_id`?
2. **Matrixänderung** – soll `PUT /locations/drawers/{id}` Plätze nachgenerieren oder
   entfernen (oder `cols`/`rows` nach Änderung sperren)?
3. **Doppelte Schubladennamen** in einem `cabinets/matrix`-Aufruf – Rollback oder
   Vorabprüfung aller Drawer vor dem ersten `flush()`?
4. **`POST /locations/positions`** – bleibt der Einzelplatz-Endpunkt trotz DEC-048
   bestehen?
5. **Werklöschung** – soll `DELETE /locations/plants/{id}` bei vorhandenen Werkzeugen
   (FK `RESTRICT`) eine verständliche Fehlermeldung liefern?
6. **Kurzcode-Eindeutigkeit** – wird `Cabinet.name` auf ein festes Format validiert?
7. **Auth auf `GET`** – erhalten `/plants`, `/cabinets`, `/drawers`, `/positions` eine
   `require_active`-Dependency?
8. **`note`-Werte** – werden die Aktionskennungen als Enum/Konstanten zentralisiert?
