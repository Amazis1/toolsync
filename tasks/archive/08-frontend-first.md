# Task 08: Frontend-First Aufbau (Admin Panel & ToolSync UI)

## Richtlinien & Qualitätsstandards
- **Context7 Pflicht:** Vor der Implementierung neuer Bibliotheken oder Frameworks muss Context7 genutzt werden, um sicherzustellen, dass auf dem NEUESTEN Stand (2026) entwickelt wird.
- **Tailwind CSS v4 Standard:** Nur @import "tailwindcss"; in src/index.css und @tailwindcss/vite nutzen. KEINE veraltete 	ailwind.config.js oder @tailwind Directives.
- **Dokumentation:** Änderungen an Architektur oder Datenmodellen werden direkt in docs/ dokumentiert.

## Task-Status:
- [x] **Task 08.1: Modernes Login-Formular mit Tabs**
  - [x] src/components/auth/LoginForm.tsx mit Switcher (Mitarbeiter / Admin)
  - [x] Mitarbeiter-Tab: Nur Personalnummer-Eingabe (ohne Passwort)
  - [x] Admin-Tab: Personalnummer + Passwort-Feld
  - [x] In App.tsx integrieren und Tailwind v4 Styles prüfen
    - `AuthProvider` in `App.tsx` als Wrapper; Conditional Rendering (Login ↔ Begrüßung + Logout)
    - `api.ts`: zentrale Fehlerbehandlung (`ApiError`), Backend-Fehlermeldungen (`detail`) werden durchgereicht
    - `AuthContext.tsx`: Token-Restore beim Start über `GET /api/auth/me`, `isLoading`-Zustand
    - Build verifiziert: `npm run build` (tsc + vite) läuft fehlerfrei durch
- [ ] **Task 08.2: Werkzeug-Verwaltung & Typ-Filter (Typ-Code + Typ-Name)**
- [ ] **Task 08.3: Serienartikel & PDF-Einrichteplan Vorschau**
- [ ] **Task 08.4: Lager / Ersatzteile (Duplicate-ID Toggle)**
- [ ] **Task 08.5: Werk 1 / Werk 2 Transfer-Maske**

