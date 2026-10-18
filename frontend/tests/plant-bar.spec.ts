import { test, expect } from '@playwright/test'

/**
 * Arbeitswerk und Werkfarbe (DEC-070 / DEC-076) – im Browser, über den Bedienweg.
 *
 * Geprüft wird:
 *  - das Arbeitswerk steht **in der Sidebar** unter dem Benutzer (kein eigener Tab,
 *    keine Leiste über dem Inhalt),
 *  - der Wechsel: `aria-pressed` wandert, die Werkfarbe (`--werk`) ändert sich,
 *  - die Werkfarben sind in den Stammdaten **änderbar** (Farbwähler),
 *  - die Vorgabe „Arbeitswerk" im Benutzerformular wird gespeichert.
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173,
 * Admin-Konto `admin1/123` und mindestens zwei Werke (Werk 1, Werk 2).
 *
 * Jeder Test räumt hinter sich auf: die Werkfarbe wird auf den vorher
 * festgehaltenen Stand zurückgesetzt, der Test-Benutzer gelöscht.
 *
 *     npx playwright test tests/plant-bar.spec.ts --workers=1
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const PRIMAERFARBE = '#0f766e'

let werke: { id: number; name: string; color: string | null }[] = []
/** Vorher-Stand der Werkfarben – `afterAll` stellt ihn **exakt** wieder her. */
let farbenVorher: { id: number; color: string | null }[] = []
let adminToken: string | null = null
let testBenutzerId: number | null = null
let testNummer = ''

async function adminLogin(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return null
  return (await login.json()).access_token as string
}

test.beforeAll(async ({ request }) => {
  adminToken = await adminLogin(request)
  if (!adminToken) return
  const liste = await request.get('/api/locations/plants', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (liste.ok()) {
    werke = await liste.json()
    farbenVorher = werke.map((w) => ({ id: w.id, color: w.color }))
  }
  testNummer = `AW${String(Date.now()).slice(-6)}${test.info().workerIndex}`
})

test.afterAll(async ({ request }) => {
  if (!adminToken) return
  // Test-Benutzer entfernen
  if (testBenutzerId !== null) {
    await request.delete(`/api/users/${testBenutzerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
  }
  // Werkfarben auf den **festgehaltenen** Stand zurücksetzen – nicht auf einen
  // angenommenen Wert: sonst überschreibt der Test eine bewusst gesetzte Farbe.
  for (const werk of werke) {
    const vorher = farbenVorher.find((f) => f.id === werk.id)
    if (!vorher) continue
    await request.put(`/api/locations/plants/${werk.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: werk.name, color: vorher.color },
    })
  }
})

/** Anmelden als Mitarbeiter (nur Personalnummer). */
async function alsMitarbeiter(page: import('@playwright/test').Page, nummer: string) {
  await page.goto('/')
  await page.getByLabel('Personalnummer').fill(nummer)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  // Die Oberfläche ist da, wenn die Tab-Leiste steht (die Login-Seite hat keine).
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

/** Die Leiste „Arbeitswerk" – über `role=group` adressiert, nicht über Texte. */
function arbeitswerkLeiste(page: import('@playwright/test').Page) {
  return page.getByRole('group', { name: 'Arbeitswerk wählen' })
}

/** Knopf eines Werks in der Leiste (Name = Werkname). */
function werkKnopf(page: import('@playwright/test').Page, name: string) {
  return arbeitswerkLeiste(page).getByRole('button', { name })
}

/** Aktuelle Werkfarbe aus den CSS-Variablen am Wurzelelement. */
async function werkfarbe(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--werk').trim(),
  )
}

test.beforeEach(async ({ request }) => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(
    werke.length < 2,
    `Mindestens zwei Werke nötig (gefunden: ${werke.length}) – Spec übersprungen`,
  )
  // Test-Benutzer je Test frisch – die Tests bleiben unabhängig voneinander.
  const erstellt = await request.post('/api/users/', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      personal_number: testNummer,
      first_name: 'Arbeitswerk',
      last_name: 'Test',
      is_admin: false,
      is_active: true,
    },
  })
  testBenutzerId = erstellt.ok() ? (await erstellt.json()).id : null
  test.skip(testBenutzerId === null, 'Test-Benutzer konnte nicht angelegt werden')
})

test.afterEach(async ({ request }) => {
  if (!adminToken || testBenutzerId === null) return
  await request.delete(`/api/users/${testBenutzerId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  testBenutzerId = null
})

// ----------------------------------------------------------------
// 1) Das Arbeitswerk steht in der Sidebar – kein eigener Tab, keine Leiste
// ----------------------------------------------------------------
test('Arbeitswerk steht in der Sidebar unter dem Benutzer', async ({ page }) => {
  await alsMitarbeiter(page, testNummer)

  const leiste = arbeitswerkLeiste(page)
  await expect(leiste).toBeVisible()
  await expect(leiste.getByText('Arbeitswerk', { exact: true })).toBeVisible()

  // Jedes Werk ist ein Knopf mit seinem Namen
  for (const werk of werke) {
    await expect(werkKnopf(page, werk.name)).toBeVisible()
  }

  // Es liegt **in** der Sidebar (.app-sidebar) …
  const inSidebar = await leiste.evaluate((el) => !!el.closest('.app-sidebar'))
  expect(inSidebar).toBe(true)

  // … und es gibt keine Arbeitswerk-Leiste mehr über der Tab-Leiste:
  // die Tab-Leiste ist das erste Element im Inhaltsbereich.
  const ueberDenTabs = await page.evaluate(() => {
    const tabs = document.querySelector('nav[aria-label="Bereiche wechseln"]')
    if (!tabs) return false
    const gruppe = document.querySelector('[role="group"][aria-label="Arbeitswerk wählen"]')
    if (!gruppe) return false
    // Oben liegt die Gruppe nur, wenn sie außerhalb der Sidebar steht
    return !gruppe.closest('.app-sidebar')
  })
  expect(ueberDenTabs).toBe(false)

  // Und es gibt keinen Tab, der nach dem Arbeitswerk heißt
  const tabs = await page
    .getByRole('navigation', { name: 'Bereiche wechseln' })
    .getByRole('button')
    .allTextContents()
  expect(tabs.join(' ')).not.toMatch(/Arbeitswerk/i)
})

// ----------------------------------------------------------------
// 2) Der Wechsel: Markierung wandert, Werkfarbe wechselt
// ----------------------------------------------------------------
test('Wechsel des Arbeitswerks ändert Markierung und Werkfarbe', async ({ page }) => {
  await alsMitarbeiter(page, testNummer)
  const erstes = werke[0]
  const zweites = werke[1]

  await expect(werkKnopf(page, erstes.name)).toHaveAttribute('aria-pressed', 'true')
  const farbeErstes = await werkfarbe(page)
  expect(farbeErstes).toMatch(/^#[0-9a-f]{6}$/)
  const farbeErstesErwartet = (erstes.color || PRIMAERFARBE).toLowerCase()
  expect(farbeErstes.toLowerCase()).toBe(farbeErstesErwartet)

  // Umstellen auf das zweite Werk
  await werkKnopf(page, zweites.name).click()

  await expect(werkKnopf(page, zweites.name)).toHaveAttribute('aria-pressed', 'true')
  await expect(werkKnopf(page, erstes.name)).toHaveAttribute('aria-pressed', 'false')

  await expect
    .poll(async () => (await werkfarbe(page)).toLowerCase())
    .toBe((zweites.color || PRIMAERFARBE).toLowerCase())
})

// ----------------------------------------------------------------
// 3) Die Wahl bleibt nach einem Neuladen erhalten (Merkzettel im Browser)
// ----------------------------------------------------------------
test('Die Wahl des Arbeitswerks überlebt ein Neuladen', async ({ page }) => {
  await alsMitarbeiter(page, testNummer)
  const zweites = werke[1]

  await werkKnopf(page, zweites.name).click()
  await expect(werkKnopf(page, zweites.name)).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
  await expect(werkKnopf(page, zweites.name)).toHaveAttribute('aria-pressed', 'true')
})

// ----------------------------------------------------------------
// 4) Die Werkfarben sind in den Stammdaten änderbar (DEC-076)
// ----------------------------------------------------------------
test('Werkfarbe lässt sich in den Stammdaten ändern und färbt die Oberfläche', async ({ page }) => {
  const erstes = werke[0]
  const NEUE_FARBE = '#7c3aed'

  // 1) Über den Bedienweg ändern: Admin-Panel → Stammdaten → Werke → Bearbeiten.
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.getByRole('button', { name: 'Admin-Panel' }).click()
  // Das Admin-Panel startet auf „Übersicht" (Dashboard mit Benutzern) –
  // die Werke stehen unter „Stammdaten".
  await page
    .getByRole('navigation', { name: 'Admin-Navigation' })
    .getByRole('button', { name: 'Stammdaten' })
    .click()
  await expect(page.getByText('Werke (Plants)').first()).toBeVisible()

  // Zeile des ersten Werks: erst das Zeilenmenü öffnen (Knopf „Aktionen"),
  // dann „Bearbeiten".
  const zeile = page.locator('tr', { hasText: erstes.name }).first()
  await expect(zeile).toBeVisible()
  await zeile.getByRole('button', { name: 'Aktionen' }).click()
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  // Der Haken stand auf „Keine Farbe" – lösen, dann färben. Farbfeld und
  // Speichern gehören zur selben Zeile (jeder Bereich hat eigene Bausteine).
  const werkZeile = page.getByRole('row', { name: new RegExp(`^${erstes.name} `) })
  const keineFarbe = werkZeile.getByLabel('Keine Farbe')
  await expect(keineFarbe).toBeVisible()
  if (await keineFarbe.isChecked()) {
    await keineFarbe.uncheck()
  }
  const farbfeld = werkZeile.locator('input[type="color"]')
  await expect(farbfeld).toBeEnabled()
  await farbfeld.fill(NEUE_FARBE)
  await werkZeile.getByRole('button', { name: 'Speichern' }).click()

  // 2) Gespeichert? Über die API nachsehen (eindeutiger als die Tabelle)
  await expect
    .poll(async () => {
      const liste = await page.request.get('/api/locations/plants', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!liste.ok()) return 'fehler'
      const alle = (await liste.json()) as { id: number; color: string | null }[]
      return alle.find((w) => w.id === erstes.id)?.color ?? null
    })
    .toBe(NEUE_FARBE)

  // 3) Und die Oberfläche übernimmt sie: als Mitarbeiter neu anmelden, Werkfarbe prüfen.
  await page.evaluate(() => localStorage.clear())
  await alsMitarbeiter(page, testNummer)
  await expect
    .poll(async () => (await werkfarbe(page)).toLowerCase())
    .toBe(NEUE_FARBE)

  // Der Punkt im Knopf trägt dieselbe Farbe (inline gesetzt)
  const punkt = werkKnopf(page, erstes.name).locator('span[aria-hidden="true"]').first()
  await expect(punkt).toHaveCSS('background-color', 'rgb(124, 58, 237)')

  // Aufräumen: `afterAll` setzt die Werkfarben zurück.
})

// ----------------------------------------------------------------
// 5) Vorgabe „Arbeitswerk" im Benutzerformular
// ----------------------------------------------------------------
test('Benutzerformular speichert die Vorgabe für das Arbeitswerk', async ({ page }) => {
  const zweites = werke[1]

  // Als Admin anmelden; die Benutzerverwaltung steht im Admin-Panel unter „Übersicht".
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('button', { name: 'Admin-Panel' })).toBeVisible()

  await page.getByRole('button', { name: 'Admin-Panel' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Admin-Navigation' }),
  ).toBeVisible()

  // Zeile des Test-Benutzers (Name „Arbeitswerk Test") bearbeiten
  const zeile = page.locator('tr', { hasText: 'Arbeitswerk Test' }).first()
  await expect(zeile).toBeVisible()
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  // Vorgabe setzen und speichern
  await page.getByLabel('Arbeitswerk (Vorgabe)').selectOption(String(zweites.id))
  await page.getByRole('button', { name: 'Speichern' }).click()

  // Gespeichert? Über die API nachsehen (eindeutiger als die Tabelle)
  await expect
    .poll(async () => {
      const liste = await page.request.get('/api/users/', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!liste.ok()) return 'fehler'
      const benutzer = (await liste.json()) as {
        id: number
        default_plant_id: number | null
      }[]
      return benutzer.find((b) => b.id === testBenutzerId)?.default_plant_id ?? null
    })
    .toBe(zweites.id)
})
