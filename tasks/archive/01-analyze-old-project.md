# TASK-001: D:\Web vollständig analysieren

## 1. Ziel

Das Ziel dieses Tasks ist die vollständige, nachvollziehbare und evidenzbasierte Analyse des Altsystems unter:

`D:\Web`

Die Analyse dient als belastbare Grundlage für die spätere Entwicklung von ToolSync 2.0.

Die Analyse erfolgt ausschließlich in kontrollierten Phasen.

Die Reihenfolge ist verbindlich:

1. Projektkontext verstehen
2. Phase A – Inventarisierung
3. Phase B – Backend
4. Phase C – Datenmodell
5. Phase D – Frontend
6. Phase E – Fachfunktionen
7. Phase F – UI-Verhalten
8. Phase G – Wiederverwendbarkeit
9. Completion Gate
10. Erst danach: Vergleich mit aktuellen ToolSync-Anforderungen
11. Erst danach: Zielarchitektur
12. Erst danach: Implementierungsplanung

**Während TASK-001 darf keine Implementierung der Zielarchitektur beginnen.**

Es dürfen keine voreiligen Architekturentscheidungen getroffen werden.

---

# 2. Verbindliche Arbeitsregeln

## 2.1 D:\Web ist strikt READ-ONLY

`D:\Web` darf ausschließlich gelesen und analysiert werden.

Unter `D:\Web` dürfen niemals:

* Dateien erstellt werden
* Dateien geändert werden
* Dateien gelöscht werden
* Dateien verschoben werden
* Dateien umbenannt werden
* Dateien überschrieben werden
* Dependencies installiert werden
* Konfigurationen verändert werden
* Migrationen ausgeführt werden
* Datenbanken verändert werden
* Build-Prozesse ausgeführt werden, wenn dadurch Dateien verändert werden könnten

Bei Unsicherheit gilt:

**Nicht schreiben. Nicht ausführen. Nur lesen.**

Alle Ergebnisse, Dokumentationen und Statusinformationen gehören ausschließlich nach:

`D:\toolsync`

---

## 2.2 D:\toolsync ist das einzige Schreibziel

Dokumentation:

`D:\toolsync\docs`

Tasks:

`D:\toolsync\tasks`

Continue-spezifische Dokumentation:

`D:\toolsync\.continue\docs`

Continue Rules:

`D:\toolsync\.continue\rules`

Analyseergebnisse dürfen ausschließlich in diesen erlaubten Bereichen gespeichert werden.

---

# 3. Kritische Statusdefinitionen

Die Analyse verwendet vier voneinander getrennte Statusstufen:

## FOUND

`FOUND` bedeutet ausschließlich:

Der Pfad oder die Datei wurde tatsächlich gefunden.

Beispiel:

```text
FOUND:
D:\Web\toolsync\settings.py
```

`FOUND` bedeutet NICHT:

* Datei gelesen
* Datei verstanden
* Datei analysiert
* Datei dokumentiert

---

## READ

`READ` bedeutet:

Der tatsächliche Inhalt der Datei wurde gelesen.

Ein Dateiname, Dateipfad oder Verzeichnislisting ist kein Nachweis für `READ`.

Beispiel:

```text
FOUND: PASS
READ: PASS

EVIDENCE:
D:\Web\toolsync\settings.py
```

Wenn nur der Pfad bekannt ist:

```text
FOUND: PASS
READ: NO
```

---

## UNDERSTOOD

`UNDERSTOOD` bedeutet:

Der tatsächliche Inhalt wurde verstanden und relevante Zusammenhänge wurden nachvollzogen.

Dazu gehört, wenn relevant:

* Imports
* Referenzen
* Aufrufbeziehungen
* Model-Beziehungen
* URL → View
* View → Template
* View → Form
* Model → Migration
* Template → JavaScript
* JavaScript → Endpoint
* Benutzer → Rolle
* Rolle → Berechtigung
* Werkzeug → Werkzeugtyp
* Werkzeug → Lagerort
* Werkzeug → Bewegung
* Serienartikel → PDF
* Lager/Ersatz → ID-Logik

`UNDERSTOOD` darf niemals allein aus `READ` abgeleitet werden.

---

## DOCUMENTED

`DOCUMENTED` bedeutet:

Die Erkenntnis wurde dauerhaft in der Analyse-Dokumentation dokumentiert.

Die Dokumentation muss:

* konkrete Dateipfade nennen
* tatsächliche Erkenntnisse enthalten
* Unsicherheiten kennzeichnen
* Annahmen kennzeichnen
* offene Fragen dokumentieren
* Widersprüche dokumentieren
* Risiken dokumentieren

---

# 4. Wichtigste Statusregel

## Niemals Status überspringen

Es gilt:

```text
FOUND
↓
READ
↓
UNDERSTOOD
↓
DOCUMENTED
```

Ein Status darf nur gesetzt werden, wenn der vorherige Status tatsächlich nachgewiesen ist.

Insbesondere:

```text
FOUND ≠ READ
READ ≠ UNDERSTOOD
UNDERSTOOD ≠ DOCUMENTED
```

---

# 5. Absolute Evidenzpflicht

Keine Analysebehauptung ohne Nachweis.

Folgende Aussagen sind verboten, wenn sie nicht durch tatsächliche Analyse belegt sind:

* „Die App enthält vermutlich ...“
* „Die Migrationen wurden analysiert“, wenn nur das Verzeichnis gefunden wurde
* „Die Dependencies sind ...“, wenn `package.json` oder andere Dependency-Dateien nicht gelesen wurden
* „Die Django-App ist ...“, wenn dies nicht anhand von `apps.py`, `INSTALLED_APPS` oder tatsächlicher Django-Konfiguration bestätigt wurde
* „Die URLs sind ...“, wenn die tatsächlichen URL-Dateien nicht gelesen wurden
* „Management Commands wurden analysiert“, wenn die tatsächlichen Command-Dateien nicht gelesen wurden
* „Das System verwendet ...“, wenn dies nur aus Dateinamen vermutet wird

Vermutungen müssen ausdrücklich als:

`ANNAHME`

gekennzeichnet werden.

Ungeklärte Sachverhalte müssen als:

`OFFENE FRAGE`

gekennzeichnet werden.

Widersprüche müssen als:

`WIDERSPRUCH`

gekennzeichnet werden.

---

# 6. Verzeichnisanalyse ist keine Inhaltsanalyse

Ein Verzeichnis darf als `FOUND` dokumentiert werden.

Ein Verzeichnis darf nicht automatisch als:

* READ
* UNDERSTOOD
* DOCUMENTED

markiert werden.

Beispiel:

```text
D:\Web\werkzeug\
```

Das beweist nicht:

* dass es eine Django-App ist
* welche Dateien enthalten sind
* welche Models existieren
* welche Views existieren
* welche Funktionen implementiert sind

Diese Informationen müssen durch tatsächliche Analyse der relevanten Dateien nachgewiesen werden.

---

# 7. Vollständigkeit und kleine Analysepakete

Aufgrund der Projektgröße darf nicht versucht werden, das gesamte `D:\Web` gleichzeitig in den Modellkontext zu laden.

Die Analyse erfolgt in kleinen, kontrollierten Paketen.

Ein Analysepaket muss:

1. klar abgegrenzt sein
2. konkrete Dateien enthalten
3. tatsächlich gelesen werden
4. Beziehungen verfolgen
5. dokumentiert werden
6. Coverage aktualisieren
7. offene Fragen und Risiken aktualisieren

Danach wird der persistente Analysezustand gespeichert.

---

# 8. Persistenter Analysezustand

Der verbindliche persistente Status befindet sich in:

`D:\toolsync\docs\12-old-django-analysis.md`

Diese Datei muss nach jedem wesentlichen Analysepaket aktualisiert werden.

Die Datei ist die zentrale Quelle für den bisherigen Analysefortschritt.

Bei Beginn jeder neuen Session muss zuerst gelesen werden:

1. `D:\toolsync\docs\12-old-django-analysis.md`
2. `D:\toolsync\tasks\01-analyze-old-project.md`
3. relevante Continue Rules
4. relevante Projektdokumentation
5. relevante Tasks
6. `PROJECT-PLAN.md`, falls vorhanden

---

# 9. Umgang mit alten oder fehlerhaften Analyseergebnissen

Ein früherer Status darf niemals allein deshalb als gültig übernommen werden, weil er in der Dokumentation steht.

Wenn eine frühere Dokumentation beispielsweise behauptet:

```text
READ: PASS
```

aber keine konkrete Evidenz für das tatsächliche Lesen des Inhalts vorhanden ist, gilt:

```text
READ: NO
```

Wenn eine frühere Dokumentation behauptet:

```text
UNDERSTOOD: PASS
```

aber keine nachvollziehbare Analyse vorliegt, gilt:

```text
UNDERSTOOD: NO
```

Wenn eine frühere Dokumentation behauptet:

```text
DOCUMENTED: PASS
```

aber die Dokumentation keine konkreten Erkenntnisse enthält, gilt:

```text
DOCUMENTED: NO
```

Nicht belegte Statusangaben müssen korrigiert werden.

---

# 10. Projektkontext vor D:\Web

Vor Beginn der eigentlichen Analyse von `D:\Web` muss der vorhandene ToolSync-Projektkontext verstanden werden.

Mindestens zu berücksichtigen sind:

## Continue Rules

Relevante Rules unter:

`D:\toolsync\.continue\rules`

Insbesondere:

* `00-project-overview.md`
* `01-architecture.md`
* `02-domain-rules.md`
* `03-security.md`
* `04-database.md`
* `05-frontend.md`
* `06-backend.md`
* `07-testing.md`
* `08-file-safety.md`
* `09-sap-optional.md`
* `10-analysis-workflow.md`

Falls sich die tatsächliche Rule-Struktur unterscheidet, muss die vorhandene Struktur geprüft werden.

---

## Projektdokumentation

Relevante Dokumentation unter:

`D:\toolsync\docs`

Insbesondere:

* `00-project-vision.md`
* `01-requirements.md`
* `02-domain-model.md`
* `03-authentication.md`
* `04-warehouse.md`
* `05-tools.md`
* `06-serial-articles.md`
* `07-stock-replacement.md`
* `08-tool-movement.md`
* `09-admin-panel.md`
* `10-statistics.md`
* `11-sap-integration.md`
* `12-old-django-analysis.md`
* `13-decisions.md`

Leere Dokumente dürfen nicht als bestätigte Anforderungen interpretiert werden.

---

## Tasks

Relevante Tasks unter:

`D:\toolsync\tasks`

Insbesondere:

* `01-analyze-old-project.md`
* `02-document-old-project.md`
* `03-compare-requirements.md`
* `04-target-architecture.md`
* `05-domain-model.md`
* `06-security-and-permissions.md`
* `07-implementation-roadmap.md`

Zusätzlich:

`D:\toolsync\PROJECT-PLAN.md`

falls vorhanden.

---

# 11. Aktuelle verbindliche fachliche Anforderungen

Diese Anforderungen gelten als aktueller ToolSync-Kontext.

Sie dürfen während der Altsystemanalyse nicht mit dem Altsystem verwechselt werden.

Unterschiede müssen dokumentiert werden.

---

## Login

Normale Benutzer melden sich ausschließlich über ihre Personalnummer an.

Normale Benutzer haben kein Passwort.

Benutzer können sich nicht selbst registrieren.

Benutzer werden ausschließlich durch einen Admin angelegt.

Der Admin verwaltet mindestens:

* Personalnummer
* Vorname
* Nachname
* Status
* Rollen
* Berechtigungen

Der Admin besitzt einen eigenen Login.

Die konkrete technische Umsetzung der Admin-Authentifizierung ist zu analysieren und später sicher zu planen.

---

## SAP

SAP ist optional.

ToolSync muss vollständig ohne SAP funktionieren.

Kernfunktionen dürfen nicht von SAP abhängig sein.

SAP muss über eine klar getrennte Integrationsschicht eingebunden werden.

Während Analyse und früher Implementierung darf SAP die Kernarchitektur nicht unnötig blockieren.

---

## Werkzeugtypen

Matrize und Abstreifer sind nicht automatisch Werkzeugtypen.

Werkzeugtypen sind konkrete fachliche Typen.

Beispiele:

* Rund
* Quadrat
* Umformstempel
* Rollwerkzeug
* Kantwerkzeug

Beispiel:

`01075000`

Möglicherweise:

`01 = Rund`

Die tatsächliche Systematik muss vollständig im Altsystem analysiert werden.

Die fachliche Darstellung könnte beispielsweise sein:

```text
Typ: 01 Rund
```

Nicht automatisch:

```text
Typ-Code: 01
Typ: Rund
```

Diese Darstellung ist eine aktuelle fachliche Vorgabe bzw. ein Beispiel und muss mit dem Altsystem verglichen werden.

---

## Serienartikel

Serienartikel sind PDF-Einrichtepläne.

Die PDF ist zunächst das zentrale Dokument.

Der Benutzer soll:

* PDFs suchen
* PDF auswählen
* PDF öffnen
* PDF anzeigen

PDFs können Informationen enthalten wie:

* Programmname
* Bearbeitungszeit
* Werkzeug-IDs
* Anzahl der Hübe
* Material
* Maschine

Diese Informationen dürfen nicht automatisch als eigene Datenbankfelder modelliert werden.

Zuerst ist zu analysieren:

* wo PDFs gespeichert werden
* wie PDFs gefunden werden
* wie PDFs referenziert werden
* wie PDFs geöffnet werden
* wie PDFs angezeigt werden
* welche Metadaten tatsächlich vorhanden sind
* ob Metadaten strukturiert gespeichert werden

Erst danach wird entschieden, ob zusätzliche strukturierte Metadaten erforderlich sind.

---

## Lager / Ersatz

Lager/Ersatz ist ein eigener Bereich mit Suchfunktion.

Mögliche Objekte:

* Ersatzstempel
* Matrizen
* Maschinenteile
* Ersatzteile

Bei der Anlage kann `duplicate_id_allowed` relevant sein.

Wenn aktiviert, kann ein weiteres Objekt mit derselben ID existieren.

Im Altsystem muss tatsächlich analysiert werden:

* wie IDs funktionieren
* ob IDs eindeutig sind
* welche Tabellen betroffen sind
* welche Unique Constraints existieren
* welche Ausnahmen existieren
* wie Duplikate behandelt werden
* ob Duplikate historisch entstanden sind
* ob die ID-Logik fachlich oder technisch erzwungen wird

---

# 12. PHASEN-GATE

Nach jeder Phase muss ein verbindliches Gate geprüft werden.

Wenn eine Phase nicht vollständig PASS ist:

* nächste Phase NICHT starten
* Zielarchitektur NICHT festlegen
* Implementierung NICHT beginnen
* keine offenen Fragen als erledigt markieren
* keine nicht belegten Statuswerte setzen
* fehlende Evidenz dokumentieren
* nächsten kleinsten Analyseabschnitt bestimmen

Nur wenn alle Kriterien der aktuellen Phase PASS sind:

```text
→ nächste Phase starten
```

---

# 13. PHASE A – INVENTARISIERUNG

Phase A umfasst:

## A1 – Verzeichnisstruktur

Analysieren:

* vollständige Verzeichnisstruktur
* relevante Verzeichnisse
* relevante Dateien
* Dateitypen
* Projektwurzel
* Django-Projektstruktur
* Apps
* Templates
* Static Files
* Media/Uploads
* Scripts
* Dokumente
* Konfiguration
* Tests
* Migrationen

---

## A2 – Dateien

Erstelle eine nachvollziehbare Inventarliste.

Für relevante Dateien:

* Pfad
* Typ
* Zweck
* FOUND
* READ
* UNDERSTOOD
* DOCUMENTED

---

## A3 – Django-Apps

Django-Apps dürfen nur als bestätigt gelten, wenn dies tatsächlich geprüft wurde.

Zu prüfen:

* `apps.py`
* `INSTALLED_APPS`
* App-Verzeichnis
* `models.py`
* `views.py`
* `urls.py`
* `admin.py`
* `forms.py`
* `services.py`
* `signals.py`
* `middleware.py`
* `management/commands/`
* `migrations/`
* Templates
* Static Files

Nicht vorhandene Dateien müssen als:

`NICHT VORHANDEN`

dokumentiert werden.

---

## A4 – Konfiguration

Tatsächlich lesen und analysieren:

* `manage.py`
* `settings.py`
* `urls.py`
* `wsgi.py`
* `asgi.py`
* `.env`-Referenzen
* Konfigurationsdateien
* Dependency-Dateien
* Build-Konfiguration

---

## A5 – Dependencies

Dependencies dürfen nur aus tatsächlichen Quellen abgeleitet werden.

Prüfen:

* `requirements.txt`
* `requirements-*.txt`
* `pyproject.toml`
* `Pipfile`
* `Pipfile.lock`
* `poetry.lock`
* `package.json`
* `package-lock.json`
* weitere vorhandene Dependency-Dateien

Zusätzlich können tatsächliche Imports analysiert werden.

Nicht behaupten, dass eine Dependency verwendet wird, wenn nur eine allgemeine Vermutung besteht.

---

## A6 – Einstiegspunkte

Tatsächlich prüfen:

* `manage.py`
* `wsgi.py`
* `asgi.py`
* relevante Scripts
* Build-Einstiegspunkte
* Frontend-Einstiegspunkte

---

## A7 – URLs

Tatsächliche URL-Dateien lesen.

Nachvollziehen:

```text
URL
→ URL Configuration
→ View
→ Form/Service/Model
→ Template/Response
```

---

## A8 – Migrationen

Alle relevanten Migrationsverzeichnisse identifizieren.

Tatsächliche Migrationsdateien:

* auflisten
* lesen
* chronologisch nachvollziehen
* Änderungen dokumentieren

Nicht nur das Verzeichnis als „Migrationen analysiert“ markieren.

---

## A9 – Management Commands

Alle tatsächlichen `management/commands/`-Verzeichnisse identifizieren.

Alle relevanten Commands:

* auflisten
* lesen
* Zweck analysieren
* verwendete Models/Services nachvollziehen

---

## A10 – Phase-A-Gate

Phase A ist nur PASS, wenn:

* Verzeichnisstruktur tatsächlich geprüft
* relevante Dateien inventarisiert
* Projektstruktur verifiziert
* Django-Apps verifiziert
* Konfiguration geprüft
* Dependencies geprüft
* Einstiegspunkte geprüft
* URLs identifiziert
* Migrationen identifiziert
* Management Commands identifiziert
* Coverage aktualisiert
* offene Fragen dokumentiert
* Risiken dokumentiert
* Widersprüche dokumentiert
* alle Statusangaben evidenzbasiert sind

Wenn ein Punkt fehlt:

```text
PHASE A = NOT PASS
```

---

# 14. PHASE B – BACKEND

Nach Phase-A-PASS analysieren:

* Models
* Manager
* QuerySets
* Views
* Forms
* URLs
* Services
* Utilities
* Business Logic
* Admin
* Signals
* Middleware
* Permissions

Relevante Referenzen verfolgen.

---

# 15. PHASE C – DATENMODELL

Analysieren:

* Entitäten
* Felder
* Primary Keys
* Foreign Keys
* Many-to-Many
* Constraints
* Unique-Regeln
* Migrationen
* IDs
* Statuswerte
* Datenbankstruktur
* SQLite-Datenbank, sofern für die Analyse relevant

Die tatsächliche Datenbankstruktur darf nicht allein aus Models abgeleitet werden.

---

# 16. PHASE D – FRONTEND

Analysieren:

* Templates
* Layouts
* Navigation
* HTMX
* JavaScript
* Tailwind
* Komponenten
* Formulare
* Tabellen
* Suche
* Filter
* Detailseiten
* Dialoge
* Fehlermeldungen
* Loading-Zustände

Tatsächliches Verhalten nachvollziehen.

Nicht nur Dateinamen dokumentieren.

---

# 17. PHASE E – FACHFUNKTIONEN

Vollständig analysieren:

* Benutzer
* Rechte
* Rollen
* Admin
* Werke
* Werk 1
* Werk 2
* Kunden
* Maschinen
* Werkzeuge
* Werkzeugtypen
* Werkzeug-ID-System
* Lager
* Lagerorte
* Schränke
* Schubladen
* Plätze
* Serienartikel
* PDF-Einrichtepläne
* Lager/Ersatz
* Ersatzstempel
* Matrizen
* Maschinenteile
* Ersatzteile
* Werkzeugbewegungen
* Versand
* Empfang
* Dokumente
* Statistik

Jede Funktion muss anhand tatsächlicher Implementierung untersucht werden.

---

# 18. PHASE F – UI-VERHALTEN

Relevante Benutzerabläufe nachvollziehen:

* Login
* Benutzeranlage
* Werkzeug suchen
* Werkzeug anlegen
* Werkzeug bearbeiten
* Werkzeug ausleihen
* Werkzeug zurückgeben
* Werkzeug versenden
* Werkzeug empfangen
* Lagerort ändern
* Serienartikel suchen
* PDF öffnen
* Lager/Ersatz suchen
* Lager/Ersatz anlegen
* Admin-Funktionen

Für jeden relevanten Workflow:

```text
Startpunkt
→ Benutzeraktion
→ URL/Endpoint
→ View/Handler
→ Form/Validation
→ Business Logic
→ Datenbank
→ Response
→ Template/Frontend
```

---

# 19. PHASE G – WIEDERVERWENDBARKEIT

Für jeden relevanten Bereich bewerten:

## ÜBERNEHMEN

Direkt oder nahezu direkt wiederverwendbar.

## TEILWEISE ÜBERNEHMEN

Fachliche Idee oder Teilkomponente ist wiederverwendbar, aber Anpassungen erforderlich.

## NEU IMPLEMENTIEREN

Altsystem ist nicht geeignet oder Anforderungen haben sich wesentlich geändert.

## NICHT ÜBERNEHMEN

Nicht relevant, veraltet, unsicher oder fachlich nicht mehr gewünscht.

Jede Bewertung muss begründet werden.

---

# 20. Altsystem vs. aktuelle Anforderungen

Nach Abschluss der technischen Analyse müssen Unterschiede dokumentiert werden.

Format:

| Bereich | Altsystem | Aktuelle Anforderung | Unterschied | Konsequenz | Offene Entscheidung |
| ------- | --------- | -------------------- | ----------- | ---------- | ------------------- |

Keine aktuelle Anforderung darf automatisch als Altsystemverhalten interpretiert werden.

Kein Altsystemverhalten darf automatisch als aktuelle Anforderung übernommen werden.

---

# 21. Dokumentationspflicht

Die Ergebnisse werden dauerhaft dokumentiert.

Primäres Dokument:

`D:\toolsync\docs\12-old-django-analysis.md`

Dokumentieren:

* technische Erkenntnisse
* fachliche Erkenntnisse
* Datenmodell
* Abhängigkeiten
* Benutzerabläufe
* Risiken
* Widersprüche
* offene Fragen
* Annahmen
* Migrationsprobleme
* wiederverwendbare Komponenten
* nicht wiederverwendbare Komponenten
* Coverage
* persistenter Status

---

# 22. Coverage-Anforderungen

Die Coverage muss mindestens folgende Bereiche enthalten:

| Bereich            | FOUND | READ | UNDERSTOOD | DOCUMENTED | Evidenz | Status |
| ------------------ | ----- | ---- | ---------- | ---------- | ------- | ------ |
| Projektstruktur    |       |      |            |            |         |        |
| Django Apps        |       |      |            |            |         |        |
| Models             |       |      |            |            |         |        |
| Migrationen        |       |      |            |            |         |        |
| Views              |       |      |            |            |         |        |
| Forms              |       |      |            |            |         |        |
| URLs               |       |      |            |            |         |        |
| Services           |       |      |            |            |         |        |
| Templates          |       |      |            |            |         |        |
| HTMX               |       |      |            |            |         |        |
| JavaScript         |       |      |            |            |         |        |
| Admin              |       |      |            |            |         |        |
| Authentifizierung  |       |      |            |            |         |        |
| Berechtigungen     |       |      |            |            |         |        |
| Werkzeuge          |       |      |            |            |         |        |
| Werkzeugtypen      |       |      |            |            |         |        |
| Werkzeug-ID-System |       |      |            |            |         |        |
| Lager              |       |      |            |            |         |        |
| Lagerorte          |       |      |            |            |         |        |
| Serienartikel      |       |      |            |            |         |        |
| PDF-Einrichtepläne |       |      |            |            |         |        |
| Lager/Ersatz       |       |      |            |            |         |        |
| Bewegungen         |       |      |            |            |         |        |
| Versand            |       |      |            |            |         |        |
| Empfang            |       |      |            |            |         |        |
| Dokumente          |       |      |            |            |         |        |
| Statistik          |       |      |            |            |         |        |
| Tests              |       |      |            |            |         |        |

Ein Bereich darf nur dann als vollständig analysiert gelten, wenn die tatsächlichen relevanten Dateien gelesen und die Zusammenhänge verstanden wurden.

---

# 23. Completion Gate für TASK-001

TASK-001 darf nur dann als:

```text
COMPLETED
```

markiert werden, wenn alle folgenden Punkte PASS sind:

* Projektstruktur verstanden
* relevante Django Apps analysiert
* relevante Models gelesen und verstanden
* Datenmodell und Migrationen analysiert
* relevante Views analysiert
* relevante Forms analysiert
* URLs nachvollzogen
* relevante Business Logic analysiert
* Templates analysiert
* HTMX analysiert
* JavaScript analysiert
* Admin analysiert
* Authentifizierung analysiert
* Berechtigungen analysiert
* Werkzeugverwaltung analysiert
* Werkzeugtypen analysiert
* Werkzeug-ID-System analysiert
* Lagerverwaltung analysiert
* Lagerorte analysiert
* Serienartikel analysiert
* PDF-Einrichtepläne analysiert
* Lager/Ersatz analysiert
* Werkzeugbewegungen analysiert
* Versand analysiert
* Empfang analysiert
* Dokumentverwaltung analysiert
* Statistik analysiert
* Tests analysiert
* relevante Benutzerabläufe nachvollzogen
* Wiederverwendbarkeit bewertet
* technische Risiken dokumentiert
* fachliche Risiken dokumentiert
* offene Fragen dokumentiert
* Widersprüche dokumentiert
* Coverage geprüft
* alle Statusangaben evidenzbasiert
* D:\Web wurde nicht verändert
* Analyseergebnisse persistent dokumentiert

Wenn auch nur ein Punkt fehlt:

```text
TASK-001 = NOT COMPLETED
```

---

# 24. Aktueller Arbeitsauftrag

Bei jeder Fortsetzung von TASK-001:

1. Lies zuerst den persistenten Status in `D:\toolsync\docs\12-old-django-analysis.md`.
2. Lies die vollständige Task-Datei `D:\toolsync\tasks\01-analyze-old-project.md`, bevor eine Analyseaktion durchgeführt wird.
3. Prüfe relevante Rules.
4. Prüfe relevante Projektdokumentation.
5. Ermittle den letzten nachweisbaren Status.
6. Vertraue nicht blind auf frühere Statusangaben.
7. Korrigiere unbelegte Statusangaben.
8. Bestimme den ersten offenen konkreten Analyseschritt.
9. Führe nur diesen nächsten kontrollierten Analyseschritt aus.
10. Lies die tatsächlich relevanten Dateien.
11. Verfolge relevante Referenzen.
12. Dokumentiere die Erkenntnisse.
13. Aktualisiere Coverage.
14. Aktualisiere offene Fragen.
15. Aktualisiere Risiken.
16. Aktualisiere Widersprüche.
17. Aktualisiere den persistenten Status.
18. Prüfe das aktuelle Phase-Gate.
19. Starte die nächste Phase nur bei PASS.

Wenn der Kontext zu groß wird:

1. Analyse stoppen.
2. Ergebnisse dokumentieren.
3. Coverage aktualisieren.
4. Status persistent speichern.
5. Nächsten kleinen Analyseabschnitt dokumentieren.
6. Keine Erkenntnisse verlieren.

---

# 25. Wichtigste Regel

## Erst vollständig verstehen.

## Dann dokumentieren.

## Dann vergleichen.

## Dann Zielarchitektur planen.

## Dann Implementierungsplan erstellen.

## Erst danach implementieren.

Keine Abkürzungen bei der Analyse.

Keine unbelegten Statusangaben.

Keine voreiligen Architekturentscheidungen.

Keine automatische Übernahme von Altsystemlogik.

Keine automatische Gleichsetzung von aktueller Anforderung und Altsystemverhalten.

**TASK-001 bleibt NOT COMPLETED, bis das Completion Gate vollständig PASS ist.**
