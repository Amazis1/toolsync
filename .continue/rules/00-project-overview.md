---
name: ToolSync Overview
alwaysApply: true
description: Projektüberblick – Zweck, Projektordner, Stack, harte Regeln
---

# ToolSync – Projektüberblick

## Was ist ToolSync?

Anwendung zur Verwaltung und Nachverfolgung von Werkzeugen: Ausleihe, Rückgabe, Bestand, Lagerorte, Werkzeugtypen, Serienartikel.

## Projektordner

Es gibt genau einen Projektordner:

| Pfad | Bedeutung | Zugriff |
|---|---|---|
| `D:\toolsync` | Aktives Entwicklungsprojekt | READ + WRITE |

Außerhalb von `D:\toolsync` wird nichts geschrieben, gelesen oder verändert.

## Harte Regeln

- Neue Features und Fixes gehören ausschließlich nach `D:\toolsync`.
- SAP ist optional – ToolSync muss ohne SAP vollständig funktionieren.
- Geschäftslogik gehört ins Backend, nicht nur ins Frontend.
- Vor größeren Änderungen erst analysieren und planen, dann umsetzen.

## Verbindlicher Stack

Das ist der umgesetzte Stack, nicht ein Vorschlag:

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Design: zwei getrennte eigene CSS-Systeme, **kein** UI-Framework und **kein** shadcn/ui
  - Haupt-Frontend: Glas → `frontend/src/index.css`, Klassen `.ui-*`, `.app-*`, `.glass-*`
  - AdminPanel: Split-Tone Operational → `frontend/src/admin.css`, Klassen `.admin-*`
- Backend: FastAPI, Pydantic, SQLAlchemy 2.0
- Datenbank: PostgreSQL, Migrationen über Alembic
- Tests: Pytest, Playwright

Keine neue Dependency und kein UI-Framework hinzufügen, ohne dass es vorher entschieden wurde.

## Login (Überblick)

- Login über **Personalnummer**, kein Passwort, keine Selbstregistrierung.
- Benutzer werden vom **Admin** angelegt.
- Rollen und Berechtigungen steuern, was ein Benutzer sehen und tun darf.

## Fachliche Grundlagen

- Serienartikel sind PDF-basierte Einrichtepläne.
- Matrize und Abstreifer sind **keine** Werkzeugtypen.
- Verbindliche fachliche Quelle: `docs/01-requirements.md`.
