---
name: analyse-modus
description: Systematische, belegtreue Analyse-Methodik für unbekannten Code oder Dokumente
---

# Analyse-Modus

Verwende diesen Ablauf, wenn Code, Datenmodelle oder Dokumente untersucht werden müssen,
bevor eine Änderung geplant wird.

## Kernsatz

    Inventar → Lesen → Verstehen → Nachverfolgen → Dokumentieren → Prüfen

**Nicht:** Verzeichnisse auflisten → Zusammenfassung schreiben → fertig.

## 1. Beweisdisziplin

- Eine Verzeichnisauflistung ist **keine** Analyse.
- Eine Liste von Dateinamen ist **keine** Analyse.
- Relevante Dateien müssen **tatsächlich gelesen** werden, nicht aus Namen geschlossen.
- Unterscheide strikt zwischen `FOUND` (gefunden) und `READ` (gelesen). Nur `READ` zählt.

## 2. Keine erfundenen Informationen

Wenn eine Information nicht aus dem Code oder der Dokumentation hervorgeht:

- nicht erfinden,
- nicht plausibel ergänzen,
- stattdessen kennzeichnen:

| Kennzeichnung | Bedeutung |
|---|---|
| `OPEN` | offene Frage, muss geklärt werden |
| `UNKNOWN` | nicht ermittelbar |
| `INFERRED` | wahrscheinliche Schlussfolgerung, nicht belegt |
| `EXISTING` | im Bestand vorhanden, unverändert |
| `REQUIRED` | durch Anforderungen gefordert |
| `PROPOSED` | Vorschlag, nicht entschieden |
| `REJECTED` | bewusst verworfen |

## 3. Ablauf

1. **Inventarisieren** – vollständige Übersicht über die betroffenen Bereiche.
2. **Priorisieren** – welche Bereiche sind für die Frage entscheidend?
3. **Tatsächlich lesen** – die relevanten Dateien wirklich öffnen und lesen.
4. **Zusammenhänge nachvollziehen** – was hängt wovon ab?
5. **Datenflüsse nachvollziehen** – woher kommen Daten, wohin gehen sie?
6. **Geschäftslogik nachvollziehen** – Services, Validierung, Nebenbedingungen, nicht nur Models.
7. **Ergebnisse dokumentieren** – in kleinen, persistenten Dokumenten.
8. **Offene Fragen dokumentieren.**
9. **Coverage aktualisieren** (siehe Abschnitt 5).
10. **Erst danach** den nächsten Bereich bearbeiten.

## 4. Abhängigkeiten verfolgen

Das Ziel ist nicht „Datei X existiert", sondern
„Datei X implementiert Funktion Y und verwendet dafür A, B und C".

Bei einem Endpunkt beispielsweise verfolgen:

    Route → Schema → Service → Model → DB-Zugriff → Berechtigung

## 5. Coverage-Übersicht

Während der Analyse eine Übersicht führen:

| Bereich | Inventar | Dateien gelesen | Implementierung verstanden | Dokumentiert | Status |
|---|---|---|---|---|---|

Statuswerte: `NOT_STARTED`, `IN_PROGRESS`, `ANALYZED`, `PARTIAL`, `BLOCKED`

## 6. Widersprüche dokumentieren

Wenn Bestand und aktuelle Anforderung voneinander abweichen, den Unterschied **dokumentieren**,
nicht stillschweigend angleichen:

| Thema | Bestand | Aktuelle Anforderung | Entscheidung |
|---|---|---|---|

## 7. Keine automatische Übernahme

Aus „das Bestandssystem macht es so" folgt **nicht** „wir machen es genauso".
Jede Übernahme muss begründet werden.

## 8. Ressourcenschonung

- Nicht die gesamte Codebase in einem Kontext laden.
- Große Bereiche in logisch getrennte Analyseaufgaben aufteilen.
- Ergebnisse in kleinen persistenten Dokumenten speichern.
- Vorhandene Dokumentation und Rules gezielt verwenden statt neu erheben.

## 9. Abschlussprüfung

Bevor eine Analyse als abgeschlossen bezeichnet wird:

1. Wurde jeder relevante Bereich inventarisiert?
2. Wurden die relevanten Dateien tatsächlich gelesen?
3. Wurden Datenmodell und Migrationen untersucht?
4. Wurden Authentifizierung und Autorisierung untersucht?
5. Wurden Abhängigkeiten verfolgt?
6. Wurden Widersprüche zu den Anforderungen dokumentiert?
7. Wurden offene Fragen dokumentiert?
8. Wurde die Coverage-Übersicht aktualisiert?

Lautet eine Antwort NEIN, ist die Analyse nicht abgeschlossen.

**Harte Regel:** Eine reine Verzeichnisanalyse oder eine Stichprobe darf niemals als
`ANALYSIS COMPLETE` bezeichnet werden. Solange Bereiche offen sind: `ANALYSIS INCOMPLETE`.

## 10. Rangfolge bei Widersprüchen

1. Aktuelle explizite Anforderungen des Projektinhabers
2. `docs/13-decisions.md`
3. `docs/01-requirements.md`
4. weitere ToolSync-Dokumentation
5. Continue Rules
6. technische Empfehlungen des Modells
