---
name: ToolSync Domain
globs: ["**/*.py", "**/*.tsx", "**/*.ts"]
description: Werkzeugtypen, IDs, Serienartikel, Bestand, Ausleihe und Rückgabe
---

- Werkzeugtypen fachlich korrekt behandeln; Matrize und Abstreifer nicht automatisch als Werkzeugtypen modellieren.
- Bedeutung von Typ-Codes und Werkzeug-IDs aus Implementierung und Anforderungen ableiten, nicht raten.
- Serienartikel sind PDF-basierte Einrichtepläne; nicht automatisch PDF-Inhalte als strukturierte DB-Daten modellieren.
- Bei Bestand, Ausleihe, Rückgabe und Bewegungen Status, Historie, Verfügbarkeit und Berechtigungen gemeinsam prüfen.
- Verbindliche fachliche Quelle ist `docs/01-requirements.md`.
