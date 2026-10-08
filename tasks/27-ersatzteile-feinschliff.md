# TASK-027 – Ersatzteile: Feinschliff (Formular, Tabelle) und offene Frage Lagerplatz

**Status:** COMPLETED – Formular, Tabelle und Matrix-Lagerplatz erledigt
**Basis:** DEC-064 (Ersatzteile), DEC-067 (Maschinenfarbe), DEC-063 (Listenoptik)
**Auslöser (Projektinhaber):** „In Anlege-Formular Beschreibung aus dem
Eingabefeld raus holen und dadrüber schreiben. Freier Lagerort ist super! aber
bitte noch Lagerplätze der Werkzeug-Matrix hinzufügen! Die Tabelle anpassen, dass
sie wie andere aussieht." – danach: „Tabelle: Lagerort deutlich machen und Spalte
nach Name/Typ. Menge nach Artikelnummer."

---

## Erledigt

### Formular (`components/spare-parts/SparePartForm.tsx`)

- [x] **Beschreibung:** Die Beschriftung steht jetzt **über** dem Feld
      (`mb-1 block text-xs font-semibold text-slate-700` + `textarea-bordered`,
      dasselbe Muster wie im Serienartikel-Formular und seit dieser Runde auch im
      Datenblatt-Formular) statt als Innenlabel im Feld.
- [x] Feldbezeichnung von „Bezeichnung" auf **„Name"** umgestellt – dieselbe
      Bezeichnung wie in Datenblatt- und Serienartikel-Formular (das Audit A-29
      bemängelt genau solche Vokabular-Unterschiede).

### Liste (`components/spare-parts/SparePartList.tsx`)

- [x] **Name als eigene Kennung** – Mono-Kasten mit **Sky-Kante**, genau wie in
      der Serienartikel- und Datenblatt-Liste; die Artikelnummer trägt die
      Teal-Kante. Spaltenkopf „Name / Typ" (vorher „Bezeichnung / Typ").
- [x] **Maschine mit Farbpunkt aus den Stammdaten** (DEC-067) – wie in der
      Datenblätter-Liste. Vorher stand der Maschinenname als reiner Text.
- [x] **Spaltenreihenfolge** (Entscheidung des Projektinhabers): erst **was** es
      ist, dann **wie** es heißt, dann **wo** es liegt –
      **Artikelnummer · Menge · Name/Typ · Lagerort · Werk · Maschine · Aktionen**.
      Die Menge steht damit direkt nach der Artikelnummer (Bestand gehört zur
      Identität), der Lagerort direkt nach Name/Typ.
- [x] **Lagerort deutlich:** Der Matrix-Platz steht jetzt als Mono-Kasten mit
      **Sky-Kante** in derselben Größe wie die Kennungen (vorher ein kleiner
      `text-xs`-Kasten) – genau die Markierung, die der Lagerplatz in der
      Werkzeugliste trägt. Der Freitext steht daneben als ruhige neutrale
      Markierung (slate-Kante) statt als leise graue Zeile darunter; beide können
      gleichzeitig erscheinen.
- [x] Werk-Spalte auf `whitespace-nowrap` wie in den anderen Listen.

## Lagerplatz aus der Werkzeug-Matrix – **Variante A umgesetzt**

Der Projektinhaber hat **A** gewählt: echter Matrix-Platz mit Belegungsanspruch.
Der freie Lagerort bleibt zusätzlich erhalten.

### Datenmodell und Backend

- [x] `spare_parts.position_id` (FK → `positions.id`, `ondelete="SET NULL"`,
      Index) + Migration `f2a6c8d15b74` (**idempotent**; prüft Spalte,
      Fremdschlüssel und Index einzeln, Batch-Modus für SQLite).
- [x] `Position.spare_part` (`uselist=False`, `lazy="joined"`) und
      `PositionRead.spare_part` – jede Platz-Abfrage liefert das Ersatzteil mit,
      ohne Zusatzabfrage und ohne Nachladen im Async-Kontext.
- [x] `SparePartService._assert_position()`: Platz existiert, gehört zum **Werk**
      des Ersatzteils, kein Werkzeug darauf, kein anderes Ersatzteil darauf.
- [x] Belegung durchgängig: `ToolService` (anlegen/ändern), `LocationService`
      (`move_position`, `place_tool_at_position`), `delete_position` im Router,
      `swap_positions` (lehnt über die bestehende „Ziel nicht belegt"-Prüfung ab).
- [x] **Einreihen** (`insert_at_position`, `place_tool_at_position`-Shift):
      wird abgelehnt, wenn in der Ziel-Schublade ein Ersatzteil liegt – beim
      Einreihen wird die ganze Schublade neu belegt, das Ersatzteil würde sonst
      überschrieben.
- [x] `SparePartRead.position_code` („01-A-25") – in einer Abfrage für die ganze
      Liste gebündelt (`SparePartService.position_codes`).

### Frontend

- [x] `SparePartForm`: Schrank → Schublade → Platz, nur **freie** Plätze; beim
      Bearbeiten bleibt der eigene Platz sichtbar (`getPositionContext`);
      Freitext-Feld bleibt daneben bestehen.
- [x] `ToolForm`: freie Plätze berücksichtigen jetzt auch Ersatzteile
      (`p.tool_id === null && !p.spare_part`).
- [x] `SparePartList`: Matrix-Platz als Code (Mono-Kasten wie in der
      Werkzeugliste), Freitext darunter.
- [x] `AdminStorageLocations` (`SlotCard`): Platz mit Ersatzteil wird als
      **„Ersatzteil <Nr>"** gezeigt (eigene Farbe, eigener Tooltip), ist nicht
      ziehbar (nur Werkzeuge sind es) und nimmt beim Ablegen/Verschieben kein
      Werkzeug an – mit verständlicher Meldung vor dem Serveraufruf.

## Prüfung

| Prüfung | Ergebnis |
|---|---|
| Backend-Tests | **150 passed** – 10 neue in `tests/test_spare_part_position.py` (frei belegen, Werkzeug abgelehnt, Verschieben abgelehnt, Einreihen abgelehnt, zweites Ersatzteil abgelehnt, anderes Werk abgelehnt, unbekannter Platz, eigener Platz beim Bearbeiten, Löschen gibt den Platz frei, Freitext unabhängig) |
| Browser-Suite | **77 passed, 7 skipped** – Ersatzteile 9 passed, neu: „Anlegen mit Matrix-Platz: der Platz-Code steht in der Liste" (inkl. Prüfung, dass die Platz-Abfrage das Ersatzteil liefert), „hebt Name und Maschinenfarbe hervor wie die anderen Listen" und die Spaltenreihenfolge (Menge nach Artikelnummer, Lagerort nach Name/Typ) |
| `tsc -b` / `eslint` | fehlerfrei in allen geänderten Dateien (die 3 Meldungen in `AdminStorageLocations` sind vorbestehend) |
| Migration | `f2a6c8d15b74` angewandt; keine Testreste, Datenbestand des Anwenders unverändert |
