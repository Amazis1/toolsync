# ToolSync – Architektur

> **Status: VERBINDLICH.** Dies ist die maßgebliche Architektur-Quelle des Projekts.
>
> Rangfolge bei Widersprüchen: `docs/00-project-vision.md` Abschnitt 16.

## 1. Schichten

    Frontend (React SPA)
        | HTTP/JSON  (/api)
    Backend API (FastAPI)
        | SQLAlchemy 2.0 (async)
    Datenbank (PostgreSQL)

Optional später:

    ToolSync
      |- Interne Datenbank
      \- Integration Layer
             \- SAP (optional)

**Nicht:** ToolSync überall direkt an SAP koppeln.

## 2. Verbindlicher Stack

### Frontend

| Technologie | Version | Rolle |
|---|---|---|
| React | 19.2 | SPA |
| TypeScript | 6.0 | Typsicherheit |
| Vite | 8.1 | Dev-Server und Build |
| Tailwind CSS | 4.3 | Utility-CSS |
| `@dnd-kit/core` | 6.3 | Drag & Drop für die Lagerstruktur |
| `react-dropzone` | 20.1 | PDF-Upload |
| Playwright | 1.62 | E2E-Tests |
| ESLint | 10.6 | Linting |

> **Kein UI-Framework und kein shadcn/ui.**
> Es gibt keine `components.json` und kein Verzeichnis `src/components/ui`.
> Die UI ist eine eigene CSS-Klassenschicht — siehe Abschnitt 6.

### Backend

| Technologie | Version | Rolle |
|---|---|---|
| FastAPI | 0.115.0 | REST-API |
| Pydantic | 2.9.0 | Validierung |
| pydantic-settings | 2.5.0 | Konfiguration |
| SQLAlchemy | 2.0.35 | ORM (async) |
| Alembic | 1.14.0 | Migrationen |
| asyncpg | 0.30.0 | PostgreSQL-Treiber |
| aiosqlite | 0.22.1 | SQLite für Entwicklung und Tests |
| python-jose | 3.3.0 | JWT |
| bcrypt | 5.0.0 | Passwort-Hashing (Admin) |
| uvicorn | 0.30.0 | ASGI-Server |
| Pytest | 9.1.1 | Tests |

### Datenbank

- PostgreSQL ist das **System of Record**.
- Entwicklung und Tests können SQLite verwenden (`aiosqlite`).
- Schemaänderungen **nur** über Alembic-Migrationen.

## 3. Backend-Struktur

Einstiegspunkt: `backend/app/main.py`

| Bestandteil | Ort |
|---|---|
| App und Router-Montage | `app/main.py` |
| Router | `app/routers/` |
| Pydantic-Schemas | `app/schemas/` |
| ORM-Modelle | `app/models/` |
| Geschäftslogik | `app/services/` |
| DB-CRUD | `app/crud/` |
| Datenbank-Setup | `app/utils/database.py` |
| Migrationen | `backend/alembic/versions/` |
| Tests | `backend/tests/` |

### Montierte Router

Alle unter dem Präfix `/api`:

| Präfix | Modul | Zweck |
|---|---|---|
| `/api/auth` | `auth.py` | Login, Token, `/me` |
| `/api/users` | `users.py` | Benutzerverwaltung |
| `/api/roles` | `roles.py` | Rollen |
| `/api/tools` | `tools.py` | Werkzeuge, Werkzeugtypen, `check-id` |
| `/api/locations` | `locations.py` | Werke, Schränke, Schubladen, Plätze, Ablage |
| `/api/movements` | `movements.py` | Bewegungen, Ausleihe, Rückgabe |
| `/api/serial-articles` | `serial_articles.py` | Serienartikel und PDFs |
| `/api/storage` | `storage_items.py` | Lager- und Ersatzobjekte |
| `/api` | `master_data.py` | Kunden, Maschinen, Werke |
| `/health` | `main.py` | Healthcheck |

### CORS

Erlaubt sind `http://localhost:5173` und `http://localhost:3000`.

> **Offen:** Die CORS-Liste ist auf lokale Entwicklung beschränkt. Für einen
> Serverbetrieb im internen Netzwerk muss die Origin konfigurierbar werden.

### Tabellenerstellung beim Start

`main.py` ruft im `lifespan` `Base.metadata.create_all` auf.

> **Wichtig:** Das ist eine Bequemlichkeit für die Entwicklung. Im Betrieb ist
> Alembic die einzige Quelle für Schemaänderungen. `create_all` darf nicht dazu
> führen, dass Migrationen übersprungen werden.

## 4. Datenmodell (Ist-Stand)

Modelle in `backend/app/models/`:

| Datei | Inhalt |
|---|---|
| `user.py` | `User`, Rollen, Berechtigungen |
| `tool.py` | `Tool`, `ToolType` |
| `master_data.py` | `Plant`, `Customer`, `Machine` |
| `storage.py` | `Cabinet`, `Drawer`, `Position` |
| `storage_item.py` | Lager- und Ersatzobjekte |
| `movement.py` | `ToolMovement` |
| `serial_article.py` | `SerialArticle` |
| `enums.py` | Aufzählungen |

> **Wichtig:** `StorageLocation` existiert **nicht mehr** (DEC-048). Der **Platz**
> (`Position`) ist der Lagerort. Die Hierarchie ist:
> `Plant -> Cabinet -> Drawer -> Position`.

Details: `docs/02-domain-model.md`

## 5. Migrationen

`backend/alembic/versions/` — vier Migrationen, in dieser Reihenfolge:

| Revision | Inhalt |
|---|---|
| `f5b7b5192461` | Initiale Migration |
| `c7d9e2f3a1b8` | `StorageLocation` entfernt, Grid (`cols`/`rows`) ergänzt |
| `d1a4f6b2c9e3` | `Customer.color` ergänzt |
| `b2e8c1a4d9f7` | `measure` und `description` für Tools ergänzt |

Regeln: jede Schemaänderung = Migration, `downgrade()` mitliefern, auf leerer
**und** bestehender Datenbank prüfen.

## 6. Frontend-Struktur

Einstiegspunkt: `frontend/src/main.tsx`

| Bestandteil | Ort |
|---|---|
| Einstieg | `src/main.tsx` |
| Wurzelkomponente | `src/App.tsx` |
| Seiten | `src/pages/`, `src/pages/admin/` |
| Komponenten | `src/components/` |
| API-Client | `src/api/`, `src/lib/api.ts` |
| Auth-Kontext | `src/context/AuthContext.tsx` |
| Typen | `src/api/types.ts`, `src/types/` |

### Design-Systeme

Es gibt **zwei getrennte** Systeme. Sie werden nicht vermischt.

| Bereich | System | CSS-Datei | Klassen |
|---|---|---|---|
| Haupt-Frontend | Glas | `src/index.css` | `.ui-*`, `.app-*`, `.glass-*` |
| AdminPanel | Split-Tone Operational | `src/admin.css` | `.admin-*` |

Beide werden in `src/main.tsx` importiert. Es gibt **keine** Klassenüberschneidung.
Details: `docs/15-ui-styleguide.md`

### Dev-Proxy

`frontend/vite.config.ts` leitet `/api` an `http://127.0.0.1:8000` weiter.
Dadurch sind im Frontend keine absoluten Backend-URLs nötig.

## 7. Authentifizierung

| | Normale Benutzer | Admin |
|---|---|---|
| Login | Personalnummer, **ohne** Passwort | Personalnummer **und** Passwort |
| Selbstregistrierung | nicht möglich | — |
| Token | JWT, kurze Lebensdauer | JWT |
| Anlage | ausschließlich durch Admin | — |

- Jeder geschützte Endpunkt prüft Authentifizierung und Autorisierung **serverseitig**.
- Das Ausblenden von Buttons im Frontend ist **keine** Sicherheitsmaßnahme.

> **Offen:** Das Sicherheitskonzept für den passwortlosen Personalnummer-Login ist
> noch nicht abschließend dokumentiert. Die technische Lösung darf die fachliche
> Vorgabe „kein Passwort" nicht eigenmächtig ändern.

## 8. Tests

| Art | Ort | Werkzeug |
|---|---|---|
| Backend-Service | `backend/tests/test_location_service.py` | Pytest (15 Tests) |
| E2E Login | `frontend/tests/login.spec.ts` | Playwright |
| E2E Lagerstruktur | `frontend/tests/admin-storage.spec.ts` | Playwright |

> **Offen:** Die Testabdeckung ist dünn. Nur die Lagerplatz-Logik hat
> Backend-Tests. Kritische Logik ohne Test: ID-Eindeutigkeit, Ausleihe und
> Rückgabe, Berechtigungen.

## 9. SAP

SAP ist **optional** und derzeit **nicht implementiert**. Es gibt keine
SAP-Bezüge im Backend. Der Core funktioniert vollständig ohne SAP.

Später ausschließlich über einen getrennten Integration Layer mit Adapter.

## 10. Bekannte technische Schulden

| Thema | Befund |
|---|---|
| CORS | fest auf zwei lokale Origins verdrahtet |
| `create_all` beim Start | kann Migrationen verschleiern |
| Testabdeckung | nur Lagerplatz-Logik hat Backend-Tests |
| `ToolFormModal.tsx` | toter Code, von keiner Stelle importiert |
| `tasks/06-security-and-permissions.md` | leer (nur Titelzeile) |
| Sicherheitskonzept Login | nicht abschließend dokumentiert |