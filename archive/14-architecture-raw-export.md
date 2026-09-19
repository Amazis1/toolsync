TASK-004 Teil 1 – Frontend und Backend
Beide Dokumente sind gelesen. Die Vorgaben sind durch DEC-041 (Frontend) sowie die Gap-Analyse (Abschnitt 4, „Nächste Schritte") abgedeckt. Nachfolgend die Zieltechnologien mit kurzer Begründung.

1. Frontend
Technologie	Begründung (kurz)
React 19	Verbindlich durch DEC-041. Moderne, weit verbreitete SPA-Bibliothek; klare Trennung von UI, State und API-Client.
TypeScript	Typsicherheit für API-Aufrufe und Komponenten; weniger Laufzeitfehler, besser wartbar (besonders für weniger erfahrene Entwickler).
Vite	Schneller Dev-Server und Build; Standard-Setup für React-SPAs, wenig Konfigurationsaufwand.
Tailwind CSS v4	Verbindlich durch DEC-041. Utility-First; erlaubt schnelles, konsistentes Styling und responsives Design ohne eigene CSS-Dateien.
shadcn/ui	Fertige, wiederverwendbare UI-Komponenten auf Tailwind-Basis; verhindert Copy-Paste und liefert konsistente Loading-/Leer-/Fehlerzustände.
Begründung im Projektkontext: Die alte Django-Template-/HTMX-/Alpine-Lösung wird bewusst abgelöst (Gap-Analyse: „komplett andere Technologie, Neuentwicklung"). Die bestehende 4-Tab-/Block-Struktur (Werkzeug, Serienartikel, Info/Hilfe, Lager/Ersatz) bleibt erhalten, wird aber als React-SPA neu aufgebaut. Admin- und Benutzer-UI werden nach Rechten getrennt; Rechteprüfung erfolgt zusätzlich immer serverseitig (DEC-004).

2. Backend
Technologie	Begründung (kurz)
FastAPI 0.115+	Moderne, typsichere REST-API; automatische OpenAPI-Dokumentation; schlanke Router. Verbindlich laut Projektvision.
SQLAlchemy 2.0 (async)	ORM für PostgreSQL; 2.0-Style mit async passt zur asynchronen FastAPI-Architektur; klare Modelle und Beziehungen.
Pydantic V2	Request-/Response-Validierung; konsistente, verständliche Fehlerantworten (4xx/5xx) mit klaren Messages.
PostgreSQL	System of Record; stabile, versionierte Datenhaltung. (In der Entwicklung optional SQLite – siehe Gap-Analyse Abschnitt 4.)
Alembic	Versionierte Migrationen (DEC-044); jede Schema-Änderung nachvollziehbar.
Begründung im Projektkontext: Die Geschäftslogik liegt im Backend (Services/Use-Cases), nicht nur im Frontend (DEC-004/021: einfach & robust). Auth ist an allen geschützten Routen aktiv. SAP wird ausschließlich über einen getrennten Integration Layer angebunden, damit der Kernbetrieb ohne SAP vollständig funktioniert (DEC-001/042).

3. Kurzzusammenfassung
Frontend: React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (SPA, getrennte Admin-/Benutzer-UI).
Backend: FastAPI 0.115+ + SQLAlchemy 2.0 (async) + Pydantic V2 + PostgreSQL (+ Alembic für Migrationen).
Kernregeln: Geschäftslogik im Backend, serverseitige Berechtigungsprüfung, SAP-freier Core, einfache und robuste Umsetzung.
Hinweis: Die endgültige Festlegung der Zielarchitektur ist Teil der laufenden Analyse-/Planungsphase (DEC-025/027). Diese Technologien sind als verbindliche Zielrichtung gesetzt; feingranulare Architekturentscheidungen (z. B. genaues Security-Konzept für den passwortlosen Personalnummer-Login) folgen in TASK-006.

Datei 13-decisions.md gelesen. Die relevanten Entscheidungen (DEC-030 bis DEC-038, DEC-045) sind erfasst. Hier die Ausgabe für TASK-004 Teil 2.

1. AUTHENTIFIZIERUNG
1.1 Normale User – Personalnummer-Login (kein Passwort)
Grundlage: DEC-002, DEC-030

Punkt	Festlegung
Identifier	Personalnummer (eindeutig), z. B. 129100211
Passwort	Kein Passwort, kein PIN, keine Ersatzkonstruktion
Technische Umsetzung	JWT (JSON Web Token) mit kurzer Lebensdauer
Selbstregistrierung	Nicht möglich (Benutzer werden nur vom Admin angelegt)
Anzeigename	Vorname + Nachname (z. B. „Max Mustermann")
Wichtig: Die technische Sicherheitslösung darf die fachliche Vorgabe „kein Passwort" nicht eigenmächtig in ein Passwort-/PIN-Login umwandeln (DEC-002). Das konkrete Security-Konzept (z. B. wie das Token ohne Passwort sicher ausgestellt wird) wird separat in TASK-006 ausgearbeitet.

1.2 Admin – eigener, getrennter Login
Grundlage: DEC-031

Punkt	Festlegung
Login	Personalnummer + Passwort (klassische Authentifizierung)
UI	Getrennte Benutzeroberfläche für administrative Funktionen
Abgrenzung	Vom normalen Benutzer-Login klar getrennt
1.3 Serverseitige Autorisierung
Grundlage: DEC-004, DEC-033

Jeder geschützte Endpunkt prüft Berechtigungen serverseitig.
Frontend-Prüfungen (z. B. Buttons ausblenden) sind keine Sicherheitsmaßnahme.
Rollen- und Berechtigungssystem wird im Backend durchgesetzt.
Rollen (Mindestumfang, DEC-033):

Rolle	Rechte
Admin	Volle Rechte
Mitarbeiter	Standardrechte, kann Werkzeuge verwalten
Gast	Nur Leserechte (falls benötigt)
Die genaue Ausprägung der Berechtigungen wird in TASK-006 definiert.

2. ADMIN-PANEL
Grundlage: DEC-031, DEC-032, DEC-033, DEC-034, DEC-045

Punkt	Festlegung
Technologie	Eigenes React-Admin-Panel (kein Django Admin)
Zugang	Getrennter Admin-Login (Personalnummer + Passwort)
Sicherheit	Alle Admin-Funktionen serverseitig abgesichert
Verwaltungsumfang:

Benutzer – Anlegen, Bearbeiten, Deaktivieren (DEC-003, DEC-032)
Personalnummer (eindeutig), Vorname, Nachname, Anzeigename
Rolle, Berechtigungen, Aktivierungsstatus
Rollen & Berechtigungen – Zuordnung und Verwaltung (DEC-033)
Werkzeugtypen – Stammdaten anlegen/bearbeiten, eindeutige Bezeichnung Code + Name (DEC-034)
Kunden (Customer) – Stammdaten
Maschinen (Machine) – Stammdaten
Werke (Plant) – Stammdaten
Lagerstruktur – Cabinet → Drawer → Position → StorageLocation (DEC-045)
Hinweis: Kunden und Maschinen sind in der Domain-Modell-Erweiterung (DEC-045) als Entitäten vorgesehen; die exakten Verwaltungsdetails/Felder werden in TASK-006 finalisiert.

3. DOMAIN-MODELL
Grundlage: DEC-045 (verbindliche Erweiterung), ergänzt durch DEC-033 bis DEC-037 und DEC-040.

3.1 Stammdaten
Entität	Beschreibung	Wesentliche Felder
Plant	Werk / Standort	Name, eindeutige Kennung
Customer	Kunde	Name, Stammdaten
Machine	Maschine (relevant u. a. für Serienartikel-PDFs)	Bezeichnung, ggf. Werk-Zuordnung
ToolType	Werkzeugtyp (z. B. Rundstempel, Quadratstempel, Umformstempel)	name (eindeutiger String mit mehrstelligem Typ-Code + Bezeichnung, keine getrennte Code-/Name-Spalte)
Wichtig zu ToolType (DEC-034):

Bezeichnung enthält Typ-Code + Bezeichnung als zusammenhängenden String (z. B. 010 Rund – konkrete Zuordnung der Codes zu Typen noch offen).
Keine separate Trennung in code und name.
Matrize und Abstreifer sind keine Werkzeugtypen, sondern Kategorien.
3.2 Lagerstruktur (DEC-045, aus Altsystem übernommen)
Hierarchie: Plant → Cabinet → Drawer → Position → StorageLocation

Entität	Beschreibung
Cabinet	Schrank (gehört zu einem Werk)
Drawer	Schublade (gehört zu einem Schrank)
Position	Position innerhalb der Schublade
StorageLocation	Konkreter Lagerort (Endpunkt der Hierarchie)
3.3 Werkzeug (Tool)
Grundlage: DEC-035, DEC-036, DEC-037, DEC-040

Feld	Typ	Beschreibung
id	PK	Interner Primärschlüssel
tool_id	string	Werkzeug-ID, manuell eingegeben (z. B. 01056000) oder aus SAP übernommen
tool_type_id	FK	Zuordnung zum Werkzeugtyp
category	string/enum	Kategorie: Stempel / Abstreifer / Matrize
plant_id	FK	Zugeordnetes Werk
storage_location_id	FK	Aktueller Lagerort
is_storage	bool	true = Lager-/Ersatz-Objekt
allow_duplicate_id	bool	Checkbox „Gleiche ID mehrfach zulassen"
status	string/enum	Zustand (für Statusänderung/Bewegung)
created_at / updated_at	timestamp	Zeitstempel
ID-Eindeutigkeit (DEC-035):

Eindeutig pro Werk (Plant) + Kategorie bei normalen Werkzeugen.
Bei is_storage=True ist die ID nicht eindeutig (mehrfach erlaubt).
Bestandsmodellierung (DEC-037):

Mehrfachobjekte werden als eigene Datensätze gespeichert.
Kein storage_count-Zähler (wie im Altsystem).
Bestandsmenge = Anzahl der Datensätze mit derselben ID.
3.4 Bewegung (ToolMovement)
Grundlage: DEC-040

Punkt	Festlegung
Bewegungsarten	Ausleihe, Rückgabe, Standortwechsel (Werk 1 ↔ Werk 2), Lagerplatzwechsel, Statusänderung
Historie	Jede Bewegung mit Benutzer, Zeitstempel, Status
Nachvollziehbarkeit	Vollständig nachvollziehbar (Audit-Trail)
Vorgeschlagene Felder (INFERRED – Finalisierung in TASK-006):

id, tool_id (FK), user_id (FK), movement_type, from_* / to_*, status, timestamp
3.5 Benutzer, Rollen, Berechtigungen
Grundlage: DEC-045, DEC-032, DEC-033

Entität	Felder / Beschreibung
User	personal_number (eindeutig), first_name, last_name, is_active, is_admin
Role	name, permissions (Zuordnung)
Permission	name, codename
Rollen: Admin, Mitarbeiter, Gast (DEC-033).
Berechtigungen werden serverseitig geprüft.
3.6 Serienartikel (SerialArticle)
Grundlage: DEC-038, DEC-045

Feld	Beschreibung
id	PK
article_number	Artikelnummer
description	Beschreibung
pdf_path	Pfad zur PDF-Datei
metadata	Zusätzliche Metadaten (optional, zunächst nicht strukturiert)
Wichtig (DEC-038):

Serienartikel sind PDF-Dokumente (Einrichtepläne).
Metadaten (Programmname, Bearbeitungszeit etc.) werden zunächst NICHT strukturiert gespeichert.
Funktionen: Suche, Liste, PDF öffnen/anzeigen; optional Upload/Ersetzen/Löschen.
Kurz-Zusammenfassung
Auth: Normale User = Personalnummer ohne Passwort via JWT; Admin = Personalnummer + Passwort; serverseitige Autorisierung auf allen Endpunkten.
Admin-Panel: Eigenes React-Panel zur Verwaltung von Benutzern, Rollen, Werkzeugtypen, Kunden, Maschinen, Werken und Lagerstruktur.
Domain: Plant/Customer/Machine/ToolType → Lagerhierarchie (Cabinet→Drawer→Position→StorageLocation) → Tool → ToolMovement; dazu User/Role/Permission und SerialArticle.
Offen für TASK-006: exakte Felddefinitionen (insb. Tool, Customer, Machine), Berechtigungs-Detailmodell und das Security-Konzept für den passwortlosen JWT-Login.

Basiert auf den bisherigen Entscheidungen (insb. DEC-001, DEC-004, DEC-010, DEC-033 bis DEC-038, DEC-040, DEC-043 bis DEC-046). Hier die Ausgabe für TASK-004 Teil 3.

1. API-STRUKTUR
1.1 Grundsatz
RESTful API mit klaren Ressourcen und HTTP-Verben.
Geschäftslogik im Backend (Services/Use-Cases), Router schlank halten.
Auth an allen geschützten Routen; Berechtigungen serverseitig durchgesetzt (DEC-004).
Fehler: 4xx bei ungültigen Eingaben mit klarer Message, 5xx bei Serverfehlern (ohne sensible Details nach außen).
SAP nicht als Abhängigkeit in den Kern-Endpunkten; später nur über Integration Layer (DEC-001).
1.2 Endpunkt-Gruppen
Basis	Zweck
/api/auth	Login (User + Admin), Token-Ausstellung, Logout
/api/users	Benutzerverwaltung (nur Admin)
/api/tools	Werkzeuge + Werkzeugtypen (Stammdaten)
/api/locations	Lagerstruktur (Plant → Cabinet → Drawer → Position → StorageLocation)
/api/movements	Werkzeugbewegungen (Ausleihe, Rückgabe, Standort-/Lagerplatzwechsel, Statusänderung)
/api/serial-articles	Serienartikel (PDF-Einrichtepläne)
1.3 Wichtige Endpunkte (Kurzbeschreibung)
/api/auth
Methode	Endpunkt	Beschreibung
POST	/api/auth/login	Login normaler Benutzer über Personalnummer → JWT (kurze Lebensdauer), kein Passwort (DEC-030)
POST	/api/auth/admin/login	Getrennter Admin-Login: Personalnummer + Passwort (DEC-031)
POST	/api/auth/logout	Token/Session invalidieren
GET	/api/auth/me	Aktuellen Benutzer + Rolle/Berechtigungen abfragen
/api/users (nur Admin)
Methode	Endpunkt	Beschreibung
GET	/api/users	Liste aller Benutzer (Pagination)
POST	/api/users	Benutzer anlegen (Personalnummer, Vorname, Nachname, Rolle, Rechte, Aktivstatus) – keine Selbstregistrierung (DEC-032)
GET/PATCH	/api/users/{id}	Benutzer lesen / bearbeiten
PATCH	/api/users/{id}/deactivate	Benutzer deaktivieren
/api/tools
Methode	Endpunkt	Beschreibung
GET	/api/tools	Suche/Filter (Werkzeug-ID, Typ, Kategorie, Werk, Lagerort)
POST	/api/tools	Werkzeug anlegen; ID manuell oder aus SAP; Eindeutigkeit pro Werk+Kategorie prüfen (DEC-035)
GET/PATCH/DELETE	/api/tools/{id}	Detail / Änderung / Löschen
POST	/api/tools (mit is_storage=true)	Lager-/Ersatzobjekt anlegen; Checkbox allow_duplicate_id beachten (DEC-036)
GET/POST/PATCH	/api/tools/types	Werkzeugtypen als Stammdaten (eindeutiger String Code + Name) (DEC-034)
Regeln, die serverseitig erzwungen werden:

is_storage=True → ID nicht eindeutig, sonst eindeutig pro Werk + Kategorie (DEC-035).
Checkbox „Gleiche ID mehrfach zulassen" → mehrere Datensätze mit derselben ID, kein storage_count-Zähler (DEC-036, DEC-037).
/api/locations
Methode	Endpunkt	Beschreibung
GET	/api/locations/plants	Werke
GET/POST	/api/locations/cabinets	Schränke
GET/POST	/api/locations/drawers	Schubladen
GET/POST	/api/locations/positions	Positionen
GET/POST	/api/locations/storage-locations	Konkrete Lagerorte (Hierarchie: Plant → Cabinet → Drawer → Position → StorageLocation, DEC-045)
/api/movements
Methode	Endpunkt	Beschreibung
GET	/api/movements	Historie (Pagination/Filter)
POST	/api/movements/borrow	Ausleihe (Validierung: Werkzeug verfügbar, Rechte)
POST	/api/movements/return	Rückgabe (Status-/Lagerortänderung)
POST	/api/movements/transfer	Standortwechsel (Werk 1 ↔ Werk 2)
POST	/api/movements/relocate	Lagerplatzwechsel
POST	/api/movements/status	Statusänderung
Jede Bewegung speichert Benutzer, Zeitstempel, Status; Historie vollständig nachvollziehbar (DEC-040).

/api/serial-articles
Methode	Endpunkt	Beschreibung
GET	/api/serial-articles	Suche + Liste
GET	/api/serial-articles/{id}	Metadaten lesen
GET	/api/serial-articles/{id}/pdf	PDF öffnen/ansehen bzw. herunterladen
POST/PATCH/DELETE	/api/serial-articles...	Upload / Ersetzen / Löschen (optional, DEC-038)
Serienartikel = PDF-Dokumente; Metadaten (Programmname etc.) werden zunächst nicht strukturiert gespeichert (DEC-038).

2. TESTS
Grundlage: DEC-043

2.1 Backend – Pytest
Art	Inhalt
Unit-Tests	Domänenlogik und Services (z. B. ID-Eindeutigkeit, Bestandsmodellierung, Berechtigungslogik)
Integration-/API-Tests	Wichtige Endpunkte: Auth, CRUD, Fehlerfälle
Kritische Kernlogik, die Tests mitbringen muss:

Doppelte Ausleihe (Werkzeug bereits verliehen)
Fehlende Rechte / ungültige IDs
ID-Eindeutigkeit bei is_storage=True/False (DEC-035)
Checkbox „Gleiche ID mehrfach zulassen" → Mehrfach-Datensätze statt Zähler (DEC-036/037)
2.2 End-to-End – Playwright
Kritische User-Flows: Login, Suche, Ausleihe, Rückgabe (sobald die App steht).
Stabile Selektoren, keine spröden Tests.
2.3 Testabdeckung
Mindestens 80 % für Kernfunktionen (DEC-043).
Testdaten isoliert und nachvollziehbar; keine Vermischung mit Produktionsdaten.
Regressionen vermeiden: bestehende Tests nicht löschen, um „grün" zu erzwingen.
3. BETRIEB
Grundlage: DEC-046

Punkt	Festlegung
Netzwerk	Betrieb im internen Netzwerk
Server	Eigener Server (on-premise)
Authentifizierung	Lokal – kein OAuth / kein SSO
Datenbank	PostgreSQL auf demselben Server oder dediziertem DB-Server
Externe Abhängigkeiten	Keine für den Kernbetrieb
Priorität	Performance und Stabilität haben Vorrang
Konsequenzen für den Betrieb:

Keine Cloud-/OAuth-Abhängigkeit im Login (DEC-046) → passt zu den Login-Entscheidungen DEC-030/031.
SAP ist optional und darf den Core-Betrieb nicht blockieren (DEC-001).
Migrationen laufen versioniert über Alembic (DEC-044), um den Betrieb nachvollziehbar zu halten.
Backend als asynchrone FastAPI-Anwendung → stabile API unter Netzwerklast; PostgreSQL als System of Record.
Kurz-Zusammenfassung
API: RESTful mit /api/auth, /api/users, /api/tools, /api/locations, /api/movements, /api/serial-articles; Geschäftslogik + Autorisierung serverseitig.
Tests: Pytest (Unit + Integration) im Backend, Playwright für E2E; ≥ 80 % Abdeckung der Kernfunktionen.
Betrieb: Internes Netzwerk, eigener Server, lokale Auth (kein OAuth/SSO), Performance/Stabilität im Vordergrund, PostgreSQL (+ Alembic).