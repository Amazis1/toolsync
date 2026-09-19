# ToolSync – Werkzeugbewegungen

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 9, 10, 11, 12),
> `docs/13-decisions.md` (DEC-048 Lagerplatz-Matrix, DEC-050 Werkzeug-Ablage,
> DEC-052 Einzelzeilen), `docs/16-perlenkette-dnd-agent-doku.md` (Verschiebe-Logik),
> `docs/09-admin-panel.md` (Verlauf und Farbcodierung).
> Dieses Dokument beschreibt den **Ist-Stand der Implementierung** und benennt
> Abweichungen zwischen Entscheidung, Dokumentation und Code ausdrücklich.

## 1. Modell `ToolMovement`

`backend/app/models/movement.py`, Tabelle `tool_movements`:

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | PK | interner Schlüssel |
| `movement_type` | Enum `MovementType` (`native_enum=False`, `length=20`) | Art der Bewegung |
| `from_location` | `String(50)`, nullable | Ausgangsort (Platz-Code oder `Ablage`) |
| `to_location` | `String(50)`, nullable | Zielort |
| `status` | Enum `MovementStatus`, NOT NULL, Default `OPEN` | Zustand der Bewegung |
| `note` | `String(500)`, nullable | **Aktionscode** (siehe Abschnitt 5) |
| `timestamp` | `DateTime(timezone=True)`, `server_default=func.now()` | Zeitstempel, serverseitig |
| `tool_id` | FK → `tools.id`, `ondelete=CASCADE`, NOT NULL | betroffenes Werkzeug |
| `user_id` | FK → `users.id`, `ondelete=SET NULL`, nullable | ausführender Benutzer |

Komfort-Properties für die Anzeige (nur lesend): `tool_code` (`tool.tool_id`),
`tool_description`, `user_display_name` (Vorname + Nachname).

> **Wichtig:** `user_id` ist **nullable** – bei gelöschtem Benutzer bleibt die Bewegung
> erhalten (`SET NULL`), der Verlauf zeigt dann keinen Namen. `tool_id` ist dagegen
> `ondelete="CASCADE"`: Wird ein Werkzeug gelöscht, sind **auch seine Bewegungen weg** –
> der Audit-Trail ist damit nicht dauerhaft.## 2. Bewegungsarten und Status

`backend/app/models/enums.py`:

| `MovementType` | Fachliche Bedeutung | Wirkung auf `Tool.status` |
|---|---|---|
| `lend` | Ausleihe | `available` → `lent` (nur wenn vorher `available`) |
| `return` | Rückgabe | `lent` → `available` (nur wenn vorher `lent`) |
| `transfer` | Standortwechsel / Weitergabe | keine Änderung |
| `relocate` | Umplatzierung / Lagerplatzwechsel | keine Änderung |
| `status_change` | reine Statusänderung | Zielstatus aus `note` |

`MovementStatus`: `open` (Datenbank-Default), `completed`, `cancelled`.

> **Abweichung:** Alle Schreibpfade setzen `MovementStatus.COMPLETED` hart
> (`MovementService.create_movement()`, `LocationService._add_movement()`). `OPEN` und
> `CANCELLED` existieren im Modell, werden aber von keiner Anwendungsschicht erzeugt;
> eine Storno-Funktion gibt es nicht.

## 3. Endpunkte des Movement-Routers

`backend/app/routers/movements.py`, Präfix `/api/movements`, alle Routen über `Depends(require_active)` – jeder aktive Benutzer, **kein** `require_admin`:

| Methode | Pfad | Parameter / Body | Antwort |
|---|---|---|---|
| GET | `/api/movements/` | Query: `tool_id`, `user_id`, `plant_id`, `skip=0`, `limit=100` | `List[ToolMovementRead]` |
| POST | `/api/movements/` | `ToolMovementCreate` | `ToolMovementRead`, HTTP 201 |

`ToolMovementCreate` (`backend/app/schemas/movement.py`): `movement_type`, `from_location?`,
`to_location?`, `status` (Default `open`), `note?`, `tool_id`, `user_id?`. Der Service
überschreibt `status` immer mit `completed`; `id` und `timestamp` setzt ausschließlich das
Backend. `GET /api/movements/` sortiert **neueste zuerst** (`ORDER BY timestamp DESC, id DESC`),
lädt `tool` und `user` per `selectinload` und filtert `plant_id` über einen Join auf
`Tool.plant_id`. `POST` liefert bei Regelverstoß HTTP 400 mit der `ValueError`-Meldung
(z. B. „Werkzeug … ist nicht verfügbar (aktueller Status: lent).").

> **Abweichung:** `docs/14-architecture.md` (Abschnitt 1.3) nennt die Endpunkte
> `POST /api/movements/borrow`, `/return`, `/transfer`, `/relocate`, `/status`.
> Diese existieren **nicht**; es gibt ausschließlich `GET /` und `POST /` mit
> `movement_type` im Body.

## 4. Bewegungen aus der Lagerlogik

Die Lager-/Ablage-Aktionen erzeugen ihre Einträge **nicht** über den Movement-Router, sondern direkt über `LocationService._add_movement()` – immer mit `movement_type = RELOCATE`, `status = COMPLETED` und einem Aktionscode in `note`:

| Aktion | Service-Methode | `note` | Auslösender Endpunkt |
|---|---|---|---|
| Verschieben (frei → frei) | `move_position()` | `move` | `POST /api/locations/positions/move`, `action="move"` |
| Tausch (belegt → belegt) | `swap_positions()` | `swap` (2 Einträge) | `POST /api/locations/positions/move`, `action="swap"` |
| Einreihen (andere Schublade) | `insert_at_position()` | `insert_at` + `insert_at shift` je verschobenem Werkzeug | `POST /api/locations/positions/move`, `action="insert_at"` |
| Ablegen (Ablage → freier Platz) | `place_tool_at_position()` | `place` | `POST /api/locations/positions/place-tool` |
| Einreihen aus der Ablage | `place_tool_at_position()` | `insert_from_tray` (+ `insert_from_tray shift`) | `POST /api/locations/positions/place-tool` |
| In Ablage / Entfernen | `release_tool_from_position()` | `release` | `POST /api/locations/positions/release-tool` |

- `from_location` / `to_location` sind Platz-Codes im Format `03-C-02` (`_position_code()`); für die Ablage wird wörtlich `Ablage` verwendet.
- `user_id` ist die Admin-ID des angemeldeten Benutzers (vom Router übergeben).
- `move`, `swap` und `insert_at` ändern `Position.tool_id` und `Tool.position_id` **in einer Transaktion** (`db.commit()` einmal am Ende); Antwort ist die sortierte Liste der Plätze der betroffenen Schubladen. `MovementService` erzeugt dagegen **keine** Platzänderung – es ändert nur den Werkzeugstatus.

## 5. Verlauf und Farbcodierung im Admin-Panel

Der Verlauf ist der Block **„Verlauf"** im Admin-Panel → „Lagerplätze" (`frontend/src/pages/admin/AdminStorageLocations.tsx`, linke Spalte), gerendert von `frontend/src/components/movements/MovementLog.tsx`: `<MovementLog plantId={viewPlantId} refreshKey={movementRefreshKey} />`. Nach jeder Verschiebung wird `movementRefreshKey` erhöht → Neuladen.

- Pro Eintrag: farbiges Badge, farbiger linker Rand, `tool_code` (mono) + gekürzte
  `tool_description` (max. 35 Zeichen), `from_location` → `to_location` (mono),
  `user_display_name` und `timestamp` als `de-DE`-Datum; fehlende Orte werden `—`.
- Kopfzeile: Zähler (`n` bzw. `n+` Einträge), darunter die **Farb-Legende**.
- Infinite Scroll per `IntersectionObserver` (Seitengröße 50, `skip` wächst, Ende bei
  `data.length < pageSize`, danach „— Ende des Verlaufs —"); Sortierung liefert das Backend
  (neueste zuerst), gefiltert auf das aktive Werk (`plant_id`).

### Farbcodierung der Aktionen (`GROUP_STYLES` in `MovementLog.tsx`)

| Aktion (Badge) | Farbe | Auslöser |
|---|---|---|
| **Tausch** | Grün (Emerald) | `movement_type=relocate`, Note `swap` |
| **Verschieben** | Blau (Sky) | Note `move`; ebenso `movement_type=transfer` (Label „Transfer") |
| **Einreihen** | Bernstein (Amber) | Note `insert_at`; `insert_at shift` → Label „Einreihen (Shift)" |
| **Einlegen** | Bernstein (Amber) | Note `insert_from_tray` |
| **Ablegen** | Bernstein (Amber) | Note `place` |
| **In Ablage** | Grau (Slate) | Note `release` |
| **Ausleihe** | Violett | `movement_type=lend` |
| **Rückgabe** | Türkis (Teal) | `movement_type=return` |
| **Statusänderung** | Rot (Rose) | `movement_type=status_change` |
| **Umplatzierung** | Grau | keine Zuordnung möglich |

Jede Zeile trägt zusätzlich einen farbigen linken Rand (`border-l-4`) in derselben Farbe; die
Legende über der Liste zeigt sieben Punkte: Tausch, Verschieben, Einreihen, In Ablage,
Ausleihe, Rückgabe.

> **Wichtig – tolerante Zuordnung:** Die Aktion wird über das **erste Wort der `note`**
> bestimmt (`note.trim().toLowerCase().split(/\s+/)[0]`), dadurch greift `insert_at` auch bei
> `insert_at shift`. Zusätzlich existieren Freitext-Fallbacks für Altbestände: Note enthält
> `swap` → Tausch, `verschieb` → Verschieben, `release` oder `ablage` → In Ablage.

## 6. Perlenketten-Verschiebung (Per Klick und Drag & Drop)

Fachlich (DEC-048, DEC-050): Ein belegtes Fach wird ausgewählt und auf ein Zielfach gesetzt.

1. **Per Klick:** Belegtes Fach anklicken → Auswahl (amberner Ring, „Quelle gewählt:
   03-C-01. Klicke jetzt auf das Ziel!") → Zielfach anklicken. Ein zweiter Klick auf dieselbe
   Quelle hebt die Auswahl auf, `Esc` bricht ab; Ablage-Chips sind ebenso auswählbar
   (`handleTrayClick`).
2. **Per Drag & Drop:** Belegte Karte auf ein Zielfach ziehen, Ablage-Chip auf ein Fach ziehen
   oder ein Fach auf die Drop-Zone `TrayDropZone` (`id="tray-drop"`, „Werkzeug hierher ziehen,
   um es in die Ablage zu legen (Platz wird frei)").

**Automatische Aktionswahl im Frontend** (`moveSlotToSlot()`): Ziel frei → `move`, Ziel belegt
→ `swap`; `insert_at` wird im Frontend nicht aufgerufen.

**Einschränkungen des Einreihens** (`insert_at_position()`):

- Die Quelle muss aus einer **anderen** Schublade kommen; innerhalb derselben Schublade muss
  `move` oder `swap` verwendet werden. Der Shift erfolgt nur in der Ziel-Schublade.
- Ist der letzte Platz der Ziel-Schublade belegt, wird blockiert: „Einreihen nicht möglich:
  Der letzte Platz (<name>) ist belegt. Es würde ein Werkzeug verloren gehen."
- Plätze sind unveränderbar; es ändert sich nur die Zuordnung Werkzeug ↔ Platz.> **Abweichung (Code-Befund):** In `insert_at_position()` wird nur der eingereihte Platz
> (`inserted_tool.position_id = target.id`) gesetzt; die anschließende Schleife synchronisiert
> alle Plätze der Ziel-Schublade. Für das Werkzeug, das ursprünglich auf dem Zielplatz lag,
> ergibt sich dabei kein neuer `position_id`-Wert – sein `Tool.position_id` zeigt nach dem
> Shift weiterhin auf den alten Platz. `Position.tool_id` und `Tool.position_id` können nach
> einem `insert_at` also auseinanderlaufen.

> **Abweichung (Doku vs. Code):** `docs/13-decisions.md` (DEC-048) fordert **natives HTML5
> Drag & Drop ohne zusätzliche Dependency**. Tatsächlich importiert
> `AdminStorageLocations.tsx` `DndContext`, `useDraggable` und `useDroppable` aus
> **`@dnd-kit/core`** und nutzt `@dnd-kit/utilities`; beide Pakete stehen in
> `frontend/package.json`. Die Aussage aus Doc 16 bleibt richtig, dass das Einreihen im
> Frontend nicht über `insert_at`, sondern über `POST /api/locations/positions/place-tool`
> (`insert_from_tray`) läuft – die dortige Begründung („kein Tray-Workflow") ist jedoch
> überholt, denn die Werkzeug-Ablage existiert (DEC-050) und wird per Klick und Drag & Drop
> bedient.

## 7. Ausleihe und Rückgabe

| Vorgang | Endpunkt | Vorbedingung | Ergebnis |
|---|---|---|---|
| Ausleihe | `POST /api/movements/` mit `movement_type = "lend"` | `Tool.status == available` | `Tool.status = lent`, Bewegung `completed` |
| Rückgabe | `POST /api/movements/` mit `movement_type = "return"` | `Tool.status == lent` | `Tool.status = available`, Bewegung `completed` |

- `status_change`: Der neue Status wird **aus `note`** gelesen (`ToolStatus(note.strip())`).
  Passt der Text auf keinen Enum-Wert, bleibt der Status unverändert – ohne Fehlermeldung;
  ein Feld `new_status` fehlt (TODO im Code). `transfer` und `relocate` verändern den
  Werkzeugstatus nicht.

> **Wichtig – Abweichung Ausleihe:** `LendModal.tsx` setzt `user_id: null` („TODO: user_id
> aus JWT-Token holen") und schreibt die erfasste **Personalnummer als Klartext in `note`**
> (`Personalnummer: <PN>` bzw. `Personalnummer: <PN> | <Notiz>`). Der Service übernimmt
> `user_id` ungeprüft aus dem Body; eine Prüfung gegen `users` findet nicht statt. Damit ist
> die Anforderung „Eine Ausleihe muss nachvollziehbar sein – welcher Benutzer" (Anforderung 9)
> **nicht erfüllt**: Der Ausleiher ist nicht über `user_id` auswertbar, sondern nur als
> Freitext im Verlauf.

> **Wichtig – Abweichung Rückgabe:** Die Rückgabe-Logik ist im Backend vollständig vorhanden
> (`MovementService`), im Frontend existiert jedoch **kein** Aufruf von
> `movement_type = "return"` – `LendModal` ist die einzige Movement-Komponente mit
> Schreibzugriff (`createMovement`). Ein Werkzeug bleibt nach der Ausleihe daher auf Status
> `lent`, solange die Rückgabe nicht direkt über die API ausgelöst wird.

## Offene Fragen

1. **Benutzerzuordnung:** Wann wird `user_id` aus dem Token ermittelt (statt aus dem Body); bleibt die Personalnummer im Klartext in `note`?
2. **Rückgabe-UI:** Wo wird die Rückgabe ausgelöst (Werkzeugliste, Admin-Panel oder eigener Bereich „Rückgabe", Anforderung 19)?
3. **`status_change`:** Wird ein Feld `new_status` eingeführt? Gilt eine ungültige `note` weiterhin stillschweigend als „keine Änderung"?
4. **Storno:** Bleibt `MovementStatus.CANCELLED` ungenutzt, oder ist eine Storno-Funktion vorgesehen?
5. **Audit-Trail:** Wechselt `tool_movements.tool_id` von `ON DELETE CASCADE` auf `SET NULL`, damit die Historie das Löschen eines Werkzeugs übersteht?
6. **Standortwechsel zwischen Werken:** `movement_type = "transfer"` ist ohne Wirkung – soll ein Werkswechsel erzwungen und dokumentiert werden?
7. **`insert_at` aus der Ablage:** Soll `place-tool` auf `insert_at` vereinheitlicht werden (ein Einreihungs-Pfad, ein Aktionscode)?
8. **Drag-&-Drop-Technik:** Bleibt `@dnd-kit` oder wird DEC-048 („natives HTML5 Drag & Drop, keine zusätzliche Dependency") durchgesetzt?
9. **Verlauf-Umfang:** Der Haupt-Tab „Historie" (`App.tsx`) ist ein `Placeholder` – soll der Verlauf auch für normale Benutzer zugänglich werden (Anforderung 10)?
