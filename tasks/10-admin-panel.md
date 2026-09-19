# TASK 10 – AdminPanel umsetzen (Split-Tone-Styleguide)

## Status
IN_PROGRESS

## Ziel
Das AdminPanel wird als separates Modul unter `/admin` geführt und auf das verbindliche Split-Tone-Design aus `AdminPanel-Styleguide.html` umgestellt.

## Referenzen
- `AdminPanel-Styleguide.html` (verbindliche Design-Referenz)
- `docs/13-decisions.md` (DEC-047, DEC-048, DEC-049)
- `docs/09-admin-panel.md` (AdminPanel-Konzept)
- `C:\Users\abenz\Desktop\Lagerplatz-Hierarchie\toolsync_final.html` (Prototyp Lagerplatz-Matrix)

## Änderungen

### Phase 1 – Personalnummer verbergen
- [x] `backend/app/schemas/user.py` – `UserRead` ohne `personal_number`/`role_id`
- [x] `backend/app/crud/base.py` – `update()` verarbeitet Pydantic-Modelle/Dicts, ignoriert leere `personal_number`
- [x] `backend/app/services/user_service.py` – Update überspringt leere `personal_number`
- [x] `frontend/src/lib/api.ts` – `UserInfo` ohne `personal_number`/`role_id`
- [x] `frontend/src/api/types.ts` – `User` ohne `personal_number`/`role_id`/`role`
- [x] `frontend/src/pages/admin/AdminUsers.tsx` – Rollen entfernt, Personalnummer versteckt

### Phase 2 – Rollen komplett entfernen
- [x] `UserCreate`/`UserUpdate` ohne `role_id`
- [x] `AdminUsers.tsx` – Rollen-Dropdown + Spalte entfernt

### Phase 3 – AdminPanel als separates Modul
- [x] `frontend/src/admin.css` – Admin-Styleguide-Klassen (Split-Tone)
- [x] `frontend/src/pages/admin/AdminLayout.tsx` – Layout: dunkle Sidebar, heller Content, Topbar, Avatare; User/Hauptseite/Logout direkt nach Logo als Buttons
- [x] `frontend/src/pages/admin/AdminDashboard.tsx` – KPI-Cards, Suche, Tools-Tabelle, Benutzerverwaltung integriert
- [x] `frontend/src/App.tsx` – Admin-Tab entfernt, `/admin`-Route, Sidebar-Button, Zurück-Button
- [x] `AdminPanel.tsx` gelöscht (ersetzt durch `AdminLayout.tsx`)
- [x] `AdminStammdaten.tsx` – Tabellen statt Einzel-Karten, Werkzeugtypen integriert

### Phase 4 – Lagerplatz-Verwaltung (Matrix nach Prototyp)

**Backend-Umbau:**
- [x] `StorageLocation`-Tabelle entfernt (der Platz/Position ist der Lagerort)
- [x] Alembic-Migration `c7d9e2f3a1b8` – Drawer mit `cols`/`rows`, Position mit `x`/`y`/`tool_id`, Tool mit `position_id`
- [x] `backend/app/routers/locations.py` – neuer Endpunkt `POST /cabinets/matrix` (Schrank als Matrix anlegen)
- [x] `backend/app/models/storage.py` + `tool.py` – Beziehungen eindeutig via `foreign_keys`
- [x] `backend/app/crud/crud_location.py` – StorageLocation-CRUD entfernt
- [x] `backend/app/services/location_service.py` – StorageLocation-Service entfernt
- [x] `backend/app/schemas/storage.py` – StorageLocation-Schemas entfernt, Drawer/Position erweitert
- [x] `backend/app/schemas/__init__.py` + `crud/__init__.py` – alte Importe bereinigt

**Frontend-Umbau:**
- [x] `frontend/src/api/locations.ts` – komplett neu: `createCabinetMatrix`, Drawer mit cols/rows, Position mit tool_id; kein StorageLocation mehr
- [x] `frontend/src/pages/admin/AdminStorageLocations.tsx` – neu nach Prototyp: Formular (Schrank-ID + Schubladen-Grids), Grid-Rendering, Perlenketten-Verschiebung per Klick + Drag & Drop (natives HTML5, keine Bibliothek)
- [x] `frontend/src/api/types.ts` – `storage_location_id` → `position_id`
- [x] `frontend/src/components/tools/ToolForm.tsx` + `ToolFormModal.tsx` – `storage_location_id` → `position_id`
### Phase 5 – Initialen-Avatar mit Tooltip
- [x] `App.tsx` – Sidebar: Avatar mit Initialen + Tooltip (voller Name)
- [x] `AdminLayout.tsx` – Topbar- und Sidebar-Avatare mit `title`-Tooltip

### Phase 6 – Dokumentation & Tasks
- [x] `tasks/10-admin-panel.md` erstellt
- [x] `docs/13-decisions.md` – DEC-048 (Lagerplatz als generierte Matrix), DEC-049 (Stammdaten als Tabellen)
- [ ] `tasks/CURRENT_TASKS.md` aktualisieren
- [ ] `docs/09-admin-panel.md` aktualisieren (Lagerplätze-Abschnitt)
## Abschlussprüfung
- [x] `npm run build` läuft fehlerfrei
- [x] Backend startet (`/health` → 200)
- [x] Admin-Login funktioniert (`admin1` / `123`)
- [x] Alembic-Migrationen laufen auf frischer DB durch
- [ ] AdminPanel unter `/admin` manuell geprüft (Lagerplatz-Matrix + Verschieben)
- [ ] Personalnummer nirgends sichtbar (außer Eingabefeld im Formular)
- [ ] Lagerplatz-Hierarchie funktioniert (Schrank-Matrix anlegen, Werkzeug verschieben)
