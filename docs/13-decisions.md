# DEC-048 – Lagerplatz als generierte Matrix
**Status:** Verbindlich

Die Lagerplatz-Verwaltung wird nach dem Prototyp aus `toolsync_final.html` umgesetzt.

## Kernprinzip

Ein Schrank wird als **Matrix** angelegt:

- Schrank-Nummer (z. B. `03`)
- Anzahl Schubladen (C, D, E …)
- Pro Schublade ein Grid: Breite X × Tiefe Y

Aus dieser Angabe werden **automatisch alle Plätze** erzeugt – kein manuelles Anlegen einzelner Lagerorte.

## Code-System

Jeder Platz erhält automatisch:

- Kurzcode: `03-C-01` (Schrank-Schublade-Platz)
- Vollcode: `Schrank 03 - Schublade C - Platz 01`

## Perlenketten-Verschiebung

Belegte Plätze können verschoben werden (2 Wege):

1. **Per Klick**: Belegtes Fach auswählen (gelb), dann Zielfach anklicken – alles dazwischen rückt auf.
2. **Per Drag & Drop**: Belegte Karte direkt auf das Zielfach ziehen.

## Datenmodell

- `StorageLocation` wird **entfernt** – der Platz (Position) ist der Lagerort.
- `Drawer` bekommt `cols` (Breite X) und `rows` (Tiefe Y).
- `Position` bekommt `x`, `y` und eine direkte `tool_id`-Zuordnung.
- `Tool.position_id` ersetzt `tool_id` auf StorageLocation.

## Keine externe Drag-&-Drop-Bibliothek

Es wird **natives HTML5 Drag & Drop** verwendet (wie im Prototyp).
Keine zusätzliche Dependency (DEC-021: einfach & robust).
---

# DEC-049 – Stammdaten als Tabellen
**Status:** Verbindlich

Die Stammdaten-Verwaltung im Admin-Panel verwendet **Tabellen** statt endloser Einzel-Karten.

- Werke, Kunden, Maschinen und Werkzeugtypen werden in einer Tabelle dargestellt.
- Jede Zeile enthält: Bezeichnung, ggf. Details (z. B. Werk-Zuordnung bei Maschinen), Aktionen (Bearbeiten/Löschen).
- Neue Einträge werden über ein Eingabefeld oberhalb der Tabelle hinzugefügt.
- Die Tabelle ist scrollbar, damit auch viele Einträge (z. B. 100 Kunden) übersichtlich bleiben.
---

# DEC-050 – Werkzeug-Ablage (nicht eingelagerte Werkzeuge)
**Status:** Verbindlich

Werkzeuge ohne festen Lagerplatz liegen in der **Werkzeug-Ablage**
(`Tool.position_id = NULL`).

## Regeln
- Beim Löschen eines Schranks oder einer Schublade werden eingelagerte
  Werkzeuge **nicht** gelöscht; sie landen in der Ablage.
- Ablage-Werkzeuge können per Drag & Drop oder Klick auf einen Platz
  gelegt werden.
- Ablage → freier Platz: einfaches Ablegen.
- Ablage → belegter Platz: **Einreihen** (Werkzeuge rücken ab Ziel einen
  Platz weiter). Ist der letzte Platz belegt, wird die Aktion blockiert.
- Belegter Platz → Ablage: Platz wird frei, Werkzeug bleibt erhalten.

---


# DEC-051 – Lesezugriff auf Kunden und Maschinen für alle aktiven Benutzer
**Status:** Verbindlich

## Regel
- `GET /api/customers` und `GET /api/machines` sind für alle aktiven Benutzer
  freigegeben (`require_active`).
- `POST`, `PUT` und `DELETE` bleiben ausschließlich Admin (`require_admin`).

## Begründung
Das Werkzeug-Anlegeformular kann Werkzeuge optional einem Kunden und einer
Maschine zuordnen. Ohne Leserechte könnten normale Benutzer diese Felder nicht
befüllen (HTTP 403).

## Auswirkung
- `backend/app/routers/master_data.py` – nur die beiden GET-Routen geändert.
- Frontend: `frontend/src/api/masterData.ts` (neu) bündelt Lese- und
  Schreibfunktionen; `admin.ts` re-exportiert sie (AdminPanel unverändert).

## Alternative (verworfen)
Eigener Read-Endpunkt nur für das Formular – hätte doppelte Routen bedeutet.

---

# DEC-052 – Lager/Ersatz als Einzelzeilen (Mehrfach-ID)
**Status:** Verbindlich

## Regel
- Bei `is_storage = true` ist die Werkzeug-ID **nicht** eindeutig: dieselbe ID
  darf mehrfach existieren.
- Jedes Exemplar ist ein **eigener Datensatz** (eigene Zeile) – kein
  Mengenzähler in einer Spalte.
- Bei `is_storage = false` bleibt die ID innerhalb von Werk + Kategorie
  eindeutig: `tool_id + category + plant_id + is_storage` bildet den Schlüssel.

## Anlage mehrerer Exemplare
- Das Zahlenfeld im Formular bestimmt, wieviele Exemplare in einem Zug
  entstehen (Standard 1).
- Nur das **erste** Exemplar erhält den gewählten Lagerplatz; alle weiteren
  gehen in die Werkzeug-Ablage (`position_id = NULL`), da ein Platz nur ein
  Werkzeug halten kann.
- `allow_duplicate_id` wird aus der Checkbox abgeleitet (`= is_storage`).
- Die Live-Prüfung blockiert nie, solange `is_storage = true`; sie meldet
  stattdessen „ID existiert bereits N× – wird als N+1. Exemplar angelegt“.

## Begründung
- Ausleihe und Rückgabe arbeiten pro Exemplar (`LendModal`).
- Keine Migration und keine Umbauten an der Ausleihlogik notwendig.
- Entspricht der Projektregel aus `tasks/PROJECT-PLAN.md`
  („Lager/Ersatz: is_storage=True → ID darf mehrfach vorkommen“).

## Variante (verworfen)
Mengenspalte `storage_count` in einer Zeile. Hätte eine Migration, eine neue
Spalte, Anzeige-Umbau in der Liste und einen Umbau der Ausleihlogik
(Teilausleihe) erfordert.

## Bugfix im gleichen Zug
`ToolService.create_tool()` übergab `is_storage` nicht an `get_by_tool_id()` –
die Prüfung lief dadurch immer gegen die normalen Werkzeuge. Ist korrigiert.

---

# Ende der Projektentscheidungen
