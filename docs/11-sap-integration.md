# ToolSync – SAP-Integration

> Verbindliche Quellen: `docs/01-requirements.md` (**16 „SAP"**),
> `docs/00-project-vision.md` (**4 „SAP"**), `docs/13-decisions.md`,
> `docs/14-architecture.md`, `tasks/04-target-architecture.md`,
> `.continue/rules/09-sap-optional.md`. Aufbau: Grundsatz (1–6), dann der
> geprüfte Ist-Stand — eine **Null-Aussage**, belegt in Abschnitt 7.

## 1. Grundsatz

> **Wichtig:** SAP ist **optional**. ToolSync muss vollständig ohne SAP
> funktionieren. SAP ist ausschließlich eine optionale spätere
> Integrationsmöglichkeit.

`docs/01-requirements.md` Abschnitt 1 und 16, wörtlich: „Das System muss im
Kern vollständig ohne SAP funktionieren." · „SAP ist ausschließlich eine
optionale spätere Integrationsmöglichkeit." · „Eine spätere SAP-Integration
soll über einen klar getrennten Integration Layer erfolgen."
`docs/00-project-vision.md` Abschnitt 4: „SAP darf keine Voraussetzung für die
Nutzung des Systems sein."

`docs/14-architecture.md` führt SAP nicht als Stack-Technologie, sondern als
Ausnahme: externe Abhängigkeiten „keine für den Kernbetrieb", Betrieb
on-premise mit lokaler Auth (kein OAuth/SSO), SAP optional und „darf den
Core-Betrieb nicht blockieren" (DEC-001), API-seitig „SAP nicht als
Abhängigkeit in den Kern-Endpunkten; später nur über Integration Layer".
`tasks/04-target-architecture.md` nennt unter „SAP" genau zwei Zeilen:
„Optional" und „Integration Layer" — SAP ist damit kein Architekturbaustein,
sondern ein **Platzhalter für einen späteren optionalen Baustein**.

## 2. Was SAP nicht voraussetzen darf

`docs/01-requirements.md` Abschnitt 16: „SAP darf keine Voraussetzung für:
Login, Benutzerverwaltung, Werkzeugverwaltung, Werkzeugtypen, Lager,
Lagerorte, Bestand, Ausleihe, Rückgabe, Serienartikel sein."
`docs/00-project-vision.md` Abschnitt 4 nennt dieselbe Liste und zusätzlich
**Rollen und Berechtigungen** sowie **Werkzeugbewegungen**.

| Kernfunktion | Requirements | Vision | Heute SAP-frei? |
|---|---|---|---|
| Login | ja | ja | ja — `backend/app/routers/auth.py` |
| Benutzerverwaltung | ja | ja | ja — `routers/users.py` |
| Rollen und Berechtigungen | (15) | ja | ja — `routers/roles.py` |
| Werkzeugverwaltung / Werkzeugtypen | ja | ja | ja — `routers/tools.py` |
| Lager / Lagerorte | ja | ja | ja — `routers/storage_items.py`, `routers/locations.py` |
| Bestand | ja | ja | ja — Teil der Werkzeug-/Positionsmodelle |
| Ausleihe / Rückgabe / Bewegungen | ja | ja | ja — `routers/movements.py` (`lend`, `return`), `services/movement_service.py` |
| Serienartikel | ja | ja | ja — `routers/serial_articles.py` |

> **Wichtig:** Diese Tabelle ist der Prüfmaßstab. Fällt eine dieser Funktionen
> künftig aus, sobald SAP nicht erreichbar ist, ist die Anforderung verletzt —
> unabhängig davon, wie sauber der Integration Layer gebaut ist.

## 3. Integration Layer (geplant, nicht vorhanden)

- `docs/01-requirements.md` 16: Integration „**soll** über einen klar getrennten
  Integration Layer erfolgen"; `docs/00-project-vision.md` 4 sagt dagegen nur
  „**kann** … erfolgen" (abgeschwächt; nach der Rangfolge in Abschnitt 16 der
  Vision hat die Anforderung Vorrang).
- `docs/14-architecture.md`: Anbindung „ausschließlich über einen getrennten
  Integration Layer, damit der Kernbetrieb ohne SAP vollständig funktioniert";
  `.continue/rules/09-sap-optional.md`: „SAP nur über einen klaren
  Adapter/Integration Layer" und „Die aktuelle Phase ist SAP-frei".

Abgeleitete Architekturregeln: (1) Der Integration Layer ist eine **eigene
Schicht**; die Kern-Router in `backend/app/main.py` (`/api/auth`, `/api/users`,
`/api/tools`, `/api/locations`, `/api/movements`, `/api/serial-articles`,
`/api/storage`, `/api`, `/api/roles`) dürfen **keinen** direkten SAP-Aufruf
enthalten. (2) SAP-Zugriffe gehören in ein eigenes Modul (z. B.
`backend/app/integration/`), nicht in `services/tool_service.py` oder
`services/location_service.py`. (3) Einbahnstraße: Integration → Core über
definierte Schnittstellen, niemals Core → Integration. (4) „Nicht vorbereitend
eingebaut" heißt: **keine** SAP-Stubs, SAP-Felder oder SAP-Spalten in
Migrationen; die Endpunkt-Verträge bleiben unverändert.

## 4. Adapter-Prinzip

Die Continue Rule fordert ausdrücklich einen **Adapter**: ein Austrittspunkt
(alle SAP-Zugriffe laufen über genau einen Adapter), eine definierte
Schnittstelle (der Core ruft eine ToolSync-eigene Schnittstelle auf, keine
SAP-Typen), Übersetzung statt Durchreichung (SAP-Strukturen werden in `Tool`,
`ToolRead`, `Plant`, `ToolType` übersetzt), keine Rückwärtsabhängigkeit (der
Adapter kennt den Core, der Core kennt SAP nicht) sowie Ersetzbarkeit und
Fehlergrenze (anderer Mandant oder Test-Doppel ohne Core-Änderung
austauschbar; SAP-Fehler werden im Adapter abgefangen → Abschnitt 6).

> **Offen:** Welche SAP-Schnittstelle verwendet werden soll (RFC/BAPI, OData,
> IDoc, Middleware) ist in keiner verbindlichen Quelle festgelegt — es heißt
> überall nur „Integration Layer" bzw. „Adapter".

## 5. Mapping und Sync

`.continue/rules/09-sap-optional.md`: „Mapping und Sync zwischen SAP und
ToolSync bewusst und dokumentiert." Dokumentierter Berührungspunkt —
`docs/14-architecture.md` nennt SAP an genau einer fachlichen Stelle: Feld
`tool_id` („Werkzeug-ID, manuell eingegeben (z. B. 01056000) **oder aus SAP
übernommen**") und `POST /api/tools` („Werkzeug anlegen; ID manuell **oder aus
SAP**; Eindeutigkeit pro Werk+Kategorie prüfen (DEC-035)"). Als Vorschlag
ergänzt `docs/archive/14-gap-analysis.md` (PROPOSED / OPEN): „Kernmodelle
SAP-frei halten; ID-Übernahme aus SAP als Import-Funktion."

> **Wichtig:** Damit ist heute **genau ein** fachlich dokumentierter
> Berührungspunkt bekannt: die **Werkzeug-ID**. Alles andere wäre erfunden: für
> `Plant`, `ToolType`, `Position`, `ToolStatus`, Benutzer und Rollen ist kein
> SAP-Mapping dokumentiert, und die Eindeutigkeitsregel
> `tool_id + category + plant_id + is_storage` (DEC-052) ist eine
> **ToolSync-Regel**, keine SAP-Regel.
> **Offen:** Richtung des Syncs (Import, Export, bidirektional), Frequenz
> (Batch oder ereignisbasiert) und Konfliktregel sind **nirgends** festgelegt.

## 6. Fehlerverhalten

> **Wichtig:** SAP-Fehler dürfen den Core-Betrieb nicht unbenutzbar machen.
> (`.continue/rules/09-sap-optional.md`)

1. **Kein SAP-Zwang im Startpfad.** `backend/app/main.py` startet heute ohne
   jeden externen Aufruf (nur `Base.metadata.create_all`, Router-
   Registrierung); ein SAP-Aufruf dort würde den API-Start blockieren.
2. **Kein SAP-Zwang in Kern-Endpunkten.** `POST /api/auth/login`,
   `GET /api/tools`, `GET /api/locations/*`, `GET /api/serial-articles` müssen
   ohne SAP antworten; ein SAP-Timeout darf höchstens ein optionales Zusatzfeld
   leer lassen, nicht den Request scheitern lassen.
3. **Fehler isolieren und degradieren.** SAP-Fehler werden im Adapter
   abgefangen und als ToolSync-Fehler mit klarer Meldung zurückgegeben; ohne
   SAP arbeitet ToolSync mit eigenen Daten weiter.
4. **Sichtbarkeit ohne Blockade.** Ein SAP-Ausfall muss für den Admin erkennbar
   sein, ohne normale Benutzer zu blockieren (`.admin-alert`).
5. **Keine stillen Datenverluste.** Scheitert ein Sync, darf ToolSync keine
   Werkzeugdatensätze verwerfen oder überschreiben; ob ein Konfliktprotokoll
   geführt oder ein Retry vorgesehen wird, ist **offen**.

## 7. Aktueller Umsetzungsstand: nichts implementiert

**Ergebnis: keine SAP-Implementierung — kein SAP-Code, keine SAP-Abhängigkeit,
kein SAP-Feld, kein SAP-Endpunkt.**

| Suchort | Muster | Ergebnis |
|---|---|---|
| `backend/` (ganzer Baum) | `(?i)sap`, `integration_layer`, `adapter`, `external` | **0 Treffer** |
| `backend/app/routers/` | alle 69 Routendekoratoren | kein SAP-Endpunkt |
| `backend/app/main.py` | vollständig gelesen | 9 Router registriert, **kein** Integration-Router (`/api/auth`, `/api/users`, `/api/tools`, `/api/locations`, `/api/movements`, `/api/serial-articles`, `/api/storage`, `/api`, `/api/roles`) |
| `backend/app/models/enums.py` | vollständig gelesen | nur `ToolCategory`, `ToolStatus`, `MovementType`, `MovementStatus` — keine SAP-Werte |
| `backend/app/services/` | `movement_service.py`, `location_service.py`, `tool_service.py` | kein Adapter, kein externer Aufruf |
| `backend/requirements.txt`, `backend/.env` | vorhandene Dateien | keine SAP-Bibliothek, keine Konfiguration (kein `SAP_URL`, `SAP_CLIENT`, `SAP_MANDANT`) |
| `frontend/` (ganzer Baum) | `(?i)sap`, `integration`, `sync` | nur Fremdtreffer (`gensync`, `async`); alle API-Module (`admin.ts`, `tools.ts`, `locations.ts`, `movements.ts`, `users.ts`, `roles.ts`, `masterData.ts`, `storage.ts`) sprechen nur ToolSync-Endpunkte an |
| `docs/` und `tasks/` | `(?i)sap` | SAP nur als Anforderung/Grundsatz, kein Mapping- oder Spezifikationsdokument |**Altsystem:** `docs/archive/12-old-django-analysis.md` hält fest: „SAP —
Nicht vorhanden … keine SAP-Abhängigkeit im Altsystem";
`docs/archive/14-gap-analysis.md`: „Keine SAP-Integration gefunden … Nichts zu
migrieren" (PROPOSED / OPEN).

**Konsequenz:** Der SAP-freie Core ist nicht nur Anforderung, sondern
**Ist-Zustand** — alle Kernfunktionen laufen ohne SAP-Abhängigkeit; Abschnitt
16 der Requirements ist erfüllt, allerdings durch **Abwesenheit** von SAP,
nicht durch eine bewusste Kapselung. Solange kein SAP-Code existiert, kann die
Regel „SAP-Fehler dürfen den Core-Betrieb nicht unbenutzbar machen" nicht
verletzt werden; sie wird erst prüfbar, wenn Abschnitt 3 umgesetzt ist.

## 8. Abweichungen und Widersprüche

| # | Quelle | Aussage | Bewertung |
|---|---|---|---|
| 1 | `docs/01-requirements.md` 16 | Integration Layer „**soll**" erfolgen | verbindlich |
| 2 | `docs/00-project-vision.md` 4 | Integration Layer „**kann**" erfolgen | Abschwächung; Requirements haben Vorrang |
| 3 | `docs/14-architecture.md` | verweist auf „DEC-001/042"; `docs/13-decisions.md` enthält nur DEC-048 bis DEC-052 | DEC-001/042 sind **nicht auffindbar** — der SAP-Grundsatz ist derzeit nur als Anforderung belegt |
| 4 | `docs/14-architecture.md` | nennt `shadcn/ui` als Frontend-Technologie | widerspricht `docs/01-requirements.md` 17 („kein shadcn/ui") — zeigt veraltete Architektur-Doku |

## 9. Offene Fragen

> **Offen:** Existieren DEC-001 und DEC-042, und wo? `docs/13-decisions.md`
> enthält sie nicht.
> **Offen:** Über welche SAP-Schnittstelle soll integriert werden, welche
> SAP-Objekte entsprechen welchen ToolSync-Entitäten (nur `tool_id` ist
> dokumentiert), und ist der Sync einseitig oder bidirektional?
> **Offen:** Muss der Integration Layer Mehrwerkfähigkeit abbilden? ToolSync
> kennt mehrere Werke (`Plant`), SAP typischerweise Mandanten und
> Buchungskreise — die Zuordnung ist nirgends beschrieben.
> **Offen:** Soll SAP im Admin-Panel sichtbar/schaltbar sein (Status, letzter
> Sync, Fehleranzeige), und ist eine Integration überhaupt geplant? Die
> Requirements sprechen von einer „optionalen **späteren**
> Integrationsmöglichkeit"; Termin und Auslöser sind nicht benannt.