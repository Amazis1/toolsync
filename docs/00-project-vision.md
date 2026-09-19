# ToolSync – Projektvision

## 1. Zweck des Projekts

ToolSync ist eine moderne Anwendung zur Verwaltung und Nachverfolgung von Werkzeugen, Werkzeugbeständen, Lagerorten, Ausleihen, Rückgaben und zugehörigen Dokumenten.

Das Ziel ist ein wartbares, verständliches und robustes System, das im täglichen Betrieb vollständig ohne SAP funktionieren kann.

Das System wird ausschließlich unter D:\toolsync entwickelt.

---

## 2. Grundprinzip

Die Anwendung wird auf Grundlage von:

1. den aktuellen fachlichen Anforderungen,
2. den Entscheidungen des Projekts,
3. den Vorgaben der Continue Rules,
4. technischen Anforderungen

geplant.

Bei Widersprüchen gilt die Rangfolge in Abschnitt 16 „Source of Truth".

---

## 3. Projektverzeichnis

### Aktives Projekt

D:\toolsync

Dieses Verzeichnis ist das aktive Entwicklungsprojekt.

Hier dürfen neue Dateien erstellt und bestehende Dateien geändert werden.

Außerhalb dieses Verzeichnisses wird nichts geschrieben.

---

## 4. SAP

SAP ist optional.

ToolSync muss vollständig ohne SAP funktionieren.

Die Kernfunktionen dürfen nicht von SAP abhängig sein.

Dazu gehören insbesondere:

- Login
- Benutzerverwaltung
- Rollen und Berechtigungen
- Werkzeuge
- Werkzeugtypen
- Werkzeugverwaltung
- Lager
- Lagerorte
- Bestände
- Ausleihe
- Rückgabe
- Werkzeugbewegungen
- Serienartikel-PDFs

Eine spätere SAP-Integration kann über einen klar getrennten Integration Layer erfolgen.

SAP darf keine Voraussetzung für die Nutzung des Systems sein.

---

## 5. Login und Benutzerverwaltung

### Normale Benutzer

Die Anmeldung normaler Benutzer erfolgt ausschließlich über die Personalnummer.

Beispiel:

129100211

Normale Benutzer verwenden für den Login kein Passwort.

Es gibt keine öffentliche Selbstregistrierung.

Ein normaler Benutzer kann sich nicht selbst registrieren.

Benutzer werden ausschließlich durch einen Admin angelegt.

Der Admin legt mindestens fest:

- Personalnummer
- Vorname
- Nachname
- Anzeigename
- Rollen
- Berechtigungen
- Status des Benutzers

Der Anzeigename wird aus Vorname und Nachname gebildet bzw. entsprechend der Admin-Konfiguration gespeichert.

Nach erfolgreicher Anmeldung wird der Benutzer mit seinem Anzeigenamen, beispielsweise Vorname und Nachname, dargestellt.

### Admin

Der Admin verfügt über einen eigenen geschützten Admin-Login.

Der Admin ist für die Verwaltung von Benutzern, Rollen und Berechtigungen verantwortlich.

Normale Benutzer dürfen keine Benutzerkonten selbst anlegen.

Normale Benutzer dürfen ihre eigenen Berechtigungen nicht verändern.

### Technische Sicherheit

Die fachliche Anforderung lautet:

Normale Benutzer melden sich über ihre Personalnummer ohne Passwort an.

Die konkrete technische Umsetzung muss sicher entworfen werden.

Die technische Sicherheitsarchitektur darf die fachliche Anforderung nicht eigenmächtig in einen Passwort- oder PIN-Login umwandeln.

---

## 6. Werkzeugverwaltung

Werkzeuge sind verwaltete Objekte innerhalb von ToolSync.

Werkzeuge können unterschiedliche Eigenschaften besitzen.

Wichtig ist eine klare Trennung zwischen:

- Werkzeug
- Werkzeugkategorie
- Werkzeugtyp
- Werkzeug-ID
- Standort
- Werk
- Lagerort
- Status
- Bestand

Geschäftslogik darf nicht ausschließlich im Frontend liegen.

Kritische Regeln müssen serverseitig abgesichert werden.

---

## 7. Werkzeugtypen

Matrize ist kein Werkzeugtyp.

Abstreifer ist kein Werkzeugtyp.

Diese Begriffe dürfen nicht automatisch als Werkzeugtypen modelliert werden.

Werkzeugtypen beschreiben konkrete Werkzeugarten.

Beispiele:

- Rund
- Quadrat
- Umformstempel
- Rollwerkzeug
- Kantwerkzeug

Weitere Werkzeugtypen sind möglich.

Werkzeugtypen können einen eindeutigen Typ-Code besitzen.

Beispiel:

•1 Rund

•2 Quadrat

Die fachliche Darstellung soll dabei als kombinierte Bezeichnung verstanden werden:

•1 Rund

und nicht automatisch als fachliche Darstellung:

Typ-Code: 01

Typ: Rund

wenn dies nicht ausdrücklich gewünscht ist.

### Beispiel Werkzeug-ID

Eine Werkzeug-ID wie:

•1075000

ist als Beispiel einer möglichen ID-Struktur zu verstehen.

Dabei kann beispielsweise •1 für den Werkzeugtyp Rund stehen.

Die endgültige ID-Logik von ToolSync wird in docs/13-decisions.md entschieden.

---

## 8. Serienartikel

Ein Serienartikel ist in ToolSync zunächst ein PDF-basierter Einrichteplan.

Der Serienartikel-Bereich ist ein eigener Bereich bzw. Block der Anwendung.

Der Benutzer kann dort:

- Serienartikel suchen
- vorhandene Serienartikel auflisten
- einen Serienartikel auswählen
- die zugehörige PDF öffnen bzw. anzeigen

Die PDFs können beispielsweise Informationen enthalten über:

- Programmname
- Laufzeit der Bearbeitung
- benötigte Werkzeug-IDs
- Anzahl der Hübe
- Material
- Maschine
- weitere Einrichtinformationen

Diese Informationen sind zunächst Bestandteil des PDF-Dokuments.

Sie werden nicht automatisch als separate strukturierte Datenfelder des Serienartikels in der Datenbank modelliert.

Die PDF ist die eigentliche Informationsquelle.

Die Anwendung verwaltet zunächst die Dokumente und ermöglicht deren Suche und Anzeige.

Eine spätere strukturierte Auswertung des PDF-Inhalts ist eine separate mögliche Erweiterung und darf nicht ohne Entscheidung eingeführt werden.

---

## 9. Lager / Ersatz

Lager / Ersatz ist ein eigener Bereich bzw. Block der Anwendung.

Der Bereich besitzt eine Suchfunktion.

Dort können sich beispielsweise befinden:

- Ersatzstempel
- Matrizen
- Maschinenteile
- Ersatzteile
- weitere Lager- oder Ersatzobjekte

Beim Anlegen eines Objekts kann der Admin festlegen, ob die gleiche ID mehrfach verwendet werden darf.

Beispiel:

Gleiche ID mehrfach zulassen

Wenn die Option aktiviert ist:

Eine ID darf bei mehreren Objekten vorkommen.

Wenn die Option deaktiviert ist:

Die ID muss eindeutig sein.

Die ID-Eindeutigkeit muss im Backend und Datenmodell korrekt abgesichert werden.

Unabhängig von der ID-Regel darf ein konkreter Lagerplatz nicht gleichzeitig doppelt belegt sein, wenn dies fachlich ausgeschlossen ist.

---

## 10. Werke und Lagerorte

ToolSync kann mehrere Werke bzw. organisatorische Standorte verwalten.

Beispielsweise:

- Werk 1
- Werk 2

Lagerorte gehören zu einem bestimmten Werk.

Die Beziehungen zwischen:

- Werk
- Lager
- Lagerort
- Werkzeug
- Bestand

müssen eindeutig modelliert werden.

---

## 11. Ausleihe und Rückgabe

Werkzeuge können ausgeliehen und zurückgegeben werden.

Die Bewegungen müssen nachvollziehbar sein.

Mindestens relevante Informationen können sein:

- Benutzer
- Werkzeug
- Zeitpunkt
- Aktion
- Ausgangsort
- Zielort
- Status

Die genaue Modellierung wird nach Analyse der Anforderungen festgelegt.

Kritische Geschäftsregeln müssen serverseitig geprüft werden.

Beispielsweise darf ein bereits ausgeliehenes Werkzeug nicht erneut gleichzeitig ausgeliehen werden, sofern die Domäne dies nicht ausdrücklich erlaubt.

---

## 12. Rollen und Berechtigungen

ToolSync besitzt ein rollen- und berechtigungsbasiertes Zugriffssystem.

Admin-Funktionen sind nur für berechtigte Benutzer verfügbar.

Das Ausblenden eines Buttons im Frontend ist keine ausreichende Sicherheitsmaßnahme.

Jeder geschützte Backend-Endpunkt muss serverseitig Authentifizierung und Autorisierung prüfen.

Die Rechteverteilung erfolgt durch den Admin.

---

## 13. Technischer Stack

Der verbindliche technische Stack ist:

Frontend:

- React 19 SPA
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
- Playwright

Verbindliche Quelle für Architekturfragen ist docs/14-architecture.md.

Das System besitzt eine klare Trennung zwischen:

- Frontend
- API
- Business Logic
- Persistenz
- Datenbank
- optionalen Integrationen

---

## 14. Datenbank

PostgreSQL ist die vorgesehene zentrale Datenbank.

Datenbankänderungen müssen versioniert und nachvollziehbar sein.

Schemaänderungen erfolgen über Migrationen.

Geschäftslogik soll nicht ausschließlich in Datenbank-Triggern versteckt werden.

Kritische fachliche Regeln müssen im Backend abgesichert werden.

---

## 15. Frontend

Das Frontend ist als SPA umgesetzt.

Verbindlich:

- React 19
- TypeScript
- Vite
- Tailwind CSS v4

Das Design ist verbindlich in zwei getrennten Systemen festgelegt:

| Bereich | System | Quelle |
|---|---|---|
| Haupt-Frontend | Glas | `frontend/src/index.css`, Klassen `.ui-*`, `.app-*`, `.glass-*` |
| AdminPanel | Split-Tone Operational | `frontend/src/admin.css`, Klassen `.admin-*` |

Die beiden Systeme dürfen nicht vermischt werden.

Details: docs/15-ui-styleguide.md

---

## 16. Source of Truth

Bei widersprüchlichen Informationen gilt folgende Priorität:

1. Aktuelle explizite Anforderungen des Projektinhabers
2. Aktuelle Projektentscheidungen in docs/13-decisions.md
3. Aktuelle Anforderungen in docs/01-requirements.md
4. Weitere ToolSync-Dokumentation
5. Continue Rules
6. Technische Empfehlungen des AI-Modells

Keine Stufe darf eine höhere Stufe automatisch überschreiben.

---

## 17. Entwicklung

Neue Entwicklung findet ausschließlich unter:

D:\toolsync

statt.

Vor größeren Architekturentscheidungen soll zunächst geprüft werden:

- aktuelle Anforderungen
- bestehende Dokumentation
- bestehende Implementierung
- Auswirkungen
- Tests

Keine unnötigen Änderungen ohne nachvollziehbaren Grund.

---

## 18. Zusammenarbeit mit den Werkzeugen

Continue soll zuerst verstehen und analysieren und erst danach Änderungen planen oder durchführen.

Für komplexe Aufgaben gilt diese Reihenfolge:

Analyse
-> Plan
-> Prüfung
-> Umsetzung
-> Tests

Plan Mode ist READ-ONLY und wird für Lesen, Suchen und Planen verwendet.

Die Umsetzung beginnt erst, wenn eine ausreichende Grundlage vorhanden ist.

Bei großen Aufgaben wird der Kontext in kleinere logisch zusammenhängende Phasen aufgeteilt.

Das Modell darf nicht unnötig mit der gesamten Codebase gleichzeitig überladen werden.

Schreibende Befehle dürfen ausschließlich unter D:\toolsync wirken.

---

## 19. Ziel

ToolSync soll ein verständliches, robustes und wartbares Werkzeugverwaltungssystem werden.

Das System soll im Kern vollständig ohne SAP funktionieren.

Die fachlichen Anforderungen aus docs/01-requirements.md haben Vorrang vor technischen Empfehlungen.
