# TASK 00 – Project Setup

## Status
IN_PROGRESS

## Ziel

ToolSync 2.0 für die Analyse und spätere Entwicklung vorbereiten.

## Aktives Projekt

D:\toolsync

## Altes Referenzprojekt

D:\Web

## Regeln

- D:\Web ist ausschließlich Referenz.
- D:\Web darf nicht verändert werden.
- D:\toolsync ist das aktive Entwicklungsprojekt.
- Große Aufgaben müssen in kleine Teilaufgaben zerlegt werden.
- Vor Implementierung zuerst analysieren und planen.
- Keine Architekturentscheidung ohne ausreichende Analyse.
- Keine unnötigen Dateien oder Technologien hinzufügen.

## Lokale Modellstrategie

### Plan
qwen3:14b

Für:
- Analyse
- Architektur
- Planung
- Dokumentation
- Vergleich

### Agent
qwen2.5-coder:14b

Für:
- Implementierung
- Codeänderungen
- kleine bis mittlere Entwicklungsaufgaben

### Coding Assistant
qwen2.5-coder:14b

Für:
- technische Fragen
- gezielte Codehilfe

### Autocomplete
qwen2.5-coder:7b

Für:
- Code-Vervollständigung

### Embeddings
nomic-embed-text:latest

Für:
- Codebase Index
- semantische Suche
- Dokumentationszugriff

## Hardware

- VRAM: 16 GB
- RAM: 32 GB

## Arbeitsweise

Die KI soll große Aufgaben niemals als eine einzige unstrukturierte Aufgabe bearbeiten.

Stattdessen:

1. Überblick erzeugen
2. Teilbereich auswählen
3. Teilbereich analysieren
4. Ergebnis dokumentieren
5. nächsten Teilbereich bearbeiten
6. Ergebnisse zusammenführen

## Aktueller Zustand

Noch keine Implementierung.

Aktueller Fokus:
Analyse des bestehenden Projekts D:\Web.