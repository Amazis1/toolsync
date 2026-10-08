# ToolSync – Serienartikel

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 6 „Serienartikel“, 13 „Suche“, 18 „Datenbank“, 19 „Frontend und UX“), `docs/00-project-vision.md` (Abschnitt 8), `docs/13-decisions.md` → **DEC-056** (Felder, Rechte, Liste), **DEC-057** (Artikelordner), **DEC-058** (Bilder), **DEC-059** (Vorschaubilder, Split-Screen), **DEC-060** (ein Dateifeld) und **DEC-062** (mehrere Pläne, alles löschbar), `.continue/rules/02-domain-rules.md`.
>
> **Ist-Stand-Quellen:** `backend/app/models/serial_article.py`, `schemas/serial_article.py`, `routers/serial_articles.py`, `services/serial_article_service.py`, `crud/crud_serial_article.py`, Migration `a7c3e19f4b21`; `frontend/src/api/serialArticles.ts`, `types/serial-article.ts`, `components/serial-articles/` (`SerialArticleForm.tsx`, `SerialArticleList.tsx`, `PDFViewer.tsx`), `components/tools/ToolForm.tsx`, `App.tsx`; Tests `backend/tests/test_serial_articles.py`, `frontend/tests/serial-articles.spec.ts`.
>
> Beschrieben wird der **tatsächlich implementierte** Stand. Abweichungen zu Anforderungen und Entscheidungen sind ausdrücklich als solche markiert, Unklares als **Offen**.

## 1. Definition

> **Wichtig:** Ein Serienartikel ist ein **PDF-basierter Einrichteplan** und ein **eigener Fachbereich**. Er hat **keine** Beziehung zu Werkzeugen (Stempel, Abstreifer, Matrize) und **keine** Werkzeug-ID – die Artikelnummer ist eine eigene Nummer (DEC-056 Punkt 1).

Der Bereich ist ein eigener Block der SPA: `TabKey = 'serienartikel'`, sichtbar als Tab „Serienartikel“ neben „Werkzeuge“, „Lager/Ersatz“ und „Historie“.

- **Route:** `routers/serial_articles.py`, Präfix `/api/serial-articles` (gesetzt in `main.py`)
- **Service:** `SerialArticleService` – Artikelordner, Dateispeicherung, Pfadauflösung, Löschen
- **CRUD:** `CRUDSerialArticle` (`crud_serial_article.py`) – Suche, Filter, Sortierung, Seitenausschnitt
- **Model:** `SerialArticle`, Tabelle `serial_articles`
- **Schema:** `SerialArticleCreate` / `SerialArticleUpdate` / `SerialArticleRead` / `SerialArticlePage` / `ArticleNumberCheck`
- **Frontend:** `SerialArticleForm.tsx` (Formular), `SerialArticleList.tsx` (Liste), `PDFViewer.tsx` (Vorschau), Client in `api/serialArticles.ts`

Gefunden wird ein Plan über **Artikelnummer, Name, Beschreibung, Werk, Kunde und Maschine**. Kunde, Maschine und Werk sind **Stammdaten** aus dem Admin-Bereich (Auswahl, kein Freitext).

## 2. Funktionen

| Funktion | Umsetzung |
|---|---|
| Suchen | Suchfeld **ohne sichtbare Beschriftung** (Lupe links, `aria-label`, Löschknopf, Ladeanzeige) mit **350 ms Debounce**, Suche läuft **serverseitig** über alle sechs Angaben |
| Filtern | **Werk als Segmente** (Radios, „Alle" + je Werk – wie in der Werkzeugliste) und **Favoriten** als Umschalter; im Backend zusätzlich Kunde, Maschine und „mit/ohne PDF“ |
| Favoriten | **Global** (nicht pro Benutzer): Stern in der ersten Spalte (`aria-pressed`), Zeile mit Amber-Tönung statt Zebra, Umschalter „Nur Favoriten"; gesetzt über `PUT /{id}/favorite` (DEC-063) |
| Sortieren | Klick auf den Spaltenkopf: aufsteigend → absteigend → Standardsortierung (Artikelnummer); `aria-sort` gesetzt, Sortierzeichen als **SVG-Icons** (`SortableIcon`/`SortAscIcon`/`SortDescIcon`), leere Werte am Ende (NULLS LAST) |
| Blättern | Blätterleiste `.ui-pagination` mit Bereichsangabe („1–10 von 133“), Seitengröße 10/25/50/100, Gesamtzahl aus `total` |
| Auflisten | Tabelle mit eigenen Spalten: **Favoriten-Stern**, Artikelnummer, **Name / Beschreibung**, Werk, Kunde/Maschine, Dateien („PDF", „Kein PDF", „N Bilder"), Aktionen. Die Tabelle hat **dieselbe Typografie wie die Werkzeugliste**: `text-left text-xs` auf der `<table>` (12 px Grundschrift) und `px-3 py-2` in den Zellen – nur so stehen die Kennungs-Markierungen (14 px Mono) so heraus wie dort. **Nummer und Name tragen genau dieselbe Markierung wie Werkzeug-ID und Lagerplatz** (heller Kasten, `rounded-lg`, `px-2 py-0.5`, Mono, 14 px, fett, `tracking-tight`); unterschieden wird nur die Kante: **Teal = Nummer/Identität** (wie die Werkzeug-ID), **Sky = Name/zweite Angabe** (wie der Lagerplatz). Die Beschreibung steht klein und grau darunter – dort, wo in der Werkzeugliste Kategorie bzw. Werk stehen. Der Kunde trägt den **Farbpunkt aus den Stammdaten** (`customers.color`), die Maschine steht darunter. **Zebra + Glasverlauf** wie in der Werkzeugliste (`table-row-glass`, `even:bg-white/40`); bei 1440 × 900 passt die Tabelle ohne seitliches Scrollen, sonst erscheint ein gemessener Überlauf-Hinweis (DEC-061, DEC-063) |
| Zeilenaktionen | „…"-Menü je Zeile (`RowActionMenu`) – **nur für Admins**: „Bearbeiten" und „Löschen" (rot). Das Ansehen läuft über die Zeile (DEC-059) |
| Dateien ansehen | **Klick auf die Zeile** öffnet das Datei-Fenster im Split-Screen (Plan, sonst erstes Bild); Tastatur: Tab + Enter/Leertaste |
| PDF herunterladen | „Herunterladen“ im Datei-Fenster, wenn der Einrichteplan ausgewählt ist |
| Bilder hochladen | Im Formular: Mehrfachauswahl (JPG, PNG, WEBP, GIF, BMP, HEIC), Vorschau vor dem Speichern, entfernbar – Bilder **kommen hinzu** (DEC-058) |
| Bilder löschen | „Löschen" je Datei in der Bearbeitung (Abschnitt „Hinterlegte Dateien") oder „Einrichteplan entfernen"/„Bild entfernen" im Datei-Fenster; mit Bestätigungsdialog – **nur Admin** (DEC-062) |
| Anlegen | Über „+ Anlegen“ im Kopf: es öffnet sich das **Anlege-Formular mit Reitern** (Werkzeug, Serienartikel, Lager/Ersatz, Info/Hilfe), Reiter „Serienartikel“ offen – **nur Admin**. Ein eigenes Fenster (Modal) gibt es nicht |
| Bearbeiten | „Bearbeiten“ im Zeilenmenü: dasselbe Anlege-Formular mit dem geladenen Plan – **nur Admin** |
| PDF ersetzen | Eine im Formular mitgeschickte Datei ersetzt den Plan im Artikelordner (`PUT`), **nur Admin** |
| Löschen | „Löschen“ im Zeilenmenü mit Bestätigungsdialog (Objektname + Konsequenz); entfernt Zeile, Plan und Artikelordner samt Inhalt – **nur Admin** |
| Artikelnummer prüfen | Live-Prüfung beim Tippen (400 ms Debounce) gegen `GET /check-number` |

Leerzustände: „Noch keine Serienartikel vorhanden.“ (mit Anlegen-Knopf für Admins), „Keine Treffer für „…““ und „Keine Serienartikel für dieses Werk.“ – beide mit „Filter zurücksetzen“.

Ablauf „Dateien ansehen“: `SerialArticleList` ruft `onOpenFiles(article, tab)` → `App.tsx` setzt `viewingFiles` → `PDFViewer` lädt die gewählte Datei über `GET /api/serial-articles/{id}/files/{name}` als Blob (DEC-062).

> **Wichtig:** Der Eintrag „PDF ansehen“ erscheint nur, wenn `has_pdf` gesetzt ist. Ein Artikel ohne PDF ist sichtbar, aber nicht anzeigbar (Badge „Kein PDF“).

## 3. Felder des Modells

Tabelle `serial_articles` (`class SerialArticle(Base, AuditMixin)`); `id`, `created_at`, `updated_at` aus `AuditMixin`:

| Feld | Typ | Nullable | Bedeutung |
|---|---|---|---|
| `article_number` | `String(100)`, **`unique=True`** | nein | Eigene Nummer des Plans, z. B. `01075000`; benennt zugleich den Artikelordner |
| `name` | `String(200)` | ja | Kurze Bezeichnung des Plans (erscheint in der Liste als eigene Spalte) |
| `description` | `String(500)` | ja | Optionaler Zusatztext |
| `pdf_path` | `String(500)` | ja | **Relativer** Pfad, z. B. `uploads/serial_articles/01075000/plan.pdf` |
| `plant_id` | FK → `plants.id`, `ondelete="RESTRICT"` | **nein** | Werk (Pflicht) |
| `customer_id` | FK → `customers.id`, `ondelete="SET NULL"` | ja | Kunde |
| `machine_id` | FK → `machines.id`, `ondelete="SET NULL"` | ja | Maschine |

Beziehungen `plant`, `customer`, `machine` sind `lazy="joined"` – sie stehen als Spalten in der Liste und in der Antwort (`plant`, `customer`, `machine`).

> **Wichtig:** Für die **Bilder** gibt es **keine** Spalten (DEC-058). Sie liegen als Dateien im Artikelordner und werden beim Lesen aus dem Ordner geholt (`list_images()`), sortiert nach der Zahl im Namen (`bild-2` vor `bild-10`). Die Antwort liefert sie als `images` (`name`, `size`, `kind`).

> **Wichtig:** Das frühere Reservefeld `extra_metadata` gibt es **nicht mehr**; es wurde mit Migration `a7c3e19f4b21` entfernt (DEC-056 Punkt 11). Ein Ersatz ist nicht vorgesehen.

> **Wichtig:** Die Antwort enthält **nicht** `pdf_path`, sondern `has_pdf` (Property am Modell). Der Speicherpfad bleibt intern; für die Anzeige genügt „PDF vorhanden / Kein PDF“.

> **Wichtig:** Löschen eines Kunden oder einer Maschine leert nur das Feld (`SET NULL`) – der Plan bleibt bestehen. Ein **Werk** mit Plänen kann nicht gelöscht werden (`RESTRICT`).

## 4. Keine automatische Strukturierung der PDF-Inhalte

> **Wichtig (Anforderungen 6.2/6.3, Vision 8, Regel 02):** Der **Inhalt** des PDFs wird **nicht** analysiert und **nicht** in Datenbankfelder überführt. Programmname, Bearbeitungszeit, benötigte Werkzeug-IDs, Anzahl der Hübe, Material und weitere Einrichtinformationen bleiben ausschließlich im Dokument.

Belege im Code:

- Es gibt **keine** PDF-Extraktionsbibliothek und **keinen** Aufruf, der den Dateiinhalt parst.
- `SerialArticleService._write_plan()` liest die Bytes und schreibt sie unverändert: `content = await file.read()` → `write_bytes(content)`.
- Geprüft wird nur die **Dateiendung** (`.pdf`/`.PDF`, sonst HTTP 400 „Bitte eine PDF-Datei auswählen.“); der **MIME-Typ** wird **nicht** geprüft (DEC-056 Punkt 12, bewusst).

Strukturiert geführt werden ausschließlich die **Auffang-Angaben** Artikelnummer, Werk, Name, Kunde, Maschine und Beschreibung – sie machen den Plan auffindbar, ohne den Inhalt zu deuten.

## 5. Endpunkte

Präfix `/api/serial-articles` (`main.py`).

| Methode | Pfad | Abhängigkeit | Antwort | Verhalten |
|---|---|---|---|---|
| `GET` | `/` | `require_active` | 200, `SerialArticlePage` | Suche, Filter, Sortierung, Seitenausschnitt + `total` |
| `GET` | `/check-number` | `require_active` | 200, `ArticleNumberCheck` | Live-Prüfung der Nummer (`exclude_id` beim Bearbeiten) |
| `GET` | `/{id}/pdf` | `require_active` | 200, `FileResponse` | **Erster** Plan als `application/pdf`, `filename="<article_number>.pdf"` |
| `GET` | `/{id}/files/{name}` | `require_active` | 200, `FileResponse` | Eine Datei des Artikels – Plan **oder** Bild (DEC-062); Pfadanteile sind abgewiesen. Mit `?variant=thumb` die Vorschau (max. 400 px, JPEG, DEC-059, nur Bilder) |
| `GET` | `/{id}` | `require_active` | 200 / 404 | Einzelartikel inkl. `plans` und `images` |
| `POST` | `/` | **`require_admin`** | 201 / 400 | `multipart/form-data`: Felder + `plans` (mehrfach, PDF) + `images` (mehrfach) |
| `PUT` | `/{id}` | **`require_admin`** | 200 / 400 / 404 | Ändern, Pläne und Bilder ergänzen, Nummer umbenennen |
| `DELETE` | `/{id}/files/{name}` | **`require_admin`** | 204 / 404 | Eine Datei entfernen – Plan oder Bild (DEC-062) |
| `PUT` | `/{id}/favorite` | `require_active` | 200 / 404 | Favorit setzen/entfernen (global, **kein** Admin-Recht – DEC-063) |
| `DELETE` | `/{id}` | **`require_admin`** | 204 / 404 | Löscht Zeile und Artikelordner samt Inhalt |

> **Wichtig:** Die spezifischen Routen `/check-number` und `/{id}/pdf` sind **vor** `/{id}` definiert. Stünde die generische Route zuerst, würde `/3/pdf` als `id="3/pdf"` interpretiert.

**Parameter der Liste:** `search` (Freitext über Artikelnummer, Name, Beschreibung, Werk-, Kunden- und Maschinenname), `plant_id`, `customer_id`, `machine_id`, `has_pdf`, `sort` (`article_number`, `name`, `plant`, `customer`, `machine`, `created_at`), `order` (`asc`/`desc`), `skip` (≥ 0), `limit` (1–200, Vorgabe 25). `sort` und `order` sind `Literal`-Typen: ein unbekannter Spaltenname ergibt **HTTP 422**, nie eine Abfrage mit beliebigem Spaltennamen.

**Sortierung:** `NULLS LAST` in beide Richtungen, dazu `id` als Tiebreaker – ohne ihn könnte dieselbe Zeile auf zwei Seiten auftauchen.

**Formularwerte bei `PUT`:** ein **fehlendes** Feld bedeutet „unverändert“, ein **leerer** Wert bedeutet „Feld leeren“ (Name, Beschreibung, Kunde, Maschine). Artikelnummer und Werk sind Pflicht und werden nie geleert. Mitgeschickte **Dateien kommen hinzu** (keine ersetzt eine andere); entfernt wird einzeln über `DELETE /{id}/files/{name}` (DEC-062).

Fehlerfälle (alle Meldungen deutsch formuliert):

| Situation | Status | `detail` |
|---|---|---|
| Artikel existiert nicht | 404 | `Serienartikel nicht gefunden` |
| Artikel ohne `pdf_path` | 404 | `Für diesen Serienartikel ist kein PDF hinterlegt` |
| Datei auf dem Server fehlt oder liegt außerhalb der Ablage | 404 | `Die PDF-Datei fehlt auf dem Server` |
| Artikelnummer vergeben (Anlegen **und** Ändern) | 400 | `Artikelnummer … ist bereits vergeben.` |
| Kein Werk angegeben | 400 | `Bitte ein Werk auswählen.` |
| Werk/Kunde/Maschine existiert nicht mehr | 400 | `Das gewählte Werk gibt es nicht mehr. Lade die Seite neu.` (sinngemäß für Kunde/Maschine) |
| Artikelnummer leer | 400 | `Bitte eine Artikelnummer angeben.` |
| Datei ist keine PDF | 400 | `Bitte eine PDF-Datei auswählen.` |
| Datei ist kein Bild | 400 | `„<name>“ ist kein Bild. Erlaubt sind JPG, PNG, WEBP, GIF, BMP und HEIC.` |
| Bild/Datei unbekannt oder Pfadanteil im Namen | 404 | `Diese Datei gibt es nicht` |
| Zum neuen Namen liegt schon ein Ablageordner | 400 | `Zum Artikel … gibt es bereits einen Ablageordner. …` |

## 6. Artikelordner: Speicherung und Pfade (DEC-057)

| Aspekt | Ist-Stand |
|---|---|
| Speicherort | `uploads/serial_articles/<bereinigte Artikelnummer>/` – aufgelöst gegen das **Backend-Verzeichnis** (`backend/`), nicht gegen das Arbeitsverzeichnis des Prozesses |
| Übersteuerbar | Umgebungsvariable `TOOLSYNC_UPLOAD_DIR` (für Tests) |
| Ordneranlage | Beim **Anlegen**, auch ohne PDF (`mkdir(parents=True, exist_ok=True)`) |
| Dateiname | Erster Plan `plan.pdf` (Altbestand), weitere `plan-2.pdf`, `plan-3.pdf` …; Bilder als `bild-1.jpg`, `bild-2.png` … (DEC-058, DEC-062) |
| Anzahl | **Mehrere Pläne und mehrere Bilder je Artikel** sind möglich (DEC-062); die Nummer im Namen bestimmt die Reihenfolge |
| `pdf_path` | Zeigt immer auf den **ersten** Plan und wird nach jedem Schreiben/Löschen nachgeführt; ohne Plan ist es leer (`has_pdf` = false) |
| Ordnerbereinigung | alle Zeichen außer Buchstaben, Ziffern, `.`, `-`, `_` → `_`; führende/abschließende `._-` entfernt; leer → `artikel`; Windows-Namen (`CON`, `NUL`, `COM1` …) → `artikel_CON` |
| DB-Wert | relativer Pfad mit `/` als Trenner: `uploads/serial_articles/01075000/plan.pdf` |
| Auslieferung | `resolve_pdf_path()` löst relativ zur Ablage auf und prüft, dass die Datei **innerhalb** der Wurzel liegt – sonst `None` → HTTP 404 |
| Umbenennen | Ändert sich die Artikelnummer, wird der Ordner mitgezogen (`rename`). Existiert der Zielordner, bricht das Speichern mit HTTP 400 ab – es wird **nicht** hineinkopiert |
| Löschen | Erst der gespeicherte Plan, dann der **ganze Artikelordner samt Inhalt** (`shutil.rmtree`, nur innerhalb der Ablage), dann die Datenbankzeile |
| Fehler beim Datei-Löschen | Ist die Datei gesperrt, wird die Zeile trotzdem gelöscht (der Ordner wird anschließend entfernt) |

> **Wichtig:** Es gibt **keinen** statischen Mount für `uploads/`. Die PDF wird ausschließlich über `GET /api/serial-articles/{id}/pdf` ausgeliefert – also nur authentifiziert und nur über die Artikel-ID, nie über einen erratbaren URL-Pfad.

> **Korrigiert:** Früher lag der Pfad **relativ zum Arbeitsverzeichnis** des Backends, und `resolve_pdf_path()` gab ihn unverändert zurück. Ein Start aus einem anderen Ordner führte dadurch zu HTTP 404; außerdem gab es keine Prüfung, dass der Pfad innerhalb der Ablage liegt.

> **Wichtig:** Der Artikelordner ist die **Dateiablage des Artikels**. Er enthält
> die Einrichtepläne (`plan.pdf`, `plan-2.pdf` …), die Bilder
> (`bild-<n>.<ext>`, DEC-058) und den Zwischenspeicher `.thumbs` (DEC-059). Beim
> Löschen des Artikels verschwindet der ganze Ordner – die Bestätigung sagt das
> ausdrücklich.

## 7. Datei-Fenster (`PDFViewer.tsx`) – Split-Screen

> **Wichtig – das Fenster wird geteilt (DEC-065):** Seit dem Bereich „Datenblatt"
> bedient `PDFViewer.tsx` **zwei** Fachbereiche. Es kennt deshalb keine Endpunkte
> mehr: Dokument und Datei-Quelle kommen als Props herein (`types/viewer.ts`,
> `lib/viewerSources.ts`). Die hier beschriebene Serienartikel-Anbindung
> (`getSerialArticleFile`, Artikelordner) ist unverändert – sie wird nur über
> `serialArticleViewer()` bereitgestellt. Die Beschriftung „Einrichteplan" gilt
> weiterhin für Serienartikel; das Datenblatt übergibt `planLabel="Datenblatt"`.

Ein Fenster für **beide** Dateiarten: links die Dateiliste, rechts die große Ansicht (DEC-059).

| Aspekt | Ist-Stand |
|---|---|
| Props | `{ article, initialTab?: 'plan' \| 'bilder', canManage?, onImagesChanged?, onClose }` |
| Aufbau | Kopfzeile (Artikelnummer, Name, Zuordnung, Aktionen) · darunter Split-Screen: `<nav aria-label="Dateien des Serienartikels">` links (`md:w-60`, mobil eine waagerechte Leiste) und die große Ansicht rechts |
| Dateiliste | Je **Plan** ein Eintrag „Einrichteplan" mit Dateiname und KB, je Bild ein Eintrag mit **Vorschaubild in fester Größe**, Name und KB; der ausgewählte Eintrag ist hervorgehoben (`aria-current`) |
| Vorschaubilder | `getSerialArticleFile(id, name, 'thumb')` → `?variant=thumb`: max. **400 × 400 px**, JPEG (DEC-059). Ohne Pillow oder bei unlesbarem Bild kommt das Original |
| Große Ansicht | Plan: `<iframe>` mit der Blob-URL (`title="PDF <Dateiname>"`), geladen über `/files/{name}` (DEC-062). Bild: `<img>` in **Originalgröße**, geladen erst beim Auswählen – mit Name und Größe darunter |
| Startauswahl | Erster Plan, sonst erstes Bild (bei `initialTab="bilder"` das erste Bild) |
| Aufräumen | `URL.revokeObjectURL` im Cleanup; `cancelled`-Flag gegen verspätete Antworten |
| Zustände | Plan: `idle`/`loading` (`ui-spinner`, „PDF wird geladen …“)/`error` (`ui-alert-error`)/`ready`; Bild: `loading`/`ready`/`error` |
| Aktionen | „Herunterladen" (bei gewähltem Plan), „Einrichteplan entfernen" / „Bild entfernen" (bei `canManage`) mit Bestätigungsdialog, „Schließen" |
| Werkzeugleiste (Bild) | Über der Bildansicht (DEC-061): Verkleinern / Prozentanzeige (`aria-live`) / Vergrößern, Drehen links und rechts (±90°), Zurücksetzen. Zoomstufen 50, 75, 100 (eingepasst), 125, 150, 200, 300, 400 %. Bei Zoom > 100 % oder Drehung lässt sich das Bild **durch Ziehen** verschieben (Hinweis in der Bildunterschrift) |
| Fenstergröße | `h-[94dvh]` / `max-h-[calc(100dvh-1rem)]`, Breite bis `95vw` bzw. `1400px`, Dateiliste 16 rem |
| Darstellung | Modal (`modal-overlay` / `modal-panel`); `role="dialog"`, `aria-modal`, `aria-labelledby`, `Escape` schließt |

> **Wichtig:** Das PDF wird als **Blob** geladen, nicht per direktem `<iframe src="/api/…">`. Nur so kann der `Authorization: Bearer`-Header mitgeschickt werden; ein direkter iframe-Aufruf auf die API-URL wäre unauthentifiziert und würde fehlschlagen.

> **Offen:** Gerendert wird über den PDF-Plugin-Mechanismus des Browsers. Ohne integrierten Betrachter (manche Tablets) bleibt der iframe leer – angezeigt wird dann kein Fehler, sondern eine leere Fläche.

## 8. Formular (`SerialArticleForm.tsx`)

**Ein** Formular, **kein eigenes Fenster**: Es sitzt im Anlege-Formular – im Reiter „Serienartikel" (DEC-056 Punkt 5). Karte, Überschrift („Anlegen" / „Bearbeiten") und der „Zurück"-Knopf gehören dem Aufrufer (`Tools.tsx`). Gespeichert wird **unabhängig** vom Werkzeug: der Speichern-Knopf des Werkzeugformulars legt keinen Serienartikel an und umgekehrt.

| Aspekt | Ist-Stand |
|---|---|
| Felder | Artikelnummer (Pflicht), Name, Werk (Pflicht), Kunde, Maschine (abhängig vom Werk), Beschreibung, Dateien |
| Feldaufbau | Wie im Werkzeugformular: **Innenlabel** (`.ui-field`, Guide §1.9) für alle Eingaben; die **Beschreibung** ist ein mehrzeiliges Feld (`textarea`, 3 Zeilen, Label darüber); Meldungen stehen direkt am Feld |
| Dateifeld | **Ein** Feld für Einrichteplan **und** Bilder (DEC-060): Mehrfachauswahl oder Drag & Drop; `accept` erlaubt PDF und Bilder (JPG, PNG, WEBP, GIF, BMP, HEIC). Die Suiten `DOC_ACCEPT`, `isPlan()` und `isBild()` sortieren die Auswahl beim Ablegen: erstes PDF → Plan, alles andere → Bilder |
| Auswahlliste | Unter dem Feld: **„Hinterlegte Dateien"** (jeder Plan mit Symbol, Dateiname, KB und Art, jedes Bild mit Vorschau – **jeder Eintrag mit „Löschen"**, wirkt sofort über `DELETE /{id}/files/{name}`, DEC-062) und **„Kommt beim Speichern dazu"** (neu ausgewählte Dateien, einzeln entfernbar). Es gibt keine Hinweissätze mehr über „hinterlegte" Dateien – die Listen zeigen den echten Zustand |
| Live-Prüfung | 400 ms nach dem Tippen: „Wird geprüft …“ → „Artikelnummer … ist frei.“ / „… ist bereits vergeben – vergeben an „…“.“ (ereignisgesteuert, nicht in einem Effekt) |
| Pflichtprüfung | Artikelnummer („Bitte eine Artikelnummer angeben.“), Werk („Bitte ein Werk auswählen.“), vergebene Nummer blockiert |
| Werk-Vorauswahl | **Keine**: beim Anlegen ist das Werk leer und muss gewählt werden. Aus dem Werkzeugformular kommt es vorbelegt (siehe unten) |
| Absenden | `POST` beim Anlegen, `PUT` beim Bearbeiten – jeweils `multipart/form-data` mit **allen** Feldern |
| Erfolg (Anlegen) | Meldung im Formular, Reiter bleibt offen: Nummer, Name, Beschreibung und Datei werden geleert, Werk/Kunde/Maschine bleiben – der nächste Plan kann direkt folgen. Die App zeigt zusätzlich einen Toast |
| Erfolg (Bearbeiten) | Das Formular schließt sich, die App wechselt zurück in den Serienartikel-Bereich, lädt die Liste neu und zeigt einen Toast |
| Vorbelegung | Öffnet man das Anlege-Formular über die Werkzeugliste und wählt dort Werk, Kunde und Maschine, übernimmt der Reiter „Serienartikel" diese Werte beim Öffnen. Spätere Änderungen im Werkzeugformular ändern den Plan nicht |
| Speichern-Knopf | „Serienartikel anlegen“ / „Änderungen speichern“ / „Wird gespeichert …“ |

Ablauf „Anlegen/Bearbeiten aus dem Serienartikel-Bereich“: „+ Anlegen“ oder „Bearbeiten“ im Zeilenmenü → `App.tsx` legt einen **Einmal-Auftrag** an (`serialRequest` mit Token und Artikel) und wechselt auf die Anlege-Ansicht → `Tools.tsx` öffnet die Karte, setzt den Reiter auf „series“ und übergibt den Artikel → Speichern → `onSerialArticleSaved` (Toast + Liste) → beim Bearbeiten `closeForm()` mit `onSerialFormClosed` → zurück zum Serienartikel-Bereich.

> **Wichtig:** `api/serialArticles.ts` setzt **keinen** `Content-Type`-Header; `api/client.ts` lässt ihn bei Formulardaten bewusst weg, damit der Browser die multipart-Boundary erzeugt.

> **Wichtig:** Die Dateigröße wird **nicht** geprüft – weder im Frontend noch im Backend (`_write_plan` liest `await file.read()` vollständig in den Speicher). Bewusste Entscheidung (DEC-056 Punkt 12).

## 9. Berechtigungen

| Aktion | Abhängigkeit | Durchsetzung |
|---|---|---|
| Liste, Detail, PDF anzeigen/herunterladen, Nummern-Prüfung | `require_active` | Server |
| Serienartikel anlegen (inkl. PDF) | `require_admin` | Server |
| Serienartikel ändern / PDF ersetzen | `require_admin` | Server |
| Serienartikel löschen (inkl. Ordner) | `require_admin` | Server |
| „+ Anlegen“ in der Tabbar; „Bearbeiten“/„Löschen“ im Zeilenmenü | `user.is_admin` | **nur** Frontend (zusätzlich serverseitig geprüft) |

> **Wichtig (DEC-056 Punkt 4):** Das Verwalten ist Administratoren vorbehalten – serverseitig über `require_admin`. Suchen, Ansehen und Herunterladen darf jeder aktive Benutzer. Die Knöpfe werden Nicht-Admins nicht angezeigt; das Ausblenden ist die Oberfläche, nicht die Sicherheitsmaßnahme.

> **Offen:** Ein feingranulares Recht (`serial_articles:write`) existiert nicht. Geprüft wird die Admin-Flagge `User.is_admin`, wie in allen anderen Routen (`docs/02-domain-model.md` §9, offener Punkt 6).

## 10. Bekannte Grenzen

| Punkt | Stand |
|---|---|
| Foto-Upload | **Umgesetzt (DEC-058)**: mehrere Bilder je Artikel, im Artikelordner als `bild-<n>.<ext>`, ansehen und einzeln entfernen im Datei-Fenster |
| Größen- und Inhaltsprüfung | **Nicht umgesetzt** – bewusst (DEC-056 Punkt 12). Auch von Bildern: geprüft wird nur die Endung |
| Bildbearbeitung | **Nicht umgesetzt**: keine Verkleinerung, kein Drehen, keine serverseitigen Vorschaubilder |
| Kennzahl „Serienartikel“ | Die Statistikleiste rechts zeigt weiterhin dauerhaft „—“ (Audit A-27) |
| Pfadbasis | Fest auf das Backend-Verzeichnis (`backend/`); eine Konfiguration über `TOOLSYNC_UPLOAD_DIR` gibt es nur für Tests, nicht in `app/core/config.py` |
| Download-Dateiname | Immer `<Artikelnummer>.pdf`; der Name des Plans fließt nicht ein |

## 11. Offene Fragen

- Soll der Ablageordner in der Konfiguration stehen (statt nur über die Umgebungsvariable `TOOLSYNC_UPLOAD_DIR` für Tests)?
- Soll ein Fehler beim Entfernen der Datei gemeldet werden, statt still zu bleiben (heute wird nur die Datenbankzeile garantiert gelöscht)?
- Soll die Liste zusätzlich nach **Kunde** und **Maschine** filterbar sein (das Backend kann es bereits, die Oberfläche bietet nur den Werk-Filter)?
- Soll der Download-Dateiname den Plan-Namen enthalten (`<Nummer>_<Name>.pdf`)?
- Wann kommt der **Foto-Upload** in den Artikelordner (eigene Entscheidung nötig: Anzeige, Rechte, Größenbegrenzung)? → **entschieden und umgesetzt: DEC-058**
- Soll es eine **Größenbegrenzung** für Bilder geben (Handyfotos sind mehrere MB)?
- Soll die Kennzahl „Serienartikel“ in der Statistikleiste echte Zahlen zeigen?
- Bleibt `Machine.name` nicht eindeutig (gleiche Namen in einem Werk sind möglich, `docs/02-domain-model.md` §6)?

## 12. Testabdeckung

| Ebene | Datei | Umfang |
|---|---|---|
| Backend | `backend/tests/test_serial_articles.py` | 66 Tests: Felder und Pflichtwerte, Stammdatenprüfung, Suche über alle Felder, Filter, Sortierung mit NULLS LAST, stabile Pagination, Nummernprüfung, Ordnernamen und -bereinigung, Anlegen/Umbenennen/Löschen des Ordners, **mehrere Einrichtepläne** (hinzufügen statt ersetzen, Nummerierung, `pdf_path`-Nachführung, letzter Plan löscht `has_pdf`), Pfadauflösung ohne Ausbruch aus der Ablage, **Bilder** und **Vorschaubilder** |
| Browser | `frontend/tests/serial-articles.spec.ts` | 16 Tests: Liste mit Gesamtzahl und Blätterleiste, **Layout-Prüfung bei 1440 × 900**, Anlegen mit PDF **und zwei Bildern in einem Schritt**, vergebene Nummer beim Tippen, Pflichtfeld Werk, Bearbeiten ohne eigenes Fenster, Löschen über den Bestätigungsdialog, Suche über Kunde/Maschine/Beschreibung und **Werk-Filter als Segmente**, **Favoriten setzen und filtern**, Sortierung mit `aria-sort`, zweite Seite, normale Benutzer ohne Verwaltungs-Aktionen, Vorschau per Zeilenklick, Split-Screen mit Zoom/Drehen, mehrere Pläne verwalten, Sub-Reiter im Werkzeugformular mit Vorbelegung |

Voraussetzung der Browser-Tests: Backend auf `127.0.0.1:8000`, Dev-Server auf `127.0.0.1:5173`; Admin-Konto `admin1/123` und der normale Benutzer `1233` müssen existieren, sonst wird die Spec übersprungen.

**Drei Fallen, die beim Schreiben der Tests aufgefallen sind** (für künftige Specs wichtig):

1. Eine Suche darf nicht nur auf *eine* passende Zeile warten: bei 12 Plänen steht sie schon in der ungefilterten ersten Seite. Der Klick traf dann die erste Zeile der alten Liste – beim Bearbeiten wurde so der falsche Plan geändert. `suche()` wartet deshalb, bis **alle** sichtbaren Zeilen den Suchbegriff enthalten.
2. Die Liste darf sich nicht auf eine feste Gesamtzahl verlassen: im Bestand können weitere Serienartikel liegen (eigene Testdaten). Assertions arbeiten mit Mustern (`/^1–10 von \d+ Serienartikeln$/`).
3. `getByLabel('Werk')` ist mehrdeutig: im Werkzeugformular heißen drei Felder so ähnlich (`Werkzeug-ID`, `Werkzeug-Typ`, `Werk`), und der Reiter „Serienartikel" beschriftet sein Werk mit `Werk *`. Ebenso kollidiert `getByRole('button', { name: /Werk/ })` mit dem Tab „Werkzeuge“ – `exact: true` bzw. der vollständige Name sind nötig.
