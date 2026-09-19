# 04-target-architecture

> **Task-Status: COMPLETED.**
> Diese Datei ist eine historische Planungsnotiz. Die verbindliche Architektur steht in
> `docs/14-architecture.md`, die Entscheidungen in `docs/13-decisions.md`.

## Ziel
Die Zielarchitektur fur ToolSync 2.0 definieren und dokumentieren.

## Voraussetzung
- TASK-001 = COMPLETED
- TASK-002 = COMPLETED
- TASK-003 = COMPLETED
- Completion Gates = PASS

## Architekturbereiche
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

## Technologie-Stack (Orientierung)

### Frontend
- React SPA
- TypeScript
- Vite
- Tailwind CSS v4
- Eigene CSS-Klassenschicht (`index.css` für Glas, `admin.css` für Split-Tone)
- Kein UI-Framework, kein shadcn/ui

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
- Optional
- Integration Layer

## Dokumentation
Die Architekturentscheidungen werden festgehalten in:
- `docs/13-decisions.md` (Entscheidungen)
- `docs/14-architecture.md` (verbindliche Architektur)

## Ergebnis
Die Zielarchitektur wurde auf Basis von `docs/01-requirements.md` und `docs/13-decisions.md`
definiert und in `docs/14-architecture.md` festgehalten. Erledigt.