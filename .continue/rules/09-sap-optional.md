---
name: SAP Optional
globs: ["**/*sap*", "**/*integration*"]
description: SAP darf den ToolSync-Core nicht blockieren
---

- Core-Funktionen müssen ohne SAP funktionieren.
- SAP nur über einen klaren Adapter/Integration Layer.
- Mapping und Sync zwischen SAP und ToolSync bewusst und dokumentiert.
- SAP-Fehler dürfen den Core-Betrieb nicht unbenutzbar machen.
- Die aktuelle Phase ist SAP-frei; SAP wird nicht vorbereitend eingebaut.
