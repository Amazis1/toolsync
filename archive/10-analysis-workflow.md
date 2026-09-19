---
description: Verbindlicher Analyse-Workflow für die vollständige Analyse des Altsystems D:\Web und die Dokumentation für ToolSync 2.0
---

# ToolSync – Verbindlicher Analyse-Workflow

## 1. Zweck dieser Rule

Diese Rule definiert den verbindlichen Ablauf für die Analyse des Altsystems unter:

D:\Web

Die Analyse dient als Grundlage für die Entwicklung von:

D:\toolsync

Das Ziel ist eine möglichst vollständige und nachvollziehbare Analyse der tatsächlich vorhandenen Implementierung.

Eine reine Analyse der Verzeichnisstruktur ist ausdrücklich NICHT ausreichend.

Eine Liste von Dateien ist ausdrücklich NICHT ausreichend.

Eine Analyse gilt nicht als abgeschlossen, nur weil das Modell die wichtigsten Ordner erkannt hat.

Relevante Dateien und Implementierungen müssen tatsächlich gelesen, verstanden und dokumentiert werden.

---

# 2. Absolute Dateisicherheitsregel

D:\Web ist READ-ONLY.

Es sind keinerlei Schreiboperationen unter D:\Web erlaubt.

Verboten sind insbesondere:

- Dateien erstellen
- Dateien ändern
- Dateien löschen
- Dateien verschieben
- Dateien umbenennen
- Dateien kopieren
- Dependencies installieren
- Migrationen ausführen
- Datenbanken verändern
- Konfigurationen verändern
- automatische Formatierungen
- automatische Codeänderungen
- Build-Artefakte erzeugen

D:\Web darf ausschließlich gelesen und analysiert werden.

Alle erzeugten Dokumentationen gehören nach:

D:\toolsync\docs

Alle erzeugten Tasks gehören nach:

D:\toolsync\tasks

---

# 3. Aktives Projekt

Das aktive Projekt ist:

D:\toolsync

Nur innerhalb dieses Verzeichnisses dürfen im Rahmen der Projektarbeit neue Dateien erstellt oder bestehende Dateien verändert werden.

---

# 4. Definition einer vollständigen Analyse

Eine Analyse gilt nur dann als vollständig, wenn alle relevanten Bereiche des Altsystems untersucht wurden.

Dabei gilt:

> 100 % Analyse bedeutet, dass alle relevanten Projektbereiche und relevanten Implementierungen tatsächlich untersucht wurden.

Es bedeutet nicht zwingend, dass jedes einzelne Byte jeder generierten oder irrelevanten Datei gelesen werden muss.

Es bedeutet jedoch ausdrücklich:

- relevante Quellcodedateien müssen gelesen werden,
- relevante Models müssen gelesen werden,
- relevante Business Logic muss nachvollzogen werden,
- relevante Views müssen gelesen werden,
- relevante Forms müssen gelesen werden,
- relevante APIs müssen untersucht werden,
- relevante Templates müssen untersucht werden,
- relevante Frontend-Logik muss untersucht werden,
- relevante Konfiguration muss untersucht werden,
- relevante Migrationen müssen untersucht werden,
- relevante Tests müssen untersucht werden,
- relevante Integrationen müssen untersucht werden.

Eine Verzeichnisauflistung allein ist niemals eine vollständige Analyse.

---

# 5. Analyseprinzip

Die Analyse muss immer nach folgendem Muster erfolgen:

1. Inventarisieren
2. Priorisieren
3. Dateien tatsächlich lesen
4. Zusammenhänge nachvollziehen
5. Datenflüsse nachvollziehen
6. Geschäftslogik nachvollziehen
7. Ergebnisse dokumentieren
8. offene Fragen dokumentieren
9. Analyse-Coverage aktualisieren
10. erst danach nächsten Bereich analysieren

Nicht:

Verzeichnisse auflisten → Zusammenfassung schreiben → Analyse fertig

Sondern:

Inventar → Lesen → Verstehen → Nachverfolgen → Dokumentieren → Prüfen

---

# 6. Kein vorschneller Abschluss

Das Modell darf niemals behaupten:

"Die Analyse ist abgeschlossen."

wenn lediglich:

- Verzeichnisse analysiert wurden,
- Dateinamen betrachtet wurden,
- wenige Stichproben gelesen wurden,
- nur die offensichtlichsten Dateien gelesen wurden.

Vor einem Abschluss muss eine Coverage-Prüfung durchgeführt werden.

Die Coverage-Prüfung muss zeigen:

- Welche Bereiche wurden analysiert?
- Welche Dateien wurden tatsächlich gelesen?
- Welche Dateien wurden nur inventarisiert?
- Welche Implementierungen wurden verstanden?
- Welche Bereiche sind noch offen?
- Welche Unsicherheiten bestehen?

---

# 7. Analysephasen

Die Analyse soll in logisch getrennten Phasen erfolgen.

## Phase 1 – Projektinventar

Ziel:

Vollständige Übersicht über das Altsystem gewinnen.

Untersuchen:

- Root-Verzeichnis
- Projektstruktur
- Apps/Module
- Backend
- Frontend
- Templates
- Static
- Konfiguration
- Datenbank
- Migrationen
- Tests
- Dokumentation
- Integrationen
- Scripts
- Management Commands
- Deployment-Konfiguration

Ergebnis:

Ein vollständiges Projektinventar.

Wichtig:

Das Inventar ist nur der Anfang.

Phase 1 ist nicht die vollständige Analyse.

---

## Phase 2 – Einstiegspunkte und Architektur

Untersuchen:

- Django Settings
- URLs
- WSGI/ASGI
- App-Konfiguration
- zentrale Initialisierung
- Middleware
- Authentication
- zentrale Services
- zentrale Utilities
- externe Integrationen

Ziel:

Verstehen, wie die Anwendung technisch aufgebaut ist.

Dokumentieren:

- Komponenten
- Abhängigkeiten
- Request-Flows
- zentrale Datenflüsse

---

## Phase 3 – Datenmodell

Untersuchen:

- Django Models
- Foreign Keys
- Many-to-Many Beziehungen
- One-to-One Beziehungen
- Constraints
- Unique Constraints
- Choices
- Statusfelder
- IDs
- Custom Fields
- Model Methods
- Properties
- Signals
- Manager
- QuerySets

Zusätzlich untersuchen:

- Migrationen
- Datenbankstruktur
- Initialdaten
- Fixtures
- Seed-Daten

Ziel:

Das tatsächliche Datenmodell verstehen.

Besonders dokumentieren:

- Entitäten
- Beziehungen
- Schlüssel
- Eindeutigkeitsregeln
- Statusmodelle
- implizite Geschäftslogik

---

## Phase 4 – Authentifizierung

Untersuchen:

- Login
- Logout
- Session
- Authentication Backend
- User Model
- Benutzeranlage
- Passwortlogik
- Personalnummern
- Admin
- Rollen
- Gruppen
- Permissions
- Decorators
- Middleware
- geschützte Views
- API-Authentifizierung

Besonders wichtig:

Die tatsächliche Login-Implementierung des Altsystems muss vollständig nachvollzogen werden.

Nicht annehmen.

Nicht aus Dateinamen schließen.

Tatsächlich lesen.

Danach vergleichen mit:

D:\toolsync\docs\13-decisions.md

Dabei müssen Unterschiede dokumentiert werden.

---

## Phase 5 – Benutzer und Berechtigungen

Untersuchen:

- User Model
- Profile
- Rollen
- Gruppen
- Permissions
- Admin
- Benutzeranlage
- Benutzerbearbeitung
- Benutzerdeaktivierung
- Rechteprüfung
- Frontend-Rechte
- Backend-Rechte

Dokumentieren:

- Wer darf was?
- Wo wird geprüft?
- Nur Frontend?
- Backend?
- Beides?

---

## Phase 6 – Werkzeugverwaltung

Untersuchen:

- Werkzeug Models
- Werkzeugtypen
- Kategorien
- Typ-Codes
- Werkzeug-IDs
- ID-Generierung
- ID-Validierung
- Status
- Eigenschaften
- CRUD
- Suche
- Filter
- Detailseiten

Besonders wichtig:

Die tatsächliche Bedeutung bestehender IDs untersuchen.

Beispiel:

•1075000

Nicht automatisch annehmen, was die Bestandteile bedeuten.

Die Implementierung muss gelesen werden.

---

## Phase 7 – Lager und Bestand

Untersuchen:

- Lager
- Werke
- Lagerorte
- Bestände
- Lagerobjekte
- Ersatzteile
- Ersatzstempel
- Matrizen
- Maschinenteile
- IDs
- Mehrfach-IDs
- Lagerplatzlogik
- Verfügbarkeiten

Besonders prüfen:

Wie wird im Altsystem entschieden, ob eine ID eindeutig sein muss?

Wie werden Mehrfachobjekte behandelt?

Wie werden Lagerplätze verwaltet?

---

## Phase 8 – Serienartikel

Untersuchen:

- Serienartikel Models
- PDF-Dateien
- Upload
- Speicherung
- Dateipfade
- Dateinamen
- Suche
- Anzeige
- Download
- Berechtigungen
- Admin-Funktionen

Wichtig:

Die aktuelle fachliche Entscheidung lautet:

Serienartikel sind PDF-basierte Einrichtepläne.

Der aktuelle Kernumfang ist:

- suchen
- auswählen
- PDF öffnen/anzeigen

Die PDF enthält beispielsweise:

- Programmname
- Laufzeit
- Werkzeug-IDs
- Anzahl der Hübe
- Material
- Maschine

Das Altsystem muss darauf untersucht werden, wie diese PDFs tatsächlich behandelt werden.

Es darf nicht automatisch angenommen werden, dass die PDF-Inhalte strukturiert in einer Datenbank gespeichert werden.

---

## Phase 9 – Ausleihe

Untersuchen:

- Ausleihlogik
- Ausleihmodelle
- Benutzer
- Werkzeuge
- Status
- Validierung
- Verfügbarkeit
- UI
- API
- Historie

Nachvollziehen:

Benutzer → Werkzeug → Ausleihe → Status → Historie

---

## Phase 10 – Rückgabe

Untersuchen:

- Rückgabe
- Statusänderungen
- Lagerortänderungen
- Benutzer
- Historie
- Validierung
- Fehlerfälle

---

## Phase 11 – Werkzeugbewegungen

Untersuchen:

- Standortwechsel
- Lagerplatzwechsel
- Ausleihe
- Rückgabe
- Statusänderung
- Historisierung
- Audit Trail

Ziel:

Verstehen, wie Bewegungen tatsächlich gespeichert und nachvollzogen werden.

---

## Phase 12 – Frontend

Untersuchen:

- Templates
- HTML
- JavaScript
- CSS
- UI-Komponenten
- Formulare
- AJAX
- API-Aufrufe
- Suche
- Filter
- Tabellen
- Modals
- Navigation
- Admin UI

Dokumentieren:

- wichtige Benutzerflüsse
- relevante Seiten
- Formulare
- Interaktionen

---

## Phase 13 – Admin

Untersuchen:

- Django Admin
- Custom Admin
- Benutzerverwaltung
- Werkzeugverwaltung
- Lagerverwaltung
- Stammdaten
- Permissions

---

## Phase 14 – Statistik

Untersuchen:

- Reports
- Dashboards
- Auswertungen
- SQL-Abfragen
- Aggregationen
- Diagramme
- Exportfunktionen

---

## Phase 15 – Tests

Untersuchen:

- Unit Tests
- Integration Tests
- API Tests
- Selenium
- Playwright
- andere E2E Tests

Dokumentieren:

- welche Funktionen getestet werden,
- welche kritischen Funktionen nicht getestet werden,
- welche Regressionstests vorhanden sind.

---

## Phase 16 – Integrationen

Untersuchen:

- SAP
- externe APIs
- Dateisystem
- Netzwerk
- E-Mail
- andere Systeme

Besonders wichtig:

SAP ist in ToolSync 2.0 optional.

Die Analyse soll deshalb dokumentieren:

- welche SAP-Abhängigkeiten existieren,
- welche Funktionen ohne SAP funktionieren,
- welche Funktionen SAP benötigen,
- welche SAP-Integration später optional abstrahiert werden könnte.

---

# 8. Abhängigkeiten verfolgen

Bei der Analyse einer Funktion muss das Modell relevante Abhängigkeiten verfolgen.

Beispiel:

Wenn eine View untersucht wird:

View

→ verwendetes Model

→ verwendetes Service

→ verwendete Form

→ verwendetes Template

→ verwendete JavaScript-Logik

→ verwendete API

→ Datenbankzugriff

Das Ziel ist nicht nur:

"Datei X existiert."

Sondern:

"Datei X implementiert Funktion Y und verwendet dafür A, B und C."

---

# 9. Geschäftslogik verfolgen

Besondere Aufmerksamkeit gilt Logik, die nicht direkt im Model liegt.

Untersuchen:

- Services
- Utilities
- Helper
- Signals
- Form Validation
- View Logic
- API Logic
- Middleware
- Decorators
- Custom Managers
- QuerySets
- Background Tasks

Geschäftsregeln dürfen nicht nur anhand von Dateinamen vermutet werden.

---

# 10. Analyse-Coverage

Während der Analyse muss eine Coverage-Übersicht geführt werden.

Mindestens:

| Bereich | Inventar | Dateien gelesen | Implementierung verstanden | Dokumentiert | Status |
|---|---|---|---|---|---|
| Projektstruktur | | | | | |
| Architektur | | | | | |
| Datenmodell | | | | | |
| Migrationen | | | | | |
| Auth | | | | | |
| Benutzer | | | | | |
| Berechtigungen | | | | | |
| Werkzeuge | | | | | |
| Werkzeugtypen | | | | | |
| Werkzeug-IDs | | | | | |
| Lager | | | | | |
| Bestand | | | | | |
| Serienartikel | | | | | |
| Ausleihe | | | | | |
| Rückgabe | | | | | |
| Bewegungen | | | | | |
| Frontend | | | | | |
| Admin | | | | | |
| Statistik | | | | | |
| Tests | | | | | |
| Integrationen | | | | | |

Statuswerte:

- NOT_STARTED
- IN_PROGRESS
- ANALYZED
- PARTIAL
- BLOCKED

---

# 11. Gelesen vs. nur gefunden

Für wichtige Dateien muss unterschieden werden zwischen:

FOUND

und:

READ

Eine Datei, die nur durch eine Verzeichnisauflistung gefunden wurde, gilt nicht als analysiert.

Eine Datei gilt erst als analysiert, wenn ihr relevanter Inhalt tatsächlich untersucht wurde.

---

# 12. Dokumentation

Die Ergebnisse der Altsystemanalyse gehören primär nach:

D:\toolsync\docs\12-old-django-analysis.md

Die Dokumentation soll enthalten:

1. Übersicht
2. Architektur
3. Projektstruktur
4. Datenmodell
5. Authentifizierung
6. Benutzer
7. Rollen
8. Berechtigungen
9. Werkzeuge
10. Werkzeugtypen
11. ID-System
12. Lager
13. Bestand
14. Serienartikel
15. Ausleihe
16. Rückgabe
17. Bewegungen
18. Frontend
19. Admin
20. Statistik
21. Tests
22. Integrationen
23. technische Besonderheiten
24. Risiken
25. erkannte Probleme
26. relevante Dateien
27. offene Fragen

---

# 13. Keine erfundenen Informationen

Wenn eine Information nicht aus dem Code oder der Dokumentation hervorgeht:

Nicht erfinden.

Stattdessen:

OPEN

oder:

UNKNOWN

verwenden.

Wenn eine Schlussfolgerung wahrscheinlich ist:

Als:

INFERRED

kennzeichnen.

---

# 14. Widersprüche dokumentieren

Wenn das Altsystem und die aktuellen Anforderungen voneinander abweichen, muss der Unterschied dokumentiert werden.

Beispiel:

| Thema | Altsystem | Aktuelle Anforderung | Entscheidung |
|---|---|---|---|
| Login | Passwort | Personalnummer ohne Passwort | aktuelle Anforderung |
| Serienartikel | ... | PDF-Dokument | offen/entschieden |
| Werkzeugtyp | ... | Rund/Quadrat | aktuelle Anforderung |
| SAP | ... | optional | aktuelle Anforderung |

Nicht stillschweigend angleichen.

---

# 15. Keine automatische Übernahme

Die Analyse ist keine automatische Migration.

Das Modell darf nicht automatisch entscheiden:

"Das alte System macht es so, deshalb machen wir es genauso."

Stattdessen muss unterschieden werden:

EXISTING

REQUIRED

PROPOSED

OPEN

REJECTED

---

# 16. Lokale Modellressourcen

Die Analyse wird mit lokalen Modellen durchgeführt.

Plan:

qwen3:14b

Agent:

qwen2.5-coder:14b

Coding Assistant:

qwen2.5-coder:14b

Autocomplete:

qwen2.5-coder:7b

Embedding:


omic-embed-text:latest

Hardware:

- 16 GB VRAM
- 32 GB RAM

Die Analyse muss deshalb ressourcenschonend durchgeführt werden.

Keine unnötig großen Kontextmengen auf einmal laden.

Nicht das gesamte D:\Web in einem einzigen Prompt zusammenfassen.

Große Bereiche in logisch getrennten Analyseaufgaben bearbeiten.

Ergebnisse in kleinen, persistenten Dokumenten speichern.

Vorhandene Dokumentation und Rules gezielt verwenden.

---

# 17. Analyse mit Plan Mode

Plan Mode wird primär für:

- Lesen
- Suchen
- Verstehen
- Analysieren
- Vergleichen
- Planen

verwendet.

Plan Mode ist READ-ONLY.

Plan Mode soll keine Projektdateien verändern.

Wenn Dokumentation erstellt oder geändert werden muss, soll dies als konkrete Aufgabe für Agent Mode vorbereitet werden.

Die Analyse selbst darf nicht als abgeschlossen betrachtet werden, nur weil Plan Mode einen Plan formuliert hat.

Der Plan muss auf tatsächlich untersuchten Dateien und Implementierungen basieren.

---

# 18. Übergang von Plan Mode zu Agent Mode

Nach Abschluss einer Analysephase soll ein strukturierter Übergabebericht erstellt werden.

Dieser muss enthalten:

- Was wurde analysiert?
- Welche Dateien wurden gelesen?
- Was wurde verstanden?
- Welche Ergebnisse wurden dokumentiert?
- Welche offenen Fragen bestehen?
- Welche Dateien müssen noch untersucht werden?
- Welche Dokumentationsänderungen sind erforderlich?
- Was ist die nächste Analysephase?

Agent Mode darf anschließend die Dokumentation unter D:\toolsync aktualisieren.

---

# 19. PowerShell-Verhalten

Continue soll keine Annahme treffen, dass PowerShell automatisch ausgeführt werden kann.

Der Benutzer führt PowerShell-Befehle selbst aus.

Wenn Continue eine Datei erstellen oder ändern soll, muss Continue:

1. die Änderung erklären,
2. den vollständigen Inhalt bzw. die vollständige Änderung bereitstellen,
3. einen vollständigen PowerShell-Befehl erzeugen,
4. den Benutzer auffordern, den Befehl selbst auszuführen,
5. auf die Ausgabe des Benutzers warten,
6. die Ausgabe anschließend auswerten.

PowerShell-Befehle müssen so gestaltet sein, dass sie ausschließlich innerhalb von:

D:\toolsync

schreiben.

Für:

D:\Web

dürfen ausschließlich READ-ONLY-Befehle erzeugt werden.

---

# 20. Abschlussprüfung

Bevor die Analyse als abgeschlossen bezeichnet werden darf, muss eine Abschlussprüfung durchgeführt werden.

Die Prüfung muss beantworten:

1. Wurde die gesamte Projektstruktur inventarisiert?
2. Wurden alle relevanten Apps/Module untersucht?
3. Wurden Models gelesen?
4. Wurden Migrationen untersucht?
5. Wurde die Authentifizierung vollständig untersucht?
6. Wurden Benutzer und Berechtigungen untersucht?
7. Wurde die Werkzeugverwaltung untersucht?
8. Wurden Werkzeugtypen untersucht?
9. Wurde die ID-Logik untersucht?
10. Wurden Lager und Bestand untersucht?
11. Wurden Serienartikel untersucht?
12. Wurden Ausleihe und Rückgabe untersucht?
13. Wurden Bewegungen untersucht?
14. Wurde das Frontend untersucht?
15. Wurde der Admin untersucht?
16. Wurde Statistik untersucht?
17. Wurden Tests untersucht?
18. Wurden Integrationen untersucht?
19. Wurden relevante Abhängigkeiten verfolgt?
20. Wurden Widersprüche zu den aktuellen Anforderungen dokumentiert?
21. Wurden offene Fragen dokumentiert?
22. Wurde die Coverage-Matrix aktualisiert?

Wenn eine Antwort NEIN lautet:

Die Analyse ist nicht abgeschlossen.

---

# 21. Harte Abschlussregel

Die Analyse darf erst als:

ANALYSIS COMPLETE

bezeichnet werden, wenn die Abschlussprüfung durchgeführt wurde.

Eine reine Verzeichnisanalyse darf niemals als:

ANALYSIS COMPLETE

bezeichnet werden.

Eine oberflächliche Stichprobenanalyse darf niemals als:

ANALYSIS COMPLETE

bezeichnet werden.

Wenn noch relevante Bereiche oder Implementierungen nicht untersucht wurden:

ANALYSIS INCOMPLETE

verwenden.

---

# 22. Priorität der Informationen

Bei der Analyse gilt:

1. Aktuelle explizite Anforderungen des Projektinhabers
2. D:\toolsync\docs\13-decisions.md
3. D:\toolsync\docs\01-requirements.md
4. D:\toolsync\docs\00-project-vision.md
5. weitere ToolSync-Dokumentation
6. Continue Rules
7. tatsächliche Implementierung in D:\Web
8. technische Empfehlungen des AI-Modells

Das Altsystem wird analysiert.

Aktuelle Anforderungen werden dadurch nicht überschrieben.

---

# 23. Ziel

Das Ziel dieser Analyse ist nicht, möglichst schnell eine Zusammenfassung zu erzeugen.

Das Ziel ist, eine belastbare technische und fachliche Wissensgrundlage für ToolSync 2.0 zu schaffen.

Die Analyse soll eine spätere Entwicklung ermöglichen, bei der:

- keine wichtigen Funktionen übersehen werden,
- keine kritischen Geschäftsregeln verloren gehen,
- keine alten Fehler blind übernommen werden,
- aktuelle Anforderungen berücksichtigt werden,
- Architekturentscheidungen nachvollziehbar getroffen werden,
- Migrationen geplant werden können.

---

# Ende des verbindlichen Analyse-Workflows
