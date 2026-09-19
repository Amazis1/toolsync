---
name: Datenbank
globs: ["**/models/**", "**/migrations/**", "**/alembic/**", "**/*.py"]
description: Datenbankregeln – Modell, IDs, Constraints, Migrationen
---

# Datenbank

## Allgemein

- PostgreSQL
- Zugriff über SQLAlchemy 2.0 (async, wenn das Projekt so aufgesetzt ist)
- Schema-Änderungen nur über **Alembic-Migrationen** – nicht manuell an der DB

## IDs und Schlüssel

- Primärschlüssel klar und stabil (UUID oder Serial – projektweit einheitlich).
- Natural Keys (Typ-Code, Personalnummer, …) wo nötig als **UNIQUE**.
- Fremdschlüssel mit klaren Beziehungen; Cascades bewusst wählen.

## Beziehungen

- Kategorie → Werkzeugtyp → Werkzeug nachvollziehbar modellieren.
- Werk und Lagerort verknüpfen.
- Serienartikel und Mengenbestand im Schema unterscheidbar machen.
- Ausleihen mit Benutzer, Werkzeug, Zeitraum und Status verknüpfen.

## Migrationen

- Jede Schema-Änderung = Migration.
- Migrationen müssen auf leerer und bestehender DB nachvollziehbar sein.
- Keine stillen Breaking Changes an bestehenden Spalten ohne Plan.

## Qualität

- Sinnvolle Indizes für Such- und Join-Felder.
- Keine Business-Logik nur in DB-Triggern, wenn sie im Backend klarer ist.
- Testdaten nicht mit Produktionsdaten vermischen.
