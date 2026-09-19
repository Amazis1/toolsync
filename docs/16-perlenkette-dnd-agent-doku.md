# Schubladen-Verschiebung (move / swap / insert_at) – Technische Doku

> Hinweis: Der Dateiname erinnert noch an die frühere Perlenketten-Logik.
> Die Perlenketten-Logik wurde vollständig durch die fachlich korrekte
> Schubladen-Logik ersetzt.

## 1. Zweck

Dieses Dokument beschreibt die neue Verschiebe-Logik für echte Schubladen
mit festen Plätzen. Anders als die alte Perlenketten-Logik rückt bei einem
Verschieben nicht der gesamte Bereich zwischen Quelle und Ziel auf.

Plätze sind unveränderbar fix. Nur die Zuordnung Werkzeug ↔ Platz wird geändert:

- `Position.tool_id` → welches Werkzeug liegt auf diesem Platz
- `Tool.position_id` → auf welchem Platz liegt dieses Werkzeug

Beide Seiten werden **immer atomar in einer Transaktion** aktualisiert.

## 2. Operationen

| Aktion | Auslöser | Verhalten |
|---|---|---|
| `move` | belegter Platz → freier Platz | Werkzeug wandert vom Quell- auf den Zielplatz, Quelle wird frei. |
| `swap` | belegter Platz → belegter Platz | Nur die zwei Werkzeuge tauschen die Plätze, nichts anderes verändert sich. |
| `insert_at` | Werkzeug wird von außerhalb auf einen belegten Platz gelegt | Alle Werkzeuge ab dem Ziel rücken innerhalb der Ziel-Schublade einen Platz weiter. Ist der letzte Platz belegt → Block. |

### Einschränkungen insert_at

- Die Quelle muss aus einer **anderen** Schublade kommen als das Ziel.
- Innerhalb derselben Schublade bitte `move` oder `swap` verwenden.
- Der Shift erfolgt ausschließlich in der Ziel-Schublade.
- Wenn der letzte Platz der Ziel-Schublade belegt ist, wird die Aktion mit
  einer verständlichen Warnung blockiert – es darf kein Werkzeug „verloren“ gehen.

## 3. Backend

### Endpunkt

```
POST /api/locations/positions/move
```

Komplett geschützt: `require_admin`.

Request:

```json
{
  "source_position_id": 42,
  "target_position_id": 99,
  "action": "move"
}
```

Zulässige `action`-Werte: `move`, `swap`, `insert_at`.

Response: sortierte Liste aller Plätze der betroffenen Schubladen
(Schublade der Quelle und Schublade des Ziels).

### Service

Datei: `backend/app/services/location_service.py`

- `move_position(source_id, target_id, user_id=None)`
- `swap_positions(source_id, target_id, user_id=None)`
- `insert_at_position(source_id, target_id, user_id=None)`

Alle drei Methoden:

1. validieren Quelle und Ziel,
2. ändern `Position.tool_id` und `Tool.position_id`,
3. schreiben Historie-Einträge,
4. committen **einmal** am Ende.

## 4. Historie

Jede erfolgreiche Bewegung erzeugt einen `ToolMovement`-Eintrag mit
`MovementType.RELOCATE`, `MovementStatus.COMPLETED` und:

- `from_location` / `to_location` als Platz-Code, z. B. `03-C-02`,
- `tool_id` des betroffenen Werkzeugs,
- `user_id` des ausführenden Admins (vom Router übergeben).

Werden mehrere Werkzeuge bewegt, entsteht je Werkzeug ein eigener Eintrag:

- `move`: 1 Eintrag
- `swap`: 2 Einträge
- `insert_at`: 1 Eintrag für das neue Werkzeug und je weitergeschobenem
  Werkzeug ein eigener Eintrag

## 5. Entfernte Alt-Endpunkte

Diese unsicheren Endpunkte wurden ersetzt/entfernt:

- `POST /api/locations/positions/reorder` → ersetzt durch `/positions/move`
- `PATCH /api/locations/positions/{id}/tool` → entfernt
- `PUT /api/locations/positions/{id}` → entfernt

Belegungsänderungen sind nur noch über `/positions/move` möglich.

## 6. Frontend

Dateien:

- `frontend/src/pages/admin/AdminStorageLocations.tsx`
- `frontend/src/api/locations.ts`

Das Frontend entscheidet automatisch:

- Ziel belegt → `swap`
- Ziel frei → `move`

`insert_at` ist im Backend vollständig umgesetzt und getestet, wird im
Frontend aber aktuell noch nicht aufgerufen, weil es in der echten
Anwendung kein Tray/bzw. keinen „von außen“-Workflow gibt.

Ausgeliehene Werkzeuge (`status = lent`) werden in der Schubladen-Ansicht
optisch als `Ausgeliehen` markiert, blockieren das Verschieben aber nicht.

## 7. Tests

Datei: `backend/tests/test_location_service.py`

Ausführen im `backend`-Verzeichnis:

```powershell
python -m pytest tests/test_location_service.py -q
```

Abgedeckte Fälle:

- einfacher Move
- blockierter Move auf belegtes Ziel
- Swap (nur zwei Werkzeuge)
- insert_at-Shift innerhalb der Ziel-Schublade
- Block bei vollem letzten Platz
- Move zwischen Schubladen
- Swap zwischen Schubladen
- ausgeliehenes Werkzeug verschieben
