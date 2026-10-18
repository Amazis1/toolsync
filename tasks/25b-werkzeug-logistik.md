# TASK-025b – Werkzeug-Logistik zwischen den Werken

**Status:** COMPLETED (Abnahme durch den Projektinhaber offen)
**Basis:** DEC-072 (Auftrag/Transport/Empfang), DEC-073 (Reihenfolge), DEC-074 (Empfang
Stufe 1), DEC-075 (Einordnung Main Site), DEC-076 (Werkfarbe), DEC-077 („Wo ist was"),
DEC-078 (Rückgabe je Werkzeug), DEC-079 (Umsetzungs-Abweichungen)
**Plan:** `docs/21-werkzeug-logistik.md`
**Auslöser (Projektinhaber):** „Werkzeug Logistik: Auftrags-Nr. als Freitext, Suche
nach Werkzeugen im eigenen Werk, Mehrfachauswahl, Info-Feld, optional mehrere
Aufträge. Der Heimatplatz darf sich **nicht** ändern – das Werkzeug ist nur
unterwegs, das empfangende Werk bestätigt die Ankunft, zurück geht es über
‚Zurück schicken'. In allen Werken gleich."
Später: „Das ist sehr unübersichtlich, zu viel belastet. Die Aufträge sollen als
Dropdown sein … mit Modal arbeiten" → DEC-075.

---

## 1. Datenmodell

| Objekt | Inhalt |
|---|---|
| `transport_orders` | `order_number` (Freitext), `reference`, `status`, `info`, `from_plant_id`, `to_plant_id`, `parent_order_id`, `created_by_id`, `created_plant_id`, `sent_at`, `sent_by_id`, `closed_at` |
| `transport_items` | `order_id`, `tool_id`, `home_position_id`, `home_position_code` (**Heimatplatz zum Versandzeitpunkt**), `received_at`, `received_by_id`, `received_plant_id`, `note` |
| `tool_movements.transport_id` | verbindet Verlauf und Auftrag |

Migration `d7a1c4f93e26` – idempotent und **objektweise** geprüft (Tabelle, Index,
Spalte getrennt), weil `Base.metadata.create_all` beim Start dazwischenkommen kann.
Auf- und abwärts geprüft; Sicherung vorher unter `.backup-history/toolsync-vor-025b-*.db`.

**Warum `current_plant_id` erst beim Empfang:** `tools.plant_id` bleibt das Heimatwerk,
`tools.position_id` der Heimatplatz – beide werden vom Transport **nie** angefasst
(DEC-071). Unterwegs ist das Werkzeug `in_transit`, der Platz ist reserviert.

## 2. Fachliche Regeln (im Service, nicht im Router)

- Verschickt wird nur, was **verfügbar**, **im Arbeitswerk** und in **keinem offenen
  Auftrag** ist; defekt/Wartung/ausgeliehen sind gesperrt – mit Klartext-Grund.
- Ein Auftrag ist **eine Richtung**; der Rückweg ist ein eigener Auftrag mit
  `parent_order_id` und der Nummer `…-R`.
- Storno **nur im Entwurf**; ein verschickter Auftrag wird über den Rückweg aufgelöst.
- Empfang **je Zeile** oder „alles"; nur das Empfängerwerk darf bestätigen.
- Leerer Auftrag lässt sich anlegen, aber nicht verschicken.
- Ein Werkzeug steht in **höchstens einem** offenen Auftrag.

## 3. Backend

| Änderung | Ort |
|---|---|
| Zustände `TransportStatus` + offene/verschickte Mengen | `models/enums.py` |
| Modelle `TransportOrder`, `TransportItem` | `models/transport.py` (neu) |
| Migration (2 Tabellen, 4 Indizes, `tool_movements.transport_id`) | `alembic/versions/d7a1c4f93e26_transport.py` |
| Schemas (Anlegen, Empfang, Rückweg, Lesen, Kandidat, Abwesend) | `schemas/transport.py` (neu) |
| Service mit allen Regeln (767 Zeilen) | `services/transport_service.py` (neu) |
| Endpunkte `/api/transport/orders…`, `/candidates`, `/away` | `routers/transport.py` (neu) |
| Router registriert | `main.py` |

**Zwei Fehler, die die Tests aufgedeckt haben (beide behoben):**

1. **`get_order` lud Beziehungen nicht frisch.** Die Sitzung läuft mit
   `expire_on_commit=False`; nach `send_order`/`receive_order` blieb die vorher
   geladene (leere) Beziehung `sent_by`/`received_by` im Objekt hängen – die Antwort
   meldete „verschickt von: –". Jetzt liest `get_order` mit
   `populate_existing=True` und lädt die Personen ausdrücklich mit.
2. **`return_order` sah den eigenen Auftrag als Hindernis.** Ein **teilweise**
   empfangener Auftrag ist selbst noch offen; seine schon angekommenen Werkzeuge
   galten dadurch als „bereits im Auftrag". `_open_order_of_tool` bekommt jetzt
   `exclude_order_id`.

## 4. Oberfläche

| Ort | Inhalt |
|---|---|
| Reiter **Logistik** (Tab-Leiste, nach „Ersatzteile") | drei Unterbereiche: **Aufträge · Eingang (mit Zähler) · Wo ist was** |
| **Aufträge** | ein Auftrag = **eine Zeile** (Nr. · Zustand · Richtung · von → an in beiden Werkfarben · Anzahl · Datum), zugeklappt; aufgeklappt Positionen, Aktionen und Nachweis |
| **Eingang** | je Auftrag eine Karte: Absender, „n von m noch nicht bestätigt", Versandzeitpunkt, Info; Tabelle mit angekommenen Zeilen; darunter „Angenommen" |
| **Wo ist was** | nur unterwegs/ausgeliehen (DEC-077), Segmente Alles · Unterwegs · Ausgeliehen |
| Fenster | **Neuer Auftrag** (Kopf, Suche, Auswahl mit Sperrgrund, „Speichern und nächster"), **Empfang bestätigen**, **Zurück schicken**, **Auftrag öffnen** |
| Werkzeugliste | unter dem Werk steht bei Abweichung **„aktuell Werk 2"** in der Farbe des anderen Werks (DEC-071) |

**Werkfarbe (DEC-076):** aktiver Reiter, „+ Neuer Auftrag"/Bestätigen-Knöpfe
(`.ui-btn-werk`), Werk-Namen in **ihrer** Farbe, ganze Zeile in `rgba(Werkfarbe, .14)`
(überfahren `.20`, kein Zebra). Keine farbigen Kanten.

**Ein Weg je Handlung:** Der Eingang ist eine Leseansicht; bestätigt wird im Fenster.
Zwei Stellen mit Häkchen (Seite **und** Fenster) wären zwei Wahrheiten über denselben
Vorgang – siehe DEC-079.

## 5. Tests

**Backend: 255 passed** (vorher 214; **41 neu** in `tests/test_transport.py`):
Anlegen (Zeilen, Heimatplatz-Code, gleiches Werk, unbekanntes Werk/Werkzeug,
Doppelbuchung, fremdes Werk, ausgeliehen/defekt/Wartung, leere Zeilen), Entwurf ändern,
Verschicken (Status, Platz bleibt, Bewegung mit Auftragsbezug, zweimal, falsches Werk),
Empfang (Ort, Bewegung, Teilempfang, falsches Werk, Entwurf, doppelt, fremde Zeile),
Storno, Rückweg (eigener Auftrag, `-R`, nur Angekommenes, nur Empfängerwerk, kompletter
Rundlauf mit 8 Bewegungen, kein Rückweg vom Rückweg), Listen (Richtung, Status, Suche),
Kandidaten (Sperrgrund, offener Auftrag) und „Wo ist was".

**Browser: 100 passed** (vorher 94; **6 neu** in `tests/logistics.spec.ts`):
Auftrag anlegen und verschicken (inkl. „aktuell Werk 2" in der Werkzeugliste), Eingang
mit Zähler und Empfang, Rück-Auftrag anlegen und verschicken, Rückweg bestätigen
(Werkzeug wieder zu Hause, geprüft über die API), Werkfarbe (Zeile 14 %/20 %, aktiver
Reiter), gesperrte Zeile mit Klartext-Grund.

**Der Lauf braucht eine Datenbank-Kopie.** Ein Auftrag ist ein Nachweis und wird
bewusst nicht gelöscht; `tests/logistics.spec.ts` und `docs/21` § 9 beschreiben den
Weg (`toolsync-ui-test.db`, Backend auf 8002, `PLAYWRIGHT_BASE_URL`). Die
Playwright-Konfiguration nimmt die Adresse jetzt aus der Umgebungsvariable.

**Messprüfung statt Bildschirmfoto** (`.audit/pruefe-logistik-ui.mjs`): kein
waagerechter Überlauf bei 1500, 1280 und 420 px; Auftragszeile **40 px** (eine Zeile je
Auftrag, wie DEC-075 verlangt); Fenster „Neuer Auftrag" passt in die Höhe. Der Lauf
fand **einen echten Fehler**: `StarIcon` reichte `filled` an das `<svg>` durch (React:
„Received `false` for a non-boolean attribute") – der Favoritenstern war außerdem nie
gefüllt. Jetzt wird `filled` in `fill` übersetzt, die Konsole ist auf allen vier
Ansichten leer. Die Bilder für die visuelle Abnahme liegen in
`.audit/bilder-logistik/`.

**Nach der Bild-Abnahme nachgezogen** (Kleinigkeiten, die erst auf dem Bildschirmfoto
auffallen):

1. **Kein doppeltes Wort in der Zeile.** Die Spalten „Zustand" und „Empfang" sagten
   beide „unterwegs"; die Empfangs-Spalte heißt jetzt **„ausstehend"** (bzw. „da ·
   Zeitpunkt"/„angekommen · Zeitpunkt"). Der Zustand steht einmal, links.
2. **Fußleisten in den Fenstern** haben eine Trennlinie und Abstand: vorher berührten
   die Knöpfe die unten abgeschnittene Tabellenzeile.
3. **„Angenommen" erscheint nur, wenn etwas angekommen ist** – eine Karte mit
   „0 abgeschlossen" war nur Fläche. Der Leertext der Auftragsliste ist jetzt je
   Bereich verschieden („Noch nichts angekommen." statt „Kein Auftrag aus diesem Werk.").
4. **Eingangs-Karten sind als Gruppe benannt** (`role="group"`, `aria-label="Auftrag …"`)
   – besser für Screenreader und für Prüfläufe, die eine bestimmte Karte meinen.
   Die Spec prüft den Eingang-Zähler deshalb auf „eine Zahl", nicht auf „1": er zählt
   alle offenen Aufträge des Werks, nicht nur den eigenen.

**Nach der Abnahme durch den Inhaber (DEC-080):** Die Werkzeugliste bleibt neutral
(Zebra + Favoriten; keine Zeilenfarbe – „nein"), und die **Spalte „Zustand" ist
entfallen** – im Auswahlfenster (dort sagt „Hinweis" alles) und in den
Auftrags-Tabellen (dort sagt „Empfang" alles). In „Wo ist was" bleibt sie, weil sie
dort *unterwegs* von *ausgeliehen* unterscheidet. Damit sind es im Auswahlfenster 6
statt 7 und in den Auftrags-Tabellen 5 statt 6 Spalten.

**„Kein Status" gilt als verfügbar (DEC-080 Punkt 4)** – nachgezogen an vier Stellen:

| Stelle | Änderung | Test |
|---|---|---|
| `services/movement_service.py` | Ausleihe erlaubt bei „nicht gesetzt oder `available`" | 3 neue in `tests/test_tool_return.py` |
| `crud/crud_tool.py` (Filter) | Filter „Verfügbar" schließt `status IS NULL` ein | 1 neuer + 2 angepasste in `tests/test_tools_list.py` |
| `crud/crud_tool.py` (Sortierung) | „ohne Status" hat denselben Rang wie „verfügbar" | angepasst |
| `ToolForm`, `AdminDashboard` | Leerauswahl heißt „— ohne Status (gilt als verfügbar)"; KPI und Marke zählen sie als „Frei" | Browser-Suite |

Hintergrund: **14 von 16 Werkzeugen** hatten keinen Status und waren damit **stumm
gesperrt** („ist nicht verfügbar (aktueller Status: unbekannt)"), während der Transport
sie akzeptierte. Backend jetzt **259 passed** (vorher 255).

**„Ohne Status" ist als Auswahl entfallen (DEC-080 Punkt 5):** Das Formular bietet nur
noch die fünf Zustände und steht auf **verfügbar**; ein Datensatz ohne Status wird beim
Öffnen als „verfügbar" gezeigt. Der Bestand wurde einmalig nachgezogen (14 Werkzeuge),
`status IS NULL` kommt nicht mehr vor. Der Browser-Test „setzt den Status im Formular
um" prüft jetzt Vorauswahl, fehlende Leeroption und das Zurücksetzen auf „verfügbar".
*Fallstrick:* Die Enum-Werte liegen **groß** in der Datenbank (`AVAILABLE`) – ein
`UPDATE … SET status='available'` schreibt einen für den ORM unlesbaren Wert. Das ist
beim Nachziehen passiert und sofort korrigiert worden.

## 7. Testdaten für die Oberfläche

Auf Wunsch des Inhabers („20 Werkzeuge je Stempel, Matrize, Abstreifer, komplett
ausgefüllt"): `.audit/seed-testdaten.mjs` legt über die **API** an – mit echten
Matrixplätzen, Werkzeugtypen, Kunden und Maschinen aus den Stammdaten:

| Bestand | Anzahl | Vollständigkeit |
|---|---|---|
| Werkzeuge | **60** (20 Stempel, 20 Matrize, 20 Abstreifer) | ID, Kategorie, Status verfügbar, Maß A (+ Maß B bei jedem dritten), Beschreibung, Werk, Typ, **Matrixplatz**, Kunde, Maschine, jeder siebte Favorit |
| Datenblätter | **20** (eins je Stempel) | Werkzeug-ID, Werk, Maschine, Name, Beschreibung, **angehängtes PDF** |
| Serienartikel | **12** | Artikelnummer, Name, Werk, Kunde, Maschine, Beschreibung, **angehängter Plan** |
| Ersatzteile | **12** | Artikelnummer, Name, Art, Menge, Einheit, Maschine, **Matrixplatz**, Beschreibung |

Verteilung: abwechselnd auf beide Werke (44 Werkzeuge in Werk 1, 32 in Werk 2 – Werk 1
hatte die Altbestände). Nummernkreise `90…`/`91…`/`92…` (Werkzeuge), `SA-90…`,
`ET-90…` – daran hängt auch das Entfernen: `node .audit/seed-testdaten.mjs --entfernen`
löscht genau die angelegten Datensätze (Protokoll in `.audit/seed-testdaten.json`).
Sicherung vorher: `.backup-history/toolsync-vor-testdaten-*.db`.

**Demo-Zustand** (`--zustand`, DEC-081): vier Ausleihen (als „Max Mustermann", Personalnr.
1234 – Adminkonten dürfen sich nicht ohne Passwort anmelden) und ein Transport, der
**unterwegs bleibt**. Erst dadurch hat „Wo ist was" und die Rückgabe-Liste etwas zu
zeigen. `--entfernen` nimmt diese Ausleihen zuerst zurück; die Transport-Aufträge sind
Nachweise und bleiben stehen.

## 8. Drei Wünsche aus der ersten Bedienung (DEC-081)

| Wunsch | Umsetzung |
|---|---|
| Fremde Werkzeuge in der Auswahl | `TransportService.candidates` liefert **nur** das Arbeitswerk; Werkzeuge im eigenen Werk, die gerade nicht dürfen, bleiben mit Grund sichtbar |
| „Wo ist was" leer | bleibt bewusst nur Unterwegs/Ausgeliehenes; der **Demo-Zustand** füllt es (5 Ausleihen, 8 unterwegs) |
| Formular „Werkzeug zurück" | `ZurueckModal`: listet **Werkzeuge aus anderen Werken, die hier liegen** (`GET /transport/borrowed`), gruppiert nach Heimatwerk; ein Knopf legt den Rück-Auftrag an **und meldet ihn gleich als unterwegs**. Knopf in der Logistik-Leiste neben „+ Neuer Auftrag" |

> **Zweite Fassung, nach Klarstellung des Inhabers:** Die erste Umsetzung listete die an
> **Personen** ausgeliehenen Werkzeuge („Rückgabe-Liste"). Gemeint war aber der Rückweg
> zwischen **Werken**: „der jeweilige Werk schickt die Werkzeuge zurück". Diese Liste ist
> wieder entfernt; die Rückgabe an eine Person bleibt im Zeilenmenü (DEC-078).
> Unterwegs befindliche Werkzeuge stehen nicht in der Liste – sie liegen nicht mehr im
> Regal, obwohl `current_plant_id` erst beim Empfang wechselt.

**Dritte Fassung – Bedienung wie die übrigen Fenster (DEC-081 Punkt 5):** Suchleiste über
ID/Art/Typ/Maß/Heimatwerk mit Treffer-Zähler, Filter je Heimatwerk (nur bei mehreren
Heimatwerken), „Alle auswählen"/„Auswahl aufheben" (Auswahl-Knopf nennt die Anzahl und ist
ohne Auswahl gesperrt), Tooltips an Knöpfen und Werten, Kopf-Abstand auf `mb-3` angeglichen.
**Escape** funktionierte bereits (`useEscapeKey`); die Spec prüft es jetzt **mit dem Fokus
im Suchfeld**. Die Suche bleibt nach dem Zurückschicken stehen.

## 9. Kosmetik (DEC-082)

Nach dem ersten Durchklicken des Inhabers („jetzt die Kosmetik der Logistik"):

| Punkt | vorher | jetzt |
|---|---|---|
| Sprache | „1 Werkzeug(e)", „3 Werkzeug(e)" an 9 Stellen | „1 Werkzeug" / „3 Werkzeuge" (`lib/format.ts`, auch „1 Auftrag / 3 Aufträge") |
| Abstände | Karten `p-4`, `space-y-3`, Unterleiste `py-2` | `p-5`, `space-y-4`, `px-3 py-1.5` – wie die übrigen Bereiche und die Haupt-Tab-Leiste (gemessen: Karte 16 → **20 px**, Leiste 60 → **56 px**) |
| Leerzustände | drei verschiedene Formen (Fläche, nackter Satz, Tabellenzeile) | ein `Leerzustand`-Baustein mit Satz + Hinweis auf den nächsten Schritt |
| Zustände | „Entwurf" und „storniert" im **gleichen** Grau, „Rückweg" ebenso | storniert = Umriss ohne Fläche, Rückweg = eigene Marke mit ↩ |
| Knöpfe | „+ Neuer Auftrag" als getipptes Plus, „Werkzeug zurück" ohne Zeichen | `AddIcon` und neues `ReturnIcon` (Lucide `Undo2`; `ResetIcon` bleibt „Filter zurücksetzen") |
| Ankreuzfelder | natives Blau | Werkfarbe (`accent-color: var(--werk)`) |
| Aufklapp-Pfeil | Textzeichen ▴/▾ | `ChevronDownIcon` mit Drehung |

Nicht geändert (mit Absicht): Tabellenköpfe bleiben 10 px in Großbuchstaben – das ist im
Projekt die Marke für Spaltenköpfe (14 Dateien).

### 9.1 Dropdowns: Abstände und Farben (Nachmessung)

Auf den Hinweis des Inhabers („schau dir die Dropdown-Abstände und Farben an") gemessen und
geändert:

| Punkt | vorher | jetzt |
|---|---|---|
| Kopfzeile je Auftrag | 36 px hoch, `px-2 py-2` | 40 px, `px-2.5 py-2.5` |
| Aufgeklappter Körper | `space-y-2 px-2 pb-3` – 8-px-Rhythmus **ohne** Abstand zur Kopfzeile | `space-y-3 px-2.5 pt-1 pb-3` – 12-px-Rhythmus wie überall |
| Zellen der Positionstabelle | `px-2` (8 px) | `px-2.5` (10 px), Zeilenhöhe bleibt 39 px |
| Farbebenen | Zeile → **3× Weiß** (`white/35`, `white/35`, Karte `white/48`) | Zeile → **1×** `border-white/60 bg-white/30` → Karte – die Werkfarbe wirkt klarer (rechnerisch: statt `rgb(211,226,227)` jetzt `rgb(204,220,221)`) |
| Tabellenkopf | `white/45` | `white/60` (hebt sich von der Fläche ab) |
| Info-Zeile im Auftrag | vierte weiße Schicht (`white/55`) | `var(--werk-soft)` – dieselbe Sprache wie die Info-Zeile im Eingang |
| Richtungsmarke + Nachweis | `text-[11px]` | `text-xs` (12 px, Guide-Untergrenze) |

Dieselbe Ebenen-Regel gilt jetzt in Eingang-Karten, „Wo ist was" und in allen Fenstern der
Logistik (Empfang, Zurück schicken, Neuer Auftrag, Werkzeug zurück, Nachweis).

## 10. Auftragsliste: jede Zeile eine Karte (DEC-084)

Rückmeldung des Inhabers: „In Aufträge die Dropdowns: sieht alles wie ein Block aus. Sehr
unklar für einen neuen Benutzer!" — Die Umsetzung war vom abgenommenen Prototyp
abgewichen, der je Auftrag eine eigene Karte hatte (`.drop`). Zurück auf dieses Muster:

| Punkt | vorher | jetzt |
|---|---|---|
| Struktur | **ein** Container, Aufträge nur durch Haarlinie getrennt | **eine Karte je Auftrag** (`rounded-xl border border-white/60`), 8 px Abstand (`space-y-2`) |
| Kopf ↔ Körper | kein Unterschied | Körper auf eigener Fläche (`bg-white/30`) mit Trennlinie (`border-t border-white/70`) |
| „offen"-Zustand | nicht sichtbar | Karte offen `bg-white/55`, zu `bg-white/35` + Hover `50 %` |
| Aufklapp-Hinweis | nur ein Dreieck am Rand | Text **„Details" / „Zuklappen"** mit Chevron (dreht sich) |
| Eingang | Karte ohne Kopf-Trennung | Kopf (Nummer · Zustand · von → an) abgesetzt, Inhalt darunter auf eigener Fläche |

Gemessen: Karte 12 px Radius, Kopf **44 px**, Körper `white/30` mit 12 px Innenabstand,
Abstand zwischen zwei Karten 54 px (Karte + 8 px). Konsole leer.

**Nebenbefund:** Die Zustandsmarke („unterwegs/ausgeliehen") in der Werk-Spalte machte die
Werkzeugtabelle bei 1440×900 vier Pixel zu breit (Layout-Test schlug an). Sie sitzt jetzt
als kleine Plakette an der **Lagerplatz**-Zeile; die Beschreibungsspalte ging von 10rem auf
9rem.

**Nebenbefund aus dem Probelauf:** Die Werkzeugverteilung folgt den **freien
Matrixplätzen** (der Platz ist die Wahrheit, DEC-071). Ein gemeinsamer Vorrat hätte
alles nach Werk 1 gelegt, weil dort inzwischen die Schublade „01-C" mit 200 Plätzen
steht; deshalb verteilt das Skript abwechselnd auf beide Werke.

## 6. Offen

- **Rechte Spalte der Main Site** (`StatisticsSidebar`) steht weiter auf „—"
  (offene Frage 7 in `docs/21`).
- **Matrix im Admin-Panel**: dritter Kartenzustand „ausgeliehen nach W2" fehlt noch.
- **Zeilenaktion „In Logistik öffnen"** in der Werkzeugliste fehlt (der Sprung in den
  offenen Auftrag).
- **Historie** (TASK-029) zeigt Transporte und Ausleihen noch nicht in einer Ansicht –
  die Bewegungen tragen aber bereits `transport_id` und `plant_id`.
