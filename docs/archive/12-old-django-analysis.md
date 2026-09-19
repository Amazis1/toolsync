# Analyse des Altsystems (D:\Web)

## 1. Projektübersicht

### Projektverzeichnis
D:\Web

### Django-Version
5.1.5

### Datenbank
SQLite (db.sqlite3)

### Installierte Django-Apps

| App | Zweck |
|-----|-------|
| werkzeug | Haupt-App fur Werkzeugverwaltung |
| stammdaten | Stammdaten (Plant, Customer, Machine) |
| bewegung | Werkzeugbewegungen |
| theme | Theme/Templates/Static Files |

### Weitere Dependencies
- django-htmx (1.27.0) – fur Live-Updates
- django-alpine (0.1.4) – fur Alpine.js Integration
- Tailwind CSS v4 – fur Styling
- Pillow, PyPDF2, reportlab – fur Dateiverarbeitung

---

## 2. Datenmodell (vollstandig rekonstruiert)

### 2.1 Stammdaten (stammdaten/models.py)

#### Plant (Werk)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| name | CharField(100) | Name des Werks (unique) |

#### Customer (Kunde)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| name | CharField(100) | Kundenname (unique) |

#### Machine (Maschine)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| name | CharField(100) | Maschinenname (unique) |

### 2.2 Werkzeugverwaltung (werkzeug/models.py)

#### ToolType (Werkzeugtyp)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| name | CharField(100) | Typname (unique) |

#### Cabinet (Schrank)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| plant | ForeignKey(Plant) | Zugehoriges Werk |
| number | PositiveIntegerField | Schranknummer (unique pro Plant) |
| total_drawers | PositiveIntegerField | Anzahl Schubladen |

**Besonderheit:** Beim Speichern werden automatisch Schubladen (A, B, C, ...) erstellt.

#### Drawer (Schublade)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| cabinet | ForeignKey(Cabinet) | Zugehoriger Schrank |
| letter | CharField(1) | Buchstabe (A, B, C, ...) (unique pro Cabinet) |
| total_positions | PositiveIntegerField | Anzahl Platze |

**Besonderheit:** Beim Speichern werden automatisch Platze (1, 2, 3, ...) erstellt.

#### Position (Platz)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| drawer | ForeignKey(Drawer) | Zugehorige Schublade |
| number | PositiveIntegerField | Platznummer (unique pro Drawer) |

**Besonderheit:** Nach dem Speichern wird automatisch ein StorageLocation erstellt.

#### StorageLocation (Lagerort)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| cabinet | ForeignKey(Cabinet) | Schrank |
| drawer | ForeignKey(Drawer) | Schublade |
| position | ForeignKey(Position) | Platz |

**Constraint:** unique_together = (cabinet, drawer, position)

#### Tool (Werkzeug) – Hauptmodell
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| category | CharField(20) | Kategorie: stamp, stripper, die |
| plant | ForeignKey(Plant) | Zugehoriges Werk |
| tool_type | ForeignKey(ToolType) | Werkzeugtyp |
| storage_location | ForeignKey(StorageLocation) | Lagerort |
| tool_id | CharField(50) | Werkzeug-ID |
| is_storage | BooleanField | True = Lager/Ersatz |
| storage_count | PositiveIntegerField | Anzahl im Lager (default=1) |
| machine | ForeignKey(Machine, nullable) | Maschine |
| customer | ForeignKey(Customer, nullable) | Kunde |
| size_a | DecimalField(6,2, nullable) | Maß A |
| size_b | DecimalField(6,2, nullable) | Maß B |
| description | TextField(nullable) | Beschreibung |

**Validierung (clean):**
- Wenn is_storage=False: tool_id + category + plant muss eindeutig sein
- Wenn is_storage=True: ID darf mehrfach vorkommen

### 2.3 Bewegungen (bewegung/models.py)

#### ToolMovement (Werkzeugbewegung)
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | Integer | Primarschlussel |
| tool | ForeignKey(Tool) | Werkzeug |
| from_location | CharField(10) | Von Werk 1 / Werk 2 |
| to_location | CharField(10) | Nach Werk 1 / Werk 2 |
| status | CharField(20) | verschickt / angekommen |
| timestamp | DateTimeField(auto_now_add) | Zeitstempel |
| user | ForeignKey(auth.User) | Benutzer |
| note | TextField(nullable) | Notiz |

---

## 3. Migrationen (Chronologie)

| Migration | Änderungen |
|-----------|------------|
| 0001_initial | Initiale Modelle: Cabinet, Customer, Machine, ToolType, Drawer, Position, StorageLocation, Tool |
| 0002 | Entfernte total_drawers von Cabinet, anderte total_positions auf Pflichtfeld |
| 0003 | Stellte total_drawers und total_positions wieder her mit defaults |
| 0004 | Fugte description, size_a, size_b zu Tool hinzu |
| 0005 | Anderte unique_together von (category, storage_location, tool_id) zu (category, location, tool_id) |
| 0006 | Entfernte unique_together komplett, fugte is_storage und storage_count hinzu |
| 0007 | Erstellte Plant-Modell (Werk) |
| 0008 | Verschob Customer, Machine, Plant in stammdaten-App |
| 0009 | Fugte plant zu Cabinet hinzu, anderte unique_together auf (plant, number) |

---

## 4. Views und URLs

### Haupt-Views (werkzeug/views.py)

| View | URL | Methode | Zweck |
|------|-----|---------|-------|
| index | / | GET | Startseite |
| validate_tool_id | /validate-tool-id/ | POST | Live-Validierung Werkzeug-ID |
| validate_storage_location | /validate-storage-location/ | POST | Live-Validierung Lagerplatz |
| get_drawers | /get_drawers/ | GET | HTMX: Schubladen laden |
| get_positions | /get_positions/ | GET | HTMX: Freie Platze laden |
| werkzeug_form_partial | /load-form/ | GET | HTMX: Formular laden |
| load_tool_list | /load-tool-list/ | GET | HTMX: Werkzeugliste laden |
| tab1_content | /tabs/tab1/ | GET | Tab1: Werkzeug |
| tab2_content | /tabs/tab2/ | GET | Tab2: Serienartikel |
| tab3_content | /tabs/tab3/ | GET | Tab3: Info/Hilfe |
| tab4_content | /tabs/tab4/ | GET | Tab4: Lager/Ersatz |
| upload_file | /upload-file/ | POST | Datei-Upload |
| add_tool | /add-tool/ | POST | Werkzeug anlegen |
| filter_tools_by_location | /filter-tools/ | GET | Filter nach Werk |

### Bewegungen-Views (bewegung/views.py)
- Nur Boilerplate (from django.shortcuts import render)

### Stammdaten-Views (stammdaten/views.py)
- Nur Boilerplate (from django.shortcuts import render)

---

## 5. Admin-Interface

### werkzeug/admin.py
- CabinetAdmin: Verwaltung mit DrawerInline (Schubladen)
- DrawerAdmin: Verwaltung mit PositionInline (Platze)
- PositionAdmin: Verwaltung
- ToolTypeAdmin: Verwaltung
- ToolAdmin: Verwaltung mit Filtern und Suche
- StorageLocationAdmin: Verwaltung mit Anzeige des belegten Werkzeugs

### stammdaten/admin.py
- PlantAdmin: Einfache Verwaltung
- CustomerAdmin: Einfache Verwaltung
- MachineAdmin: Einfache Verwaltung

### bewegung/admin.py
- ToolMovementAdmin: Verwaltung mit Filtern und Suche

---

## 6. Frontend

### Layout (theme/templates/base.html)
- Sidebar (links, fixed)
- Header mit Logo und Statistiken
- 3-spaltiges Grid: Serienartikel | Werkzeugliste | Lager/Ersatz

### Tab-System (werkzeug_form_partial.html + tabs/)
- 4 Tabs: Werkzeug, Serienartikel, Info/Hilfe, Lager/Ersatz
- Navigation vertikal links, Content rechts

### Tab1 – Werkzeug (tab1.html)
- Kategorie-Auswahl: Stempel / Abstreifer / Matrize (Radio-Buttons)
- Lager/Ersatz Checkbox + Anzahl-Feld
- Werkzeug-ID (Live-Validierung)
- Werkzeug-Typ (Dropdown)
- Maß A (Pflicht) + Maß B (Optional)
- Lagerort: Schrank → Schublade → Position (kaskadierend)
- Kunde (Dropdown)
- Maschine (Dropdown)
- Beschreibung (Textarea)

### Tab2 – Serienartikel (tab2.html)
- Aktuell: Demo/UI-Styleguide (noch keine funktionale Implementierung)

### Tab3 – Info/Hilfe (tab3.html)
- Leer (Platzhalter)

### Tab4 – Lager/Ersatz (tab4.html)
- Leer (Platzhalter)

### JavaScript (theme/static/js/main.js)
- Tab-Navigation mit HTMX
- Datei-Upload (Drag & Drop)
- Werkzeug-ID-Validierung (Live mit Fetch)
- Werkzeug-Umschaltung (Werk 1 / Werk 2) mit SessionStorage
- Debounce-Funktion fur Validierung

### CSS (theme/static/css/input.css)
- Tailwind CSS v4 mit @import "tailwindcss"
- Glassmorphism-Design
- Eigene Icons (SVG-Masks)
- Dark Mode Support

---

## 7. Geschaftslogik (Business Rules)

### Werkzeug-ID-Regeln
1. Normale Werkzeuge (is_storage=False): ID muss pro Kategorie und Werk eindeutig sein
2. Lager/Ersatz (is_storage=True): ID darf mehrfach vorkommen

### Lagerplatz-Regeln
1. Ein Schrank → Schublade → Platz darf nur einmal belegt sein
2. Bei der Anlage wird Live gepruft, ob der Platz bereits belegt ist

### Bestandsfuhrung (Lager/Ersatz)
1. Wenn ein Lager/Ersatz-Werkzeug mit bereits existierender ID angelegt wird, wird der Bestand erhoht (storage_count += 1)
2. Es wird kein neuer Datensatz angelegt

### Maße-Validierung
1. Maß A ist Pflicht
2. Maß B ist optional
3. Maximal 4 Stellen vor dem Komma, 2 Stellen nach dem Komma

### Automatische Erstellung
1. Beim Speichern eines Schranks werden automatisch Schubladen (A, B, C, ...) erstellt
2. Beim Speichern einer Schublade werden automatisch Platze (1, 2, 3, ...) erstellt
3. Nach dem Speichern einer Position wird automatisch ein StorageLocation erstellt

---

## 7a. Authentifizierung und Benutzer

### Authentifizierung im Altsystem

**Es gibt keine eigene Login-Funktionalität.**

| Aspekt | Tatsächlicher Zustand |
|--------|----------------------|
| Login-Seite | Existiert nicht |
| Login-Views | Existieren nicht |
| Logout | Existiert nicht |
| Session-Handling | Nicht in den Views verwendet |
| Passwort-Login | Nur über Django-Admin (`/admin`) |
| Personalnummer | Existiert nicht als Feld |
| Benutzer-Modell | Standard `django.contrib.auth.models.User` |
| Selbst-Registrierung | Nicht vorhanden |
| Benutzer-Anlage | Nur über Django-Admin |

**Konsequenz:** Die komplette Werkzeug-UI ist ohne Authentifizierung erreichbar. Es gibt keine Rechteprüfung in den Views. Die einzige geschützte Fläche ist der Django-Admin.

### Benutzer und Berechtigungen

| Aspekt | Tatsächlicher Zustand |
|--------|----------------------|
| Rollen | Nicht implementiert (nur Django-Gruppen im Admin möglich) |
| Berechtigungen | Standard Django-Permissions (add/change/delete) |
| Rechteprüfung in Views | Nicht vorhanden |
| Rechteprüfung im Frontend | Nicht vorhanden |
| Benutzerverwaltung | Nur über Django-Admin |
| Benutzerprofil | Existiert nicht (kein Profil-Modell) |

**Bewertung:** Die Anforderung „Login über Personalnummer, kein Passwort“ ist im Altsystem **nicht umgesetzt** und muss in ToolSync 2.0 neu entwickelt werden.

---

## 7b. Ausleihe / Rückgabe im Altsystem

**Es gibt keine echte Ausleihe und keine Rückgabe.**

Das Modell `ToolMovement` (App `bewegung`) bildet lediglich einen **Versand zwischen Werken** ab:

| Feld | Bedeutung |
|------|-----------|
| tool | Welches Werkzeug |
| from_location | Von Werk 1 / Werk 2 |
| to_location | Nach Werk 1 / Werk 2 |
| status | „verschickt“ / „angekommen“ |
| timestamp | Zeitstempel |
| user | Ausführender Benutzer |
| note | Notiz |

**Wichtige Erkenntnisse:**

1. **Kein Ausleih-Workflow** – Es gibt keine „Benutzer leiht Werkzeug aus“-Funktion.
2. **Keine Rückgabe-Logik** – Keine Statusmuster für „ausgeliehen → zurückgegeben“.
3. **Keine UI** – `bewegung/views.py` ist leer; es gibt keine Templates für Bewegung.
4. **⚠️ Syntaxfehler**: In `bewegung/models.py` steht ein `location = models.CharField(...)` **außerhalb einer Klasse**. Das Modul würde beim Import fehlschlagen. Es ist unklar, ob die App im Altsystem aktuell überhaupt funktioniert.
5. **Keine Historie im UI** – Bewegungen sind nur als DB-Modell vorhanden, aber nicht bedienbar.

**Bewertung:** Der Ausleih-/Rückgabe-Prozess von ToolSync 2.0 muss komplett neu konzipiert werden. `ToolMovement` kann als Vorbild für eine Audit-/Bewegungshistorie dienen.

---

## 7c. Integrationen

| System | Vorhanden? | Details |
|--------|-----------|---------|
| SAP | ❌ Nicht vorhanden | Keine SAP-Anbindung, kein Adapter, keine SAP-Abhängigkeit im Altsystem |
| E-Mail | ❌ Nicht vorhanden | Keine E-Mail-Funktionen |
| Externe APIs | ❌ Nicht vorhanden | Keine REST-Aufrufe an Drittsysteme |
| Datei-Upload | ✅ Vorhanden | `upload_file`-View speichert Dateien nach `uploads/` (MEDIA_ROOT), Drag & Drop im Frontend |
| PDF-Verarbeitung | ✅ Bibliotheken installiert | PyPDF2, reportlab sind als Dependencies vorhanden, werden aber in keiner View verwendet |

**Bewertung:** Das Altsystem hat **keinerlei SAP-Abhängigkeit** – die Anforderung „SAP optional“ ist im alten Code bereits real erfüllt. ToolSync 2.0 kann die Dateiablage überdenken (z. B. strukturierte Speicherung von PDFs mit Metadaten).

---

## 7d. Widersprüche: Altsystem vs. aktuelle Anforderungen

| Thema | Altsystem (EXISTING) | Aktuelle Anforderung (REQUIRED) | Entscheidung |
|-------|----------------------|---------------------------------|--------------|
| Login | Kein Login, offene App | Login über Personalnummer, kein Passwort | Aktuelle Anforderung; Neuentwicklung |
| Benutzeranlage | Nur Django-Admin | Admin legt Benutzer an | Neuentwicklung |
| Rollen | Keine eigenen Rollen | Admin + Benutzer; Rechte steuern Sichtbarkeit | Neuentwicklung |
| Serienartikel | Nur UI-Platzhalter (Tab2), kein Modell | PDF-Einrichtepläne, suchen/öffnen/herunterladen | Neuentwicklung |
| Werkzeugtypen | Einfaches `ToolType` (Name) | Typ-Code (mehrstellig, fester Bestandteil der Werkzeug-ID), administrativ erweiterbar; Zuordnung der Codes zu Typen offen | Erweiterung |
| Werkzeug-ID | Freies CharField, Eindeutigkeit pro Kategorie+Werk | Struktur mit Typ-Code möglich, noch zu spezifizieren | OFFEN |
| Ausleihe | Nicht vorhanden | Ausleihe/Rückgabe mit Zeitraum und Status | Neuentwicklung |
| Bewegungen | `ToolMovement` (Versand Werk 1 ↔ Werk 2) | Bewegungs-/Audit-Historie | Übernehmen + erweitern |
| Lager/Ersatz | `is_storage` + `storage_count`, ID darf mehrfach | Lager/Ersatz mit optionalen doppelten IDs | Übernehmen |
| SAP | Nicht vorhanden | Optional, nur über Integration Layer | Altsystem erfüllt dies bereits |

---

## 8. Wiederverwendbarkeit (Bewertung)

| Komponente | Bewertung | Begrundung |
|------------|-----------|------------|
| Datenmodell | UBERNEHMEN | Struktur ist fachlich korrekt |
| Geschaftslogik (Views) | TEILWEISE UBERNEHMEN | Logik muss in FastAPI-Endpunkte umgewandelt werden |
| Admin-Interface | NEU IMPLEMENTIEREN | Django Admin wird durch React-Admin-Panel ersetzt |
| Templates (HTML) | TEILWEISE UBERNEHMEN | Struktur und Design konnen fur React adaptiert werden |
| CSS (Tailwind) | UBERNEHMEN | Tailwind v4 kann 1:1 im neuen Frontend verwendet werden |
| JavaScript | TEILWEISE UBERNEHMEN | Funktionen (Validierung, Toggle, Upload) konnen in React adaptiert werden |
| HTMX | NEU IMPLEMENTIEREN | Wird durch React + REST API ersetzt |
| Tab-Struktur | UBERNEHMEN | Die 4-Tab-Struktur bleibt erhalten |
| Lagerstruktur | UBERNEHMEN | Bleibt vollstandig erhalten |
| Datei-Upload | UBERNEHMEN | Drag & Drop bleibt erhalten |
| Bewegungen | TEILWEISE UBERNEHMEN | Model bleibt, UI muss neu entwickelt werden |
| Statistik | NEU IMPLEMENTIEREN | Nicht im Altsystem vorhanden |
| Benutzer/Auth | NEU IMPLEMENTIEREN | Personalnummer-Login ohne Passwort ist neu |

---

## 9. Offene Fragen (fur spätere Tasks)

1. **Benutzerverwaltung** (TASK-006)
   - Django verwendet standard auth.User
   - Wie wird der Personalnummer-Login ohne Passwort technisch umgesetzt?
   - Wie wird der Admin-Login mit Passwort getrennt?

2. **Rollen und Berechtigungen** (TASK-006)
   - Im Altsystem keine eigenen Rollen (verwendet Django-Gruppen)
   - Welche Rollen werden in ToolSync 2.0 benotigt?
   - Welche Berechtigungen mussen definiert werden?

3. **Serienartikel** (TASK-005)
   - Im Altsystem nur UI vorhanden (Tab2) – kein Backend-Modell
   - Wie werden PDFs gespeichert, gesucht und angezeigt?
   - Welche Metadaten mussen strukturiert gespeichert werden?

4. **Statistik** (TASK-007)
   - Nicht im Altsystem vorhanden
   - Welche Auswertungen werden benotigt?
   - Welche Diagramme und Filter sind erforderlich?

---

## 10. Technische Risiken

1. **Keine Services/Utils-Schicht**
   - Die Geschaftslogik ist direkt in den Views implementiert
   - Bei der Neuimplementierung muss eine saubere Trennung geschaffen werden

2. **Keine separaten Forms**
   - Validierung erfolgt in den Views (add_tool)
   - Fur FastAPI muss die Validierung in Pydantic-Schemas umgesetzt werden

3. **Keine Tests**
   - Im Altsystem wurden keine Tests gefunden
   - Fur ToolSync 2.0 mussen Tests von Anfang an berucksichtigt werden

---

## 11. Coverage (TASK-001)

| Bereich | Gefunden | Gelesen | Verstanden | Dokumentiert |
|---------|----------|---------|------------|--------------|
| Projektstruktur | ✅ | ✅ | ✅ | ✅ |
| Django Apps | ✅ | ✅ | ✅ | ✅ |
| Models | ✅ | ✅ | ✅ | ✅ |
| Migrationen | ✅ | ✅ | ✅ | ✅ |
| Views | ✅ | ✅ | ✅ | ✅ |
| Forms | ✅ | ✅ | ✅ | ✅ |
| URLs | ✅ | ✅ | ✅ | ✅ |
| Services | ✅ | ✅ | ✅ | ✅ |
| Utilities | ✅ | ✅ | ✅ | ✅ |
| Business Logic | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Templates | ✅ | ✅ | ✅ | ✅ |
| HTMX | ✅ | ✅ | ✅ | ✅ |
| JavaScript | ✅ | ✅ | ✅ | ✅ |
| Tailwind | ✅ | ✅ | ✅ | ✅ |
| Benutzer | ✅ | ✅ | ✅ | ✅ |
| Rollen | ✅ | ✅ | ✅ | ✅ |
| Serienartikel | ✅ | ✅ | ✅ | ✅ |
| Statistik | ✅ | ✅ | ✅ | ✅ |

**Alle 19 Bereiche wurden vollstandig analysiert.**

---

---

## 12. Relevante Dateien

### Backend (D:\Web)

| Datei | Inhalt | Gelesen |
|-------|--------|---------|
| `toolsync/settings.py` | Django-Konfiguration, Apps, Middleware, MEDIA_ROOT | ✅ |
| `toolsync/urls.py` | Zentrale URL-Konfiguration | ✅ |
| `werkzeug/models.py` | Alle Werkzeug-Modelle (ToolType, Cabinet, Drawer, Position, StorageLocation, Tool), Signale, Validierung | ✅ |
| `werkzeug/views.py` | Alle View-Funktionen (index, add_tool, Validierung, HTMX-Partials) | ✅ |
| `werkzeug/admin.py` | ModelAdmin-Klassen mit Inline-Verwaltung | ✅ |
| `werkzeug/urls.py` | URL-Routen der App werkzeug | ✅ |
| `stammdaten/models.py` | Plant, Customer, Machine | ✅ |
| `bewegung/models.py` | ToolMovement – **enthält Syntaxfehler** (location außerhalb der Klasse) | ✅ |
| `bewegung/views.py` | Leer (nur Boilerplate) | ✅ |

### Frontend (D:\Web)

| Datei | Inhalt | Gelesen |
|-------|--------|---------|
| `theme/templates/base.html` | Master-Layout (Sidebar, Header, Tabs) | ✅ |

### Migrationen (D:\Web\werkzeug\migrations)

| Datei | Inhalt | Gelesen |
|-------|--------|---------|
| `0001_initial.py` | Initiale Modelle | ✅ |
| `0005_alter_tool_unique_together_tool_location_and_more.py` | Übergang zu location-Feld | ✅ |
| `0007_plant.py` | Plant-Modell erstellt | Teilweise (aus Dateinamen + Code im Modell abgeleitet) |
| `0008_alter_tool_customer_alter_tool_machine_delete_plant_and_more.py` | Customer/Machine-FKs, Plant verschoben | Teilweise (aus Dateinamen + Code im Modell abgeleitet) |
| `0009_cabinet_plant_alter_cabinet_number_and_more.py` | plant zu Cabinet, unique_together | Teilweise (aus Dateinamen + Code im Modell abgeleitet) |

---

# Ende der Analyse