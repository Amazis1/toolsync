# DEC-048 – Lagerplatz als generierte Matrix
**Status:** Verbindlich

Die Lagerplatz-Verwaltung wird nach dem Prototyp aus `toolsync_final.html` umgesetzt.

## Kernprinzip

Ein Schrank wird als **Matrix** angelegt:

- Schrank-Nummer (z. B. `03`)
- Anzahl Schubladen (C, D, E …)
- Pro Schublade ein Grid: Breite X × Tiefe Y

Aus dieser Angabe werden **automatisch alle Plätze** erzeugt – kein manuelles Anlegen einzelner Lagerorte.

## Code-System

Jeder Platz erhält automatisch:

- Kurzcode: `03-C-01` (Schrank-Schublade-Platz)
- Vollcode: `Schrank 03 - Schublade C - Platz 01`

## Perlenketten-Verschiebung

Belegte Plätze können verschoben werden (2 Wege):

1. **Per Klick**: Belegtes Fach auswählen (gelb), dann Zielfach anklicken – alles dazwischen rückt auf.
2. **Per Drag & Drop**: Belegte Karte direkt auf das Zielfach ziehen.

## Datenmodell

- `StorageLocation` wird **entfernt** – der Platz (Position) ist der Lagerort.
- `Drawer` bekommt `cols` (Breite X) und `rows` (Tiefe Y).
- `Position` bekommt `x`, `y` und eine direkte `tool_id`-Zuordnung.
- `Tool.position_id` ersetzt `tool_id` auf StorageLocation.

## Keine externe Drag-&-Drop-Bibliothek

Es wird **natives HTML5 Drag & Drop** verwendet (wie im Prototyp).
Keine zusätzliche Dependency (DEC-021: einfach & robust).

> **Überholt durch DEC-053.** Die Umsetzung nutzt `@dnd-kit`. Die Entscheidung
> wurde vom Projektinhaber bewusst geändert, nachdem sich die Bibliothek in der
> Praxis bewährt hat.

---

# DEC-049 – Stammdaten als Tabellen
**Status:** Verbindlich

Die Stammdaten-Verwaltung im Admin-Panel verwendet **Tabellen** statt endloser Einzel-Karten.

- Werke, Kunden, Maschinen und Werkzeugtypen werden in einer Tabelle dargestellt.
- Jede Zeile enthält: Bezeichnung, ggf. Details (z. B. Werk-Zuordnung bei Maschinen), Aktionen (Bearbeiten/Löschen).
- Neue Einträge werden über ein Eingabefeld oberhalb der Tabelle hinzugefügt.
- Die Tabelle ist scrollbar, damit auch viele Einträge (z. B. 100 Kunden) übersichtlich bleiben.
---

# DEC-050 – Werkzeug-Ablage (nicht eingelagerte Werkzeuge)
**Status:** Verbindlich

Werkzeuge ohne festen Lagerplatz liegen in der **Werkzeug-Ablage**
(`Tool.position_id = NULL`).

## Regeln
- Beim Löschen eines Schranks oder einer Schublade werden eingelagerte
  Werkzeuge **nicht** gelöscht; sie landen in der Ablage.
- Ablage-Werkzeuge können per Drag & Drop oder Klick auf einen Platz
  gelegt werden.
- Ablage → freier Platz: einfaches Ablegen.
- Ablage → belegter Platz: **Einreihen** (Werkzeuge rücken ab Ziel einen
  Platz weiter). Ist der letzte Platz belegt, wird die Aktion blockiert.
- Belegter Platz → Ablage: Platz wird frei, Werkzeug bleibt erhalten.

---


# DEC-051 – Lesezugriff auf Kunden und Maschinen für alle aktiven Benutzer
**Status:** Verbindlich

## Regel
- `GET /api/customers` und `GET /api/machines` sind für alle aktiven Benutzer
  freigegeben (`require_active`).
- `POST`, `PUT` und `DELETE` bleiben ausschließlich Admin (`require_admin`).

## Begründung
Das Werkzeug-Anlegeformular kann Werkzeuge optional einem Kunden und einer
Maschine zuordnen. Ohne Leserechte könnten normale Benutzer diese Felder nicht
befüllen (HTTP 403).

## Auswirkung
- `backend/app/routers/master_data.py` – nur die beiden GET-Routen geändert.
- Frontend: `frontend/src/api/masterData.ts` (neu) bündelt Lese- und
  Schreibfunktionen; `admin.ts` re-exportiert sie (AdminPanel unverändert).

## Alternative (verworfen)
Eigener Read-Endpunkt nur für das Formular – hätte doppelte Routen bedeutet.

---

# DEC-052 – Lager/Ersatz als Einzelzeilen (Mehrfach-ID)
**Status:** Verbindlich

## Regel
- Bei `is_storage = true` ist die Werkzeug-ID **nicht** eindeutig: dieselbe ID
  darf mehrfach existieren.
- Jedes Exemplar ist ein **eigener Datensatz** (eigene Zeile) – kein
  Mengenzähler in einer Spalte.
- Bei `is_storage = false` bleibt die ID innerhalb von Werk + Kategorie
  eindeutig: `tool_id + category + plant_id + is_storage` bildet den Schlüssel.

## Anlage mehrerer Exemplare
- Das Zahlenfeld im Formular bestimmt, wieviele Exemplare in einem Zug
  entstehen (Standard 1).
- Nur das **erste** Exemplar erhält den gewählten Lagerplatz; alle weiteren
  gehen in die Werkzeug-Ablage (`position_id = NULL`), da ein Platz nur ein
  Werkzeug halten kann.
- `allow_duplicate_id` wird aus der Checkbox abgeleitet (`= is_storage`).
- Die Live-Prüfung blockiert nie, solange `is_storage = true`; sie meldet
  stattdessen „ID existiert bereits N× – wird als N+1. Exemplar angelegt“.

## Begründung
- Ausleihe und Rückgabe arbeiten pro Exemplar (`LendModal`).
- Keine Migration und keine Umbauten an der Ausleihlogik notwendig.
- Entspricht der Projektregel aus `tasks/PROJECT-PLAN.md`
  („Lager/Ersatz: is_storage=True → ID darf mehrfach vorkommen“).

## Variante (verworfen)
Mengenspalte `storage_count` in einer Zeile. Hätte eine Migration, eine neue
Spalte, Anzeige-Umbau in der Liste und einen Umbau der Ausleihlogik
(Teilausleihe) erfordert.

## Bugfix im gleichen Zug
`ToolService.create_tool()` übergab `is_storage` nicht an `get_by_tool_id()` –
die Prüfung lief dadurch immer gegen die normalen Werkzeuge. Ist korrigiert.

---

# DEC-053 – Drag & Drop mit @dnd-kit statt nativer HTML5-API
**Status:** Verbindlich
**Ersetzt:** den Abschnitt „Keine externe Drag-&-Drop-Bibliothek" in DEC-048

## Entscheidung

Für Drag & Drop in der Lagerstruktur wird **`@dnd-kit/core`** (mit
`@dnd-kit/utilities`) verwendet.

Eingesetzt in: `frontend/src/pages/admin/AdminStorageLocations.tsx`
(`DndContext`, `useDraggable`, `useDroppable`).

## Begründung

Die Bibliothek ist bereits im Einsatz und funktioniert: Ausleihen, Verschieben,
Tauschen, Einreihen und das Ablegen aus der Werkzeug-Ablage laufen per Drag & Drop
und zusätzlich per Klick. DEC-048 verlangte natives HTML5 Drag & Drop ohne externe
Dependency — diese Vorgabe wurde in der Umsetzung nicht eingehalten.

Statt funktionierenden Code gegen die ältere Vorgabe umzubauen, wird die
Entscheidung an die Umsetzung angepasst. Begründung des Projektinhabers: **solange
nichts kaputtgeht**, bleibt `@dnd-kit`.

## Was das ändert

- Die Anforderung „keine zusätzliche Dependency für Drag & Drop" entfällt.
- `@dnd-kit/core` und `@dnd-kit/utilities` sind legitime Abhängigkeiten und
  gehören in `frontend/package.json`.
- Kein Umbau von `AdminStorageLocations.tsx`. Es bleibt bei **zwei** Bedienwegen:
  Drag & Drop **und** Klick (Klick ist Pflicht, damit die Funktion auch auf
  Touch-Geräten und per Tastatur nutzbar bleibt).

## Was ausdrücklich NICHT gilt

- Das ist **keine** allgemeine Erlaubnis, weitere Dependencies hinzuzufügen.
  DEC-021 („einfach & robust") bleibt die Grundregel: eine neue Dependency braucht
  einen Grund und eine Entscheidung.
- Das Klick-Verfahren darf **nicht** entfallen. Es ist der barrierefreie Weg.

## Offen

- Der barrierefreie Weg ist noch nicht vollständig geprüft (Tastaturbedienung
  durchgängig, Fokusführung, `aria`-Ansagen während des Ziehens). Gehört zu
  TASK-012 (manuelle Prüfung im Browser).

---

# DEC-054 – ID-Prüfung zeigt alle Datensätze, Formular übernimmt vorhandene Daten
**Status:** Verbindlich
**Ersetzt:** den Meldungstext aus DEC-052 („ID existiert bereits N× – wird als N+1. Exemplar angelegt")

## Ausgangslage

Bei `is_storage = true` prüfte `/api/tools/check-id` nur die Lager/Ersatz-Zeilen.
Existierte dieselbe ID zusätzlich als normales Werkzeug auf einem Lagerplatz
(Beispiel: aktiver Stempel `01020000` auf `01-A-25` plus ein Ersatz-Exemplar in
der Ablage), meldete das Formular „existiert bereits 1×". Für den Benutzer war
das falsch – er kennt zwei Datensätze unter dieser ID. Zusätzlich stand
dieselbe Auskunft zweimal im Formular (Erklärblock über dem ID-Feld und grüne
Zeile unter dem Feld) und das Ersatz-Exemplar musste mit Maß, Typ und Platz
komplett neu erfasst werden.

## Regel

1. **Anzeige folgt dem Benutzer, Blockade folgt dem Schlüssel.** `locations`
   listet alle Datensätze der ID im Werk + Kategorie (normale Werkzeuge **und**
   Lager/Ersatz). `available` bleibt unverändert am logischen Schlüssel
   `tool_id + category + plant_id + is_storage` (DEC-052).
2. **Genau eine Meldung.** Der Stand der ID steht als `.ui-alert ui-alert-info`
   (Guide-Aufbau: Icon + `<strong>` + Body mit `opacity-80`) unter der
   ID-/Typ-Zeile; Fundort-Liste und der Satz „was entsteht" bilden den Body.
   Bei Lager/Ersatz gibt es kein grünes Erfolgs-Signal (eine vorhandene ID ist
   dort kein Fehler).
3. **Automatische Übernahme beim Anlegen von Lager/Ersatz.** Maß A/B,
   Werkzeug-Typ und Beschreibung kommen aus einem vorhandenen Datensatz
   derselben ID. Vorlage ist der Datensatz **mit festem Lagerplatz** – er hat
   Vorrang vor einem Exemplar in der Ablage; innerhalb dieser Gruppe ein
   Lager/Ersatz-Exemplar, danach der zuletzt angelegte. Selbst bearbeitete
   Felder werden nie überschrieben; die Übernahme ist sichtbar benannt und mit
   „Übernahme verwerfen" zurücknehmbar.
4. **Lagerplatz-Vorbelegung.** „In Ablage legen" wird nur vorbelegt, wenn
   **kein** Datensatz der ID einen Platz hat. Hat ein Datensatz einen Platz,
   bleibt die Platzwahl offen und der Alert benennt die Folge („Noch kein
   Lagerplatz gewählt – ohne Auswahl geht das Exemplar in die Ablage."). Die
   Ablage ist damit kein stiller Standard, nur weil der neue Datensatz ein
   Ersatz ist. Die Checkbox bleibt in jedem Fall änderbar.

## Begründung

- Der Benutzer denkt in Werkzeug-IDs, nicht in den zwei ID-Bereichen
  (`is_storage`) des Datenmodells. Eine Zählung, die nur einen Bereich sieht,
  ist für ihn nachweislich falsch.
- Ersatz-Exemplare sind Kopien desselben Werkzeugs: Maße und Typ sind identisch,
  das Abtippen ist eine Fehlerquelle.
- Status und Ausleihe bleiben pro Exemplar (DEC-052 unverändert).

## Was ausdrücklich NICHT gilt

- `locations` erweitert **nicht** den Eindeutigkeitsbereich. Ein normales
  Werkzeug blockiert weiterhin nur ein weiteres normales Werkzeug.
- `existing_count` bei `is_storage = false` zählt weiterhin nur normale
  Werkzeuge – obwohl `locations` mehr enthalten kann.

## Umsetzung

- `backend/app/crud/crud_tool.py` – `get_all_by_tool_id(..., is_storage=None)`
  hebt die Bereichstrennung auf.
- `backend/app/services/tool_service.py` – `check_tool_id()` liefert
  `locations` (angereichert) und `prefill`; `_describe_existing_tool()`,
  `_build_prefill()`.
- `frontend/src/components/tools/ToolForm.tsx` – eine Meldung, Fundort-Liste,
  Übernahme-Logik (`touchedFields` / `prefillOwned` / `prefilledFor`).
- Tests: `backend/tests/test_tool_id_check.py`.

---

# DEC-055 – Werkzeug-ID ist nur beim Stempel Pflicht
**Status:** Verbindlich
**Ergänzt:** DEC-052 (Mehrfach-IDs bei Lager/Ersatz), DEC-054 (ID-Prüfung und Übernahme)

## Ausgangslage

Im Anlegeformular war die Werkzeug-ID für **alle** Kategorien Pflicht
(`ToolForm.tsx`, `required` am Feld plus Prüfung in `handleSubmit()`). Für
Abstreifer und Matrize ist das falsch: sie werden über ihr **Maß** geführt und
haben häufig gar keine ID – der Benutzer musste sich eine ausdenken oder den
Datensatz im Altsystem suchen. Umgekehrt darf die ID eines Stempels nicht leer
bleiben: sie kommt aus SAP und ist eingraviert, ohne ID ist ein Stempel in der
Werkstatt nicht auffindbar.

## Regel

1. **Pflicht je Kategorie.** `Stempel` → Werkzeug-ID erforderlich.
   `Abstreifer` und `Matrize` → Werkzeug-ID freiwillig, dafür **Maß A** Pflicht.
   Unverändert Pflicht für alle Kategorien: **Maß A**, **Werk**, **Werkzeug-Typ**.
   Maß B bleibt freiwillig.
2. **Leeres Feld heißt „ohne ID".** Gespeichert wird `NULL`, nie der leere
   String – sonst wären alle ID-losen Datensätze füreinander Dubletten und von
   „nicht gepflegt" nicht zu unterscheiden. `ToolCreate`/`ToolUpdate`
   normalisieren ein leeres Feld (auch nur Leerzeichen) zu `None`.
3. **Eindeutigkeit.** Die ID-Vergabe bleibt unverändert (DEC-052). Ohne ID gibt
   es **nichts** zu prüfen: `check_tool_id` blockiert nicht, Duplikat-Suche,
   Fundort-Liste und Übernahme-Vorschlag bleiben leer.
4. **Anzeige.** Wo bisher die ID stand, steht „ohne ID" – in Liste, Ausleih- und
   Löschdialog, Toasts und Admin-Bereich. In der Liste eine ruhige neutrale
   Markierung (wie „Ablage"), kein leerer Mono-Kasten.
5. **Durchsetzung im Backend.** `ToolService.create_tool()`/`update_tool()`
   prüfen die Regel über `assert_tool_identity()` → HTTP 400 mit
   Handlungsanweisung. Der Server verlässt sich nicht auf das Formular: ohne
   diese Prüfung ließe sich die ID eines Stempels per API still leeren.

## Begründung

- Die ID ist ein Ordnungsmerkmal des Stempels, nicht des Werkzeugs an sich.
  Abstreifer und Matrize werden über Maß und Typ identifiziert (Kunden- und
  Maschinenzuordnung bleiben davon unberührt).
- Ein erzwungenes Feld ohne fachlichen Wert erzeugt Phantasie-IDs – und die
  zerstören jede spätere Suche.

## Was ausdrücklich NICHT gilt

- Die ID wird nicht automatisch vergeben (kein fortlaufender Zähler, kein
  Platzhalter wie `AB-0001`): ein erfundener Wert sähe wie eine SAP-ID aus.
- Maß A wird weiterhin **nur im Formular** erzwungen; das Backend bleibt dort
  tolerant (siehe `docs/05-tools.md` §7), damit Altdaten ohne Maß nicht brechen.
- Die ID-losen Datensätze bleiben normale Werkzeuge: `is_storage` und die
  Mehrfach-ID-Logik aus DEC-052 sind davon unberührt.

## Umsetzung

- `backend/app/models/tool.py` – `tool_id` ist `nullable=True`;
  Migration `c1d5f7a2e903_make_tool_id_nullable`.
- `backend/app/schemas/tool.py` – `tool_id: Optional[str]` plus Normalisierung.
- `backend/app/services/tool_service.py` – `assert_tool_identity()`,
  Teil-Update mit wirksamen Werten, `check_tool_id` ohne ID.
- `backend/app/crud/crud_tool.py` – Suche/Zählung ohne ID liefert leer bzw. 0.
- `backend/app/schemas/storage.py` – `ToolLiteRead.tool_id` optional (sonst
  HTTP 500 auf der Lagerplatz-Seite und in der Ablage).
- `frontend/src/components/tools/ToolForm.tsx` – Pflichtfeld je Kategorie,
  Hinweis „Abstreifer und Matrize brauchen keine ID – Pflichtfeld ist hier
  Maß A."; `frontend/src/lib/toolLabel.ts` – „ohne ID" für alle Anzeigeorte.
- Tests: `backend/tests/test_tool_id_optional.py`,
  `frontend/tests/tools-list.spec.ts` (Abstreifer ohne ID).

---

# DEC-056 – Serienartikel: eigene Kategorie mit Stammdatenbezug, Verwaltung durch Admins
**Status:** Verbindlich
**Ändert:** Requirements §6.2 (Angaben im PDF), `docs/06-serial-articles.md`, `docs/14-architecture.md` §10
**Ergänzt:** DEC-051 (Stammdaten für alle aktiven Benutzer), DEC-054 (ID-Prüfung beim Tippen)
**Grenzt ab:** DEC-052 und DEC-055 (Werkzeuge, Lager/Ersatz) – Serienartikel sind ein anderer Bereich

## Ausgangslage

Der Bereich war als reines Dokumentenarchiv gebaut: `serial_articles` hatte nur
Artikelnummer, Beschreibung und den PDF-Pfad und **keine** Verknüpfung. Wer einen
Plan suchte, musste die Artikelnummer kennen; Kunde, Maschine und Werk standen
ausschließlich im PDF und waren damit nicht durchsuchbar. Zugleich war der
Sub-Reiter „Serienartikel" im Werkzeugformular ein Platzhaltertext, und die
Routen prüften nur `require_active`: jeder aktive Benutzer durfte PDFs hochladen
und löschen (in `docs/14-architecture.md` §10 als „Auth-Lücke `serial_articles`"
geführt). Anforderung 6.1 nennt dagegen ausdrücklich Berechtigungen und das
Ersetzen einer PDF – beides fehlte.

## Regel

1. **Eigene Kategorie.** Serienartikel sind ein eigener Fachbereich. Sie haben
   **keine** Beziehung zu Werkzeugen (Stempel, Abstreifer, Matrize) und keine
   Werkzeug-ID. Die Artikelnummer ist eine eigene Nummer.
2. **Felder.** Artikelnummer (Pflicht), Werk (Pflicht), Name (freiwillig), Kunde
   (freiwillig), Maschine (freiwillig), Beschreibung (freiwillig), PDF
   (freiwillig).
3. **Stammdaten statt Freitext.** Kunde, Maschine und Werk sind Verknüpfungen auf
   die Stammdaten aus dem Admin-Bereich. Wird eine Maschine oder ein Kunde
   gelöscht, wird das Feld leer (`SET NULL`) – wie beim Werkzeug. Ein Werk, an dem
   Pläne hängen, kann nicht gelöscht werden.
4. **Verwalten nur Admin.** Anlegen, Bearbeiten, PDF ersetzen und Löschen prüfen
   **serverseitig** `require_admin`. Suchen, Ansehen und Herunterladen bleiben für
   alle aktiven Benutzer möglich. Knöpfe werden Nicht-Admins nicht angezeigt – das
   ist Oberfläche, nicht die Sicherheitsmaßnahme.
5. **Zwei Stellen zum Anlegen und Bearbeiten.** Im Serienartikel-Bereich
   („+ Anlegen", „Bearbeiten" im Zeilenmenü) und im Werkzeugformular im Sub-Reiter
   „Serienartikel". Beide Wege führen in das **Anlege-Formular mit Reitern**; ein
   eigenes Fenster (Modal) für Serienartikel gibt es **nicht**. Werkzeug und
   Serienartikel werden **getrennt** gespeichert: der Speichern-Knopf des
   Werkzeugformulars legt keinen Serienartikel an und umgekehrt. So entsteht kein
   halber Datensatz, wenn ein Upload scheitert.
6. **Vorbelegung.** Im Werkzeugformular sind Kunde, Maschine und Werk aus der
   Werkzeugmaske vorbelegt und dort änderbar. Spätere Änderungen am Werkzeug
   ändern den Plan nicht – er ist eigenständig. Beim Anlegen aus dem
   Serienartikel-Bereich ist das Werk **nicht** vorausgewählt (es ist Pflicht und
   soll bewusst gewählt werden).
7. **Doppelte Artikelnummer.** Prüfung **beim Tippen** (wie die Werkzeug-ID,
   DEC-054) **und** im Backend. Eine erkannte Dublette blockiert das Speichern.
8. **Liste.** Suche über Artikelnummer, Name, Beschreibung, Kunde, Maschine und
   Werk; feste Sortierung; Blätterleiste; Gesamtzahl; **keine feste Obergrenze von
   100 Datensätzen** mehr; Leerzustände mit Ausweg; Rückmeldungen als Toast.
   Eigene Spalten für Artikelnummer und Name; der Kunde trägt den Farbpunkt aus
   den Stammdaten; die Zeilenaktionen liegen im „…"-Menü (wie in der
   Werkzeugliste).
9. **Ersetzen.** Neuer `PUT`-Endpunkt. Beim Ersetzen wird die alte Datei entfernt
   – sonst sammeln sich verwaiste PDFs im Upload-Ordner.
10. **Formularregeln wie beim Werkzeug.** Innenliegende Labels, Pflichtmarker,
    Fehlermeldung am Feld, Speichern-Knopf benennt die Aktion („Serienartikel
    anlegen" / „Änderungen speichern" / „Wird gespeichert …"),
    Löschbestätigung mit Objektname und Konsequenz.
11. **`extra_metadata` entfällt.** Das nie benutzte Reservefeld wird mit der
    Migration dieses Entscheids entfernt.
12. **Keine Dateiprüfung.** Es bleibt bei der Prüfung der Dateiendung.
    Größenlimit und MIME-/Inhaltsprüfung werden **nicht** eingeführt – bewusst
    akzeptiert.

## Begründung

- Ohne Kunde, Maschine und Werk ist ein Plan nur über eine Nummer auffindbar, die
  der Werker in der Werkstatt nicht kennt. Die Angaben stehen zwar im PDF, aber
  ein PDF lässt sich nicht durchsuchen (Requirements §13).
- Verknüpfung statt Freitext: derselbe Grund wie bei DEC-049/DEC-051 – Stammdaten
  werden einmal gepflegt, Tippvarianten („Werk 1" vs. „Werk1") sind ausgeschlossen
  und die Suche findet beide Schreibweisen ohne Zusatzarbeit.
- Getrennte Speichervorgänge: Ein Dokument-Upload darf nicht am Erfolg eines
  fremden Datensatzes hängen. Zwei unabhängige Speicherungen sind die einfachere
  und robustere Lösung (DEC-021).

## Was ausdrücklich NICHT gilt

- **Keine Verknüpfung Serienartikel ↔ Werkzeug.** Die Vorbelegung im
  Werkzeugformular ist reine Bequemlichkeit, kein Datenbezug.
- **Keine automatische Auswertung des PDF-Inhalts.** Unverändert Requirements
  6.3, Vision §8, Regel 02: Programmname, Bearbeitungszeit, Hübe, Material und die
  Werkzeug-IDs bleiben im Dokument.
- **Keine feingranulare Berechtigung** (`serial_articles:write`). Geprüft wird die
  Admin-Flagge `User.is_admin`, wie in allen anderen Routen
  (`docs/02-domain-model.md` §9, offener Punkt 6 bleibt offen).
- **Keine Größen- und Inhaltsprüfung** der hochgeladenen Datei (Punkt 12).

## Umsetzung

**Umgesetzt (TASK-016).** Migration `a7c3e19f4b21` (`plant_id`, `customer_id`,
`machine_id`, `name` ergänzt, `extra_metadata` entfernt);
`require_admin` auf `POST`/`PUT`/`DELETE`; neuer `PUT`-Endpunkt zum Ändern und
Ersetzen; Liste mit Suche über alle Felder, Sortierung, Blätterleiste und
Gesamtzahl; Formular in beiden Einsatzorten (`SerialArticleForm`), Live-Prüfung
der Artikelnummer, Admin-Knöpfe nur sichtbar für Admins, Rückmeldungen als
Toast. Belege: `backend/tests/test_serial_articles.py` (44 Tests),
`frontend/tests/serial-articles.spec.ts` (12 Browser-Tests).

---

# DEC-057 – Artikelordner: je Serienartikel ein eigener Ordner
**Status:** Verbindlich
**Ergänzt:** DEC-056 (Serienartikel-Felder und Verwaltung)
**Betrifft:** `services/serial_article_service.py`, `routers/serial_articles.py`

## Ausgangslage

PDFs lagen bisher **flach** in `uploads/serial_articles/` unter einem
zufälligen UUID-Namen (`<uuid>.pdf`). Der Dateiname verrät nichts über den
Artikel, alle Dateien liegen in einem Verzeichnis, und für weitere Dateien eines
Artikels (z. B. Fotos) gab es keinen vorgesehenen Platz. Gesucht, gesichert oder
einzelne Artikel weggelegt werden konnte damit nur über die Datenbank.

## Regel

1. **Ein Ordner je Artikel.** Der Speicherort ist
   `uploads/serial_articles/<bereinigte Artikelnummer>/`.
2. **Bereinigung des Ordnernamens.** Alle Zeichen außer Buchstaben, Ziffern,
   `.`, `-` und `_` werden zu `_` (dieselbe Regel wie beim Download-Dateinamen).
   Bleibt nichts übrig, heißt der Ordner `artikel`. Der Ordnername wird **nie**
   aus ungeprüftem Text gebildet: `..`, `/` und `\` können so nicht in den Pfad
   geraten.
3. **Der Einrichteplan heißt im Ordner `plan.pdf`.** Fester Name statt
   Originalname: Beim Ersetzen ist damit eindeutig, welche Datei der Plan ist,
   und es entstehen keine Dubletten aus „Plan.pdf", „plan(1).pdf" usw.
4. **Der Ordner ist die Dateiablage des Artikels.** Weitere Dateien (Fotos)
   gehören in denselben Ordner; dafür ist **kein** Modellumbau nötig. Umgesetzt in
   **DEC-058** (Bilder als `bild-1.jpg`, `bild-2.png` …).
5. **Der Ordner entsteht beim Anlegen** eines Serienartikels – auch ohne PDF,
   damit der Platz für weitere Dateien von Anfang an existiert.
6. **Artikelnummer ändern = Ordner umbenennen.** Ändert sich die Nummer, wird der
   Ordner mitgezogen. Existiert der Zielordner bereits, bricht das Speichern mit
   HTTP 400 und einer verständlichen Meldung ab – es wird **nicht** hineinkopiert
   und nichts überschrieben.
7. **Löschen löscht den Ordner samt Inhalt.** Die Bestätigung benennt das
   ausdrücklich („Der Eintrag, der Einrichteplan und alle Dateien im
   Artikelordner werden entfernt").
8. **Der Pfad bleibt relativ in der Datenbank**, wird aber gegen das
   **Backend-Verzeichnis** aufgelöst – nicht mehr gegen das Arbeitsverzeichnis
   des Prozesses (bisher lieferte ein Start aus einem anderen Ordner 404). Vor
   jeder Auslieferung wird geprüft, dass die aufgelöste Datei **innerhalb** des
   Upload-Ordners liegt.
9. **Keine Größen- und Inhaltsprüfung** (unverändert DEC-056 Punkt 12).

## Begründung

- Dateien eines Artikels liegen beisammen: sichern, kopieren, weitergeben und
  löschen lassen sich damit auf Ordnerebene, ohne die Datenbank zu befragen.
- Ein fester Dateiname je Rolle macht „Ersetzen" eindeutig und verhindert
  verwaiste Dateien aus Schreibvarianten.
- Ein bereinigter Ordnername ist zwingend: Artikelnummern kommen aus SAP und
  können Zeichen enthalten, die im Dateisystem verboten sind (Windows: `\ / : * ?
  " < > |`).
- Der Ordner je Artikel ist die Voraussetzung dafür, später Fotos ablegen zu
  können, ohne die Ablage umzubauen.

## Was ausdrücklich NICHT gilt

- **Kein** frei wählbarer Ordnername und **keine** Konfiguration des Pfades im
  Formular.
- **Keine** Unterordner je Dateiart (`pdf/`, `fotos/`): der Artikelordner ist
  flach, sonst wird das Aufräumen unnötig kompliziert.
- **Kein** eigenes Datenbankfeld für den Ordnerpfad: er ergibt sich aus der
  Artikelnummer bzw. steht als vollständiger Dateipfad in `pdf_path`.
- **Kein** Foto-Upload, keine Bildvorschau und keine Datei-Liste in der
  Oberfläche – nur die Ablage ist dafür vorbereitet.

## Umsetzung

**Umgesetzt (TASK-016).** `backend/app/services/serial_article_service.py` bildet
den Ordnernamen (`sanitize_folder_name`), legt ihn beim Anlegen an, benennt ihn
beim Nummernwechsel um, entfernt ihn beim Löschen samt Inhalt und löst den
gespeicherten Pfad gegen das Backend-Verzeichnis auf – mit Prüfung, dass die
Datei innerhalb der Ablage liegt. Tests: `backend/tests/test_serial_articles.py`.

---

# DEC-058 – Bilder zum Serienartikel
**Status:** Verbindlich
**Ergänzt:** DEC-057 (Artikelordner), DEC-056 (Felder und Verwaltung)
**Löst ab:** die offene Frage „Wann kommt der Foto-Upload?" aus `docs/06-serial-articles.md`

## Ausgangslage

DEC-057 hatte den Artikelordner bereits als Dateiablage des Artikels angelegt und
den Foto-Upload ausdrücklich als eigenen Schritt offen gelassen. Der Auftrag kam
nach: „Möglichkeit, auch Bilder mit dem PDF hochzuladen." Ein Einrichteplan zeigt
Programm, Hübe und Maße – **nicht**, wie das Werkzeug eingebaut ist. Genau das
zeigen Fotos.

## Regel

1. **Bilder sind Teil des Artikels.** Beim Anlegen und beim Bearbeiten können
   **mehrere** Bilddateien mitgeschickt werden. Sie kommen **hinzu** und ersetzen
   nichts; nur der Einrichteplan wird beim Ersetzen überschrieben.
2. **Ablage im Artikelordner**, kein Unterordner: `bild-1.jpg`, `bild-2.png` …
   (DEC-057 Punkt 4 hatte `fotos/` verworfen – dabei bleibt es.)
3. **Fortlaufende Nummer über alle Bilder.** Beim nächsten freien Index zählt der
   Ordner alle vorhandenen `bild-<n>.*` – sonst hieße `skizze.PNG` neben
   `bild-1.jpg` ebenfalls `bild-1.png`.
4. **Keine Datenbankspalten.** Die Bildliste wird aus dem Ordner gelesen; sortiert
   wird nach der **Zahl** im Namen, damit `bild-2` vor `bild-10` steht. Die Ablage
   ist damit die einzige Quelle – ein Bild, das im Ordner liegt, ist ein Bild des
   Artikels.
5. **Geprüft wird nur die Endung** (JPG, JPEG, PNG, WEBP, GIF, BMP, HEIC, HEIF).
   Wie beim Plan: **keine** Größen- und **keine** Inhaltsprüfung (DEC-056 Punkt 12).
   Eine falsche Datei ergibt HTTP 400 mit einer Meldung, die die erlaubten Formate
   nennt.
6. **Auslieferung nur authentifiziert:** `GET /api/serial-articles/{id}/files/{name}`.
   Der Name wird gegen den Artikelordner aufgelöst; Pfadanteile (`..`, `/`, `\`)
   sind abgewiesen, und nur der Einrichteplan oder ein Bild sind zulässig.
7. **Einzelne Bilder löschbar:** `DELETE /api/serial-articles/{id}/files/{name}`
   (nur Admin, `require_admin`). Der **Einrichteplan ist ausgenommen** – er wird
   über das Formular ersetzt.
8. **Artikel löschen bleibt radikal:** der ganze Artikelordner verschwindet samt
   Bildern (DEC-057 Punkt 7). Die Bestätigung sagt das weiterhin ausdrücklich.
9. **Oberfläche:** Upload im Formular (Mehrfachauswahl, Vorschau der neuen Bilder,
   entfernbar vor dem Speichern), Anzeige im Datei-Fenster als zweiter Reiter
   („Bilder (N)") mit Vorschaubildern und Großansicht, Hinweis in der Liste als
   Badge „1 Bild" / „N Bilder".

## Begründung

- Fotos sind die schnellste Auskunft über Einbausituation und Aufbau; ohne sie
  bleibt der Plan eine Anleitung ohne Bild.
- Keine Migration, keine neue Tabelle: der Artikelordner aus DEC-057 ist bereits
  die richtige Stelle, und die Dateiliste des Ordners ist die Wahrheit.
- Nur-Endung-Prüfung: dieselbe bewusste Entscheidung wie beim Plan (DEC-056
  Punkt 12) – wer eine falsche Datei wählt, sieht eine klare Meldung.

## Was ausdrücklich NICHT gilt

- **Keine Bildbearbeitung** (Verkleinern, Drehen, Zuschneiden) und **keine**
  serverseitigen Vorschaubilder: die Miniaturen rendert der Browser aus dem Bild.
- **Kein** Umbenennen, Sortieren oder Verschieben einzelner Bilder; die Nummer im
  Namen ergibt sich aus der Ablage.
- **Keine** Verknüpfung einzelner Bilder mit Werkzeugen, Maschinen oder Plänen.
- **Kein** Bilder-Upload in anderen Bereichen (Werkzeuge, Lager/Ersatz) – dort
  gibt es keine Ablage je Datensatz.
- **Keine** Größenbegrenzung: ein Handyfoto in voller Auflösung wird angenommen.

## Umsetzung

**Umgesetzt (TASK-017).** `services/serial_article_service.py` (Bildnamen,
Schreiben, Lesen, Auflösen, Einzel-Löschen), `schemas/serial_article.py`
(`ArticleFileRead`, `images` in `SerialArticleRead`), `routers/serial_articles.py`
(`images` in POST/PUT, `GET`/`DELETE /{id}/files/{name}`), Frontend
(`SerialArticleForm`, `PDFViewer` mit Reiter, Liste mit Badge). Belege:
`backend/tests/test_serial_articles.py` (17 neue Tests),
`frontend/tests/serial-articles.spec.ts` (13 Browser-Tests).

---

# DEC-059 – Vorschaubilder in fester Größe und Datei-Fenster im Split-Screen
**Status:** Verbindlich
**Ergänzt:** DEC-058 (Bilder zum Serienartikel)

## Ausgangslage

Bilder wurden bisher **in voller Größe** geladen – sowohl für die Liste im
Datei-Fenster als auch für die Großansicht. Ein Handyfoto hat schnell 5–8 MB; bei
mehreren Bildern zog das die Anzeige in die Länge. Außerdem wechselte das Fenster
zwischen den Reitern „Einrichteplan" und „Bilder", statt Plan und Bilder
gleichzeitig zu zeigen. Auftrag: „Kann zum Vorschau bestimmte Größe genommen
werden?" und „PDF/Bild-Viewer als Split-Screen mit Thumbnails".

## Regel

1. **Vorschau in fester Größe.** Für jedes Bild gibt es eine Vorschau mit
   maximal **400 × 400 px** (JPEG, Qualität 80), Seitenverhältnis bleibt erhalten.
2. **Einmal erzeugen, dann wiederverwenden.** Die Vorschau liegt als
   `.thumbs/<name>.jpg` im Artikelordner. Existiert sie und ist nicht älter als das
   Original, wird sie direkt ausgeliefert; sonst wird sie neu erzeugt.
3. **`.thumbs` ist ein Zwischenspeicher, keine Datei des Artikels.** Der Ordner
   zählt in `list_images()` nicht als Bild, wird beim Löschen eines Bildes
   mitentfernt und verschwindet mit dem Artikelordner.
4. **Nur die Liste lädt die Vorschau.** Die Großansicht zeigt weiterhin das
   **Original** (`GET …/files/{name}`), die Liste `GET …/files/{name}?variant=thumb`.
5. **Ohne Bildbibliothek (Pillow) oder bei unlesbarem Bild** wird das **Original**
   ausgeliefert – die Anzeige funktioniert immer, nur größer. Kein Fehler, kein 500.
6. **Der Einrichteplan hat keine Vorschau.** Er wird im iframe gezeigt; sein
   Symbol in der Dateiliste ist ein Icon, kein gerendertes Blatt.
7. **Split-Screen.** Das Datei-Fenster zeigt links eine **Dateiliste mit
   Vorschaubildern** (Einrichteplan-Eintrag plus ein Eintrag je Bild mit Name und
   Größe) und rechts die **große Ansicht** des Ausgewählten. Die Auswahl ersetzt
   die früheren Reiter; die Kopfzeile bietet je nach Auswahl „Herunterladen"
   (Plan) oder „Bild entfernen" (Bild, nur Admin).
8. **Öffnen per Zeilenklick.** Ein Klick auf eine **Zeile** der Liste öffnet das
   Fenster – es gibt **keinen** „Ansehen"-Knopf und keinen entsprechenden
   Menüeintrag mehr. Das Zeilenmenü („…") enthält nur noch „Bearbeiten" und
   „Löschen" und wird ausschließlich Admins gezeigt. Startauswahl: der Plan, wenn
   einer hinterlegt ist, sonst das erste Bild. Die Zeile ist per Tab erreichbar
   und öffnet mit Enter oder Leertaste (Klickziel bleibt die ganze Zeile).
9. **Pflicht:** `Pillow` steht in `backend/requirements.txt`. Fehlt es, degradiert
   die Funktion wie in Punkt 5 beschrieben.

## Begründung

- Feste Vorschaugröße: die Liste lädt ~1 KB statt mehrerer MB je Bild; das Fenster
  öffnet sofort, die teure Ansicht kommt erst auf Klick.
- Zwischenspeicher im Artikelordner: kein zweites Ablagesystem, kein Datenbankfeld
  – und das Löschen bleibt „Ordner weg, alles weg".
- Split-Screen statt Reiter: Plan und Bilder sind zwei Sichten auf **dasselbe**
  Werkzeug; man will beim Einbau vergleichen, nicht umschalten.

## Was ausdrücklich NICHT gilt

- **Keine** mehreren Vorschaugrößen (z. B. klein/mittel/groß) – eine Größe genügt.
- **Keine** Vorschau des PDFs (kein Rendern der ersten Seite) und **keine**
  Seitenzahl aus dem PDF.
- **Keine** Bildbearbeitung: die Vorschau ist abgeleitet, das Original bleibt
  unverändert.
- **Keine** Größenbegrenzung für den Upload (unverändert DEC-058) – begrenzt wird
  nur, was die **Liste** lädt.
- **Kein** Nachladen im Hintergrund (Lazy-Loading) in der Liste: alle Vorschauen
  eines Artikels werden beim Öffnen geladen.

## Umsetzung

**Umgesetzt (TASK-018).** `services/serial_article_service.py` (`THUMB_DIR_NAME`,
`THUMB_MAX_SIZE`, `THUMB_QUALITY`, `thumbnail_path()`, `_remove_thumbnail()`),
`routers/serial_articles.py` (`?variant=thumb`), `requirements.txt` (Pillow),
`frontend/src/components/serial-articles/PDFViewer.tsx` (Split-Screen mit
Dateiliste), `api/serialArticles.ts` (`getSerialArticleImage(id, name, 'thumb')`).
Belege: `backend/tests/test_serial_articles.py` (5 neue Tests),
`frontend/tests/serial-articles.spec.ts`.

---

# DEC-060 – Ein Dateifeld für Einrichteplan und Bilder
**Status:** Verbindlich
**Ergänzt:** DEC-058 (Bilder zum Plan), vereinfacht die Formularfläche aus DEC-056 Punkt 10

## Ausgangslage

Plan und Bilder hatten **zwei getrennte Auswahlflächen** (zuerst kam der Plan,
später die Bilder). Für den Benutzer sah es so aus, als müsste er zweimal
hochladen – verschickt wurden die Dateien aber schon immer **zusammen in einer
Anfrage** (`multipart`: `file` für den Plan, `images` mehrfach für die Bilder).

## Regel

1. **Ein Feld für alle Dateien** im Serienartikel-Formular: PDF **und** Bilder
   werden in derselben Zone ausgewählt oder hineingezogen; Mehrfachauswahl ist
   möglich.
2. **Sortiert wird beim Auswählen**, nicht im Backend: `file.type`/Endung
   entscheiden, was Plan und was Bild ist.
3. **Nur ein Plan je Artikel:** Werden mehrere PDFs gewählt, wird der **erste**
   übernommen und ein Hinweis (`.ui-alert-info`) sagt, dass die weiteren
   ignoriert wurden.
4. **Die Auswahl steht als Liste** unter dem Feld: Plan-Eintrag (Symbol, Name, KB,
   „Einrichteplan") und je Bild eine Zeile mit kleiner Vorschau, Name, KB, „Bild".
   Jeder Eintrag ist **vor dem Speichern** einzeln entfernbar (✕).
5. **Hinterlegte Dateien** bleiben sichtbar: „Einrichteplan ist hinterlegt – eine
   neu ausgewählte PDF ersetzt ihn" und „N Bilder sind hinterlegt – neue Bilder
   kommen hinzu".
6. **Eine Anfrage bleibt eine Anfrage:** `POST`/`PUT` bekommen weiterhin `file`
   und `images` als getrennte Formularfelder – daran ändert sich nichts.

## Begründung

- Zwei Flächen für dasselbe („Dateien zu diesem Plan") erzeugen die Frage, ob man
  zweimal hochladen muss. Ein Feld ist ehrlicher: es ist eine Ablage, ein Vorgang.
- Die Liste macht vor dem Speichern sichtbar, was mitgeschickt wird – beim Plan
  und bei jedem Bild einzeln.
- Am Backend ändert sich nichts: die Zerlegung ist reine Oberflächenlogik, die
  Schnittstelle bleibt stabil.

## Was ausdrücklich NICHT gilt

- **Keine** automatische Erkennung mehrerer Einrichtepläne je Artikel: ein Artikel
  hat genau **einen** Plan (DEC-056 Punkt 2).
- **Keine** Änderung an Ablage, Adressen oder Rechten der Dateien (DEC-057, DEC-058).
- **Keine** Sammelaktion „alle entfernen" – jeder Eintrag wird einzeln entfernt.
- **Kein** Upload-Widget mit Fortschrittsbalken (die Dateien gehen mit dem
  Speichern-Knopf raus, wie bisher).

## Umsetzung

**Umgesetzt (TASK-019).** `frontend/src/components/serial-articles/SerialArticleForm.tsx`
(`DOC_ACCEPT`, `isPlan()`, `isBild()`, `onDocsDrop()`, eine Dropzone, Auswahlliste
mit Entfernen-Knöpfen). Test: `frontend/tests/serial-articles.spec.ts` (der
Anlege-Test wählt PDF und zwei Bilder **in einem Schritt** und prüft die Liste).

---

# DEC-061 – Bildansicht: Zoom, Drehen, größeres Fenster
**Status:** Verbindlich
**Ergänzt:** DEC-059 (Split-Screen und Vorschaubilder)

## Ausgangslage

Die große Bildansicht zeigte das Bild nur eingepasst – **kein Zoom, kein Drehen**.
Für Fotos aus der Werkstatt (schräg aufgenommen, kleine Details) ist das zu wenig.
Außerdem war das Datei-Fenster mit `max-w-5xl` knapp, und in der Liste lagen bei
1440 px die Spalten „Dateien" und „Aktionen" außerhalb des sichtbaren Bereichs
(gemessen: Tabelle 888 px bei 815 px Platz).

## Regel

1. **Werkzeugleiste über der Bildansicht:** Verkleinern / Vergrößern mit
   Prozentanzeige, Drehen nach links und rechts (±90°), **Zurücksetzen**.
2. **Zoomstufen:** 50, 75, **100 (eingepasst)**, 125, 150, 200, 300, 400 %.
   Die Anzeige ist der aktuelle Wert in Prozent.
3. **Verschieben durch Ziehen**, sobald gezoomt oder gedreht ist (Mauszeiger wird
   zur Greifhand); ein Hinweis in der Bildunterschrift sagt es. Beim Zurück auf
   100 % ohne Drehung springt der Versatz auf null.
4. **Die Ansicht gehört zur Auswahl:** Beim Wechsel des Bildes beginnen Zoom,
   Drehung und Versatz neu (die Ansicht ist eine eigene Komponente mit
   `key=<Dateiname>`).
5. **Größeres Fenster:** Höhe `94dvh` (`max-h-[calc(100dvh-1rem)]`), Breite bis
   `95vw` bzw. `1400px`; die Dateiliste links wird 16 rem breit.
6. **Liste bleibt ohne seitliches Scrollen (1440 px):** Die **Beschreibung** steht
   als zweite Zeile unter dem Namen (Spalte „Name / Beschreibung"), die
   Datei-Badges heißen kurz „PDF" / „Kein PDF" / „N Bilder", die Aktionsspalte hat
   eine feste Breite (`w-14`). Gemessen: Tabelle ≤ Bereich bei 1440 × 900.
7. **Tastatur und Zugänglichkeit:** Jeder Knopf hat `aria-label` und `title`, die
   Prozentanzeige ist `aria-live="polite"`, das Bild behält seinen Alternativtext
   („Großansicht <Datei>") und trägt `data-zoom`/`data-rotation` als messbaren
   Zustand für Prüfungen.

## Begründung

- Ein Foto vom Werkzeug zeigt Details (Anschluss, Ausrichtung, Verschleiß) erst
  beim Hineinzoomen; Drehen ist nötig, weil Handyfotos oft quer aufgenommen sind.
- 100 % = eingepasst entspricht dem, was der Nutzer zuerst sieht; die Stufen
  darüber sind bewusst grob (125/150/200/300/400), damit wenige Klicks genügen.
- Ein größeres Fenster und eine Liste ohne versteckte Spalten sparen einen
  zusätzlichen Scrollschritt – gerade auf dem Werkstatt-Tablet.

## Was ausdrücklich NICHT gilt

- **Kein** Zoom oder Drehen für den **Einrichteplan** – der läuft im
  Browser-Plugin, das eigene Bedienelemente mitbringt.
- **Keine** Markierungen, Notizen oder Ausschnitte im Bild.
- **Kein** Speichern der Ansicht: sie gilt für die Dauer des Fensters.
- **Kein** Verschieben per Tastatur (nur Ziehen mit Zeigegerät); Zoom und Drehen
  sind per Tastatur bedienbar (Knöpfe).
- **Kein** Mausrad-Zoom: das Rad bleibt dem Scrollen vorbehalten.

## Umsetzung

**Umgesetzt (TASK-020).** `frontend/src/components/serial-articles/PDFViewer.tsx`
(`BildBuehne` mit Zoom/Drehung/Versatz, Werkzeugleiste, größeres Panel, breitere
Dateiliste), `frontend/src/components/icons.tsx` (ZoomIn, ZoomOut, RotateLeft,
RotateRight), `frontend/src/components/serial-articles/SerialArticleList.tsx`
(Spalte „Name / Beschreibung", kurze Badges, feste Aktionsspalte). Beleg:
`frontend/tests/serial-articles.spec.ts` (Zoom/Drehen/Zurücksetzen und die
Layout-Messung bei 1440 × 900), Bilder `sa-06-zoom.png`, `sa-07-1440.png`.

---

# DEC-062 – Dateien sind gleichartig: mehrere Pläne, alles löschbar
**Status:** Verbindlich
**Ändert:** DEC-056 Punkt 2/9 (genau ein Plan, „Ersetzen"), DEC-058 Punkt 7 (Plan war vom Löschen ausgenommen)
**Ergänzt:** DEC-057 (Artikelordner), DEC-060 (ein Dateifeld)

## Ausgangslage

Zwei Fragen des Auftraggebers brachten es auf den Punkt: „Was ist, wenn ich zwei
Pläne habe für diesen Artikel?" und „Es muss möglich sein, dass ich in der
Bearbeitung etwas löschen oder ergänzen kann." Vorher galt: **ein** Plan je
Artikel (`plan.pdf`), ein neuer Upload **ersetzte** ihn, der Plan war einzeln
**nicht** löschbar, und die Bearbeitung zeigte nur Hinweissätze („Einrichteplan
ist hinterlegt …", „3 Bilder sind hinterlegt …") statt der echten Dateien.

## Regel

1. **Mehrere Einrichtepläne je Artikel** sind erlaubt – wie mehrere Bilder.
2. **Namen in der Ablage:** Der **erste** Plan heißt weiterhin `plan.pdf`
   (Altbestand bleibt gültig), weitere heißen `plan-2.pdf`, `plan-3.pdf` … Bilder
   bleiben `bild-1.jpg`, `bild-2.png` … Es entsteht **keine** Migration.
3. **`pdf_path` = erster Plan.** Das Feld bleibt und zeigt immer auf den ersten
   Plan (Sortierung nach Nummer). Es wird nach jedem Schreiben und Löschen
   nachgeführt; ohne Pläne ist es leer und `has_pdf` falsch.
4. **Ergänzen statt ersetzen.** Mitgeschickte Pläne und Bilder kommen **hinzu**;
   es wird nichts überschrieben. Eine hochgeladene Datei bekommt die nächste
   freie Nummer.
5. **Jede Datei ist einzeln löschbar** – Plan **und** Bild, für Admins, über
   `DELETE /api/serial-articles/{id}/files/{name}`. Beim Löschen des letzten
   Plans verschwindet der PDF-Eintrag aus der Oberfläche.
6. **Die Bearbeitung zeigt den echten Zustand** statt Hinweissätzen: Abschnitt
   **„Hinterlegte Dateien"** mit jedem Plan (Symbol, Dateiname, Größe,
   „Einrichteplan") und jedem Bild (Vorschau, Dateiname, Größe, „Bild") – jeweils
   mit **Löschen**; darunter **„Kommt beim Speichern dazu"** mit den neu
   ausgewählten Dateien, jede vor dem Speichern entfernbar.
7. **Datei-Fenster:** Die linke Liste führt **alle** Pläne (je Eintrag mit
   Dateiname) und alle Bilder; die Kopfzeile bietet passend zur Auswahl
   „Herunterladen" (Plan) bzw. „Einrichteplan entfernen" / „Bild entfernen".
   Der Einrichteplan wird je Datei über `/files/{name}` geladen (nicht mehr über
   `/pdf`, das nur den ersten Plan liefert).
8. **Liste:** Die Spalte „Dateien" zeigt bei einem Plan „PDF", bei mehreren
   „N Pläne" und sonst „Kein PDF", dazu „1 Bild" / „N Bilder".

## Begründung

- Ein Artikel kann mehrere Einrichtepläne haben (andere Auflage, andere Maschine,
  Nacharbeit). Ein zweiter Upload durfte deshalb keinen Plan still ersetzen.
- Dateien anlegen und wieder wegnehmen gehört in **ein** Formular: der Nutzer
  sieht beim Bearbeiten, was hinterlegt ist, und kann es dort korrigieren –
  ohne Umweg über das Datei-Fenster.
- Hinweissätze beschreiben nur, was passieren könnte; echte Zeilen mit Namen und
  Löschen-Knopf beschreiben, was da ist. Das ist der Unterschied, den der
  Auftraggeber angesprochen hat.

## Was ausdrücklich NICHT gilt

- **Keine** Umbenennung bestehender Dateien und **keine** Migration: `plan.pdf`
  bleibt als erster Plan gültig.
- **Keine** Reihenfolge-Pflege (Sortieren, „Plan nach oben") – die Nummer im
  Namen bestimmt die Reihenfolge.
- **Kein** Einzel-Download eines Bildes (nur der Plan hat „Herunterladen").
- **Keine** Papierkorb-Funktion: Löschen ist endgültig und wird bestätigt.
- **Kein** Löschen durch normale Benutzer: alle Schreibwege bleiben
  `require_admin`.

## Umsetzung

**Umgesetzt (TASK-021).** `services/serial_article_service.py` (`is_plan_name()`,
`_plan_index()`, `_write_plans()`, `_plan_names()`, `_next_plan_name()`,
`_first_plan_path()`, `list_files()`, `delete_file()`, `sync_pdf_path()`;
`_as_file_list()` nimmt eine oder mehrere Dateien),
`schemas/serial_article.py` (`ArticleFileRead.kind` mit `plan`/`image`,
`plans` in der Antwort), `routers/serial_articles.py` (`plans` in POST/PUT,
`DELETE /{id}/files/{name}` auch für Pläne), Frontend
(`SerialArticleForm` mit „Hinterlegte Dateien"/Löschen, `PDFViewer` mit
Plan-Liste und `PlanBuehne`, Liste mit „N Pläne"-Badge). Belege:
`backend/tests/test_serial_articles.py` (5 neue Tests),
`frontend/tests/serial-articles.spec.ts` (15 Tests, neu: „verwaltet mehrere
Pläne und Dateien in der Bearbeitung").

---

# DEC-063 – Serienartikel-Liste in Werkzeug-Optik: Favoriten, Zebra, SVG-Icons
**Status:** Verbindlich
**Ergänzt:** DEC-056 Punkt 8 (Liste), DEC-062 (Dateien)
**Vorbild:** die Werkzeugliste (`docs/05-tools.md` §6, TASK-014)

## Ausgangslage

Die beiden Listen sahen unterschiedlich aus, obwohl sie dasselbe leisten: Die
Serienartikel-Liste hatte eine **sichtbare Feldbeschriftung** („Serienartikel
durchsuchen"), das Werk als **Auswahlfeld** statt als Segmente, **keine
Favoriten**, **kein Zebra** und als Sortierzeichen die **Textglyphen** `▲▼↕`.
Auftrag: „Überschrift weg, Werk-Knöpfe wie bei Werkzeuge, Favoriten fehlen, Zebra
fehlt – und prüfen, ob wir SVG in den Listen nutzen können."

## Regel

1. **Kopfzeile wie in der Werkzeugliste:** Überschrift „Serienartikel" links,
   Schnellfilter rechts in derselben Zeile.
2. **Werk als Segmente** (`.ui-segments`, native Radios in einer `radiogroup`
   „Nach Werk filtern"): „Alle", dann je Werk ein Segment – genau wie bei den
   Werkzeugen. Kein Auswahlfeld mehr.
3. **Favoriten** wie bei den Werkzeugen: **global**, nicht pro Benutzer
   (`serial_articles.is_favorite`), Umschalter „Nur Favoriten" in der Kopfzeile,
   Stern in der ersten Spalte (`aria-pressed`), Zeile mit Amber-Tönung **statt**
   Zebra. Gesetzt wird die Markierung über den eigenen Endpunkt
   `PUT /api/serial-articles/{id}/favorite` (nur `require_active` – sie ändert
   nichts am Bestand), damit ein normales Bearbeiten sie nicht zurücksetzt.
   Umschalten ist **optimistisch** mit Rücknahme bei einem Fehler.
4. **Zebra + Glasverlauf:** Zeilen wie in der Werkzeugliste – `.table-row-glass`
   mit `even:bg-white/40` und `hover:bg-white/70`; Favoriten behalten ihre
   Amber-Tönung.
5. **Icons sind SVG** aus `components/icons.tsx`: Sortierzeichen
   (`SortableIcon`/`SortAscIcon`/`SortDescIcon`), Stern, Lupe, `XIcon` zum Leeren
   der Suche. **Keine Textglyphen** (`▲▼↕`, `✕`) mehr in der Liste.
6. **Suchfeld ohne sichtbare Beschriftung** (wie in der Werkzeugliste): Lupe
   links, Löschknopf und Ladeanzeige rechts, der Name kommt für Screenreader aus
   `aria-label="Serienartikel durchsuchen"`.
7. **Überlauf-Hinweis:** Läuft die Tabelle seitlich über (gemessen per
   `ResizeObserver`), erscheint „Tabelle seitlich scrollbar – die Spalte
   ‚Aktionen' (…) steht am rechten Rand." Sonst sieht die abgeschnittene Kante wie
   das Ende der Liste aus. Bei 1440 × 900 passt die Tabelle vollständig.

## Begründung

- Zwei Listen mit derselben Aufgabe dürfen nicht unterschiedlich bedient werden:
  wer die Werkzeugliste kennt, findet sich in der Serienartikel-Liste sofort
  zurecht (DEC-021: einfach und robust).
- Favoriten sind in der Werkstatt eine Sichtmarkierung („diesen Plan brauchen wir
  ständig") – dieselbe Überlegung wie bei den Werkzeugen.
- SVG-Icons übernehmen Farbe, Strichstärke und Größe aus dem Design-System;
  Textglyphen werden je Plattform anders gerendert und gehören zu keinem Set
  (Audit A-15/A-17).

## Was ausdrücklich NICHT gilt

- **Keine** Favoriten pro Benutzer: die Markierung gilt für alle (eine
  benutzerbezogene Variante wäre eine Datenmodell-Änderung mit Zuordnungstabelle).
- **Keine** Sortierung nach Favoriten: der Stern ist Filter und Markierung, die
  Sortierung bleibt bei den fachlichen Spalten.
- **Kein** Admin-Recht für den Favoriten – wie bei den Werkzeugen darf ihn jeder
  aktive Benutzer setzen.
- **Keine** Chip-Zeile „Aktive Filter" wie in der Werkzeugliste: die Serienartikel-
  Liste hat nur zwei Schnellfilter und die Suche, der Zurücksetzen-Knopf genügt.
- **Keine** Änderung an den Textglyphen der Meldungsrahmen (`.ui-alert` „×") – das
  ist der projektweite Punkt A-17 und wartet auf die Entscheidung K-04/K-05.

## Umsetzung

**Umgesetzt (TASK-022).** Migration `b6f2c8d41a77` (`is_favorite`),
`models/serial_article.py`, `schemas/serial_article.py`
(`SerialArticleFavoriteUpdate`, `is_favorite` in der Antwort),
`crud/crud_serial_article.py` (`favorites_only`, `set_favorite()`),
`services/serial_article_service.py`, `routers/serial_articles.py`
(`PUT /{id}/favorite`, `favorites_only` als Listenparameter), Frontend
(`SerialArticleList` mit Segmenten, Stern, Zebra, SVG-Icons, Überlauf-Hinweis;
`api/serialArticles.ts#setSerialArticleFavorite`). Belege:
`backend/tests/test_serial_articles.py` (3 neue Tests),
`frontend/tests/serial-articles.spec.ts` („markiert Favoriten und filtert darauf").

---

# DEC-064 – Ersatzteile sind ein eigener Bereich; `storage_items` wird abgelöst
**Status:** Verbindlich
**Bezug:** Anforderung 7 (Lager/Ersatz), Anforderung 8 (Bestand), Anforderung 13
(Suche), DEC-052 (Lager/Ersatz als Einzelzeilen), DEC-048 (Lagerplatz-Matrix)
**Auftrag des Projektinhabers:** „Ersatzwerkzeuge sind schon in der Werkzeugliste –
das ist ok. Was ich mit Ersatzteilen machen soll, weiß ich noch nicht, die haben
eine Artikel-Nr. und keine Werkzeug-ID." → Entscheidung: **Weg A** (eigener Bereich
für Ersatzteile, Ersatzwerkzeuge bleiben in der Werkzeugliste)

## Ausgangslage

Für Lager/Ersatz existierten **zwei** Modellierungen parallel:

1. `Tool` mit `is_storage = true` (DEC-052, verbindlich) – sichtbar im Sub-Reiter
   „Lager / Ersatz" des Anlegeformulars, gelistet in der **Werkzeugliste**.
2. `StorageItem` (`storage_items`, `/api/storage`) – sichtbar im Tab „Lager/Ersatz".

Gemessener Ist-Stand der Datenbank (`backend/toolsync.db`, nur lesend geprüft):
`storage_items` = **0 Zeilen**, `tools` = 16 (davon `is_storage = 1`),
`tool_movements` = 98, `serial_articles` = 4.

> **Wichtig:** Der Tab „Lager/Ersatz" war deshalb dauerhaft **leer**: er liest
> `storage_items`, in die nie etwas geschrieben wurde – während die echten
> Lager/Ersatz-Objekte als `tools` in der Werkzeugliste lagen. Das ist die Ursache
> dafür, dass der Tab wie ein unfertiger Rest wirkte.

## Regel

1. **Ersatzwerkzeuge bleiben, wo sie sind.** Ein Ersatzwerkzeug ist ein `Tool` mit
   `is_storage = true` und bleibt in der **Werkzeugliste** (DEC-052 unverändert,
   inklusive Mehrfach-ID, Exemplaranlage und Platzlogik). Der Tab „Lager/Ersatz"
   ist nicht mehr seine Heimat.
2. **Ersatzteile sind eine eigene Entität** `SparePart`, Tabelle `spare_parts`,
   eigener Bereich und Tab **„Ersatzteile"**.
3. **`storage_items` wird abgelöst.** Modell, Schema, CRUD, Service, Router
   `/api/storage` und die Komponenten `StorageItemList.tsx` / `StorageItemForm.tsx`
   werden **entfernt** – im **selben Zug** wie die Umstellung des Tabs. Es gibt
   keinen Zwischenzustand mit zwei parallelen Welten, und der Tab ist zu keinem
   Zeitpunkt funktionslos.
4. **Die Identität eines Ersatzteils ist die Artikelnummer.** `article_number` ist
   Pflicht. Ein Ersatzteil hat **keine** Werkzeug-ID und **keine** Lager-/`storage_id`.
5. **Ein Werk ist Pflicht** (`plant_id`, FK → `plants.id`, `ondelete="RESTRICT"`).
   Ohne Werk ist nicht bestimmbar, in welchem Werk ein Teil an welchem Platz liegt –
   und es gäbe keinen Werk-Filter wie in den übrigen Listen.
6. **Mengenbestand als Spalte.** `quantity` (`Integer`, Default `1`) und `unit`
   (`String(20)`, optional, z. B. `Stk`, `m`, `kg`) – **eine Zeile je Artikel und
   Lagerort**, nicht eine Zeile je Stück. Anders als bei Werkzeugen (DEC-052) sind
   Ersatzteile nicht ausleihbar; 200 Zeilen für 200 Schrauben wären unsinnig.
   Damit ist **Anforderung 8 (Mengenbestand)** erstmals modelliert.
   **Kein Mindestbestand** in dieser Ausbaustufe (Entscheidung des Projektinhabers).
7. **Der Lagerort hat zwei Formen** – beide freiwillig und unabhängig:
   - **Freitext** (`storage_place`, `String(50)`, z. B. „Regal B3 / Fach 2") für
     Schütten und Fächer, die nicht in der Werkzeug-Matrix liegen.
   - **Matrix-Platz** (`position_id`, FK → `positions.id`, `ondelete="SET NULL"`)
     für einen konkreten Platz aus der Werkzeug-Matrix.

   **Nachtrag (nach der Abnahme, Entscheidung des Projektinhabers):** Ein Platz
   aus der Matrix gilt damit als **belegt** – die Matrix zeigt das Ersatzteil,
   Werkzeuge können dort nicht mehr abgelegt werden, und der Platz ist für andere
   Ersatzteile gesperrt. Belegt heißt: `positions.tool_id` **oder** ein Ersatzteil
   darauf. Damit gilt Anforderung 7.2 auch für Ersatzteile. Die Platz-Logik selbst
   (Perlenkette, DEC-048/053) bleibt in ihrem Ablauf unverändert – sie bekommt nur
   die zusätzliche Belegungsprüfung; das Einreihen in eine Schublade mit Ersatzteil
   wird abgelehnt, weil dabei die ganze Schublade neu belegt wird.
8. **Kein `allow_duplicate_id`.** Bei Ersatzteilen ist „dieselbe Nummer mehrfach"
   kein Sonderfall, sondern der Normalfall (mehrere Lagerorte, mehrere Chargen) –
   eine Option dafür wäre irreführend.
9. **Pflicht-Migration.** `spare_parts` erhält eine **Alembic-Revision**. Genau das
   fehlte `storage_items`: die Tabelle entstand nur über `Base.metadata.create_all`
   beim App-Start und existierte in keiner Revision.
10. **Rechte wie bei Werkzeugen:** Lesen, Anlegen und Ändern `require_active`
    (jeder aktive Benutzer darf ein Ersatzteil pflegen), **Löschen `require_admin`**
    – dieselbe Aufteilung wie in `routers/tools.py`.

## Feldmodell `spare_parts`

| Feld | Typ | Nullable | Hinweis |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `article_number` | `String(100)` | **nein** | die Identität, `index=True` |
| `name` | `String(200)` | ja | Bezeichnung, z. B. „Dichtung Ø40" |
| `type` | `String(100)` | ja | z. B. Dichtung, Sensor, Normteil (für Filter) |
| `plant_id` | FK → `plants.id`, `RESTRICT` | **nein** | Werk |
| `quantity` | `Integer` | nein | Default `1` |
| `unit` | `String(20)` | ja | Stk, m, kg … |
| `machine_id` | FK → `machines.id`, `SET NULL` | ja | wie im Serienartikel |
| `storage_place` | `String(50)` | ja | Freitext (Schütten, Fächer) |
| `position_id` | FK → `positions.id`, `SET NULL` | ja | Matrix-Platz; gilt als **belegt** (Nachtrag) |
| `description` | `Text` | ja | – |
| `is_favorite` | `Boolean` | nein | Default `false`, **global** (wie DEC-063); eigener Endpunkt `PUT /{id}/favorite` |
| `created_at` / `updated_at` | `AuditMixin` | – | wie projektweit üblich |

## Was ausdrücklich NICHT gilt

- **Kein** Mengen-Zähler auf einem Werkzeug-Datensatz und **keine** Änderung an
  DEC-052: „eine Zeile je Exemplar" gilt für **Werkzeuge** weiter.
- **Keine** Ausleihlogik für Ersatzteile: kein `status`, keine Ausleihe, keine
  Bewegungen. Ersatzteile sind Bestand, keine Leihobjekte.
- **Keine** Bilder am Ersatzteil (später möglich, eigene Entscheidung).
- **Kein** Mindestbestand, keine Warnschwelle, keine Beschaffungsfunktion.
- **Keine** harte Fremdschlüsselbindung an ein Werkzeug – ein Ersatzteil hat keine
  Werkzeug-ID.
- ~~**Keine** Belegung von Matrix-Plätzen durch Ersatzteile.~~ → **Aufgehoben
  (Nachtrag):** Ersatzteile **dürfen** einen Matrix-Platz belegen (Punkt 7); der
  Platz gilt dann als belegt und ist für Werkzeuge gesperrt.
- **Kein** Beibehalten von `/api/storage` „für alle Fälle": ein toter zweiter Weg
  war genau das Problem.

## Umsetzung

**Umgesetzt (TASK-024, Schritt 2).** Neu: `app/models/spare_part.py`,
`app/schemas/spare_part.py`, `app/crud/crud_spare_part.py`,
`app/services/spare_part_service.py`, `app/routers/spare_parts.py`
(`/api/spare-parts`, plus `GET /check-article-number` als **Hinweis**, nicht als
Blockade), Revision `a8f4c2d6e130` (legt `spare_parts` an, entfernt
`storage_items`; **idempotent**, weil `create_all` beim App-Start Tabellen
vorwegnehmen kann), Frontend `components/spare-parts/` (`SparePartList`,
`SparePartForm`), Sub-Reiter „Ersatzteil" im Anlegeformular, Tab „Ersatzteile"
statt „Lager/Ersatz". Entfernt: `storage_item.py`, `storage_item_service.py`,
`crud_storage_item.py`, `routers/storage_items.py`, `api/storage.ts`,
`types/storage-item.ts`, `components/storage/*`.

Belege: `backend/tests/test_spare_parts.py` (16 Tests, Suite gesamt **140
grün**), `frontend/tests/spare-parts.spec.ts` (9 Tests, Browser-Suite gesamt
**65 grün**), Migration auf- und abwärts auf einer Kopie geprüft (Daten
unverändert: 16 Werkzeuge, 4 Serienartikel, 98 Bewegungen).
`docs/14-architecture.md`, `docs/11-sap-integration.md` und
`docs/07-stock-replacement.md` sind nachgezogen.

---

# DEC-065 – „Datenblatt": Einstellwerte eines Werkzeugs als eigener Bereich
**Status:** Verbindlich
**Bezug:** Anforderung 6 (Serienartikel – Vorbild), DEC-056…DEC-063 (Serienartikel),
DEC-052 (Mehrfach-ID), DEC-055 (Werkzeug-ID nur beim Stempel Pflicht)
**Auftrag des Projektinhabers:** „Die PDFs wie bei Serienartikeln, aber darin stehen
Einstelldaten, um das Werkzeug in der Maschine einzurichten – quasi die Werte vom
Werkzeug für die Maschine. Das Anlegeformular vom Serienartikel kann übernommen
werden, nur statt ‚Artikelnummer' soll ‚ID' stehen. Nenne es überall **Datenblatt**."

## Ausgangslage

Ein Serienartikel ist ein PDF-basierter **Einrichteplan** und beantwortet „**was**
braucht der Auftrag": Programmname, Bearbeitungszeit, benötigte Werkzeug-IDs, Anzahl
der Hübe, Material. Er hat keine Beziehung zu Werkzeugen (DEC-056 Punkt 1).

Was fehlte, ist die andere Hälfte desselben Vorgangs: die **Einstellwerte des
Werkzeugs an der Maschine** – „**wie** wird dieses Werkzeug eingerichtet". Diese
Angaben liegen heute in PDFs ohne Ort in der Anwendung.

> **Wichtig – Abgrenzung, die der Name tragen muss:** Serienartikel =
> **Einrichteplan für einen Artikel**; neuer Bereich = **Datenblatt für ein
> Werkzeug**. Beide sind PDFs und beide dienen dem Einrichten – deshalb heißen sie
> nicht gleich.

## Regel

1. **Eigener Bereich mit eigenem Tab „Datenblätter"** (DEC-066). Der fachliche Name
   des Dokuments ist **„Datenblatt"** und wird **überall** so verwendet (Projekt-
   inhaber-Entscheidung): Tab, Formular, Liste, Meldungen, Doku.
2. **Entität** `DataSheet`, Tabelle `data_sheets`, Präfix `/api/data-sheets`,
   Ablage `uploads/data_sheets/<id>/` (Ordner nach **Datensatz-ID**, nicht nach
   einer Kennung – siehe Punkt 6).
3. **Felder** (Abschnitt Feldmodell).
4. **Das Feld heißt „Werkzeug-ID" – nicht „Artikelnummer", und nicht beides.**
   Ein Feld mit zwei Bedeutungen ist genau die Mehrdeutigkeit, die Lager/Ersatz
   unklar gemacht hat (DEC-064). Ein Datenblatt wird über die **Werkzeug-ID**
   gefunden, den Serienartikel über die **Artikelnummer**.
5. **Die Werkzeug-ID ist empfohlen, aber nicht Pflicht** (`tool_id` nullable).
   DEC-055 erlaubt Abstreifer und Matrize **ohne** ID – für die gäbe es sonst kein
   Datenblatt. Werk ist Pflicht, ID wird beim Speichern ohne Wert nur **gemahnt**,
   nicht blockiert.
6. **Keine Fremdschlüsselbindung an eine Werkzeugzeile.** Eine Werkzeug-ID darf
   laut DEC-052 mehrfach existieren (mehrere Exemplare) und laut DEC-055 leer sein.
   Ein Datenblatt gilt für die **ID** (also für alle Exemplare), nicht für ein
   physisches Exemplar. Nebeneffekt: wird ein Werkzeug gelöscht, bleibt das
   Datenblatt auffindbar – bei einem Dokument die richtige Eigenschaft.
7. **Mehrere Datenblätter je Datensatz** sind erlaubt (`plan.pdf`, `plan-2.pdf` …
   wie DEC-062) – andere Auflage, andere Maschine, andere Version. Alles einzeln
   löschbar, mit Bestätigungsdialog.
8. **Keine Inhaltsanalyse.** Der PDF-Inhalt bleibt ausschließlich im Dokument
   (Anforderung 6.3, unverändert). Strukturiert geführt werden nur die
   Auffang-Angaben, über die gesucht wird.
9. **Rechte wie beim Serienartikel:** Lesen, Anzeigen und Herunterladen
   `require_active`; Anlegen, Ändern, Dateien hinzufügen/entfernen und Löschen
   **`require_admin`**. Verwaltung ist Administratoren vorbehalten; das Ausblenden
   von Knöpfen ist nicht die Sicherheitsmaßnahme.
10. **Erreichbar auf zwei Wegen:** eigener Tab (Suche über die ganze Ablage) und
    die Zeilenaktion **„Datenblatt"** in der Werkzeugliste. Wer an der Maschine
    steht, kommt vom Werkzeug, nicht aus einer Liste.
    > **Geändert durch DEC-069:** Die Aktion liegt nicht mehr im „…"-Menü und
    > öffnet auch nicht mehr die gefilterte Liste, sondern das Dokument selbst –
    > als eigenes Symbol neben dem Menü, und nur wenn es eines gibt.
11. **Optik und Bedienung wie die Serienartikel-Liste** (DEC-063): Werk als
    Segmente, Suchfeld ohne sichtbare Beschriftung mit `aria-label`, Zebra +
    Glasverlauf, SVG-Sortierzeichen, Blätterleiste mit Bereichsangabe,
    Überlauf-Hinweis – und **Favoriten** (`is_favorite`), weil die Liste sonst von
    der Serienartikel-Liste abweicht; die Spalte wird **sofort** mitangelegt, damit
    dafür später keine zweite Migration nötig ist.
12. **Der Datei-Betrachter wird generalisiert, die Serienartikel-Logik nicht.**
    `PDFViewer.tsx` (Split-Screen, Zoom, Drehen) wird so erweitert, dass er seine
    Datei aus beiden Bereichen laden kann; Artikelordner, Service und Endpunkte der
    **Serienartikel bleiben unverändert**.

## Feldmodell `data_sheets`

| Feld | Typ | Nullable | Hinweis |
|---|---|---|---|
| `id` | `Integer` | nein | Primärschlüssel |
| `tool_id` | `String(50)` | ja | **Werkzeug-ID**, `index=True`; empfohlen, nicht Pflicht (DEC-055) |
| `plant_id` | FK → `plants.id`, `RESTRICT` | **nein** | Werk (Pflicht) |
| `machine_id` | FK → `machines.id`, `SET NULL` | ja | die Maschine, für die die Werte gelten |
| `name` | `String(200)` | ja | Bezeichnung des Datenblatts |
| `description` | `String(500)` | ja | Zusatztext |
| `pdf_path` | `String(500)` | ja | **relativer** Pfad, z. B. `uploads/data_sheets/7/plan.pdf` |
| `is_favorite` | `Boolean` | nein | Default `false`, global (wie DEC-063) |
| `created_at` / `updated_at` | `AuditMixin` | – | – |

Antwort liefert – wie beim Serienartikel – **`has_pdf`** statt `pdf_path` und die
Dateiliste `plans` (Name, Größe).

## Was ausdrücklich NICHT gilt

- **Kein** Kunde am Datenblatt: Einstellwerte gelten für Werkzeug und Maschine,
  nicht für einen Auftraggeber.
- **Keine** Artikelnummer als zweites Identitätsfeld.
- **Keine** harte Verknüpfung zu einem Werkzeug-Exemplar (`tools.id`).
- **Keine** automatische Erzeugung von Datenblättern aus Serienartikeln und
  **keine** Verknüpfung der beiden Bereiche in dieser Ausbaustufe.
- **Keine** PDF-Inhaltsanalyse, keine Übernahme von Einstellwerten in Felder.
- ~~**Keine** Bilder am Datenblatt in dieser Ausbaustufe~~ → **Nachgezogen:** Bilder
  sind erlaubt (siehe Umsetzung und DEC-067) – dieselbe Mechanik wie beim
  Serienartikel (DEC-058), im **selben** Dateifeld wie die Datenblätter.
- **Beschriftung aus dem Beschreibungsfeld entfernt** (nachgezogen): Das Feld
  bleibt und wird gespeichert – im Feld steht aber nicht mehr das Wort
  „Beschreibung". Für Screenreader bleibt der Name über `aria-label` erhalten.
  (Erste Umsetzung hatte das Feld ganz entfernt – das war ein Missverständnis und
  ist zurückgenommen.)
- **Keine** Änderung an Serienartikeln, Artikordnern oder deren Endpunkten.

## Umsetzung

**Umgesetzt (TASK-024, Schritt 3).** Neu: `app/models/data_sheet.py`,
`app/schemas/data_sheet.py`, `app/crud/crud_data_sheet.py`,
`app/services/data_sheet_service.py` (Ablage `uploads/data_sheets/<id>/`,
`plan.pdf`, `plan-2.pdf` …), `app/routers/data_sheets.py` (`/api/data-sheets`,
plus `GET /check-tool-id` als **Hinweis**, nicht als Blockade), Revision
`c4b9e7a15f28` (idempotent). Frontend: `components/data-sheets/`
(`DataSheetList`, `DataSheetForm`), Sub-Reiter „Datenblatt", Tab „Datenblätter",
Zeilenaktion „Datenblatt" im Werkzeug-Zeilenmenü.

**Der Datei-Betrachter ist generalisiert:** `PDFViewer.tsx` bekommt sein Dokument
und seine Datei-Quelle als Props (`types/viewer.ts`,
`lib/viewerSources.ts`); Serienartikel und Datenblatt bedienen dieselbe
Komponente. Die Serienartikel-Logik (Ordner, Service, Endpunkte) wurde **nicht**
angefasst – das ist durch deren 16 Browser- und 66 Backend-Tests belegt.

Belege: Browser-Suite **78 grün** (13 neue in `frontend/tests/data-sheets.spec.ts`,
Serienartikel unverändert), Backend-Tests **140 grün**, Migration auf- und
abwärts geprüft, `docs/14-architecture.md` und `docs/02-domain-model.md`
nachgezogen.

**Nachgezogen nach der Abnahme** (TASK-026, `tasks/26-datenblatt-feinschliff.md`):

- **Bilder** sind am Datenblatt erlaubt: `bild-1.jpg`, `bild-2.png` … im selben
  Ordner, mit Vorschaubildern (400 px JPEG) wie bei den Serienartikeln. Im
  Formular gibt es dafür **ein** Dateifeld für Datenblätter und Bilder (DEC-060),
  das die Auswahl beim Ablegen sortiert.
- Der **Hinweis** „Freiwillig: Abstreifer und Matrize dürfen ohne ID existieren"
  ist aus dem Formular entfernt (er erklärt eine Regel, die das Formular ohnehin
  befolgt).
- Das **Beschreibungsfeld** ist aus dem Formular entfernt (Spalte bleibt).
- In der **Liste** ist der Name jetzt eine eigene Kennung (Mono-Kasten mit
  Sky-Kante, wie die Werkzeug-ID mit Teal-Kante), die Maschine trägt den
  **Farbpunkt aus den Stammdaten** (DEC-067), und die Favoriten-Tönung
  überschreibt nicht mehr das Zebra – mit eigenem Hover.

Belege: **81 Browser-Tests grün** (16 Datenblätter, davon 4 neue für Bilder,
Namens-Kennung, Maschinenfarbe und Favoriten-Hover), 140 Backend-Tests grün.

---

# DEC-066 – Tab-Struktur der Hauptansicht und Abgrenzung der Bereiche
**Status:** Verbindlich
**Bezug:** Anforderung 19 (Frontend und UX), DEC-064, DEC-065

## Regel

1. **Die Tab-Leiste der Hauptansicht lautet:**
   **Werkzeuge · Serienartikel · Datenblätter · Ersatzteile · Historie.**
2. **Der bisherige Tab „Lager/Ersatz" wird zu „Ersatzteile"** und zeigt
   ausschließlich Ersatzteile (DEC-064). Ersatzwerkzeuge sind über den Tab
   „Werkzeuge" erreichbar – dort künftig mit einem Filter „Ersatz".
3. **Der Tab „Historie" bleibt vorerst ein Platzhalter** und wird erst mit dem
   Bewegungspaket gefüllt (Rückgabe-UI, Benutzerzuordnung der Ausleihe,
   Werkswechsel im Datenmodell, Auswertung). Der Platzhaltertext benennt das
   Vorhaben, statt „folgt in einem späteren Schritt" zu sagen.
4. **Ein Anlege-Einstieg, mehrere Formulare.** „+ Anlegen" öffnet weiterhin **eine**
   Karte mit Sub-Reitern: **Werkzeug · Serienartikel · Datenblatt · Ersatzteil ·
   Lager/Ersatz · Info/Hilfe.** Die Reiter speichern **unabhängig** voneinander
   (bestehendes Muster seit DEC-056 Punkt 5). Kein Formular muss alles können.

## Abgrenzung – was gehört wohin

| Gegenstand | Identität | Bereich / Tab | Anlegen über |
|---|---|---|---|
| Werkzeug (Stempel, Abstreifer, Matrize) | Werkzeug-ID | Werkzeuge | Sub-Reiter „Werkzeug" |
| Ersatzwerkzeug eines Werkzeugs | Werkzeug-ID (mehrfach) | **Werkzeuge** (Filter „Ersatz") | Sub-Reiter „Werkzeug" + Checkbox „Lager/Ersatz" |
| Ersatzteil (Dichtung, Sensor, Normteil) | **Artikelnummer** | **Ersatzteile** | Sub-Reiter „Ersatzteil" |
| Einrichteplan eines Auftrags | Artikelnummer | Serienartikel | Sub-Reiter „Serienartikel" |
| Einstellwerte eines Werkzeugs für die Maschine | **Werkzeug-ID** (empfohlen) | **Datenblätter** | Sub-Reiter „Datenblatt" |

## Begründung

- Jeder Bereich beantwortet **eine** Frage: „Welches Werkzeug?", „Wie richte ich es
  ein?", „Welchen Plan brauche ich?", „Welches Teil liegt wo?" – vermischte Listen
  beantworten keine davon gut (die heutige Werkzeugliste zeigt Werkzeuge und
  Lager/Ersatz gemischt, weil `getTools()` ohne `is_storage`-Filter aufruft).
- Fünf Tabs bleiben überschaubar; ein sechster wäre ein Zeichen, dass Bereiche
  fehlen statt dass die Struktur zu eng ist.
- Getrennte Sub-Reiter statt eines Sammelformulars: die Pflichtfelder der Objekte
  schneiden sich kaum (DEC-064 Begründung), ein Sammelformular erzwänge
  künstliche Pflichtfelder.

## Was ausdrücklich NICHT gilt

- **Keine** Zusammenführung von Ersatzteilen und Ersatzwerkzeugen in **einer**
  Liste (Variante B wurde verworfen): doppelte Suche, Sortierung und Blätterleiste
  über zwei Entitäten hinweg.
- **Kein** Löschen des Historie-Tabs – er bleibt als geplanter Bereich sichtbar.
- **Keine** Umbenennung von „Serienartikel" oder „Werkzeuge".

## Umsetzung

**Umgesetzt (TASK-024).** Die Tab-Leiste lautet jetzt **Werkzeuge ·
Serienartikel · Datenblätter · Ersatzteile · Historie**; „Lager/Ersatz" ist
entfallen, der Platzhalter des Tabs „Historie" benennt das Vorhaben im Text.
Das Anlegeformular hat die Sub-Reiter **Werkzeug · Serienartikel · Datenblatt ·
Ersatzteil · Info/Hilfe · Lager/Ersatz** (der letzte erklärt, dass
Ersatzwerkzeuge über die Checkbox im Werkzeug-Reiter entstehen).

**Offen bleibt allein TASK-025:** Rückgabe-UI, Benutzerzuordnung der Ausleihe,
Auswertung, Werkswechsel im Datenmodell.

---

# DEC-067 – Maschinenfarbe in den Stammdaten
**Status:** Verbindlich
**Bezug:** Anforderung 14 (Admin-Bereich, Stammdaten), DEC-049 (Stammdaten als
Tabellen), DEC-065 (Datenblatt-Liste), Vorbild: `customers.color` (Migration
`d1a4f6b2c9e3`)
**Auftrag des Projektinhabers:** „Maschinen aus Stammdaten mit Farbe" (in der
Datenblätter-Liste).

## Ausgangslage

Kunden haben seit `d1a4f6b2c9e3` eine optionale Farbe (`customers.color`); die
Serienartikel-Liste zeigt daraus einen Farbpunkt neben dem Kundennamen, die
Stammdatenpflege im Admin-Panel hat dafür einen Farbwähler. **Maschinen** hatten
kein solches Feld – in der Datenblätter-Liste stand der Maschinenname als
nackter Text, obwohl die Maschine dort die zentrale Zuordnung ist („die
Einstellwerte gelten für diese Maschine").

## Regel

1. **`machines.color`** ist eine optionale Farbe als Hex-Code
   (`String(7)` = `#RRGGBB`), nullable. Ohne Farbe wird **kein** Punkt gezeigt.
2. **Pflege im Admin-Panel** unter „Stammdaten → Maschinen": derselbe
   `ColorPicker` wie bei den Kunden, mit dem Kontrollkästchen „Keine Farbe".
   Anlegen und Bearbeiten sind möglich; die API nimmt `color` bei `POST` und
   `PUT /api/machines` entgegen.
3. **Anzeige:** Listen zeigen den Farbpunkt **neben** dem Maschinennamen – in der
   Datenblätter-Liste umgesetzt, genau wie der Kundenpunkt in der
   Serienartikel-Liste. Der Punkt ist rein dekorativ (`aria-hidden`), der Name
   steht daneben als Text.
4. **Kunden und Maschinen werden gleich behandelt** – dieselbe Spalte, dieselbe
   Pflege, dieselbe Anzeige.

## Begründung

- Die Maschine ist im Datenblatt die zweite Kennung nach der Werkzeug-ID. Ein
  Farbpunkt macht mehrere Maschinen in einer Liste auf einen Blick
  unterscheidbar – dieselbe Überlegung, die beim Kunden bereits umgesetzt ist.
- Eine Farbe in den Stammdaten ist **eine** Pflegestelle: sie gilt für alle
  Listen, die die Maschine zeigen, ohne dass jede Liste eigene Farben erfindet.
- Kein Freitext am Datensatz: die Farbe gehört zur Maschine, nicht zum einzelnen
  Datenblatt.

## Was ausdrücklich NICHT gilt

- **Keine** Pflichtfarbe und **kein** automatischer Farbwert: ohne Angabe bleibt
  das Feld leer und es erscheint kein Punkt.
- **Keine** Farbcodierung von Status, Warnungen oder Prioritäten – die Farbe ist
  eine Zuordnungsmarkierung, keine Ampel (Abgrenzung zu `ToolStatus`).
- **Keine** Änderung an `customers.color` (bleibt wie es ist).
- **Keine** Übernahme der Farbe in die Werkzeugliste in dieser Ausbaustufe:
  dort wird die Maschine heute ohne Punkt gezeigt (offen, siehe unten).

## Umsetzung

**Umgesetzt (TASK-026).** Migration `e7d1b9c34a52` (`machines.color`,
**idempotent** – hält `create_all` aus), `models/master_data.py`,
`schemas/master_data.py` (`MachineBase.color`), `routers/master_data.py`
(`POST`/`PUT /api/machines`), `frontend/src/api/types.ts` (`Machine.color`),
`api/masterData.ts` (`createMachine`/`updateMachine` mit `color`),
`pages/admin/AdminStammdaten.tsx` (Farbwähler für Maschinen),
`components/data-sheets/DataSheetList.tsx` (Farbpunkt).

Belege: Browser-Test „zeigt die Maschine mit dem Farbpunkt aus den Stammdaten"
(`frontend/tests/data-sheets.spec.ts`; die Spec setzt die Farbe über die API und
**gibt sie hinterher zurück**).

## Offen

- Soll die **Werkzeugliste** den Maschinenpunkt ebenfalls zeigen?
- Soll die **Serienartikel-Liste** die Maschine mit Punkt statt als reinen Text
  zeigen (heute steht dort nur der Kundenpunkt)?

---

# DEC-068 – `has_pdf` folgt der Dateiliste, nicht der Spalte
**Status:** Verbindlich
**Bezug:** DEC-065 (Datenblatt), DEC-062 (Dateien sind gleichartig), Anforderung
6.3 (nur die Endung wird geprüft)
**Anlass:** Fehlerbericht des Projektinhabers „alle einträge in Datenblatt sind
leer".

## Ausgangslage

Beim Datenblatt gibt es dieselbe Angabe zweimal:

- die **Dateien im Ordner** `uploads/data_sheets/<id>/` – sie sind die Wahrheit
  für `plans` und `images`,
- die Spalte **`pdf_path`** – sie zeigt auf den ersten Plan und trägt das Feld
  `has_pdf` (Property am Modell).

Der Service führt `pdf_path` bei jedem Schreiben und Löschen nach. Ein Fehler in
`sheet_dir` ließ ihn die vorhandenen Dateien trotzdem nicht finden und leerte den
Verweis; die Oberfläche zeigte daraufhin bei **jedem** Datenblatt eine leere
Dateiliste, während `has_pdf` aus der Datenbank weiterhin `true` meldete – eine
Antwort, die sich selbst widerspricht. Genau an `has_pdf` hängt außerdem die
Zeilenaktion „Datenblatt" in der Werkzeugliste (DEC-065 Punkt 10): sie hätte das
vorhandene Dokument nicht geöffnet.

## Regel

1. **Eine Wahrheit für „gibt es ein Datenblatt?": der Ordner.** `_to_read()` in
   `routers/data_sheets.py` setzt `has_pdf = bool(plans)`, also aus derselben
   Liste, die die Antwort als `plans` mitliefert.
2. **`pdf_path` bleibt** – als Ablage-Notiz für den Listenfilter `has_pdf` und als
   Angabe, welcher Plan der erste ist. Es ist **kein** zweiter Wahrheitswert für
   die Anzeige.
3. **Der Listenfilter `has_pdf` darf nachlaufen.** Er fragt die Spalte ab und ist
   damit eine Vorfilterung; die Antwort ist maßgeblich. Die Oberfläche nutzt den
   Filter nicht.

## Begründung

- Die Anzeige darf sich nicht selbst widersprechen: `has_pdf: true` neben
  `plans: []` ist für den Benutzer ein Fehler, den er nicht auflösen kann.
- Dateien können sich außerhalb der Anwendung ändern (Ordner kopiert, Datei
  gelöscht, Sicherung zurückgespielt). Eine Spalte, die nur beim Schreiben
  nachgeführt wird, kann das nicht mitbekommen – die Dateiliste schon.
- Derselbe Grundsatz gilt schon für die Dateiliste selbst: „Die Dateiliste wird
  aus dem Ordner gelesen; es gibt keine eigenen Spalten dafür."

## Was ausdrücklich NICHT gilt

- **Kein** Schreiben bei jedem Lesen (`GET` repariert `pdf_path` **nicht**) – ein
  Lesezugriff bleibt ein Lesezugriff.
- **Keine** neue Spalte `has_pdf` in der Datenbank: das wäre eine dritte Angabe
  derselben Sache.
- **Keine** Änderung am Serienartikel: dort ist der Ordner nach der
  Artikelnummer benannt und `resolve_pdf_path()` liefert die Datei selbst
  (DEC-057/DEC-062) – der Fall stellt sich dort anders.

## Umsetzung

**Umgesetzt.** `routers/data_sheets.py` (`_to_read`, Beschreibung des
Query-Parameters `has_pdf`), `docs/20-datenblatt.md` (Abschnitt 3 und 5).
Belege: `tests/test_data_sheets.py` – „Die Antwort meldet `has_pdf` genau dann,
wenn eine Datei da ist" und „Verschwindet die Datei außerhalb der Anwendung,
bleibt keine Lüge übrig".

---

# DEC-069 – Datenblatt-Symbol in der Werkzeugzeile, kein Umweg über die Suche
**Status:** Verbindlich
**Bezug:** DEC-065 Punkt 10 (Zeilenaktion „Datenblatt"), DEC-068 (`has_pdf` folgt
der Dateiliste), DEC-063/§1.7 des UI-Guides (Icons), Anforderung 19 (Frontend/UX)
**Auftrag des Projektinhabers:** „nur den button aus den aktionen dropdown
rausholen und in die zelle neben aktion button packen mit svg. das datenblatt
icon soll sich nur abbilden wenn es auch wirklich ein datenblatt für die ID gibt
für das andere ausgrauen oder garnicht anzeigen. nicht auf die suche leiten im
datenblatt."

## Ausgangslage

Die Zeilenaktion „Datenblatt" lag als Menüeintrag im „…"-Menü
(`RowActionMenu`) und wechselte **immer** in den Bereich „Datenblätter": bei genau
einem Datenblatt mit Datei öffnete sie das Dokument, sonst belegte sie dort die
Suche mit der Werkzeug-ID vor. Zwei Folgen:

- Das Menü sagte nichts über den Zustand: „Datenblatt" stand in jeder Zeile, auch
  wenn es zu der ID gar keines gab.
- Der Klick führte in eine **andere** Ansicht mit einer Suche, die der Benutzer
  nicht gestellt hatte. Wer nur wissen wollte „gibt es hier ein Blatt?", landete
  in der Ablage und musste zurück.

## Regel

1. **Eigenes Symbol in der Zeile.** Die Aktion steht als Knopf **neben** dem
   „…"-Knopf in der Spalte „Aktionen", mit dem Lucide-Icon `FileText` als
   Inline-SVG (dieselbe Kennzeichnung wie der Reiter „Datenblatt" im
   Anlege-Formular). Im „…"-Menü gibt es „Datenblatt" **nicht mehr** – eine
   Aktion, zwei Wege wäre genau die Doppelung, die dieses Projekt vermeidet.
2. **Das Symbol steht nur, wenn es etwas zu öffnen gibt.** Bedingung ist
   `has_data_sheet` aus der Werkzeugliste: ein Datenblatt zu **genau dieser**
   Werkzeug-ID (DEC-052/055: exakter Vergleich) **mit hinterlegter Datei**
   (DEC-068: gezählt wird der Ordner, nicht die Spalte `pdf_path`). Fehlt eines
   von beidem, wird der Knopf **nicht gerendert** – ausgegraut wäre die
   Alternative, gewählt ist „gar nicht anzeigen", damit keine toten Knöpfe in
   einer dichten Tabelle stehen.
3. **Der Klick öffnet das Dokument, sonst nichts.** Kein Bereichswechsel, keine
   vorbelegte Suche. Gibt es mehrere Datenblätter zu der ID (DEC-065 Punkt 7),
   öffnet das **erste** (sortiert nach Werkzeug-ID, dann Datensatz-ID) und ein
   Hinweis nennt die Anzahl.
4. **Die Liste liefert die Angabe mit.** `ToolRead.has_data_sheet` wird im
   `ToolService` für die **ganze Seite in einer Abfrage** ermittelt (die IDs der
   Seite, dann die Datenblätter dazu) – nicht je Zeile. Auch der Einzelsatz
   (`GET /api/tools/{id}`) trägt das Feld, damit es nicht je Endpunkt etwas
   anderes bedeutet.
5. **Reihenfolge in der Zelle:** Datenblatt-Symbol links, „…" rechts, beide
   rechtsbündig. Dadurch bleibt der „…"-Knopf in **jeder** Zeile an derselben
   Stelle, auch in Zeilen ohne Symbol.

## Begründung

- Der Zustand gehört an die Stelle, an der die Entscheidung fällt: ein fehlendes
  Symbol sagt „hier gibt es nichts" deutlicher als ein Menüeintrag, der danach
  in eine leere Suche führt.
- Das Symbol ist die **zweite** Aktion, die eine Zeile häufig braucht (nach
  „Ausleihen") – sie verdient einen eigenen Knopf statt zwei Klicks im Menü.
- Keine zweite Wahrheit: „gibt es ein Datenblatt?" wird **einmal** beantwortet
  (dieselbe Prüfung wie in der Datenblatt-Antwort, DEC-068), aus derselben
  Quelle, aus der auch die Liste ihre Dateien liest.

## Was ausdrücklich NICHT gilt

- **Kein** Zurückschalten auf die gefilterte Liste als Rückfallweg. Fehlt das
  Datenblatt zwischen Laden der Liste und Klick (gelöscht), gibt es eine Meldung
  – keinen stillen Ansichtswechsel („Bitte die Werkzeugliste neu laden.").
- **Kein** Zähler und keine Vorschau am Symbol: es sagt „es gibt eines", nicht
  „wie viele" – die Anzahl nennt der Hinweis beim Öffnen.
- **Keine** Änderung am Datei-Fenster (`PDFViewer`) und keine an der
  Datenblatt-Liste außer dem Wegfall der vorbelegten Suche (`initialSearch`), die
  es nur für diese Aktion gab.
- **Keine** Pflicht: Werkzeuge **ohne** Werkzeug-ID (Abstreifer, Matrize –
  DEC-055) können kein Datenblatt über die ID haben; dort fehlt das Symbol immer.

## Umsetzung

**Umgesetzt.**

| Datei | Änderung |
|---|---|
| `crud/crud_data_sheet.py` | `get_by_tool_ids()` – alle Datenblätter zu den IDs einer Seite |
| `schemas/tool.py` | `ToolRead.has_data_sheet` |
| `services/tool_service.py` | `_tool_ids_with_data_sheet()`; gesetzt in `get_tools()` **und** `get_tool_read()` |
| `components/tools/ToolTable.tsx` | Symbol links neben dem „…"-Knopf, Menüeintrag entfernt, Spalte „Aktionen" auf `w-[5.4rem]` |
| `api/types.ts` | `Tool.has_data_sheet` |
| `App.tsx` | `openDataSheetsForTool()` öffnet direkt; `dataSheetFilter` entfällt |
| `components/data-sheets/DataSheetList.tsx` | Prop `initialSearch` entfällt (nur für diese Aktion) |

Belege: `backend/tests/test_tools_list.py` (vier Fälle: mit Datei, ohne Datei,
unscharfe ID, Einzelsatz), `frontend/tests/data-sheets.spec.ts` – „öffnet das
Datenblatt direkt über das Symbol in der Zeile" (mit gemessener Lage der beiden
Knöpfe und `svg`-Prüfung) und „zeigt kein Symbol, wenn es kein Datenblatt gibt".

---

# DEC-070 – Arbeitswerk des Benutzers (Kontext, keine Stammdaten-Eigenschaft)

**Status:** Verbindlich
**Bezug:** Anforderung 3 (Werke und Standorte), Anforderung 9/10 (Ausleihe/Rückgabe
nachvollziehbar), DEC-071 (Werkzeug-Logistik), DEC-066 (Tab-Struktur)
**Auftrag des Projektinhabers:** „Ich hätte es gern, dass der Benutzer das Werk selbst
wählt, in dem er arbeitet – z. B. auf der Main Site in der Sidebar – und das System
merkt es sich, aber jederzeit änderbar. Das Personal rotiert teilweise zwischen den
Werken, mal hier, mal da."

## Ausgangslage

`users` hat **kein** `plant_id`; Benutzer sind heute an kein Werk gebunden. Das Werk ist
bisher eine reine Datenzuordnung (Werkzeug, Serienartikel, Datenblatt, Ersatzteil,
Maschine). Damit fehlt dem System genau eine Information: **in welchem Werk steht dieser
Mensch gerade**. Ohne sie müsste er es in jedem Formular neu wählen, und niemand könnte
einordnen, wer wann für welches Werk gehandelt hat.

## Regel

1. **Das Werk ist ein Kontext, keine Eigenschaft.** Es ist eine augenblickliche
   Einstellung des Benutzers, kein Stammdatenfeld. Bei rotierendem Personal wäre ein
   Pflichtfeld am Benutzer fachlich falsch.
2. **Drei getrennte Begriffe** (nicht vermischen):
   - **Arbeitswerk** – wo der Benutzer *gerade* arbeitet (dieser Beschluss),
   - **Heimatwerk** – wem ein Werkzeug gehört (`tools.plant_id`, DEC-071),
   - **aktueller Ort** – wo ein Werkzeug *gerade* liegt (`tools.current_plant_id`,
     DEC-071).
3. **Gemerkte Wahl im Browser** (`localStorage`), in drei Stufen:
   1. Wahl dieses Benutzers auf diesem Rechner (`toolsync.plant.<personalnummer>`),
   2. sonst `users.default_plant_id` (optional, Pflege im Admin-Panel),
   3. sonst zuletzt gewähltes Werk dieses Rechners (`toolsync.plant.device`),
   4. sonst das erste Werk.
   Der Rechner-Schlüssel wird **nur** bei einer bewussten Umschaltung gesetzt, nicht
   beim bloßen Anmelden.
4. **Übertragung und Prüfung:** Jeder Request trägt `X-Plant-Id`. Das Backend prüft den
   Wert gegen `plants`. Ein unbekanntes Werk ist **HTTP 400** mit klarer Meldung – kein
   stiller Rückfall auf ein anderes Werk. Fehlt der Header, löst der Server über
   `default_plant_id` → erstes Werk auf.
5. **Das Arbeitswerk steuert** die Vorbelegung „Werk" in den Anlegeformularen, die
   Logistik-Ansicht (mein Ausgang / mein Eingang) und den **Nachweis** (Aufträge und
   Bewegungen speichern, welches Arbeitswerk gehandelt hat).
6. **Das Arbeitswerk filtert nichts.** Die bestehenden Werk-Filter in Werkzeugliste,
   Serienartikeln, Datenblättern und Ersatzteilen bleiben unverändert für alle Werke
   bedienbar. Es ist Bequemlichkeit und Nachweis, **keine** Zugangskontrolle.
7. **Sichtbarkeit ist Pflicht:** Das Arbeitswerk steht dauerhaft sichtbar in der Sidebar
   und in jedem Bestätigungstext („wird für **Werk 2** verschickt"). Die Speicherung ist
   nicht die Absicherung – die Sichtbarkeit ist es.
8. **Benutzer ohne Werk funktionieren unverändert** (`default_plant_id` ist nullable).
   Keine Migration von Bestandsdaten nötig.

## Was ausdrücklich NICHT gilt

- **Kein** Pflichtfeld: ein Benutzer muss kein Werk haben.
- **Keine** Speicherung des Arbeitswerks in der Datenbank (jeder Werkwechsel wäre ein
  Schreibvorgang, und zusätzlich bräuchte es „seit wann").
- **Keine** Kopien von Daten im Browser: gespeichert wird **nur** die Werk-Nummer, dazu
  die Benutzerkennung im Schlüssel. Keine Werkzeuglisten, kein Cache von Tabellen – damit
  entsteht keine zweite Datenhaltung.
- **Keine** Rechteverwaltung je Werk in dieser Ausbaustufe (siehe DEC-074).
- **Keine** Änderung an Login oder Sitzung: Personalnummer-Login und das rollierende
  Sitzungs-Token (TASK-013) bleiben unberührt.

## Offene Fragen

1. Soll das Arbeitswerk später auch die **Rechte** einschränken (nur eigene Werkzeuge
   ändern)? Heute ausdrücklich nicht (Punkt 6).
2. Soll bei einem Werkwechsel eine kurze Rückfrage erscheinen, wenn gerade ein Formular
   offen ist? Heute: nein, der Wechsel lädt die aktive Ansicht neu.

---

# DEC-071 – Heimatwerk und aktueller Ort eines Werkzeugs

**Status:** Verbindlich
**Bezug:** DEC-052 (Einzelzeilen je Exemplar), DEC-055 (Werkzeug-ID je Kategorie),
DEC-070 (Arbeitswerk), DEC-072 (Transport), Anforderung 3
**Auftrag des Projektinhabers:** „Wenn ich 01020000 nach Werk 2 schicke und Werk 2 hat
dieselbe ID schon eingelagert, sollen keine Konflikte entstehen – es ist 01020000 aus
Werk 1 und 01020000 aus Werk 2."

## Ausgangslage

`tools.plant_id` bedeutet heute faktisch „wem gehört es und wo liegt es" – beides in
einem Feld, und im Formular frei änderbar. Die Werkzeug-ID ist innerhalb
`tool_id + category + plant_id + is_storage` eindeutig (DEC-052/055). Sobald Werkzeuge
zwischen Werken wandern, muss klar sein, **welches** Werk in dieser Prüfung steht.

## Regel

1. **`tools.plant_id` heißt fachlich „Heimatwerk" und bleibt unverändert.** Die
   Eindeutigkeitsprüfung der Werkzeug-ID läuft weiterhin über dieses Feld → identische
   IDs in zwei Werken sind **kein** Konflikt (genau der Fall des Projektinhabers).
2. **Neu: `tools.current_plant_id`** (FK → `plants`, nullable). `NULL` heißt: das
   Werkzeug liegt in seinem **Heimatwerk**. Einen anderen Wert schreibt **ausschließlich**
   die Logistik (bestätigter Empfang, DEC-072).
3. **`position_id` bleibt der Heimatplatz** und wird durch Transporte **nie** verändert.
   Der Platz ist reserviert, solange das Werkzeug unterwegs ist („ausgeliehen nach W2",
   nicht belegbar für andere Werkzeuge).
4. **Anzeige:** Die Werkzeugliste zeigt das Werk nur bei Abweichung doppelt
   (`Heimat W1 · aktuell W2`); ohne Abweichung wie bisher ein Werk.
5. **Filter unverändert:** Die Werkzeugliste filtert weiterhin über `plant_id`
   (Heimatwerk) – ein Werkzeug erscheint also **nicht** plötzlich in zwei Listen.
   Für die Logistik gibt es eine eigene Abfrage über den **aktuellen Ort**.
6. **Nachweis:** `transport_items.home_position_id` hält den Heimatplatz zum
   Versandzeitpunkt fest, damit ein späterer Umbau der Matrix die Spur nicht zerstört.

## Begründung

- Die ID-Eindeutigkeit bleibt **genau dort**, wo sie heute ist → kein Risiko für
  Bestandsdaten, keine Änderung an `get_by_tool_id`, `get_all_by_tool_id`,
  `count_by_tool_id`.
- „Gehört zu" und „liegt gerade bei" sind zwei verschiedene Fragen. Sie in einem Feld zu
  führen wäre die nächste „zwei Wahrheiten"-Falle: die ID-Prüfung würde mit dem Werkzeug
  umziehen und Werk 2 würde ein fremdes Werkzeug als eigenes führen.
- Der Heimatplatz bleibt nach der Rückkehr gültig – ohne Umbau, ohne Umplatzierung.

## Was ausdrücklich NICHT gilt

- **Keine** Umbenennung von `tools.plant_id` (Feldname bleibt; die Bedeutung wird
  dokumentiert). Ein Umbenennen würde acht Abfragen und die gesamte Oberfläche berühren,
  ohne fachlichen Gewinn.
- **Kein** automatisches Setzen von `current_plant_id` beim Verschicken – erst der
  **bestätigte Empfang** ändert den Ort. Sonst gäbe es einen Zustand, in dem niemand weiß,
  ob das Werkzeug im LKW oder schon da ist.
- **Keine** zweite Heimat: ein Werkzeug hat genau ein Heimatwerk.
- **Kein** Anlegen eines Werkzeugs durch ein fremdes Werk mit fremdem Heimatwerk: wer
  anlegt, legt für sein Arbeitswerk an (weiterhin änderbar, weil das Feld schon immer frei
  war – aber die Vorbelegung kommt jetzt aus DEC-070).

## Offene Fragen

1. Soll ein Werk sein Heimatwerk **ändern** können (Werkzeug geht dauerhaft über)? Heute:
   nur bewusst über das Bearbeiten-Formular, kein Logistik-Vorgang.
2. Soll ein Werkzeug mit `current_plant_id != plant_id` in der **Matrix des aktuellen
   Werks** auftauchen? Heute: nein – dort erscheint es in der Ablage, die Reservierung
   steht in der Heimat-Matrix.

---

# DEC-072 – Werkzeug-Logistik: Auftrag, Transportweg, Empfang

**Status:** Verbindlich
**Bezug:** DEC-070 (Arbeitswerk), DEC-071 (Heimatwerk/aktueller Ort),
DEC-074 (Empfangsrecht), `docs/21-werkzeug-logistik.md`, `docs/08-tool-movement.md`
**Auftrag des Projektinhabers:** „Ein Button auf der Main Site ‚Werkzeug Logistik'. Im
Formular: Auftrags-Nr., Suche nach Werkzeugen (Stempel, Abstreifer, Matrize), die in
einem bestimmten Werk eingelagert sind, Auswahl, Liste der ausgewählten Werkzeuge,
Textfeld für Infos. Der Lagerplatz darf sich nicht ändern – es wird nur markiert, dass
das Werkzeug ausgeliehen ist. Das andere Werk bestätigt die Ankunft. Beim Zurückschicken
geht man in den Auftrag und drückt ‚Zurück schicken'."

## Ausgangslage

- Ein Werkswechsel ist heute **nicht** modelliert: `movement_type = "transfer"` ist
  wirkungslos (`docs/08` §2), `Tool.plant_id` ist ein Stammdatenfeld, und
  `MovementStatus.OPEN` wird von keiner Anwendungsschicht erzeugt – es gibt keinen
  Vorgang, der auf eine Bestätigung wartet.
- `ToolStatus.IN_TRANSIT` existiert bereits im Enum, wird aber nirgends gesetzt.

## Regel

1. **Ein Auftrag = eine Richtung.** Der Rückweg ist ein **eigener** Auftrag mit
   `parent_order_id` auf den Hinweg. Beide Richtungen sind derselbe Vorgangstyp, die
   Spiegelung entsteht dadurch von selbst (DEC-070).
2. **Zwei Entitäten:**
   - `transport_orders`: `order_number` (**Freitext**, führendes Feld in Liste und Suche,
     keine Validierung, keine Dublettenprüfung), `reference` (frei, z. B. Lieferschein),
     `from_plant_id`, `to_plant_id`, `status`, `info` (Freitext), `parent_order_id`,
     `created_by_id`, `sent_at`, `sent_by_id`, `closed_by_id`.
   - `transport_items`: `order_id`, `tool_id`, `home_position_id` (Nachweis, DEC-071),
     `received_at`, `received_by_id`, `received_plant_id` (Arbeitswerk der bestätigenden
     Person).
   - `tool_movements` erhält `transport_id` (nullable) und `plant_id` (nullable,
     Arbeitswerk).
3. **Statuswerte:** `draft → sent → partly_received → received`, dazu `cancelled`.
   `movement_type = "transfer"` bleibt die Bewegungsart im Verlauf.
4. **Beim Verschicken** (eine Transaktion):
   `order.status = sent`, `sent_at/sent_by_id`, `Tool.status = in_transit`, je Werkzeug
   ein Verlaufseintrag (`transfer`), `x-plant-id` als Nachweis.
   **`position_id` und `plant_id` bleiben unverändert** – der Heimatplatz ist reserviert.
5. **Beim Empfang** (eine Transaktion, je Werkzeug oder für alle):
   `item.received_at/received_by_id/received_plant_id`, `Tool.status = available`,
   `Tool.current_plant_id = to_plant_id` bei `to_plant_id != plant_id` (sonst zurück auf
   `NULL`), Verlaufseintrag, danach `partly_received` bzw. `received`.
6. **Verfügbarkeitsregeln** (serverseitig, nicht nur im Formular):
   - Nur Werkzeuge mit `status = available` sind wählbar. `lent`, `defective`,
     `maintenance` blockieren mit Begründung.
   - Ein Werkzeug darf in **höchstens einem offenen** Auftrag stehen (`draft` oder `sent`)
     – keine Doppelbuchung, keine zwei Werke mit derselben Anforderung.
   - Verschickt werden darf nur, was **aktuell im Arbeitswerk** liegt
     (`current_plant_id` bzw. `plant_id`) – die Suche zeigt alle Werke, gesperrte Zeilen
     sind sichtbar, aber nicht wählbar.
   - Werkzeuge **ohne** Heimatplatz (Ablage) dürfen mitfahren, dann ohne Reservierung.
7. **Storno:** Nur ein `draft`-Auftrag ist stornierbar (`cancelled`). Ein `sent`-Auftrag
   wird über einen Rück-Auftrag aufgelöst – niemand kann einen LKW zurückholen.
8. **Löschen ist nicht vorgesehen:** Aufträge werden storniert oder geschlossen, nicht
   gelöscht (Nachweis).
9. **Sichtbarkeit je Werk, gleiche Oberfläche:** Jeder sieht „mein Ausgang" (Absenderwerk =
   Arbeitswerk) und „mein Eingang" (Zielwerk = Arbeitswerk). Kein zweites Programm, keine
   zweite Datenhaltung – die Spiegelung ist eine Abfrage, keine Kopie.
10. **Konsistenz („zwei Wahrheiten"):** `Transport.status`, `transport_items.received_at`,
    `Tool.current_plant_id` und der Verlauf werden **in einer Transaktion** geschrieben und
    mit einem Konsistenztest geprüft (Muster: `backend/tests/test_platz_konsistenz.py`).

## Was ausdrücklich NICHT gilt

- **Keine** Anfrage vom Empfängerwerk („wir brauchen X") in dieser Ausbaustufe.
- **Kein** Anfordern von Material außerhalb der Logistik, keine Kostenstellen, kein Porto.
- **Keine** Änderung des Lagerplatzes durch einen Transport.
- **Kein** automatisches Zurückbuchen nach Fristablauf („Werkzeug ist zu lange weg") –
  das ist ein eigener Ausbauschritt.
- **Keine** Änderung an `Tool.plant_id` (Heimatwerk) durch die Logistik.
- **Kein** zweiter Verlauf: die Logistik schreibt in **denselben** `tool_movements`-Verlauf
  wie Ausleihe und Umplatzierung.

## Offene Fragen

1. Soll ein Empfänger ein Werkzeug **ablehnen** können (defekt angekommen)? Heute: nur
   Empfang oder Rück-Auftrag mit Notiz.
2. Soll eine Erinnerung erscheinen, wenn ein Werkzeug seit X Tagen unterwegs ist?
3. Sollen Aufträge gedruckt/als PDF ausgegeben werden (Lieferschein)? Heute: nein.
4. Soll die **Belegung** des Heimatplatzes nach dem Versand sichtbar gesperrt sein
   (`tool_id` bleibt gesetzt) oder soll der Platz mit einem Sonderzustand geräumt werden?

---

# DEC-073 – Reihenfolge: Arbeitswerk → Rückgabe → Logistik → Historie

**Status:** Verbindlich
**Bezug:** DEC-066 (TASK-025 angekündigt), DEC-070, DEC-072, `docs/14-architecture.md` §10
**Auftrag des Projektinhabers:** „So wie besser." (Reihenfolge nach Vorschlag)

## Regel

1. **TASK-030 – Arbeitswerk des Benutzers** (DEC-070). Fundament: ohne Arbeitswerk weiß
   die Logistik nicht, wer sendet und wer bestätigt.
2. **TASK-025a – Rückgabe und Benutzerzuordnung.** Die Ausleihe schreibt heute die
   Personalnummer als Klartext in die Notiz und `user_id` bleibt leer (Anforderung 9
   damit nicht erfüllt, `docs/08` §7); ein Rückgabe-UI fehlt vollständig, ausgeliehene
   Werkzeuge bleiben dauerhaft auf `lent`. Die Logistik braucht diese Grundbewegung
   zweimal (Rückweg, danach wieder „verfügbar").
3. **TASK-025b – Werkzeug-Logistik** (DEC-072).
4. **TASK-029 – Reiter „Historie" echt machen.** Zeigt Personen-Ausleihen **und**
   Werks-Transporte in einer Ansicht. Der Platzhalter bleibt bis dahin bestehen
   („Kein Löschen des Historie-Tabs", DEC-066).

## Begründung

- Jeder Schritt liefert dem nächsten eine Voraussetzung: Arbeitswerk → Werkzeug kommt
  zurück und wird verfügbar → Werkzeug wandert zwischen Werken → alles ist sichtbar.
- Alle Schritte benutzen dieselben Bausteine (Werk am Benutzer, Bewegung schreiben,
  Status pflegen, alles in einer Transaktion) und werden jeweils mit Tests belegt.

## Was ausdrücklich NICHT gilt

- **Keine** Zusammenlegung zu einem großen Umbau: jeder Schritt bleibt einzeln abnehmbar
  und liefert für sich einen Nutzen.
- **Kein** Anfassen der Logistik vor dem Arbeitswerk.

---

# DEC-074 – Empfangsbestätigung: Stufe 1 (Nachweis statt Recht)

**Status:** Verbindlich
**Bezug:** DEC-070 (Arbeitswerk), DEC-072 (Logistik), Anforderung 15
**Auftrag des Projektinhabers:** „Stufe 1."

## Regel

1. **Bestätigen darf, wer sein Arbeitswerk auf das Zielwerk gestellt hat.** Es gibt
   **keine** zusätzliche Rechteprüfung und **keine** Sonderrolle für Admins.
2. **Jede Bestätigung wird protokolliert:** Person (`received_by_id`), Arbeitswerk
   (`received_plant_id`), Zeitpunkt (`received_at`), dazu ein Verlaufseintrag mit
   `plant_id`. Damit ist nachvollziehbar, wer wann für welches Werk bestätigt hat –
   auch ohne Sperre.
3. **Der Absender sieht das Ergebnis:** Wer den Auftrag verschickt hat, sieht im Auftrag
   „bestätigt von <Name> · Werk <N> · <Zeitpunkt>".
4. **Das Arbeitswerk ist keine Zugangskontrolle** (DEC-070 Punkt 6): Es schränkt keine
   Daten ein, es ordnet nur zu.
5. **Bewusste Folge:** Da sich das Arbeitswerk jederzeit umstellen lässt (rotierendes
   Personal), kann theoretisch jeder bestätigen. Das ist eine bewusste Entscheidung des
   Projektinhabers für ein kleines, vertrautes Umfeld; der Nachweis ersetzt die Sperre.

## Was ausdrücklich NICHT gilt

- **Keine** Rollen- oder Rechteverwaltung je Werk (Stufe 3 wäre das).
- **Keine** Sperre „nur der Absender darf nicht bestätigen" – der Nachweis genügt.

---

# DEC-075 – Werkzeug-Logistik: Einordnung in die Main Site (Dropdowns, Fenster, Übersichtskarten)

**Status:** Verbindlich
**Bezug:** DEC-066 (Tab-Struktur), DEC-070 (Arbeitswerk), DEC-072 (Logistik-Vorgang),
`docs/21-werkzeug-logistik.md` § 8
**Auftrag des Projektinhabers:** „Das ist sehr unübersichtlich, zu viel belastet. Die
Aufträge sollen als Dropdown sein. Ich habe auf der Main Site rechts inaktive Blöcke:
Aktive Ausleihen, Verfügbare Werkzeuge, Lagerbestand, Serienartikel – vielleicht können wir
dort was platzieren und alle kleiner halten und mit Modal arbeiten. Die Demo ist schon gut,
aber sehr unklar, wie es im Main aussehen wird – vielleicht kannst du einen Entwurf von der
Main in die Demo packen."

## Ausgangslage

Die erste Demo zeigte die Logistik als **eine lange Seite**: alle Aufträge mit allen
Positionen gleichzeitig aufgeklappt, die Tabelle „Wo ist was" darunter, alles in einer
Spalte. Fachlich war es richtig, aber unbedienbar: man sieht nicht, welcher Auftrag zu
welchem Werkzeug gehört, und beim Suchen scrollt man an allem vorbei.

Die rechte Spalte der Main Site (`StatisticsSidebar` in `App.tsx`) zeigt vier
`.app-stat-card`-Karten mit dem Inhalt **„—"**: Aktive Ausleihen, Verfügbare Werkzeuge,
Lagerbestand, Serienartikel. Sie sind bisher reine Platzhalter.

## Regel

1. **Der Bildschirm zeigt Zeilen, nicht Details.** Ein Auftrag ist **eine Zeile**
   (Auftrags-Nr. · Zustand · Richtung · Anzahl · Datum) und **zugeklappt der Standard**.
   Erst ein Klick klappt Positionen und Aktionen auf (Dropdown). Die Liste ist damit auch
   bei 50 offenen Aufträgen lesbar.
2. **Alles Ausfüllbare und Erklärende liegt in einem Fenster (Modal):** Neuer Auftrag
   (Kopf, Suche, Auswahl), Empfang bestätigen, Zurück schicken, Auftrag öffnen (Nachweis),
   Regeln & Datentypen. Kein Formular steht dauerhaft auf der Seite.
3. **Nur zwei Tabellen bleiben sichtbar** – die beiden, die man vergleicht: „Wo ist was"
   (Bestand mit Heimatwerk, Heimatplatz, aktuellem Ort) und die Positionen eines
   **aufgeklappten** Auftrags. Beide kompakt: 12 px, einzeilig, ohne Doppelzeilen.
4. **Die rechte Spalte wird echt.** Die vier vorhandenen Karten bleiben an ihrem Platz und
   werden mit Zahlen und Klickzielen gefüllt:
   - **Eingang offen** → öffnet den Eingang, **Unterwegs** → Aufträge auf dem Weg,
     **Aktive Ausleihen** → Ausleihliste, **Verfügbare Werkzeuge** → Bestand des Arbeitswerks.
   - `Lagerbestand` und `Serienartikel` bleiben als Information stehen (Serienartikel
     zählt der eigene Bereich, nicht die Logistik).
   - Neue Karten werden **nicht** hinzugefügt; die Logistik nutzt die vier bestehenden.
5. **Das Arbeitswerk steht in der Sidebar** unter dem Benutzerblock (DEC-070) – sichtbar in
   allen Bereichen, nicht nur in der Logistik.
6. **Kein neuer Tab-Stil:** Die Logistik erscheint als Eintrag in der bestehenden
   Tab-Leiste (DEC-066) mit Zähler am Wort „Eingang". Der Reiter „Historie" bleibt
   Platzhalter, bis TASK-029 ihn füllt.
7. **Der Prototyp zeigt den Rahmen mit.** `docs/demo-werkzeug-logistik.html` bildet Sidebar,
   Tab-Leiste, rechte Spalte und Fenster nach, damit die Einordnung **vor** der Umsetzung
   beurteilt werden kann.

## Begründung

- Ein Auftrag mit 10 Werkzeugen belegt aufgeklappt einen halben Bildschirm. Als Zeile
  belegt er 32 Pixel – erst dadurch sind mehrere Aufträge vergleichbar.
- Die vier Karten sind heute die einzige leere Fläche der Main Site; sie zu füllen kostet
  keine neue Struktur und gibt der Logistik einen sichtbaren Ort außerhalb ihres eigenen
  Tabs („1 zu bestätigen" sieht man, ohne den Tab zu öffnen).
- Fenster statt Dauerformular: die Werkzeugsuche mit Sperr-Begründungen braucht Breite und
  Höhe (Tabelle mit 7 Spalten) – auf der Seite würde sie die Auftragsliste verdrängen.

## Was ausdrücklich NICHT gilt

- **Keine** neue Navigation und kein neues Menü (die Sidebar der Main Site hat außer
  Profil und Admin-Panel keine Navigation – das bleibt so, der Einstieg läuft über die
  Tab-Leiste).
- **Keine** Änderung an den bestehenden Tabs oder ihrer Reihenfolge (DEC-066).
- **Kein** Dashboard-Umbau: die vier Karten behalten Beschriftung und Reihenfolge.
- **Keine** ausgeklappten Aufträge als Standard – „alles offen" war genau der Fehler der
  ersten Demo.
- **Keine** zweite Werkzeugsuche in der Logistik: die Suche im Fenster „Neuer Auftrag"
  benutzt dieselben Bausteine wie die Werkzeugliste (Suche, Werk-Filter, Sortierung).

---

# DEC-076 – Werkfarbe: jedes Werk hat eine Farbe, das Arbeitswerk färbt die Oberfläche

**Status:** Verbindlich
**Bezug:** DEC-070 (Arbeitswerk), DEC-075 (Einordnung Main Site), `docs/15-ui-styleguide.md`
(Primary `#0f766e`), Vorbild: `customers.color` (Migration `d1a4f6b2c9e3`) und `machines.color`
(Migration `e7d1b9c34a52`)
**Auftrag des Projektinhabers:** „Wir müssen das alles farblich trennen, dass es klar und
deutlich wird. Wir haben generell die Primary-Farbe `#0f766e` – was ist, wenn sich beim
Werkswechsel diese Farbe ändert, also jedes Werk seine Farbe? Dann weiß man sofort, welches
Werk es ist."

## Ausgangslage

`plants` hat **keine** Farbe (`id`, `name`), Kunden und Maschinen haben eine. Alle Werke sehen
identisch aus: Wer „Werk 2" ist, erkennt man nur am Text. Beim Arbeiten über Werk-Grenzen
hinweg (Logistik) ist genau das die häufigste Verwechslung.

## Regel

1. **`plants.color`** (neu, `String(7)` = `#RRGGBB`, nullable) – **ohne** Farbe bleibt die
   bisherige Primärfarbe `#0f766e`. Pflege im Admin-Panel → Stammdaten → Werke (derselbe
   `ColorPicker` wie bei Kunden und Maschinen, inklusive „Keine Farbe").
2. **Das Arbeitswerk färbt die Oberfläche – ohne Kanten.** Die Farbe wird als CSS-Variablen
   gesetzt (`--werk`, `--werk-soft`, `--werk-line`) und wirkt an genau vier Stellen:
   Knopf `.btn-primary`, der **aktive Reiter**, der **Werk-Name** in der Sidebar und der
   **leise Schimmer der Werkzeug-ID** (Punkt 3). **Keine** farbigen Kanten an Karten,
   Tab-Leiste, Aufträgen, Dropdowns oder Fenstern – farbige Kanten zerschneiden das
   Glas-Design (Entscheidung des Projektinhabers, 2026-10).
3. **Die ganze Tabellenzeile trägt die Farbe ihres Werks.** Jede Zeile mit Werkzeugbezug
   (Auftragspositionen, Eingang, „Wo ist was", Auftragsdetail, Auswahl im Auftragsfenster,
   Verlaufszeilen) ist in `rgba(<Werkfarbe>, 0.14)` geflutet, beim Überfahren `0.20`.
   **Kein** Zebra in diesen Tabellen – die Zeilenfarbe ersetzt die Streifen. Ohne
   Werkzuordnung bleibt die Zeile neutral.
   **Verworfen (Entscheidung des Projektinhabers):** eine einzelne markierte **Zelle**
   (Werkzeug-ID) – sie sieht zwischen sechs neutralen Zellen wie ein Fremdkörper aus und
   zerreißt das Tabellenraster. **Verworfen:** 8,5 % – zu schwach, um die Herkunft zu zeigen.
4. **Jeder Werk-Name trägt seine eigene Farbe** – als farbiger Punkt mit Namen
   (`von **Werk 1** → an **Werk 2**`). Das gilt auch für fremde Werke in einer Ansicht:
   Der Name färbt sich nach dem Werk, **nicht** nach dem Arbeitswerk.
5. **Eine Farbe hat genau eine Bedeutung.** Die Werkfarbe steht **nur** auf Flächen, Knöpfen
   und Werk-Namen. Zustände behalten ihre eigenen Töne:
   `unterwegs` = Sky `#0284c7`, `empfangen/verfügbar` = Emerald `#047857`,
   `teilweise/defekt` = Amber `#b45309`, `storniert/ausgeliehen` = Slate `#475569`,
   Fehler = Rose `#be123c`.
6. **Startpalette** (in den Stammdaten änderbar):
   `Werk 1 = #0f766e` (Teal, bisheriges Primary) · `Werk 2 = #4338ca` (Indigo) ·
   `Werk 3 = #a16207` (Ocker). Grund für genau diese drei: Teal ist die Bestandsfarbe, und
   Indigo/Ocker sind deutlich von Skys Zustandsblau und Ambers Warnocker unterscheidbar,
   weil Werkfarben und Zustandsfarben nie dieselbe Rolle tragen.
7. **Kontrast:** Werkfarben werden für Text und dünne Ränder verwendet, deshalb mindestens
   4,5:1 gegen Weiß (gemessen: Teal 4,84 · Indigo 6,31 · Ocker 5,51). Ein Werk ohne Farbe
   fällt auf Slate `#475569` zurück.

## Was ausdrücklich NICHT gilt

- **Keine farbigen Kanten** – weder an Karten, Tab-Leiste, Aufträgen, Dropdowns noch am
  Fensterkopf. Die Werkfarbe färbt **Flächen und Text**, keine Linien.
- **Keine** Werkfarbe für Zustände (kein „Werk 2 ist unterwegs").
- **Keine** Farbe je Werk im Sinne einer Ampel („Werk 3 ist rot = schlecht") – die Farbe ist
  eine Kennung, keine Bewertung.
- **Kein** Farbtext auf der Werkzeug-ID – nur der Schimmer, sonst wirkt die Tabelle bunt.
- **Kein** Zwang: ein Werk ohne Farbe funktioniert unverändert.
- **Keine** Änderung an den bestehenden Farben von Kunde und Maschine.
- **Kein** neues Farb-Token im Guide: die Werkfarbe ist eine Variable, kein neuer Bauplan.

## Offene Fragen

1. Sollen Werkfarben auch die Matrix des Admin-Panels einfärben (Schrank-Kopf, Schubladen)?
2. Sollen Serienartikel und Datenblätter (beide mit Werk-Bezug) den Werkpunkt ebenfalls zeigen?
3. Soll die **leise ID-Markierung** auch in der Werkzeugliste erscheinen (dort ist die
   Werk-Spalte schon vorhanden)? Heute trägt sie jede Werkzeug-ID in der Logistik; die
   Entscheidung für die Werkzeugliste fällt mit dem Feinschliff von TASK-014.

## Umsetzung (Prototyp)

Im Prototyp `docs/demo-werkzeug-logistik.html` erprobt und geprüft (`.audit/pruefe-demo-logistik.mjs`):
Die Karten, Auftragszeilen, die Tab-Leiste und der Fensterkopf tragen **keine** farbigen
Kanten; die Werkfarbe wirkt an Knopf, aktivem Reiter, Werk-Namen und als **Zeilenfarbe**
(14 % / Hover 20 %) in allen Tabellen. Fünf Prüfungen sichern das ab: „keine Kantenregel im
Stylesheet", „kein `var(--werk)` in `.card`- oder `.drop`-Regeln", „die ganze Tabellenzeile
trägt die Farbe des Heimatwerks", „Hover-Stufe gesetzt", „kein Zebra mehr" und „Zeilenfarbe
in allen Ansichten vorhanden".

---

# DEC-077 – „Wo ist was" zeigt nur Unterwegs und Ausgeliehenes

**Status:** Verbindlich
**Bezug:** DEC-071 (Heimatplatz), DEC-072 (Transport), DEC-075 (Einordnung),
Anforderung 13 (Suche/Übersicht)
**Auftrag des Projektinhabers:** „Tab ‚Wo ist was' – hier sollen nur Werkzeuge angezeigt
werden, die unterwegs oder ausgeliehen sind, keine, die sich auf dem Platz befinden."

## Ausgangslage

Die Liste „Wo ist was" zeigte **alle** Werkzeuge (29 Stück) mit Heimatwerk, Heimatplatz und
aktuellem Ort. Damit wiederholte sie die Werkzeugliste: 16 von 29 Zeilen sind eingelagert und
sagen nichts Neues. Die eigentlich interessante Frage – *was ist gerade nicht da?* – ging
zwischen den anderen Zeilen unter.

## Regel

1. **Die Liste enthält ausschließlich Werkzeuge, die nicht an ihrem Platz liegen:**
   `status = lent` (an eine Person ausgeliehen) oder `status = in_transit` (zwischen Werken
   unterwegs). Eingelagerte Werkzeuge stehen in der **Werkzeugliste**.
2. **Zwei Zahlen in der Kopfzeile** („Alles (5) · Unterwegs (3) · Ausgeliehen (2)") als
   Segmente: sie filtern die Liste und zeigen gleichzeitig die Mengen.
3. **Spalte „Ist jetzt"** beantwortet die Frage in Worten: bei Ausleihe „beim Ausleiher",
   bei Transport das **Zielwerk in dessen Farbe** (DEC-076).
4. **Spalte „Auftrag / Ausleiher"** nennt den offenen Auftrag (anklickbar → Auftragsfenster)
   oder die Personalnummer des Ausleihers.
5. **Der Heimatplatz bleibt sichtbar** – aber als reserviert, nicht als Fundort (DEC-071).
6. Die Liste ist **werk-übergreifend** (kein Werk-Filter): die Frage „wo ist was" endet nicht
   an der Werk-Grenze.

## Was ausdrücklich NICHT gilt

- **Keine** Liste aller Werkzeuge an dieser Stelle (das ist die Werkzeugliste).
- **Kein** zusätzlicher Werk-Filter in dieser Liste – er wäre eine zweite Werkzeugliste.
- **Keine** Ersatzteile in dieser Liste (sie sind kein Leihobjekt und nicht unterwegs,
  DEC-064).

---

# DEC-078 – Rückgabe eines Werkzeugs an eine Person

**Status:** Verbindlich
**Bezug:** Anforderung 9/10 (Ausleihe/Rückgabe nachvollziehbar), DEC-070 (Arbeitswerk),
`docs/08-tool-movement.md` §7 (offener Punkt), TASK-025a aus DEC-073
**Auftrag des Projektinhabers:** „Rückgabe über das Zeilenmenü. Werkzeuge sollen auch
einzeln zurückgegeben werden." Und: „was brauchen wir noch: die Rückgabe je Werkzeug."

## Ausgangslage

Es gab **keine** Rückgabe in der Oberfläche. Ein ausgeliehenes Werkzeug blieb für immer auf
`lent`; die Rückgabe war nur über einen direkten API-Aufruf möglich (`docs/08` §7). Außerdem
schrieb die Ausleihe die Personalnummer als **Klartext** in die Notiz, und `user_id` blieb
leer – „welcher Benutzer hat ausgeliehen" war damit nicht auswertbar (Anforderung 9).

## Regel

1. **Rückgabe je Werkzeug über das Zeilenmenü.** Ist ein Werkzeug `lent`, bietet das Menü
   seiner Zeile **„Zurückgeben"** an (statt „Ausleihen"); jedes Werkzeug wird **einzeln**
   zurückgegeben. Eine Sammel-Rückgabe gibt es nicht – sie würde die Zuschreibung
   verwischen.
2. **Eigener Endpunkt** `POST /api/movements/return/{tool_id}` mit freiwilligem Body
   (`{"note": "…"}`). Der Router verlangt `require_active` – zurückgeben darf, wer arbeitet;
   ein Admin-Recht ist nicht nötig.
3. **Der Ausführende kommt aus dem Token, das Arbeitswerk aus `X-Plant-Id`.** Beides landet
   an der Bewegung (`user_id`, `plant_id`). Die Personalnummer wird **nicht** mehr als
   Klartext in die Notiz geschrieben (die Ausleihe schreibt sie ab jetzt ebenfalls nicht
   mehr).
4. **Eine Transaktion:** Werkzeug-Status auf `available`, Bewegung mit
   `movement_type = return`, `status = completed`, `from_location` = Heimatplatz
   (`03-C-02`) bzw. `Ablage`, `to_location` = Name des Arbeitswerks, Benutzer, Arbeitswerk.
5. **Nur Ausgeliehenes ist rückgabefähig.** Ein anderes Werkzeug führt zu **HTTP 400** mit
   Begründung („nicht ausgeliehen (aktueller Status: …)") – und zu **keiner** Bewegung.
6. **Der Heimatplatz bleibt unverändert** (DEC-071): Die Rückgabe ändert den Platz nicht,
   das Werkzeug steht danach wieder auf „verfügbar".
7. **Rückgabe-Liste** `GET /api/movements/active` liefert die laufenden Ausleihen des
   Arbeitswerks (Werkzeug, Platz, Ausleiher, Zeitpunkt). Sie ist die Grundlage für die
   spätere Logistik (DEC-072) und die Auswertung.
8. **Alle Bewegungen tragen jetzt das Arbeitswerk** (`tool_movements.plant_id`, Migration
   `c5e9f2b71d84`) – auch Ausleihe und Umbuchung, nicht nur die Rückgabe.

## Was ausdrücklich NICHT gilt

- **Keine** Sammel-Rückgabe („alle Ausleihen zurückgeben").
- **Keine** Pflicht-Notiz: der Zustand ist freiwillig; ein leeres Feld bleibt leer.
- **Kein** neuer Tab für die Rückgabe: sie sitzt im Zeilenmenü der Werkzeugliste, wo das
  Werkzeug ohnehin steht.
- **Keine** Änderung am Platz des Werkzeugs.
- **Keine** Rückgabe ohne angemeldeten Benutzer: der Vorgang ist personenbezogen.

## Offene Fragen

1. Soll die Rückgabe-Liste (`/movements/active`) einen eigenen Bildschirm bekommen („Was ist
   draußen") oder reicht die Werkzeugliste mit Statusfiltern?
2. Sollen überfällige Ausleihen markiert werden („seit 14 Tagen draußen")? Dafür fehlt eine
   Frist – das ist eine eigene Entscheidung.

---

# DEC-079 – Werkzeug-Logistik: Umsetzung (was die Regeln aus DEC-072 praktisch bedeuten)

**Status:** Verbindlich
**Bezug:** DEC-072 (Vorgang), DEC-074 (Empfang), DEC-075 (Einordnung), DEC-076
(Werkfarbe), `docs/21-werkzeug-logistik.md`, `tasks/25b-werkzeug-logistik.md`

## Ausgangslage

DEC-072 hat den Vorgang festgelegt, DEC-075 die Einordnung in die Main Site,
`docs/21` § 8 die Oberfläche. Bei der Umsetzung (TASK-025b) waren sieben Punkte zu
entscheiden, die die Vorgaben offen ließen oder sich in der Praxis anders anfühlen.

## Regel

1. **Der Eingang ist eine Leseansicht – bestätigt wird im Fenster.** `docs/21` § 8
   nannte für die Eingangs-Karte zwei Knöpfe („Nur angehakte bestätigen", „Alles
   angekommen"). Umgesetzt ist **ein** Knopf „Empfang bestätigen", der das Fenster mit
   den Häkchen öffnet. Zwei Stellen mit Auswahl (Karte **und** Fenster) wären zwei
   Wahrheiten über denselben Vorgang; DEC-075 Punkt 2 sagt außerdem, dass alles
   Ausfüllbare in einem Fenster liegt.
2. **Im Bereich „Logistik" gibt es keinen zweiten „+ Anlegen"-Knopf.** Der Knopf der
   Tab-Leiste entfällt dort; „+ Neuer Auftrag" steht im Bereich selbst, in der Farbe
   des Arbeitswerks. Zwei Knöpfe nebeneinander, die Verschiedenes tun, sind eine Falle.
3. **Der Rückweg bekommt die Nummer `…-R`** (`AUF-2026-0044-R`) und ist ein eigener
   Auftrag mit `parent_order_id`. Er lässt sich wie jeder Auftrag verschicken; das
   Heimatwerk bestätigt den Empfang, danach ist `current_plant_id` wieder `NULL`.
4. **Beziehungen werden nach dem Schreiben frisch gelesen** (`populate_existing`).
   Die Sitzung arbeitet mit `expire_on_commit=False`; ohne das Überschreiben meldete
   die Antwort nach dem Verschicken „verschickt von: –" und nach dem Empfang
   „bestätigt von: –", obwohl der Vorgang korrekt gespeichert war.
5. **Ein teilweise empfangener Auftrag blockiert seine eigenen Werkzeuge nicht.**
   Für den Rückweg zählt ein offener Auftrag nur, wenn er **nicht** der Auftrag ist,
   um den es gerade geht (`exclude_order_id`).
6. **Die Werkzeugliste sagt, wo das Werkzeug gerade ist:** Unter dem Heimatwerk steht
   „unterwegs" (solange es im Auftrag steckt) bzw. „ausgeliehen" (bei einer Person),
   und nach dem bestätigten Empfang „aktuell <Werk>" im Namen und in der Farbe des
   Werks, in dem es liegt (DEC-071/076). Der **Heimatplatz** darüber bleibt als
   reserviert stehen – er ist kein Fundort.
7. **Aufträge werden nicht gelöscht.** Ein Transport ist ein Nachweis; storniert wird
   im Entwurf, aufgelöst wird über den Rückweg. Deshalb braucht der Browser-Test eine
   **Datenbank-Kopie** statt eines Aufräum-Endpunkts.

## Begründung

- Ein Vorgang, der an zwei Stellen halb bedienbar ist, wird an beiden Stellen falsch
  bedient – die Häkchen auf der Karte waren in der Demo nur eine Abkürzung.
- Der Nachweis („wer hat wann was verschickt und bestätigt") ist der eigentliche Wert
  des Auftrags; ein Lösch-Endpunkt würde genau das wegwerfbar machen.

## Was ausdrücklich NICHT gilt

- **Kein** zweiter Bestätigungsweg auf der Seite (keine Häkchen in der Karte).
- **Kein** Lösch-Endpunkt für Aufträge und **keine** Bearbeitung nach dem Verschicken.
- **Keine** farbigen Kanten an Aufträgen, Karten oder Fenstern (DEC-076).
- **Kein** automatisches Verschicken: Anlegen und Verschicken bleiben zwei Schritte –
  dazwischen ist der Auftrag ein Entwurf, den man noch ändern kann.

## Offene Fragen

1. Rechte Spalte der Main Site füllen (offene Frage 7 in `docs/21`).
2. Matrix-Karte im Admin-Panel mit drittem Zustand „ausgeliehen nach W2".
3. Zeilenaktion „In Logistik öffnen" in der Werkzeugliste.

---

# DEC-080 – Werkzeugliste bleibt neutral, „Zustand"-Spalte entfällt, „kein Status" gilt als verfügbar

**Status:** Verbindlich
**Bezug:** DEC-076 (Werkfarbe), DEC-079 (Umsetzung), `docs/21` § 8,
`tasks/25b-werkzeug-logistik.md`
**Auftrag des Projektinhabers (nach der Bild-Abnahme):** „1. Soll die Werkzeugliste
auch nach Werk eingefärbt werden? **nein.** 2. Die Spalte ‚Zustand' im Auswahlfenster
ist fast überall ‚—'. Ich weiß nicht ganz, wofür dieser Status gut sein soll …
eigentlich unnötig?!"

## Regel

1. **Die Werkzeugliste behält Zebra und Bernstein für Favoriten.** Sie wird **nicht**
   als ganze Zeile in der Werkfarbe eingefärbt. Die Werkfarbe steht dort weiterhin nur
   am Werk-Namen: „unterwegs", „ausgeliehen" bzw. „aktuell Werk 2" in der Farbe des
   Werks, in dem das Werkzeug liegt (DEC-071/076). Begründung des Inhabers: die Liste
   ist nach Werkzeug sortiert, nicht nach Werk; zwei Ordnungsmuster (Zebra + Farbe)
   heben sich gegenseitig auf.
2. **Die Spalte „Zustand" entfällt** – im Fenster „Neuer Auftrag" **und** in den
   Auftrags-Tabellen (aufgeklappter Auftrag, Eingang-Karte, Nachweis-Fenster).
   - Im Auswahlfenster sagt die Spalte **„Hinweis"** bereits alles im Klartext
     („wählbar", „liegt in Werk 2", „unterwegs (AUF-12)", „bereits im Auftrag …").
   - In den Auftrags-Tabellen ist die eine Frage, ob das Werkzeug **angekommen** ist;
     das sagt die Spalte **„Empfang"** („ausstehend" / „da · Zeitpunkt").
3. **In „Wo ist was" bleibt die Zustandsmarke.** Dort ist der Unterschied
   *unterwegs* ↔ *ausgeliehen* die eigentliche Information, im Segment „Alles" auch
   die einzige Unterscheidung.
4. **„Kein Status" gilt als verfügbar.** `tools.status IS NULL` heißt „nichts
   Abweichendes bekannt" – nicht „gesperrt". Die Regel wirkt an drei Stellen:
   - **Ausleihe** (`MovementService`): erlaubt bei „nicht gesetzt **oder**
     `available`", setzt danach `lent`. Gesperrt bleibt, was einen gesetzten
     abweichenden Zustand hat (ausgeliehen, unterwegs, defekt, in Wartung).
   - **Filter und Sortierung** (`CRUDTool`): Der Filter „Verfügbar" schließt
     `status IS NULL` ein (`IN (…)` allein fände NULL nie), und die fachliche
     Sortierung stellt „ohne Status" auf denselben Rang wie „verfügbar".
   - **Anzeige:** das Admin-Dashboard zählt und markiert diese Werkzeuge als
     „Frei" statt „—".
5. **„Ohne Status" ist als Auswahl entfallen, „verfügbar" ist vorausgewählt.**
   Das Formular bietet nur noch die fünf Zustände; ein neues Werkzeug ist
   **verfügbar**, und ein alter Datensatz ohne Status wird beim Öffnen als
   „verfügbar" gezeigt (und beim Speichern so geschrieben). Der Bestand wurde
   einmalig nachgezogen: **14 Werkzeuge** aus dem Altsystem stehen jetzt auf
   `available`; `status IS NULL` kommt im Bestand nicht mehr vor. Die Regel aus
   Punkt 4 bleibt als Sicherheitsnetz im Code (kein Absturz, falls wieder ein
   leerer Wert entsteht).

> **Fallstrick, der beim Nachziehen aufgefallen ist:** Die Enum-Werte liegen in
> der Datenbank **groß** (`AVAILABLE`, `LENT` …), weil SQLAlchemy den Enum-Namen
> speichert. Ein `UPDATE … SET status = 'available'` schreibt einen Wert, den der
> ORM nicht mehr lesen kann. Das Nachziehen lief zuerst falsch und wurde sofort
> korrigiert (`'AVAILABLE'`). Für Datenänderungen dieser Art ist der Weg über die
> API/den Service der sichere.

## Begründung

Der Bestand kommt aus dem Altsystem: **14 von 16 Werkzeugen** haben keinen Status.
Solange die Ausleihe `available` verlangte, waren sie **stumm gesperrt** („ist nicht
verfügbar (aktueller Status: unbekannt)") – der Transport dagegen akzeptierte sie.
Diese Ungleichheit war der eigentliche Fehler, nicht das leere Feld. Mit der neuen
Regel trägt `status` nur noch die **Abweichungen**; „verfügbar" ist der Normalfall
und muss nicht gepflegt werden.

## Was ausdrücklich NICHT gilt

- **Keine** Zeilenfarbe in der Werkzeugliste (Antwort des Inhabers).
- **Keine** zweite Statusspalte in Logistik-Tabellen.
- **Kein** Entfernen des Feldes `tools.status` – es trägt die Abweichungen und die
  Sperren (Ausleihe und Transport).
- **Kein** Default `available` beim Anlegen: Bestehende Datensätze würden davon
  nicht erfasst, und ein gesetzter Wert behauptet eine Pflege, die es nicht gibt
  (offene Frage 2 bleibt eigenständig).

## Offene Fragen

1. Soll beim **Anlegen** über die API ein Default-Status gesetzt werden? Die
   Oberfläche sendet immer einen (vorausgewählt „verfügbar"), die API nimmt
   weiterhin `null` an – dann greift Punkt 4.

---

# DEC-081 – Drei Wünsche aus der ersten Bedienung: Auswahl, „Wo ist was", Rückgabe-Liste

**Status:** Verbindlich
**Bezug:** DEC-072 (Transport), DEC-077 („Wo ist was"), DEC-078 (Rückgabe je Werkzeug),
DEC-080 (Status), `docs/21` § 8, `tasks/25b-werkzeug-logistik.md`
**Auftrag des Projektinhabers:** „Aufgefallen: Beim Auftrag zum Verschicken sehe ich die
Werkzeuge vom anderen Werk, sie sind aber nicht wählbar – ist auch richtig so, aber dann
braucht man die nicht auflisten. Noch sehe ich keine Werkzeuge in ‚Wo ist was'. Dann soll
noch vielleicht ein Formular für ‚Werkzeug zurück', das dort nur die ausgeliehenen
Werkzeuge auflistet."

## Regel

1. **Die Auswahl im Fenster „Neuer Auftrag" zeigt nur Werkzeuge des Arbeitswerks.**
   Fremde Werkzeuge fallen ganz weg (`TransportService.candidates` filtert auf den
   aktuellen Ort). Werkzeuge **im eigenen Werk**, die gerade nicht dürfen (ausgeliehen,
   defekt, in Wartung, schon in einem Auftrag), bleiben sichtbar und nennen ihren Grund –
   dort ist die Frage „warum geht das nicht?" berechtigt.
   – *Damit ist DEC-072 Punkt 6 („Sperrgründe aller Werke sichtbar") überholt.*
2. **„Wo ist was" bleibt, was es ist: nur Unterwegs und Ausgeliehenes** (DEC-077). Eine
   leere Liste heißt „alles am Platz", nicht „Anzeige kaputt". Damit die Liste im
   Testbetrieb nicht dauerhaft leer ist, stellt das Saat-Skript einen **Demo-Zustand**
   her (`node .audit/seed-testdaten.mjs --zustand`): vier Ausleihen und ein Transport,
   der unterwegs bleibt.
3. **Es gibt ein Fenster „Werkzeug zurück"** (`components/logistics/ZurueckModal.tsx`),
   erreichbar über den Knopf **„Werkzeug zurück"** im Bereich **Logistik**, direkt neben
   **„+ Neuer Auftrag"**. Es listet **Werkzeuge aus anderen Werken, die hier liegen**
   (`GET /api/transport/borrowed`): Werkzeug-ID, Art · Typ · Maß, **Heimatwerk**, Heimatplatz
   und „hier seit" (letzter Empfang samt Auftragsnummer). Ein Knopf je Heimatwerk legt den
   Rück-Auftrag an **und meldet ihn gleich als unterwegs**; das Heimatwerk bestätigt den
   Empfang wie jeden Eingang.
   *Korrektur des Inhabers:* „So war das nicht gemeint mit Werkzeugen zurück … der
   jeweilige Werk schickt die Werkzeuge zurück." Gemeint ist also **nicht** die Rückgabe an
   eine Person (die bleibt im Zeilenmenü, DEC-078), sondern der Rückweg zwischen Werken –
   ohne dass jemand den Auftrag suchen muss, mit dem die Werkzeuge einmal kamen.
5. **Das Fenster bedient sich wie die übrigen Fenster der Logistik** (Nachtrag des
   Inhabers: „Suchleiste rein, ESC, soll identisch sein, Tooltip"):
   - **Suche** über ID, Art, Typ, Maß und Heimatwerk, mit Treffer-Zähler
     („3 Treffer · 2 ausgewählt"); die Suche bleibt nach dem Zurückschicken stehen.
   - **Filter je Heimatwerk** als Reiter-Gruppe – nur wenn Werkzeuge aus mehr als einem
     Werk vorliegen.
   - **Auswahlhilfen** „Alle auswählen" (alle **sichtbaren**) und „Auswahl aufheben";
     der Zurückschicken-Knopf nennt die Anzahl und ist ohne Auswahl gesperrt.
   - **Escape schließt** das Fenster (auch mit dem Fokus im Suchfeld). Aufbau, Abstände,
     Knopfreihenfolge und Fehlerhinweis entsprechen Empfang/Nachweis/Neuem Auftrag.
   - **Tooltips** (`title=`) an Knöpfen und Werten (Heimatplatz, „hier seit"). An
     **Eingabefeldern** bleiben sie verboten – die Beschriftung trägt die Information
     (`docs/15-ui-styleguide.md` § Formulare).
4. **Beide Richtungen sind gleichwertig.** Jedes Werk kann zurückschicken, was es von einem
   anderen hat; es gibt kein „holen" beim anderen Werk. Unterwegs und ausgeliehene
   Werkzeuge stehen dabei **nicht** in der Liste – sie liegen nicht mehr im Regal, auch
   wenn `current_plant_id` erst beim Empfang wechselt.

## Begründung

- Eine Zeile, die man nicht anhaken kann, ist Ballast: Sie beantwortet keine Frage, die
  der Benutzer in diesem Fenster hat („was kann ich mitschicken?"). Der Sperrgrund bleibt
  dort stehen, wo er eine Entscheidung trägt – bei den Werkzeugen des eigenen Werks.
- Der Rückweg zwischen Werken darf nicht am alten Auftrag hängen: „Der jeweilige Werk
  schickt die Werkzeuge zurück" heißt, dass das **haltende** Werk die Liste sieht und
  handelt. Das ist symmetrisch – jedes Werk schickt, jedes Werk bestätigt.

## Was ausdrücklich NICHT gilt

- **Kein** „Holen" beim anderen Werk (keine Anforderung, kein Fernauftrag).
- **Keine** Sammel-Rückgabe an Personen – die Rückgabe an eine Person bleibt je Werkzeug
  im Zeilenmenü (DEC-078).
- **Kein** Anzeigen fremder Werkzeuge im Auftragsfenster (auch nicht ausgegraut).
- **Kein** Füllen von „Wo ist was" mit verfügbaren Werkzeugen – dafür gibt es die
  Werkzeugliste.

## Offene Fragen

1. Soll die Rückgabe-Liste zusätzlich als Karte in der rechten Spalte der Main Site
   auftauchen („3 ausgeliehen", Klick öffnet sie)? Offene Frage 7 in `docs/21`.

---

# DEC-082 – Kosmetik der Logistik: Sprache, Abstände, Zustände

**Status:** Verbindlich
**Bezug:** DEC-075 (Dichte), DEC-076 (Werkfarbe), DEC-081 (Fenster), `docs/15-ui-styleguide.md`
**Auftrag des Projektinhabers:** „Jetzt die Kosmetik der Logistik – schau, wie und was
gemacht werden kann und muss." (nach dem ersten Durchklicken)

## Regel

1. **Sprache: richtige Plurale.** „1 Werkzeug / 3 Werkzeuge", „1 Auftrag / 3 Aufträge"
   (`lib/format.ts`). Das alte „Werkzeug(e)" stand an neun Stellen – eine Schreibweise,
   die für jede Zahl passt und deshalb nie richtig klingt.
2. **Abstände wie in den übrigen Bereichen.** Karten `p-5` (vorher `p-4`), Abstand
   zwischen Karten `space-y-4` (vorher `space-y-3`), Unterleiste der Logistik
   `px-3 py-1.5` wie die Haupt-Tab-Leiste (vorher `py-2`). Die Logistik soll sich nicht
   enger anfühlen als Werkzeuge/Serienartikel.
3. **Ein Leerzustand für alle Ansichten** (`Leerzustand` in `logistikTeile.tsx`):
   dieselbe ruhige Fläche, ein Satz, optional ein Hinweis auf den nächsten Schritt.
   Vorher hatte jede Ansicht ihre eigene Form (gepolsterte Fläche, nackter Satz,
   Tabellenzeile).
4. **Zustände sind unterscheidbar.** „storniert" ist ein **Umriss** ohne Fläche
   (erledigt/verfallen), „Entwurf" bleibt gefüllt (geplant); der „Rückweg" bekommt eine
   eigene Marke mit ↩-Zeichen statt desselben Graus. Vorher sahen alle drei gleich aus.
5. **Aktionen tragen ein Zeichen wie überall sonst:** „Neuer Auftrag" mit `AddIcon`
   (statt eines getippten „+"), „Werkzeug zurück" mit neuem `ReturnIcon` (Lucide `Undo2`).
   Ein Zeichen hat genau eine Bedeutung – `ResetIcon` heißt weiterhin „Filter
   zurücksetzen", `LoginIcon` „Abmelden".
6. **Ankreuzfelder tragen die Werkfarbe** (`accent-color: var(--werk)`), damit das native
   Blau des Browsers nicht als Fremdfarbe dazwischenfunkt.
7. **Nur eine verschachtelte Fläche, nicht drei.** Ein Block in einem Block bekommt
   **einen** eigenen Schleier mit weißer Haarline: `border border-white/60 bg-white/30`
   (das Muster, das die Leerzustände und die Werkzeugliste schon nutzen). Vorher lagen in
   der Logistik bis zu **drei** weiße Schichten übereinander (Karte `white/48` →
   Zeilencontainer `white/35` → Tabellenhülle `white/35`) – die Werkfarben-Tönung der
   Zeilen wirkte dadurch milchig. Gemessene Ebenen jetzt: Zeile `rgba(Werkfarbe, .14)` →
   Container `white/30` → Karte `white/48` → Seite.
8. **Abstände im Dropdown auf demselben Rhythmus wie überall.** Kopfzeile `px-2.5 py-2.5`
   (40 px statt 36), aufgeklappter Körper `space-y-3 px-2.5 pt-1 pb-3` (12-px-Rhythmus
   statt 8 px und **mit** Abstand zur Kopfzeile), Zellen `px-2.5 py-1.5` statt `px-2`,
   Tabellenkopf `bg-white/60` statt `45 %` (er muss sich von der Fläche abheben).
9. **Kein Text unter 12 px.** Die Richtungsmarke („Ausgang/Eingang") und die
   Nachweiszeile standen auf `text-[11px]`; jetzt `text-xs` (Guide §1.8: 12 px ist die
   Untergrenze). Spaltenköpfe bleiben als Mikro-Beschriftung bei 10 px.

## Begründung

Die Logistik war funktional fertig, aber in Text und Abständen „neben" der App: andere
Innenabstände, „Werkzeug(e)", drei verschiedene Leerzustände und zwei Zustände mit
demselben Grau. Das sind lauter kleine Abweichungen, die zusammen den Eindruck machen,
der Bereich sei nicht von derselben Hand gebaut.

## Was ausdrücklich NICHT gilt

- **Keine** neue Schriftgröße für Tabellenköpfe: 10 px in Großbuchstaben ist im ganzen
  Projekt die Marke für Spaltenköpfe und Mikro-Badges (14 Dateien) – die Logistik bleibt
  dabei.
- **Kein** Tooltip an Eingabefeldern (Styleguide § Formulare) – nur an Knöpfen und Werten.
- **Keine** farbigen Kanten (DEC-076) – der „storniert"-Umriss ist neutralgrau, nicht
  werkfarben.

---

# DEC-083 – Stempel-Beschichtung als eigene Stammdatenliste (Dachmarke MultiDur)

**Status:** Verbindlich
**Bezug:** DEC-055 (Stempel werden über ihre ID geführt), `docs/05-tools.md`,
`docs/09-admin-panel.md`
**Auftrag des Projektinhabers:** „In AdminPanel soll noch form für Stammdaten angelegt
werden ‚Stempel Beschichtung' – Beschichtungen unter der Dachmarke MultiDur: MultiDur
TiCN, MultiDur Performance und MultiDur Alu. Und ein Dropdownmenü in dem Anlege-Formular
in Werkzeuge Stempel neben dem Lager/Ersatz mit trennen."
**Nachtrag des Inhabers:** „Kannst du sofort anlegen – und eins ‚Standard' und
vorauswählen."

## Regel

1. **Die Beschichtung ist eine eigene Stammdatenliste** (`coatings`, Admin-Panel →
   Stammdaten → „Stempel-Beschichtung"), nicht ein Freitextfeld und **keine**
   Marken-Tabelle. Gepflegt wird der vollständige Name („MultiDur TiCN"); solange es
   **eine** Dachmarke gibt, wäre eine zweite Ebene (Marke → Variante) eine leere Spalte
   in jeder Zeile.
2. **Ein Werkzeug hängt mit `coating_id` an der Zeile** (freiwillig, `SET NULL`). Eine
   gelöschte Beschichtung nimmt keinen Stempel mit – dieselbe Regel wie bei `machines`
   und `customers`. Eine Umbenennung ändert nur die Bezeichnung.
3. **Fachlich gehört die Beschichtung zum Stempel.** Im Anlege-/Bearbeitungs-Formular
   steht das Dropdown deshalb **nur bei Kategorie Stempel**; beim Wechsel auf
   Abstreifer oder Matrize verschwindet das Feld und der Wert wird verworfen (statt
   unsichtbar gespeichert zu bleiben). Zurück beim Stempel steht wieder „Standard".
4. **Platz im Formular: in der Kopfzeile neben „Lager/Ersatz", mit eigener senkrechter
   Trennlinie.** Der Platz dafür kommt aus dem **Seitenraster**, nicht aus einem
   gekürzten Namen: Inhalt `xl:col-span-10`, Statistik-Sidebar `xl:col-span-2`, kein
   `max-w`-Deckel (Punkt 9).
   **Gemessen (alle mit dem vollen Namen „MultiDur Performance"):** bei 9/12
   Inhaltsspalte war die Kopfzeile innen 826 px breit, das Feld brauchte 857 px →
   Umbruch. Mit 10/12 sind es **955 px** bei 1920 px Fensterbreite (jetzt 1008 px,
   seit der Deckel weg ist): das Feld steht einzeilig (Zeile 63 px hoch). Unter etwa
   1700 px Fensterbreite bricht die Zeile als **eine** Einheit um (Kategorie oben,
   Lager/Ersatz + Beschichtung darunter) – nicht das Feld allein.
5. **Der volle Name wird überall angezeigt** („MultiDur TiCN", „MultiDur Performance").
   Ein Kurzname ohne Dachmarke („TiCN") war zwischenzeitlich eingebaut, um die
   Kopfzeile zu retten; er ist **entfallen** (Nachtrag des Inhabers: „leider wird nicht
   MultiDur angezeigt, nicht bei der Dropdown und nicht in der Liste"). Die Breite wird
   über den Platz gelöst (Punkt 4 und 9), nicht über gekürzte Namen.
6. **„Standard" ist die Vorgabe, ein leeres Feld gibt es nicht.** Ein neuer Stempel
   bekommt die Beschichtung „Standard" vorbelegt; sie steht für den Stempel ohne
   besondere Beschichtung. Die Option „Ohne Beschichtung" ist **entfallen** (Nachtrag
   des Inhabers) – sie war eine zweite Bedeutung für denselben Zustand. Auch ein
   alter Stempel ohne Beschichtung (`NULL`) zeigt „Standard", damit das Feld nicht
   die erste Zeile anzeigt, während im Datensatz nichts steht. Die Vorgabe hängt am
   Namen, nicht an einer ID: heißt die Zeile nach einer Umbenennung nicht mehr
   „Standard", wird die erste gepflegte Beschichtung gezeigt – der Admin hat die
   Liste dann selbst umbenannt.
7. **Startdaten** (Migration `b5e2d8c41f97`): „MultiDur TiCN", „MultiDur Performance",
   „MultiDur Alu" und „Standard". Eingefügt wird nur, solange die Tabelle leer ist –
   eine gepflegte Liste bleibt unangetastet.
8. **In der Werkzeugliste steht der volle Name in der Kategorie-Zeile**
   („Stempel · MultiDur TiCN", bei Lager/Ersatz „Stempel · Lager/Ersatz · MultiDur
   Performance"). Gemessen: mit 9/12 Inhaltsspalte wären dafür 913 px nötig gewesen,
   der Bereich war 815 px breit (Überlauf bei 1440) – deshalb stand der Name
   zwischenzeitlich in einer eigenen Zeile. Mit 10/12 ist der Bereich bei 1440 px
   **913 px** breit: es paßt ohne seitlichen Überlauf, die Zeilen bleiben zweizeilig.
   Unter 1440 px scrollt die Tabelle seitlich – das war auch vorher schon so.
9. **Seitenraster: ein Kantenmaß, kein Deckel.** `main` ist nicht mehr auf
   `max-w-[1600px]` gedeckelt und nicht zentriert; die Statistik-Sidebar rechts
   schrumpft von 3 auf 2 Zwölftel. Grund (Nachtrag des Inhabers: „Abstands-Unterschiede
   zwischen Sidebar und Blöcke sind unterschiedlich"):
   **gemessen vorher** – Rand links 24 px, Rasterlücke 20 px, Rand rechts 24 px; ab
   1840 px Fensterbreite wuchs der Außenrand durch den Deckel auf 64 px (1920) bzw.
   384 px (2560), während die Rasterlücke 20 px blieb. **Jetzt:** 24 / 24 / 24 px an
   jeder Fensterbreite; vertikal überall `space-y-4` = 16 px, auch zwischen den
   Statistik-Karten (vorher 12 px gegen 16 px). Inhaltsbreite 1020 px (1280) ·
   1152 (1440) · 1353 (1600) · 1620 (1920) · 2153 (2560). Der Verzicht auf den Deckel
   ist der Preis für gleiche Abstände: mit Deckel gibt es zwangsläufig toten Raum, und
   der liegt dann entweder rechts oder an beiden Außenkanten – nie zwischen den Blöcken.
   Werkzeug-Ablage und Logistik bleiben inhaltlich unverändert.

## Begründung

Die Beschichtung ist eine Produkteigenschaft des Stempels (MultiDur als Dachmarke des
Herstellers) und wird in der Werkstatt gleichgesetzt mit dem Stempel selbst. Ein
Freitextfeld würde „TiCN", „ticn" und „MultiDur TiCN" nebeneinander entstehen lassen;
eine Marken-Hierarchie wäre bei einer Marke reine Zeremonie. Die Liste ist deshalb
flach und pflegbar – und weil sie fast immer dieselbe Antwort hat, ist der häufigste
Fall vorausgewählt.

## Was ausdrücklich NICHT gilt

- **Kein** Pflichtfeld: ohne Beschichtung bleibt der Stempel vollständig (viele Stempel
  laufen ohne besondere Beschichtung) – im Formular steht dafür „Standard", nicht ein
  leeres Feld.
- **Keine** Farbcodierung je Beschichtung – die Werkzeugliste trägt Farben nur für
  Kategorie (Chip) und Kunde (Punkt), DEC-080 gilt unverändert.
- **Keine** Beschichtung für Abstreifer und Matrize (Punkt 3).

---

# Ende der Projektentscheidungen

---

# DEC-084 – Jeder Auftrag ist eine eigene Karte (die Liste war „ein Block")

**Status:** Verbindlich
**Bezug:** DEC-075 (Zeilen statt Details), DEC-082 (Kosmetik), `docs/21` § 8,
`docs/demo-werkzeug-logistik.html` (`.drop`)
**Auftrag des Projektinhabers:** „In Aufträge die Dropdowns: sieht alles wie ein Block
aus. Sehr unklar für einen neuen Benutzer! Schau, wie man es am besten und logischer macht,
auch Kosmetik anpassen. Gilt auch für andere Bereiche in Logistik."

## Ausgangslage

Die Auftragsliste stand in **einem** Container; die Aufträge waren nur durch eine
Haarlinie getrennt (`border-b`). Aufgeklappt wuchs der Inhalt im selben Block – von außen
war nicht zu erkennen, wo ein Auftrag endet und der nächste beginnt, und dass eine Zeile
überhaupt aufgeht, verriet nur ein kleines Dreieck am rechten Rand.

Der abgenommene Prototyp hatte es anders gelöst (`.drop`: eigene Karte je Auftrag, Kopf
mit Aufklapp-Zeichen, Körper mit eigener Fläche und Trennlinie). Die Umsetzung war davon
abgewichen.

## Regel

1. **Ein Auftrag = eine Karte:** `rounded-xl border border-white/60`, 8 px Abstand
   zwischen den Karten (`space-y-2`). Kein gemeinsamer Container mehr.
2. **Kopf und Körper sind getrennt:** Der Körper liegt auf einer eigenen, etwas tieferen
   Fläche (`bg-white/30`) mit Trennlinie zum Kopf (`border-t border-white/70`).
3. **Die Karte zeigt, dass sie offen ist:** offen `bg-white/55`, zu `bg-white/35` mit
   Hover `bg-white/50`.
4. **Der Aufklapp-Hinweis ist Text, nicht nur ein Dreieck:** rechts „**Details**" bzw.
   „**Zuklappen**" mit Chevron (dreht sich). „Zuklappen" statt „Schließen", damit es nicht
   mit dem Schließen der Fenster verwechselt wird.
5. **Dieselbe Sprache im Eingang:** Jede Eingangs-Karte hat ebenfalls einen abgesetzten
   Kopf (Nummer, Zustand, von → an) mit Trennlinie, darunter den Inhalt auf eigener
   Fläche. „Wo ist was" bleibt eine Tabelle – sie **ist** eine Liste mit Kopfzeile.

## Begründung

Ein neuer Benutzer liest eine Liste als Abfolge von Einträgen, wenn jeder Eintrag eine
eigene Form hat. Eine Haarlinie in einem gemeinsamen Block ist eine Feingliederung für
geübte Augen – für den ersten Blick ist sie keine Grenze. Die Karte kostet rund 10 px
Höhe je Auftrag; bei den üblichen 5–20 Aufträgen ist das der bessere Handel.

## Was ausdrücklich NICHT gilt

- **Keine** Zebra-Streifen als Ersatz für die Karten (DEC-076: Farbe ist Ordnung, zwei
  Muster heben sich auf).
- **Keine** farbigen Kanten an den Karten – die Haarline bleibt weiß (DEC-076).
- **Kein** Aufklappen mehrerer Aufträge „von selbst": zugeklappt bleibt der Standard
  (DEC-075 Punkt 1); die Liste klappt nur den Auftrag auf, den man angeklickt hat.

---

# DEC-085 – Datenblatt ohne Werk: gilt für alle Werke

**Status:** Verbindlich
**Bezug:** DEC-065 (Datenblatt), DEC-070 (Arbeitswerk), `docs/20-datenblatt.md`,
`tasks/24-ersatzteile-und-datenblatt.md`
**Auftrag des Projektinhabers:** „Wenn ich ein Datenblatt anlegen will, was nichts mit
Werkzeugen zu tun hat – z. B. eine allgemeine Info –, muss ich ein Werk auswählen. Die Info
soll aber für beide Werke gehen."

## Ausgangslage

`data_sheets.plant_id` war `NOT NULL` und im Formular ein Pflichtfeld („Pflicht ist nur das
Werk", DEC-065). Damit ließ sich keine allgemeine Information ablegen: Eine
Bedienungsanleitung oder ein Prozesshinweis gilt für **alle** Werke, nicht für eines.

## Regel

1. **Das Werk ist freiwillig.** `plant_id` ist nullable; **`NULL` = gilt für alle Werke.**
   Im Formular steht die Auswahl auf „**Alle Werke (allgemein)**", das Feld ist nicht mehr
   Pflicht und lässt sich auch wieder leeren (vorher blieb ein gesetztes Werk stehen).
2. **Ein Datensatz für alle Werke erscheint in jedem Werk.** Der Listenfilter auf ein Werk
   schließt `plant_id IS NULL` ausdrücklich **ein** (der Join auf `plants` wird zum
   `LEFT JOIN`, sonst fiele die Zeile aus jeder Liste).
3. **Die Liste sagt es:** In der Spalte „Werk" steht **„Alle Werke"** – ein Strich sähe
   aus wie „fehlt noch".
4. **Ein *angegebenes* Werk muss weiter existieren** (gleiche Prüfung wie bei der Maschine);
   ein unbekanntes Werk bleibt ein Fehler, kein stiller Datensatz.
5. **Die Maschine braucht ein Werk.** Ohne Werk ist die Maschinenauswahl gesperrt
   („nur mit Werk wählbar") – eine Maschine gehört zu genau einem Werk.

## Begründung

Ein Datenblatt beantwortet „wie richte ich das ein". Für eine allgemeine Info („wie wird
der Prüfstand gehalten") ist das Werk keine sinnvolle Angabe: Wer sie in Werk 2 braucht,
fände sie sonst nicht. Alle übrigen Angaben des Datenblatts waren schon freiwillig
(Werkzeug-ID, Maschine, Name) – das Werk war die letzte Pflicht, die fachlich nicht trägt.

## Was ausdrücklich NICHT gilt

- **Keine** Auswahl „beide Werke" (Mehrfachzuordnung): `NULL` heißt *alle* – auch wenn ein
  drittes Werk dazukommt. Eine Liste von Werk-IDs müsste bei jedem neuen Werk nachgepflegt
  werden.
- **Kein** Aufweichen der Werk-Pflicht bei **Serienartikeln** und **Ersatzteilen**: dort
  gehört der Datensatz zu einem Werk, weil er über die Artikelnummer im Werk gesucht wird.
- **Keine** Änderung an bestehenden Datensätzen – sie behalten ihr Werk (Migration setzt
  nichts um).

---

# DEC-086 – Logistik als eigener Knopf; gleiche Spalten in den Auftragsköpfen

**Status:** Verbindlich
**Bezug:** DEC-066 (Tab-Leiste), DEC-075 (Einordnung), DEC-084 (Karte je Auftrag),
`docs/21` § 8
**Auftrag des Projektinhabers:** „Auf der Hauptseite im Tabmenü ist der Logistik-Knopf –
der muss separat stehen und deutlich sein. Und in der Logistik sind die Dropdowns und die
Info (Auftragsstatus, Ausgang, Werk …) – bitte anpassen, dass es gleich aussieht, wenn sie
untereinander stehen, und zwar in den anderen Tabs auch."

## Ausgangslage

1. „Logistik" stand als **sechster Reiter** in derselben Leiste wie Werkzeuge,
   Serienartikel, Datenblätter, Ersatzteile und Historie – fachlich ein anderer Bereich
   (Bewegung zwischen Werken statt Stammdaten), optisch aber nicht zu unterscheiden.
2. Die Kopfzeilen der Aufträge waren `flex-wrap`: Jede Angabe stand dort, wo ihre Breite
   es zuließ. Bei mehreren Aufträgen untereinander begann der Status in jeder Karte an
   einer anderen Stelle, die Werke ebenso – die Liste wirkte unruhig, obwohl jede Zeile für
   sich ordentlich war.

## Regel

1. **„Logistik" steht neben der Reiter-Gruppe, nicht in ihr.** Eigener Knopf
   (`.tab-logistik`), durch einen **Trennstrich** (1 × 24 px) von den Reitern getrennt,
   mit eigenem Zeichen (`TruckIcon`, Lucide `Truck`). Im Ruhezustand eine helle Pille mit
   Rand, im **aktiven** Zustand Fläche in der **Werkfarbe** mit weißer Schrift;
   `aria-pressed` nennt den Zustand.
   **Nachtrag (Schrift):** Der Knopf trägt **dieselbe Schriftstärke wie die Reiter
   (`font-weight: 700`, `font-size: 0.72rem`)**. Zwischenzeitlich stand dort 800 – der
   Inhaber: „weil wenn ich font-weight: 800 ausschalte, gefällt mir es sehr." Die
   Unterscheidung leisten Form (eigene Pille), Zeichen und Trennstrich; die schwerere
   Schrift machte den Knopf nur lauter als die ganze Leiste. Ein Browser-Test hält beide
   Werte fest (`tests/logistics.spec.ts`, „Logistik steht als eigener Knopf …").
2. **Feste Spalten in den Auftragsköpfen** (`.kopf-auftrag`, ab 900 px Breite):
   **Nr (7,5 rem) · Zustand (6,75 rem) · Rückweg (6,5 rem) · Werke (flexibel) · rechts
   Anzahl/Datum/Details**. Der „Rückweg"-Platz bleibt auch leer erhalten, damit die
   Spalten nicht verrutschen; der rechte Block schließt bündig am Rand ab.
3. **Der Eingang nutzt dieselben zwei festen Spalten** (`.kopf-eingang`):
   Nr (7,5 rem) · Zustand (6,75 rem) · Werke. Damit liegen Auftragsliste und Eingang
   untereinander auf denselben Linien.
4. **Schmale Fenster** (< 900 px): kein Raster, sondern `flex-wrap` – sonst liefen die
   festen Spalten über den Rand.
5. **Die Richtung wird zur Werke-Angabe gezogen** („AUSGANG Werk 1 → Werk 2"), damit die
   Spaltenzahl klein bleibt und die Zeile auch bei 900 px noch passt.

## Begründung

Der Bereich „Logistik" wird gesucht, nicht gefunden – wer Werkzeuge verschicken will,
denkt nicht in Stammdaten-Reitern. Ein eigener Knopf mit Zeichen und Werkfarbe ist ohne
Lesen zu finden. Und eine Liste, in der gleichartige Angaben untereinander auf denselben
Linien liegen, ist schneller zu vergleichen als eine, in der jede Zeile ihre eigene
Ordnung hat – bei den Karten (DEC-084) fällt das besonders auf.

## Was ausdrücklich NICHT gilt

- **Keine** neue Navigationsleiste oder ein zweites Menü: Es bleibt **eine** Leiste, der
  Knopf sitzt nur außerhalb der Reiter-Gruppe.
- **Keine** Änderung an den übrigen Reitern und ihrer Reihenfolge (DEC-066).
- **Keine** Werkfarben-Kante am Knopf (DEC-076) – die Farbe steht als Fläche.

---

# DEC-087 – Fenster: Esc überall, Esc-Kürzel neben dem ✕, Öffnen mit Übergang, Zeichen nur von Lucide

**Status:** Verbindlich
**Bezug:** DEC-082 (Kosmetik), DEC-084 (Karte je Auftrag), `docs/15-ui-styleguide.md` §1.7,
`docs/21-werkzeug-logistik.md` § 8, `tasks/25b-werkzeug-logistik.md`
**Auftrag des Projektinhabers:** „Zu den Modal-Fenstern, Kopfzeile und SVG: Alle Modal-Fenster
sollen mit ‚ESC' geschlossen werden können und ein Hinweis soll dort auch sein wie im
Anlegeformular. Kopfzeilen etc. sollen beim Aufmachen nicht aufplatzen, sondern eine Art
Animation haben. SVGs werden offline Lucide-SVG benutzt!"
**Nachtrag des Inhabers** (nach dem ersten Einbau): „Esc + Hinweis in jedem Fenster nimmt zu
viel Platz weg … einfach neben dem Kreuz den ‚Esc'-Hinweis." Der Hinweisblock unter der
Kopfzeile ist damit **entfallen**; an seiner Stelle steht das Kürzel neben dem ✕.

## Ausgangslage

1. **Esc war nicht überall gleich.** Neun Fenster gibt es (`Logistik`: Neuer Auftrag, Auftrag
   öffnen, Empfang, Rück-Auftrag, Werkzeug zurück · `Bewegungen`: Ausleihen, Zurückgeben ·
   `Bestätigung`: `ConfirmDialog` · `Datenblatt/Serienartikel`: Datei-Fenster). Alle riefen
   `useEscapeKey` – aber nur die Logistik-Fenster hatten zusätzlich einen sichtbaren
   **Schließen-Hinweis**; `ConfirmDialog` hatte **kein ✕** (nur „Abbrechen"), und niemand
   sagte dem Benutzer, dass Esc überhaupt schließt. Wer die Taste nicht kennt, sucht.
2. **Fenster „platzten" auf.** Das Fenster stand im nächsten Bild fertig da: kein Übergang,
   keine Bewegung, kein Hinweis darauf, dass hier gerade etwas aufgegangen ist. Dasselbe
   beim Aufklappen eines Auftrags (DEC-084) und beim Wechsel der Logistik-Reiter – der neue
   Block erschien hart.
3. **Zeichen waren teils selbst gezeichnet.** Vier Symbole (Werkzeug, Lager, Archiv,
   Serienartikel) bestanden aus handgeschriebenen `path`-Daten. Sie waren nicht auf derselben
   Strichstärke wie die übrigen Zeichen und wurden bei Änderungen des Rasters mitgezogen.

## Regel

1. **Esc schließt jedes Fenster** – ohne Ausnahme und ohne Dialog davor. Gesperrt ist Esc nur,
   solange ein Vorgang läuft (`busy`/`speichert`/`saving`): dann würde ein Abbruch einen
   halbfertigen Schreibvorgang hinterlassen.
2. **Jedes Fenster zeigt die Taste, nicht einen Satz darüber.** In der Kopfzeile steht
   **links vom ✕** das Kürzel `components/ui/EscHinweis.tsx` – ein `<kbd>` mit dem Wort
   **Esc** (`rounded border border-blue-900/20 bg-white/70 px-1 font-mono text-[11px]
   font-bold`), Tooltip „Mit der Esc-Taste schließen". Es kostet **keine** Zeile: das
   Kürzel sitzt in derselben Reihe wie das ✕, die Kopfzeile bleibt so hoch wie vorher.
   Ein Hinweisblock unter der Kopfzeile ist **nicht** zulässig (Nachtrag des Inhabers).
3. **Jedes Fenster hat einen sichtbaren Ausgang.** Oben rechts das ✕ mit
   `aria-label="Schließen"` (`ConfirmDialog` hat es jetzt auch, es bricht ab wie
   „Abbrechen"); das Datei-Fenster behält seinen Knopf „Schließen" in der Kopfzeile und
   trägt das Kürzel links davon. Der Tooltip „Schließen (Esc)" am ✕ ist entfallen – er
   sagte jetzt dasselbe wie das Kürzel daneben.
4. **Öffnen ist ein Übergang, kein Sprung.** Nur bei `prefers-reduced-motion: no-preference`
   (`index.css`, Abschnitt „Animationen beim Öffnen"):
   - `.modal-overlay` blendet ein (160 ms),
   - `.modal-panel` kommt von unten und wächst minimal auf 100 % (220 ms,
     `cubic-bezier(0.16, 1, 0.3, 1)`) – `translateZ(0)` bleibt in beiden Schlüsselbildern,
     sonst springt der Schatten nach dem Übergang,
   - `.auftrag-koerper` (Körper eines aufgeklappten Auftrags) blendet ein und zieht 6 px nach
     unten (200 ms),
   - `.bereich-in` (Reiter „Aufträge/Eingang/Wo ist was") kommt 8 px von unten (240 ms).
   Wer Bewegung reduziert eingestellt hat, bekommt weiterhin harte Schnitte.
5. **Alle Symbole kommen aus Lucide, offline.** Kein `path` von Hand. Die vier Eigenbauten
   sind ersetzt: Werkzeug → `Wrench`, Lager → `Warehouse`, Archiv → `Archive`,
   Serienartikel → `ClipboardList` (in `components/icons.tsx` als `fromLucideBody`-Wrapper,
   damit die Namen der App erhalten bleiben). `scripts/verify-icons.mjs` prüft das und muss
   „0 Eigenbauten" melden.
6. **Jedes Fenster liegt an `<body>`** (`createPortal`), nicht im Inhaltsblock. Grund:
   `.app-content-block` hat `backdrop-filter` und wird dadurch zum Bezugsrahmen für
   `position: fixed`; ohne Portal deckt die Abdunklung nur den Block ab, und bei gescrollter
   Seite steht das Fenster entsprechend tiefer. Beim Einbau gemessen: das Ausleih-Fenster lag
   131 px zu tief und ragte unten aus dem Bild (jetzt `y = 139 px` bei 720 px Höhe).
   `ConfirmDialog` und das Datei-Fenster machten es schon so; `LendModal` und `ReturnModal`
   sind nachgezogen.

## Prüfung im Browser (`tests/modals.spec.ts`)

Vier Tests messen an den erreichbaren Fenstern (Neuer Auftrag, Werkzeug zurück, Ausleihen,
Löschen-Bestätigung, Datei-Fenster) genau das, was hier festgelegt ist:

1. Das Kürzel `<kbd>` mit dem Text **Esc** steht im **selben Elternelement** wie das ✕,
   **links** davon und auf **derselben Zeile** (Mitten-Abstand ≤ 2 px).
2. Im Fenster gibt es **keinen** Hinweisblock mehr (`.ui-alert-info` → 0).
3. Das Fenster liegt **vollständig im Bild** (auch bei gescrollter Seite).
4. `animation-name` ist `panel-in` (Fläche) bzw. `overlay-in` (Abdunklung).
5. Esc schließt; beim Löschen-Dialog bleibt der Datensatz danach nachweislich bestehen.

## Begründung

Ein Fenster ist eine Unterbrechung: Es nimmt den ganzen Blick und muss sich sofort wieder
wegnehmen lassen. Esc ist die Taste, die dafür gelernt wird – aber nur, wenn sie überall
dasselbe tut und einmal dasteht. Sie steht deshalb **als Taste** neben dem ✕: ein Zeichen
sagt mehr als ein Satz und kostet keine Höhe; im Anlegeformular steht sie genauso (`.ui-badge`
„Esc"). Der Übergang ist kein Schmuck: Er zeigt, dass die Fläche **über** der Seite liegt; ein
hart eingesetztes Fenster liest sich wie ein Seitenwechsel, und der Blick sucht die Stelle, an
der er war. Lucide-Zeichen sind eine Familie – Strichstärke, Rundungen und Raster stimmen
überein, was bei handgezeichneten Pfaden nur zufällig gelingt.

## Was ausdrücklich NICHT gilt

- **Kein** Schließen per Esc während eines laufenden Vorgangs.
- **Kein** Hinweisblock in Fenstern (`.ui-alert` mit einem Satz „Mit Esc schließen"): Er
  kostete eine Zeile über dem Inhalt – das Kürzel neben dem ✕ sagt dasselbe (Nachtrag des
  Inhabers).
- **Keine** Rückfrage beim Schließen („Änderungen verwerfen?"): Die Fenster schreiben erst
  beim Absenden; ein ✕ ist ein Abbruch und braucht keine Bestätigung.
- **Kein** Ausblenden mit Animation (Schließen bleibt ein Schnitt) – der Abbruch soll sofort
  wirken, und ein wartendes Fenster würde die Seite blockieren.
- **Keine** Bewegung ohne `prefers-reduced-motion: no-preference`.
- **Keine** eigenen `path`-Daten mehr in `components/icons.tsx` (Guide §1.7).
---

# DEC-088 – Tooltips: eine Sprechblase statt `title="…"`

**Status:** Verbindlich
**Bezug:** DEC-082 (Kosmetik), DEC-087 (Fenster/Esc-Kürzel), `docs/15-ui-styleguide.md` §1.6/§1.9,
`tasks/CURRENT_TASKS.md`
**Auftrag des Projektinhabers:** „Für `title=""` gibt es extra ein Tooltip-CSS! Ich habe gemerkt,
dass es nicht überall benutzt wird!"
**Gewählte Umsetzung (Rückfrage beantwortet):** vorhandenes CSS, aber **per Portal über allem**;
der Tooltip am Eingabefeld „Anzahl" wandert an die **Feldbeschriftung**.

## Ausgangslage

1. **Das Tooltip-CSS war tot.** In `index.css` stand seit dem ersten Entwurf ein Tooltip
   (`[class^="tooltip-"]`, `.tooltip-top`, `.tooltip-right`) – **keine** Stelle in der
   Anwendung hat es benutzt (`grep` über `src/**`: nur die Definition). Es war außerdem
   `absolute` im Textfluss, an einen `.group`-Vorfahren gebunden (`whitespace-nowrap`,
   Pfeil ohne Position) – in Tabellen und Fenstern wäre es abgeschnitten worden.
2. **Stattdessen hingen 21 native `title`-Attribute** an Knöpfen und Werten (Logistik-Knöpfe,
   Rückgabe-Fenster, Datei-Fenster, Werkzeugliste, Sortierköpfe von drei Listen,
   Sitzungs-Timer, Werkfarbe-Umschalter, Beschichtung …). Der Browser-Tooltip erscheint
   erst nach etwa einer Sekunde, sieht überall anders aus, ist **per Tastatur nicht
   erreichbar** und nicht gestaltbar.
3. **Zwei Systeme, zwei Wahrheiten:** Das AdminPanel hatte dafür längst ein eigenes,
   richtiges Tooltip (`pages/admin/IconTipButton.tsx`, `Tip`: Portal an `<body>`,
   gemessene Position, `role="tooltip"`). Im Hauptfenster fehlte genau das.

## Regel

1. **Eine Komponente: `frontend/src/components/ui/Tooltip.tsx`.**
   `<Tooltip text="…">…</Tooltip>` um den Auslöser (Knopf, Wert, Zeichen).
   - Sie rendert die Blase **per `createPortal` an `<body>`** und **misst** die Lage am
     Auslöser (`getBoundingClientRect`, `position: fixed`). Damit wird sie in der Tabelle
     (`overflow-x-auto`), im Fenster (`overflow-hidden`) und an jeder Fußzeile **nicht
     abgeschnitten** – das war der Grund, das alte `absolute`-CSS nicht zu verwenden.
   - Sie erscheint bei **Hover und bei Tastatur-Fokus**; der Wirt trägt dabei
     `aria-describedby`, damit Screenreader den Hinweis mitlesen.
   - Beim Scrollen und bei Größenänderung wird die Blase **nachgeführt** (wie im
     AdminPanel), nicht einfach ausgeblendet.
   - `text={undefined}` bedeutet: **kein** Tooltip. Bedingte Hinweise („nur wenn der
     Auftrag leer ist") bleiben damit beim Aufrufer, ohne leere Hüllen im Layout.
2. **Kein `title=` mehr für Hinweise** im Hauptfenster – weder an Knöpfen noch an Werten.
   `title` bleibt nur, wo es **kein** Tooltip ist:
   - als **Prop** für Fenstertitel (`ConfirmDialog title=`, `FormSection title=`,
     `TableEditor title=`, `Placeholder title=`),
   - als **`iframe`-Beschriftung** (`title={`PDF ${name}`}` – Pflicht für Screenreader),
   - im **AdminPanel** an der Matrix: dort steht ein **mehrzeiliger** Text (Code, Belegung,
     Hinweis in drei Zeilen) im `title`; die Blase des AdminPanels ist einzeilig
     (`whitespace: nowrap`) und kann das nicht zeigen (Guide-Regel „abgeschnittener Text
     behält `title`").
3. **Der Wirt heißt `.tip-wirt`** (`position: relative`, `display: inline-flex`).
   **Nicht** `tooltip-wirt`: die Regel `[class^="tooltip-"]` greift auf jedes Element zu,
   dessen Klasse mit `tooltip-` **beginnt**. Mit diesem Namen wurde der Wirt selbst zur
   Blase (`fixed`, dunkel, `pointer-events: none`) – seine Knöpfe waren dadurch **nicht mehr
   klickbar** (im Test aufgefallen: der Reiter „Logistik" ließ sich nicht mehr anklicken).
4. **`className="contents"` an Stellen, an denen eine Hülle das Layout verschiebt**:
   Spaltenköpfe und Werte in Tabellenzellen, Feldbeschriftungen in einer Rasterzeile.
   Der Wirt ist dann `display: contents` (keine eigene Box); gemessen wird sein erstes Kind.
   Gemessen ohne diese Regel: die Werkzeugtabelle wurde bei 1440 px **24 px breiter** als ihr
   Bereich (937 statt 913 px) – die Spalte „Aktionen" lief aus dem Bild.
5. **Das vorhandene CSS bleibt die Gestalt** (dunkle Blase `bg-gray-800`, Radius, Schatten,
   Pfeil), aber es ist aufgeräumt: `position: fixed` (Lage als Inline-Stil), Pfeil je Seite
   mittig, `max-width: 18rem` mit **Umbruch** statt `whitespace-nowrap` (lange Sätze wie
   „Heimatplatz – bleibt reserviert, bis das Werkzeug zurück ist" laufen sonst aus dem Bild),
   Text 12 px, kleine Einblendung – nur bei `prefers-reduced-motion: no-preference`.
   Die Auslösung hängt **nicht** mehr an `.group` (sonst zeigte eine gehoverte Zeile alle
   Blasen ihrer Knöpfe gleichzeitig).
6. **Das AdminPanel behält `Tip`** (eigene dunkle Blase des zweiten Systems) – dieselbe
   Technik (Portal, gemessen, `role="tooltip"`), andere Haut. Ein Umbau dort war nicht
   Gegenstand des Auftrags; die beiden Systeme bleiben getrennt (Guide §1.7, „System B").

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Stellen mit `title=` als Hinweis (Hauptfenster) | 21 | **0** |
| Tooltip-CSS benutzt | nirgends | alle Hinweise |
| Auslöser für Tastaturnutzer | keiner | `Fokus` zeigt die Blase |
| Abgeschnitten in Tabelle/Fenster | ja (`absolute`) | nein (Portal) |
| Werkzeugtabelle bei 1440 px | 913 px | 913 px (mit `contents`-Wirt) |
| Blasen gleichzeitig offen | – | höchstens **eine** |

## Begründung

Ein Hinweis, der eine Sekunde auf sich warten lässt, in jedem Browser anders aussieht und
nur mit Maus erscheint, ist keine Beschriftung, sondern ein Zufall. Die Anwendung erklärt an
diesen Stellen **Folgen** („bleibt reserviert", „nicht verschickbar"), und die müssen sofort
und überall gleich erscheinen – auch dort, wo der Inhalt scrollt. Das CSS dafür war längst da;
es fehlte der Anschluss.

## Was ausdrücklich NICHT gilt

- **Kein** `title=` als Hinweis in der Oberfläche (Ausnahmen siehe Regel 2).
- **Keine** Blase im Textfluss (`absolute`): Sie wird in Scrollcontainern abgeschnitten.
- **Keine** Blase an einem **Eingabefeld**: Der Tooltip hängt an der Beschriftung (Regel des
  Guides, §§1.9 Punkt 12) – im Werkzeugformular umgesetzt für „Anzahl" und „Beschichtung".
- **Kein** zweiter Tooltip-Mechanismus im Hauptfenster (kein `ui-badge` mit Erklärtext,
  kein `data-tip`-Attribut): eine Komponente.
- **Keine** Blase, die den Fokus „festhält": Wer den Auslöser verlässt, verliert die Blase –
  sonst bliebe sie nach einem Klick für immer stehen (im Test gemessen: zwei Blasen offen).

## Prüfung im Browser (`frontend/tests/tooltips.spec.ts`)

Vier Tests:

1. **Liste:** Blase liegt **über** dem Auslöser, vollständig im Bild – auch im
   `overflow-x-auto` der Datenblätter-Liste (Portal).
2. **Tastatur:** Fokus zeigt die Blase; der Wirt trägt `aria-describedby`.
3. **Fenster:** die Blase kommt aus dem `overflow-hidden`-Panel heraus (Fußleiste des
   Fensters „Neuer Auftrag").
4. **Kein `title=` mehr**: nach dem Durchlauf aller Bereiche ist
   `document.querySelectorAll('[title]')` leer (ohne `iframe`). Genau **eine** Blase ist
   offen – ein liegengebliebener Tooltip fällt auf.

---

# DEC-089 – Logistik sofort erkennbar: farbiger Knopf mit Zähler, Kennzahl-Kacheln, deutlichere Zustände

**Status:** Verbindlich
**Bezug:** DEC-076 (Werkfarbe), DEC-082 (Kosmetik), DEC-084 (Karte je Auftrag),
DEC-086 (eigener Knopf), DEC-088 (Tooltips), `docs/21-werkzeug-logistik.md` § 8
**Auftrag des Projektinhabers:** „Logistik-Button: schau, wie man es noch anders machen kann – es
muss sofort erkennbar sein. In der Logistik fehlen mir Filter, suchen, wer angelegt hat, wer
verschickt hat, wer angenommen hat. Evtl. mehr deutlich farbig anzeigen, vielleicht Gradients.
Gib mir Vorschläge, was sinn macht."
**Umgesetzt (Auswahl des Inhabers):** Knopf-Variante **V1** (immer in der Werkfarbe gefüllt +
Zähler) und **Paket 1** (Kennzahl-Kacheln, deutlichere Zustände mit Alter).

## Ausgangslage

1. **Der Knopf war „anders", aber nicht auffällig.** Nach dem Schrift-Nachtrag zu DEC-086 trug er
   dieselbe Schriftstärke wie die Reiter (700) und war im Ruhezustand eine **helle weiße Pille**
   mit hellem Rand – die Werkfarbe erschien erst im aktiven Zustand. In der Leiste sah er damit
   aus wie ein Reiter mit Zeichen.
2. **Die Logistik hatte keine Filter und keine Suche.** `Logistics.tsx` lud fix 200 Aufträge
   (`getOrders({ direction: 'both', limit: 200 })`) und filterte nur im Speicher nach Richtung.
   Es gab keine Suche, keine Zustands-/Zeit-/Werk-/Personenfilter und keine Sortierung – und
   damit auch keinen Weg, „was liegt zu lange?" zu beantworten.
3. **Der Zustand war die leiseste Angabe der Zeile.** `StatusMarke` war eine 15-%-Tinte
   (`bg-sky-500/15`): Bei mehreren Aufträgen untereinander war der Unterschied zwischen
   „unterwegs", „teilweise da" und „angekommen" nur beim Lesen zu erkennen.
4. **Wer gehandelt hat, war versteckt.** Die Daten liegen längst vor
   (`created_by_name`, `sent_by_name`, je Position `received_by_name` + `received_plant`) –
   sichtbar waren sie nur im Fenster „Auftrag öffnen" und als graue Fußzeile.

## Regel

1. **Der Logistik-Knopf ist immer farbig.** Ruhend: Fläche `--werk-tinte` (18 % Tinte),
   Rand `--werk-line` (30 %), Schrift `--werk-text` (dieselbe Farbe um Faktor 0,78 dunkler –
   als Text auf getönter Fläche lesbar, DEC-076/§1.8). Aktiv: volle Werkfarbe, weiße Schrift.
   Die drei Variablen setzt `lib/plantTheme.ts` zusammen mit `--werk`.
2. **Der Knopf trägt die Zahl der offenen Aufträge** (`draft`, `sent`, `partly_received`, beide
   Richtungen) als Zähler `<span class="tab-zaehler">`. Sie wird über
   `lib/useOffeneAuftraege.ts` geladen (`limit: 0`, also die `COUNT`-Abfrage des Servers –
   richtig auch dann, wenn mehr offen sind als die Liste zeigt), bei jeder Änderung im Bereich
   (`logisticsRefreshKey`) und alle 60 s nachgeführt. Bei 0 entfällt der Zähler.
3. **Vier Kennzahl-Kacheln** über der Logistik (`.kpi-kachel`, „Entwürfe · unterwegs ·
   Eingang offen · älter als 7 Tage"), jede ein Knopf mit `aria-pressed`:
   - „Eingang offen" wechselt den Unterbereich,
   - die übrigen setzen einen **Schnellfilter** auf die Auftragsliste (ein zweiter Klick hebt
     ihn auf).
   Der gesetzte Filter steht **als Chip über der Liste** („Filter: nur unterwegs" + „7 von 12")
   und lässt sich dort mit einem Klick aufheben. Ein Filter, den man nicht sieht, wäre eine
   zweite Wahrheit über die Liste (DEC-082).
4. **Zustand als gefüllte Marke mit Verlauf und Zeichen** (`.ui-status`, `.ui-status-<zustand>`):
   Verlauf `linear-gradient(180deg, …30, …12)`, 1 px Kante in derselben Farbe, dunkle Schrift und
   ein Zeichen je Zustand (`FileText` = Entwurf, `Truck` = unterwegs, `ClipboardList` = teilweise,
   `Check` = angekommen, `CircleX` = storniert). Der Verlauf sitzt **nur auf der Marke** –
   Karten bleiben ungetönt, Kanten bleiben weiß (DEC-076).
5. **Jede Zeile nennt ihr Alter.** `AlterMarke` schreibt „gerade eben", „seit 20 Min.",
   „seit 4 Std.", „seit 3 Tagen" (Bezug: Versand, sonst Anlage). Ab **3 Tagen** und solange der
   Auftrag offen ist, wird sie **amber und fett** mit Zeichen. Im Eingang steht dieselbe Angabe
   in der Kopfzeile der Karte.
6. **Kein `title` dafür.** Der Hinweis am Filter-Chip läuft über `<Tooltip>` (DEC-088).

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Knopf ruhend | `rgba(255,255,255,.5)`, weißer Rand | `--werk-tinte` (18 %) + `--werk-line` |
| Offene Aufträge am Knopf | nicht sichtbar | Zähler, live (60 s / nach jeder Aktion) |
| Kennzahlen im Bereich | eine Textzeile | 4 Kacheln, jede ein Filter |
| Filter in der Liste | keiner | Schnellfilter + sichtbarer Chip |
| Zustandsmarke | 15-%-Tinte, Text | Verlauf + Kante + Zeichen |
| „liegt zu lange" | nicht erkennbar | „seit N Tagen", ab 3 Tagen amber |
| `title=` im Bereich | 14 (neu eingebaut) | 0 (über Tooltip) |

## Begründung

Ein Bereich, den man nicht findet, und eine Liste, die man nicht filtern kann, kosten jeden Tag
Zeit – beides ist keine Kosmetik. Die **Fläche in der Werkfarbe** ist das stärkste Signal, das
diese Leiste hergibt: Sie gehört zu keinem Reiter, und sie ist jeden Tag dieselbe. Der Zähler
macht daraus eine Anzeige statt eines Wegweisers („3 offene Aufträge" statt nur „Logistik").
Kennzahlen sind schneller als Suchen: Wer sieht, dass 4 Aufträge älter als 7 Tage sind, klickt
darauf – und hat die Liste, die er meinte. Der Verlauf auf der Zustandsmarke ist bewusst der
einzige Gradient: Farbe trägt hier Bedeutung (Zustand), nicht Dekoration.

## Was ausdrücklich NICHT gilt

- **Keine** getönten Auftragskarten und **keine** farbigen Kanten (DEC-076) – der Verlauf bleibt
  auf der Marke, die Karte bleibt weiß.
- **Kein** Gradient am Logistik-Knopf (Variante V3 wurde verworfen): Der Knopf trägt die Fläche
  der Werkfarbe, der Verlauf hätte ihn zum auffälligsten Fleck der Oberfläche gemacht.
- **Keine** Voltextsuche in diesem Schritt: Die API sucht in `q` nur Auftrags-Nr. und Reference;
  Suche über Werkzeug-ID, Person und Info sowie Zeitraum-Filter sind das **nächste Paket**
  (Paket 2, siehe `tasks/CURRENT_TASKS.md`).
- **Keine** Personenkette in der Zeile und **kein** Zeitstrahl im Nachweis-Fenster in diesem
  Schritt (Paket 3) – die Daten dafür liegen bereit.
- **Kein** serverseitiges Filtern für den Schnellfilter: Die Liste ist bereits geladen (max. 200);
  der Filter arbeitet im Speicher und ist damit sofort.

## Prüfung im Browser (`frontend/tests/logistik-kacheln.spec.ts`)

Drei Tests:

1. **Knopf:** Die Fläche ist nicht mehr Weiß, `--werk-tinte` ist gesetzt, und der Zähler nennt
   genau `total` aus `/api/transport/orders?status=draft,sent,partly_received&limit=0`.
2. **Kacheln:** Alle vier sind sichtbar und tragen eine Zahl; „Eingang offen" wechselt den
   Unterbereich; „unterwegs" setzt `aria-pressed`, zeigt den Chip und lässt in der Liste keinen
   Entwurf übrig; der Chip hebt den Filter wieder auf.
3. **Marken und Alter:** `.ui-status` hat einen `linear-gradient` und ein SVG-Zeichen; jede
   Auftragszeile trägt `.ui-alter` („seit …" oder „gerade eben").

## Nachtrag – und die Korrektur nach dem ersten Einbau

**Befund des Inhabers:** „Wenn man auf Kachel ‚unterwegs' und ‚Eingang offen' klickt, sind beide aktiv – ist
das so richtig?" **Nein.** Die Karten hatten zwei verschiedene Bedeutungen unter derselben Optik:
`unterwegs` setzte einen **Filter**, `Eingang offen` wechselte den **Unterbereich** – beide zeichneten
sich aber als „gedrückt". Zwei gedrückte Karten lesen sich wie zwei gesetzte Filter.

**Was daraus geworden ist (Vorschlag des Inhabers, übernommen):**

1. **„Eingang offen" ist aus dem Bereich verschwunden** – die Zahl gilt für den ganzen Bereich, nicht für
   die Auftragsliste, und der Reiter „Eingang" steht zwei Zentimeter weiter links. Die Karte sitzt jetzt
   in der **rechten Spalte**.
2. **Die rechte Spalte ist gefüllt** (offene Frage 7 aus `docs/21`): vier Kennzahl-Karten –
   **Aktive Ausleihen · Verfügbare Werkzeuge · Offene Aufträge · Eingang offen** –, jede ein
   **Sprungziel** (Werkzeugliste bzw. Logistik/Eingang). Die Zahlen kommen aus **einer** Anfrage
   `GET /api/stats/overview` (neu; `routers/stats.py`, `services/stats_service.py`): `COUNT`-Abfragen je
   Kennzahl, begrenzt auf das Arbeitswerk aus `X-Plant-Id`. „Verfügbar" schließt Werkzeuge **ohne Status**
   ein (DEC-080), Datenblätter **ohne Werk** zählen in jedem Werk (DEC-085), und „läuft zu lange" wird in
   Python gerechnet (SQLite legt `created_at` ohne Zeitzone und `sent_at` mit Offset ab – ein
   String-Vergleich beider Formate wäre falsch).
3. **Die Gestalt ist die der Styleguide-KPI-Karten** (`components/ui/KpiKarte.tsx`, „KPI- & Statistik-Karten"
   aus `UI-Styleguide.html`): Zeichen in einer Kachel (`h-10 w-10 rounded-lg` in der Spalte), große Zahl
   (`text-2xl font-extrabold`, `tabular-nums`), Name, dekorativer Glow (`pointer-events-none`), optionale
   Fußzeile mit `.ui-progress`. **Eine** Komponente für beide Stellen – Spalte (kompakt, nicht klickbar
   gedacht, aber als Sprung ein Knopf) und Bereich (kompakt, `aria-pressed` = Filter aktiv).
4. **Höchstens eine Karte ist gedrückt.** Im Bereich stehen nur noch **drei** Filter-Karten
   (Entwürfe · unterwegs · älter als 7 Tage) in einer Gruppe „Schnellfilter"; der gesetzte Filter steht
   weiter als Chip über der Liste („nur unterwegs · 7 von 12") und hebt sich dort auf.
5. **Der Zähler am Logistik-Knopf und die Karte „Offene Aufträge" sind dieselbe Zahl** (`orders_open` aus
   derselben Antwort) – eine Quelle statt zwei Abfragen; `lib/useOffeneAuftraege.ts` ist entfallen,
   `lib/useStatistik.ts` liefert alles (Nachführung bei jeder Aktion im Bereich und alle 60 s).

**Was das gekostet hat:** Zwei Karten, die „aktiv" aussehen, waren ein echter Fehler – der Browser-Test
hält jetzt fest, dass in der Gruppe „Schnellfilter" **genau eine** Karte gedrückt ist und dass „Eingang
offen" keine Karte des Bereichs mehr ist. Nebenbei mussten zwei ältere Tests ihre Reiter-Abfrage auf die
Navigation eingrenzen: die Kennzahl-Karten sind Knöpfe, und „Verfügbare Werkzeuge" enthält das Wort
„Werkzeuge" – ohne Eingrenzung war der Treffer mehrdeutig.

---

# DEC-090 – Logistik: Suche, Zeitraum, „nur meine", Personenkette

**Status:** Verbindlich
**Bezug:** DEC-072 (Vorgang), DEC-081 (Suche im Auswahlfenster), DEC-089 (Kennzahlen),
`docs/21-werkzeug-logistik.md` §7/§8
**Auftrag des Projektinhabers:** „In der Logistik fehlen mir Filter, suchen, wer angelegt hat,
wer verschickt hat, wer angenommen hat." – freigegeben zusammen mit: „wenn es nötig ist, das
Backend zu ändern, dann machen wir das."

## Ausgangslage

1. **Die Suche fand fast nichts.** `q` im Endpunkt `/api/transport/orders` durchsuchte
   **nur** Auftrags-Nr. und Reference. Die beiden Alltagsfragen der Logistik – „welcher
   Auftrag hatte dieses Werkzeug?" und „was hat Frau Maier verschickt?" – waren damit nicht
   zu beantworten, obwohl alle Angaben in der Datenbank stehen.
2. **Kein Zeitraum, kein „nur meine".** Wer wissen wollte, was in der letzten Woche lief,
   musste die Liste von Hand durchsehen. „Meine Aufträge" gab es gar nicht.
3. **Die Personen waren unsichtbar.** `created_by_name`, `sent_by_name` und je Position
   `received_by_name` liegen seit DEC-072 vor – sichtbar waren sie nur im Fenster
   „Auftrag öffnen" und als graue Fußzeile („Angelegt von … · verschickt …"). Wer ein
   Werkzeug angenommen hatte, stand **nur** im Nachweis.
4. **Keine teilbare Ansicht.** Nach einem Neuladen war jeder Filter weg.

## Regel

1. **Die Suche läuft über den Server und findet mehr** (`TransportService.list_orders` →
   `_suchbedingung`): Auftrags-Nr., Reference, **Info**, **Werkzeug-ID** der Positionen und
   **Personennamen** (angelegt, verschickt, je Werkzeug bestätigt – Vor-, Nach- und
   Vor+Nachname). Die Werkzeug- und Personentreffer laufen über `ANY`/`has` (Unterabfragen):
   ein Auftrag mit zwei passenden Werkzeugen erscheint **einmal**, nicht zweimal.
2. **„nur meine" filtert auf dem Server** (`mine=true` → `created_by_id = current_user.id`).
   Ein Namensvergleich im Frontend wäre falsch: Namen sind nicht eindeutig.
3. **Der Zeitraum ist eine Stufe** (Alle · letzte 7 Tage · letzte 30 Tage) und wirkt
   **im Browser** auf `sent_at`, sonst `created_at`. Er braucht keine Serverabfrage – die
   Liste ist geladen, und der Filter soll sofort reagieren. Ein Bereich „von … bis …" ist
   **nicht** umgesetzt (offene Frage 1).
4. **Die Filterleiste steht über der Liste:** Suchfeld (300 ms Verzögerung), Zeitraum-Segment,
   Kontrollkästchen „nur meine", „zurücksetzen" (erscheint nur bei aktivem Filter) und die
   Zahl der Treffer. Danach folgen die drei Kennzahl-Karten als Schnellfilter (DEC-089).
5. **Die Karten zeigen Gesamtzahlen, nicht Treffer.** Ihre Zahlen kommen aus den
   Kennzahlen (`orders_out_draft/out_sent/out_old`, neu im Endpunkt) – sonst stünde auf der
   Karte „5 unterwegs" über einer Liste mit zwei Suchtreffern. Nach jeder Aktion
   (verschicken, empfangen, zurück, anlegen) ruft der Bereich `onAktion()`; der App-Rahmen
   lädt Zähler und Karten damit sofort neu.
6. **Personenkette im aufgeklappten Auftrag:** Plaketten `angelegt AA` · `verschickt BA` ·
   `bestätigt CK` mit den **Initialen** und dem Vollnamen im Tooltip (DEC-088), dahinter
   „n/m angekommen". In der Spalte „Empfang" steht hinter der Zeit die Initiale der Person,
   die bestätigt hat; im Eingang heißt es „verschickt … von <Name>".
7. **Die Ansicht steht in der Adresszeile:** `log-suche`, `log-zeit`, `log-meine`,
   `log-filter`, `log-bereich` (Präfix `log-`, damit sie mit den Werkzeug-Filtern
   derselben Seite nicht kollidieren). Zurück-Taste und Lesezeichen funktionieren damit.
   **Dabei gefunden und behoben:** Die Werkzeugliste ersetzte die ganze Adresszeile
   (`?…` neu geschrieben) – beim Öffnen der Werkzeugliste waren die `log-*`-Parameter weg.
   Sie **ergänzt** sie jetzt und lässt fremde Präfixe stehen.

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Suchfelder | Auftrags-Nr., Reference | + Info, Werkzeug-ID, Personen (3 Rollen) |
| Zeitraum-Filter | – | Alle · 7 · 30 Tage |
| „nur meine" | – | Serverfilter `mine=true` |
| Personen in der Liste | Fußzeile (nur angelegt/verschickt) | Kette mit Initialen + Vollname im Tooltip, Initiale je Werkzeug |
| Kennzahlen im Endpunkt | 13 | 17 (`orders_out_open/draft/sent/old`) |
| Ansicht nach Neuladen | weg | aus der Adresszeile |

## Begründung

Wer ein Werkzeug sucht, kennt selten die Auftragsnummer – er kennt das Werkzeug oder die
Person. Genau diese beiden Wege fehlten. Der Zeitraum ist die zweite Frage („was ist diese
Woche passiert"), und „nur meine" ist die dritte („was liegt bei mir"). Alles drei sind
billig, wenn die Daten schon da sind – teuer ist nur, dass niemand sie zeigt.

## Was ausdrücklich NICHT gilt

- **Keine** Volltextsuche über Beschreibung, Typ oder Maß der Werkzeuge im Auftrag – gesucht
  wird die **Werkzeug-ID**. (Die Werkzeugliste selbst sucht weiterhin alles, `docs/05`.)
- **Kein** Datumsbereich „von … bis …", keine gespeicherten Filter, keine Benachrichtigungen.
- **Keine** Personenfilter als eigene Auswahl („nur Aufträge von X"): „nur meine" deckt den
  Alltag ab; für alles andere ist die Suche über den Namen da.
- **Kein** serverseitiger Zeitraumfilter: Er wäre eine zweite Wahrheit über dieselbe Liste
  und würde bei jedem Klick eine Anfrage kosten.

## Prüfung

**Browser** (`frontend/tests/logistik-suche.spec.ts`, 4 Tests, eigener Testauftrag über die
API): Suche über Werkzeug-ID, Person (Vorname des Anlegers) und Info-Text; „nur meine" +
Zeitraum (kein sichtbarer Auftrag älter als 7 Tage, Filter in der Adresszeile); Ansicht
übersteht ein Neuladen (Suchfeld, Zeitraum, Kontrollkästchen); Personenkette mit Vollname im
Tooltip.
**Backend** (`backend/tests/test_transport_suche.py`, 3 Tests): Werkzeug-ID, Info, Reference,
Personen (Vor-/Nachname, drei Rollen), kein doppelter Treffer bei zwei Werkzeugen, `mine`.
`backend/tests/test_stats.py` prüft die vier neuen `orders_out_*`-Zahlen.

---

# DEC-091 – Nachweis-Fenster: der Ablauf als Zeitstrahl

**Status:** Verbindlich
**Bezug:** DEC-072 (Vorgang), DEC-074 (Empfang), DEC-090 (Personenkette),
`components/logistics/Zeitstrahl.tsx`, `docs/21-werkzeug-logistik.md` §8

## Ausgangslage

Der Verlauf eines Auftrags stand im Fenster „Auftrag öffnen" als **drei Sätze**
untereinander: „Angelegt 12.03.2026, 09:12 von Anna Ausleiherin · Arbeitswerk Werk 1",
„Unterwegs seit …", „abgeschlossen …". Wer wissen wollte, wer wann was getan hat, musste
diese Sätze lesen und im Kopf zu einer Kette sortieren – obwohl der Vorgang genau eine
Kette ist. Zusätzlich fehlte die **Zwischenstufe**: „teilweise angekommen" (DEC-074) war im
Kopfblock nicht zu erkennen; es stand nur im Zustandschip und in der Werkzeugtabelle.

## Regel

1. **Der Ablauf ist ein Zeitstrahl** (`Zeitstrahl`, Abschnitt „Ablauf"): angelegt →
   verschickt → (teilweise angekommen) → angekommen. Jeder Schritt zeigt **Zeichen,
   Zeitpunkt, Person und Werk**; was noch aussteht, bleibt sichtbar, aber leise
   (gestrichelter Ring, grauer Text).
2. **Die Personen stehen als Initialen-Plaketten** mit Vollname im Tooltip – dieselbe
   Sprache wie die Personenkette in der Auftragsliste (DEC-090), damit dieselbe Angabe
   nicht zweimal anders aussieht.
3. **Zusatzzeilen erklären die Menge:** „mit 3 Werkzeug(en)" (angelegt), „Heimatplätze
   bleiben reserviert" (verschickt), „2 von 3 Werkzeugen bestätigt" (teilweise), „alle 3
   Werkzeuge bestätigt" (angekommen), „1 von 3 Werkzeugen warten" (Empfang offen).
4. **Keine neuen Daten, keine neue Abfrage:** Der Zeitstrahl lebt von dem, was der Auftrag
   ohnehin mitführt (`created_at/created_by/created_plant`, `sent_at/sent_by/from_plant`,
   `items[].received_at/received_by/received_plant`, `closed_at`). Die drei alten Textzeilen
   im Kopfblock sind entfallen – sie sagten dasselbe.
5. **Storno zeigt keinen Zeitpunkt.** Für das Stornieren gibt es in der Datenbank keinen
   eigenen Zeitstempel (`closed_at` bleibt beim Storno leer) – der Schritt steht deshalb
   ohne Datum. Einen zu erfinden wäre eine falsche Angabe; ein `cancelled_at` wäre eine
   eigene Entscheidung (offene Frage 1).

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Darstellung | 3 Sätze untereinander | Kette mit 3–5 Schritten |
| „teilweise angekommen" | nur im Zustandschip/Werkzeugtabelle | eigener Schritt mit Zeit, Person, „x von y" |
| Wer gehandelt hat | Text („von …") | Initialen-Plakette + Werk, Vollname im Tooltip |
| Ausstehender Schritt | „Noch nicht verschickt" als Satz | leiser Schritt „Noch nicht verschickt" / „Empfang offen" |

## Begründung

Ein Nachweis wird gelesen, um eine Frage zu beantworten: „wo ist es hängen geblieben?" Die
Antwort ist eine Kette mit Zeitpunkten – als Fließtext muss man sie erst rekonstruieren.
Dass der letzte erreichte Schritt farbig ist und die folgenden grau, beantwortet die Frage
außerdem ohne Lesen: Man sieht auf einen Blick, wie weit der Vorgang ist.

## Was ausdrücklich NICHT gilt

- **Kein** eigener Reiter „Verlauf" und keine Zeitleiste auf der Seite – der Ablauf gehört
  in das Fenster, das den Auftrag ohnehin zeigt (DEC-075 Punkt 2).
- **Keine** Bewegungs-Historie je Werkzeug in diesem Fenster (das ist TASK-029, der
  Historie-Reiter).
- **Keine** neuen Endpunkte: Der Nachweis kommt weiterhin aus `GET /api/transport/orders/{id}`.

## Prüfung

`frontend/tests/logistik-nachweis.spec.ts` (2 Tests, eigener Auftrag über die API): Nach dem
Verschicken zeigt der Ablauf **Angelegt → Verschickt → Empfang offen** (mit Zielwerk), der
Anleger steht als Plakette mit Vollname im Tooltip; nach dem bestätigten Empfang endet der
Ablauf mit **Angekommen · „alle 1 Werkzeuge bestätigt"** und „Empfang offen" ist verschwunden.

---

# DEC-092 – Überfällige Aufträge sichtbar machen (Amber-Marke am Logistik-Knopf)

**Status:** Verbindlich
**Bezug:** DEC-089 (Kennzahlen, Karten), DEC-091 (Zeitstrahl), `docs/21-werkzeug-logistik.md`
**Auftrag des Projektinhabers:** „mach als erstes, was für richtig hältst" – aus dem Vorschlag
„Überfällig-Hinweis (P5): Liegenbleibendes fällt auf, ohne dass man sucht."

## Ausgangslage

Seit DEC-089 gibt es die Karte „älter als 7 Tage" und die Spalte „seit 3 Tagen" im Zeitstrahl –
beides hilft nur, **wenn man in die Logistik schaut**. Ein Auftrag, der drei Wochen als Entwurf
liegt, wurde bis dahin nur zufällig gefunden. Im Produktivbestand sind es aktuell **6** offene
Aufträge älter als 7 Tage (gemessen am 2026-10-18 angelegten Datenbestand).

## Regel

1. **Am Logistik-Knopf steht neben dem Zähler eine Amber-Marke** (`tab-ueberfaellig`: Zeichen
   + Zahl), sobald es offene Aufträge ab 7 Tagen gibt. Der Zähler bleibt daneben stehen – die
   Gesamtzahl verschwindet nicht. Der Tooltip nennt beides: „8 offene Aufträge – davon 6 seit
   über 7 Tagen".
2. **Kein Toast beim Anmelden.** Ein solcher Hinweis wurde gebaut und wieder entfernt: Er
   liegt unten rechts über dem Inhalt und **blockiert Klicks** – im Browser-Test fiel damit
   das Farbfeld der Stammdaten aus (`plant-bar`), und der Toast-Test der Werkzeugliste fand
   plötzlich nicht mehr genau einen Hinweis. Ein Hinweis, der die Bedienung stört, ist kein
   Hinweis. Die Amber-Marke am Knopf steht auf **jedem** Bildschirm und stört nichts; die Zahl
   steht zusätzlich in der Karte „älter als 7 Tage" und in der rechten Spalte („N alt").
3. **Die Zahl kommt aus den Kennzahlen** (`orders_old`, seit DEC-089 im Endpunkt): dieselbe
   Quelle wie Karte und Sidebar. Kein zweiter Zählweg.
4. **„Überfällig" heißt: offen (Entwurf, verschickt, teilweise) und seit mindestens 7 Tagen**,
   gerechnet ab Versand, ohne Versand ab Anlage. Ein Entwurf, der drei Wochen liegt, ist
   genauso ein Fall wie ein Paket, das drei Wochen unterwegs ist.

## Was ausdrücklich NICHT gilt

- **Keine** Frist je Auftrag oder je Werk („Werk 2 hat 10 Tage") – die 7 Tage sind eine feste
  Zahl im Code (`LANGE_OFFEN` im Bereich, `LANGE_TAGE` im Service), keine Einstellung.
- **Keine** E-Mail, kein Badge in der Seitenleiste, keine Push-Benachrichtigung.
- **Kein** Toast beim Anmelden oder beim Nachführen der Zahlen (siehe Regel 2).

## Prüfung

`frontend/tests/logistik-kacheln.spec.ts` prüft am Knopf: Die Amber-Marke steht **genau dann**,
wenn die Kennzahlen `orders_old > 0` melden, und trägt **deren Zahl** (sonst ist sie nicht da).
Die Rechnung selbst deckt `backend/tests/test_stats.py` ab (`orders_old`, `orders_out_old`,
inklusive „Versand zählt, sonst Anlage").

---

# DEC-093 – „Wo ist was": Suche, Filter und „seit wann draußen"

**Status:** Verbindlich
**Bezug:** DEC-077 (nur Abwesendes), DEC-089/090/092 (Karten, Suche, Überfälliges),
`components/logistics/AwayTable.tsx`, `docs/21-werkzeug-logistik.md` §8
**Auftrag des Projektinhabers:** „mach weiter" – letzter offener Punkt der Logistik-Liste
(„Wo ist was": Suche/Filter, Person fehlt).

## Ausgangslage

1. **Keine Suche, kein Filter.** Die Tabelle zeigte alle ausgeliehenen und unterwegs
   befindlichen Werkzeuge; nur der Umfang ließ sich umschalten (Alle · Unterwegs ·
   Ausgeliehen). Wer ein bestimmtes Werkzeug suchte, scrollte.
2. **Kein „seit wann".** In der Zeile stand „ausgeliehen" bzw. das Zielwerk – nicht, wie lange
   das schon so ist. Damit war die eigentliche Frage dieser Seite („was liegt bei wem, und wie
   lange schon?") nur halb beantwortet.
3. **Die Anfrage selbst kannte den Zeitpunkt nicht.** `AwayTool` hatte kein Feld dafür; die
   lend-Bewegung bzw. `sent_at` des Auftrags lagen aber bereits vor.

## Regel

1. **Backend: `AwayTool.since`** (neu). Bei Ausleihe der Zeitpunkt der `lend`-Bewegung, bei
   Transport `sent_at` des offenen Auftrags; `NULL`, wenn nichts davon bekannt ist (dann wird
   **kein** Zeitpunkt erfunden). Kein neues Datenmodell, keine Migration – nur ein Feld in der
   Antwort.
2. **Suche über die ganze Zeile** (im Browser, die Liste ist klein): Werkzeug-ID, Beschreibung,
   Kategorie, Typ, Maß, Heimatwerk, Heimatplatz, aktuelles Werk, Zielwerk, **Ausleiher** und
   **Auftragsnummer**. Treffer, die nichts finden, sagen es („Kein Werkzeug passt zu dieser
   Suche").
3. **Filter:** Umfang (wie bisher), **Heimatwerk** (erscheint nur, wenn mehr als eines
   vorkommt) und **„länger als 7 Tage"** mit eigener Zahl in der Klammer. „Zurücksetzen"
   erscheint, sobald etwas gesetzt ist, und nennt daneben „x von y".
4. **Neue Spalte „Seit"** mit „gerade eben / seit 4 Std. / seit 3 Tagen" – ab 7 Tagen **amber
   und fett** (dieselbe Regel und dieselbe Anzeige wie in der Auftragsliste, DEC-089/092).
   Die Liste ist **am längsten draußen zuerst** sortiert: Die Frage dieser Ansicht ist nicht
   „welches Werkzeug", sondern „was liegt am längsten".
5. **Der Ausleiher steht im Klartext** (`lent_to`, fett), bei Transport weiterhin die
   Auftragsnummer als Sprung in den Auftrag (DEC-077). Die Spalte heißt „Auftrag / Ausleiher".

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Suche | – | über Werkzeug, Art, Werk, Person, Auftrag |
| Filter | nur Umfang | + Heimatwerk + „länger als 7 Tage" (mit Zahl) |
| Zeitangabe | – | Spalte „Seit", ab 7 Tagen amber |
| Sortierung | Werkzeug-ID | am längsten draußen zuerst |
| API-Feld | – | `AwayTool.since` (Ausleihe: Bewegung, Transport: Versand) |

## Begründung

„Wo ist was" ist die Seite, auf der man nachschaut, **wenn etwas fehlt**. Sie muss deshalb
zwei Fragen beantworten können: „wo ist *dieses* Werkzeug" (Suche) und „was liegt seit wem
zu lange draußen" (Seit + Filter + Sortierung). Beides kostet keine neue Abfrage – die Daten
waren da, nur nicht gezeigt.

## Was ausdrücklich NICHT gilt

- **Kein** serverseitiger Suchparameter für diese Liste: Sie ist auf die abwesenden Werkzeuge
  begrenzt (Dutzende, nicht Tausende) und reagiert im Browser ohne Anfrage.
- **Keine** Erinnerung/Benachrichtigung für lange Ausleihen – dafür gibt es die Amber-Marke am
  Logistik-Knopf für Aufträge (DEC-092); Ausleihen sind personenbezogen und werden im
  Ausleih-Fenster zurückgegeben.
- **Kein** „Ausleihen verlängern" oder „Rückgabe anstoßen" aus dieser Tabelle: Die Rückgabe
  läuft über das Zeilenmenü der Werkzeugliste (DEC-078).

## Prüfung

**Browser** (`frontend/tests/logistik-wo-ist-was.spec.ts`, 3 Tests): jede Zeile nennt „seit …";
Suche findet die Werkzeug-ID, meldet „kein Treffer" bei Unsinn und „zurücksetzen" stellt die
Liste wieder her; „länger als 7 Tage" filtert und keine verbleibende Zeile ist jünger.
**Backend** (`tests/test_transport.py`, `test_wo_ist_was_nennt_seit_wann`): `since` ist beim
Transport der Versandzeitpunkt und bleibt bei fehlender Ausleih-Bewegung `None`.

---

# DEC-094 – Reiter „Historie": der Verlauf aller Bewegungen

**Status:** Verbindlich
**Bezug:** TASK-029, DEC-066 (Reiter), DEC-070 (Arbeitswerk), DEC-078 (Rückgabe an Personen),
`docs/21-werkzeug-logistik.md` §8, `pages/History.tsx`
**Auftrag des Projektinhabers:** „ok mach es" – auf den Vorschlag „Historie-Reiter (TASK-029)
als letzte ‚folgt in einem späteren Schritt'-Stelle".

## Ausgangslage

Der Reiter „Historie" war seit dem ersten Entwurf ein **Platzhalter**: „Hier erscheinen später
alle Werkzeugbewegungen … Der eigene Tab kommt mit dem Bewegungspaket." Die Bewegungen wurden
längst geschrieben – Ausleihe, Rückgabe, Umbuchung, Statuswechsel, jede mit Werkzeug, Person,
Arbeitswerk (DEC-070) und Zeitpunkt – nur sehen konnte man sie nirgends. Der Endpunkt
`GET /api/movements/` lieferte eine nackte Liste ohne Gesamtzahl und ohne Suche, deshalb war
daran auch keine Seite zu bauen.

## Regel

1. **Neuer Endpunkt `GET /api/movements/history`** (Seiten + Gesamtzahl), Filter:
   - `movement_type` (kommagetrennt: lend, return, transfer, relocate, status_change),
   - `q` – Suche über **Werkzeug-ID, Beschreibung, Person (Vor-/Nachname), Ort (von/nach)
     und Notiz**; ein unbekannter Vorgang ist 422, kein stilles Ignorieren,
   - `von`/`bis` (Tage, einschließlich; `bis` schließt den ganzen Tag ein),
   - `plant_id` – Arbeitswerk, in dem gehandelt wurde; ohne Angabe **alle Werke**
     (Altdaten ohne `plant_id` bleiben dort sichtbar),
   - `skip`/`limit`.
   Antwort `MovementPage {items, total}` – `total` aus einer eigenen `COUNT`-Abfrage mit
   denselben Bedingungen, damit „1–25 von 320" stimmt.
2. **Der Bereich zeigt eine Liste, keine Auswertung.** Spalten: **Zeit · Werkzeug (ID +
   Beschreibung) · Vorgang · von → nach · Person · Arbeitswerk · Notiz**. Zeilenfarbe =
   Heimatwerk des Werkzeugs (DEC-076), Vorgang als farbige Marke.
3. **Filter im Kopf:** Suche (300 ms), Zeitraum (Alle · 7 · 30 · 90 Tage), Kontrollkästchen
   **„alle Werke"** (Vorgabe: nur das Arbeitswerk – Bewegungen anderer Werke sind im Alltag
   Rauschen), Vorgangs-Marken als **Mehrfachauswahl** mit Trefferzahl, „zurücksetzen".
   Der Kopf nennt „1–25 von 320" und „(gefiltert)", wenn etwas gesetzt ist.
4. **Seiten** über die vorhandene `ToolPagination` (25/50/100), Leerzustände getrennt nach
   „nichts da" und „nichts passt zur Auswahl".
5. **Der Verlauf wird nicht bearbeitet.** Kein Löschen, kein Ändern – er ist der Nachweis
   (DEC-072). Die Zahlen (was ist draußen, was liegt zu lange) bleiben in der Logistik und in
   der rechten Spalte (DEC-089/092); dieser Reiter beantwortet „was ist passiert".

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Reiter „Historie" | Platzhaltertext | echte Liste mit Filtern |
| Endpunkt | Liste ohne `total`, ohne Suche/Zeitraum | `GET /api/movements/history` mit `total`, Suche, Zeitraum, Vorgang, Werk |
| Spalten | – | Zeit · Werkzeug · Vorgang · von → nach · Person · Arbeitswerk · Notiz |
| Suche | – | Werkzeug-ID, Beschreibung, Person, Ort, Notiz |
| Seiten | – | 25/50/100 mit „x–y von N" |

## Begründung

Ein Verlauf, den man nicht lesen kann, ist kein Nachweis, sondern eine Tabelle in der
Datenbank. Die Fragen sind konkret: „wer hat das Werkzeug zuletzt angefasst", „was ist in der
letzten Woche passiert", „was hat Frau Maier gemacht" – alle drei brauchen Suche und Zeitraum,
nicht ein Diagramm. Der Platzhalter war außerdem die letzte Sackgasse im Hauptmenü
(Audit A-27).

## Was ausdrücklich NICHT gilt

- **Keine** Auswertung/Diagramme in diesem Schritt (Durchlaufzeiten, Häufigkeiten) – eigene
  Entscheidung, eigenes Paket.
- **Kein** Löschen oder Korrigieren von Bewegungen.
- **Kein** Export (CSV/PDF).
- **Keine** Live-Aktualisierung: Die Liste lädt beim Öffnen und nach einer Aktion
  (`logisticsRefreshKey`), nicht im Sekundentakt.

## Prüfung

**Backend** (`backend/tests/test_movements_history.py`, 4 Tests): Gesamtzahl und Reihenfolge
(neueste zuerst), Suche über Werkzeug-ID/Beschreibung/Person/Notiz/Zielort (und 0 bei Unsinn),
Filter nach Vorgang, Arbeitswerk und Zeitraum (inklusive „Altdaten ohne Arbeitswerk"), Seiten
ohne Überschneidung.
**Browser** (`frontend/tests/historie.spec.ts`, 3 Tests): Spalten und eine echte Zeile; Suche
findet die Werkzeug-ID und meldet „Keine Bewegung passt zu dieser Auswahl"; Vorgangs-Marke
filtert (und hebt sich auf), Zeitraum-Filter setzt „(gefiltert)".

---

# DEC-095 – Logistik als Karte in der rechten Spalte, Historie als Logistik-Reiter, Aktionen in die obere Leiste

**Status:** Verbindlich
**Bezug:** DEC-086 (eigener Knopf), DEC-089 (KPI-Karten), DEC-094 (Historie),
`docs/15-ui-styleguide.md` §1.6, `frontend/src/App.tsx`, `pages/Logistics.tsx`
**Auftrag des Projektinhabers (wörtlich):** „Logistik Button diesen bitte als KPI karte machen
nur bisschen schmaler und über die karten rechts plazieren. Historie gehört eigentlich in die
Logistik. In der Historie die Buttons Werkzeug zurück, Neuer Auftrag und das Tabmenü in das
schon vorhandene app-tabbar plazieren von rechts mit Trennstrichen, so sparen wir Platz. In den
Aufträgen haben wir drei app-stat-card, wenn wir sie dort umplazieren oder kleiner machen
könnten wäre es gut!"

## Ausgangslage

1. **Logistik war ein Reiter** (seit DEC-086 als eigene Pille neben der Reiter-Gruppe). Damit
   stand sie in der Leiste, obwohl sie fachlich kein Stammdaten-Bereich ist.
2. **„Historie" war ein eigener Hauptreiter** (DEC-094) – obwohl sie Bewegungen zeigt, also
   genau das, was die Logistik beschreibt.
3. **Der Logistik-Bereich hatte eine eigene Kopfzeile**: Unterreiter links, „Werkzeug zurück"
   und „Neuer Auftrag" rechts – eine zweite Leiste unter der ersten, mit eigenem Glasblock.
4. **Drei Filter-Karten standen in einer eigenen Reihe** über der Auftragsliste (rund 110 px).

## Regel

1. **Die Logistik ist eine Karte der rechten Spalte**, **über** den Kennzahlen, in der
   **Mini-Form** von `KpiKarte` (`mini`: Zeichen 28 px, Zahl `text-lg`, ohne Glow, ohne
   Fußzeile). Sie zeigt `orders_open`, die Überfällig-Marke (Amber, DEC-092) und ist im
   offenen Zustand markiert (`aria-pressed`). Sie ersetzt den Reiter vollständig – der
   `TabKey` `historie` ist entfallen, die Reiter-Gruppe zeigt nur noch Werkzeuge,
   Serienartikel, Datenblätter, Ersatzteile.
2. **„Historie" ist der vierte Unterreiter der Logistik**: Aufträge · Eingang · Wo ist was ·
   **Historie** (`pages/History.tsx`, unverändert).
3. **Unterreiter und Aktionen stehen in der oberen Leiste** (`.app-tabbar`), nur wenn die
   Logistik offen ist: rechts neben der Reiter-Gruppe, jeweils durch einen **Trennstrich**
   (1 × 24 px) abgesetzt – *Reiter | Unterreiter | Aktionen*. Der Bereich hat dadurch **keine
   eigene Kopfzeile** mehr; der Unterbereich lebt in `App.tsx` (`logistikBereich`), die beiden
   Aktionen öffnen die Fenster der Logistik über Zähler (`neuAuftragWunsch`, `zurueckWunsch`).
   Der Eingang-Zähler sitzt als Plakette am Unterreiter (aus `orders_incoming_open`).
4. **Die drei Filter-Karten sind Mini-Karten in der Filterzeile** (je 6,5 rem breit, Höhe einer
   Eingabezeile) – dieselbe Zeile wie Suche, Zeitraum und „nur meine". Die eigene Kartenreihe
   entfällt; die Liste rückt rund 110 px nach oben.
5. **Die Regeln `.tab-logistik`, `.tab-zaehler`, `.tab-ueberfaellig` entfallen** (toter CSS-Code).
   Zähler und Überfällig-Marke stehen jetzt in der Karte.

## Zahlen

| Punkt | vorher | jetzt |
|---|---|---|
| Logistik | Reiter in der Leiste | Karte in der rechten Spalte (über den Kennzahlen), `mini` |
| „Historie" | eigener Hauptreiter | 4. Unterreiter der Logistik |
| Hauptreiter | 5 | 4 (Werkzeuge, Serienartikel, Datenblätter, Ersatzteile) |
| Kopfzeile des Bereichs | eigener Glasblock mit Reitern + 2 Knöpfen | entfallen – alles in `.app-tabbar`, mit 2 Trennstrichen |
| Filter-Karten | eigene Reihe, ~110 px | Mini-Karten in der Filterzeile, ~44 px |
| CSS | `.tab-logistik` + 2 Marken | entfernt |

## Begründung

Die obere Leiste ist der Ort, an dem man den Bereich und seine Unterbereiche erwartet – zwei
Leisten untereinander (eine für die Bereiche, eine für die Unterbereiche) kosten Höhe und
verwirren, weil beide gleich aussehen. Die Logistik dagegen wird **gesucht**, nicht
durchgeblättert; sie als farbige Kennzahl-Karte in der Spalte zu zeigen, macht sie mit ihrer
Zahl („8 offene Aufträge, 6 überfällig") zugleich zur Anzeige. Und die drei Filter-Karten waren
der letzte Rest „Kachel über der Liste" – ihre Zahl ist nützlich, ihre Höhe war es nicht.

## Was ausdrücklich NICHT gilt

- **Kein** eigener „Logistik"-Reiter mehr (auch nicht ausgeblendet) – die Karte ist der Weg.
- **Keine** zweite Leiste im Bereich: Unterreiter und Aktionen sind **eine** Zeile mit der
  Hauptleiste.
- **Keine** Filter-Karten in der Seitenleiste und keine vierte Kennzahl dort (die Spalte hält
  vier Karten + Logistik, DEC-083).
- **Kein** Verlust der Adresszeilen-Ansicht: Suche, Zeitraum, „nur meine" und der Schnellfilter
  stehen weiterhin in `log-*` (DEC-090); der Unterbereich wird nicht mehr in die Adresszeile
  geschrieben (er war dort nie ein Lesezeichenziel).

## Prüfung

`frontend/tests/logistics.spec.ts` (Test „Logistik ist eine Karte der rechten Spalte, ihre Reiter
stehen oben (DEC-095)"): Logistik ist nicht in der Reiter-Gruppe · Karte steht in der rechten
Spalte **über** den Kennzahlen und ist höchstens 240 px breit · Klick öffnet den Bereich, Karte
trägt `aria-pressed` · die Gruppe „Logistik" hat die vier Unterreiter · „Werkzeug zurück" und
„Neuer Auftrag" stehen in der Navigation · mindestens zwei Trennstriche.
`logistik-kacheln.spec.ts` prüft Zahl (`orders_open`) und Überfällig-Marke der Karte; alle
übrigen Logistik-Specs öffnen den Bereich jetzt über die Karte (`getByRole('complementary')`).
Browser 129 Tests grün.

## Nachtrag (DEC-096) – die Logistik-Karte sieht aus wie ein Knopf

**Auftrag des Inhabers:** „bevor du weitermachst, mach bitte KPI Logistik so, dass er auch wie
ein Button aussieht."

Die Karte stand nach DEC-095 in der rechten Spalte, sah aber aus wie die Kennzahlen daneben –
also wie etwas zum Lesen. Jetzt ist sie erkennbar ein **Einstieg**:

- **Fläche in der Werkfarbe** (`var(--werk)`, wie `.ui-btn-werk`) statt Glas, **weiße Schrift**;
  beim Überfahren eine Spur heller (`color-mix` mit Weiß, 88 %).
- **Pfeil nach rechts** (`ChevronRightIcon`, wandert beim Überfahren leicht mit) und ein
  **CTA** in der Beschriftung: „Logistik · öffnen".
- Zeichen in einer weißen Kachel (`bg-white/20`), Überfällig-Marke als Amber-Plakette.
- Die **Form bleibt die einer Karte** (`app-stat-card`, gleiche Ränder und Abstände wie die
  Kennzahlen) – der Unterschied ist die Farbe, nicht das Raster.

Damit gilt in der rechten Spalte: **farbige Karte = Aktion**, helle Karte = Kennzahl.
Geprüft in `frontend/tests/logistik-kacheln.spec.ts`: Die Fläche unterscheidet sich von der
Kennzahl-Karte daneben, die Schrift ist weiß, die Klasse `kpi-als-knopf` ist gesetzt und der
Text enthält „öffnen". Alle Browser-Tests grün (129).

## Nachtrag (DEC-097) – der Logistik-Knopf folgt der Demo (Glas + Verlauf)

**Auftrag des Inhabers:** „schau bitte mal hier `docs/demo-Logistik-Button.html` – so in der
Richtung soll es aussehen. Passe es an mein Design an, mit Glas und Gradient."

**Vorlage (Variante 7 „Glass" aus der Demo):** Glasfläche mit `backdrop-filter: blur(12px)`,
1-px-Weiß-Rand, 14-px-Radius, weicher farbiger Schatten plus Innen-Highlight; links ein
**Zeichen in einem Verlauf-Feld**, rechts **Zahl** über **„Logistik · Öffnen ›"**;
beim Überfahren heller, mit `translateY(-1px)`.

**So ist es umgesetzt** (`components/ui/LogistikKnopf.tsx`, `.logistik-knopf` in `index.css`):

| Demo | hier |
|---|---|
| festes Teal `#14b8a6` → `#0d9488` im Verlauf | **`--werk-hell` → `--werk`** – der Verlauf trägt die Farbe des Arbeitswerks |
| Schatten in Teal | `0 4px 16px var(--werk-line)` (Hover: `--werk-tinte-hover`) |
| `rgba(255,255,255,.75)` + `blur(12px)` | unverändert – dieselbe Glasfläche wie die Karten daneben |
| Radius 14 px, Padding 12/16 | `0.85rem` und `0.6rem/0.75rem`: die Maße der übrigen Bausteine |
| Pfeil › nach dem CTA | `ChevronRightIcon`, wandert beim Überfahren 2 px mit |
| „Logistik · **Öffnen ›**" | „Logistik · **Öffnen**“ in `--werk-text` |
| — | **Überfällig-Marke** als Amber-Plakette neben der Zahl (DEC-092) |

Regeln, die bleiben: Der Knopf steht **über** den Kennzahl-Karten (erst der Weg in den Bereich,
dann die Zahlen), die Spalte hält weiter vier Kennzahlen (DEC-083/095), und er ist der einzige
Baustein mit Verlauf. Die Knopf-Variante von `KpiKarte` (DEC-096, `alsKnopf`) ist entfallen –
sie war eine Zwischenstufe; die Glas-Demo hat sie ersetzt.

**Geprüft** (`frontend/tests/logistik-kacheln.spec.ts`): Glasfläche (`rgba(255,255,255,…)`),
Zeichen mit `linear-gradient` und weißer Schrift, Zahl = `orders_open`, Text „Öffnen",
Amber-Marke = `orders_old`, `aria-pressed` nach dem Klick. `logistics.spec` misst weiterhin die
Lage (Knopf über den Kennzahlen, ≤ 240 px). Browser 129 Tests grün.

