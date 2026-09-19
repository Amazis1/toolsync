---
name: Security
globs: ["**/*.py", "**/*.tsx", "**/*.ts", "**/auth/**", "**/routers/**"]
description: Sicherheit und Berechtigungen – Login, Rollen, Admin
---

# Sicherheit

## Authentifizierung

### Normale Benutzer

- Login ausschließlich über Personalnummer.
- Kein Passwort, kein PIN.
- Keine öffentliche Selbstregistrierung.
- Benutzer werden ausschließlich durch einen Admin angelegt.
- Die Personalnummer ist eindeutig.
- Nach erfolgreichem Login wird der Anzeigename aus Vorname und Nachname angezeigt.

### Admin

- Der Admin besitzt einen eigenen geschützten Admin-Login.
- Der Admin darf Benutzer anlegen, bearbeiten, deaktivieren und verwalten.
- Der Admin verwaltet Rollen und Berechtigungen.

## Autorisierung

- Jeder geschützte Backend-Endpunkt prüft Authentifizierung und Autorisierung **serverseitig**.
- Das Ausblenden eines Buttons im Frontend ist **keine** Sicherheitsmaßnahme.
- Berechtigungsprüfungen gehören ins Backend, nicht nur in die UI.

## Sicherheit

Die technische Umsetzung des passwortlosen Benutzer-Logins muss während der Architekturphase
sicherheitsseitig bewertet werden.

Die fachliche Anforderung „kein Passwort für normale Benutzer" darf nicht eigenmächtig
in einen Passwort- oder PIN-Login geändert werden.

Keine Secrets im Code. Keine Zugangsdaten in versionierten Konfigurationsdateien.
