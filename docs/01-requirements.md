# ToolSync – Anforderungen

> Status: **Verbindliche Quelle für alle fachlichen Anforderungen.**
>
> Diese Datei beschreibt die aktuellen fachlichen Anforderungen. Sie ist die höchste fachliche Instanz nach den Entscheidungen des Projektinhabers und docs/13-decisions.md. Rangfolge: Abschnitt 20.

---

# 1. Projektziel

ToolSync soll ein modernes System zur Verwaltung und Nachverfolgung von Werkzeugen und zugehörigen Lager- und Betriebsprozessen werden.

Das System muss im Kern vollständig ohne SAP funktionieren.

SAP ist ausschließlich eine optionale spätere Integrationsmöglichkeit.

---

# 2. Benutzer und Login

## 2.1 Normale Benutzer

Normale Benutzer melden sich ausschließlich über ihre Personalnummer an.

Beispiel:

129100211

Für normale Benutzer gibt es keinen Passwort-Login.

Es gibt keine öffentliche Selbstregistrierung.

Ein Benutzer darf sich nicht selbst registrieren.

## 2.2 Benutzeranlage

Benutzer werden ausschließlich durch einen Admin angelegt.

Der Admin legt mindestens fest:

- Personalnummer
- Vorname
- Nachname
- Anzeigename
- Rolle
- Berechtigungen
- Aktivierungsstatus

Der Anzeigename soll den Vor- und Nachnamen des Benutzers darstellen.

Beispiel:

Max Mustermann

## 2.3 Admin

Der Admin besitzt einen eigenen geschützten Admin-Login.

Der Admin darf:

- Benutzer anlegen
- Benutzer bearbeiten
- Benutzer deaktivieren
- Rollen verwalten
- Berechtigungen verwalten
- Benutzerrechte zuweisen
- administrative Stammdaten verwalten

Normale Benutzer dürfen keine Benutzerkonten erstellen.

Normale Benutzer dürfen ihre Berechtigungen nicht selbst verändern.

## 2.4 Sicherheit

Die fachliche Anforderung für normale Benutzer lautet:

> Login ausschließlich über Personalnummer ohne Passwort.

Die technische Umsetzung muss trotzdem angemessene Sicherheit gewährleisten.

Die technische Lösung darf die fachliche Anforderung nicht eigenmächtig in einen Passwort- oder PIN-Login ändern.

Die endgültige technische Sicherheitsarchitektur wird separat dokumentiert.

---

# 3. Werke und Standorte

ToolSync muss mehrere Werke bzw. organisatorische Standorte unterstützen.

Beispielsweise:

- Werk 1
- Werk 2

Ein Lagerort gehört eindeutig zu einem Werk.

Werkzeuge und Bestände müssen einem sinnvollen Standort bzw. Lagerort zugeordnet werden können.

Die genaue Struktur wird im Domain Model festgelegt.

---

# 4. Werkzeugverwaltung

ToolSync muss Werkzeuge verwalten können.

Ein Werkzeug kann unter anderem folgende Informationen besitzen:

- eindeutige oder erlaubte mehrfach verwendbare ID
- Werkzeugtyp
- Bezeichnung
- Status
- Standort
- Werk
- Lagerort
- weitere fachliche Eigenschaften

Die endgültigen Felder werden nach der Analyse der Anforderungen und des Altsystems festgelegt.

Geschäftsregeln müssen serverseitig durchgesetzt werden.

---

# 5. Werkzeugtypen

Matrizen sind keine Werkzeugtypen.

Abstreifer sind keine Werkzeugtypen.

Werkzeugtypen beschreiben konkrete Werkzeugarten.

Beispiele:

- Rund
- Quadrat
- Umformstempel
- Rollwerkzeug
- Kantwerkzeug

Weitere Werkzeugtypen müssen möglich sein.

## 5.1 Typ-Code

Werkzeugtypen können einen eindeutigen Typ-Code besitzen.

Beispiel:

•1 Rund

•2 Quadrat

Die fachliche Bezeichnung soll als Kombination aus Code und Bezeichnung dargestellt werden können.

Beispiel:

•1 Rund

Die neue Anwendung soll nicht automatisch die Darstellung:

Typ-Code: 01

und separat:

Typ: Rund

verwenden, wenn dies fachlich nicht erforderlich ist.

## 5.2 Werkzeug-ID

Ein Beispiel einer möglichen ID-Struktur ist:

•1075000

Dabei kann der Anfang der ID auf einen Werkzeugtyp verweisen.

Beispielsweise könnte:

•1

für:

Rund

stehen.

Die endgültige ID-Logik wird in docs/13-decisions.md entschieden.

---

# 6. Serienartikel

Serienartikel sind PDF-basierte Einrichtepläne.

Der Serienartikel-Bereich ist ein eigener Bereich bzw. Block innerhalb der Anwendung.

## 6.1 Funktionen

Benutzer sollen Serienartikel über eine Suchleiste suchen können.

Die Anwendung soll vorhandene Serienartikel-PDFs auflisten.

Ein Benutzer soll eine PDF auswählen und öffnen bzw. anzeigen können.

Je nach Berechtigung können PDFs hochgeladen, ersetzt oder gelöscht werden.

## 6.2 Inhalt der PDF

Ein Einrichteplan kann beispielsweise enthalten:

- Programmname
- Bearbeitungszeit
- benötigte Werkzeug-IDs
- Anzahl der Hübe
- Material
- Maschine
- weitere Einrichtinformationen

Diese Informationen sind zunächst Bestandteil des PDF-Dokuments.

Sie müssen nicht automatisch als strukturierte Datenfelder in der Datenbank gespeichert werden.

Die PDF ist die primäre Informationsquelle.

## 6.3 Keine automatische Strukturierung

ToolSync soll beim ersten Entwicklungsstand nicht automatisch den Inhalt einer PDF vollständig analysieren und in einzelne Datenbankfelder umwandeln.

Eine spätere PDF-Inhaltsanalyse ist eine mögliche Erweiterung.

---

# 7. Lager / Ersatz

Lager / Ersatz ist ein eigener Bereich bzw. Block innerhalb der Anwendung.

Der Bereich besitzt eine Suchleiste.

Dort können beispielsweise verwaltet werden:

- Ersatzstempel
- Matrizen
- Maschinenteile
- Ersatzteile
- weitere Lagerobjekte

## 7.1 ID-Regel

Beim Anlegen eines Lager-/Ersatzobjekts soll eine Option vorhanden sein:

Gleiche ID mehrfach zulassen

Wenn die Checkbox aktiviert ist:

- dieselbe ID darf bei mehreren Objekten verwendet werden.

Wenn die Checkbox deaktiviert ist:

- die ID muss eindeutig sein.

Die Regel muss sowohl im Backend als auch im Datenmodell korrekt berücksichtigt werden.

## 7.2 Lagerplatz

Ein konkreter Lagerplatz darf nicht gleichzeitig mehrfach belegt sein, sofern dies fachlich ausgeschlossen ist.

Die Lagerplatzlogik muss eindeutig definiert und serverseitig abgesichert werden.

---

# 8. Bestand

ToolSync muss Bestände verwalten können.

Dabei muss zwischen verschiedenen fachlichen Arten der Bestandsführung unterschieden werden können.

Mögliche Fälle:

- einzelne identifizierbare Werkzeuge
- Werkzeuge mit individueller Seriennummer
- Mengenbestand
- Ersatzteile
- Lagerobjekte

Die genaue Modellierung wird im Domain Model festgelegt.

---

# 9. Ausleihe

Werkzeuge sollen ausgeliehen werden können.

Eine Ausleihe muss nachvollziehbar sein.

Mindestens relevante Informationen sind:

- welcher Benutzer
- welches Werkzeug
- Zeitpunkt
- Status
- Ausgangsort
- gegebenenfalls Zielort

Ein Werkzeug, das bereits ausgeliehen ist, darf nicht gleichzeitig erneut ausgeliehen werden, sofern die fachliche Domäne keine Ausnahme vorsieht.

Die Ausleihlogik muss serverseitig geprüft werden.

---

# 10. Rückgabe

Werkzeuge sollen zurückgegeben werden können.

Eine Rückgabe muss nachvollziehbar sein.

Dabei können relevant sein:

- Benutzer
- Werkzeug
- Zeitpunkt
- Rückgabeort
- vorheriger Status
- neuer Status

Die Historie der Bewegungen soll nachvollziehbar bleiben.

---

# 11. Werkzeugbewegungen

ToolSync soll relevante Bewegungen von Werkzeugen nachvollziehbar speichern können.

Dazu können gehören:

- Ausleihe
- Rückgabe
- Standortwechsel
- Lagerplatzwechsel
- Statusänderung

Die genaue Modellierung wird nach Analyse des Altsystems und der aktuellen Anforderungen festgelegt.

---

# 12. Status

Werkzeuge und Lagerobjekte können unterschiedliche Status besitzen.

Beispielsweise:

- verfügbar
- ausgeliehen
- defekt
- in Reparatur
- nicht verfügbar

Die endgültige Statusliste wird im Domain Model festgelegt.

Statuswechsel müssen fachlich nachvollziehbar sein.

---

# 13. Suche

Relevante Bereiche sollen eine Suchfunktion besitzen.

Insbesondere:

- Serienartikel
- Lager / Ersatz
- Werkzeuge

Die Suche soll für Benutzer verständlich und performant sein.

Bei großen Datenmengen sollen Pagination und Filter berücksichtigt werden.

---

# 14. Admin-Bereich

Der Admin-Bereich muss Funktionen zur Verwaltung administrativer Daten bereitstellen.

Dazu gehören mindestens:

- Benutzer
- Rollen
- Berechtigungen
- Werkzeugtypen
- relevante Stammdaten
- gegebenenfalls Werke
- gegebenenfalls Lagerorte

Nur berechtigte Benutzer dürfen administrative Funktionen verwenden.

---

# 15. Rollen und Berechtigungen

ToolSync benötigt eine serverseitig durchgesetzte Berechtigungsstruktur.

Berechtigungen dürfen nicht ausschließlich durch das Frontend kontrolliert werden.

Das Ausblenden eines Buttons ist keine Sicherheitsmaßnahme.

Geschützte API-Endpunkte müssen Authentifizierung und Autorisierung serverseitig prüfen.

Der Admin verwaltet die Rechteverteilung.

---

# 16. SAP

SAP ist optional.

Alle Kernfunktionen müssen ohne SAP funktionieren.

SAP darf keine Voraussetzung für:

- Login
- Benutzerverwaltung
- Werkzeugverwaltung
- Werkzeugtypen
- Lager
- Lagerorte
- Bestand
- Ausleihe
- Rückgabe
- Serienartikel

sein.

Eine spätere SAP-Integration soll über einen klar getrennten Integration Layer erfolgen.

---

# 17. Architektur

Der verbindliche technische Stack ist:

Frontend:

- React 19
- SPA
- TypeScript
- Vite
- Tailwind CSS v4
- Eigene CSS-Klassenschicht (`index.css` für Glas, `admin.css` für Split-Tone)
- Kein UI-Framework, kein shadcn/ui

Backend:

- FastAPI
- Pydantic
- SQLAlchemy

Datenbank:

- PostgreSQL

Tests:

- Pytest
- Playwright für kritische End-to-End-Flows

Verbindliche Quelle für Architekturfragen ist docs/14-architecture.md.

---

# 18. Datenbank

Die Datenbank soll fachliche Beziehungen sauber abbilden.

Insbesondere:

- Benutzer
- Rollen
- Berechtigungen
- Werke
- Lagerorte
- Werkzeugkategorien
- Werkzeugtypen
- Werkzeuge
- Bestände
- Lager-/Ersatzobjekte
- Serienartikel-Dokumente
- Ausleihen
- Rückgaben
- Bewegungen

Schemaänderungen müssen über nachvollziehbare Migrationen erfolgen.

Kritische Constraints wie Eindeutigkeit müssen auf Datenbank- und/oder Backend-Ebene abgesichert werden.

---

# 19. Frontend und UX

Die Anwendung soll übersichtlich und verständlich sein.

Besondere Bereiche sollen als klar erkennbare Blöcke bzw. Module dargestellt werden.

Mindestens relevant:

- Werkzeuge
- Serienartikel
- Lager / Ersatz
- Ausleihe
- Rückgabe
- Administration

Formulare müssen verständliche Validierungen besitzen.

Aktionen müssen dem Benutzer eine klare Rückmeldung geben.

Loading-, Leer- und Fehlerzustände müssen berücksichtigt werden.

Admin-Funktionen müssen von normalen Benutzerfunktionen getrennt werden.

---

# 20. Priorität bei Widersprüchen

Bei Widersprüchen gilt:

1. Aktuelle explizite Anforderung des Projektinhabers
2. Aktuelle Projektentscheidung
3. Aktuelle Requirements
4. Projektvision
5. weitere Projektdokumentation
6. Analyse des Altsystems
7. technische Empfehlung

---

# 21. Akzeptanzkriterien

Eine Anforderung gilt erst als ausreichend verstanden, wenn:

- die fachliche Bedeutung geklärt ist,
- die relevante Altimplementierung untersucht wurde, sofern vorhanden,
- Abweichungen dokumentiert wurden,
- offene Fragen dokumentiert wurden,
- die Zielentscheidung dokumentiert wurde.

---

# 22. Ziel

Das Ergebnis der Requirements- und Altsystemanalyse soll eine belastbare Grundlage schaffen für:

1. Domain Model
2. Zielarchitektur
3. Security-Konzept
4. Datenbankmodell
5. API-Konzept
6. Frontend-Konzept
7. Implementierungs-Roadmap
8. spätere Migration

Die Entwicklung darf erst auf dieser Grundlage systematisch beginnen.
