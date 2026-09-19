# ToolSync – Context: Lagerverschiebung (Handover für neues Chat)

## 0. Regel für dieses Chat
- Starte im **Plan Mode**: nur lesen, analysieren, verstehen. Nichts schreiben.
- Schreibvorgänge (Doku-Updates, Code) erst nach meiner expliziten Freigabe in Agent Mode.
- Geschrieben wird nur unter `D:\toolsync`.
- UI-Styleguide.html hat Vorrang (außer AdminPanel). AdminPanel-Komponenten
  (AdminPanel.tsx, AdminUsers.tsx, AdminToolTypes.tsx, AdminStammdaten.tsx)
  und ToolFormModal.tsx nicht anfassen – außer es geht um die neue
  Verschiebe-Logik in AdminStorageLocations.tsx.
- Einfach & robust vor clever (DEC-021).

## 1. Projekt-Basics (Kurzfassung)
- ToolSync = Werkzeugverwaltung: Ausleihe, Rückgabe, Bestand, Standorte, Serienartikel.
- Aktives Projekt: `D:\toolsync` (einziger Schreibpfad).
- Stack: React 19 SPA (TypeScript, Vite, Tailwind v4) + FastAPI + SQLAlchemy (2.0) + PostgreSQL + Alembic.
- SAP ist optional und in dieser Phase irrelevant.
- Login: Personalnummer (ohne Passwort) für normale Benutzer, eigener Admin-Login.

## 2. Aktives Thema: Lagerverschiebung (Schubladen)
### Problem
Die aktuelle "Perlenkette"-Logik in der Schubladen-Ansicht arbeitet wie
Liste-Sortieren: Bei einer Verschiebung rückt alles zwischen Quelle und
Ziel mit. Das ist fachlich FALSCH für eine echte Schublade mit fixen
Plätzen (01, 02, 03, …).
Alte Doku: `docs/16-perlenkette-dnd-agent-doku.md` (wird nach dem Umbau ersetzt).

### Interaktive Demo (erzeugt, noch von mir zu prüfen)
Datei: `D:\toolsync\docs\demo-lagerverschiebung.html`
- Einzelne Offline-HTML-Datei, Drag & Drop + Klick-Alternative.
- 10 Plätze (Grid: 5 Spalten × 2 Zeilen), Tray mit neuen Werkzeugen.
- Darstellungsreihenfolge: 01–05 UNTERE Reihe, 06–10 OBERE Reihe.
- Demo-Verhalten = Zielverhalten (siehe unten).

## 3. Zielverhalten (in der Demo umgesetzt, von mir noch freizugeben)
| Quelle → Ziel | Aktion | Verhalten |
|---|---|---|
| Tray → leerer Platz | Einlegen | Werkzeug wird abgelegt, fertig. |
| Tray → belegter Platz | **Einreihen** | Alles ab diesem Platz rückt EINE Position nach vorne. Ist der LETZTE Platz belegt → Aktion BLOCKEN (sonst wäre ein Werkzeug "verloren"). |
| Platz → leerer Platz | Verschieben | Einfacher Move, Quelle wird leer. |
| Platz → belegter Platz | **Tauschen** | Die beiden Werkzeuge tauschen rein, NIX anderes bewegt sich. |

Beispiele:
- Einreihen: `1=A 2=B 3=C 4=D 5=–` → E auf 2 → `1=A 2=E 3=B 4=C 5=D`
- Tausch: 5 ↔ 8 → nur diese zwei tauschen, Rest bleibt.

### Daten-Regel (wichtig!)
Beide Seiten der Beziehung müssen IMMER synchron in EINE Transaktion:
- `Position.tool_id` (welches Werkzeug liegt auf dem Platz)
- `Tool.position_id` (wo liegt das Werkzeug)
Die alte Perlenkette-Routine wird durch zwei klar getrennte, atomare
Operationen ersetzt: `insert_at` (Einreihen) und `swap` (Tauschen),
plus einfacher Move.

### Historie
Jede Bewegung soll protokolliert werden (Audit/History) – wie das
aktuell technisch umgesetzt ist, muss die Analyse klären.

## 4. Offene Fragen (noch nicht endgültig entschieden)
1. Verschubben ZWISCHEN verschiedenen Schubladen? (Demo: nein, nur innerhalb)
2. UI-Trigger: reine Belegungsregel per Drag & Drop (wie Demo) oder
   explizite Buttons "Einreihen" / "Tauschen"?
3. Ausgeliehene Werkzeuge: Block beim Verschieben? (logisch: ja)
4. Bestätigungsdialog vor "Einreihen"? (Ändert viele Positionen am Stück)
5. Voller Schublade → Block: bestätigt oder abweichend gewünscht?

## 5. ERSTE AUFGABE im Plan Mode: Komplettes Bild der Lager-Struktur
BEVOR irgendwas geändert wird, vollständige Analyse der Lager-Architektur.
Pfade sind zu prüfen (tatsächliche Struktur kann leicht abweichen):

- `backend/app/models/storage.py` → Schrank, Schublade, Position/Platz
- `backend/app/models/tool.py` → Werkzeug, position_id, Typ-Code
- `backend/app/services/location_service.py` → aktuelle Verschiebe-Logik
- `backend/app/routers/locations.py` (bzw. verwandte Router) → API-Endpunkte
- `backend/app/crud/crud_location.py` → CRUD-Layer
- `backend/app/schemas/storage.py` → Validierung beim Anlegen
- `alembic/versions/` → storage-relevante Migrationen
- Frontend: `AdminStorageLocations.tsx` (Matrix + DnD), `AdminStammdaten.tsx`
- Seed-/Initialdaten: wie entstehen Schränke, Schubladen, Plätze?

### Geliefertes Bild (strukturiert, mit Quellen-Nachweisen):
1. Entitäten & Beziehungen (Schr → Schublade → Platz → Werkzeug,
   Cascades, Unique-Constraints, Indexe)
2. Anlegewege: wie kommen Schrank/Schublade/Platz ins System
   (Admin manuell? Seed? Skript?) – auch: wie viele Plätze pro
   Schublade, frei wählbar oder fix?
3. Werkzeug-Anlage: Pflichtfelder, Typ-Code-Präfix, position_id,
   Serienartikel vs. Mengenbestand
4. Admin-Stammdaten: welche Seiten/Buttons, was darf angelegt/bearbeitet/
   gelöscht werden, welche Rechte
5. "Zwei Wahrheiten": wo werden Position.tool_id und Tool.position_id
   aktuell gehalten/synchronisiert (Services, Routen, Trigger?)
6. Kritische Punkte für den Umbau: Sortierung der Matrix (01–05 unten,
   06–10 oben), Existing-Endpunkte, Historie-Tabellen, Indizes
7. Offene Fragen + Unsicherheiten (UNKNOWN/OPEN kennzeichnen, nichts erfinden)

## 6. Danach (nach meiner Freigabe)
1. Ich prüfe das Bild + ggf. Demo.
2. Umsetzung: `location_service.py` (Einreihen/Tausch atomar),
   eigener API-Endpunkt (z. B. POST /tools/{id}/move) mit Validierung
   + Rechteprüfung + Historie-Write, `AdminStorageLocations.tsx`
   (neue DnD-Logik, Feedback via Alerts/Log).
3. Tests: Pytest für die Service-Logik (Einreihen-Shift, Tausch,
   Block bei vollem Platz, doppelte Belegung, ausgeliehenes Werkzeug).
4. Doku-Update: `16-perlenkette-dnd-agent-doku.md` ersetzen/neu schreiben.