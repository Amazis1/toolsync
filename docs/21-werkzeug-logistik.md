# ToolSync – Werkzeug-Logistik zwischen Werken

> **Status: geplant, noch nicht umgesetzt.** Dieses Dokument ist der verbindliche Plan.
> Es enthält **keinen** Ist-Stand-Code, sondern die Zielarchitektur – die Umsetzung
> beginnt erst nach der Abnahme der Demo (`docs/demo-werkzeug-logistik.html`).
>
> **Verbindliche Quellen:** `docs/01-requirements.md` (3 Werke, 9 Ausleihe,
> 10 Rückgabe, 11 Werkzeugbewegungen, 15 Rollen), `docs/13-decisions.md`
> (**DEC-070** Arbeitswerk, **DEC-071** Heimatwerk/aktueller Ort, **DEC-072** Logistik,
> **DEC-073** Reihenfolge, **DEC-074** Empfang), `docs/04-warehouse.md` (Matrix,
> Heimatplatz), `docs/08-tool-movement.md` (Verlauf), `docs/16-perlenkette-dnd-agent-doku.md`
> (Verschiebe-Logik).
>
> **Ziel in einem Satz:** Werkzeuge wandern zwischen den Werken, jederzeit sichtbar,
> in beiden Werken gleich bedienbar, und der Heimatplatz bleibt dabei unangetastet.

---

## 1. Ausgangslage und Abgrenzung

Heute gilt:

- `Tool.plant_id` ist „wem gehört es **und** wo liegt es" in einem Feld; im Formular frei
  änderbar. Ein Werkswechsel ist damit ein Stammdatenvorgang.
- `movement_type = "transfer"` existiert und ist **wirkungslos** – er schreibt nur einen
  Verlaufseintrag (`docs/08` §2).
- `MovementStatus.OPEN` und `ToolStatus.IN_TRANSIT` existieren im Modell, werden aber von
  keiner Anwendungsschicht gesetzt: es gibt **keinen** Vorgang, der auf eine Bestätigung
  wartet.
- Ausleihe (`lend`) setzt `Tool.status = lent`; ein **Rückgabe-UI fehlt vollständig**
  (`docs/08` §7), ausgeliehene Werkzeuge bleiben dauerhaft auf `lent`.
- `users` hat kein Werk; wer für welches Werk handelt, ist nirgends festgehalten.

**Abgrenzung:** Dieses Dokument beschreibt den **Transport zwischen Werken**. Ausleihe und
Rückgabe **an Personen** stehen in `docs/08` und werden in TASK-025a nachgezogen
(DEC-073); beide Vorgänge schreiben in **denselben** Verlauf.

---

## 2. Begriffe (nicht vermischen)

| Begriff | Feld | Bedeutung | Wer ändert es |
|---|---|---|---|
| **Arbeitswerk** | Sitzung des Benutzers (`localStorage`, `X-Plant-Id`) | wo der Benutzer *gerade* arbeitet | der Benutzer, jederzeit |
| **Heimatwerk** | `tools.plant_id` | wem das Werkzeug **gehört** (Identität: Werk + Werkzeug-ID) | bewusst im Formular, **nie** durch Logistik |
| **Aktueller Ort** | `tools.current_plant_id` (neu, nullable) | wo das Werkzeug *gerade* liegt; `NULL` = am Heimatwerk | **nur** bestätigter Empfang |
| **Heimatplatz** | `tools.position_id` | der feste Lagerplatz in der Heimat-Matrix | Umplatzierung/Lagerlogik – **nie** ein Transport |

Beispiel des Projektinhabers: `01020000` aus Werk 1 liegt vorübergehend in Werk 2,
während Werk 2 sein **eigenes** `01020000` eingelagert hat. Das ist **kein** Konflikt:
die Eindeutigkeit gilt je **Heimatwerk** (DEC-071). Heimatplatz von W1-`01020000` bleibt
`01-B-05` in Werk 1 und ist währenddessen reserviert.

---

## 3. Datenmodell

### 3.1 `tools` (Änderung)

| Feld | Typ | Neu | Inhalt |
|---|---|---|---|
| `plant_id` | FK → `plants`, `RESTRICT`, NOT NULL | – | **Heimatwerk** (Bedeutung präzisiert, Feldname unverändert) |
| `current_plant_id` | FK → `plants`, `SET NULL`, nullable | **ja** | aktueller Ort; `NULL` = am Heimatwerk |

Regeln: `current_plant_id` wird ausschließlich vom Empfang gesetzt. `position_id` bleibt
unberührt. Die Eindeutigkeitsprüfung (`tool_id + category + plant_id + is_storage` in
`crud_tool.py`) läuft weiterhin über `plant_id` und ändert sich **nicht**.

### 3.2 `users` (Änderung)

| Feld | Typ | Neu | Inhalt |
|---|---|---|---|
| `default_plant_id` | FK → `plants`, `SET NULL`, nullable | **ja** | Startwert des Umschalters (DEC-070 Stufe 2) |

### 3.3 `transport_orders` (neu)

| Feld | Typ | Pflicht | Inhalt |
|---|---|---|---|
| `id` | PK | ja | intern |
| `order_number` | `String(50)` | ja | **Freitext**, führend in Liste und Suche (Auftrag/SAP-Nr.) |
| `reference` | `String(100)` | nein | z. B. Lieferschein |
| `from_plant_id` | FK → `plants`, `RESTRICT` | ja | sendendes Werk (Absender) |
| `to_plant_id` | FK → `plants`, `RESTRICT` | ja | empfangendes Werk |
| `status` | Enum(20), `native_enum=False` | ja | `draft`, `sent`, `partly_received`, `received`, `cancelled` |
| `info` | `String(500)` | nein | Infotext des Absenders |
| `parent_order_id` | FK → `transport_orders.id`, `SET NULL` | nein | Rück-Auftrag zeigt auf den Hin-Auftrag |
| `created_by_id` | FK → `users.id`, `SET NULL` | nein | wer den Auftrag angelegt hat |
| `created_plant_id` | FK → `plants`, `SET NULL` | nein | dessen **Arbeitswerk** (Nachweis) |
| `sent_at` | `DateTime(timezone=True)` | nein | Zeitpunkt „unterwegs" |
| `sent_by_id` | FK → `users.id`, `SET NULL` | nein | wer verschickt hat |
| `closed_at` | `DateTime(timezone=True)` | nein | Abschluss des Auftrags |
| `created_at` / `updated_at` | `AuditMixin` | – | wie projektweit üblich |

Begründung für `from_plant_id` **und** `created_plant_id`: das eine ist die Fachrichtung
des Transports, das andere der Nachweis, aus welchem Arbeitswerk heraus gehandelt wurde
(bei DEC-074 Stufe 1 der einzige Anhaltspunkt). In der Regel sind sie identisch.

### 3.4 `transport_items` (neu)

| Feld | Typ | Pflicht | Inhalt |
|---|---|---|---|
| `id` | PK | ja | intern |
| `order_id` | FK → `transport_orders.id`, `CASCADE` | ja | Zugehörigkeit |
| `tool_id` | FK → `tools.id`, `RESTRICT` | ja | Werkzeug |
| `home_position_id` | FK → `positions.id`, `SET NULL` | nein | **Heimatplatz zum Versandzeitpunkt** (Nachweis) |
| `received_at` | `DateTime(timezone=True)` | nein | Zeitpunkt des Empfangs |
| `received_by_id` | FK → `users.id`, `SET NULL` | nein | wer bestätigt hat |
| `received_plant_id` | FK → `plants`, `SET NULL` | nein | dessen **Arbeitswerk** (Nachweis) |
| `note` | `String(500)` | nein | z. B. „Kiste 2 fehlt" |

Ein Werkzeug darf in höchstens **einem** offenen Auftrag stehen – geprüft im Service
(`draft` und `sent` zählen als offen).

### 3.5 `tool_movements` (Änderung)

| Feld | Typ | Neu | Inhalt |
|---|---|---|---|
| `transport_id` | FK → `transport_orders.id`, `SET NULL`, nullable | **ja** | verbindet Verlauf und Auftrag |
| `plant_id` | FK → `plants`, `SET NULL`, nullable | **ja** | **Arbeitswerk**, aus dem gehandelt wurde |

`movement_type = transfer` bleibt die Bewegungsart. `from_location`/`to_location` sind
weiterhin Freitext und tragen bei Transporten die Werksnamen („Werk 1 → Werk 2") bzw. den
Platzcode, wenn ein Werkzeug im Zielwerk auf einen Platz gelegt wird.

---

## 4. Zustandsmaschine

```
                    ┌──────────── stornieren (nur im Entwurf) ───────────┐
                    ▼                                                    │
   Entwurf ──── "Werkzeuge sind unterwegs" ────▶ Unterwegs ──────────▶ Storniert
  (draft)                                        (sent)                (cancelled)
                    ▲                               │
                    │                               │ Empfang bestätigen
        zurücknehmen│                               │ (einzeln oder alle)
                    │                               ▼
                    └──────────────────────  Teilweise empfangen (partly_received)
                                                    │  letztes Werkzeug bestätigt
                                                    ▼
                                               Empfangen (received) ──▶ Abgeschlossen (closed)
```

**Rückweg:** eigener Auftrag, `from_plant_id` = bisheriges Zielwerk,
`to_plant_id` = Heimatwerk, `parent_order_id` = Hin-Auftrag. Zustände wie oben; der
Empfang liegt diesmal beim **Heimatwerk** und gibt dort den Heimatplatz wieder frei.

### 4.1 Werkzeug-Status während des Vorgangs

| Zeitpunkt | `Tool.status` | `Tool.current_plant_id` | `Tool.position_id` |
|---|---|---|---|
| vor dem Versand | `available` | wie bisher | Heimatplatz |
| Auftrag im Entwurf | `available` (**reserviert**) | unverändert | Heimatplatz (reserviert) |
| „unterwegs" | `in_transit` | unverändert | Heimatplatz (reserviert) |
| Empfang bestätigt | `available` | Zielwerk (bzw. `NULL` bei Heimkehr) | unverändert |
| im Zielwerk auf einen Platz gelegt | `available` | Zielwerk | **neuer** Platz im Zielwerk |

**Warum „reserviert" und nicht „frei"?** Der Projektinhaber hat es so entschieden: der
Lagerplatz ändert sich nicht. Die Kehrseite ist bewusst: der Platz ist belegt, bis das
Werkzeug zurück ist – das Werk braucht also Platz für Ersatz. Ein späterer Ausbauschritt
könnte stattdessen einen Platz-Sonderzustand „ausgeliehen (reserviert, belegbar)"
einführen; das ist in DEC-072 als offene Frage 4 notiert.

### 4.2 Erlaubte Übergänge

| Von | Nach | Aktion | Wer (Arbeitswerk) | Wirkung |
|---|---|---|---|---|
| – | `draft` | Auftrag anlegen | Absenderwerk | Zeilen anlegen, Werkzeuge reservieren |
| `draft` | `draft` | Zeilen ändern | Absenderwerk | hinzufügen/entfernen |
| `draft` | `sent` | verschicken | Absenderwerk | `in_transit` + Verlauf, je Werkzeug |
| `draft` | `cancelled` | stornieren | Absenderwerk | Reservierung aufheben |
| `sent` | `partly_received` | Empfang einzelner Zeilen | Zielwerk | Ort je Werkzeug, `available`, Verlauf |
| `sent` | `received` | „alles angekommen" | Zielwerk | wie oben, für alle Zeilen |
| `partly_received` | `partly_received`/`received` | weitere Zeilen | Zielwerk | wie oben |
| `received` | `closed` | abschließen (automatisch) | – | `closed_at` |
| `received` | `draft` (neu) | Rück-Auftrag anlegen | Zielwerk | neuer Auftrag mit `parent_order_id` |
| `sent` (Hinweg) | `sent` (Rückweg) | „Zurück schicken" | Zielwerk | **kein** Zustandswechsel am Hinweg |

Nicht erlaubt: Zeilen in einem `sent`-Auftrag ändern, ein `sent`-Auftrag stornieren,
mehr als einen offenen Auftrag je Werkzeug, Empfang ohne `sent`.

---

## 5. Fachliche Regeln

### 5.1 Verfügbarkeit (Auswahl im Formular)

| Lage des Werkzeugs | Wählbar? | Hinweis in der Liste |
|---|---|---|
| `status = available`, kein offener Auftrag, liegt im Arbeitswerk | **ja** | Grün |
| `status = lent` (bei einer Person) | nein | „an <Person> ausgeliehen" |
| `status = defective` / `maintenance` | nein | „defekt" / „in Wartung" |
| in einem offenen Auftrag (`draft`/`sent`) | nein | „bereits im Auftrag <Nr.>" |
| liegt in einem **anderen** Werk | nein | „liegt in Werk 2 – nicht im Arbeitswerk" |
| ohne Heimatplatz (Ablage) | ja | „Ablage – keine Platzreservierung" |

Die Suche zeigt **alle** Werke (Werk-Filter wie in den übrigen Listen); nicht wählbare
Zeilen sind sichtbar und mit Begründung markiert. Das ist die einzige Stelle, an der das
Arbeitswerk eine Auswahl einschränkt (DEC-072 Punkt 6.3).

### 5.2 Spiegelung zwischen den Werken

Ein Auftrag hat **zwei** Blickwinkel auf **dieselbe** Zeile:

| Ansicht | Bedingung | Was man tun kann |
|---|---|---|
| **Mein Ausgang** | `from_plant_id` = Arbeitswerk | Auftrag anlegen, Zeilen ändern, verschicken, stornieren, Rückweg verfolgen |
| **Mein Eingang** | `to_plant_id` = Arbeitswerk | Empfang bestätigen (einzeln oder alle), Rück-Auftrag anlegen |

Es gibt **keine** zweite Datenhaltung und **kein** zweites Programm. „Gespiegelt" heißt:
dieselbe Oberfläche, dieselben Regeln, je Werk derselbe Ablauf (DEC-072 Punkt 9).

### 5.3 Empfang (DEC-074 Stufe 1)

- Bestätigen darf, wer sein Arbeitswerk auf das Zielwerk gestellt hat; **jede** Bestätigung
  wird mit Person, Arbeitswerk und Zeitpunkt protokolliert.
- Empfang je Werkzeug **oder** „alles angekommen" (beides).
- Beim Empfang in einer Transaktion: `received_*` an der Zeile, `Tool.status = available`,
  `Tool.current_plant_id`, Verlaufseintrag, Auftragsstatus.
- Bei Heimkehr (`to_plant_id` = Heimatwerk des Werkzeugs) wird `current_plant_id` wieder
  `NULL` – der Heimatplatz ist damit wieder normal belegt.

### 5.4 Konflikte und Sperren

| Fall | Verhalten |
|---|---|
| Werkzeug schon in einem offenen Auftrag | Zeile gesperrt, Auftrags-Nr. genannt |
| Zwei Personen legen denselben Auftrag an | der zweite scheitert an der Zeilenprüfung (serverseitig, in der Transaktion) |
| Werkzeug wird während des Transports verschoben/umplatziert | erlaubt – der Platz bleibt der Heimatplatz; das Werkzeug bleibt `in_transit` |
| Werkzeug wird während des Transports gelöscht | Zeile bleibt als Nachweis (`RESTRICT` auf `tools` verhindert das Löschen, solange ein offener Auftrag existiert) |
| Auftrag mit 0 Zeilen verschicken | nicht möglich (HTTP 400) |
| Auftrag an dasselbe Werk (`from == to`) | nicht möglich (HTTP 400) |

---

## 6. Prozesse im Detail

### 6.1 Verschicken (Hinweg)

1. Logistik → „Mein Ausgang" → „+ Neuer Auftrag".
2. Kopf: Auftrags-Nr. (Freitext, Pflicht), An-Werk (Pflicht, ≠ Arbeitswerk),
   Reference/Info (frei).
3. Suche: Werksfilter, Spalten `Werkzeug-ID · Kategorie · Typ · Maße · Heimatwerk ·
   Heimatplatz · aktueller Ort · Zustand`. Zeilen mit Checkbox, gesperrte Zeilen erklären
   sich selbst.
4. Auswahlliste unter der Suche: je Werkzeug Entfernen-Knopf, Warnhinweise.
5. **Sammelanlage:** Auswahl je An-Werk gruppieren → „Für Werk 2 anlegen (7)" erzeugt je
   Werk einen Auftrag. So muss man für mehrere Aufträge das Formular nicht neu öffnen.
6. „Entwurf speichern" oder „Als unterwegs melden". Beides nennt das Arbeitswerk im
   Bestätigungstext („7 Werkzeuge werden für **Werk 1** nach **Werk 2** geschickt").

### 6.2 Empfangen

1. Logistik → „Mein Eingang" zeigt „Zu bestätigen" mit Karten je Auftrag
   (Auftrags-Nr., Absenderwerk, Anzahl, Zeitpunkt des Versands, Info).
2. Aufklappen: je Werkzeug Zeile mit Heimatplatz und Zustand, Checkbox.
   „Alle angekommen" oder Auswahl + „Auswahl bestätigen".
3. Danach: Werkzeuge sind `available`, ihr Ort ist das Zielwerk, der Heimatplatz in der
   Heimat-Matrix zeigt wieder normal (bzw. bleibt bei Heimkehr belegt).

### 6.3 Zurückschicken

1. Auftrag öffnen (aus „Mein Ausgang" oder „Mein Eingang" – derselbe Datensatz).
2. „Zurück schicken": Werkzeuge ab-/auswählen (Vorgabe: alle), Rück-Auftrag wird erzeugt
   (`parent_order_id`, Richtung umgekehrt).
3. Ablauf wie 6.1/6.2 – das **Heimatwerk** bestätigt den Empfang; danach ist
   `current_plant_id` wieder `NULL` und der Heimatplatz endgültig frei.

### 6.4 „Wo ist was" (Ausleihliste)

Eine Liste über alle Werkzeuge mit `Heimatwerk · Heimatplatz · aktueller Ort · Zustand ·
offener Auftrag` – als eigener Reiter im Logistik-Bereich. Sie ist die Antwort auf „es muss
deutlich sein, welche Werkzeuge sich jetzt wo befinden".

---

## 7. API (geplant)

| Methode | Pfad | Zweck | Recht |
|---|---|---|---|
| GET | `/api/transport/orders` | Liste (Filter: `status`, `from_plant_id`, `to_plant_id`, `direction=out\|in`, `q` über Auftrags-Nr./Reference, Pagination) | `require_active` |
| POST | `/api/transport/orders` | Auftrag anlegen (Entwurf, mit Zeilen) | `require_active` |
| GET | `/api/transport/orders/{id}` | Detail mit Zeilen, Werkzeugen, Nachweisen | `require_active` |
| PUT | `/api/transport/orders/{id}` | Kopf und Zeilen im Entwurf ändern | `require_active` |
| POST | `/api/transport/orders/{id}/send` | „unterwegs melden" | `require_active` |
| POST | `/api/transport/orders/{id}/cancel` | Entwurf stornieren | `require_active` |
| POST | `/api/transport/orders/{id}/receive` | Empfang (alle oder `item_ids`) | `require_active` |
| POST | `/api/transport/orders/{id}/return` | Rück-Auftrag erzeugen | `require_active` |
| GET | `/api/transport/candidates` | Werkzeuge für die Auswahl (Suchbegriff, Werk, Verfügbarkeit) | `require_active` |
| GET | `/api/transport/tools` | Liste „Wo ist was" | `require_active` |
| GET | `/api/stats/overview` | Kennzahlen des Arbeitswerks für die rechte Spalte (DEC-089): Werkzeuge nach Zustand, Stammdaten-Zahlen, offene/unterwegs/alte Aufträge | `require_active` |

Alle Antworten nennen das aufgelöste **Arbeitswerk** (`active_plant_id`) und den Hinweis,
in welcher Richtung der Auftrag für dieses Arbeitswerk liegt (`direction`). `X-Plant-Id`
wird über die Abhängigkeit `get_active_plant()` gelesen und geprüft (DEC-070 Punkt 4).

**Bewusste Entscheidung:** keine Admin-Sonderrechte in dieser Ausbaustufe – Anlegen,
Verschicken und Bestätigen sind Vorgänge des Tagesgeschäfts (wie die Ersatzteilpflege in
DEC-064 Punkt 10). Sollte sich das ändern, ist es ein eigener Beschluss.

---

## 8. Oberfläche

| Ort | Inhalt |
|---|---|
| **Sidebar (alle Bereiche)** | Firmenlogo, Benutzerblock mit Sitzungs-Countdown, darunter der **Werksumschalter** (Arbeitswerk, jederzeit änderbar) und der Einstieg in die Logistik. Der Werkname steht in der Werkfarbe |
| **Hauptleiste** | **Aufträge** · **Eingang** (mit Zähler „offen") · **Wo ist was** · **Historie**; rechts **„Werkzeug zurück"** (Rückgabe-Liste, DEC-081) und **„+ Neuer Auftrag"** (Knopf in der Werkfarbe), aktiver Reiter in der Werkfarbe |
| **Auftragsliste** | Aufträge als **Dropdown**: eine Zeile je Auftrag (Nr. · Zustand · **von-Werk → an-Werk in beiden Werkfarben** · Anzahl · Datum), zugeklappt als Standard. Aufgeklappt: Positionen (**Werkzeug-ID mit leisem Farbhauch des Heimatwerks**), Aktionen (Verschicken · Stornieren · Empfang bestätigen · Zurück schicken · Auftrag öffnen) und der Nachweis, wer wann gehandelt hat |
| **Reiter Eingang** | Je Auftrag eine Karte: **von-Werk (Farbe) → an-Werk (Farbe, „hier")**, Zustand, „**n von m Werkzeugen noch nicht bestätigt**", Versandzeitpunkt und Info des Absenders. Tabelle mit Werkzeug-ID · Art · Typ · Maß · **Heimatwerk (Farbe)** · Heimatplatz · **Empfang** („ausstehend" / „angekommen · Zeitpunkt"), darunter die schon angekommenen Zeilen. Aktion: „**Empfang bestätigen**" – öffnet das Fenster mit den Häkchen (siehe 8.1) |
| **Reiter „Wo ist was"** | **Nur** unterwegs oder ausgeliehen (DEC-077) – Segmente „Alles · Unterwegs · Ausgeliehen" mit Zahlen, Spalte „Ist jetzt" (Ausleiher bzw. **Zielwerk in dessen Farbe**), Spalte „Auftrag / Ausleiher" |
| **Fenster (Modal)** | **Neuer Auftrag** (Kopf, Suche, Auswahl **nur des Arbeitswerks** – fremde Werkzeuge fehlen, DEC-081), **Empfang bestätigen** (einzeln oder alles), **Zurück schicken** (Auswahl), **Auftrag öffnen** (Nachweis) und **Regeln & Datentypen** |
| **Rückgabe an ein Werk** | Knopf **„Werkzeug zurück"** in der Logistik-Leiste neben „+ Neuer Auftrag": Fenster mit den **Werkzeugen aus anderen Werken, die hier liegen** (Heimatwerk, Heimatplatz, „hier seit"), **Suche** über ID/Art/Typ/Maß/Heimatwerk, **Filter je Heimatwerk**, „Alle auswählen"/„Auswahl aufheben"; ein Knopf je Heimatwerk legt den Rück-Auftrag an und meldet ihn gleich als unterwegs (DEC-081) |
| **Werkzeugliste** | Spalte Werk zeigt bei Abweichung `Heimat W1 · aktuell W2`; Zeilenmenü erhält „In Logistik öffnen" (springt in den offenen Auftrag) |
| **Matrix (Admin)** | Platz-Karte mit drittem Zustand **„ausgeliehen nach W2"** – gestrichelt, nicht ziehbar, mit Auftrags-Nr. im Tooltip |
| **Reiter „Historie" (TASK-029)** | Personen-Ausleihen und Werks-Transporte in einer Ansicht; je Eintrag **von-Werk → an-Werk in Werkfarben** |

**Grundsatz für die Dichte:** Der Bildschirm zeigt **Zeilen** – eine je Auftrag. Alles, was
ausgefüllt oder erklärt werden muss, liegt in einem Fenster. Sichtbar bleiben nur die beiden
Listen, die man vergleicht („Wo ist was" und die Positionen eines **aufgeklappten** Auftrags);
dort bleibt die Tabelle, aber kompakt (12 px, einzeilig, ohne Doppelzeilen).

**Keine rechte Statistikspalte auf der Logistik-Seite:** Die Karten der Main Site
wiederholten, was die Reiter ohnehin zeigen. Auf der Logistik-Seite entfällt die Spalte; die
Zahlen stehen in den Reiter-Überschriften und im Eingang-Zähler.
**Erledigt (DEC-089):** Die rechte Spalte ist gefüllt – vier Kennzahl-Karten (Aktive
Ausleihen · Verfügbare Werkzeuge · Offene Aufträge · Eingang offen) aus
`GET /api/stats/overview`, jede ein Sprungziel. Offene Frage 7 ist damit beantwortet.

**Farbregel (DEC-076):** Die Werkfarbe (Werk 1 Teal `#0f766e`, Werk 2 Indigo `#4338ca`,
Werk 3 Ocker `#a16207`) wirkt an **vier** Stellen: Knopf „+ Neuer Auftrag", aktiver Reiter,
Werk-Namen (immer in der Farbe **ihres** Werks, auch fremde) und als **Zeilenfarbe** in allen
Tabellen – die ganze Zeile in `rgba(Werkfarbe, .14)`, beim Überfahren `.20`, ohne Zebra.
**Keine farbigen Kanten** an Karten, Tab-Leiste, Aufträgen, Dropdowns oder Fenstern – farbige
Kanten zerschneiden das Glas-Design (Entscheidung des Projektinhabers). Zustände behalten ihre
eigenen Töne (`unterwegs` Sky, `empfangen/verfügbar` Emerald, `teilweise/defekt` Amber,
`storniert/ausgeliehen` Slate, Fehler Rose).

**Status der Umsetzung (TASK-025b, `tasks/25b-werkzeug-logistik.md`):** umgesetzt sind
der Einstieg über die Tab-Leiste (Reiter **Logistik**), die drei Unterbereiche
Aufträge · Eingang · Wo ist was, alle vier Fenster, die Werkfarbe an den vier Stellen
und der aktuelle Ort in der Werkzeugliste („unterwegs", nach dem Empfang „aktuell Werk 2"
in der Farbe des Werks). **Noch nicht umgesetzt:**
die Matrix-Karte im Admin-Panel (dritter Zustand „ausgeliehen nach W2"), die
Zeilenaktion „In Logistik öffnen" in der Werkzeugliste und das Füllen der vier Karten
der rechten Spalte (offene Frage 7). Abweichungen und ihre Begründung: **DEC-079**.

---

## 9. Konsistenz und Tests

Die Logistik führt **drei** Aussagen über dieselbe Sache: `transport_orders.status`,
`transport_items.received_at` und `Tool.current_plant_id`/`status`. Sie werden in **einer**
Transaktion geschrieben und geprüft – Muster und Helfer gibt es bereits
(`backend/tests/test_platz_konsistenz.py`, `assert_platz_konsistenz`).

**Umgesetzt: 41 Tests in `backend/tests/test_transport.py`** (Backend gesamt 255 grün).
Sie decken alle zehn Punkte der ursprünglichen Liste ab – statt einer
Konsistenz-Assertion nach jedem Übergang prüfen sie die drei Aussagen direkt
(Status des Auftrags, `received_at` der Zeile, `status`/`current_plant_id` des
Werkzeugs) und zusätzlich den Rundlauf Hinweg → Empfang → Rückweg → Empfang.

**Browser: 6 Tests in `frontend/tests/logistics.spec.ts`** (Suite gesamt 100 grün):
Auftrag anlegen und verschicken, Eingang mit Zähler, Empfang, Rück-Auftrag und
Rückweg, Werkfarbe (Zeile 14 %/20 %, aktiver Reiter), gesperrte Zeile mit
Klartext-Grund. Der Werksumschalter wird in `tests/plant-bar.spec.ts` geprüft.

**Der Browser-Lauf braucht eine Datenbank-Kopie.** Ein Auftrag ist ein Nachweis und
wird nicht gelöscht (DEC-079 Punkt 7); die Spec schreibt deshalb Aufträge, die
bleiben. Dafür gibt es **ein Skript**, das den Teststapel selbst startet und abräumt –
auf **eigenen** Ports (Backend 8012, Vite 5190), damit der normale Entwicklungsserver
(5173 → 8000) unberührt bleibt:

```powershell
powershell -File .audit/browser-tests-gegen-kopie.ps1                      # ganze Suite
powershell -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/logistics.spec.ts
```

> **Warum als Skript, mit eigenen Ports:** Beim Umbau der Vite-Konfiguration lagen die
> Ports einmal vertauscht – die Test-Vite auf dem Port, der auf die Produktion zeigt.
> Ein Lauf hat dadurch vier Aufträge und acht Bewegungen in die echte Datenbank
> geschrieben (aufgeräumt, Sicherung unter
> `.backup-history/toolsync-vor-aufraeumen-*.db`). Mit festen, eigenen Ports kann das
> nicht mehr passieren; das Skript prüft den Proxy vor dem Lauf.

**Testdaten für die Oberfläche** (auf Wunsch des Inhabers, 20 Werkzeuge je Kategorie
usw.): `.audit/seed-testdaten.mjs` – siehe `tasks/25b-werkzeug-logistik.md` § 7.
Löschen mit `node .audit/seed-testdaten.mjs --entfernen`.

**Zwei Prüfläufe ohne Browser-Test** (beide gegen dieselbe Kopie, `.audit/`):

| Skript | Zweck |
|---|---|
| `.audit/pruefe-logistik-ui.mjs` | misst, was ein Bildschirmfoto zeigt: Konsolenmeldungen (React-Warnungen), waagerechter Überlauf bei 1500/1280/420 px, Zeilenhöhe der Auftragsliste, Fensterhöhe, Zahl der Zeilen mit Werkfarbe |
| `.audit/screenshot-logistik.mjs` | legt einen Auftrag an, verschickt ihn und schreibt sechs Bilder nach `.audit/bilder-logistik/` – für die visuelle Abnahme durch den Projektinhaber |

Der Messlauf hat **einen echten Fehler** gefunden: `StarIcon` reichte die Eigenschaft
`filled` an das `<svg>` durch, React meldete „Received `false` for a non-boolean
attribute `filled`" – und der Favoritenstern war nie gefüllt. `filled` wird jetzt in
`fill` übersetzt; die Konsole ist auf allen vier Ansichten leer.

---

## 10. Umsetzungsschritte

| Schritt | Inhalt | Abhängigkeit | Stand |
|---|---|---|---|
| **TASK-030** | Arbeitswerk des Benutzers (DEC-070): Umschalter, `X-Plant-Id`, `default_plant_id`, Nachweisfelder | – | **fertig** |
| **TASK-025a** | Rückgabe an Personen + Benutzerzuordnung aus dem Token (DEC-073) | TASK-030 | **fertig** |
| **TASK-025b** | Werkzeug-Logistik (DEC-072): Modell, Services, API, Oberfläche, Tests | TASK-030, TASK-025a | **fertig**, Abnahme offen (`tasks/25b-werkzeug-logistik.md`) |
| **TASK-029** | Reiter „Historie" echt: Personen-Ausleihen und Werks-Transporte | TASK-025a/b | offen |

Reihenfolge und Begründung: **DEC-073**. Jeder Schritt wird einzeln abgenommen; die
Oberfläche wird erst nach der Abnahme der Demo angefasst.

---

## 11. Prototyp vor der Umsetzung

`docs/demo-werkzeug-logistik.html` – eine einzelne Offline-Datei (kein Backend, keine
Bibliothek) mit 3 Werken, 29 Beispielwerkzeugen, echten Heimatplätzen und dem vollständigen
Zustandsmodell im `localStorage`. Sie zeigt **beides**: den Vorgang und den **Rahmen der
Main Site** (Sidebar links, Tab-Leiste, Fenster, Werkfarbe) – siehe § 8.
Enthalten sind der Werksumschalter mit den drei Stufen, die Konfliktfälle (Doppelbuchung,
Teil-Empfang, Rückweg, Storno, Werkzeug im falschen Werk) und am Dateikopf die Datentypen
als JSON-Blöcke, damit sie 1:1 ins Backend übertragen werden können.

**Zweck:** Bedienung, Dichte, Farbe und Regeln abnehmen, **bevor** Code entsteht. **Grenze:**
die Demo prüft keine Datenbank-Constraints, keine Nebenläufigkeit und keine Mengen – das
leisten später die Tests. Die Demo ist kein zweiter Datenbestand: sie wird nach der Umsetzung
nicht weiter gepflegt (dieselbe Regel wie bei `docs/demo-lagerverschiebung.html`).

**Prüfstand:** `.audit/pruefe-demo-logistik.mjs` (Node, ohne Browser) prüft 57 Punkte:
Regeln, Zustandsübergänge, Doppelbuchung, Seed-Zustand, alle vier Ansichten,
Auftrags-Dropdown, **Werkfarbe (Wechsel färbt die Oberfläche, jeder Werk-Name trägt seine
eigene Farbe)**, „Wo ist was" (nur Unterwegs/Ausgeliehenes, Segment-Filter), Eingang
(Absender, Ziel, offene Werkzeuge, Aktionen), der Eingang-Zähler und die Fenster.
Der Lauf hat beim Aufbau drei echte Fehler gefunden: die Startreihenfolge beim Erzeugen der
Beispieldaten (die Demo wäre im Browser weiß geblieben), ein Anführungszeichen im Text einer
Meldung und einen fehlenden DOM-Schutz beim Setzen der Werkfarbe – alle behoben.

---

## 12. Offene Fragen

1. **Ablehnung:** Soll der Empfänger ein Werkzeug als „defekt angekommen" ablehnen können?
2. **Fristen:** Erinnerung, wenn ein Werkzeug länger als X Tage unterwegs ist?
3. **Lieferschein:** Ausdruck/PDF je Auftrag?
4. **Platz-Sonderzustand:** Soll ein reservierter Heimatplatz für andere Werkzeuge
   belegbar werden („ausgeliehen, Platz frei")? Heute: nein (DEC-072 Punkt 4).
5. **Anfrage vom Empfänger** („wir brauchen X aus Werk 1") – bewusst nicht in dieser Stufe.
6. **Heimatwerk ändern:** Soll ein Werkzeug dauerhaft den Besitzer wechseln können
   („das bleibt jetzt hier")? Heute nur über das Bearbeiten-Formular (DEC-071).
7. **Dashboard-Karten füllen:** Die vier Karten der Main Site (`StatisticsSidebar`) stehen
   weiterhin auf „—". Sollen sie mit den Logistik-Zahlen gefüllt werden (Eingang offen,
   Unterwegs, Aktive Ausleihen, Verfügbare Werkzeuge)? Auf der Logistik-Seite sind sie
   entfallen, weil sie die Reiter wiederholt hätten (DEC-075).
8. **Werkfarbe ausrollen:** Sollen Werkfarben auch die Matrix des Admin-Panels, die
   Serienartikel- und Datenblattlisten einfärben (DEC-076, offene Fragen 1 und 2)?
