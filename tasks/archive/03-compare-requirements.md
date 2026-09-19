# 03-compare-requirements

## Task-Status: COMPLETED

## Ziel
Das Altsystem mit den aktuellen ToolSync-Anforderungen vergleichen und eine Gap-Analyse erstellen.

## Voraussetzung
- TASK-002 = COMPLETED
- Completion Gate = PASS

## Vergleichsbereiche
- Login (Personalnummer vs. Passwort)
- Benutzeranlage (Admin vs. Selbstregistrierung)
- Rollen und Berechtigungen
- Werkzeugstruktur
- Werkzeugtypen
- Werkzeug-ID-System
- Lager und Lagerorte
- Lager/Ersatz (duplicate_id_allowed)
- Serienartikel (PDFs)
- Bewegungen
- Dokumente
- Statistik
- SAP (optional)

## Klassifizierung
Jeder Bereich wird bewertet als:
- EXISTING – im Altsystem vorhanden
- REQUIRED – in den Anforderungen gefordert
- PROPOSED – vorgeschlagen, aber nicht bestatigt
- OPEN – Entscheidung fehlt
- REJECTED – bewusst verworfen
- INFERRED – aus Analyse abgeleitet

## Ergebnis
Eine nachvollziehbare Gap-Analyse in:
- D:\toolsync\docs\13-decisions.md
- D:\toolsync\docs\14-gap-analysis.md

## Nachste Aktion
Mit Phase 3 beginnen, sobald TASK-002 abgeschlossen ist.