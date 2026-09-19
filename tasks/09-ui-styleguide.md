# Task 09: UI-Styleguide – Verbindlich umsetzen (COMPLETED)

> **Hinweis (nachträglich):** Die damals erstellte Regel `.continue/rules/11-ui-styleguide.md`
> wurde zerlegt in `.continue/rules/11-ui-hauptfrontend.md` (Glas) und
> `.continue/rules/12-ui-adminpanel.md` (Split-Tone). Grund: die alte Regel beschrieb
> für das AdminPanel das **falsche** Design-System (`#0f172a`/`#f1f5f9`/`#e2e8f0` statt
> `#0e1a1a`/`#f4f7f7`/`#dfe7e7`). Der Glas-Teil der alten Regel war korrekt.

## Ziel

Das gesamte Frontend (außer AdminPanel und Logos) wurde visuell auf den verbindlichen Styleguide umgestellt:

- `UI-Styleguide.html` – verbindlich für das gesamte ToolSync-Frontend (außer AdminPanel) ✓
- `AdminPanel-Styleguide.html` – verbindlich nur für das AdminPanel (Umsetzung folgt in einem späteren Task) ✓

## Grundsätze

- **Struktur bleibt:** Sidebar, Tabbar, Content-Block, Anlege-Formular, Login – alles bleibt an der gleichen Stelle. ✓
- **Nur visuelle Anpassung** – keine funktionalen Änderungen. ✓
- **Logos bleiben unverändert.** ✓
- **AdminPanel wird NICHT angefasst.** ✓
- **ToolFormModal.tsx wird NICHT angefasst** (Status: OFFEN). ✓
- Konflikte wurden gemeldet und geklärt – nicht eigenmächtig entschieden. ✓

## Task-Status

| Schritt | Status |
|---|---|
| 09.1 Regel-Datei `.continue/rules/11-ui-styleguide.md` | DONE |
| 09.2 Doku `docs/15-ui-styleguide.md` | DONE |
| 09.3 CSS-Basis `src/index.css` aktualisieren | DONE |
| 09.4 `App.tsx` – Tabbar, Statistik-Sidebar, + Anlegen | DONE |
| 09.5 `LoginForm.tsx` | DONE |
| 09.6 `ToolForm.tsx` | DONE |
| 09.7 `ToolList.tsx` | DONE |
| 09.8 `LendModal.tsx` | DONE |
| 09.9 `StorageItemList.tsx` + `StorageItemForm.tsx` | DONE |
| 09.10 `SerialArticleList.tsx` + `SerialArticleUpload.tsx` + `PDFViewer.tsx` | DONE |
| 09.11 Build prüfen (`npm run build`) | DONE – fehlerfrei (45 modules, vite v8.1.5) |
| 09.12 Completion Gate | DONE – bestanden |

## Was wurde umgesetzt

### CSS-Basis (`src/index.css`)

- Styleguide-Glass-Werte: `.app-sidebar` (0.38/blur10), `.app-content-block` (0.48/blur8), `.glass-card` (0.40/blur10), `.glass-preview-card` (0.22/blur6), `.stat-card` (0.50/blur12)
- Performance-Optimierung: `isolation: isolate; contain: layout style paint; transform: translateZ(0)`
- Inputs: Teal-Border, kein backdrop-filter, Font-Weight 500
- Neue `.ui-btn*`-Klassen (primary, secondary, ghost, danger, danger-soft, sm)
- Neue `.ui-tabs`-Klassen mit `.is-active`
- Neue `.ui-alert*`-Klassen (info, success, warning, error)
- Neue `.ui-badge*`-Klassen (success, warning, danger, info, neutral)
- Neue `.ui-switch`, `.ui-pagination`, `.ui-progress`, `.ui-spinner`, `.ui-skeleton`
- Neue `.ui-menu`, `.ui-breadcrumbs`, `.ui-avatar`
- Neue `.modal-overlay`, `.modal-panel`
- Fallback für `prefers-reduced-transparency` / `update: slow`

### Komponenten

| Komponente | Änderungen |
|---|---|
| `App.tsx` | Tabbar auf `.ui-tabs`, Statistik-Sidebar auf `.stat-card` mit Glow + Icons, + Anlegen auf `.ui-btn ui-btn-primary` |
| `LoginForm.tsx` | `.ui-tabs`, `.input-bordered`, `.ui-alert ui-alert-error`, `.ui-btn ui-btn-primary` |
| `ToolForm.tsx` | `.ui-btn ui-btn-secondary` / `.ui-btn ui-btn-primary`, `.ui-alert`, Accent auf Teal-700 |
| `ToolList.tsx` | `.ui-badge`, `.ui-btn` (primary/secondary/danger-soft), `.ui-alert`, `.ui-spinner`, `.input-bordered`, `.select-bordered` |
| `LendModal.tsx` | `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn` |
| `StorageItemList.tsx` | `.ui-badge` (warning/neutral), `.ui-btn`, `.ui-alert`, `.ui-spinner`, `.input-bordered` |
| `StorageItemForm.tsx` | `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn`, Accent auf Teal-700 |
| `SerialArticleList.tsx` | `.ui-badge` (success/neutral), `.ui-btn`, `.ui-alert`, `.ui-spinner`, `.input-bordered` |
| `SerialArticleUpload.tsx` | `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn` |
| `PDFViewer.tsx` | `.modal-overlay`, `.modal-panel`, `.ui-btn`, `.ui-spinner`, `.ui-alert` |

## Nicht angefasst

- `AdminPanel.tsx` – bleibt im aktuellen Zustand (Split-Tone-Umsetzung folgt in späterem Task)
- `AdminUsers.tsx` – bleibt im aktuellen Zustand
- `AdminToolTypes.tsx` – bleibt im aktuellen Zustand
- `AdminStammdaten.tsx` – bleibt im aktuellen Zustand
- `ToolFormModal.tsx` – Status OFFEN (Entscheidung folgt)
- Logos in der Sidebar – bleiben unverändert

## Definition of Done

1. ✅ Alle oben genannten Komponenten sind auf den Styleguide umgestellt.
2. ✅ `npm run build` läuft fehlerfrei durch (45 modules, vite v8.1.5).
3. ✅ Keine funktionalen Änderungen (nur Visuelles).
4. ✅ AdminPanel und Logos unverändert.
5. ✅ Konflikte wurden gemeldet und geklärt.
6. ✅ Diese Task-Datei ist vollständig abgehakt.
