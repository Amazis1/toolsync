---
name: Testing
globs: ["**/tests/**", "**/test_*.py", "**/*.spec.*", "**/*.test.*"]
description: Tests für kritische Funktionen
---

- Neue kritische Logik testbar machen.
- Backend: Pytest für Domänenlogik, Services und wichtige API-Fälle.
- E2E: Playwright für Login, Suche, Ausleihe und Rückgabe.
- Keine Tests löschen, um Grün zu erzwingen.
- Fehlschlagende Tests melden, nicht umgehen.
