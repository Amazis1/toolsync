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
    Zeilenaktion **„Datenblatt"** im Werkzeug-Zeilenmenü (`RowActionMenu`), die die
    Datenblatt-Liste **auf diese Werkzeug-ID gefiltert** öffnet. Wer an der Maschine
    steht, kommt vom Werkzeug, nicht aus einer Liste.
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

# Ende der Projektentscheidungen
