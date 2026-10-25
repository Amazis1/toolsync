import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Tooltips (DEC-088): eine Sprechblase statt `title="…"`.
 *
 * Vorher hing der erklärende Satz an 21 Stellen als **native** `title`-Attribut
 * im Markup: langsam, unbegehbar per Tastatur, in jedem Browser anders und in
 * Tabellen/Fenstern nicht vorhanden (der Browser zeigt ihn nicht, wenn ein
 * Elternteil `overflow: hidden` hat – bzw. er wird nicht gesteuert). Das
 * Tooltip-CSS der Anwendung (`index.css`, „TOOLTIPS") war überhaupt nicht
 * angeschlossen.
 *
 * Diese Spec prüft:
 *
 *   1. Die Blase erscheint beim Überfahren **und** beim Fokus (Tastatur).
 *   2. Sie liegt **über** dem Auslöser und vollständig im Bild.
 *   3. Sie wird **nicht** abgeschnitten – auch in der Tabelle (Scrollcontainer)
 *      und im Fenster `overflow-hidden` (Portal an `<body>`).
 *   4. Im ganzen Hauptfenster gibt es **kein** `title=` mehr (`iframe` ausgenommen).
 *
 * Ausführen gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/tooltips.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

let adminToken: string | null = null

async function adminLogin(request: APIRequestContext): Promise<string | null> {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return null
  return (await login.json()).access_token as string
}

test.beforeAll(async ({ request }) => {
  adminToken = await adminLogin(request)
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
})

/** Anmelden als Admin (Personalnummer + Passwort). */
async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  // Erst wenn die Anmelde-Überlagerung weg ist, sind Klicks darunter möglich –
  // sie liegt `fixed inset-0` über der Seite und fängt sonst jeden Klick ab.
  await expect(page.locator('.login-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

/** Bereich wählen und warten, bis er wirklich bedienbar ist. */
async function bereich(page: Page, name: string) {
  if (name === 'Logistik') {
    // Seit DEC-095 eine Karte der rechten Spalte, kein Reiter.
    await page
      .getByRole('complementary')
      .getByRole('button', { name: /Logistik/ })
      .click()
  } else {
    await page
      .getByRole('navigation', { name: 'Bereiche wechseln' })
      .getByRole('button', { name })
      .click()
  }
  await expect(page.locator('.login-overlay')).toHaveCount(0)
}

/**
 * Prüft Lage und Inhalt der Blase für einen Auslöser und räumt danach auf.
 *
 * `richtung` sagt, wo die Blase erwartet wird: `oben` heißt „ihre Unterkante
 * liegt über der Oberkante des Auslösers".
 */
async function pruefeBlase(
  page: Page,
  ausloeser: ReturnType<Page['locator']>,
  text: string | RegExp,
  richtung: 'oben' | 'unten' = 'oben',
) {
  const blase = page.getByRole('tooltip')
  // Genau **eine** Blase: ein liegengebliebener Tooltip wäre der klassische
  // Fehler (zwei Sprechblasen übereinander).
  await expect(blase).toHaveCount(1)
  await expect(blase).toBeVisible()
  await expect(blase).toContainText(text)

  const b = await blase.boundingBox()
  const a = await ausloeser.boundingBox()
  expect(b, 'Blase messbar').not.toBeNull()
  expect(a, 'Auslöser messbar').not.toBeNull()
  const fenster = page.viewportSize()!

  // vollständig im Bild – auch am Rand (der Anker wird eingeklemmt)
  expect(b!.x).toBeGreaterThanOrEqual(0)
  expect(b!.x + b!.width).toBeLessThanOrEqual(fenster.width)
  expect(b!.y).toBeGreaterThanOrEqual(0)
  expect(b!.y + b!.height).toBeLessThanOrEqual(fenster.height)
  if (richtung === 'oben') {
    expect(b!.y + b!.height).toBeLessThanOrEqual(a!.y + 1)
  } else {
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height - 1)
  }

  await page.mouse.move(5, 5)
  await expect(blase).toHaveCount(0)
}

test.describe('Tooltips', () => {
  test('Liste: Blase über dem Auslöser, im Scrollcontainer nicht abgeschnitten', async ({
    page,
  }) => {
    await anmelden(page)
    // Die Datenblätter-Liste liegt in einem `overflow-x-auto`; eine Blase im
    // Textfluss würde dort abgeschnitten (Portal an <body> verhindert das).
    await bereich(page, 'Datenblätter')

    // Der Sortier-Knopf trägt die Spaltenüberschrift als Namen (die `aria-sort`
    // steht an der Kopfzelle).
    const kopf = page.getByRole('button', { name: 'Werkzeug-ID', exact: true })
    await kopf.hover()
    await pruefeBlase(page, kopf, 'Sortierung wechseln (auf → ab → Standard)', 'oben')

    await page.screenshot({ path: `${SHOTS}/tooltip-01-liste.png` })
  })

  test('Blase erscheint auch beim Fokus (Tastatur)', async ({ page }) => {
    await anmelden(page)

    const kopf = page.getByRole('button', { name: /Nach Werkzeug-ID sortieren/ })
    await kopf.focus()
    await expect(page.getByRole('tooltip')).toContainText('Sortierung wechseln')
    // Der Wirt verweist auf die Blase – Screenreader lesen den Hinweis mit.
    await expect(page.locator('[aria-describedby]').first()).toBeVisible()
  })

  test('Fenster: Blase kommt aus dem `overflow-hidden`-Panel heraus', async ({ page }) => {
    await anmelden(page)
    await bereich(page, 'Logistik')

    await page.getByRole('button', { name: 'Neuer Auftrag' }).click()
    const dialog = page.getByRole('dialog', { name: /Neuer Auftrag/ })
    await expect(dialog).toBeVisible()

    // Der Knopf steht in der Fußleiste des Fensters – die Blase muss trotzdem
    // vollständig sichtbar sein (Portal an <body>).
    const knopf = dialog.getByRole('button', { name: 'Speichern und nächster' })
    await knopf.hover()
    await pruefeBlase(page, knopf, 'Entwurf speichern und gleich den nächsten anlegen', 'oben')

    await page.screenshot({ path: `${SHOTS}/tooltip-02-fenster.png` })

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  test('kein `title=` mehr in der Oberfläche (iframe-Beschriftung ausgenommen)', async ({
    page,
  }) => {
    await anmelden(page)

    // Alle Bereiche einmal durchgehen – `title` ist nirgends mehr eine Fundstelle
    // für Hinweise; es lebt nur noch als Prop (Fenstertitel) weiter.
    for (const name of ['Werkzeuge', 'Serienartikel', 'Datenblätter', 'Ersatzteile', 'Logistik']) {
      await bereich(page, name)
      await page.waitForTimeout(300)
      const gefunden = await page.evaluate(() =>
        [...document.querySelectorAll('[title]')]
          .filter((el) => el.tagName !== 'IFRAME')
          .map((el) => `${el.tagName.toLowerCase()}:${el.getAttribute('title')}`),
      )
      expect(gefunden, `title= in „${name}"`).toEqual([])
    }
  })
})
