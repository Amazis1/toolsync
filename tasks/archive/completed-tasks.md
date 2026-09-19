# ToolSync – Abgeschlossene Aufgaben (Archiv)

> **Archiv. Nicht aktiv bearbeiten.**
>
> Diese Datei sammelt die Checklisten der abgeschlossenen Aufgaben, die früher in
> `tasks/CURRENT_TASKS.md` standen. Die aktive Aufgabe steht in `../CURRENT_TASKS.md`.

**Archiviert am:** im Zuge der Continue-Steuerungs-Aufräumung.

---

## TASK-001 – Altsystem analysieren (COMPLETED)

- [x] Phase A – Inventarisierung
- [x] Phase B – Backend-Logik
- [x] Phase C – Frontend-Logik
- [x] Phase D – Fachfunktionen
- [x] Phase E – UI-Verhalten
- [x] Phase F – Wiederverwendbarkeit
- [x] Completion Gate

Ergebnis: siehe `docs/archive/12-old-django-analysis.md` und `archive/legacy-django-analysis/`.

## TASK-002 – Altsystem dokumentieren (COMPLETED)

- [x] Projektstruktur dokumentieren
- [x] Datenmodell dokumentieren
- [x] Frontend dokumentieren
- [x] Geschäftsregeln dokumentieren
- [x] Authentifizierung dokumentieren (Abschnitt 7a)
- [x] Ausleihe/Rückgabe dokumentieren (Abschnitt 7b)
- [x] Integrationen dokumentieren (Abschnitt 7c)
- [x] Widersprüche dokumentieren (Abschnitt 7d)
- [x] Relevante Dateien dokumentieren (Abschnitt 12)
- [x] Abschlussbericht erstellen

## TASK-003 – Anforderungen vergleichen (COMPLETED)

- [x] Login vergleichen
- [x] Benutzeranlage vergleichen
- [x] Werkzeugstruktur vergleichen
- [x] Lagerstruktur vergleichen
- [x] Serienartikel vergleichen
- [x] Bewegungen vergleichen
- [x] Statistik vergleichen
- [x] Gap-Analyse erstellen → `docs/archive/14-gap-analysis.md`
- [x] Completion Gate

## TASK-004 – Zielarchitektur (COMPLETED)

- [x] Frontend-Architektur definieren → `docs/14-architecture.md`
- [x] Backend-Architektur definieren → `docs/14-architecture.md`
- [x] Datenbank-Architektur definieren → `docs/14-architecture.md`

## TASK-005 – Domain Model (COMPLETED)

- [x] SQLAlchemy Modelle erstellen (DEC-045)
- [x] Pydantic Schemas erstellen (DEC-043)

## TASK-006 – Security (COMPLETED)

- [x] Personalnummer-Login definieren (DEC-030)
- [x] Admin-Login definieren (DEC-031)
- [x] Rollen definieren (DEC-033)

## TASK-007 – Implementierungs-Roadmap (COMPLETED)

- [x] Implementierungsreihenfolge festlegen
- [x] Meilensteine definieren

Die Roadmap wurde durch die tatsächliche Umsetzung überholt. Siehe
`archive/07-implementation-roadmap.md` für den ursprünglichen Plan.

## TASK-009 – UI-Styleguide verbindlich umsetzen (COMPLETED)

### Dokumentation

- [x] Regel-Datei `.continue/rules/11-ui-styleguide.md` erstellt
      → inzwischen aufgeteilt in `11-ui-hauptfrontend.md` und `12-ui-adminpanel.md`
- [x] Doku `docs/15-ui-styleguide.md` erstellt
- [x] Entscheidung DEC-047 in `docs/13-decisions.md` ergänzt
- [x] Task-Datei `tasks/09-ui-styleguide.md` erstellt

### CSS-Basis

- [x] `src/index.css` aktualisiert – Styleguide-Werte (Glas-Effekte, `.ui-btn*`, `.ui-tabs`,
      `.ui-alert*`, `.ui-badge*`, `.ui-switch`, `.ui-pagination`, `.ui-progress`, `.ui-spinner`,
      `.ui-skeleton`, `.ui-menu`, `.ui-breadcrumbs`, `.ui-avatar`, `.modal-overlay`,
      `.modal-panel`, Fallback reduced-transparency)

### Komponenten umstellen

- [x] `App.tsx` – Tabbar auf `.ui-tabs`, Statistik-Sidebar auf `.stat-card`, Anlegen auf `.ui-btn`
- [x] `LoginForm.tsx` – `.ui-tabs`, `.input-bordered`, `.ui-alert`, `.ui-btn`
- [x] `ToolForm.tsx` – `.ui-btn`, `.ui-alert`
- [x] `ToolList.tsx` – `.ui-badge`, `.ui-btn`, `.ui-alert`, `.ui-spinner`, `.input-bordered`
- [x] `LendModal.tsx` – `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn`
- [x] `StorageItemList.tsx` – `.ui-badge`, `.ui-btn`, `.ui-alert`, `.ui-spinner`
- [x] `StorageItemForm.tsx` – `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn`
- [x] `SerialArticleList.tsx` – `.ui-badge`, `.ui-btn`, `.ui-alert`, `.ui-spinner`
- [x] `SerialArticleUpload.tsx` – `.modal-overlay`, `.modal-panel`, `.input-bordered`, `.ui-btn`
- [x] `PDFViewer.tsx` – `.modal-overlay`, `.modal-panel`, `.ui-btn`, `.ui-spinner`, `.ui-alert`

### Abschluss

- [x] Build geprüft (`npm run build`) – fehlerfrei
- [x] Completion Gate – bestanden

### Nicht angefasst (dokumentiert)

- [x] AdminPanel-Komponenten – Umsetzung folgte in TASK-010
- [x] Logos in der Sidebar – bleiben unverändert
- [x] `ToolFormModal.tsx` – bestätigt nicht verwendet (toter Code)

## TASK-010 – AdminPanel umsetzen (Split-Tone-Styleguide) (COMPLETED)

### Phase 1 – Personalnummer verbergen

- [x] `UserRead` ohne `personal_number`/`role_id`
- [x] CRUD-Base: leere `personal_number` wird ignoriert
- [x] Frontend-Interfaces bereinigt
- [x] `AdminUsers`: Rollen entfernt, Personalnummer versteckt

### Phase 2 – Rollen komplett entfernen

- [x] Schemas ohne `role_id`
- [x] `AdminUsers` ohne Rollen-Dropdown/-Spalte

### Phase 3 – AdminPanel als separates Modul

- [x] `admin.css` (Split-Tone-Klassen)
- [x] `AdminLayout.tsx` (Sidebar: User/Hauptseite/Logout als Buttons nach Logo)
- [x] `AdminDashboard.tsx` (KPI + Benutzerverwaltung integriert)
- [x] `AdminStammdaten.tsx` (Tabellen statt Karten, Werkzeugtypen integriert)
- [x] `App.tsx`: `/admin`-Route, Sidebar-Button, Tab entfernt
- [x] `AdminPanel.tsx` gelöscht

### Phase 4 – Lagerplatz-Verwaltung (Matrix nach Prototyp)

- [x] Backend: `StorageLocation` entfernt, Drawer/Position/Tool angepasst (Migration `c7d9e2f3a1b8`)
- [x] Backend: Endpunkt `POST /cabinets/matrix`
- [x] Frontend: `api/locations.ts` neu (`createCabinetMatrix`, Position mit `tool_id`)
- [x] Frontend: `AdminStorageLocations.tsx` nach Prototyp (Grid, Perlenkette, Drag & Drop)
- [x] Frontend: `storage_location_id` → `position_id` überall ersetzt

### Phase 5 – Initialen-Avatar mit Tooltip

- [x] `App.tsx`: Sidebar mit Initialen + Tooltip
- [x] `AdminLayout.tsx`: Avatare mit Tooltip

### Phase 6 – Dokumentation & Tasks

- [x] `tasks/10-admin-panel.md` erstellt und aktualisiert
- [x] `docs/13-decisions.md`: DEC-048, DEC-049
- [x] `tasks/CURRENT_TASKS.md` aktualisiert
- [x] `docs/09-admin-panel.md` ergänzt

### Phase 7 – Werkzeug-Ablage + Lösch-Schutz

- [x] Backend: Schrank/Schublade löschen gibt Werkzeuge frei (`position_id = NULL`)
- [x] Backend: Ablage-Endpunkte `GET /locations/tray`, `POST /locations/positions/place-tool`,
      `POST /locations/positions/release-tool`
- [x] Frontend: Werkzeug-Ablage in `AdminStorageLocations` (Chips, Drop-Zone, Einreihen per Klick/DnD)
- [x] Frontend: Werkzeug-Anlage kann Werkzeug direkt in die Ablage legen
- [x] `ToolForm`: `position_id = null` unterstützt

### Phase 8 – AdminStorageLocations UI anpassen

- [x] `admin-content` global verbreitert (`max-w-6xl` → `max-w-[1600px]`)
- [x] Doppelte Kopf-Card entfernt
- [x] Tab-Leiste „Lagerstruktur / Verlauf" entfernt
- [x] Verlauf als eigener Block unter „Schrank anlegen" (linke Spalte)
- [x] Info-Block auf `.admin-alert.admin-alert-info` umgestellt
- [x] Akkordeon-Pfeile auf Lucide-Inline-SVG umgestellt
- [x] SlotCard-Buttons vergrößert + `aria-label`
- [x] Playwright-Test `admin-storage.spec.ts` erstellt
- [x] `docs/09-admin-panel.md` Lagerplätze-Abschnitt angepasst
- [ ] Manuelle Prüfung der Lagerplatz-UI → **offen, siehe TASK-012**

### Phase 9 – Schublade zu bestehendem Schrank + Button-Umbau + Verlauf-Farben

- [x] Panel „Schublade hinzufügen" (Name frei editierbar, X/Y, Plätze-Vorschau)
- [x] `createDrawer` verdrahtet
- [x] Bugfix `handleDeleteDrawer` nutzt `drawer.id`
- [x] Buttons vereinheitlicht (Lucide-Inline-SVG, `title` + `aria-label`, Soft-Danger)
- [x] Buttons außerhalb des Aufklapp-Buttons
- [x] `MovementLog`: `getActionStyle` mit 8 gruppierten Aktionsfarben
- [x] `MovementLog`: farbiger linker Rand pro Zeile + Farb-Legende
- [x] `MovementLog`: `place`, `insert_from_tray`, `release` und Shift-Varianten erkannt
- [x] Build geprüft (`npm run build`) – fehlerfrei
- [x] **Bugfix Backend:** `create_drawer`/`update_drawer` – `positions` eager laden
      (`selectinload`), sonst Lazy-Load im Sync-Kontext → 500 trotz erfolgreichem Commit
- [x] **Bugfix Frontend:** neue Schublade wird direkt in den State übernommen
- [x] Zähler als farbige Badges (Teal / Sky) mit Singular/Plural
- [x] Backend-Tests geprüft (`pytest tests/test_location_service.py`) – 15 passed
- [ ] Manuelle Prüfung im Browser → **offen, siehe TASK-012**

### Phase 10 – Stammdaten überarbeiten

- [x] Layout: 4 Blöcke nebeneinander (Grid 1/2/3/4 Spalten)
- [x] `TableEditor`: `p-3`, `admin-table-compact`, fester Scrollbereich (`.admin-scroll-y`)
- [x] Kebab-Menü pro Zeile statt zwei Text-Buttons
- [x] Menü schließt bei Klick außerhalb/Esc/nach Aktion; `aria-*` gesetzt
- [x] Backend: `Customer.color` (`String(7)`, nullable) + Schema + Router
- [x] Backend: `ToolRead.customer`; `Tool.customer` Beziehung `lazy=joined`
- [x] Neue Alembic-Migration `d1a4f6b2c9e3` inkl. `downgrade()`
- [x] Migration auf bestehender UND frischer DB geprüft
- [x] Frontend `types.ts`: `Customer.color`, `Tool.customer`
- [x] Frontend `masterData.ts`: `createCustomer(name,color)` / `updateCustomer(id,name,color)`
- [x] Frontend: Farbwähler inkl. „Keine Farbe" + Swatch in der Zeile
- [x] Frontend: Werk-Dropdown für Maschinen
- [x] `npm run build` fehlerfrei; Backend `/health` → 200
- [ ] Manuelle Prüfung im Browser → **offen, siehe TASK-012**
- [ ] Optional: Farbanzeige in `ToolList.tsx` aus `tool.customer.color`

## TASK-011 – Anlegeformular Werkzeug (Kategorie Stempel) (COMPLETED)

Details: `../11-toolform-anlegen.md`

### Werkzeug-ID

- [x] Pflichtfeld sichtbar markiert
- [x] Live-Kontrolle beim Tippen (Debounce 400 ms)
- [x] Backend-Endpunkt `GET /tools/check-id` (vor `/{id}` definiert)
- [x] `is_storage` wird bei der Prüfung korrekt übergeben (Bugfix)
- [x] `exclude_id` beim Bearbeiten

### Maße A und B

- [x] `normalizeMeasure()`: `7` → `7,00`, `7.3` → `7,30`, Einheit mm wird entfernt
- [x] Maß A Pflicht, Maß B optional
- [x] Anzeige in der Liste mit Einheit (`7,30 mm`)

### Lagerplatz

- [x] Hinweis „nur freie Plätze" als Badge neben dem Label und unter dem Platz-Feld
- [x] Werk-Block **vor** den Lagerplatz-Block verschoben
- [x] Erstes Werk beim Anlegen vorausgewählt
- [x] Schrank/Schublade mit `disabled` und erklärendem Placeholder
- [x] Hinweis, wenn ein Werk keine Schränke hat
- [x] Eigener Platz bleibt beim Bearbeiten in der Auswahl
- [x] Vorbelegung Schrank → Schublade → Platz über `GET /locations/positions/{id}/context`

### Stammdaten

- [x] Kunde und Maschine als optionale Felder unter dem Lagerplatz-Bereich
- [x] Maschinen nach Werk gefiltert
- [x] `machine_id` und `customer_id` werden gesendet (vorher hart `null`)
- [x] `GET /customers` und `/machines` für aktive Benutzer freigegeben (DEC-051)
- [x] Neue Datei `frontend/src/api/masterData.ts`, `admin.ts` re-exportiert

### Lager/Ersatz

- [x] Checkbox steuert `allow_duplicate_id` (vorher toter State, immer `false`)
- [x] Anzahl-Feld legt N Exemplare in einem Zug an
- [x] Nur das erste Exemplar erhält den gewählten Platz, der Rest geht in die Ablage
- [x] Rückmeldung: ID existiert bereits N-fach, wird als nächstes Exemplar angelegt

### Prüfung

- [x] `python -m py_compile` (alle geänderten Backend-Dateien)
- [x] `npx tsc -b` (Frontend) – keine Fehler
- [x] `pytest tests/` – 15 passed
- [ ] Manuelle Prüfung im Browser → **offen, siehe TASK-012**
