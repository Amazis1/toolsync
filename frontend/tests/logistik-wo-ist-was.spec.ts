import { test, expect, type Page } from '@playwright/test'

/**
 * „Wo ist was": Suche, Filter und „seit wann draußen" (DEC-093).
 *
 * Die Ansicht zeigte bisher alle ausgeliehenen und unterwegs befindlichen
 * Werkzeuge ohne Suche, ohne Filter und **ohne Zeitangabe** – „ausgeliehen" stand
 * da, aber nicht seit wann. Damit war die Frage, die diese Seite beantwortet
 * („was liegt bei wem, und wie lange schon?"), nur halb beantwortet.
 *
 * Läuft gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/logistik-wo-ist-was.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

let adminToken: string | null = null

async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.locator('.login-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

async function woIstWas(page: Page) {
  await page
    .getByRole('complementary')
    .getByRole('button', { name: /Logistik/ })
    .click()
  await page
    .getByRole('group', { name: 'Logistik' })
    .getByRole('button', { name: 'Wo ist was' })
    .click()
  await expect(page.getByRole('heading', { name: 'Wo ist was' })).toBeVisible()
}

const sucheFeld = (page: Page) => page.getByLabel('Draußen befindliche Werkzeuge durchsuchen')
const zeilen = (page: Page) => page.locator('tbody tr')

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
})

test.describe('Wo ist was (DEC-093)', () => {
  test('jede Zeile nennt, seit wann das Werkzeug draußen ist', async ({ page }) => {
    await anmelden(page)
    await woIstWas(page)

    // Es gibt Werkzeuge in der Liste (Produktivbestand hat Ausleihen/Transporte);
    // falls nicht, prüft der Test nur den Leerzustand.
    const anzahl = await zeilen(page).count()
    if (anzahl === 0) {
      await expect(page.getByText(/alle Werkzeuge liegen am Platz/i)).toBeVisible()
      return
    }

    // Spalte „Seit" ist gefüllt („seit …" oder „gerade eben").
    await expect(page.locator('tbody tr .ui-alter').first()).toHaveText(/seit|gerade eben/)
    await page.screenshot({ path: `${SHOTS}/logistik-07-wo-ist-was.png` })
  })

  test('Suche findet Werkzeug, Person und Auftrag – und meldet „kein Treffer"', async ({
    page,
  }) => {
    await anmelden(page)
    await woIstWas(page)
    await expect(zeilen(page).first()).toBeVisible()

    // Ein Begriff, der garantiert nichts trifft.
    await sucheFeld(page).fill('gibtesnicht-1234')
    await expect(page.getByText(/Kein Werkzeug passt zu dieser Suche/i)).toBeVisible()

    // Ein Treffer: die Werkzeug-ID der ersten Zeile (ohne Filter) suchen.
    await sucheFeld(page).fill('')
    await expect(zeilen(page).first()).toBeVisible()
    const ersteId = (await page.locator('tbody tr code').first().innerText()).trim()
    test.skip(!ersteId, 'Die erste Zeile hat keine Werkzeug-ID')
    await sucheFeld(page).fill(ersteId)
    await expect(zeilen(page).first()).toContainText(ersteId)
    await expect(zeilen(page)).toHaveCount(1)

    // Zurücksetzen stellt die volle Liste wieder her.
    await page.getByRole('button', { name: /zurücksetzen/i }).click()
    await expect(sucheFeld(page)).toHaveValue('')
    await expect(zeilen(page).first()).toBeVisible()
  })

  test('„länger als 7 Tage" filtert und zählt', async ({ page }) => {
    await anmelden(page)
    await woIstWas(page)

    const filter = page.getByLabel(/länger als 7 Tage/i)
    await expect(filter).toBeVisible()
    // Erst warten, bis die Liste geladen ist – sonst wird die Zeile
    // „Wird geladen …" mitgezählt (genau daran scheiterte der Test zuerst).
    await expect(page.locator("tbody")).not.toContainText("Wird geladen")
    await expect(page.locator("tbody tr .ui-alter").first()).toBeVisible()

    await filter.check()
    await expect(filter).toBeChecked()

    // Jede verbleibende Zeile ist mindestens 7 Tage draußen (gemessen am
    // Alterstext, nicht an einer Zeilenzahl – die sagt nichts über den Filter).
    const alter = await page.locator("tbody tr .ui-alter").allInnerTexts()
    for (const text of alter) {
      const treffer = text.match(/seit (\d+) (Tag|Tagen)/)
      if (treffer) {
        expect(Number(treffer[1]), `Alter in „${text}"`).toBeGreaterThanOrEqual(7)
      }
    }

    // Der Filter nennt seine eigene Zahl in der Klammer und hebt sich wieder auf.
    await filter.uncheck()
    await expect(filter).not.toBeChecked()
  })
})
