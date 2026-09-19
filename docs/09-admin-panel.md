# Admin-Panel (ToolSync 2.0)

> Verbindliche Design-Quelle: `frontend/src/admin.css`
> Regel: `.continue/rules/12-ui-adminpanel.md`
> Kurzreferenz: `docs/15-ui-styleguide.md`

## Übersicht

Das Admin-Panel ist eine separate Ansicht unter der Route `/admin`.

Es folgt dem **Split-Tone-Operational-Design** aus `AdminPanel-Styleguide.html`.
Die folgenden Werte sind die **tatsächlich umgesetzten** Werte aus `frontend/src/admin.css`:

| Bereich | Token | Wert |
|---|---|---|
| Sidebar (Navigation) | `--admin-sidebar-bg` | `#0e1a1a` |
| Content-Bereich | `--admin-content-bg` | `#f4f7f7` |
| Cards / Tabellen | `--admin-surface` / `--admin-border` | `#ffffff` / `#dfe7e7` |
| Input-Rahmen | `--admin-border-strong` | `#c3d1d1` |
| Primary / Akzent | `--admin-primary` | `#0f766e` |
| Danger | `--admin-danger` | `#e11d48` |
| Button-Radius | `--admin-radius` | `.55rem` |
| Button-Gewicht | — | `600` |

> **Nicht verwenden:** `#0f172a`, `#f1f5f9`, `#e2e8f0` — diese Werte gehören zum
> **Glas-System** des Haupt-Frontends und sind im AdminPanel falsch.

## Dark Mode

Dark Mode wird nicht gebraucht. Der frühere `html[data-theme="dark"]`-Block wurde entfernt.

## Zugang

- **Admin-Panel-Button** in der Haupt-Sidebar (nur für Administratoren sichtbar)
- Direkt über die URL `/admin`
- **Zurück zur Hauptseite** über den Button in der Sidebar (direkt nach Logo, als sichtbarer Button)

## Aufbau

Das Admin-Panel ist in drei Bereiche unterteilt:

| Bereich | Inhalt |
|---|---|
| Übersicht | Kennzahlen und Status des Systems |
| Stammdaten | Werke, Kunden, Maschinen und Werkzeugtypen in Tabellen |
| Lagerplätze | Schrank-/Schubladen-/Platzverwaltung mit Werkzeug-Ablage |

## Stammdaten

Die Stammdaten-Verwaltung verwendet **kompakte Tabellenkarten in einem Grid**:

- Werke, Kunden, Maschinen und Werkzeugtypen werden jeweils in einer eigenen
  Tabelle dargestellt.
- Die Blöcke stehen **nebeneinander** (`grid`: 1 Spalte mobil, 2 ab `sm`,
  3 ab `xl`, 4 ab `2xl`) und sind oben ausgerichtet.
- Jede Tabelle hat eine **feste Höhe mit eigenem Scrollbereich**
  (`.admin-scroll-y`), damit auch viele Einträge übersichtlich bleiben und
  weitere Blöcke später einfach ergänzt werden können.
- Neue Einträge werden über ein Eingabefeld oberhalb der Tabelle hinzugefügt.

### Aktionen pro Zeile (Kebab-Menü)

Statt zweier Text-Buttons trägt jede Zeile nur noch **einen Drei-Punkte-Button**
(Lucide „more-vertical", Inline-SVG). Er öffnet ein **Mini-Modal** mit:

| Menüpunkt | Wirkung |
|---|---|
| **Bearbeiten** | Zeile wechselt in den Inline-Bearbeitungsmodus |
| **Löschen** | Eintrag löschen (mit Sicherheitsabfrage) |

Das Menü schließt bei Klick außerhalb, mit `Esc` und nach jeder Aktion. Der
Button setzt `title`, `aria-label`, `aria-haspopup` und `aria-expanded`.
Der `Aktionen`-Spaltenkopf ist leer (nur `aria-label`).

### Kundenfarbe

Kunden können eine **optionale Hex-Farbe** erhalten:

- Farbwähler (`<input type="color">`) beim **Anlegen** und **Bearbeiten**,
  inklusive Option **„Keine Farbe"** (Wert `null`).
- In der Kundenzeile erscheint neben dem Namen ein **Farb-Swatch**
  (`w-3 h-3 rounded-full`); ohne Farbe wird **kein** Swatch angezeigt.
- Die Farbe wird persistiert (`customers.color`, Migration `d1a4f6b2c9e3`).
- `ToolRead` liefert den Kunden jetzt mit (`customer`), damit die Farbe
  später in der Werkzeugliste sichtbar gemacht werden kann
  (optionaler Folgeschritt: `ToolList.tsx`).

### Maschinen-Werk

Maschinen lassen sich beim **Anlegen** und **Bearbeiten** einem **Werk**
zuordnen:

- Werk-Dropdown (`<select class="admin-select">`) mit „Kein Werk" (leerer Wert)
  und allen Werken.
- Beim Bearbeiten ist das aktuelle Werk vorbelegt.
- Die Zuordnung wird persistiert (`machines.plant_id`); die Spalte „Details"
  zeigt das Werk weiterhin an.

### Backend / Migration

- `Customer.color` ist als `String(7)` (Hex, `#RRGGBB`) nullable im Model.
- `CustomerBase.color` gilt für Create/Update/Read.
- Neue Alembic-Migration: `d1a4f6b2c9e3` (`add_color_to_customers`),
  `down_revision = 'c7d9e2f3a1b8'`. `downgrade()` entfernt die Spalte wieder.
- `ToolRead.customer` ergänzt; die Beziehung ist `lazy="joined"` (analog
  `plant`/`tool_type`), damit `GET /tools` den Kunden inkl. Farbe liefert.

## Lagerplätze

### Layout

Die Seite ist zweispaltig aufgebaut:

- **Linke Spalte:** Formular „Schrank anlegen“ und darunter der **Verlauf**
- **Rechte Spalte:** Werk-Auswahl, Info-Hinweis, Werkzeug-Ablage und Lagerstruktur-Ansicht

Es gibt keine Tab-Leiste mehr – alle Bereiche sind gleichzeitig sichtbar.

### Schrank-Matrix anlegen

Ein Schrank wird als **Matrix** angelegt:

1. Werk (Plant) auswählen
2. Schrank-Nummer eingeben (z. B. `3` → `03`)
3. Anzahl der Schubladen festlegen
4. Pro Schublade Breite (X) und Tiefe (Y) angeben

Aus diesen Angaben entsteht automatisch die Matrix:

- Schrank
  - Schublade (z. B. `C`)
    - Platz (z. B. `03-C-01`, `03-C-02`, …)

### Schublade zu bestehendem Schrank hinzufügen

Eine neue Schublade kann **nachträglich** in einen bereits vorhandenen Schrank
eingefügt werden:

1. Den Schrank in der Lagerstruktur-Ansicht aufklappen (Pfeil links).
2. Im Schrank-Kopf auf **„Schublade hinzufügen"** klicken.
3. Im Inline-Panel Name, Anzahl X und Anzahl Y eingeben.
   - Der Name wird mit dem **nächsten freien Buchstaben** des Schranks
     vorbelegt (A, B, C …) und ist frei editierbar (auch Zahlen möglich).
   - Die Standardgröße ist 5 × 2.
   - Das Panel zeigt vorab an, wie viele Plätze erzeugt werden
     (`Anzahl X × Anzahl Y`).
4. **„Schublade anlegen"** klicken.

Das Backend (`POST /api/locations/drawers`) erzeugt die Schublade **inklusive
alle Plätze** (`01`, `02`, …) in einem Schritt. Doppelte Namen innerhalb
desselben Schranks werden abgewiesen (`UNIQUE(cabinet_id, name)`).

Die Antwort enthält die neue Schublade samt Plätzen. Der Client übernimmt sie
direkt in den lokalen State – die Schublade ist **sofort sichtbar**, ohne die
gesamte Lagerstruktur neu zu laden. Der Schrank bleibt aufgeklappt und die neue
Schublade wird direkt aufgeklappt.

> **Technischer Hinweis:** `DrawerRead` enthält `positions`. Nach einem
> `db.commit()` sind die ORM-Attribute abgelaufen; ein Lazy-Load im
> Sync-Serialisierungskontext schlägt im Async-Setup fehl
> (`MissingGreenlet`) – die Anfrage würde trotz erfolgreichem Commit mit
> HTTP 500 antworten. Deshalb lädt `create_drawer` die Beziehung explizit via
> `selectinload(Drawer.positions).selectinload(Position.tool)` nach.

### Buttons in der Lagerstruktur-Ansicht

Die Buttons sind über beide Ebenen vereinheitlicht (jeweils Lucide-Inline-SVG,
`title` und `aria-label`):

| Ebene | Button | Bedeutung |
|---|---|---|
| Schrank | **Schublade hinzufügen** | Inline-Panel zum Anlegen einer Schublade |
| Schrank | **Löschen** | Schrank inkl. Schubladen löschen (Werkzeuge → Ablage) |
| Schublade | **Löschen** | Schublade löschen (Werkzeuge → Ablage) |
| Platz (belegt) | **Bearbeiten** | Werkzeug-Beschreibung und Status ändern |
| Platz (belegt) | **Löschen** | Werkzeug vollständig löschen (Platz wird frei) |

Die Buttons liegen **außerhalb** des Aufklapp-Buttons. Ein Klick auf
„Schublade hinzufügen" oder „Löschen" klappt den Schrank daher nicht
versehentlich zu bzw. auf. Auffällige Löschaktionen sind zusätzlich als
Soft-Danger-Button (rosa eingefärbt) gestaltet.

### Anzeige-Zähler

Schränke und Schubladen zeigen die enthaltenen Elemente als **farbige Badges**:

| Ebene | Badge | Inhalt |
|---|---|---|
| Schrank | Teal | Anzahl Schubladen (Singular/Plural) |
| Schublade | Sky | Anzahl Plätze (Singular/Plural) |

Die Zähler sind damit sofort vom Titel unterscheidbar und auch bei vielen
Schränken schnell erfassbar.

### Lagerstruktur-Ansicht

Die Ansicht zeigt alle Schränke eines Werks als aufklappbares Akkordeon:

- **Schrank**
  - **Schublade** → Grid mit allen Plätzen
    - Belegte Plätze zeigen den Werkzeug-Code (z. B. `TS-1004`)
    - Freie Plätze zeigen `[Frei]`
    - Ausgeliehene Werkzeuge (Status `lent`) werden besonders markiert

Die Plätze werden visuell so angeordnet, dass die **unterste Reihe** zuerst erscheint (01–05 unten, 06–10 oben bei 5 × 2).

### Werkzeug-Ablage (Tray)

Werkzeuge **ohne festen Lagerplatz** liegen in der **Werkzeug-Ablage** (`Tool.position_id = NULL`).

**Woher kommen Ablage-Werkzeuge?**

- Beim Anlegen eines Werkzeugs kann „In Ablage legen (kein fester Platz)" gewählt werden.
- Beim Löschen eines Schranks oder einer Schublade werden eingelagerte Werkzeuge **nicht gelöscht**, sondern in die Ablage gelegt.
- Ein Werkzeug kann aus einem Platz in die Ablage-Fläche gezogen werden (Platz wird frei).

**Aktionen:**

| Quelle → Ziel | Aktion | Verhalten |
|---|---|---|
| Ablage → freier Platz | Ablegen | Werkzeug wird auf den Platz gelegt |
| Ablage → belegter Platz | Einreihen | Werkzeuge ab Ziel rücken einen Platz weiter |
| Ablage → belegter Platz (letzter Platz belegt) | Blockiert | Keine Aktion, damit kein Werkzeug verloren geht |
| Platz → freier Platz | Verschieben | Werkzeug wandert zum Ziel, Quelle wird frei |
| Platz → belegter Platz | Tausch | Nur die beiden Werkzeuge tauschen |
| Platz → Ablage-Fläche | Entfernen | Platz wird frei, Werkzeug liegt in der Ablage |

Alle Aktionen sind sowohl per **Drag & Drop** als auch per **Klick** möglich:

1. **Per Klick:** Quelle antippen (Ablage-Chip oder belegtes Fach), dann Ziel antippen
2. **Per Drag & Drop:** Chip/Fach ziehen und auf Ziel bzw. Ablage-Fläche loslassen

Die Auswahl kann mit `Esc` abgebrochen werden.

### Werkzeug bearbeiten / löschen

Eingelagerte Werkzeuge können direkt in der Lagerstruktur bearbeitet oder gelöscht werden:

- **Bearbeiten:** Beschreibung und Status direkt im Admin-Panel anpassen
- **Löschen:** Werkzeug vollständig löschen (Platz wird freigegeben)

Dies ist unabhängig vom „Entfernen" in die Ablage: Beim Löschen wird das Werkzeug wirklich entfernt, beim Ablegen in die Ablage bleibt es erhalten.

### Verlauf

Der Verlauf ist ein eigener Block in der linken Spalte unter „Schrank anlegen“ (keine Tab-Leiste). Er zeigt alle Bewegungen des aktiven Werks in chronologischer Reihenfolge.

Jede Bewegung speichert:

- Werkzeug-Code und Bezeichnung
- Von-Ort und Nach-Ort (z. B. `03-C-02` → `03-D-01`)
- Benutzer, der die Aktion ausgeführt hat
- Zeitpunkt
- Art der Bewegung (Ablage, Ablegen, Einreihen, Tausch, Verschieben, Entfernen)

#### Farbcodierung der Aktionen

Verwandte Aktionen teilen sich eine Farbe. Jeder Eintrag erhält zusätzlich zum
farbigen Badge einen **farbigen linken Rand**, damit die Aktion auch ohne
Lesen des Textes erkennbar ist. Über der Liste steht eine Farb-Legende.

| Aktion | Farbe | Auslöser (Backend-Note) |
|---|---|---|
| Tausch | Grün (Emerald) | `swap` |
| Verschieben | Blau (Sky) | `move`, auch `transfer` |
| Einreihen | Bernstein (Amber) | `insert_at`, `insert_at shift` |
| Einlegen / Ablegen | Bernstein (Amber) | `insert_from_tray`, `place` |
| In Ablage | Grau (Slate) | `release` |
| Ausleihe | Violett | `lend` |
| Rückgabe | Türkis (Teal) | `return` |
| Statusänderung | Rot (Rose) | `status_change` |
| Umplatzierung (unbekannt) | Grau | keine Zuordnung möglich |

Die Zuordnung erfolgt tolerant über das **erste Wort** der `note` (z. B. greift
`insert_at` auch bei `insert_at shift`). Dadurch bleiben auch ältere Einträge mit
abweichenden Notizen korrekt eingefärbt.