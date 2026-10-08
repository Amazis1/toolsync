---
name: ToolSync Domain
globs: ["**/*.py", "**/*.tsx", "**/*.ts"]
description: Werkzeugtypen, IDs, Serienartikel, Datenblatt, Ersatzteile, Bestand, Ausleihe und Rückgabe
---

- Werkzeugtypen fachlich korrekt behandeln; Matrize und Abstreifer nicht automatisch als Werkzeugtypen modellieren.
- Bedeutung von Typ-Codes und Werkzeug-IDs aus Implementierung und Anforderungen ableiten, nicht raten.
- **Ersatzwerkzeug und Ersatzteil sind zwei verschiedene Dinge** (DEC-064): Ein Ersatz**werkzeug** ist ein `Tool` mit `is_storage = true` in der Werkzeugliste (Mehrfach-ID, Ausleihe pro Exemplar, DEC-052). Ein Ersatz**teil** ist ein `SparePart` (`spare_parts`) mit **Artikelnummer** als Identität, Werk (Pflicht), Menge + Einheit und einem Lagerort als **Freitext** – ohne Status, ohne Ausleihe, ohne Matrix-Platz. Die alte Tabelle `storage_items` und `/api/storage` gibt es nicht mehr.
- Ersatzteile darf jeder aktive Benutzer lesen, anlegen und ändern; **löschen nur Administratoren** (serverseitig `require_admin`).
- Das **Datenblatt** ist der Zwilling des Serienartikels (DEC-065): ein PDF mit den **Einstellwerten eines Werkzeugs für eine Maschine**, eigener Bereich, Feld **„Werkzeug-ID"** (empfohlen, nicht Pflicht – DEC-055). Nicht mit der Artikelnummer des Serienartikels verwechseln; der PDF-Inhalt wird nicht in Felder zerlegt.
- Serienartikel sind PDF-basierte Einrichtepläne und ein **eigener** Bereich: keine Beziehung zu Werkzeugen (Stempel, Abstreifer, Matrize), keine Werkzeug-ID. Den Inhalt des Plans nicht als strukturierte DB-Daten modellieren; strukturiert geführt werden nur die Auffang-Felder Artikelnummer, Werk, Name, Kunde, Maschine und Beschreibung (DEC-056). Kunde, Maschine und Werk sind Stammdaten aus dem Admin-Bereich, kein Freitext.
- Serienartikel verwalten (anlegen, bearbeiten, PDF ersetzen, löschen) dürfen nur Administratoren – serverseitig geprüft; suchen, ansehen und herunterladen darf jeder aktive Benutzer.
- Bei Bestand, Ausleihe, Rückgabe und Bewegungen Status, Historie, Verfügbarkeit und Berechtigungen gemeinsam prüfen.
- Verbindliche fachliche Quelle ist `docs/01-requirements.md`; für Serienartikel zusätzlich `docs/13-decisions.md` → DEC-056 und `docs/06-serial-articles.md`.
