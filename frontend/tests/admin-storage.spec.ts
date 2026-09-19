import { test, expect } from '@playwright/test'

// ----------------------------------------------------------------
// Admin: Lagerplätze (AdminStorageLocations)
// Hinweis: Test setzt laufendes Frontend (npm run dev) + Backend voraus.
// Erwartete Testdaten: Admin-Login admin1 / 123.
// ----------------------------------------------------------------

test('Lagerplätze zeigt Schrank anlegen, Ablage, Struktur und Verlauf ohne Tab-Leiste', async ({ page }) => {
  await page.goto('/')

  // Admin-Tab wählen und auf das Admin-Passwortfeld warten
  await page.getByRole('button', { name: 'Admin' }).click()

  const personalNumber = page.getByRole('textbox', { name: 'Personalnummer' })
  const password = page.getByRole('textbox', { name: 'Admin-Passwort' })
  await expect(password).toBeVisible()

  // Anmelden
  await personalNumber.fill('admin1')
  await password.fill('123')
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Nach dem Login landet der Admin auf der Hauptseite.
  // Erst ins Admin-Panel wechseln.
  await page.getByRole('button', { name: 'Admin-Panel' }).click()

  // Auf die Admin-Navigation warten (eindeutiger Locator; 'Admin Panel'
  // kommt im DOM mehrfach vor und wäre im Strict Mode mehrdeutig).
  await expect(page.getByRole('button', { name: 'Lagerplätze' })).toBeVisible()

  // Zur Lagerplatz-Verwaltung wechseln
  await page.getByRole('button', { name: 'Lagerplätze' }).click()

  // Kernbereiche sichtbar – ohne dass ein Tab geklickt werden muss
  await expect(page.getByRole('heading', { name: 'Schrank anlegen' })).toBeVisible()
  await expect(page.getByText('Werkzeug-Ablage', { exact: true })).toBeVisible()
  await expect(page.getByText('Lagerstruktur-Ansicht', { exact: true })).toBeVisible()
  await expect(page.getByText('Verlauf', { exact: true })).toBeVisible()

  // Info-Block ist vorhanden
  await expect(page.getByText('Wege zum Verschieben, Tauschen & Einreihen', { exact: true })).toBeVisible()

  // Tab-Leiste „Lagerstruktur“ / „Verlauf“ darf nicht mehr existieren
  await expect(page.getByRole('button', { name: 'Lagerstruktur' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Verlauf' })).toHaveCount(0)
})

test('Lagerplätze: Buttons der Lagerstruktur-Ansicht sind eindeutig benannt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('textbox', { name: 'Personalnummer' }).fill('admin1')
  await page.getByRole('textbox', { name: 'Admin-Passwort' }).fill('123')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.getByRole('button', { name: 'Admin-Panel' }).click()
  await page.getByRole('button', { name: 'Lagerplätze' }).click()

  // Jeder sichtbare Schrank hat die Buttons „Schublade hinzufügen“ und „Löschen“.
  const addDrawerButtons = page.getByRole('button', { name: 'Schublade hinzufügen' })
  const addCount = await addDrawerButtons.count()
  if (addCount > 0) {
    await expect(addDrawerButtons.first()).toBeVisible()
    // Panel per Klick öffnen -> Name/Anzahl-Felder erscheinen
    await addDrawerButtons.first().click()
    await expect(page.getByRole('button', { name: 'Schublade anlegen' })).toBeVisible()
    // Abbrechen schließt das Panel wieder
    await page.getByRole('button', { name: 'Schublade hinzufügen abbrechen' }).click()
    await expect(page.getByRole('button', { name: 'Schublade anlegen' })).toHaveCount(0)
  }
})

test('Lagerplätze: Verlauf zeigt Farb-Legende der Aktionen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('textbox', { name: 'Personalnummer' }).fill('admin1')
  await page.getByRole('textbox', { name: 'Admin-Passwort' }).fill('123')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.getByRole('button', { name: 'Admin-Panel' }).click()
  await page.getByRole('button', { name: 'Lagerplätze' }).click()

  // Die Legende erscheint nur, wenn Bewegungen vorhanden sind.
  const legend = page.getByText('Tausch', { exact: true })
  if (await legend.count()) {
    await expect(page.getByText('Verschieben', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Einreihen', { exact: true }).first()).toBeVisible()
  }
})
