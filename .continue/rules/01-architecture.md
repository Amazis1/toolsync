---
name: Architektur
globs: ["**/routers/**", "**/api/**", "**/services/**", "**/models/**", "**/main.py", "**/deps.py"]
description: Architektur – Schichten, Frontend, Backend, API, DB
---

# Architektur

Verbindliche Quelle: `docs/14-architecture.md`.

## Schichten

    Frontend (React SPA)
        ↓ HTTP/JSON
    Backend API (FastAPI)
        ↓
    Datenbank (PostgreSQL)

Optional später:

    ToolSync
      ├── Internal Database
      └── Integration Layer
             └── SAP (optional)

Nicht: ToolSync überall direkt an SAP koppeln.

## Frontend

- Single Page Application (React 19 + Vite + TypeScript)
- Keine Server-Render-Komplexität
- Klare Trennung von UI, State und API-Client
- Admin-Bereiche und normale Benutzer-UI nach Rechten trennen

## Backend

- REST-API mit klaren Ressourcen-Endpunkten
- Geschäftslogik im Backend, nicht nur im Frontend
- Validierung mit Pydantic
- Klare Fehlerantworten (Statuscodes + verständliche Messages)

## Datenbank

- PostgreSQL als System of Record
- Schema und Migrationen versioniert (Alembic)
- Keine Geschäftslogik nur in der UI

## API

- Stabile, dokumentierte Endpunkte
- Authentifizierung und Autorisierung an geschützten Routen serverseitig
- Keine Breaking Changes ohne Migration und Plan

## Dokumente und Integrationen

- Externe Systeme (z. B. SAP) nur über einen Integration Layer
- Core-Funktionen (Werkzeuge, Ausleihe, Benutzer) müssen ohne SAP laufen
