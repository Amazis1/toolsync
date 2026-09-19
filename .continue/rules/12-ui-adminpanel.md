---
name: UI AdminPanel (Split-Tone Operational)
globs: ["**/pages/admin/**", "**/admin.css"]
description: Split-Tone-Design-System für das AdminPanel – verbindliche Tokens und Klassen
---

# UI AdminPanel – Split-Tone Operational

## Geltungsbereich

Dieses Design-System gilt **ausschließlich** für das AdminPanel
(`frontend/src/pages/admin/**`). Es gilt **nicht** für das Haupt-Frontend.

## Verbindliche Quelle

Die verbindliche Quelle ist **`frontend/src/admin.css`**.

Die Datei ist **vollständig**: sie enthält alle **94** `admin-*`-Klassen der Vorlage
wertgleich, plus 15 eigene Aliase und Helfer. Es fehlt **keine** Klasse.

`AdminPanel-Styleguide.html` im Projektwurzelverzeichnis ist die Herkunft dieses Systems,
wird aber **nicht gelesen** – 151 KB für Informationen, die in `admin.css` schon stehen.

## Nicht vermischen

Das Haupt-Frontend benutzt ein anderes System (Glas, `.ui-*`, `frontend/src/index.css`).
Eine Komponente benutzt **entweder** `.admin-*` **oder** `.ui-*`. Niemals beide.

Die folgenden Werte sind **nicht** gültig und dürfen nicht verwendet werden:
`#0f172a`, `#f1f5f9`, `#e2e8f0`, `rgba(255,255,255,.55)`, `font-weight 700` bei Buttons.
Diese Werte gehören zum Glas-System des Haupt-Frontends.

`admin.css` kapselt alles unter `.admin-shell` bzw. `.admin-*`.
Es gibt **keine** globalen `body`-Regeln – das restliche Frontend bleibt unberührt.

## Tokens

### Flächen und Rahmen

| Token | Wert | Bedeutung |
|---|---|---|
| `--admin-sidebar-bg` | `#0e1a1a` | Dunkle Sidebar |
| `--admin-content-bg` | `#f4f7f7` | Heller Content |
| `--admin-surface` | `#ffffff` | Kartenfläche |
| `--admin-surface-hover` | `#eff4f4` | Hover-Fläche |
| `--admin-surface-subtle` | `#f8fafa` | Subtile Fläche (Modal-Fuß) |
| `--admin-border` | `#dfe7e7` | Standardrahmen |
| `--admin-border-strong` | `#c3d1d1` | Input-Rahmen |
| `--admin-divider` | `#eef2f2` | Tabellenlinie |

### Text

| Token | Wert |
|---|---|
| `--admin-text` | `#0f172a` |
| `--admin-text-muted` | `#334747` |
| `--admin-text-subtle` | `#5d7070` |
| `--admin-placeholder` | gedämpfter Text-Farbwert |

### Status

| Token | Wert |
|---|---|
| `--admin-primary` | `#0f766e` |
| `--admin-success` | `#059669` |
| `--admin-warning` | `#b45309` |
| `--admin-danger` | `#e11d48` |
| `--admin-neutral` | `#64748b` |

### Form

| Token | Wert |
|---|---|
| `--admin-radius` | `.55rem` |
| `--admin-radius-sm` | `.45rem` |
| `--admin-radius-lg` | `.75rem` |
| `--admin-ring` | `rgba(15,118,110,.30)` |
| `--admin-shadow-1` | `0 1px 2px rgba(15,23,42,.04)` |
| `--admin-dur` | `.15s` |
| `--admin-ease` | `cubic-bezier(.4,0,.2,1)` |
| `--admin-font` | `Inter, system-ui, -apple-system, sans-serif` |

**Kein Dark Mode.** Dark Mode wird nicht gebraucht und wird nicht umgesetzt.

## Buttons (`.admin-btn`)

- `.admin-btn`: `inline-flex` · `gap .4rem` · `border-radius var(--admin-radius)` = **`.55rem`** · `padding .5rem .9rem` · `font-size .75rem` · **`font-weight 600`** · `border: 0`
- `.admin-btn-primary`: `background var(--admin-primary)` · `color var(--admin-on-primary)` · `box-shadow 0 1px 2px rgba(15,118,110,.30)`
- `.admin-btn-secondary`: `background var(--admin-surface)` = **`#ffffff`** · `color var(--admin-text-muted)` · `border 1px solid var(--admin-border-strong)` = **`#c3d1d1`** · `box-shadow var(--admin-shadow-1)`
- `.admin-btn-tertiary`: entspricht dem früheren `.admin-btn-ghost`
- `.admin-btn-danger`, `.admin-btn-danger-ghost`, `.admin-btn-group`, `.admin-btn-sm`: in `admin.css`

## Inputs (`.admin-input`, `.admin-select`, `.admin-textarea`)

- `width 100%` · `border 1px solid var(--admin-border-strong)` = `#c3d1d1` · `border-radius var(--admin-radius)` = **`.55rem`** · `padding .48rem .7rem` · `font-size .8125rem` · `background var(--admin-surface)` = `#ffffff` · `color var(--admin-text)`
- Placeholder: `color var(--admin-placeholder)`
- Hover (nicht disabled): `border-color var(--admin-input-hover-line)`
- Focus: `outline none` · `border-color var(--admin-primary)` · `box-shadow 0 0 0 3px var(--admin-ring)`
- Disabled: `background var(--admin-surface-hover)` · `color var(--admin-text-subtle)` · `cursor not-allowed` · `border-color var(--admin-border)`
- `.admin-input-error`: `border-color var(--admin-danger)` · `background var(--admin-danger-bg-soft)`

## Badges (`.admin-badge`)

- Basis: `inline-flex` · `gap .35rem` · `padding .2rem .55rem` · `border-radius 999px` · `font-size .6875rem` · **`font-weight 600`** · `white-space nowrap`
- `.admin-badge-success`: `background var(--admin-success-bg)` · `color var(--admin-success-fg)`
- `.admin-badge-danger`: `background var(--admin-danger-bg)` · `color var(--admin-danger-fg)`
- `.admin-badge-warning`: `background var(--admin-warning-bg)` · `color var(--admin-warning-fg)`
- `.admin-badge-neutral`: `background var(--admin-neutral-bg)` · `color var(--admin-neutral-fg)`
- `.admin-badge-primary`: `background var(--admin-primary-bg-soft)` · `color var(--admin-primary-fg-soft)`

Statuspunkte werden als `<span class="admin-dot"></span>` innerhalb des Badges gesetzt.

## Klassen-Vokabular

Alle verfügbaren `admin-*`-Klassen stehen in `frontend/src/admin.css`. Die wichtigsten Gruppen:

- **Layout**: `admin-shell`, `admin-sidebar`, `admin-sidebar-backdrop`, `admin-main`, `admin-topbar`, `admin-content`, `admin-page`, `admin-page-center`, `admin-page-center-inner`, `admin-page-actions`, `admin-page-icon`, `admin-page-code`, `admin-skip`, `admin-burger`
- **Navigation**: `admin-nav-group`, `admin-nav-item`, `admin-brand-mark`
- **Buttons**: `admin-btn`, `-primary`, `-secondary`, `-tertiary`, `-danger`, `-danger-ghost`, `-group`, `-sm`, `admin-icon-btn`
- **Formulare**: `admin-input`, `admin-select`, `admin-textarea`, `admin-input-error`, `admin-check`, `admin-hint`, `admin-hint-error`
- **Tabellen**: `admin-table`, `admin-table-compact`, `admin-table-sticky`, `admin-table-empty`, `admin-th-sort`, `admin-scroll-y`
- **Karten**: `admin-card`, `admin-kpi`, `admin-kpi-label`, `admin-kpi-value`, `admin-chart-card`, `admin-chart-header`, `admin-chart-title`, `admin-chart-sub`, `admin-chart-plot`, `admin-chart-yaxis`, `admin-chart-yaxis-labels`
- **Charts**: `admin-donut`, `admin-donut-value`, `admin-donut-caption`, `admin-spark`, `admin-bars`, `admin-bar`, `admin-bar-label`, `admin-bar-wrap`, `admin-legend`, `admin-legend-item`, `admin-empty-chart`, `admin-empty-icon`
- **Feedback**: `admin-alert`, `admin-alert-info`, `-success`, `-warning`, `-error`, `admin-toast`, `admin-toast-warning`, `admin-toast-error`, `admin-tip`, `admin-tip-bubble`, `admin-skel`
- **Modals**: `admin-modal-overlay`, `admin-modal`, `admin-modal-head`, `admin-modal-body`, `admin-modal-foot`
- **Weitere**: `admin-tabs`, `admin-chip`, `admin-filter-bar`, `admin-toolbar`, `admin-toolbar-divider`, `admin-btn-group`, `admin-switch`, `admin-avatar`, `admin-user-card`, `admin-auth-card`, `admin-dot`, `admin-bar`

## Konfliktregel

1. `frontend/src/admin.css` ist verbindlich.
2. Bei Unklarheit oder Widerspruch: **melden und fragen**, nicht eigenmächtig entscheiden.
3. Eine Klasse, die nicht in `admin.css` steht, wird **nicht erfunden**. Stattdessen nachfragen.
