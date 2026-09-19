# 07-implementation-roadmap

## Task-Status: NOT_STARTED

## Ziel
Eine detaillierte, nachvollziehbare Implementierungs-Roadmap erstellen.

## Voraussetzung
- TASK-004 = COMPLETED
- TASK-005 = COMPLETED
- TASK-006 = COMPLETED
- Completion Gates = PASS

## Grundreihenfolge der Implementierung

1. Projektgrundstruktur
   - Ordnerstruktur anlegen
   - Dependencies installieren
   - Entwicklungsumgebung konfigurieren

2. Datenbank
   - PostgreSQL Setup
   - SQLAlchemy Modelle
   - Alembic Migrationen

3. Backend-Grundstruktur
   - FastAPI App
   - Router
   - CRUD-Operationen
   - Pydantic Schemas

4. Authentifizierung
   - Personalnummer-Login (ohne Passwort)
   - Admin-Login (mit Passwort)
   - JWT-Token
   - Session-Management

5. Benutzerverwaltung
   - Benutzer anlegen (nur Admin)
   - Benutzer bearbeiten
   - Benutzer deaktivieren

6. Rollen und Berechtigungen
   - Rollen definieren
   - Berechtigungen zuweisen
   - Backend-Validierung

7. Admin-Panel (React)
   - Dashboard
   - Benutzerverwaltung
   - Stammdaten (Kunden, Maschinen, Werkzeugtypen, Werke)
   - Lagerstruktur (Schrank, Schublade, Platz)

8. Werkzeugtypen
   - CRUD-Operationen
   - Frontend-Integration

9. Werkzeuge
   - CRUD-Operationen
   - Validierung (ID-Eindeutigkeit pro Werk)
   - Lager/Ersatz (duplicate_id_allowed)
   - Frontend-Formular mit Tabs

10. Lager
    - Lagerorte verwalten
    - Schrank -> Schublade -> Platz
    - Live-Validierung (Platz belegt)

11. Lager/Ersatz
    - Bestandsfuhrung
    - duplicate_id_allowed
    - Storage Count

12. Serienartikel-PDF-Bereich
    - PDF-Upload
    - PDF-Suche
    - PDF-Anzeige

13. Bewegungen
    - Versand zwischen Werken
    - Empfangsbestatigung
    - Bewegungs-Historie

14. Statistik
    - Dashboard mit Diagrammen
    - Filter nach Zeitraum, Benutzer, Werkzeugtyp

15. Frontend (React)
    - Tabs (Werkzeug, Serienartikel, Lager/Ersatz, Info/Hilfe)
    - Dynamische Dropdowns
    - Live-Validierungen
    - Werkzeugliste mit Filtern

16. Tests
    - Unit-Tests (Pytest)
    - End-to-End-Tests (Playwright)

17. Deployment
    - Production-Konfiguration
    - Environment-Variablen
    - Docker (optional)

18. SAP-Integration (optional)
    - Integration Layer
    - API-Adapter

## Nachste Aktion
Mit Phase 7 beginnen, sobald TASK-006 abgeschlossen ist.