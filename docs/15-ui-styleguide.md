# ToolSync UI Styleguide – Verbindliche Referenz

> **Status: VERBINDLICH.**
>
> Dieses Dokument beschreibt die **zwei getrennten Design-Systeme** von ToolSync.
> Es ist die Kurzreferenz. Die **vollständigen** Werte stehen in den CSS-Dateien selbst.

## 0. Wo die Wahrheit steht

| System | Gilt für | Verbindliche Quelle | Regel |
|---|---|---|---|
| **Glas** | Haupt-Frontend | `frontend/src/index.css` | `.continue/rules/11-ui-hauptfrontend.md` |
| **Split-Tone Operational** | AdminPanel | `frontend/src/admin.css` | `.continue/rules/12-ui-adminpanel.md` |

Die HTML-Dateien `UI-Styleguide.html` (55 KB) und `AdminPanel-Styleguide.html` (151 KB)
im Projektwurzelverzeichnis sind die **Herkunft** dieser Systeme. Sie werden für die
tägliche Arbeit **nicht gelesen** — beide Systeme sind bereits vollständig in den
CSS-Dateien umgesetzt:

| System | Klassen in der Vorlage | In der CSS-Datei umgesetzt |
|---|---|---|
| Glas | 36 | **36 von 36** |
| Split-Tone | 94 | **94 von 94** |

> **Wichtig:** Die beiden Systeme dürfen **nicht vermischt** werden. Eine Komponente
> benutzt entweder `.ui-*` **oder** `.admin-*`. Niemals beide.

---

## 1. System A – Glas (Haupt-Frontend)

Glasflächen über einem farbigen Verlaufshintergrund. Umgesetzt in
`frontend/src/index.css` mit Tailwind v4.

### 1.1 Farben

| Token | Wert | Verwendung |
|---|---|---|
| Primary | `#0f766e` | Buttons, aktive Tabs, Badges, Fokus |
| Primary Hover | `#115e59` | Button-Hover |
| Text | `#0f172a` | Primärtext |
| Text Muted | `#64748b` | Sekundärtext |
| Danger | `#e11d48` | Löschen, Fehler |
| Success | `#10b981` / `#065f46` | Erfolg, Verfügbar |
| Warning | `#f59e0b` / `#92400e` | Hinweis, Wartung |
| Info | `#3b82f6` / `#1e3a8a` | Ausgeliehen, Info |
| Background | `#c5cbd3` | Seitenhintergrund |

### 1.2 Glasflächen

| Klasse | Background | Blur | Border |
|---|---|---|---|
| `.app-sidebar` | `rgba(255,255,255,0.38)` | `10px` | `rgba(255,255,255,0.6)` |
| `.app-content-block` | `rgba(255,255,255,0.48)` | `8px` | `rgba(255,255,255,0.7)` |
| `.glass-card` | `rgba(255,255,255,0.40)` | `10px` | `rgba(255,255,255,0.65)` |
| `.glass-preview-card` | `rgba(255,255,255,0.22)` | `6px` | `rgba(255,255,255,0.5)` |
| `.stat-card` | `rgba(255,255,255,0.50)` | `12px` | `rgba(255,255,255,0.60)` |

**Fallback:** Bei `prefers-reduced-transparency: reduce` oder `update: slow` wird kein
`backdrop-filter` verwendet und der Hintergrund auf `rgba(255,255,255,0.92)` gesetzt.

### 1.3 Inputs

| Zustand | Background | Border | Sonstiges |
|---|---|---|---|
| Normal | `rgba(255,255,255,0.55)` | `rgba(15,118,110,0.25)` | Radius `0.5rem`, Padding `0.45rem 0.75rem`, Font-Weight `500` |
| Hover | `rgba(255,255,255,0.72)` | `rgba(15,118,110,0.45)` | — |
| Focus | `rgba(255,255,255,0.88)` | `#0f766e` | `box-shadow 0 0 0 3px rgba(15,118,110,0.15)` |
| Error | `rgba(239,68,68,0.12)` | `#ef4444` | — |
| Success | `rgba(34,197,94,0.15)` | `#22c55e` | — |

**Kein `backdrop-filter` auf Inputs.**

### 1.4 Buttons

| Klasse | Werte |
|---|---|
| `.ui-btn` | `inline-flex` · `gap .5rem` · `border-radius .75rem` · `padding .55rem .9rem` · `font-size .75rem` · **`font-weight 700`** |
| `.ui-btn-primary` | `background #0f766e` · `color #fff` · `box-shadow 0 8px 20px rgba(15,118,110,.18)` |
| `.ui-btn-primary:hover` | `background #115e59` · `transform translateY(-1px)` |
| `.ui-btn-secondary` | `background rgba(255,255,255,.55)` · `color #0f172a` · `border 1px solid rgba(255,255,255,.7)` |
| `.ui-btn-ghost` | `background transparent` · `color #0f766e` |
| `.ui-btn-danger` | `background #e11d48` · `color #fff` |
| `.ui-btn-danger-soft` | `background rgba(225,29,72,.12)` · `color #9f1239` · `border rgba(225,29,72,.25)` |
| `.ui-btn-sm` | `padding .35rem .65rem` · `font-size .7rem` |
| `.ui-btn:disabled` | `opacity .45` · `cursor not-allowed` · `transform none` |

### 1.5 Tabs, Alerts, Badges

```css
.ui-tabs { display:flex; gap:.4rem; padding:.25rem; border-radius:.8rem;
           background:rgba(255,255,255,.35); border:1px solid rgba(255,255,255,.55); }
.ui-tabs button { border:0; border-radius:.65rem; padding:.45rem .7rem; background:transparent;
                  color:#64748b; font-size:.72rem; font-weight:700; white-space:nowrap; }
.ui-tabs button.is-active { background:#fff; color:#0f766e; box-shadow:0 2px 8px rgba(15,23,42,.06); }

.ui-alert { display:flex; gap:.75rem; align-items:flex-start; padding:.75rem .9rem;
            border-radius:.8rem; border:1px solid; font-size:.72rem; }
.ui-alert-info    { background:rgba(59,130,246,.08);  border-color:rgba(59,130,246,.2);  color:#1e3a8a; }
.ui-alert-success { background:rgba(16,185,129,.08);  border-color:rgba(16,185,129,.2);  color:#065f46; }
.ui-alert-warning { background:rgba(245,158,11,.1);   border-color:rgba(245,158,11,.25); color:#92400e; }
.ui-alert-error   { background:rgba(239,68,68,.08);   border-color:rgba(239,68,68,.22);  color:#991b1b; }

.ui-badge { display:inline-flex; align-items:center; gap:.4rem; padding:.15rem .65rem;
            border-radius:999px; font-size:.7rem; font-weight:700; border:1px solid; }
.ui-badge-success { background:rgba(15,118,110,.12);  color:#0f766e; border-color:rgba(15,118,110,.25); }
.ui-badge-warning { background:rgba(245,158,11,.12);  color:#92400e; border-color:rgba(245,158,11,.25); }
.ui-badge-danger  { background:rgba(225,29,72,.12);   color:#9f1239; border-color:rgba(225,29,72,.25); }
.ui-badge-info    { background:rgba(59,130,246,.12);  color:#1e40af; border-color:rgba(59,130,246,.25); }
.ui-badge-neutral { background:rgba(148,163,184,.18); color:#475569; border-color:rgba(148,163,184,.3); }
```

### 1.6 Weitere Klassen

| Klasse | Beschreibung |
|---|---|
| `.ui-switch` | 42×24px Toggle, `.is-on` → `#0f766e` |
| `.ui-pagination` | 30×30px Links, `.active` → `#0f766e` |
| `.ui-progress` | 6px Höhe, Balken `#0f766e` |
| `.ui-spinner` | 20×20px, Border-Top `#0f766e`, Rotation `.8s linear infinite` |
| `.ui-skeleton` | Gradient-Shimmer, Animation `1.4s ease-in-out infinite` |
| `.ui-menu` | Dropdown, Shadow `0 18px 38px rgba(15,23,42,.12)` |
| `.ui-breadcrumbs` | Links `#0f766e`, Font-Weight `700` |
| `.ui-avatar` | 32×32px, BG `#0f766e`, weiß, Font-Weight `800` |
| `.modal-overlay` | `rgba(15,23,42,0.45)`, **kein** `backdrop-filter` |
| `.modal-panel` | `rgba(255,255,255,.8)`, Radius `.85rem`, Blur `10px`, Shadow `0 20px 50px` |

### 1.7 Icons

Ausschließlich **Lucide-Icons als Inline-SVG** — kein CDN, keine Icon-Font, damit die
Anwendung 100 % offline-fähig bleibt.

Pflichtattribute: `xmlns` · `width="24"` · `height="24"` · `viewBox="0 0 24 24"` ·
`fill="none"` · `stroke="currentColor"` · `stroke-width="2"` · `stroke-linecap="round"` ·
`stroke-linejoin="round"`.

`viewBox` niemals ändern. Größe nur über CSS-Klassen (`w-4 h-4` = 16px, `w-5 h-5` = 20px,
`w-6 h-6` = 24px).

---

## 2. System B – Split-Tone Operational (AdminPanel)

Dunkle Sidebar für Navigation, heller Content für Daten. Die Grautöne sind leicht ins
Grüne gezogen, damit sie zur Primärfarbe gehören statt sie zufällig zu begleiten.
Umgesetzt in `frontend/src/admin.css`.

> **Korrektur gegenüber früheren Versionen dieses Dokuments:**
> Die folgenden Werte waren hier **falsch** und sind jetzt korrigiert:

| Token | Falsch (alt) | Richtig |
|---|---|---|
| Sidebar-BG | `#0f172a` | **`#0e1a1a`** |
| Content-BG | `#f1f5f9` | **`#f4f7f7`** |
| Border | `#e2e8f0` | **`#dfe7e7`** |
| Button-Radius | `.75rem` | **`.55rem`** |
| Button-Padding | `.55rem .9rem` | **`.5rem .9rem`** |
| Button-Font-Weight | `700` | **`600`** |
| `.admin-btn-secondary` | Glas `rgba(255,255,255,.55)` | **`#ffffff`**, Border **`#c3d1d1`** |

Die alten Werte gehören zum **Glas-System** des Haupt-Frontends und dürfen im AdminPanel
nicht verwendet werden.

### 2.1 Flächen und Rahmen

| Token | Wert | Bedeutung |
|---|---|---|
| `--admin-sidebar-bg` | `#0e1a1a` | Dunkle Sidebar |
| `--admin-content-bg` | `#f4f7f7` | Heller Content |
| `--admin-surface` | `#ffffff` | Kartenfläche |
| `--admin-surface-hover` | `#eff4f4` | Hover-Fläche |
| `--admin-surface-subtle` | `#f8fafa` | Subtile Fläche |
| `--admin-border` | `#dfe7e7` | Standardrahmen |
| `--admin-border-strong` | `#c3d1d1` | Input-Rahmen |
| `--admin-divider` | `#eef2f2` | Tabellenlinie |

### 2.2 Text, Status, Form

| Token | Wert |
|---|---|
| `--admin-text` | `#0f172a` |
| `--admin-text-muted` | `#334747` |
| `--admin-text-subtle` | `#5d7070` |
| `--admin-primary` | `#0f766e` |
| `--admin-success` | `#059669` |
| `--admin-warning` | `#b45309` |
| `--admin-danger` | `#e11d48` |
| `--admin-neutral` | `#64748b` |
| `--admin-radius` | `.55rem` |
| `--admin-ring` | `rgba(15,118,110,.30)` |
| `--admin-shadow-1` | `0 1px 2px rgba(15,23,42,.04)` |
| `--admin-dur` | `.15s` |
| `--admin-ease` | `cubic-bezier(.4,0,.2,1)` |

### 2.3 Buttons und Inputs

| Klasse | Werte |
|---|---|
| `.admin-btn` | `inline-flex` · `gap .4rem` · `border-radius .55rem` · `padding .5rem .9rem` · `font-size .75rem` · **`font-weight 600`** · `border 0` |
| `.admin-btn-primary` | `background var(--admin-primary)` · `box-shadow 0 1px 2px rgba(15,118,110,.30)` |
| `.admin-btn-secondary` | `background #ffffff` · `color var(--admin-text-muted)` · `border 1px solid #c3d1d1` |
| `.admin-input` / `-select` / `-textarea` | `border 1px solid #c3d1d1` · `border-radius .55rem` · `padding .48rem .7rem` · `font-size .8125rem` · `background #ffffff` |
| Focus | `border-color var(--admin-primary)` · `box-shadow 0 0 0 3px var(--admin-ring)` |
| `.admin-badge` | `padding .2rem .55rem` · `border-radius 999px` · `font-size .6875rem` · **`font-weight 600`** |

### 2.4 Umfang

`frontend/src/admin.css` enthält **109** `admin-*`-Klassen: alle **94** Klassen der Vorlage
plus 15 Aliase und Helfer (u. a. `admin-btn-ghost` → Tertiary, `admin-row-actions*`,
`admin-inline-panel*`, `admin-text*`, `admin-surface-sub`, `admin-line*`).

> **Wichtig:** Eine `admin-*`-Klasse, die nicht in `admin.css` steht, wird **nicht
> erfunden**. Stattdessen nachfragen.

### 2.5 Kein Dark Mode

Dark Mode wird nicht gebraucht. Der frühere `html[data-theme="dark"]`-Block wurde
entfernt; er definierte keine eigene Variable und wurde von keiner Stelle gesetzt.
Die `prefers-color-scheme`-Umschaltung in `index.css` wurde ebenfalls entfernt.

---

## 3. Abgrenzung in einem Satz

| | Haupt-Frontend | AdminPanel |
|---|---|---|
| System | Glas | Split-Tone Operational |
| CSS | `index.css` | `admin.css` |
| Klassen | `.ui-*`, `.app-*`, `.glass-*` | `.admin-*` |
| Charakter | Transparent, weich, heller Verlaufs-Hintergrund | Dunkle Sidebar, heller Content, solide Karten |
| Button-Gewicht | `700` | `600` |
| Button-Radius | `.75rem` | `.55rem` |

---

## 4. Konfliktregel

1. Die jeweilige **CSS-Datei** ist verbindlich (`index.css` bzw. `admin.css`).
2. Die passende Continue Rule ist `11-ui-hauptfrontend` bzw. `12-ui-adminpanel`.
3. Widersprüche oder Unklarheiten werden **gemeldet und geklärt** — nie eigenmächtig entschieden.
4. Die Logos in der Sidebar (`logo-main`, `logo-text-hp`, `logo-text`) bleiben unverändert,
   inklusive ihrer Animationen.
5. Die HTML-Vorlagen im Wurzelverzeichnis werden **nicht** geändert und **nicht** gelesen.
