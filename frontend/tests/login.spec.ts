import { test, expect } from '@playwright/test'

/**
 * Anmeldung: Mitarbeiter (nur Personalnummer), Admin (Nummer + Passwort),
 * fehlerhafte Nummer und Abmelden.
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173 und
 * ein Admin-Konto `admin1/123`.
 *
 * Die Spec legt ihren **Mitarbeiter selbst an** und räumt ihn hinterher wieder
 * weg. Vorher stand hier die feste Personalnummer `1001` („Max Mustermann“) –
 * die gibt es in der Datenbank nicht mehr, dadurch schlugen die Tests fehl,
 * obwohl die Anmeldung in Ordnung war.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/login.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }

/**
 * Test-Mitarbeiter: eigener Nummernkreis **je Arbeitsprozess**.
 *
 * Playwright verteilt die Tests einer Datei auf mehrere Prozesse. Mit einer
 * gemeinsamen Nummer würde der zweite Prozess am bereits angelegten Konto
 * scheitern und seine Tests überspringen.
 */
let mitarbeiter = { personal_number: '', first_name: 'Test', last_name: 'Mitarbeiter' }

let angemeldet = false
let mitarbeiterId: number | null = null

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  angemeldet = true
  const token = (await login.json()).access_token

  mitarbeiter = {
    ...mitarbeiter,
    personal_number: `T${String(Date.now()).slice(-6)}${test.info().workerIndex}`,
  }
  const erstellt = await request.post('/api/users/', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...mitarbeiter, is_admin: false, is_active: true },
  })
  if (erstellt.ok()) mitarbeiterId = (await erstellt.json()).id
})

test.afterAll(async ({ request }) => {
  if (mitarbeiterId === null) return
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  const token = (await login.json()).access_token
  await request.delete(`/api/users/${mitarbeiterId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
})

/** Ohne Admin-Konto bzw. ohne angelegten Mitarbeiter wird übersprungen. */
function requireMitarbeiter() {
  test.skip(!angemeldet, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(mitarbeiterId === null, 'Test-Mitarbeiter konnte nicht angelegt werden')
}

// ----------------------------------------------------------------
// Login: Mitarbeiter (nur Personalnummer, kein Passwort)
// ----------------------------------------------------------------
test('Mitarbeiter-Login mit gültiger Personalnummer zeigt die Oberfläche', async ({ page }) => {
  requireMitarbeiter()
  await page.goto('/')

  // Login-Formular sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync', exact: true })).toBeVisible()
  await expect(page.getByText('Anmeldung', { exact: true })).toBeVisible()
  await expect(page.getByText('Mitarbeiter')).toBeVisible()

  // Login durchführen
  await page.getByLabel('Personalnummer').fill(mitarbeiter.personal_number)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Nach dem Login: Kopfzeile und Tabs sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()
  // Der Name steht in der Sidebar und (auf schmalen Bildschirmen) in der
  // Kopfzeile – deshalb gezielt im Benutzerblock der Sidebar prüfen.
  await expect(page.locator('.app-sidebar').getByText('Test Mitarbeiter')).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Bereiche wechseln' }).getByRole('button', { name: 'Werkzeuge' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Bereiche wechseln' }).getByRole('button', { name: 'Serienartikel' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Bereiche wechseln' }).getByRole('button', { name: 'Datenblätter' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Bereiche wechseln' }).getByRole('button', { name: 'Ersatzteile' }),
  ).toBeVisible()

})

// ----------------------------------------------------------------
// Login: fehlgeschlagen bei ungültiger Personalnummer
// ----------------------------------------------------------------
test('Login mit ungültiger Personalnummer zeigt Fehlermeldung', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Personalnummer').fill('999999')
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Fehlermeldung erscheint
  await expect(page.getByRole('alert')).toContainText('Ungültige Personalnummer')
  // Kein Navigationswechsel – Login bleibt sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync', exact: true })).toBeVisible()
  await expect(page.getByText('Anmeldung', { exact: true })).toBeVisible()
})

// ----------------------------------------------------------------
// Login: Admin (Personalnummer + Passwort)
// ----------------------------------------------------------------
test('Admin-Login mit Personalnummer und Passwort', async ({ page }) => {
  await page.goto('/')

  // Tab wechseln zu Admin
  await page.getByRole('button', { name: 'Admin' }).click()

  // Passwortfeld erscheint
  await expect(page.getByLabel('Passwort')).toBeVisible()

  // Login durchführen
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Nach dem Login: Kopfzeile, Name und Admin-Hinweis sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()
  await expect(page.getByText('Admin User (Admin)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()
})

// ----------------------------------------------------------------
// Logout
// ----------------------------------------------------------------
test('Logout führt zurück zur Login-Seite', async ({ page }) => {
  requireMitarbeiter()
  await page.goto('/')

  // Als Mitarbeiter einloggen
  await page.getByLabel('Personalnummer').fill(mitarbeiter.personal_number)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()

  // Abmelden durchführen
  await page.getByRole('button', { name: 'Abmelden' }).click()

  // Zurück auf der Login-Seite
  await expect(page.getByRole('heading', { name: 'ToolSync', exact: true })).toBeVisible()
  await expect(page.getByText('Anmeldung', { exact: true })).toBeVisible()
})
