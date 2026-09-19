# 05-domain-model

> **Task-Status: COMPLETED.**
> Diese Datei ist eine historische Planungsnotiz. Das umgesetzte Domänenmodell steht in
> `docs/02-domain-model.md`, die Modelle in `backend/app/models/`.

## Ziel
Das verbindliche Domain Model fur ToolSync 2.0 definieren.

## Voraussetzung
- TASK-004 = COMPLETED
- Completion Gate = PASS

## Abzuleitende Entitaten
Basierend auf Analyse des Altsystems und aktuellen Anforderungen:

### Stammdaten
- Plant (Werk)
- Customer (Kunde)
- Machine (Maschine)
- ToolType (Werkzeugtyp)

### Lagerstruktur
- Cabinet (Schrank)
- Drawer (Schublade)
- Position (Platz)
- StorageLocation (Lagerort)

### Werkzeuge
- Tool (mit category, plant, tool_id, is_storage, storage_count, size_a, size_b)

### Bewegungen
- ToolMovement (mit from_location, to_location, status, user, note)

### Benutzer und Sicherheit
- User (mit personal_number, first_name, last_name, is_active, is_admin)
- Role
- Permission

### Serienartikel
- SerialArticle (mit article_number, description, pdf_path, metadata)

## Quellen fur das Domain Model
1. Aktuelle Anforderungen (`docs/01-requirements.md`)
2. Verbindliche Projektentscheidungen (`docs/13-decisions.md`)
3. Umgesetztes Modell (`backend/app/models/`)

## Ergebnis

Das Domain Model ist umgesetzt. Abweichungen von der ursprünglichen Planung:

- `StorageLocation` wurde entfernt (DEC-048) – der **Platz** (`Position`) ist der Lagerort.
- `Tool` hat `position_id` statt `storage_location_id`, dazu `size_a`/`size_b`,
  `allow_duplicate_id`, `customer_id`, `machine_id`.
- `storage_count` wurde **nicht** umgesetzt (DEC-037) – Mehrfachobjekte sind eigene Datensätze.
- `Drawer` hat `cols` und `rows` (Matrix aus DEC-048).

Erledigt.