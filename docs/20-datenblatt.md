# ToolSync – Datenblatt

> **Verbindliche Quellen:** `docs/13-decisions.md` → **DEC-065** (Bereich, Felder,
> Rechte, Abgrenzung), **DEC-066** (Tab-Struktur); als Vorbild **DEC-056**, **DEC-057**
> und **DEC-062** (Serienartikel: Felder, Artikelordner, mehrere Dateien),
> **DEC-063** (Listenoptik), **DEC-052** (Mehrfach-ID),
> **DEC-055** (Werkzeug-ID nur beim Stempel Pflicht).
> `docs/01-requirements.md` Abschnitt 6.2/6.3 (Inhalt der PDF, keine
> automatische Strukturierung), Abschnitt 19 (Frontend und UX).
>
> **Ist-Stand-Quellen:** `backend/app/models/data_sheet.py`,
> `schemas/data_sheet.py`, `crud/crud_data_sheet.py`,
> `services/data_sheet_service.py`, `routers/data_sheets.py`, Migration
> `c4b9e7a15f28`; `frontend/src/types/data-sheet.ts`, `api/dataSheets.ts`,
> `components/data-sheets/` (`DataSheetList.tsx`, `DataSheetForm.tsx`),
> `types/viewer.ts`, `lib/viewerSources.ts`; Tests
> `frontend/tests/data-sheets.spec.ts`.
>
> ✅ **Status: entschieden und umgesetzt** (DEC-065, TASK-024 Schritt 3).
> Beschrieben wird der **tatsächlich implementierte** Stand (inkl. Nachtrag TASK-026: Bilder, Name-Kennung, Maschinenfarbe); Abweichungen sind als
> **Abweichung** markiert, Unklares als **Offen**.

## 1. Definition

Ein **Datenblatt** ist ein **PDF-basiertes Dokument mit den Einstellwerten eines
Werkzeugs für eine Maschine** – also die Werte, mit denen das Werkzeug in der
Maschine eingerichtet wird. Es ist ein **eigener Fachbereich** mit eigenem Tab
„Datenblätter" (DEC-066).

> **Wichtig – Abgrenzung zum Serienartikel:** Der **Serienartikel** ist ein
> Einrichteplan für einen **Auftrag/Artikel** (Programmname, Bearbeitungszeit,
> benötigte Werkzeug-IDs, Anzahl der Hübe, Material) und hat **keine** Beziehung zu
> Werkzeugen (DEC-056 Punkt 1). Das **Datenblatt** gehört zum **Werkzeug** und
> beantwortet „wie wird dieses Werkzeug eingerichtet". Beide sind PDFs und beide
> dienen dem Einrichten – deshalb tragen sie verschiedene Namen.

> **Wichtig – Namensregel:** Das Dokument heißt **überall „Datenblatt"** (Tab,
> Formular, Liste, Meldungen, Doku) – Entscheidung des Projektinhabers. Im Feld
> „Werkzeug-ID" bleibt der Bezug zum Werkzeug ausdrücklich sichtbar.

Ein Datenblatt wird gefunden über **Werkzeug-ID, Name, Beschreibung, Werk und
Maschine**. Werk ist **freiwillig** (DEC-085), Werkzeug-ID und Maschine ebenfalls; Werk und
Maschine sind **Stammdaten** aus dem Admin-Bereich (Auswahl, kein Freitext).

## 2. Funktionen

| Funktion | Umsetzung |
|---|---|
| Suchen | Suchfeld **ohne sichtbare Beschriftung** (Lupe links, `aria-label`, Löschknopf, Ladeanzeige), **serverseitig** über Werkzeug-ID, Name, Beschreibung, Werk- und Maschinenname – wie in der Serienartikel-Liste (DEC-063 Nr. 6) |
| Filtern | **Werk als Segmente** (Radios, „Alle" + je Werk) und **Favoriten** als Umschalter |
| Sortieren | Klick auf den Spaltenkopf: aufsteigend → absteigend → Standardsortierung (Werkzeug-ID); `aria-sort`, SVG-Sortierzeichen, leere Werte am Ende (NULLS LAST) |
| Blättern | Blätterleiste `.ui-pagination` mit Bereichsangabe und Gesamtzahl aus `total` |
| Auflisten | Tabelle in **Werkzeug-Optik**: **Werkzeug-ID** als Kennung in Mono (Teal-Kante) und der **Name** als zweite Kennung in Mono (Sky-Kante) – genau wie Artikelnummer und Name in der Serienartikel-Liste (DEC-063); darunter die Beschreibung klein und grau. Werk, **Maschine mit Farbpunkt aus den Stammdaten** (DEC-067), Dateien („PDF", „Kein PDF", „N PDFs", „N Bilder"), Aktionen |
| Anlegen | **nur Admin** – im Sub-Reiter „Datenblatt" des Anlegeformulars und über „+ Anlegen" im Kopf des Bereichs |
| Bearbeiten | **nur Admin** – Zeilenmenü „Bearbeiten" |
| Löschen | **nur Admin** – Zeilenmenü „Löschen" mit Bestätigungsdialog (Objektname + Konsequenz); entfernt Zeile, Dateien und Ordner |
| Dateien ansehen | **Klick auf die Zeile** öffnet das Datei-Fenster (Split-Screen) mit dem ersten Datenblatt |
| Datenblatt herunterladen | „Herunterladen" im Datei-Fenster |
| Dateien hinzufügen | Im Formular mehrere PDFs auf einmal; sie **kommen hinzu**, keine ersetzt eine andere (wie DEC-062) |
| Datei löschen | „Löschen" je Datei im Formular oder „Datenblatt entfernen" im Datei-Fenster, mit Bestätigungsdialog – **nur Admin** |
| Favorit | Umschalter je Zeile, **global** (nicht pro Benutzer) – wie DEC-063 |

Leerzustände wie in den anderen Listen: „Noch keine Datenblätter vorhanden." (mit
Anlegen-Knopf für Admins), „Keine Treffer für „…"" und „Keine Datenblätter für
dieses Werk." – beide mit „Filter zurücksetzen".

## 3. Felder des Modells

Tabelle `data_sheets` (`class DataSheet(Base, AuditMixin)`); `id`, `created_at`,
`updated_at` aus `AuditMixin`:

| Feld | Typ | Nullable | Bedeutung |
|---|---|---|---|
| `tool_id` | `String(50)`, `index=True` | **ja** | **Werkzeug-ID**; empfohlen, aber nicht Pflicht (DEC-055: Abstreifer/Matrize dürfen ohne ID existieren) |
| `plant_id` | FK → `plants.id`, `ondelete="RESTRICT"` | **ja** | Werk – **freiwillig** (DEC-085): `NULL` = gilt für alle Werke |
| `machine_id` | FK → `machines.id`, `ondelete="SET NULL"` | ja | die Maschine, für die die Werte gelten |
| `name` | `String(200)` | ja | Bezeichnung des Datenblatts |
| `description` | `String(500)` | ja | Zusatztext |
| `pdf_path` | `String(500)` | ja | **relativer** Pfad, z. B. `uploads/data_sheets/7/plan.pdf` |
| `is_favorite` | `Boolean`, Default `false` | nein | global, nicht pro Benutzer (DEC-063) |

Beziehungen `plant` und `machine` sind `lazy="joined"` – sie stehen als Spalten in
der Liste und in der Antwort.

> **Wichtig:** Die Antwort enthält **nicht** `pdf_path`, sondern **`has_pdf`** und
> die Dateiliste `plans` (Name, Größe) – der Speicherpfad bleibt intern, wie beim
> Serienartikel.
>
> **`has_pdf` kommt aus der Dateiliste**, nicht aus der Spalte `pdf_path`
> (`_to_read` in `routers/data_sheets.py`): gezählt wird, was im Ordner liegt.
> Beides kann auseinanderlaufen, wenn eine Datei außerhalb der Anwendung
> verschwindet – eine Antwort mit `has_pdf: true` und leerer `plans`-Liste wäre
> in sich widersprüchlich, und die Zeilenaktion „Datenblatt" in der Werkzeugliste
> hängt an diesem Feld.

> **Wichtig:** Es gibt **keine** Fremdschlüsselbindung an `tools.id`. Eine
> Werkzeug-ID darf laut DEC-052 mehrfach existieren (mehrere Exemplare) und laut
> DEC-055 leer sein; ein Datenblatt gilt für die **ID**, also für alle Exemplare.
> Wird ein Werkzeug gelöscht, bleibt das Datenblatt auffindbar.

> **Wichtig:** Am Datenblatt gibt es **keinen Kunden** – Einstellwerte gelten für
> Werkzeug und Maschine, nicht für einen Auftraggeber (Unterschied zum Serienartikel).

> **Wichtig:** `tool_id` ist **kein Ersatz für die Artikelnummer.** Das Feld heißt
> „Werkzeug-ID"; ein zweites Identitätsfeld gibt es nicht (DEC-065 Punkt 4).

## 4. Keine automatische Strukturierung der PDF-Inhalte

> **Wichtig (Anforderungen 6.2/6.3, unverändert):** Der **Inhalt** des PDFs wird
> **nicht** analysiert und **nicht** in Datenbankfelder überführt. Einstellwerte,
> Drücke, Hübe, Taktzeiten und weitere Einrichtinformationen bleiben ausschließlich
> im Dokument. Geprüft wird nur die **Dateiendung** (`.pdf`, sonst HTTP 400).

Strukturiert geführt werden ausschließlich die **Auffang-Angaben** Werkzeug-ID,
Werk, Maschine, Name und Beschreibung – sie machen das Datenblatt auffindbar, ohne
den Inhalt zu deuten.

## 5. Endpunkte

Präfix `/api/data-sheets`.

| Methode | Pfad | Abhängigkeit | Antwort | Verhalten |
|---|---|---|---|---|
| `GET` | `/` | `require_active` | 200, `DataSheetPage` | Suche, Filter, Sortierung, Seitenausschnitt + `total` |
| `GET` | `/{id}` | `require_active` | 200 / 404 | Einzeldatensatz inkl. `plans` und `images` |
| `GET` | `/{id}/files/{name}` | `require_active` | 200, `FileResponse` | Eine Datei des Datensatzes; Pfadanteile im Namen sind abgewiesen |
| `POST` | `/` | **`require_admin`** | 201 / 400 | `multipart/form-data`: Felder + `plans` (mehrfach, PDF) + `images` (mehrfach, Bilder) |
| `PUT` | `/{id}` | **`require_admin`** | 200 / 400 / 404 | Ändern, Dateien ergänzen |
| `DELETE` | `/{id}/files/{name}` | **`require_admin`** | 204 / 404 | Eine Datei entfernen |
| `PUT` | `/{id}/favorite` | `require_active` | 200 / 404 | Favorit setzen/entfernen (global, **kein** Admin-Recht) |
| `DELETE` | `/{id}` | **`require_admin`** | 204 / 404 | Löscht Zeile, Dateien und den Ordner des Datensatzes |

**Parameter der Liste:** `search`, `plant_id`, `machine_id`, `has_pdf`, `sort`
(`tool_id`, `name`, `plant`, `machine`, `created_at`), `order` (`asc`/`desc`),
`favorites_only`, `skip`, `limit`. `sort` und `order` sind `Literal`-Typen: ein
unbekannter Spaltenname ergibt **HTTP 422**, nie eine Abfrage mit beliebigem
Spaltennamen. Sortierung mit **NULLS LAST** in beide Richtungen und `id` als
Tiebreaker.

> **`has_pdf` als Filter** fragt die Spalte `pdf_path` ab, das **Ergebnis** meldet
> `has_pdf` aus der Dateiliste. Normalerweise geht das zusammen – nur wenn eine
> Datei außerhalb der Anwendung verschwindet, läuft der Filter der Anzeige kurz
> nachher. Die Oberfläche nutzt den Filter nicht.

**Formularwerte bei `PUT`:** ein **fehlendes** Feld bedeutet „unverändert", ein
**leerer** Wert bedeutet „Feld leeren" (Werkzeug-ID, Name, Beschreibung, Maschine).
Auch das **Werk** ist freiwillig und lässt sich leeren – dann gilt der Datensatz für alle Werke (DEC-085). Mitgeschickte Dateien **kommen
hinzu**; entfernt wird einzeln über `DELETE /{id}/files/{name}`.

**Fehlerfälle** (Meldungen deutsch, wie im Serienartikel):

| Situation | Status | `detail` |
|---|---|---|
| Datensatz existiert nicht | 404 | `Datenblatt nicht gefunden` |
| Kein Werk angegeben | 400 | `Bitte ein Werk auswählen.` |
| Werk/Maschine existiert nicht mehr | 400 | `Das gewählte Werk gibt es nicht mehr. Lade die Seite neu.` (sinngemäß für Maschine) |
| Datei ist keine PDF | 400 | `Bitte eine PDF-Datei auswählen.` |
| Datei unbekannt oder Pfadanteil im Namen | 404 | `Diese Datei gibt es nicht` |

## 6. Ablage und Ordner

| Aspekt | Ist-Stand |
|---|---|
| Speicherort | `uploads/data_sheets/<id>/` – aufgelöst gegen das **Backend-Verzeichnis**, nicht gegen das Arbeitsverzeichnis |
| Ordnerschlüssel | die **Datensatz-ID** (nicht die Werkzeug-ID): sie ist eindeutig, leerzeichen- und sonderzeichenfrei und ändert sich beim Umbenennen von Werkzeug-IDs nicht |
| Übersteuerbar | Umgebungsvariable `TOOLSYNC_UPLOAD_DIR` (wie beim Serienartikel) |
| Ordneranlage | beim **Anlegen**, auch ohne Datei |
| Dateinamen | erster Plan `plan.pdf` (Altbestand), weitere `plan-2.pdf`, `plan-3.pdf` … |
| Anzahl | **mehrere Datenblätter je Datensatz** erlaubt (DEC-065 Punkt 7); die Nummer im Namen bestimmt die Reihenfolge |
| `pdf_path` | zeigt auf den **ersten** Plan und wird nach jedem Schreiben/Löschen nachgeführt; ohne Plan ist es leer. Es ist die **Ablage-Notiz** für die Suche – die Antwort meldet `has_pdf` aus der Dateiliste (siehe Abschnitt 3) |
| Auslieferung | `resolve_file()` löst relativ zur Ablage auf und prüft, dass die Datei **innerhalb** der Wurzel liegt – sonst `None` → HTTP 404 |
| Löschen | erst die Dateien, dann der Ordner, dann die Datenbankzeile |

> **Wichtig:** Es gibt **keinen** statischen Mount für `uploads/`. Dateien werden
> ausschließlich über `/api/data-sheets/{id}/files/{name}` ausgeliefert – also nur
> authentifiziert und nur über die Datensatz-ID, nie über einen erratbaren URL-Pfad.

> **Unterschied zum Serienartikel:** Der Artikelordner ist nach der
> **Artikelnummer** benannt (DEC-057), weil diese eindeutig und sprechend ist. Beim
> Datenblatt gibt es keine solche Kennung – die Werkzeug-ID ist weder eindeutig noch
> Pflicht –, deshalb ist der Ordnername die **ID**.

## 7. Datei-Fenster

Es wird **derselbe Betrachter** verwendet wie für Serienartikel
(`frontend/src/components/serial-articles/PDFViewer.tsx`) – Split-Screen mit
Dateiliste links und großer Ansicht rechts. Dafür wird genau **eine** Sache
geändert: Die Komponente bekommt ihre Datei-Ladeschicht **von außen** (Prop bzw.
austauschbarer Client), statt `getSerialArticleFile()` fest zu importieren.

> **Wichtig:** Das Datenblatt lädt sein PDF ebenfalls als **Blob**, nicht über einen
> direkten `<iframe src="/api/…">` – nur so wird der `Authorization: Bearer`-Header
> mitgeschickt.

> **Wichtig:** Die **Serienartikel-Logik bleibt unverändert.** Ordner, Service und
> Endpunkte der Serienartikel werden für das Datenblatt **nicht** angefasst; der
> generalisierte Betrachter ist der kleinste gemeinsame Eingriff.

## 8. Formular

**Ein** Formular, **kein** eigenes Fenster: Es sitzt im Anlege-Formular im
Sub-Reiter **„Datenblatt"** (DEC-066). Aufbau und Feldlogik folgen dem
Serienartikel-Formular (DEC-056 Punkt 5) mit diesen Abweichungen:

| Serienartikel | Datenblatt |
|---|---|
| Artikelnummer (Pflicht, eindeutig) | **Werkzeug-ID** (freiwillig, nicht eindeutig, mit Hinweis statt Blockade) |
| Werk (Pflicht) | Werk (Pflicht) |
| Kunde, Maschine | **Maschine** (die Einstellwerte gelten je Maschine); **kein Kunde** |
| Name, Beschreibung | Name und Beschreibung; die Beschriftung „Beschreibung" steht **über** dem Feld (mehrzeilig), nicht als Innenlabel darin |
| Einrichteplan + Bilder, mehrere | **Datenblätter (PDF) und Bilder, mehrere** |

| Aspekt | Ist-Stand |
|---|---|
| Feldaufbau | wie im Werkzeugformular: **Innenlabel** (`.ui-field`, Guide §1.9), Meldungen direkt am Feld |
| Dateifeld | **ein** Feld für beides (DEC-060): Mehrfachauswahl oder Drag & Drop, `accept` erlaubt PDF **und** Bilder; PDF wird ein Datenblatt, alles andere ein Bild. Unter dem Feld „Hinterlegte Dateien" (Name, KB, Bilder mit Vorschaubild, einzeln löschbar) und „Kommt beim Speichern dazu" (mit Art: „Datenblatt" oder „Bild") |
| Pflichtprüfung | Werk („Bitte ein Werk auswählen.") |
| Hinweis statt Blockade | Wird ohne Werkzeug-ID gespeichert: „Ohne Werkzeug-ID ist das Datenblatt nur über Werk, Maschine und Namen zu finden." |
| Absenden | `POST` beim Anlegen, `PUT` beim Bearbeiten – `multipart/form-data` |
| Erfolg (Anlegen) | Meldung im Formular, Reiter bleibt offen, Dateifeld geleert, Werk/Maschine bleiben |
| Speichern-Knopf | „Datenblatt anlegen" / „Änderungen speichern" / „Wird gespeichert …" |

## 9. Berechtigungen

| Aktion | Abhängigkeit | Durchsetzung |
|---|---|---|
| Liste, Detail, Datei anzeigen/herunterladen | `require_active` | Server |
| Datenblatt anlegen / ändern / Datei entfernen | `require_admin` | Server |
| Datenblatt löschen (inkl. Ordner) | `require_admin` | Server |
| Favorit setzen/entfernen | `require_active` | Server |
| Knöpfe „+ Anlegen", „Bearbeiten", „Löschen" sichtbar | `user.is_admin` | **nur** Frontend (zusätzlich serverseitig geprüft) |

> **Wichtig:** Das Ausblenden der Knöpfe ist die Oberfläche, nicht die
> Sicherheitsmaßnahme – die Durchsetzung passiert serverseitig über
> `require_admin`, wie beim Serienartikel (DEC-056 Punkt 4).

## 10. Erreichbarkeit

Ein Datenblatt ist auf **zwei** Wegen erreichbar (DEC-065 Punkt 10, DEC-069):

1. **Tab „Datenblätter"** – die Ablage, durchsuchbar über alle Datensätze.
2. **Symbol in der Werkzeugzeile** – neben dem „…"-Knopf der Spalte „Aktionen".
   Es steht **nur**, wenn es zu dieser Werkzeug-ID ein Datenblatt **mit Datei**
   gibt (`has_data_sheet`, DEC-068), und öffnet das Dokument **direkt** im
   Datei-Fenster. Kein Bereichswechsel, keine vorbelegte Suche: wer an der
   Maschine steht, kommt vom Werkzeug, nicht aus einer Liste. Gibt es mehrere
   Datenblätter zu der ID, öffnet das erste und ein Hinweis nennt die Anzahl.

> **Warum kein Weg über die gefilterte Liste mehr:** Bis DEC-069 wechselte die
> Zeilenaktion in den Bereich „Datenblätter" und belegte die Suche mit der ID
> vor – auch dann, wenn es gar kein Datenblatt gab. Der Benutzer landete in einer
> fremden Ansicht mit einer Suche, die er nicht gestellt hatte. Jetzt sagt das
> Symbol selbst, ob es etwas zu öffnen gibt (es fehlt sonst), und der Klick
> öffnet genau das.

## 11. Bekannte Grenzen

| Punkt | Stand |
|---|---|
| Werkzeug-ID nicht eindeutig | Ein Datenblatt gilt für die ID, nicht für ein Exemplar. Bei mehreren Exemplaren derselben ID ist nicht unterscheidbar, welches gemeint ist – bewusst in Kauf genommen (DEC-052/055). |
| Werkzeug-ID freiwillig | Datenblätter ohne ID sind nur über Werk, Maschine und Namen auffindbar. |
| Bilder | **Umgesetzt:** `bild-1.jpg`, `bild-2.png` … im Ordner des Datensatzes, mit Vorschaubildern (max. 400 px, JPEG). Geprüft wird nur die Endung. |
| Keine Verknüpfung zum Serienartikel | Beide Bereiche bleiben getrennt; es gibt keinen automatischen Bezug. |
| Kein PDF-Betrachter auf allen Geräten | Gerendert wird über den PDF-Plugin-Mechanismus des Browsers; ohne integrierten Betrachter bleibt die Fläche leer (wie in `docs/06-serial-articles.md` §7). |
| Keine Größenprüfung | Die Dateigröße wird weder im Frontend noch im Backend begrenzt (bewusst, wie DEC-056 Punkt 12). |

## 12. Offene Fragen

1. Soll die Suche auch den **Werkzeug-Typ** einbeziehen (das Datenblatt würde dann
   über den Typ auffindbar, ohne die ID zu kennen)?
2. Soll der **Download-Dateiname** die Werkzeug-ID enthalten (`<Werkzeug-ID>_<Name>.pdf`)?
3. ~~Sollen später **Bilder** am Datenblatt möglich sein~~ → **erledigt (TASK-026)**: ja, im selben Dateifeld wie die Datenblätter.
   Vorbild DEC-058)?
4. Soll es eine **Versionskennung** am Datenblatt geben (z. B. „gültig ab"), damit
   ältere Stände erkennbar bleiben, statt sie zu löschen?
5. Soll der **Maschinenbezug Pflicht** werden, wenn Einstellwerte ohne Maschine
   fachlich keinen Sinn ergeben?
