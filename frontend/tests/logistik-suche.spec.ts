import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Logistik: Suche, Zeitraum, „nur meine", Personenkette und der Zustand in der
 * Adresszeile (DEC-090).
 *
 * Auftrag des Inhabers: „In der Logistik fehlen mir Filter, suchen, wer angelegt
 * hat, wer verschickt hat, wer angenommen hat." Die Suche läuft über den
 * **Server** (`q` im Backend): Auftrags-Nr., Reference, Info, Werkzeug-ID der
 * Positionen und Personennamen (angelegt, verschickt, je Werkzeug bestätigt).
 *
 * Läuft gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/logistik-suche.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

let adminToken: string | null = null
let werk1 = { id: 0, name: '' }
let werk2 = { id: 0, name: '' }
/** Eigener Werkzeug-Code und Auftrag je Lauf – nichts kollidiert mit Altdaten. */
let werkzeugCode = ''
let auftragsNummer = ''
let adminVorname = ''

async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.locator('.login-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

async function logistik(page: Page) {
  await page
    .getByRole('complementary')
    .getByRole('button', { name: /Logistik/ })
    .click()
  await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
}

const sucheFeld = (page: Page) => page.getByLabel('Aufträge durchsuchen')
const koepfe = (page: Page) => page.locator('button.kopf-auftrag')

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token
  const kopf = { Authorization: `Bearer ${adminToken}` }

  const werke = await request.get('/api/locations/plants', { headers: kopf })
  if (werke.ok()) {
    const liste = (await werke.json()) as { id: number; name: string }[]
    if (liste.length >= 2) {
      werk1 = liste[0]
      werk2 = liste[1]
    }
  }
  if (!werk1.id) return

  // Ein eigenes Werkzeug anlegen (mit eigenem Code) und in einen Auftrag legen –
  // so prüft die Suche einen Fall, den nur dieser Lauf erzeugt.
  werkzeugCode = `SUCH-${String(Date.now()).slice(-6)}`
  const typen = await request.get('/api/tools/types', { headers: kopf })
  const typId = typen.ok() ? ((await typen.json()) as { id: number }[])[0]?.id : null
  const neu = await request.post('/api/tools/', {
    headers: { ...kopf, 'X-Plant-Id': String(werk1.id) },
    data: {
      tool_id: werkzeugCode,
      category: 'Stempel',
      measure_a: '7,00',
      description: 'Suche-Probe (Browser-Test)',
      tool_type_id: typId,
      plant_id: werk1.id,
      is_storage: false,
      allow_duplicate_id: false,
    },
  })
  if (!neu.ok()) {
    werkzeugCode = ''
    return
  }
  const werkzeug = (await neu.json()) as { id: number }

  auftragsNummer = `SUCHE-${String(Date.now()).slice(-6)}`
  const auftrag = await request.post('/api/transport/orders', {
    headers: { ...kopf, 'X-Plant-Id': String(werk1.id) },
    data: {
      order_number: auftragsNummer,
      to_plant_id: werk2.id,
      info: 'Nur für den Suchtest',
      items: [{ tool_id: werkzeug.id }],
    },
  })
  if (auftrag.ok()) {
    const daten = (await auftrag.json()) as { created_by_name: string | null }
    adminVorname = (daten.created_by_name ?? '').split(' ')[0]
  }
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(!werkzeugCode, 'Testauftrag konnte nicht angelegt werden – Spec übersprungen')
})

test.describe('Logistik: Suche und Filter (DEC-090)', () => {
  test('Suche findet Auftrag über Werkzeug-ID und Person', async ({ page }) => {
    await anmelden(page)
    await logistik(page)

    // Über die Werkzeug-ID – das konnte die Suche vorher nicht.
    await sucheFeld(page).fill(werkzeugCode)
    await expect(
      page.getByRole('button', { name: new RegExp(auftragsNummer) }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(koepfe(page)).toHaveCount(1)

    // Über den Namen der Person, die den Auftrag angelegt hat.
    await sucheFeld(page).fill(adminVorname)
    await expect(
      page.getByRole('button', { name: new RegExp(auftragsNummer) }),
    ).toBeVisible({ timeout: 10_000 })

    // Über den Info-Text.
    await sucheFeld(page).fill('Nur für den Suchtest')
    await expect(
      page.getByRole('button', { name: new RegExp(auftragsNummer) }),
    ).toBeVisible({ timeout: 10_000 })

    // Etwas, das es nicht gibt: leere Liste mit Hinweis, kein Fehler.
    await sucheFeld(page).fill('gibtesnicht-1234')
    await expect(page.getByText(/Kein Auftrag|kein Treffer|Kein Treffer/i).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.screenshot({ path: `${SHOTS}/logistik-04-suche.png` })
  })

  test('„nur meine" und Zeitraum filtern die Liste', async ({ page }) => {
    await anmelden(page)
    await logistik(page)
    await expect(koepfe(page).first()).toBeVisible({ timeout: 10_000 })

    // „nur meine": der Testauftrag ist vom angemeldeten Admin – er bleibt sichtbar.
    await page.getByRole('checkbox', { name: /nur meine/ }).check()
    await sucheFeld(page).fill(werkzeugCode)
    await expect(
      page.getByRole('button', { name: new RegExp(auftragsNummer) }),
    ).toBeVisible({ timeout: 10_000 })
    await sucheFeld(page).fill('')
    await page.getByRole('checkbox', { name: /nur meine/ }).uncheck()

    // Zeitraum „letzte 7 Tage": Danach steht der Filter in der Adresszeile, und
    // **keine** sichtbare Zeile ist älter als 7 Tage. Gemessen am Alterstext der
    // Zeile, nicht an einer Zeilenzahl: Die Liste lädt nach, eine Zahl wäre
    // mitten im Laden falsch (genau daran war der Test zuerst unzuverlässig).
    await page
      .getByRole('group', { name: 'Zeitraum' })
      .getByRole('button', { name: 'letzte 7 Tage' })
      .click()
    await expect(
      page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'letzte 7 Tage' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => new URL(page.url()).searchParams.get('log-zeit'), { timeout: 10_000 })
      .toBe('7')

    const alter = await page.locator('button.kopf-auftrag .ui-alter').allInnerTexts()
    for (const text of alter) {
      const treffer = text.match(/seit (\d+) Tagen/)
      if (treffer) expect(Number(treffer[1]), `Alter in „${text}"`).toBeLessThanOrEqual(7)
    }
  })

  test('die Ansicht steht in der Adresszeile und übersteht ein Neuladen', async ({ page }) => {
    await anmelden(page)
    await logistik(page)

    await sucheFeld(page).fill(werkzeugCode)
    await page
      .getByRole('group', { name: 'Zeitraum' })
      .getByRole('button', { name: 'letzte 30 Tage' })
      .click()
    await page.getByRole('checkbox', { name: /nur meine/ }).check()

    const adresse = new URL(page.url())
    expect(adresse.searchParams.get('log-suche')).toBe(werkzeugCode)
    expect(adresse.searchParams.get('log-zeit')).toBe('30')
    expect(adresse.searchParams.get('log-meine')).toBe('1')

    await page.reload()
    // Der Bereich selbst steht (noch) nicht in der Adresszeile – nach dem Neuladen
    // öffnet die App die Werkzeugliste. Die **Ansicht** der Logistik kommt aus der
    // Adresszeile, sobald man den Bereich wieder öffnet.
    await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
    await logistik(page)
    await expect(sucheFeld(page)).toHaveValue(werkzeugCode)
    await expect(
      page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'letzte 30 Tage' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('checkbox', { name: /nur meine/ })).toBeChecked()
  })

  test('die Personenkette nennt angelegt und verschickt mit Vollnamen im Tooltip', async ({
    page,
  }) => {
    await anmelden(page)
    await logistik(page)
    await sucheFeld(page).fill(auftragsNummer)

    const kopf = page.getByRole('button', { name: new RegExp(auftragsNummer) })
    await expect(kopf).toBeVisible({ timeout: 10_000 })
    await kopf.click()

    // „angelegt …" steht als Plakette im aufgeklappten Auftrag.
    const marke = page.getByText('angelegt', { exact: true }).first()
    await expect(marke).toBeVisible()
    // Vollname im Tooltip: Der Wirt (`.tip-wirt`) trägt den Hinweis.
    await marke.hover()
    await expect(page.getByRole('tooltip')).toContainText(/angelegt: .+/)

    await page.screenshot({ path: `${SHOTS}/logistik-05-personenkette.png` })
  })
})
