import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Zeitstrahl im Fenster „Auftrag öffnen" (DEC-091).
 *
 * Der Nachweis stand vorher als **drei Sätze** untereinander („Angelegt … von …",
 * „Unterwegs seit …", „abgeschlossen …"). Jetzt ist der Ablauf eine Kette:
 * angelegt → verschickt → (teilweise) angekommen → abgeschlossen, je Schritt mit
 * Zeitpunkt, Person (Initialen, Vollname im Tooltip) und Werk.
 *
 * Geprüft wird an einem Auftrag, den dieser Lauf selbst anlegt und verschickt
 * (gegen eine Datenbank-Kopie):
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/logistik-nachweis.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

let adminToken: string | null = null
let werk1 = { id: 0, name: '' }
let werk2 = { id: 0, name: '' }
let auftragsNummer = ''
let orderId = 0

async function kopfFuer(plantId: number) {
  return {
    Authorization: `Bearer ${adminToken}`,
    'X-Plant-Id': String(plantId),
  }
}

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

/** Auftrag in der Liste suchen und das Nachweis-Fenster öffnen. */
async function nachweisOeffnen(page: Page) {
  await logistik(page)
  await page.getByLabel('Aufträge durchsuchen').fill(auftragsNummer)
  const kopf = page.getByRole('button', { name: new RegExp(auftragsNummer) })
  await expect(kopf).toBeVisible({ timeout: 10_000 })
  await kopf.click()
  await page.getByRole('button', { name: 'Auftrag öffnen' }).click()
  const dialog = page.getByRole('dialog', { name: new RegExp(`Auftrag ${auftragsNummer}`) })
  await expect(dialog).toBeVisible()
  return dialog
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  const werke = await request.get('/api/locations/plants', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (werke.ok()) {
    const liste = (await werke.json()) as { id: number; name: string }[]
    if (liste.length >= 2) {
      werk1 = liste[0]
      werk2 = liste[1]
    }
  }
  if (!werk1.id) return

  const typen = await request.get('/api/tools/types', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const typId = typen.ok() ? ((await typen.json()) as { id: number }[])[0]?.id : null
  const neu = await request.post('/api/tools/', {
    headers: await kopfFuer(werk1.id),
    data: {
      tool_id: `NACHW-${String(Date.now()).slice(-6)}`,
      category: 'Stempel',
      measure_a: '9,00',
      description: 'Nachweis-Probe (Browser-Test)',
      tool_type_id: typId,
      plant_id: werk1.id,
      is_storage: false,
      allow_duplicate_id: false,
    },
  })
  if (!neu.ok()) return
  const werkzeug = (await neu.json()) as { id: number }

  auftragsNummer = `NACHW-${String(Date.now()).slice(-6)}`
  const auftrag = await request.post('/api/transport/orders', {
    headers: await kopfFuer(werk1.id),
    data: {
      order_number: auftragsNummer,
      to_plant_id: werk2.id,
      info: 'Zeitstrahl-Probe',
      items: [{ tool_id: werkzeug.id }],
    },
  })
  if (!auftrag.ok()) return
  orderId = ((await auftrag.json()) as { id: number }).id
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(orderId === 0, 'Testauftrag konnte nicht angelegt werden – Spec übersprungen')
})

test.describe('Nachweis mit Zeitstrahl (DEC-091)', () => {
  test('zeigt Angelegt → Verschickt → Empfang offen mit Personen', async ({ page, request }) => {
    // Verschicken (als abgebendes Werk) – danach ist der Auftrag unterwegs.
    const gesendet = await request.post(`/api/transport/orders/${orderId}/send`, {
      headers: await kopfFuer(werk1.id),
      data: {},
    })
    expect(gesendet.ok()).toBe(true)

    await anmelden(page)
    const dialog = await nachweisOeffnen(page)

    const ablauf = dialog.getByRole('region', { name: 'Ablauf des Auftrags' })
    await expect(ablauf).toBeVisible()
    await expect(ablauf).toContainText('Angelegt')
    await expect(ablauf).toContainText('Verschickt')
    await expect(ablauf).toContainText('Empfang offen')
    // „Empfang offen" steht aus – also ohne Zeitpunkt, aber mit Zielwerk.
    await expect(ablauf).toContainText(werk2.name)

    // Der Anleger steht als Initialen-Plakette im Ablauf, der Vollname im Tooltip.
    const marke = ablauf.getByText('angelegt', { exact: true }).first()
    await expect(marke).toBeVisible()
    await marke.hover()
    await expect(page.getByRole('tooltip')).toContainText(/angelegt: .+/)

    await page.screenshot({ path: `${SHOTS}/logistik-06-zeitstrahl.png` })
  })

  test('nach dem Empfang endet der Ablauf mit „Angekommen"', async ({ page, request }) => {
    // Empfang im Zielwerk bestätigen (alles).
    const empfangen = await request.post(`/api/transport/orders/${orderId}/receive`, {
      headers: await kopfFuer(werk2.id),
      data: {},
    })
    expect(empfangen.ok()).toBe(true)

    await anmelden(page)
    const dialog = await nachweisOeffnen(page)

    const ablauf = dialog.getByRole('region', { name: 'Ablauf des Auftrags' })
    await expect(ablauf).toContainText('Angekommen')
    await expect(ablauf).toContainText('alle 1 Werkzeuge bestätigt')
    await expect(ablauf).not.toContainText('Empfang offen')
  })
})
