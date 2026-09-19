---
name: Backend
globs: ["**/*.py", "**/routers/**", "**/api/**", "**/services/**", "**/models/**"]
description: FastAPI/Pydantic/SQLAlchemy Regeln
---

- Router schlank halten; Geschäftslogik in Services.
- Eingaben und Antworten mit Pydantic validieren; Fehler klar und ohne sensible Details.
- Transaktionen bei Mehrschritt-Writes bewusst behandeln.
- Type Hints verwenden; keine versteckten Side Effects.
- Autorisierung serverseitig prüfen; ein ausgeblendeter Button im Frontend ist keine Sicherheitsmaßnahme.
