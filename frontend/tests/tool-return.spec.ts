import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

/**
 * Rückgabe eines Werkzeugs an eine Person (DEC-078) – über den Bedienweg.
 *
 * Geprüft wird:
 *  - im Zeilenmenü eines **ausgeliehenen** Werkzeugs steht „Zurückgeben" (und
 *    nicht mehr „Ausleihen"),
 *  - die Rückgabe über den Dialog setzt das Werkzeug wieder auf „verfügbar",
 *  - der Vorgang landet mit Benutzer und Arbeitswerk im Verlauf,
 *  - die Rückgabe-Liste (`/movements/active`) ist danach leer – einzelne
 *    Werkzeuge werden **nicht** als ganze Liste zurückgegeben.
 *
 * Voraussetzung: Backend und Dev-Server laufen, Admin-Konto `admin1/123`.
 * Die Spec legt ihr Werkzeug selbst an und räumt es hinterher weg.
 *
 *     npx playwright test tests/tool-return.spec.ts --workers=1
 */

const ADMIN = { personal_number: 'admin1', password: '123' }

let adminToken = ''
let plantId = 0
let toolTypeId = 0
let werkzeugId: number | null = null
let kennung = ''

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  const werke = await request.get('/api/locations/plants', { headers: auth() })
  const typen = await request.get('/api/tools/types', { headers: auth() })
  if (!werke.ok() || !typen.ok()) return
  plantId = (await werke.json())[0]?.id ?? 0
  toolTypeId = (await typen.json())[0]?.id ?? 0

  kennung = `RT-${String(Date.now()).slice(-6)}`
  const erstellt = await request.post('/api/tools/', {
    headers: auth(),
    data: {
      tool_id: kennung,
      category: 'Stempel',
      status: 'available',
      is_storage: false,
      allow_duplicate_id: false,
      measure_a: '7,00',
      plant_id: plantId,
      tool_type_id: toolTypeId,
    },
  })
  if (erstellt.ok()) werkzeugId = (await erstellt.json()).id
})

test.afterAll(async ({ request }: { request: APIRequestContext }) => {
  if (!adminToken || werkzeugId === null) return
  await request.delete(`/api/tools/${werkzeugId}`, { headers: auth() })
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(werkzeugId === null, 'Test-Werkzeug konnte nicht angelegt werden')
})

/** Die Tabellenzeile des Testwerkzeugs. */
function zeile(page: import('@playwright/test').Page) {
  return page.locator('tbody tr', { hasText: kennung }).first()
}

/** Zeilenmenü öffnen (Knopf „Weitere Aktionen für …"). */
async function zeilenMenue(page: import('@playwright/test').Page) {
  await zeile(page)
    .getByRole('button', { name: new RegExp(`Weitere Aktionen für ${kennung}`) })
    .click()
}

test('ausgeliehenes Werkzeug lässt sich einzeln zurückgeben', async ({ page, request }) => {
  // Ausleihen über die API (der Ausleih-Dialog ist nicht Teil dieser Spec) –
  // der Benutzer kommt aus dem Token, das Werkzeug ist danach `lent`.
  const token = (await (
    await request.post('/api/auth/login', { data: { personal_number: '1234' } })
  ).json()).access_token as string
  const ausleihe = await request.post('/api/movements/', {
    headers: auth(token),
    data: { movement_type: 'lend', tool_id: werkzeugId, user_id: null },
  })
  if (!ausleihe.ok()) {
    console.log('AUSLEIHE FEHLER', ausleihe.status(), await ausleihe.text())
  }
  expect(ausleihe.ok()).toBeTruthy()

  await page.goto('/')
  await page.getByLabel('Personalnummer').fill('1234')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
  await page.getByLabel('Werkzeuge durchsuchen').fill(kennung)
  await expect(page.getByText(/^1–1 von 1 Werkzeug$/)).toBeVisible({ timeout: 5000 })

  // Das Zeilenmenü bietet jetzt die Rückgabe an
  await zeilenMenue(page)
  await expect(page.getByRole('menuitem', { name: 'Zurückgeben' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Ausleihen' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Zurückgeben' }).click()

  // Dialog: Werkzeug, Kategorie und Heimatplatz werden gezeigt, dann zurückgeben
  const dialog = page.getByRole('dialog', { name: 'Werkzeug zurückgeben' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(kennung)).toBeVisible()
  await dialog.getByLabel('Notiz (optional)').fill('Rückgabe im Browser-Test')
  await dialog.getByRole('button', { name: 'Zurückgeben' }).click()
  await expect(dialog).toBeHidden({ timeout: 5000 })

  // Das Werkzeug ist wieder verfügbar und steht in keiner Ausleih-Liste mehr
  await expect
    .poll(async () => {
      const liste = await request.get('/api/movements/active', { headers: auth(token) })
      if (!liste.ok()) return 'fehler'
      const eintraege = (await liste.json()) as { tool_id: number }[]
      return eintraege.some((e) => e.tool_id === werkzeugId) ? 'ausgeliehen' : 'verfuegbar'
    })
    .toBe('verfuegbar')

  // Und das Zeilenmenü bietet wieder „Ausleihen" an
  await page.getByLabel('Werkzeuge durchsuchen').fill(kennung)
  await zeilenMenue(page)
  await expect(page.getByRole('menuitem', { name: 'Ausleihen' })).toBeVisible()
})

test('die Rückgabe steht mit Benutzer und Arbeitswerk im Verlauf', async ({ request }) => {
  const token = (await (
    await request.post('/api/auth/login', { data: { personal_number: '1234' } })
  ).json()).access_token as string

  // Ausleihen und zurückgeben – beides über die API, dann den Verlauf lesen
  await request.post('/api/movements/', {
    headers: auth(token),
    data: { movement_type: 'lend', tool_id: werkzeugId, user_id: null },
  })
  const zurueck = await request.post(`/api/movements/return/${werkzeugId}`, {
    headers: auth(token),
    data: { note: 'Verlaufsprobe' },
  })
  expect(zurueck.ok()).toBeTruthy()

  const verlauf = await request.get(`/api/movements/?tool_id=${werkzeugId}&limit=5`, {
    headers: auth(token),
  })
  expect(verlauf.ok()).toBeTruthy()
  const eintraege = (await verlauf.json()) as {
    movement_type: string
    user_id: number | null
    plant_id: number | null
    note: string | null
    from_location: string | null
  }[]
  const rueckgabe = eintraege.find((e) => e.movement_type === 'return')
  expect(rueckgabe).toBeTruthy()
  expect(rueckgabe?.user_id).not.toBeNull()
  expect(rueckgabe?.plant_id).toBe(plantId)
  expect(rueckgabe?.note).toBe('Verlaufsprobe')
})

test('ein nicht ausgeliehenes Werkzeug lässt sich nicht zurückgeben', async ({ request }) => {
  const token = (await (
    await request.post('/api/auth/login', { data: { personal_number: '1234' } })
  ).json()).access_token as string

  const antwort = await request.post(`/api/movements/return/${werkzeugId}`, {
    headers: auth(token),
    data: {},
  })
  expect(antwort.status()).toBe(400)
  const fehler = (await antwort.json()) as { detail: string }
  expect(fehler.detail).toContain('nicht ausgeliehen')
})
