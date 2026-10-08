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

> **Zusätzlich (nicht aus der Vorlage):** `index.css` enthält fünf Ergänzungen, die
> erst im Betrieb gebraucht wurden und hier in §1.6 dokumentiert sind — die
> deaktivierten und fokussierten Zustände von `.ui-pagination`, `.ui-segments`
> (segmentierte Filtergruppe aus nativen Kontrollkästchen/Radios), `.ui-menu-left`
> (Menü-Einfahrt von rechts nach links) und `.table-row-glass` (schwacher
> Glasverlauf für Tabellenzeilen, abgeleitet aus dem Verlauf von `.glass-card`).
> Die Zahlen oben zählen weiterhin nur die Klassen der Vorlage.
>
> **Nachtrag:** Die Toast-Klassen der Vorlage (`.ui-toast-stack`, `.ui-toast`,
> `-success/-error/-warning/-info`, `.ui-toast-life`) sind jetzt ebenfalls
> umgesetzt — sie fehlten bis dahin in `index.css`. Zwei Werte weichen bewusst
> ab: Schriftgröße `.8rem` statt `.72rem` (§1.8) und der Schließen-Knopf ist ein
> Icon statt des „×"-Zeichens (Audit A-10).

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
| **Primary als Textfarbe** | `#115e59` | Textrollen der Primärfarbe (aktiver Tab, Ghost-Button, Breadcrumb-Link) – siehe §1.8 |
| Text | `#0f172a` | Primärtext (Ebene 1) |
| Text Sekundär | `#334155` | Feldbeschriftungen, Werte (Ebene 2) |
| Text Muted | `#475569` | Hinweise, Sekundärtext, inaktive Tabs (Ebene 3) |
| Danger | `#e11d48` | Löschen, Fehler |
| Danger als Text | `#9f1239` | Fehler- und Gefahrtext |
| Success | `#10b981` / `#065f46` | Erfolg, Verfügbar |
| Warning | `#f59e0b` / `#92400e` | Hinweis, Wartung |
| Info | `#3b82f6` / `#1e3a8a` | Ausgeliehen, Info |
| Background | `#c5cbd3` | Seitenhintergrund |

> **Textskala:** Im Haupt-Frontend gibt es genau **drei** Textstufen (Ebene 1/2/3, siehe §1.8).
> Kein anderer Grauton ist für Text zulässig; die Werte erreichen auf den Glasflächen
> mindestens 6:1.

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
                  color:#475569; font-size:.72rem; font-weight:700; white-space:nowrap; }
.ui-tabs button.is-active { background:#fff; color:#115e59; box-shadow:0 2px 8px rgba(15,23,42,.06); }

.ui-alert { display:flex; gap:.75rem; align-items:flex-start; padding:.75rem .9rem;
            border-radius:.8rem; border:1px solid; font-size:.8rem; }
.ui-alert-info    { background:rgba(59,130,246,.08);  border-color:rgba(59,130,246,.2);  color:#1e3a8a; }
.ui-alert-success { background:rgba(16,185,129,.08);  border-color:rgba(16,185,129,.2);  color:#065f46; }
.ui-alert-warning { background:rgba(245,158,11,.1);   border-color:rgba(245,158,11,.25); color:#92400e; }
.ui-alert-error   { background:rgba(239,68,68,.08);   border-color:rgba(239,68,68,.22);  color:#991b1b; }

.ui-badge { display:inline-flex; align-items:center; gap:.4rem; padding:.15rem .65rem;
            border-radius:999px; font-size:.7rem; font-weight:700; border:1px solid; }
.ui-badge-success { background:rgba(15,118,110,.12);  color:#115e59; border-color:rgba(15,118,110,.25); }
.ui-badge-warning { background:rgba(245,158,11,.12);  color:#92400e; border-color:rgba(245,158,11,.25); }
.ui-badge-danger  { background:rgba(225,29,72,.12);   color:#9f1239; border-color:rgba(225,29,72,.25); }
.ui-badge-info    { background:rgba(59,130,246,.12);  color:#1e40af; border-color:rgba(59,130,246,.25); }
.ui-badge-neutral { background:rgba(148,163,184,.18); color:#475569; border-color:rgba(148,163,184,.3); }
/* Größere Ausführung: für Abzeichen, die ALLEIN stehen (z. B. Tastenhinweis
   „Esc"), nicht als Beisatz zu einem Text. Die Icon-Größe kommt aus der Klasse
   (1.05rem), nicht aus `h-3.5 w-3.5` im Markup – sonst gewinnt die Utility. */
.ui-badge-lg { gap:.45rem; padding:.3rem .85rem; font-size:.78rem; }
.ui-badge-lg > svg { width:1.05rem; height:1.05rem; }
```

### 1.6 Weitere Klassen

| Klasse | Beschreibung |
|---|---|
| `.ui-switch` | 42×24px Toggle, `.is-on` → `#0f766e` |
| `.ui-pagination` | 30×30px Links, `.active` / `[aria-current="page"]` → `#0f766e`; **Ergänzung:** `:disabled` (Deckkraft .35, `not-allowed`) und `:focus-visible` (2px Teal-Rahmen) – die Vorlage kannte keinen deaktivierten Zustand, am ersten und letzten Blatt sind die Randknöpfe aber wirkungslos |
| `.ui-segments` | **Ergänzung:** segmentierte Filtergruppe über der Liste – gleiche Maße wie `.ui-tabs`, aber `label` mit verstecktem nativem `input` (Kontrollkästchen/Radio als Fläche über dem Segment). Aktiv: `:has(input:checked)` → weiße Fläche, `#115e59`, Tab-Schatten. Schriftgröße `.8rem` (12,8px) statt `.72rem`, weil Guide §1.8 12px als Untergrenze setzt |
| `.ui-menu-left` | **Ergänzung:** Einfahrt eines Menüs von rechts nach links (`translateX(10px)` → 0, `.14s`), für Menüs deren rechte Kante auf dem auslösenden Knopf liegt; Animation über `prefers-reduced-motion: no-preference` geschützt |
| `.ui-toast-stack` / `.ui-toast` | **Nachtrag (aus der Vorlage, war nicht umgesetzt):** Stapel unten rechts (`min(23rem, 100vw - 3rem)`, `z-index 60`), Toast `rgba(255,255,255,.94)` mit farbiger linker Kante je Variante, `.ui-toast-life` als Fortschrittsbalken (`currentColor`, 2 px), Animationen `ui-toast-in` / `ui-toast-out` nur bei `no-preference`. `role="status"` + `aria-live="polite"` am Stapel; Schließen-Knopf als Icon (§A-10). **Abweichung:** `pointer-events: none` auf `.ui-toast` (nur der Schließen-Knopf fängt Klicks) — sonst liegt der Toast nach dem Speichern über dem Speichern-Knopf und schluckt den nächsten Klick |
| `.ui-toast-*` | `-success` `#0f766e` · `-error` `#9f1239` · `-warning` `#b45309` · `-info` `#1d4ed8`; das Icon übernimmt die Variantfarbe |
| `.table-row-glass` | **Ergänzung:** schwacher diagonaler Glasverlauf für Tabellenzeilen (`linear-gradient(135deg, rgba(255,255,255,.30), rgba(220,220,220,.14))`) — dieselbe Richtung und Farbfamilie wie `.glass-card`, aber nur etwa halb so stark. Als `background-image` liegt er über `background-color` (Zebra, Hover, Statusfarben), die dadurch sichtbar bleiben |
| `.ui-segments` in der Kopfzeile | Einsatz: Kategorie (Kontrollkästchen), Werk (Radio), Favoriten (Umschalter) in der Zeile mit der Überschrift „Werkzeuge“, mit Trennstrichen (`bg-white/70`, 1×24 px) zwischen den Gruppen ab `lg` |
| `.ui-progress` | 6px Höhe, Balken `#0f766e` |
| `.ui-spinner` | 20×20px, Border-Top `#0f766e`, Rotation `.8s linear infinite` |
| `.ui-skeleton` | Gradient-Shimmer, Animation `1.4s ease-in-out infinite` |
| `.ui-menu` | Dropdown, Shadow `0 18px 38px rgba(15,23,42,.12)` |
| `.ui-breadcrumbs` | Links `#115e59`, Font-Weight `700` |
| `.ui-avatar` | 32×32px, BG `#0f766e`, weiß, Font-Weight `800` |
| `.modal-overlay` | `rgba(15,23,42,0.45)`, **kein** `backdrop-filter` |
| `.modal-panel` | `rgba(255,255,255,.8)`, Radius `.85rem`, Blur `10px`, Shadow `0 20px 50px` |

### 1.7 Icons

Ausschließlich **Lucide** — kein CDN, keine Icon-Font, damit die Anwendung 100 %
offline-fähig bleibt.

**Bezug über npm, nicht über kopierte Pfade.** Die Icons kommen aus dem Paket
`lucide-react` (`package.json`, eine Zeile): nach **einem** `npm install` mit Internet
liegen sie in `node_modules` und werden beim Bauen Teil des JavaScript-Bundles — wie jeder
andere Programmtext. Danach läuft `npm run build` ohne Netz. Ohne `node_modules` baut
nichts; das gilt für React genauso. Ein `<script>`-Tag auf eine fremde URL ist **nie**
zulässig — damit hinge die Oberfläche am Netz.

**Was das Paket liefert:** `lucide-react` rendert echtes **Inline-SVG** (ein `<svg>` im
DOM, kein Bild, keine Schrift) und setzt die Pflichtattribute selbst. Prüfbar am
Quelltext: die Dateien unter `src/` enthalten keine einzige externe URL; die beiden
`fetch`-Aufrufe (`lib/session.ts`, `lib/transport.ts`) gehen an das eigene Backend.

Pflichtattribute (Rendervorgabe, im Wrapper einmal nachgehalten): `width="24"` ·
`height="24"` · `viewBox="0 0 24 24"` · `fill="none"` · `stroke="currentColor"` ·
`stroke-width="2"` · `stroke-linecap="round"` · `stroke-linejoin="round"`.

`viewBox` niemals ändern. Größe nur über CSS-Klassen (`w-4 h-4` = 16px, `w-5 h-5` = 20px,
`w-6 h-6` = 24px).

**Ablage und Benennung (Haupt-Frontend):**

| Datei | Inhalt |
|---|---|
| `frontend/src/components/iconBase.tsx` | `fromLucideBody` (setzt die Pflichtattribute, `aria-hidden`, `focusable`) und der Typ `IconProps` |
| `frontend/src/components/icons.tsx` | **nur** Komponenten — je Zeichen eine Funktionsdeklaration `export function XIcon(props)` |

Name = Lucide-Name in PascalCase plus `Icon`: `check` → `CheckIcon`, `circle-x` →
`CircleXIcon`, `trash` → `TrashIcon`.

> **Warum der Umweg über `fromLucideBody` statt direkt `lucide-react` zu re-exportieren:**
> Ein Re-Export (`export { Check as CheckIcon }`) gäbe die Hoheit über die Attribute aus
> dem Projekt. So stehen sie an **einer** Stelle, und `aria-hidden` (die Zeichen begleiten
> hier immer sichtbaren Text) kann nicht vergessen werden.
>
> **Warum keine Sammlung `export const XIcon = fromLucide(X)`:** ESLint beanstandet das zu
> Recht (`react-refresh/only-export-components`): eine Konstante mit Funktionsaufruf ist
> für das Plugin keine Komponente, und die schnelle Aktualisierung im Entwicklungsmodus
> fällt aus. Deshalb Funktionsdeklarationen plus Helfer in eigener Datei.

**Eigenbauten** liegen in derselben Datei und tragen die Pflichtattribute selbst. Es sind
**vier** Fachsymbole dieser Anwendung, für die es in Lucide kein Zeichen gibt:
`ToolIcon` (Werkzeug), `SerialIcon` (Klemmbrett mit Zeilen), `WarehouseIcon` (Lagerhaus),
`ArchiveIcon` (Archivkiste).

> **Nachgezogen (Audit):** Die Datei enthielt 38 handgeschriebene SVG-Komponenten mit
> `stroke-width="1.5"` und nachgebauten Pfaden (Zahnrad, Papierkorb, Stift, Maßarbeit bei
> Haken und Kreuz); 13 davon waren Kopien aus dem Lucide-Repository und wären bei jedem
> Update abgedriftet. Jetzt sind 33 Zeichen Wrapper um `lucide-react` und nur die vier
> genannten Eigenbauten handgeschrieben.

> **Werkzeug zum Nachprüfen:** `node scripts/verify-icons.mjs` (im Verzeichnis
> `frontend/`, versioniert). Es rendert jedes Zeichen mit **genau den Props des Wrappers**
> und prüft am erzeugten SVG die Pflichtattribute, `class`, `aria-hidden` und `focusable`;
> zusätzlich, dass jeder Lucide-Import existiert, dass alle in der App importierten Namen
> exportiert sind und dass die Eigenbauten die Pflichtattribute tragen. Braucht **kein**
> Internet (liest `node_modules`). Stand: `33/33 Lucide-Zeichen gerendert`, `35 Namen
> importiert, alle exportiert`, `4 Eigenbauten geprüft`.

**Ausnahme:** Das AdminPanel (System B) führt seine Icons weiter lokal in den Seiten und
nutzt `stroke-width` 1.75–2. Das ist der zweite, dunkle Systemstil; ein Umzug in die
Hauptdatei würde die beiden Systeme vermischen. `MoreVerticalIcon`, `PencilIcon`,
`TrashIcon` (AdminStammdaten), `PlusIcon`, `TrashIcon`, `PencilIcon`, `XIcon`
(AdminStorageLocations) und `SearchIcon` (AdminDashboard) sind dort **doppelt** vorhanden
und offene Kandidaten für einen eigenen Aufräumschritt.

### 1.8 Textskala und Kontrast (verbindlich)

Der Guide kannte bisher nur zwei Textwerte, der Code nutzte sechs verschiedene Grautöne.
Diese Ergänzung legt eine **drei**stufige Skala fest; alle Werte sind auf den Glasflächen
gemessen (hellste Fläche `.app-content-block`, Weiß 0.48 über `#c5cbd3` → `rgb(227,230,233)`):

| Ebene | Wert | Tailwind | Kontrast | Verwendung |
|---|---|---|---|---|
| 1 — Text | `#0f172a` | `slate-900` | **14,3:1** | Fließtext, Werte, Überschriften |
| 2 — Sekundär | `#334155` | `slate-700` | **8,3:1** | Feldbeschriftungen, Tabelleninhalte |
| 3 — Gedämpft | `#475569` | `slate-600` | **6,0:1** | Hinweise, Ladezustände, inaktive Tabs |

**Statusfarben als Text** (dieselben Werte, die §1.5 für Alerts und Badges nutzt):

| Bedeutung | Wert | Tailwind | Kontrast |
|---|---|---|---|
| Erfolg | `#065f46` | `emerald-800` | 6,1:1 |
| Warnung | `#92400e` | `amber-800` | 5,7:1 |
| Gefahr | `#9f1239` | `rose-700` | 4,8:1 |
| Info | `#1e3a8a` | `sky-800` | 6,0:1 |
| Primär (Textrolle) | `#115e59` | `teal-800` | 6,0:1 |

> Die Spalte **Tailwind** ist die praktische Umsetzung im Code. Die Palette von Tailwind v4
> weicht pro Farbkanal um bis zu 4 Stufen von den Nominalwerten ab (z. B. `slate-600` =
> `#45556c` statt `#475569`); die Kontrastwerte sind mit den tatsächlichen Tailwind-Werten
> gemessen. Die Nominalwerte gelten, wo Farbe direkt im CSS steht (`index.css`, Klassen).

**Regeln:**

1. Für Text sind **nur** die Werte dieser Tabelle zulässig – keine weiteren Grautöne.
   (`slate-400`, `slate-500`, `slate-800`, `rose-500`, `rose-600`, `emerald-700`,
   `amber-700` waren im Einsatz und sind für kleinen Text zu kontrastarm.)
2. Die Primärfarbe `#0f766e` (4,3:1) ist für **Flächen, Rahmen und Fokus** zulässig;
   als **Textfarbe** wird `#115e59` verwendet (aktiver Tab, Ghost-Button, Badge-Erfolg,
   Breadcrumb-Link).
3. Alle Textgrößen halten 12px als Untergrenze; `.ui-alert` wurde dafür von `.72rem`
   auf **`.8rem`** (12,8px) angehoben, weil Fehlermeldungen der zuerst gelesene Text sind.
4. Eingabefelder erhalten `text-base sm:text-sm` (16px auf mobil, 14px ab `sm`), damit
   iOS Safari beim Fokussieren nicht in die Seite zoomt (bei `.ui-field` ist das in der
   Klasse selbst gelöst, siehe §1.9).

### 1.9 Feld mit Innenlabel (.ui-field) – Sparform

Für **lange Formulare** gibt es eine zweite Feldart, bei der die Beschriftung **im** Feld
steht statt darüber. Sie spart pro beschrifteter Feldzeile rund **20 px** (Label-Zeile
16 px + Abstand 4 px) und ist damit die erste Wahl, wenn ein Formular ohne Scrollen
auskommen soll.

Das Feld ist eine **Glasfläche** wie `.app-content-block` / `.glass-card`: transluzentes
Weiß, Blur, weiße Kante, weicher Schatten. Die Beschriftung ist darin **reiner Text** –
ohne eigene Fläche, ohne Farbe, ohne Trennlinie.

```css
.ui-field { display:flex; align-items:stretch; min-width:0;
            border:1px solid rgba(255,255,255,.75); border-radius:.75rem;
            background:rgba(255,255,255,.52); overflow:hidden;
            backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
            box-shadow:0 4px 15px rgba(0,0,0,.03);
            transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease; }
.ui-field:hover          { background:rgba(255,255,255,.66); }
.ui-field:focus-within   { background:rgba(255,255,255,.80); border-color:#0f766e;
                           box-shadow:0 0 0 3px rgba(15,118,110,.15), 0 4px 15px rgba(0,0,0,.03); }
.ui-field > label        { flex:0 0 7.5rem; display:flex; align-items:center;
                           padding:0 .25rem 0 .85rem; background:transparent; border:0;
                           color:#475569; font-size:.75rem; font-weight:600; white-space:nowrap;
                           overflow:hidden; text-overflow:ellipsis; cursor:pointer; }
.ui-field > input,
.ui-field > select,
.ui-field > textarea     { flex:1 1 auto; min-width:0; border:0; outline:0; background:transparent;
                           padding:.45rem .75rem; color:#0f172a; font-weight:500;
                           font-size:1rem; }  /* mobil 16px, ab sm .875rem */
.ui-field.is-error       { background:rgba(239,68,68,.12);  border-color:#ef4444; }
.ui-field.is-ok          { background:rgba(34,197,94,.15);  border-color:#22c55e; }
```

**Regeln:**

1. Das Innenlabel ist immer ein **echtes `<label for>`** mit `htmlFor`/`id` – nie ein
   `<span>`. Ohne die Zuordnung hätte das Feld keinen zugänglichen Namen (§1.8/A-10).
2. **Feste Label-Breite `7.5rem`**, damit alle Eingabekanten untereinander fluchten.
   Zu lange Beschriftungen werden an der Kante abgeschnitten – die Beschriftung ist dann
   zu kürzen (z. B. „Ort / Lagerplatz" → „Lagerplatz"), nicht die Breite aufzuweichen.
3. Pflichtfelder bekommen ein `*` **neben** dem Label plus `required` am Feld;
   der ausführliche Hinweis „(Pflicht)" entfällt im Label. **Beides kommt aus einer
   Komponente** — `frontend/src/components/Field.tsx`, `FieldLabel`:

   ```tsx
   <div className="ui-field">
     <FieldLabel htmlFor="tool-plant" required>Werk</FieldLabel>
     <select id="tool-plant" required aria-required>…</select>
   </div>
   ```

   Ein `required` steuert Sternchen **und** die Aussage am Feld; beides kann nicht
   mehr auseinanderlaufen. `standalone` ist für Labels **außerhalb** eines
   `.ui-field` (Regel 8 und 11). Die Meldung unter einem Feld kommt aus
   `FieldMessage` (`hint` / `error` / `success`), Fehler tragen `role="alert"`;
   ihre Schriftfarbe steht in einem `Record` und nicht mehr in jedem Formular
   einzeln.

   > **Warum das Sternchen NICHT ins `<label>` gehört** (gemessen in den
   > Browser-Tests): Als Label-Kind wird der **zugängliche Name** des Feldes zu
   > „Werk\*" statt „Werk". Jeder Locator, der ein Feld über seinen Namen sucht –
   > `getByLabel('Werk', { exact: true })` –, findet dann **0** Elemente und
   > läuft in den Timeout, und ein Screenreader liest das Sternchen mit vor. Die
   > Pflicht trägt ohnehin `required` am Feld; der Stern ist reine Sehhilfe.
   > `FieldLabel` gibt deshalb ein Fragment zurück: `<label>` plus Stern als
   > **Geschwister**. Wer ein Pflichtfeld umbenennt oder einen Locator darauf
   > setzt, findet den sauberen Namen.

   **Welche Felder Pflicht sind, entscheidet das Formular — und zwar je Bereich
   unterschiedlich.** Das ist Absicht (die Fachregeln sind verschieden), nur die
   Darstellung ist eine. Der Server ist die Wahrheit:

   | Reiter/Bereich | Pflicht |
   |---|---|
   | Werkzeug | Werkzeug-ID **nur bei Stempel** (DEC-055), Werkzeug-Typ, Maß A, Werk, Lagerplatz (außer „In Ablage legen") |
   | Serienartikel | Artikelnummer, Werk |
   | Datenblatt | Werk (Werkzeug-ID, Name und Maschine sind freiwillig) |
   | Ersatzteil | Artikelnummer, Werk |

   Maß A wird seit dem Audit **auch serverseitig** verlangt
   (`assert_tool_identity` in `backend/app/services/tool_service.py`): vorher
   galt die Regel nur im Formular, die API nahm ein Werkzeug ohne Maß an.
4. Der Fehler-/Erfolgszustand liegt **auf dem Wrapper** (`.is-error` / `.is-ok`).
5. **Beschriftung in Satzschreibung** („Werkzeug-ID"), nicht in Großbuchstaben –
   §1.8 und die übrige Oberfläche schreiben Satzschreibung.
6. **Das Feld trägt die Abgrenzung, das Label nur die Typografie.** Diese Regel ist das
   Ergebnis von drei verworfenen Versuchen (solider Neutralblock `#0f172a`, solider
   Primaryblock `#0f766e`, 12-%-Teal-Tönung) und der Messung in
   `.audit/analyze-tag-color.mjs`:

   | Variante | Abstand Label ↔ Feld | Ergebnis |
   |---|---|---|
   | Solider Block `#0f172a` | 14,2:1 | zu laut |
   | Solider Block `#0f766e` | 4,92:1 | zu laut |
   | Teal-Tönung 12 % | 1,17:1 | verträglich, aber immer noch ein „Kästchen" |
   | **Reiner Text im Glas-Feld** | **1,14:1** (Feldfläche gegen Karte) | **gewählt** |

   Zur Einordnung: Das System trennt Zustände selbst mit 1,15–1,17:1 (Eingabefeld/Karte,
   aktiver Tab/Streifen, Badge-Tönung/Fläche). Alles ab ~1,5:1 ist lauter als die
   Oberfläche und wurde in den Entwürfen als „sticht heraus" verworfen.
   Label = `#475569` (Ebene 3, §1.8), Wert = `#0f172a` (Ebene 1) – die Hierarchie
   entsteht aus der Textskala, nicht aus Flächen.
7. **Abweichung zu §1.3:** `.ui-field` ist eine Glasfläche und nutzt bewusst
   `backdrop-filter`. §1.3 verbietet Blur für **nackte** `.input-bordered`-Felder
   (dort liegt der Text direkt auf der Karte), hier ist das Feld eine eigene Fläche.
8. **Nicht** verwenden für: mehrzeilige Felder (`textarea` behält das Label darüber),
   Suchfelder (ohne Beschriftung, nur `aria-label`) und sehr schmale Inline-Felder
   (z. B. „Anzahl" neben einer Checkbox).
9. `.input-bordered` bleibt für Felder **ohne** Innenlabel bestehen – beide Feldarten
   dürfen nicht in derselben Zeile gemischt werden.
10. **Gemessenes Ergebnis** im Werkzeugformular (`.audit/measure-anlegen.mjs`): Formular
   604 px statt 726 px (−122 px) bei 1440 px Breite. Damit kommt **1440×900 und größer
   ohne Scrollen** aus; bei 1280×800 fehlen noch 94 px, bei 1366×768 126 px.
   Die restlichen Hebel dafür sind im Audit-Report (`docs/19-frontend-ui-audit.md` §1.6)
   benannt und wurden auf Wunsch noch nicht umgesetzt.
11. **Ausnahme 3-spaltige Reihe:** Im Lagerplatz-Block (Schrank/Schublade/Platz) blieben
   dem Select neben dem 7,5-rem-Label nur 65 px (bei 1280 px Breite 33 px), während
   „Bitte zuerst Schrank wählen" 142 px braucht → diese drei Felder behalten das Label
   darüber (`<FieldLabel … standalone>`).
12. **Keine Hilfstexte im Formular:** Der Blockkopf trägt kein Zusatz-Badge („nur freie
   Plätze"), und unter einem Feld steht kein erklärender Hinweissatz. Die Abhängigkeit
   steckt im Optionstext des Feldes selbst (`Bitte zuerst Schrank wählen`) und in der
   `disabled`-Darstellung. Tooltips (`title=`) sind im Formular nicht erlaubt – die
   Beschriftung trägt die Information.

    **Offene Abweichung:** Der Reiter „Werkzeug" (Hinweis zur Werkzeug-ID, Block
    „Kommt beim Speichern dazu") und der Reiter „Ersatzteil" („Der Platz gilt dann als
    belegt") verletzen diese Regel bewusst: dort erklärt der Satz eine **fachliche**
    Folge, die kein Optionstext tragen kann. Ein Tooltip ist an keiner Stelle mehr im
    Einsatz (im Ersatzteil- und Datenblatt-Formular entfernt); die `title=`-Attribute
    an den Icon-Knöpfen der Dateizeilen sind Beschriftungen dieser Knöpfe und keine
    Feld-Hilfen.

13. **Gruppen gehören in `FormSection`.** Zusammengehörige Felder stehen in einer
    Glasfläche mit Kopfzeile (`frontend/src/components/Field.tsx`):

    ```tsx
    <FormSection title="Lagerplatz" action={<label>… In Ablage legen …</label>}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">…</div>
    </FormSection>
    ```

    `optional` hängt ein leises „(optional)" an den Titel, `action` nimmt das
    Kontrollkästchen rechts in der Kopfzeile. Vorher stand dieselbe
    Klassenzeichenkette dreimal wörtlich im Markup, und im Ersatzteil-Formular
    fehlte die Gruppe für dieselbe Sache („Lagerort") ganz — daraus entstand der
    Eindruck „im Werkzeug aufgeteilt, im Ersatzteil nicht".

> **Herkunft:** Zwei Entwürfe des Auftraggebers (`input_test.html`). Von deren Farbgebung
> blieb nichts übrig (`#0284c7`/`#2563eb` Fokus, `#0f172a` Tag) – drei Anläufe wurden vom
> Auftraggeber als „sticht heraus" verworfen, bis die Messung in Regel 6 zeigte, dass das
> Problem nicht der Farbton, sondern das **Gewicht** war. Erhalten geblieben ist die
> Struktur (Beschriftung links im Feld, kein zweiter Fokus-Kanal); die Fläche selbst ist
> jetzt die des Glas-Systems und das Label nur noch Typografie.


> **Hinweis zur Historie:** Die Werte `#64748b` (Muted) und `.72rem` (Alerts) stammen aus
> der ersten Fassung dieses Guides und wurden wegen zu geringem Kontrast bzw. zu kleiner
> Schriftgröße ersetzt. Diese Änderung ist bewusst im Guide und in `index.css` gemeinsam
> erfolgt – nicht als stille Abweichung im CSS.

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
