---
name: Frontend
globs: ["**/*.tsx", "**/*.css"]
description: Frontend-Regeln – SPA, Struktur, UX, Design-Zuordnung
---

# Frontend

## Grundsätze

- **SPA** mit React 19, TypeScript, Vite, Tailwind CSS v4
- **Kein UI-Framework und kein shadcn/ui** – die UI ist eine eigene CSS-Klassenschicht
- Bestehendes Design und UX erhalten und erweitern, nicht willkürlich neu erfinden
- Responsive: Desktop und sinnvolle Nutzung auf kleineren Viewports

## Design-Systeme (nicht vermischen)

| Bereich | System | CSS-Datei | Klassen |
|---|---|---|---|
| Haupt-Frontend | Glas | `frontend/src/index.css` | `.ui-*`, `.app-*`, `.glass-*`, `.input-*`, `.modal-*` |
| AdminPanel | Split-Tone Operational | `frontend/src/admin.css` | `.admin-*` |

- Beide Dateien werden in `frontend/src/main.tsx` importiert und sind sauber getrennt.
- Eine Komponente benutzt **entweder** `.ui-*` **oder** `.admin-*`, niemals gemischt.
- Verbindliche Klassen- und Token-Referenz ist die jeweilige CSS-Datei selbst. Die HTML-Guides im Projektwurzelverzeichnis werden dafür **nicht** gelesen.
- Keine Dark-Mode-Varianten; Dark Mode wird nicht gebraucht.

## Struktur

- Klare Trennung: Seiten/Views, Komponenten, API-Client, State
- Wiederverwendbare UI-Komponenten statt Copy-Paste
- Loading-, Leer- und Fehlerzustände bewusst behandeln
- Kein toter Code: ungenutzte Dateien und Vite-Vorlagen entfernen statt liegen lassen

## UX

- Aktionen (Ausleihe, Speichern, Löschen) mit klarer Rückmeldung
- Formulare mit verständlicher Validierung
- Admin-UI und Benutzer-UI nach Rechten unterscheiden

## Technik

- TypeScript verwenden, Typen zentral in `src/api/types.ts` und `src/types/`
- API-Aufrufe zentral und typsicher halten (`src/api/`, `src/lib/api.ts`)
- Keine unnötigen Dependencies
- Keine Secrets im Frontend-Code
