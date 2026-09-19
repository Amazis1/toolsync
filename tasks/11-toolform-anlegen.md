# TASK-011 – Anlegeformular Werkzeug (Kategorie Stempel)

**Status:** COMPLETED (manuelle Browser-Prüfung offen)
**Ziel-Datei:** `frontend/src/components/tools/ToolForm.tsx`

---

## Ausgangslage (Befunde)

| # | Befund | Datei |
|---|---|---|
| 1 | Live-Kontrolle der Werkzeug-ID war Attrappe (`inputState`/`tooltipVisible`/`tooltipMessage` als Konstanten, leeres `onBlur`) | `ToolForm.tsx` |
| 2 | Kein Prüf-Endpunkt im Backend (nur `create_tool` prüfte) | `routers/tools.py` |
| 3 | `create_tool` rief `get_by_tool_id(...)` **ohne** `is_storage` auf → Default `False` | `services/tool_service.py` |
| 4 | `update_tool` prüfte gar nicht auf Duplikate | `services/tool_service.py` |
| 5 | `allowDuplicate` war ein State **ohne Setter** → immer `false` | `ToolForm.tsx` |
| 6 | `storageCount` wurde nie gesendet, `Tool` hat keine `storage_count`-Spalte | `ToolForm.tsx` |
| 7 | Maße wurden nie normalisiert (`7` blieb `7`, `7.3` blieb `7.3`) | `ToolForm.tsx` |
| 8 | Werk-Block stand **nach** dem Lagerplatz-Block → Schrank nie wählbar | `ToolForm.tsx` |
| 9 | Beim Bearbeiten wurde der eigene (belegte) Platz aus der Auswahl gefiltert | `ToolForm.tsx` |
| 10 | `machine_id`/`customer_id` wurden hart auf `null` gesetzt | `ToolForm.tsx` |
| 11 | GET `/customers` und `/machines` waren Admin-only → 403 für normale Benutzer | `routers/master_data.py` |
| 12 | `ToolFormModal.tsx` ist toter Code (nirgends importiert) | `components/ToolFormModal.tsx` |

---

## Umsetzung

### Werkzeug-ID (Pflicht + Live-Kontrolle)
- Neuer Endpunkt `GET /tools/check-id` – **vor** `@router.get("/{id}")` definiert, sonst wird `check-id` als `id` geparst (422).
- Antwort: `{ available, existing_count, message }`.
- Neue Service-Methode `ToolService.check_tool_id()`; nutzt `CRUDTool.count_by_tool_id()`.
- `get_by_tool_id()` und `count_by_tool_id()` haben jetzt `exclude_id` (Bearbeiten blockiert sich nicht selbst).
- `create_tool()`/`update_tool()` geben `is_storage` korrekt mit (Bugfix) und prüfen auch beim Update.
- Frontend: Debounce 400 ms, `input-error`/`input-success` + `.ui-spinner`, Meldung unter dem Feld.
- Submit blockiert nur bei `available === false` (nicht bei Lager/Ersatz).

### Maße A und B
- `normalizeMeasure()`: `7` → `7,00` · `7.3` → `7,30` · `7,3` → `7,30` · `7 mm` → `7,00`
- Anwendung bei `onBlur` und im Submit. Maß A Pflicht, Maß B optional.
- DB-Wert bleibt `"7,30"` (ohne Einheit, **keine Migration**).
- Anzeige in `ToolList` über `formatMeasureMm()` als `7,30 mm` (neue Spalte „Maße").

### Lagerplatz
- Werk-Block **vor** den Lagerplatz-Block verschoben (behebt „Schrank nicht wählbar").
- Beim Anlegen wird das erste Werk vorausgewählt.
- Schrank/Schublade/Platz mit `disabled` + erklärendem Placeholder.
- Hinweis, wenn ein Werk keine Schränke hat.
- Badge „nur freie Plätze" neben dem Label + Hinweis unter dem Platz-Feld.
- Beim Bearbeiten bleibt der eigene Platz in der Liste.
- Vorbelegung über neuen Endpunkt `GET /locations/positions/{id}/context` (Position → Schublade → Schrank).

### Stammdaten (Kunde / Maschine, beide optional)
- Neuer Block **unter** dem Lagerplatz-Bereich.
- Maschinen nach Werk gefiltert; bei Werkwechsel wird die Maschine zurückgesetzt.
- GET `/customers` + `/machines` von `require_admin` → `require_active` (DEC-051). Schreiben bleibt Admin-only.
- Neue Datei `frontend/src/api/masterData.ts`; `admin.ts` re-exportiert (AdminPanel unverändert).

### Lager/Ersatz
- Checkbox steuert `allow_duplicate_id` (abgeleitet, kein toter State mehr).
- Anzahl-Feld legt N Exemplare in einem Zug an (Variante A, DEC-052).
- Nur das erste Exemplar erhält den gewählten Platz, alle weiteren gehen in die Ablage.
- Rückmeldung: „ID existiert bereits N× – wird als N+1. Exemplar angelegt."

---

## Geänderte Dateien

**Backend**
- `backend/app/crud/crud_tool.py` – `exclude_id`, `count_by_tool_id()`
- `backend/app/services/tool_service.py` – `check_tool_id()`, `is_storage`-Fix, Update-Prüfung
- `backend/app/routers/tools.py` – `GET /tools/check-id`, ValueError-Handling, Import `ToolCategory`
- `backend/app/routers/master_data.py` – GET-Routen auf `require_active`
- `backend/app/routers/locations.py` – `GET /positions/{id}/context`

**Frontend**
- `frontend/src/components/tools/ToolForm.tsx` – Hauptarbeit
- `frontend/src/components/tools/ToolList.tsx` – Maße-Spalte
- `frontend/src/api/tools.ts` – `checkToolId()`
- `frontend/src/api/locations.ts` – `getPositionContext()`
- `frontend/src/api/masterData.ts` – **neu**
- `frontend/src/api/admin.ts` – re-export

**Nicht angefasst:** `ToolFormModal.tsx` (toter Code), AdminPanel-Komponenten, Logos.

---

## Prüfung

- [x] `python -m py_compile` – alle geänderten Backend-Dateien fehlerfrei
- [x] `npx tsc -b` – keine Fehler
- [x] `pytest tests/` – 15 passed
- [ ] Manuelle Prüfung im Browser (Maße, Schrank-Auswahl, Kunden/Maschinen, Lager/Ersatz-Menge)

---

## Offene Punkte

- `ToolFormModal.tsx` löschen oder behalten? (weiterhin OFFEN)
- Massenhafte Lager/Ersatz-Anlage (z. B. 50 Exemplare) läuft als sequentielle Requests – bei Bedarf später ein Sammel-Endpunkt.
- Backend akzeptiert unnormalisierte Maße (nur Frontend normalisiert) – bewusst tolerant, um Altdaten nicht zu brechen.
