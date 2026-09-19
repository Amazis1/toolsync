# Gap-Analyse: Altsystem vs. ToolSync-Anforderungen

**Erstellt:** 2026-08-14
**Basierend auf:** TASK-001 Analyse, docs/01-requirements.md, docs/13-decisions.md
**Status:** COMPLETED

---

## 1. Vergleichstabelle

| Bereich | Altsystem | Anforderung | Unterschied | Konsequenz | Klassifizierung |
|---------|-----------|-------------|-------------|------------|-----------------|
| Login | **Kein Login vorhanden** – App ist offen erreichbar; nur Django-Admin (`/admin`) ist über `auth.User` mit Passwort geschützt | Normale Benutzer nur über Personalnummer, ohne Passwort; Admin mit eigenem Login | Kein Login-Flow im Altsystem; App ohne Authentifizierung nutzbar | Login-Mechanik komplett neu entwickeln; Security-Konzept nötig | Altsystem: REJECTED / Ziel: REQUIRED |
| Benutzeranlage | Keine Benutzerverwaltung für die App – nur Django-Admin mit Standard-`auth.User` | Ausschließlich Admin legt Benutzer an | Kein Custom-User, keine Personalnummer, keine Selbstregistrierung | Eigenes Benutzermodell neu entwickeln | REQUIRED |

| Rollen/Berechtigungen | Keine eigenen Rollen; keine Rechteprüfung in Views; nur Standard-Django-Gruppen im Admin | Serverseitig durchgesetzte Rollen | Fehlt im Altsystem vollständig | Berechtigungskonzept neu aufbauen | REQUIRED |
| Werkzeug-ID | `tool_id` freies `CharField(50)`; normal: eindeutig pro `category + plant`; Lager/Ersatz: mehrfach erlaubt | Manuelle Eingabe oder aus SAP übernommen; Eindeutigkeit pro Werk + Kategorie; Lager/Ersatz mehrfach erlaubt | Passt grundsätzlich, aber ID-Bedeutung ist nicht im System hinterlegt | ID-Format muss nicht geändert werden; Eindeutigkeitsregeln übernehmen | EXISTING (übernehmbar) |
| Werkzeugtypen | `ToolType` nur mit `name`; zusätzlich `category` = Stempel/Abstreifer/Matrize | Admin legt Typen als Stammdaten an: eine zusammenhängende Bezeichnung mit mehrstelligem Typ-Code (z.B. `010 Rund` – konkrete Zuordnung der Codes zu Typen noch offen); Matrize/Abstreifer sind Kategorien | Kein Code im Altsystem; Kategorie vs. Typ muss geklärt werden | Ein Feld `name` (eindeutig, enthält Typ-Code + Bezeichnung) – keine Trennung in `code` und `name`. Verwaltung über Admin-Panel; weitere Typen ergänzbar | REQUIRED (neu) / EXISTING (teilweise) |
| Lagerstruktur | `Plant` → `Cabinet` → `Drawer` → `Position` → `StorageLocation`; Lagerort unique auf `(cabinet, drawer, position)` | Mehrere Werke, Lagerorte eindeutig einem Werk zugeordnet | Struktur deckt Anforderung ab | Übernehmen | EXISTING (übernehmbar) |
| Lager/Ersatz | `is_storage`-Flag + `storage_count`; gleiche ID automatisch als Bestandserhöhung | Checkbox "Gleiche ID mehrfach zulassen"; mehrere Datensätze bei gleicher ID | Altsystem nutzt Zähler, nicht mehrere Datensätze | Checkbox-Regel explizit modellieren; Bestandslogik ändern | REQUIRED / EXISTING (teilweise) |
| Werkzeugbewegungen | `ToolMovement` mit `from_location`/`to_location`; Status "verschickt/angekommen"; keine Ausleihe/Rückgabe; **`bewegung/models.py` enthält Syntaxfehler (Feld `location` außerhalb der Klasse)** – App vermutlich nicht funktionsfähig | Ausleihe, Rückgabe, Standortwechsel, Statusänderung, Historie | Bewegungskonzept im Altsystem defekt und unvollständig | Bewegungskonzept neu entwickeln | REQUIRED / EXISTING (teilweise, defekt) |
| Statistik | Nicht vorhanden | Noch nicht verbindlich spezifiziert | Kein Backend, keine Auswertungen | Bedarf klären, dann neu entwickeln | OPEN |
| SAP | Keine SAP-Integration gefunden | SAP optional, nur über getrennten Integration Layer | Keine Alt-Integration vorhanden | Nichts zu migrieren; Integration Layer später | PROPOSED / OPEN |
| Benutzeroberfläche | Django-Templates + HTMX + Alpine.js + Tailwind; 4-Tab-Struktur | React SPA + TypeScript + Tailwind + shadcn/ui; Block-Struktur | Komplett andere Technologie | Neuentwicklung; Design teilweise übernehmen | REQUIRED (neu) / EXISTING (Design teilweise) |
| Netzwerkbetrieb | Lokal entwickelt | Internes Netzwerk, eigener Server | Kein Unterschied | Keine Anpassung nötig | EXISTING |

---

## 2. Zusammenfassung

### Bereiche mit Übereinstimmung (übernehmbar)
- Lagerstruktur (Werk → Schrank → Schublade → Platz → Lagerort)
- Werkzeug-ID-Eindeutigkeitsregeln (pro Werk + Kategorie)
- Grundidee klar getrennter Blöcke (Werkzeug / Serienartikel / Lager/Ersatz)
- Netzwerkbetrieb (keine Änderung nötig)

### Bereiche mit Abweichungen (müssen angepasst werden)
- Login: Passwort vs. passwortlose Personalnummer
- Benutzeranlage: Standard-Django-User vs. eigenes Benutzermodell
- Werkzeugtypen: nur Name vs. Code + Name als Stammdaten
- Lager/Ersatz: Zähler vs. mehrere Datensätze + Checkbox
- Bewegungen: reiner Versand vs. Ausleihe/Rückgabe/Historie

> **Hinweis Bewegungen:** Das Altsystem enthält in `bewegung/models.py` einen Syntaxfehler (`location`-Feld außerhalb einer Klasse). Die App ist vermutlich nicht funktionsfähig. Für ToolSync 2.0 muss das Bewegungskonzept neu entwickelt werden.

### Fehlende Bereiche (neu zu implementieren)
- Serienartikel (Backend + PDF-Verwaltung)
- Ausleihe und Rückgabe
- Rollen und Berechtigungen (serverseitig)
- Statistik/Auswertungen
- Tests
- SAP-Integration Layer (optional)

### Offene Entscheidungen (für TASK-004, TASK-005, TASK-006)
- Technische Umsetzung des passwortlosen Personalnummer-Logins (Security-Konzept)
- Verhältnis von "Kategorie" (Stempel/Abstreifer/Matrize) zu "Werkzeugtyp" (Rund/Quadrat/...)
- Rollenmodell (welche Rollen und Berechtigungen konkret)
- Serienartikel-Metadaten (welche Felder strukturiert gespeichert werden)
- Statusliste (verfügbar, ausgeliehen, defekt, in Reparatur, ...)
- Bedarf an Statistik/Auswertungen

---

## 3. Empfehlungen für TASK-004 (Zielarchitektur)

1. **Domain Model mit klar getrennten Entitäten erstellen:**
   - Benutzer, Rolle, Berechtigung
   - Werk (Plant), Lagerort (StorageLocation), Werkzeugtyp (ToolType)
   - Werkzeug (Tool), Lagerobjekt (Ersatz), Serienartikel-Dokument
   - Ausleihe/Rückgabe, Bewegung

2. **Lagerstruktur übernehmen:**
   - `Plant` → `Cabinet` → `Drawer` → `Position` → `StorageLocation`
   - Unverändert aus dem Altsystem übernehmen

3. **Werkzeugtyp als Stammdaten-Feld (Code + Name als zusammenhängende Bezeichnung):**
   - Ein einziges Feld `name` (eindeutig), z.B. `010 Rund`
   - Werkzeugtypen werden im Admin-Panel als Stammdaten angelegt und verwaltet
   - Keine getrennten Felder `code` und `name`: `010` gehört fest zu `Rund` – Der Typ-Code ist fester Bestandteil der Werkzeug-ID und dient der Sortierung/Filterung. Konkrete Zuordnung der Codes zu Typen bleibt offen (Feineinstellung später)
   - Weitere Typen können administrativ hinzugefügt werden
4. **ID-Strategie:**
   - ID wird manuell eingegeben oder aus SAP übernommen
   - System prüft nur die Eindeutigkeit pro Werk + Kategorie
   - Bei Lager/Ersatz (`is_storage=True`) ist die ID nicht eindeutig

5. **Lager/Ersatz mit Checkbox:**
   - Checkbox "Gleiche ID mehrfach zulassen"
   - Mehrere Datensätze mit derselben ID (kein Zähler)

6. **Security als eigenes Konzept:**
   - Personalnummer-Login ohne Passwort (normale User)
   - Admin-Login mit Passwort
   - Serverseitige Autorisierung für alle Endpunkte

7. **SAP nur als optionalen Integration Layer:**
   - Kernmodelle SAP-frei halten
   - ID-Übernahme aus SAP als Import-Funktion

8. **Tests von Anfang an einplanen:**
   - Pytest für Backend
   - Playwright für End-to-End

9. **Netzwerkbetrieb berücksichtigen:**
   - Lokale Authentifizierung (kein OAuth/SSO)
   - Performance und Stabilität haben Priorität
   - Datenbank auf gleichem oder dediziertem Server

---

## 4. Nächste Schritte

1. **TASK-004 – Zielarchitektur definieren**
   - Frontend: React SPA + TypeScript + Tailwind + shadcn/ui
   - Backend: FastAPI + SQLAlchemy + Pydantic
   - Datenbank: PostgreSQL (SQLite für Entwicklung)
   - Authentifizierung: Personalnummer-Login + Admin-Login

2. **TASK-005 – Domain Model definieren**
   - SQLAlchemy Modelle erstellen
   - Pydantic Schemas erstellen

3. **TASK-006 – Security und Berechtigungen definieren**
   - Personalnummer-Login ohne Passwort
   - Admin-Login mit Passwort
   - Rollen und Berechtigungen

4. **TASK-007 – Implementierungs-Roadmap erstellen**
   - Reihenfolge der Implementierung festlegen
   - Meilensteine definieren

---

# Ende der Gap-Analyse