# ToolSync – Serienartikel

> **Verbindliche Quellen:** `docs/01-requirements.md` (Abschnitt 6 „Serienartikel“, 13 „Suche“, 18 „Datenbank“), `docs/00-project-vision.md` (Abschnitt 8), `.continue/rules/02-domain-rules.md`.
>
> **Ist-Stand-Quellen:** `backend/app/models/serial_article.py`, `schemas/serial_article.py`, `routers/serial_articles.py`, `services/serial_article_service.py`, `crud/crud_serial_article.py`; `frontend/src/components/serial-articles/` (`SerialArticleList.tsx`, `SerialArticleUpload.tsx`, `PDFViewer.tsx`), `frontend/src/lib/api.ts`, `types/serial-article.ts`, `App.tsx`.
>
> Beschrieben wird der **tatsächlich implementierte** Stand. Abweichungen zu Anforderungen und Entscheidungen sind ausdrücklich als solche markiert.

## 1. Definition

> **Wichtig:** Ein Serienartikel ist in ToolSync ein **PDF-basierter Einrichteplan**. Er ist **kein** strukturierter Fachdatensatz, sondern ein Dokument mit wenigen Metadaten.

Der Bereich ist ein eigener Block der SPA: `TabKey = 'serienartikel'`, sichtbar als Tab „Serienartikel“ neben „Werkzeuge“, „Lager/Ersatz“ und „Historie“.

- **Route:** `routers/serial_articles.py`, Präfix `/api/serial-articles` (gesetzt in `main.py`)
- **Service:** `SerialArticleService` – Dateispeicherung, Pfadauflösung, Löschen
- **CRUD:** `CRUDSerialArticle` (`crud_serial_article.py`)
- **Model:** `SerialArticle`, Tabelle `serial_articles`
- **Schema:** `SerialArticleBase` / `SerialArticleCreate` / `SerialArticleUpdate` / `SerialArticleRead`
- **Frontend:** `SerialArticleList.tsx`, `SerialArticleUpload.tsx`, `PDFViewer.tsx`, Client in `lib/api.ts`

## 2. Funktionen

| Funktion | Umsetzung |
|---|---|
| Suchen | Suchleiste mit **300 ms Debounce**, Suche läuft **serverseitig** (`DEBOUNCE_MS = 300`) |
| Auflisten | Tabelle mit Artikelnummer, Beschreibung, PDF-Status, Aktionen |
| PDF anzeigen | „Vorschau“-Button öffnet den `PDFViewer` als Modal mit `<iframe>` |
| PDF herunterladen | „Herunterladen“-Button im Viewer (Blob-URL plus `<a download>`) |
| Anlegen / Hochladen | „+ Anlegen“ in der Tabbar öffnet `SerialArticleUpload`; Drag & Drop oder Klick |
| Löschen | „Löschen“ in der Liste mit `window.confirm` |
| Ersetzen | **nicht implementiert** – siehe Abschnitt 8 |

Ablauf „Vorschau“: `SerialArticleList` ruft `onOpenPdf(article)` → `App.tsx` setzt `viewingPdf` → `PDFViewer` lädt `GET /api/serial-articles/{id}/pdf` als Blob.

> **Wichtig:** Der „Vorschau“-Button erscheint nur, wenn `article.pdf_path` gesetzt ist. Ein Artikel ohne PDF ist sichtbar, aber nicht anzeigbar (Badge „Kein PDF“).

## 3. Felder des Modells

Tabelle `serial_articles` (`class SerialArticle(Base, AuditMixin)`); `id`, `created_at`, `updated_at` aus `AuditMixin`:

| Feld | Typ | Nullable | Bedeutung |
|---|---|---|---|
| `article_number` | `String(100)`, **`unique=True`** | nein | Artikelnummer, z. B. `01075000`; in der Liste als Mono-Badge |
| `description` | `String(500)` | ja | Optionaler Zusatztext |
| `pdf_path` | `String(500)` | ja | **Relativer** Speicherpfad, z. B. `uploads/serial_articles/<uuid>.pdf` |
| `extra_metadata` | `JSON` | ja | Reservefeld; im Ist-Stand **nie befüllt** |

> **Wichtig:** Das Feld heißt bewusst **`extra_metadata`**, nicht `metadata` – `metadata` ist in SQLAlchemy reserviert (Kommentar im Model).

Die Frontend-Spiegelung (`types/serial-article.ts`) enthält dieselben Felder (`id`, `article_number`, `description`, `pdf_path`, `extra_metadata`, `created_at`, `updated_at`). `SerialArticleInput` hat nur `article_number` und optional `description` – der Pfad wird **nie** vom Client gesetzt.

> **Wichtig:** `SerialArticleCreate` erbt zwar `pdf_path` und `extra_metadata` von `SerialArticleBase`, der Router `create_serial_article` baut das Objekt aber **explizit** nur aus `article_number` und `description` (multipart-Formularfelder). Ein mitgeschickter `pdf_path` wird ignoriert; `pdf_path` stammt ausschließlich aus dem Datei-Upload.

> **Offen:** `SerialArticleUpdate` ist definiert, es gibt jedoch **keinen** `PUT`/`PATCH`-Endpunkt. Das Schema ist derzeit ungenutzt.

## 4. Keine automatische Strukturierung der PDF-Inhalte

> **Wichtig (Anforderungen 6.3, Vision 8, Rules 02):** PDF-Inhalte werden **nicht** automatisch analysiert und **nicht** in einzelne Datenbankfelder überführt. Die PDF ist die primäre Informationsquelle.

Belege im Code:

- Es gibt **keine** PDF-Extraktionsbibliothek und **keinen** Aufruf, der den Dateiinhalt parst.
- `SerialArticleService._save_pdf()` liest die Bytes und schreibt sie unverändert: `content = await file.read()` → `f.write(content)`. Es findet **keine** Inhaltsprüfung statt.
- Geprüft wird nur die **Dateiendung** (`.pdf`/`.PDF`, sonst erzwungen `.pdf`); der **MIME-Typ** wird **nicht** geprüft.
- `CRUDSerialArticle.create_with_pdf()` schreibt `extra_metadata` nicht; die Oberfläche zeigt es nicht an.

Inhalte, die laut Anforderungen 6.2 **im PDF** verbleiben: Programmname, Bearbeitungszeit, benötigte Werkzeug-IDs, Anzahl der Hübe, Material, Maschine, weitere Einrichtinformationen.

> **Offen:** Eine spätere PDF-Inhaltsanalyse ist laut Anforderungen 6.3 eine mögliche Erweiterung und darf nicht ohne Entscheidung eingeführt werden. Nicht geklärt ist, ob `extra_metadata` dafür der vorgesehene Ort ist.

## 5. Endpunkte

Präfix `/api/serial-articles` (`main.py`: `app.include_router(serial_articles.router, prefix="/api/serial-articles", tags=["Serial Articles"])`).

| Methode | Pfad | Abhängigkeit | Antwort | Verhalten |
|---|---|---|---|---|
| `GET` | `/` | `require_active` | 200, `List[SerialArticleRead]` | Suche + Pagination |
| `GET` | `/{id}/pdf` | `require_active` | 200, `FileResponse` | PDF als `application/pdf`, `filename="<article_number>.pdf"` |
| `GET` | `/{id}` | `require_active` | 200 / 404 | Einzelartikel (`detail: "Serial article not found"`) |
| `POST` | `/` | `require_active` | 201 / 400 | `multipart/form-data` |
| `DELETE` | `/{id}` | `require_active` | 204 | Löscht DB-Zeile und, falls vorhanden, die PDF-Datei |

`POST /` erwartet `multipart/form-data` mit `article_number` (Pflicht, wird getrimmt), `description` (optional) und `file` (`UploadFile`, optional). Ein fehlendes PDF ist zulässig.

> **Wichtig:** `GET /{id}/pdf` ist in `routers/serial_articles.py` **vor** `GET /{id}` definiert. Der Code kommentiert das ausdrücklich: Stünde die generische Route zuerst, würde `/3/pdf` als `id="3/pdf"` interpretiert.

Fehlerfälle von `GET /{id}/pdf`:

| Situation | Status | `detail` |
|---|---|---|
| Artikel existiert nicht | 404 | `Serial article not found` |
| Artikel ohne `pdf_path` | 404 | `No PDF available for this serial article` |
| Datei auf dem Server fehlt | 404 | `PDF file is missing on the server` |

Suche und Pagination: `search` (`None`) prüft `article_number ILIKE '%wert%'` **oder** `description ILIKE '%wert%'`; `skip` (Default `0`) und `limit` (Default `100`, kein `le`-Limit) steuern die Menge. Der Client setzt nur `search` (`lib/api.ts#getSerialArticles`). Es gibt **kein** `order_by` – die Reihenfolge ist nicht garantiert.

> **Offen:** Keine Pagination in der Oberfläche und keine Gesamtzahl. Bei mehr als 100 Serienartikeln fehlen Datensätze stillschweigend (Anforderungen 13).

## 6. PDF-Speicherung und -Pfade

Konstante im Service: `UPLOAD_DIR = os.path.join("uploads", "serial_articles")` (`services/serial_article_service.py`).

| Aspekt | Ist-Stand |
|---|---|
| Speicherort | **relativ zum Arbeitsverzeichnis des Backends**, erwartet `D:\toolsync\backend\uploads\serial_articles\` |
| Verzeichnisanlage | `os.makedirs(UPLOAD_DIR, exist_ok=True)` beim ersten Speichern |
| Dateiname | `f"{uuid.uuid4().hex}{ext}"` – UUID gegen Kollisionen |
| DB-Wert | relativer Pfad mit **vorwärts** gerichteten Slashes: `os.path.join(...).replace("\\", "/")` |
| Auslieferung | `resolve_pdf_path(pdf_path)` gibt den Pfad **unverändert** zurück; der Router prüft `os.path.isfile(pdf_path)` und liefert `FileResponse(..., media_type="application/pdf")` |
| Download-Dateiname | `article_number` wird bereinigt: alle Zeichen außer `isalnum()` und `.-_` werden zu `_`; leer ergibt `serial-article` |
| Löschen | `delete()` liest die Zeile, ruft `_remove_pdf_file(pdf_path)` und löscht dann die DB-Zeile |

> **Wichtig:** Es gibt **keinen** statischen Mount für `uploads/`. Die PDF wird ausschließlich über `GET /api/serial-articles/{id}/pdf` ausgeliefert – also nur authentifiziert und nur über die Artikel-ID, nie über einen erratbaren URL-Pfad.

> **Offen / Abweichung:** `resolve_pdf_path()` ist derzeit eine Identitätsfunktion („Löst den gespeicherten (relativen) Pfad zum tatsächlichen Dateipfad auf“, tut aber nichts). Die Prüfung `os.path.isfile()` hängt damit am **Arbeitsverzeichnis des Backend-Prozesses**; bei einem Start aus einem anderen Verzeichnis antwortet `GET /{id}/pdf` mit 404. Es gibt **keine** Prüfung, dass der aufgelöste Pfad innerhalb von `UPLOAD_DIR` liegt.

> **Offen:** `_remove_pdf_file()` schluckt `OSError` bewusst („Fehler werden ignoriert“). Bleibt eine Datei liegen, ist sie verwaist, ohne dass dies sichtbar wird. Beim **Ersetzen** einer PDF würde niemand die alte Datei entfernen (kein Update-Endpunkt).

Im Repository existiert kein eingecheckter `backend/uploads/`-Ordner; das Verzeichnis entsteht erst zur Laufzeit.

## 7. PDF-Viewer (`PDFViewer.tsx`)

| Aspekt | Ist-Stand |
|---|---|
| Props | `{ article: SerialArticle, onClose: () => void }` |
| Laden | `getSerialArticlePdf(article.id)` in `useEffect` mit `[article.id]` |
| Anzeige | `URL.createObjectURL(blob)` → `<iframe src={pdfUrl} title={"PDF " + article.article_number}>` |
| Aufräumen | `URL.revokeObjectURL(objectUrl)` im Cleanup des Effects; `cancelled`-Flag gegen verspätete Responses |
| Zustände | `loading` (`ui-spinner`, „PDF wird geladen …“), `error` (`ui-alert-error`), Inhalt |
| Download | `handleDownload()` erzeugt ein `<a download={article.article_number + ".pdf"}>`, klickt es programmatisch und entfernt es wieder |
| Darstellung | Modal (`modal-overlay` / `modal-panel`), Höhe `h-[90vh]`, Breite `max-w-4xl` |

> **Wichtig:** Das PDF wird als **Blob** geladen, nicht per direktem `<iframe src="/api/…">`. Nur so kann der `Authorization: Bearer`-Header mitgeschickt werden (`lib/api.ts#getAuthHeaders()` liest das Token aus `localStorage`); ein direkter iframe-Aufruf auf die API-URL wäre unauthentifiziert und würde fehlschlagen.

> **Wichtig:** Der Button ist fest „Herunterladen“ beschriftet; ein „in neuem Tab öffnen“ gibt es nicht. Die Anzeige erfolgt immer im Modal – der Benutzer verlässt die Seite nicht (Zielformulierung aus Vision 8).

> **Offen:** Gerendert wird über den PDF-Plugin-Mechanismus des Browsers. Ohne integrierten Betrachter bleibt der iframe leer, ohne eigene Fehlermeldung.

## 8. Upload-Komponente (`SerialArticleUpload.tsx`)

| Aspekt | Ist-Stand |
|---|---|
| Props | `{ onCreated: (article: SerialArticle) => void, onClose: () => void }` |
| Bibliothek | `react-dropzone` (`useDropzone`) – die einzige zusätzliche Frontend-Abhängigkeit dieses Bereichs |
| Auswahl | `multiple: false`, `accept: { 'application/pdf': ['.pdf'] }` |
| Zusatzprüfung | `onDrop` prüft `selected.type.includes('pdf')` **oder** die `.pdf`-Endung, sonst „Bitte eine PDF-Datei auswählen.“ |
| Pflichtfeld | `article_number` (getrimmt); leer ergibt „Bitte eine Artikelnummer angeben.“ |
| Beschreibung | optional, `description.trim() || undefined` |
| Absenden | `createSerialArticle({ article_number, description }, file)` |
| Erfolg | `onCreated(created)` → `App.tsx` schließt das Formular und erhöht `refreshKey` |
| „Ersetzen“ in der Dropzone | Ersetzt nur die **noch nicht gesendete** Auswahl („Klicken, um zu ersetzen“) |

> **Wichtig:** `lib/api.ts#createSerialArticle` setzt **keinen** `Content-Type`-Header. Der Browser erzeugt die `multipart/form-data`-Boundary selbst; ein manuell gesetzter Header würde den Upload zerstören. Der Code kommentiert das ausdrücklich.

> **Wichtig:** Die Dateigröße wird **nicht** geprüft – weder im Frontend noch im Backend (`_save_pdf` liest `await file.read()` vollständig in den Speicher).

## 9. Berechtigungen

> **Wichtig (Anforderungen 6.1):** „Je nach Berechtigung können PDFs hochgeladen, ersetzt oder gelöscht werden.“

| Aktion | Abhängigkeit | Durchsetzung |
|---|---|---|
| Liste, Detail, PDF anzeigen/herunterladen | `require_active` | Server |
| Serienartikel anlegen (inkl. PDF-Upload) | `require_active` | Server |
| Serienartikel löschen (inkl. PDF-Datei) | `require_active` | Server |
| „+ Anlegen“-Button in der Tabbar | nur eingeloggter Benutzer (`user &&`) | **nur** Frontend |
| „Löschen“-Button in der Liste | keine Prüfung | **nur** Frontend |

> **Wichtig (Abweichung):** Der Bereich prüft **ausschließlich** `require_active`. Es gibt **keine** `require_admin`-Beschränkung und **keine** feingranulare Berechtigung. **Jeder aktive Benutzer** darf Serienartikel anlegen inklusive PDF-Upload und löschen inklusive Datei. Die geforderte Unterscheidung „je nach Berechtigung hochladen / ersetzen / löschen“ ist **nicht** umgesetzt; Rollen und Permissions aus dem Admin-Bereich werden hier nicht ausgewertet.

> **Wichtig:** Das Ausblenden von Buttons ist keine Sicherheitsmaßnahme. Da hier auch serverseitig nicht eingeschränkt wird, ist die Aussage „nur berechtigte Benutzer“ für diesen Bereich derzeit nicht zutreffend.

## 10. Abweichungen Code ↔ Anforderung

| Punkt | Anforderung | Ist-Stand |
|---|---|---|
| Ersetzen einer PDF | Anforderungen 6.1 nennt es ausdrücklich | **Kein** Update-Endpunkt, **keine** Update-Funktion im Client, **kein** Ersetzen-Button. `SerialArticleUpdate` existiert, wird aber nicht verwendet. |
| Berechtigungsabhängige Aktionen | Anforderungen 6.1 „je nach Berechtigung“ | Alle Aktionen nur `require_active`, kein Rechte-Modell |
| Pagination / große Datenmengen | Anforderungen 13 | Keine Pagination; `limit=100` im Router, `skip`/`limit` vom Client nie gesetzt |
| `extra_metadata` | Nicht gefordert | Vorhanden und nullable, aber ungenutzt |
| Doppelter, toter Code | – | `routers/serial_articles.py#delete_serial_article` enthält nach `return None` zwei unerreichbare Zeilen (`await service.delete(id)` und erneut `return None`). Funktional ohne Wirkung. |
| Kein PDF-Inhalt in DB-Feldern | Anforderungen 6.2/6.3 erfüllt | Bestätigt: kein Parsing, `_save_pdf()` schreibt Bytes unverändert |

## 11. Offene Fragen

- Soll ein `PUT`/`PATCH`-Endpunkt zum Ersetzen von Beschreibung und PDF ergänzt werden, und wer entfernt dabei die alte Datei?
- Welche Berechtigung soll Hochladen, Ersetzen und Löschen von Serienartikeln steuern (`require_admin` oder eine eigene Permission wie `serial_articles:write`)?
- Soll die PDF-Dateigröße begrenzt werden (Frontend und/oder Backend)?
- Soll `resolve_pdf_path()` einen konfigurierbaren absoluten Basisordner verwenden und prüfen, dass der aufgelöste Pfad innerhalb von `UPLOAD_DIR` liegt?
- Soll die MIME-Typ-Prüfung der hochgeladenen Datei ergänzt werden, damit nicht jede beliebige Datei als `.pdf` gespeichert wird?
- Wird `extra_metadata` als Ablage für später extrahierte PDF-Felder vorgesehen, oder entfällt das Feld?
- Soll `_remove_pdf_file()` Fehler nicht mehr still ignorieren, damit verwaiste Dateien auffallen?
- Wird der doppelte, unerreichbare Code in `delete_serial_article` entfernt?
- Soll die Liste paginiert werden (Anforderungen 13), und wird eine Gesamtzahl benötigt?
- Soll der Bereich eine Verknüpfung zu Werkzeug-IDs erhalten (Einrichtepläne nennen benötigte Werkzeug-IDs), oder bleibt die PDF alleinige Quelle?
