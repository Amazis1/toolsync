import { defineConfig, devices } from '@playwright/test'

/**
 * Adresse des Dev-Servers.
 *
 * Vorgabe ist 5173 (der normale Entwicklungsstand, Proxy auf 8000). Für einen
 * Lauf gegen einen **zweiten** Server (z. B. eine frische Backend-Instanz auf
 * 8002 mit einer Datenbank-Kopie) genügt die Umgebungsvariable:
 *
 *     $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5174'; npx playwright test …
 *
 * Dann startet Playwright **keinen** eigenen Server (`webServer` entfällt) und
 * benutzt den laufenden.
 */
const ZIEL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const eigenerServer = ZIEL === 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests',
  /**
   * **Tests einer Datei laufen nacheinander, Dateien weiterhin parallel.**
   *
   * Mit `fullyParallel: true` verteilte Playwright auch die Tests **einer**
   * Datei auf mehrere Worker. Jeder Worker führt `beforeAll` **einmal selbst**
   * aus – die Specs legen dort aber ihre Testdaten an (Praefix je Prozess, z. B.
   * `TST-<Zeitstempel>-001`). Laeuft eine Datei in mehreren Workern, entstehen
   * mehrere, unterschiedlich vollstaendige Datenbestände: Ein Worker, dessen
   * `beforeAll` beim Anlegen eines Datensatzes scheitert, hat die Zaehlungen
   * nicht, auf die die Tests warten.
   *
   * Gemessen: mit `fullyParallel: true` fielen je Datei ein bis zwei Tests aus
   * (tools-list 1, data-sheets 2, serial-articles 1, spare-parts 1); mit
   * `false` lief die Suite vollstaendig durch. Einzeln nachgestellt war jeder
   * auffaellige Test gruen – es war also nie der Code.
   */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  webServer: eigenerServer
    ? {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL: ZIEL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})