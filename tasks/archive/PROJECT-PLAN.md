# ToolSync – Projektplan

## Projektstatus

Status: Phase 4 – Zielarchitektur (IN_PROGRESS)

---

# 1. Projektverzeichnisse

## Aktives Projekt

D:\toolsync

Zweck:
- Aktives Entwicklungsprojekt
- Neue Zielarchitektur
- Neue Implementierung
- Neue Dokumentation
- Neue Tests

D:\toolsync ist das einzige Verzeichnis, in dem ToolSync-Dateien erstellt, geandert oder geloscht werden durfen.

## Altsystem

D:\Web

Zweck:
- Referenz
- Technische Analyse
- Verstandnis bestehender Geschaftslogik
- Verstandnis bestehender UI/UX
- Migrationsanalyse

### Absolute Regel

D:\Web ist READ-ONLY.

Niemals:
- Dateien verandern
- Dateien loschen
- Dateien verschieben
- Dateien umbenennen
- Dateien uberschreiben
- Dependencies installieren
- Konfigurationen verandern

D:\Web darf ausschlieslich gelesen und analysiert werden.

---

# 2. Verbindliche Projektentscheidungen

## SAP

SAP ist OPTIONAL.

ToolSync muss vollstandig ohne SAP funktionieren.

SAP darf keine Voraussetzung sein fur:
- Login
- Benutzerverwaltung
- Rollen
- Berechtigungen
- Werkzeuge
- Werkzeugtypen
- Lager
- Bestand
- Serienartikel
- Lager/Ersatz
- Werkzeugbewegungen
- Kernfunktionen

Eine spätere SAP-Integration erfolgt ausschlieslich uber einen getrennten Integration Layer.

## Login

Normale Benutzer melden sich ausschlieslich uber ihre Personalnummer an.

Beispiel:
129100211

Normale Benutzer benotigen kein Passwort.

Der Anzeigename besteht aus:
- Vorname
- Nachname

Beispiel:
Max Mustermann

Es gibt keine offentliche Selbstregistrierung.

Benutzer werden ausschlieslich durch einen Admin angelegt.

Der Admin:
- legt Benutzer an
- vergibt Personalnummern
- hinterlegt Vorname
- hinterlegt Nachname
- aktiviert Benutzer
- deaktiviert Benutzer
- verwaltet Rollen
- verwaltet Berechtigungen

Der Admin besitzt einen eigenen Login.

Die genaue technische Umsetzung der Admin-Authentifizierung wird nach der Analyse und Sicherheitsplanung festgelegt.

## Werkzeugtypen

Matrize und Abstreifer sind NICHT automatisch Werkzeugtypen.

Werkzeugtypen sind konkrete fachliche Typen.

Beispiele:
- Rund
- Quadrat
- Umformstempel
- Rollwerkzeug
- Kantwerkzeug
- weitere Typen

Beispiel einer Werkzeug-ID:
01075000

Dabei kann beispielsweise gelten:
01 = Rund

Die fachliche Darstellung soll beispielsweise lauten:
Typ: 01 Rund

Nicht kunstlich:
Typ-Code: 01
Typ: Rund

Die tatsachliche Typ-Systematik muss wahrend der Analyse des Altsystems und der Anforderungen gepruft werden.

Beispiele durfen nicht ungepruft als endgultige Datenmodellierung ubernommen werden.

## Serienartikel

Serienartikel sind PDF-Einrichteplane.

Sie sind ein eigener Bereich bzw. Block mit Suchfunktion.

Die Funktionen sind:
- PDFs suchen
- PDF auswahlen
- PDF offnen
- PDF anzeigen

Die PDF kann Informationen enthalten wie:
- Programmname
- Bearbeitungszeit
- Werkzeug-IDs
- Anzahl der Hube
- Material
- Maschine
- weitere Einrichtinformationen

Wichtig:
Serienartikel sind zunachst PDF-Dokumente.

Die Inhalte der PDF durfen nicht automatisch als separate Datenbankfelder modelliert werden.

Erst nach Analyse wird entschieden, ob bestimmte Metadaten zusatzlich strukturiert gespeichert werden mussen.

## Lager / Ersatz

Lager/Ersatz ist ein eigener Bereich bzw. Block mit Suchfunktion.

Dort konnen beispielsweise verwaltet werden:
- Ersatzstempel
- Matrizen
- Maschinenteile
- Ersatzteile
- weitere Lager-/Ersatzobjekte

Bei der Anlage gibt es eine Checkbox fur doppelte IDs.

Wenn die Checkbox aktiviert ist, darf ein weiteres Objekt mit derselben ID angelegt werden.

Die genaue technische Umsetzung wird im Domain Model festgelegt.

---

# PHASE 0 – Vorbereitung

## TASK-000 – Entwicklungsumgebung vorbereiten

Status: COMPLETED

Prioritat: P0

Ziele:
- D:\toolsync als aktives Projekt vorbereiten
- Continue konfigurieren
- Rules vorbereiten
- Context7 MCP konfigurieren
- benotigte MCPs prufen
- Tools prufen
- Tasks vorbereiten
- Plan-Mode-Workflow vorbereiten
- Codebase Documentation Awareness vorbereiten

Bereits vorhanden:
- .continue\rules
- .continue\docs
- .continue\mcpServers\context7.yaml
- .vscode\settings.json

---

# PHASE 1 – Vollstandige Analyse des Altsystems

## TASK-001 – D:\Web vollstandig analysieren

Status: COMPLETED

Prioritat: P0

### Abgeschlossene Analysepakete

#### Phase A – Inventarisierung (COMPLETED)
- Verzeichnisstruktur von D:\Web vollstandig inventarisiert
- Django-Apps identifiziert: werkzeug, stammdaten, bewegung, theme
- Konfigurationsdateien gefunden: settings.py, urls.py
- Dependencies identifiziert: Django 5.1.5, django-htmx, django-alpine, Tailwind CSS v4

#### Phase B – Backend-Logik verstehen (COMPLETED)
- werkzeug/models.py – vollstandig gelesen und verstanden
- werkzeug/views.py – vollstandig gelesen und verstanden
- werkzeug/urls.py – vollstandig gelesen und verstanden
- werkzeug/admin.py – vollstandig gelesen und verstanden
- bewegung/models.py – vollstandig gelesen und verstanden
- bewegung/admin.py – vollstandig gelesen und verstanden
- stammdaten/models.py – vollstandig gelesen und verstanden
- stammdaten/admin.py – vollstandig gelesen und verstanden
- toolsync/settings.py – vollstandig gelesen und verstanden

#### Phase C – Frontend-Logik verstehen (COMPLETED)
- Alle Templates analysiert: base.html, index.html, tab1-4.html, tool_list_partial.html, werkzeug_form_partial.html
- HTMX-Komponenten vollstandig verstanden
- JavaScript-Funktionen (main.js) vollstandig nachvollzogen
- Tailwind CSS-Design (input.css) vollstandig analysiert

#### Phase D – Fachfunktionen analysieren (COMPLETED)
- Werkzeugverwaltung (Anlegen, Validierung, Speichern) verstanden
- Lagerverwaltung (Schrank -> Schublade -> Platz) verstanden
- Serienartikel (UI vorhanden, Backend fehlt) identifiziert
- Bewegungen (Model vorhanden, UI teilweise) verstanden
- Migrationen (9 Dateien) vollstandig analysiert

#### Phase E – UI-Verhalten analysieren (COMPLETED)
- Benutzerablaufe nachvollzogen
- Validierungen (Live-Checks) verstanden
- Fehlermeldungen und Tooltips analysiert

#### Phase F – Wiederverwendbarkeit bewerten (COMPLETED)
- Bewertung aller Komponenten durchgefuhrt
- Entscheidungen dokumentiert

### Datenmodell (aus Altsystem extrahiert)

Die folgenden Entitaten wurden aus dem Altsystem analysiert:

1. Plant – Werk (Werk 1, Werk 2)
2. Customer – Kunde
3. Machine – Maschine
4. ToolType – Werkzeugtyp (Rund, Quadrat, etc.)
5. Cabinet – Schrank (mit total_drawers)
6. Drawer – Schublade (mit total_positions)
7. Position – Platz (innerhalb einer Schublade)
8. StorageLocation – Verknupfung von Cabinet + Drawer + Position
9. Tool – Werkzeug (mit category, plant, tool_id, is_storage, storage_count, size_a, size_b)
10. ToolMovement – Werkzeugbewegung (from_location, to_location, status, user, note)

### Geschaftsregeln (identifiziert)

1. ID-Eindeutigkeit: tool_id + category + plant + is_storage=False → UNIQUE
2. Lager/Ersatz: is_storage=True → ID darf mehrfach vorkommen
3. StorageLocation: Cabinet + Drawer + Position → UNIQUE
4. Ein StorageLocation kann nur ein Tool haben (1:1)
5. Bei Anlage eines Schranks werden automatisch Schubladen (A, B, C, ...) erstellt
6. Bei Anlage einer Schublade werden automatisch Platze (1, 2, 3, ...) erstellt
7. Lagerplatz-Live-Validierung: Prüfung ob Platz bereits belegt ist

### Completion Gate

CHECK 1 – Coverage: PASS
CHECK 2 – Inhaltliche Analyse: PASS
CHECK 3 – Verstandnis: PASS
CHECK 4 – Dokumentation: PASS
CHECK 5 – Referenzverfolgung: PASS
CHECK 6 – Offene Punkte: PASS
CHECK 7 – Widerspruche: PASS
CHECK 8 – D:\Web READ-ONLY: PASS
CHECK 9 – Persistenz: PASS
CHECK 10 – Definition of Done: PASS

**TASK-001 = COMPLETED**

---

# PHASE 2 – Analyse dokumentieren

## TASK-002 – Altsystem dokumentieren

Status: COMPLETED

Prioritat: P0

Voraussetzung:
- TASK-001 = COMPLETED
- Completion Gate = PASS

Primares Dokument:
D:\toolsync\docs\12-old-django-analysis.md

Dokumentieren:
- Projektstruktur
- Architektur
- Django Apps
- Models
- Datenmodell
- Migrationen
- Authentifizierung
- Benutzer
- Rechte
- Rollen
- Werkzeuge
- Werkzeugtypen
- Werkzeug-ID-System
- Lager
- Lagerorte
- Bestand
- Serienartikel
- PDF-Einrichteplane
- Lager/Ersatz
- Werkzeugbewegungen
- Frontend
- Admin
- Statistik
- Tests
- Integrationen
- Risiken
- Wiederverwendbarkeit
- offene Fragen
- Widerspruche
- Annahmen
- Migrationsprobleme

---

# PHASE 3 – Anforderungen vergleichen

## TASK-003 – Altsystem mit ToolSync-Anforderungen vergleichen

Status: COMPLETED

Prioritat: P0

Voraussetzung:
- TASK-002 = COMPLETED
- Completion Gate = PASS

Vergleichen:
- Login
- Benutzeranlage
- Rollen
- Berechtigungen
- Werkzeugstruktur
- Werkzeugtypen
- Werkzeug-ID
- Lager
- Lager/Ersatz
- Serienartikel
- Bewegungen
- Dokumente
- Statistik
- SAP

Jeder Bereich wird klassifiziert als:
- EXISTING
- REQUIRED
- PROPOSED
- OPEN
- REJECTED
- INFERRED

Ergebnis:
Eine nachvollziehbare Gap-Analyse.

Dokumentation:
D:\toolsync\docs\13-decisions.md (Erganzung)
D:\toolsync\docs\14-gap-analysis.md (Neu)

---

# PHASE 4 – Zielarchitektur

## TASK-004 – Zielarchitektur definieren

Status: IN_PROGRESS

Prioritat: P0

Voraussetzung:
- TASK-001 = COMPLETED
- TASK-002 = COMPLETED
- TASK-003 = COMPLETED
- Completion Gates = PASS

Bereiche:
- Frontend
- Backend
- Datenbank
- ORM
- API
- Authentifizierung
- Autorisierung
- Admin
- Dokumentenspeicherung
- Dateispeicherung
- Tests
- Deployment

Orientierung:

### Frontend
- React SPA
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui

### Backend
- FastAPI 0.115+
- Pydantic V2
- SQLAlchemy 2.0 (async)

### Datenbank
- PostgreSQL (SQLite fur Entwicklung)

### Tests
- Pytest
- Playwright

### SAP
- optional
- Integration Layer

Die genannten Technologien sind eine aktuelle Orientierung und durfen wahrend der Architekturplanung anhand der Analyse uberpruft werden.

Context7 wird fur aktuelle 2026er-Standards genutzt.

---

# PHASE 5 – Domain Model

## TASK-005 – ToolSync Domain Model definieren

Status: NOT_STARTED

Prioritat: P0

Voraussetzung:
- TASK-004 = COMPLETED
- Completion Gate = PASS

Bereiche:
- Benutzer
- Rollen
- Berechtigungen
- Werke
- Kunden
- Maschinen
- Lager
- Lagerorte
- Werkzeugkategorien
- Werkzeugtypen
- Werkzeuge
- Lager/Ersatz
- Serienartikel-PDFs
- Dokumente
- Bewegungen
- Historie

Nicht jede Information muss automatisch eine eigene Datenbankentitat werden.

Das Domain Model muss aus folgenden Quellen abgeleitet werden:
1. aktuelle Anforderungen (docs/01-requirements.md)
2. Analyse des Altsystems (docs/12-old-django-analysis.md)
3. getroffene Entscheidungen (docs/13-decisions.md)

---

# PHASE 6 – Security und Berechtigungen

## TASK-006 – Security und Berechtigungen definieren

Status: NOT_STARTED

Prioritat: P0

Voraussetzung:
- TASK-005 = COMPLETED
- Completion Gate = PASS

Bereiche:
- Personalnummer-Login
- Admin-Login
- Benutzeranlage
- Benutzeraktivierung
- Benutzerdeaktivierung
- Rollen
- Berechtigungen
- API-Schutz
- Frontend-Schutz
- Auditierung
- Session-/Token-Strategie

Grundregel:
Frontend-Rechteprufung ersetzt niemals Backend-Rechteprufung.

---

# PHASE 7 – Implementierungs-Roadmap

## TASK-007 – Implementierungs-Roadmap erstellen

Status: NOT_STARTED

Prioritat: P0

Voraussetzung:
- TASK-004 = COMPLETED
- TASK-005 = COMPLETED
- TASK-006 = COMPLETED
- Completion Gates = PASS

Die Implementierung wird in kleine, nachvollziehbare Schritte zerlegt.

Grundreihenfolge:
1. Projektgrundstruktur
2. Datenbank
3. Migrationen
4. Backend-Grundstruktur
5. Authentifizierung
6. Benutzer
7. Rollen und Berechtigungen
8. Admin
9. Werkzeugtypen
10. Werkzeuge
11. Lager
12. Lager/Ersatz
13. Serienartikel-PDF-Bereich
14. Bewegungen
15. Statistik
16. Frontend
17. Tests
18. Deployment
19. optionale SAP-Integration

---

# PHASE 8 – Implementierung

Die konkreten Implementierungs-Tasks werden nach Abschluss der Analyse und Planung erstellt.

Die Implementierung darf nicht auf ungepruften Annahmen aus TASK-001 basieren.

---

# 3. Verbindliche Reihenfolge

TASK-000 (COMPLETED)
    ↓
TASK-001 (COMPLETED)
    ↓
Completion Gate (PASS)
    ↓
Completion Gate
    ↓
TASK-004 (IN_PROGRESS)
    ↓
Completion Gate
    ↓
TASK-005 (NOT_STARTED)
    ↓
Completion Gate
    ↓
TASK-006 (NOT_STARTED)
    ↓
Completion Gate
    ↓
TASK-007 (NOT_STARTED)
    ↓
Completion Gate
    ↓
Implementierungsplanung
    ↓
Implementierung

Ein Task darf niemals ubersprungen werden.

Ein nachfolgender Task darf erst begonnen werden, wenn der vorherige Task:
Status = COMPLETED
und das zugehorige:
Completion Gate = PASS
besitzt.

---

# 4. Continue Modellstrategie

## Plan Mode

Modell: qwen3:14b

Verwendung:
- Analyse
- Planung
- Aufgabenzerlegung
- Dokumentationsplanung
- Architekturplanung

Wegen 16 GB VRAM und 32 GB RAM:
- kleine Kontexte bevorzugen
- Aufgaben in Phasen aufteilen
- nicht das komplette D:\Web auf einmal laden
- Ergebnisse persistent dokumentieren
- bereits dokumentierte Inhalte nicht unnötig erneut laden
- gezielt relevante Dateien lesen

## Agent Mode

Modell: qwen2.5-coder:14b

Verwendung:
- Code schreiben
- Code andern
- Tests schreiben
- Fehler beheben
- Refactoring

Schreibrechte ausschlieslich:
D:\toolsync

D:\Web bleibt READ-ONLY.

## Coding Assistant

Modell: qwen2.5-coder:14b

## Autocomplete

Modell: qwen2.5-coder:7b

## Embedding Model

Modell: nomic-embed-text:latest

---

# 5. PowerShell Workflow

Continue darf nicht davon ausgehen, dass PowerShell direkt ausgefuhrt werden kann.

Wenn eine Datei erstellt oder geandert werden soll und kein geeignetes Schreibwerkzeug verfügbar ist:

1. Continue erzeugt den vollstandigen PowerShell-Befehl.
2. Der Befehl wird vollstandig ausgegeben.
3. Continue sagt ausdrucklich:
   Fuhre diesen PowerShell-Befehl aus.
4. Der Benutzer kopiert den vollstandigen Befehl.
5. Der Benutzer fuhrt ihn selbst in PowerShell aus.
6. Continue darf erst danach durch erneute Prufung feststellen, ob die Anderung tatsachlich vorhanden ist.
7. Erst nach erfolgreicher Prufung darf der persistente Status entsprechend aktualisiert werden.

Continue darf niemals behaupten:
Datei wurde erstellt.
oder:
Datei wurde geandert.
wenn der Benutzer den Befehl noch nicht ausgefuhrt hat oder die Anderung nicht anschliesend verifiziert wurde.

---

# 6. Aktueller Task

Aktueller Task:
TASK-004 – Zielarchitektur definieren

Aktueller Status:
IN_PROGRESS

Nächster konkreter Schritt:
Definition der Zielarchitektur auf Basis der Analyse und der getroffenen Entscheidungen.

---

# 7. Verbindlicher Start- und Wiederaufnahme-Workflow

Dieser Abschnitt ist bei jedem Start einer neuen Continue-Session und bei jedem Verlust des Modellkontexts verbindlich.

## 7.1 Grundregel

Continue darf nach einem Neustart NICHT einfach mit einer neuen Analyse beginnen.

Continue muss zuerst den persistenten Projektstatus prufen.

Der persistente Projektstatus ist die masgebliche Quelle fur den aktuellen Arbeitsstand.

Es darf nicht davon ausgegangen werden, dass der bisherige Chatverlauf vollstandig verfügbar oder korrekt erhalten ist.

## 7.2 Pflichtdateien beim Session-Start

Bei jedem Neustart oder jeder Wiederaufnahme mussen zuerst mindestens folgende Dateien gepruft werden:

1. D:\toolsync\PROJECT-PLAN.md
2. D:\toolsync\tasks\PROJECT-PLAN.md
3. D:\toolsync\tasks\01-analyze-old-project.md
4. D:\toolsync\docs\12-old-django-analysis.md
5. D:\toolsync\.continue\rules\10-analysis-workflow.md

## 7.3 Status feststellen

Nach dem Lesen der persistenten Dokumentation muss Continue feststellen:

- aktueller Task
- aktueller Task-Status
- aktuelle Analysephase
- letzter abgeschlossener Analyseabschnitt
- zuletzt analysierte Dateien oder Dateigruppen
- Coverage-Stand
- bereits dokumentierte Erkenntnisse
- offene Bereiche
- offene Fragen
- bekannte Risiken
- nächster konkreter Analyseschritt

## 7.4 Pflichtausgabe nach Statusprufung

Nach der Statusprufung muss Continue den aktuellen Zustand kompakt ausgeben:

TASK STATUS

Task: <TASK-ID>
Name: <TASK-NAME>
Phase: <AKTUELLE PHASE>
Status: <STATUS>

Letzter dokumentierter Stand:
* <letzter abgeschlossener Abschnitt>

Coverage:
Gefunden: <X> / <Y>
Gelesen: <X> / <Y>
Verstanden: <X> / <Y>
Dokumentiert: <X> / <Y>

Offene Bereiche:
* <Bereich 1>
* <Bereich 2>
* <Bereich 3>

Nächster konkreter Schritt:
* <konkrete nachste Analyseaktion>

## 7.5 Kein Leerlauf nach der Statusanzeige

Die Statusanzeige ist KEIN Abschluss der Arbeit.

Nach der Statusanzeige muss Continue unmittelbar mit dem nächsten offenen konkreten Arbeitsschritt fortfahren.

Nicht zulassig ist:
- nur den Status zu beschreiben
- nur einen Analyseplan erneut zu formulieren
- nur zu erklaren, was als Nachstes getan werden konnte
- auf eine weitere Benutzeraufforderung zu warten

Wenn der nächste konkrete Schritt eindeutig feststeht, muss Continue ihn direkt ausfuhren.

## 7.6 Analyse in kleinen Paketen

Die Analyse von D:\Web muss in kleinen, kontrollierbaren Paketen erfolgen.

Ein Analysepaket soll beispielsweise enthalten:
- eine Django-App
- eine Model-Gruppe
- eine zusammengehorige View-/URL-/Template-Gruppe
- eine Migration-Gruppe

Nach jedem Analysepaket muss Continue:
1. relevante Dateien lesen
2. Zusammenhange verfolgen
3. Erkenntnisse dokumentieren
4. Coverage aktualisieren
5. offene Fragen dokumentieren
6. Risiken dokumentieren
7. den nächsten konkreten Analyseabschnitt bestimmen

## 7.7 Keine erfundenen Fortschritte

Continue darf niemals behaupten, eine Datei gelesen, verstanden oder dokumentiert zu haben, wenn dies nicht tatsachlich erfolgt ist.

Insbesondere gilt:
FOUND bedeutet NICHT READ.
READ bedeutet NICHT UNDERSTOOD.
UNDERSTOOD bedeutet NICHT DOCUMENTED.

---

# 8. Verbindlicher Arbeitszyklus

Fur jeden Analyseabschnitt gilt folgender Zyklus:

1. STATUS PRUFEN
2. NACHSTEN OFFENEN BEREICH BESTIMMEN
3. RELEVANTE DATEIEN IDENTIFIZIEREN
4. DATEIEN TATSACHLICH LESEN
5. REFERENZEN VERFOLGEN
6. ZUSAMMENHANGE VERSTEHEN
7. ERKENNTNISSE DOKUMENTIEREN
8. COVERAGE AKTUALISIEREN
9. OFFENE FRAGEN UND RISIKEN DOKUMENTIEREN
10. TASK STATUS AUSGEBEN
11. NACHSTEN KONKRETEN SCHRITT FESTLEGEN
12. MIT DEM NACHSTEN SCHRITT FORTFAHREN

---

# 9. Verbindliche Statuswerte

Fur Tasks und Analysephasen durfen ausschlieslich folgende Statuswerte verwendet werden:

NOT_STARTED
IN_PROGRESS
BLOCKED
READY_FOR_REVIEW
COMPLETED

COMPLETED darf ausschlieslich nach bestandenem Completion Gate verwendet werden.

---

# 10. Verbindliche Task-Abschlussprufung – Completion Gate

Kein Task darf als abgeschlossen markiert werden, solange die nachfolgende Abschlussprufung nicht vollstandig durchgefuhrt und bestanden wurde.

## 10.1 Vierstufige Coverage-Regel

Fur jeden relevanten Analysebereich mussen folgende vier Zustande getrennt gepruft werden:

| Status       | Bedeutung |
| ------------ | --------- |
| Gefunden     | Relevante Dateien, Komponenten oder Strukturen wurden identifiziert |
| Gelesen      | Die relevanten Inhalte wurden tatsachlich inhaltlich gelesen |
| Verstanden   | Die Funktion und Zusammenhange wurden nachvollzogen |
| Dokumentiert | Die Erkenntnisse wurden dauerhaft in der Projektdokumentation festgehalten |

Ein Bereich darf nur dann als vollstandig abgeschlossen gelten, wenn alle vier Zustande erfullt sind.

## 10.2 Abschluss-Gate

Vor der Meldung COMPLETED muss Continue eine explizite Prufung durchfuhren:

CHECK 1 – Coverage: PASS/FAIL
CHECK 2 – Inhaltliche Analyse: PASS/FAIL
CHECK 3 – Verstandnis: PASS/FAIL
CHECK 4 – Dokumentation: PASS/FAIL
CHECK 5 – Referenzverfolgung: PASS/FAIL
CHECK 6 – Offene Punkte: PASS/FAIL
CHECK 7 – Widerspruche: PASS/FAIL
CHECK 8 – D:\Web READ-ONLY: PASS/FAIL
CHECK 9 – Persistenz: PASS/FAIL
CHECK 10 – Definition of Done: PASS/FAIL

Erst wenn alle zehn Prufungen erfolgreich sind, darf der Task den Status COMPLETED erhalten.

---

# 11. Master-Principles

Fur die gesamte Arbeit an ToolSync gelten folgende Grundsatze:

## Erst verstehen, dann entscheiden

Analysieren
↓
Verstehen
↓
Dokumentieren
↓
Vergleichen
↓
Entscheiden
↓
Architektur planen
↓
Implementieren

## Keine voreiligen Architekturentscheidungen

Wahrend TASK-001 darf die Zielarchitektur nicht endgultig festgelegt werden.

## D:\Web bleibt READ-ONLY

Diese Regel gilt ohne Ausnahme.

## Persistenz hat Vorrang vor Chatverlauf

Die masgebliche Quelle ist die persistente Dokumentation unter D:\toolsync.

---

# Ende PROJECT-PLAN