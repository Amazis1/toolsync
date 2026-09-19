import { test, expect } from '@playwright/test'

// ----------------------------------------------------------------
// Login: Mitarbeiter (nur Personalnummer, kein Passwort)
// ----------------------------------------------------------------
test('Mitarbeiter-Login mit gültiger Personalnummer zeigt die Oberfläche', async ({ page }) => {
  await page.goto('/')

  // Login-Formular sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync Login' })).toBeVisible()
  await expect(page.getByText('Mitarbeiter')).toBeVisible()

  // Login durchführen
  await page.getByLabel('Personalnummer').fill('1001')
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Nach dem Login: Kopfzeile und Tabs sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()
  await expect(page.getByText('Max Mustermann')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Werkzeuge' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Serienartikel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lager/Ersatz' })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'ToolSync Login' })).toBeVisible()
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
  await page.getByLabel('Personalnummer').fill('admin1')
  await page.getByLabel('Passwort').fill('123')
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Nach dem Login: Kopfzeile, Name und Admin-Hinweis sichtbar
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()
  await expect(page.getByText('Admin User (Admin)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
})

// ----------------------------------------------------------------
// Logout
// ----------------------------------------------------------------
test('Logout führt zurück zur Login-Seite', async ({ page }) => {
  await page.goto('/')

  // Als Mitarbeiter einloggen
  await page.getByLabel('Personalnummer').fill('1001')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('heading', { name: 'ToolSync' })).toBeVisible()

  // Logout durchführen
  await page.getByRole('button', { name: 'Logout' }).click()

  // Zurück auf der Login-Seite
  await expect(page.getByRole('heading', { name: 'ToolSync Login' })).toBeVisible()
})
