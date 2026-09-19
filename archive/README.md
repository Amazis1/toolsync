# Archiv

> **Nicht aktiv bearbeiten.** Alles hier drin ist Historie.

Dieser Ordner sammelt Aufgaben und Dokumente, die abgeschlossen oder überholt sind.
Sie wurden **nicht gelöscht**, damit nachvollziehbar bleibt, wie Entscheidungen entstanden sind.

## Inhalt

### `tasks/archive/`

| Datei | Was es ist |
|---|---|
| `completed-tasks.md` | Checklisten der abgeschlossenen TASK-001 bis TASK-011 |
| `PROJECT-PLAN.md` | Ursprünglicher Projektplan (20 KB). Durch die tatsächliche Umsetzung überholt. Enthielt den Altsystem-Bezug `D:\Web`. |
| `00-project-setup.md` | Setup-Task. Enthielt Modellstrategie für lokale Ollama-Modelle (`qwen3:14b` usw.), die nicht mehr gilt. |
| `01-analyze-old-project.md` | Task zur Analyse des Altsystems (24 KB) |
| `02-document-old-project.md` | Task zur Dokumentation des Altsystems |
| `03-compare-requirements.md` | Task zum Anforderungsvergleich mit dem Altsystem |
| `07-implementation-roadmap.md` | Ursprünglicher Phasenplan. Überholt. |
| `08-frontend-first.md` | Frontend-first-Task. Teil 08.1 erledigt, Rest durch die Umsetzung überholt. |

### `docs/archive/`

| Datei | Was es ist |
|---|---|
| `12-old-django-analysis.md` | Analyse des Altsystems (Django 5.1.5) |
| `14-gap-analysis.md` | Abgleich Altsystem gegen Anforderungen |

### `archive/legacy-django-analysis/`

Die Rohdaten der Altsystem-Analyse: `analysis_output/`, `analysis_phase_b/`, `analysis_phase_c/`
(15 Dateien, ca. 100 KB). Das sind ausgelesene `.py.txt`- und `.html.txt`-Dateien des Altsystems.

### `archive/10-analysis-workflow.md`

Der frühere Analyse-Workflow (18 KB, war `.continue/rules/10-analysis-workflow.md`).
Er beschrieb die Altsystem-Analyse in 23 Abschnitten. Die Analyse ist abgeschlossen und
das Altsystem ist nicht mehr Teil des Projekts.

Die **wiederverwendbare Methodik** daraus wurde gerettet und steht jetzt in
`.continue/prompts/analyse-modus.md`.

## Was hier bewusst NICHT mehr gilt

- Das Altsystem unter `D:\Web` ist **kein Teil des Projekts** mehr. Es wird nicht gelesen
  und nicht betreten. Die einzige Ausnahme sind die historischen Analyseergebnisse oben.
- Die frühere Regel „`D:\Web` ist READ-ONLY" wurde gestrichen, nicht umformuliert.
  Es gilt jetzt: Geschrieben wird ausschließlich unter `D:\toolsync`.
