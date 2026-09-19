# ToolSync – Aktuelle Tasks

> **Diese Datei enthält genau eine aktive Aufgabe.**
> Abgeschlossene Aufgaben stehen in `tasks/archive/`.

**Stand:** Regeln, Docs und UI-Styleguide abgestimmt.

---

## TASK-012 – Verifikation AdminPanel im Browser (IN_PROGRESS)

Diese Aufgabe sammelt die **offenen manuellen Prüfungen**, die aus TASK-010
übrig geblieben sind. Es sind ausschließlich Verifikationsschritte — es ist
kein neuer Code geplant.

### Ziel

Bestätigen, dass die vier umgebauten AdminPanel-Bereiche im Browser korrekt
aussehen und funktionieren.

### Offene Schritte

- [ ] **Lagerplatz-UI** nach dem Umbau prüfen
      – Schubladen-Zähler als Teal-Badge, Plätze als Sky-Badge
      – Buttons außerhalb des Aufklapp-Buttons (Schrank klappt nicht versehentlich um)
      – Soft-Danger-Buttons sichtbar rosa
      – `frontend/tests/admin-storage.spec.ts` erweitern und laufen lassen
- [ ] **Stammdaten** prüfen
      – vier Tabellenblöcke nebeneinander (Grid 1/2/3/4 Spalten)
      – Kebab-Menü pro Zeile: öffnet, schließt bei Klick außerhalb, bei `Esc` und nach Aktion
      – Kundenfarbe: Farbwähler, „Keine Farbe", Swatch in der Zeile
      – Maschinen: Werk-Dropdown beim Anlegen und Bearbeiten vorbelegt
- [ ] **Anlegeformular Werkzeug** prüfen
      – Werkzeug-ID: Live-Kontrolle beim Tippen (Debounce 400 ms)
      – Maß A Pflicht, Maß B optional, Anzeige mit Einheit (`7,30 mm`)
      – Werk-Block **vor** dem Lagerplatz-Block; erstes Werk vorausgewählt
      – Schrank/Schublade `disabled` mit erklärendem Placeholder
      – Lager/Ersatz: Checkbox steuert `allow_duplicate_id`, Anzahl legt N Exemplare an
- [ ] `npm run build` und `npx tsc -b` erneut laufen lassen
- [ ] `pytest tests/` im Backend erneut laufen lassen (zuletzt 15 passed)

### Bekannte Folgeschritte (nicht Teil dieser Aufgabe)

- [ ] Optional: Farbanzeige in `ToolList.tsx` aus `tool.customer.color`
- [ ] `frontend/src/components/ToolFormModal.tsx` — bestätigt toter Code,
      wird von keiner Stelle importiert. Entscheidung offen: löschen oder behalten.
- [ ] `tasks/06-security-and-permissions.md` ist leer (nur Titelzeile).

### Verifikationsstand

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | keine Fehler |
| `pytest tests/` | 15 passed |
| `npm run build` | fehlerfrei (vite v8.1.5) |
| Browser-Prüfung | **offen** |

---

## Abgeschlossene Aufgaben

Die vollständigen Checklisten liegen in `tasks/archive/completed-tasks.md`.

| Task | Titel | Status |
|---|---|---|
| TASK-001 | Altsystem analysieren | COMPLETED |
| TASK-002 | Altsystem dokumentieren | COMPLETED |
| TASK-003 | Anforderungen vergleichen | COMPLETED |
| TASK-004 | Zielarchitektur | COMPLETED |
| TASK-005 | Domain Model | COMPLETED |
| TASK-006 | Security | COMPLETED |
| TASK-007 | Implementierungs-Roadmap | COMPLETED |
| TASK-009 | UI-Styleguide verbindlich umsetzen | COMPLETED |
| TASK-010 | AdminPanel umsetzen (Split-Tone) | COMPLETED |
| TASK-011 | Anlegeformular Werkzeug (Kategorie Stempel) | COMPLETED |

---

## Ist-Stand des Projekts

| Bereich | Stand |
|---|---|
| Backend-Router | `auth`, `users`, `roles`, `tools`, `locations`, `movements`, `master_data`, `serial_articles`, `storage_items` |
| Backend-Modelle | `user`, `tool`, `master_data`, `storage`, `storage_item`, `movement`, `serial_article` |
| Migrationen | 4 (`f5b7b5192461` initial, `c7d9e2f3a1b8` Lager-Matrix, `d1a4f6b2c9e3` Kundenfarbe, `b2e8c1a4d9f7` Maß/Beschreibung) |
| Frontend-Seiten | `Tools.tsx`, `pages/admin/*` |
| Frontend-Tests | `login.spec.ts`, `admin-storage.spec.ts` |
| Design-Systeme | Glas (`index.css`) und Split-Tone (`admin.css`) vollständig umgesetzt |
| SAP | nicht implementiert — bewusst, Core läuft ohne SAP |
