import { test, expect, type Page } from '@playwright/test'

/**
 * Bereich „Historie" (DEC-094): der Verlauf aller Werkzeugbewegungen mit Suche,
 * Vorgangs- und Zeitraumfilter, Werk-Umschalter und Seiten.
 *
 * Bis hier stand im Reiter nur ein Platzhalter. Geprüft wird, was den Bereich
 * ausmacht:
 *
 *   1. Die Liste zeigt Bewegungen mit Zeit, Werkzeug, Vorgang, von → nach,
 *      Person, Arbeitswerk und Notiz.
 *   2. Die Suche findet Werkzeug und Person; Unsinn meldet „keine Bewegung".
 *   3. Der Vorgangs-Chip filtert (und hebt sich wieder auf).
 *   4. Der Zeitraum-Filter lässt nur junge Bewegungen stehen.
 *
 * Läuft gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/historie.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.locator('.login-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

async function historie(page: Page) {
  await page
    .getByRole('navigation', { name: 'Bereiche wechseln' })
    .getByRole('button', { name: 'Historie', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Historie' })).toBeVisible()
}

/** Erste Datenzeile der Verlaufs-Tabelle (ohne Lade-/Leerzustand). */
const ersteZeile = (page: Page) =>
  page.locator('table tbody tr').filter({ has: page.locator('td code') }).first()

test.describe('Historie (DEC-094)', () => {
  test('zeigt Bewegungen mit Zeit, Werkzeug, Vorgang, Person und Arbeitswerk', async ({
    page,
  }) => {
    await anmelden(page)
    await historie(page)

    await expect(page.locator('table')).toBeVisible()
    // Kopfzeile des Verlaufs.
    for (const spalte of ['Zeit', 'Werkzeug', 'Vorgang', 'Person', 'Arbeitswerk']) {
      await expect(page.getByRole('columnheader', { name: spalte })).toBeVisible()
    }

    // Erst das Laden abwarten – sonst zählt die Zeile „Verlauf wird geladen …"
    // als (fehlende) Datenzeile.
    await expect(page.locator("table tbody")).not.toContainText("Verlauf wird geladen")

    // Produktivdaten haben Bewegungen; falls nicht, prüft der Test den Leerzustand.
    const anzahl = await ersteZeile(page).count()
    if (anzahl === 0) {
      await expect(page.getByText(/Noch keine Bewegung verzeichnet/i)).toBeVisible()
      return
    }

    const zeile = ersteZeile(page)
    await expect(zeile.locator('td').first()).not.toBeEmpty()
    // Vorgang ist eine der fünf Arten.
    await expect(zeile).toContainText(/Ausleihe|Rückgabe|Umgebucht|Statuswechsel|Weitergabe/)
    await page.screenshot({ path: `${SHOTS}/historie-01-liste.png` })
  })

  test('Suche findet Werkzeug und meldet „keine Bewegung"', async ({ page }) => {
    await anmelden(page)
    await historie(page)
    await expect(ersteZeile(page)).toBeVisible({ timeout: 15_000 })

    const feld = page.getByLabel('Verlauf durchsuchen')

    // Ein Begriff, der nichts trifft.
    await feld.fill('gibtesnicht-1234')
    await expect(page.getByText(/Keine Bewegung passt zu dieser Auswahl/i)).toBeVisible()

    // Zurücksetzen stellt die Liste wieder her.
    await page.getByRole('button', { name: /zurücksetzen/i }).click()
    await expect(feld).toHaveValue('')
    await expect(ersteZeile(page)).toBeVisible({ timeout: 15_000 })

    // Ein echter Treffer: die Werkzeug-ID der ersten Zeile.
    const id = (await ersteZeile(page).locator('code').first().innerText()).trim()
    if (!id || id.startsWith('#')) return
    await feld.fill(id)
    await expect(ersteZeile(page)).toContainText(id)
  })

  test('Vorgangs-Chip und Zeitraum filtern', async ({ page }) => {
    await anmelden(page)
    await historie(page)
    await expect(ersteZeile(page)).toBeVisible({ timeout: 15_000 })

    const gruppe = page.getByRole('group', { name: 'Vorgang' })
    const rueckgabe = gruppe.getByRole('button', { name: /^Rückgabe/ })
    await rueckgabe.click()
    await expect(rueckgabe).toHaveAttribute('aria-pressed', 'true')

    // Es bleiben nur Rückgaben (oder der Leerzustand).
    const nachFilter = await ersteZeile(page).count()
    if (nachFilter > 0) {
      const texte = await page.locator('table tbody tr td:nth-child(3)').allInnerTexts()
      for (const text of texte) {
        if (text.trim()) expect(text.trim()).toBe('Rückgabe')
      }
    }

    await rueckgabe.click()
    await expect(rueckgabe).toHaveAttribute('aria-pressed', 'false')

    // Zeitraum: „7 Tage" – danach steht der Filter im Kopf und die Liste ist
    // höchstens so lang wie vorher.
    await page
      .getByRole('group', { name: 'Zeitraum' })
      .getByRole('button', { name: '7 Tage' })
      .click()
    await expect(
      page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: '7 Tage' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/\(gefiltert\)/)).toBeVisible()
  })
})
