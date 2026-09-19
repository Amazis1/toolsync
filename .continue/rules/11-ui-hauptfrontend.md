---
name: UI Haupt-Frontend (Glas)
globs: ["**/components/{auth,tools,movements,storage,serial-articles}/**", "**/index.css", "**/App.tsx"]
description: Glas-Design-System für das Haupt-Frontend – verbindliche Klassen und Werte
---

# UI Haupt-Frontend – Glas

## Geltungsbereich

Dieses Design-System gilt für das **gesamte Haupt-Frontend**. Es gilt **nicht** für das AdminPanel.

## Verbindliche Quelle

Die verbindliche Quelle ist **`frontend/src/index.css`**. Die Datei enthält alle hier
beschriebenen Klassen vollständig (36 von 36 Guide-Klassen, wertgleich).

`UI-Styleguide.html` im Projektwurzelverzeichnis ist die Herkunft dieses Systems, wird
aber **nicht gelesen** – 55 KB für Informationen, die in `index.css` schon stehen.

## Nicht vermischen

Das AdminPanel benutzt ein anderes System (Split-Tone, `.admin-*`, `frontend/src/admin.css`).
Eine Komponente benutzt **entweder** `.ui-*` **oder** `.admin-*`. Niemals beide.

## Werkzeuge

- Tailwind CSS v4 (`@import "tailwindcss"`, `@theme`, `@apply` ist erlaubt)
- **Kein** UI-Framework, **kein** shadcn/ui
- Kein Dark Mode

## Farben

- Primary: `#0f766e` (Deep Teal)
- Dunkler Text: `#0f172a`
- Danger: `#e11d48`
- Success: `#059669`-Bereich / `bg-emerald-600`
- Warning: `bg-amber-500`
- Info: `bg-sky-600`

## Glas-Effekte

| Klasse | Hintergrund | Blur | Border |
|---|---|---|---|
| `.app-sidebar` | `rgba(255,255,255,0.38)` | `blur(10px)` | rechts `1px solid rgba(255,255,255,0.6)` |
| `.app-content-block` | `rgba(255,255,255,0.48)` | `blur(8px)` | `1px solid rgba(255,255,255,0.7)` |
| `.glass-card` | `rgba(255,255,255,0.40)` | `blur(10px)` | `1px solid rgba(255,255,255,0.65)` |
| `.glass-preview-card` | `rgba(255,255,255,0.22)` | `blur(6px)` | `1px solid rgba(255,255,255,0.5)` |
| `.stat-card` | `rgba(255,255,255,0.50)` | `blur(12px)` | `1px solid rgba(255,255,255,0.60)` |

Bei reduzierter Transparenz (`prefers-reduced-transparency: reduce` oder `update: slow`)
werden alle `backdrop-filter` deaktiviert und der Hintergrund auf `rgba(255,255,255,0.92)` gesetzt.

## Buttons (`.ui-btn`)

- `.ui-btn`: `inline-flex` · `gap .5rem` · `border-radius .75rem` · `padding .55rem .9rem` · `font-size .75rem` · **`font-weight 700`** · `border: 0`
- `.ui-btn-primary`: `background #0f766e` · `color #fff` · `box-shadow 0 8px 20px rgba(15,118,110,.18)`
- `.ui-btn-secondary`: `background rgba(255,255,255,.55)` · `color #0f172a` · `border 1px solid rgba(255,255,255,.7)`
- `.ui-btn-ghost`: `background transparent` · `color #0f766e`
- `.ui-btn-danger`: `background #e11d48` · `color #fff`
- `.ui-btn-danger-soft`: `background rgba(225,29,72,.12)` · `color #9f1239` · `border rgba(225,29,72,.25)`
- `.ui-btn-sm`: `padding .35rem .65rem` · `font-size .7rem`
- Disabled: `opacity .45` · `cursor not-allowed`

## Inputs (kein backdrop-filter)

- `.input-bordered`: `border 1px solid rgba(15,118,110,.25)` · `border-radius .5rem` · `padding .45rem .75rem` · `background rgba(255,255,255,.55)` · `color #0f172a` · `font-weight 500`
- Hover: `background rgba(255,255,255,.72)` · `border rgba(15,118,110,.45)`
- Focus: `background rgba(255,255,255,.88)` · `border #0f766e` · `box-shadow 0 0 0 3px rgba(15,118,110,.15)`
- `.input-error`: `background rgba(239,68,68,.12)` · `border #ef4444`
- `.input-success`: `background rgba(34,197,94,.15)` · `border #22c55e`

## Tabs (`.ui-tabs`)

- Container: `display flex` · `gap .4rem` · `padding .25rem` · `border-radius .8rem` · `background rgba(255,255,255,.35)` · `border 1px solid rgba(255,255,255,.55)`
- Tab: `background transparent` · `color #64748b` · `font-size .72rem` · `font-weight 700`
- Aktiv (`.is-active`): `background #fff` · `color #0f766e` · `box-shadow 0 2px 8px rgba(15,23,42,.06)`

## Badges (`.ui-badge`)

- Basis: `inline-flex` · `gap .4rem` · `padding .15rem .65rem` · `border-radius 999px` · `font-size .7rem` · **`font-weight 700`** · `border 1px solid`
- `.ui-badge-success`: `background rgba(15,118,110,.12)` · `color #0f766e`
- `.ui-badge-warning`: `background rgba(245,158,11,.12)` · `color #92400e`
- `.ui-badge-danger`: `background rgba(225,29,72,.12)` · `color #9f1239`
- `.ui-badge-info`: `background rgba(59,130,246,.12)` · `color #1e40af`
- `.ui-badge-neutral`: `background rgba(148,163,184,.18)` · `color #475569`

## Alerts (`.ui-alert`)

- Basis: `display flex` · `gap .75rem` · `padding .75rem .9rem` · `border-radius .8rem` · `border 1px solid`
- `.ui-alert-info`: `background rgba(59,130,246,.08)` · `border rgba(59,130,246,.2)` · `color #1e3a8a`
- `.ui-alert-success`: `background rgba(16,185,129,.08)` · `border rgba(16,185,129,.2)` · `color #065f46`
- `.ui-alert-warning`: `background rgba(245,158,11,.1)` · `border rgba(245,158,11,.25)` · `color #92400e`
- `.ui-alert-error`: `background rgba(239,68,68,.08)` · `border rgba(239,68,68,.22)` · `color #991b1b`

## Weitere Klassen

- `.ui-switch`: `42x24px` · `border-radius 999px` · `background #cbd5e1` · `.is-on` → `background #0f766e`
- `.ui-pagination`: Links `30x30px` · `border-radius .6rem` · `.active` → `background #0f766e` · `color #fff`
- `.ui-progress`: `height 6px` · `border-radius 999px` · `background rgba(148,163,184,.28)` · Balken `#0f766e`
- `.ui-spinner`: `20x20px` · `border 2px rgba(15,118,110,.18)` · `border-top #0f766e` · Rotation `.8s linear infinite`
- `.ui-skeleton`: Gradient-Shimmer (`.15` → `.7` → `.15`) · `animation 1.4s ease-in-out infinite`
- `.ui-menu`: `background rgba(255,255,255,.9)` · `border rgba(255,255,255,.8)` · `box-shadow 0 18px 38px rgba(15,23,42,.12)`
- `.ui-breadcrumbs`: Links `color #0f766e` · `font-weight 700`
- `.ui-avatar`: `32x32px` · `border-radius 999px` · `background #0f766e` · `color #fff` · `font-weight 800`

## Modals

- `.modal-overlay`: `background rgba(15,23,42,.45)` · **kein** `backdrop-filter`
- `.modal-panel`: `background rgba(255,255,255,.8)` · `border 1px solid #fff` · `border-radius .85rem` · `box-shadow 0 20px 50px rgba(15,23,42,.18)` · `backdrop-filter blur(10px)`

## Icons (Lucide)

- Ausschließlich Lucide-Icons, **immer als Inline-SVG** (kein CDN, keine Icon-Font) – die Anwendung bleibt 100 % offline-fähig.
- Pflichtattribute: `xmlns="http://www.w3.org/2000/svg"` · `width="24"` · `height="24"` · `viewBox="0 0 24 24"` · `fill="none"` · `stroke="currentColor"` · `stroke-width="2"` · `stroke-linecap="round"` · `stroke-linejoin="round"`
- `viewBox` niemals anpassen. Größe ausschließlich über CSS-Klassen (`w-4 h-4` = 16px, `w-5 h-5` = 20px, `w-6 h-6` = 24px).
- `stroke="currentColor"` sorgt dafür, dass Icons die Farbe von `.ui-btn*` und `.ui-badge*` erben.

## Logos

Die Logos in der Sidebar (`logo-main`, `logo-text-hp`, `logo-text`) bleiben unverändert,
inklusive ihrer Animationen.

## Konfliktregel

1. `frontend/src/index.css` ist verbindlich.
2. Bei Unklarheit oder Widerspruch: **melden und fragen**, nicht eigenmächtig entscheiden.
3. Projektentscheidungen (DEC-021: einfach und robust) haben Vorrang vor Kosmetik.
