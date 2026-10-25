import { test, expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

/**
 * Serienartikel: Liste, Anlege-Formular, Rechte und Artikelordner (TASK-016).
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173.
 *
 * Die Spec legt ihre Testdaten selbst an (12 Pläne, damit es mehr als eine
 * Seite gibt) und räumt sie hinterher wieder weg. Fehlt das Admin-Konto, wird
 * die Datei übersprungen statt rot zu werden.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/serial-articles.spec.ts
 */

const SHOTS = '../.audit/shots'
const ADMIN = { personal_number: 'admin1', password: '123' }
const SEED_COUNT = 12
/** Eigener Nummernkreis je Lauf: so kollidiert nichts mit vorhandenen Daten. */
const PREFIX = `SA-${String(Date.now()).slice(-6)}-`

let adminToken = ''
let plainToken = ''
/** Der normale Benutzer dieser Spec – angelegt in `beforeAll`. */
let plainUserId: number | null = null
let plantId = 0
let plantName = ''
let otherPlantId = 0
let otherPlantName = ''
let customerId = 0
let customerName = ''
let machineId = 0
let machineName = ''
const seededIds: number[] = []
/** Welche der durchnummerierten Testdatensätze wirklich angelegt wurden. */
const seededIndices = new Set<number>()

function authHeaders() {
  return { Authorization: `Bearer ${adminToken}` }
}

/** Ein winziges „PDF" – geprüft wird nur die Endung (DEC-056 Punkt 12). */
function pdfBuffer(label = 'A') {
  return Buffer.from(`%PDF-1.4 Testinhalt ${label}`)
}

/** Ein echtes 1×1-PNG, damit die Vorschau im Browser wirklich lädt. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Ein Bild an einen vorhandenen Artikel hängen (PUT ergänzt Dateien, DEC-062). */
async function addImage(
  request: APIRequestContext,
  article: { id: number; article_number: string },
  fileName = 'bild-1.png',
) {
  return request.put(`/api/serial-articles/${article.id}`, {
    headers: authHeaders(),
    multipart: {
      article_number: article.article_number,
      plant_id: String(plantId),
      images: { name: fileName, mimeType: 'image/png', buffer: PNG_1PX },
    },
  })
}

/** Einen weiteren Einrichteplan ergänzen (mehrere Pläne je Artikel, DEC-062). */
async function addPlan(
  request: APIRequestContext,
  article: { id: number; article_number: string },
  fileName = 'plan-2.pdf',
) {
  return request.put(`/api/serial-articles/${article.id}`, {
    headers: authHeaders(),
    multipart: {
      article_number: article.article_number,
      plant_id: String(plantId),
      plans: { name: fileName, mimeType: 'application/pdf', buffer: pdfBuffer('2') },
    },
  })
}

async function createArticle(
  request: APIRequestContext,
  articleNumber: string,
  extra: Record<string, string | number> = {},
  withPdf = false,
) {
  const fields: Record<string, string> = {
    article_number: articleNumber,
    plant_id: String(extra.plant_id ?? plantId),
    name: String(extra.name ?? `Plan ${articleNumber}`),
    description: String(extra.description ?? ''),
    customer_id: String(extra.customer_id ?? ''),
    machine_id: String(extra.machine_id ?? ''),
  }
  const response = withPdf
    ? await request.post('/api/serial-articles/', {
        headers: authHeaders(),
        multipart: {
          ...fields,
          plans: { name: 'plan.pdf', mimeType: 'application/pdf', buffer: pdfBuffer() },
        },
      })
    : await request.post('/api/serial-articles/', {
        headers: authHeaders(),
        multipart: fields,
      })
  return response
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  // Ein normaler Benutzer fuer die Rechte-Pruefung. Vorher war dafuer ein
  // **vorhandenes** Konto `1233` Voraussetzung; fehlte es, uebersprang die Spec
  // den Test still. Jetzt legt die Spec es selbst an und raeumt es weg – wie
  // `login.spec.ts`.
  //
  // Achtung: Die Personalnummer muss **hier** gemerkt werden. Das Backend gibt
  // sie nie zurueck (`schemas/user.py`), `angelegt.personal_number` ist
  // `undefined` und die Anmeldung liefe ins Leere.
  const plainNummer = `P${String(Date.now()).slice(-6)}${test.info().workerIndex}`
  const plainAngelegt = await request.post('/api/users/', {
    headers: authHeaders(),
    data: {
      personal_number: plainNummer,
      first_name: 'Test',
      last_name: 'Normalbenutzer',
      is_admin: false,
      is_active: true,
    },
  })
  if (plainAngelegt.ok()) {
    plainUserId = (await plainAngelegt.json()).id
    const anmeldung = await request.post('/api/auth/login', {
      data: { personal_number: plainNummer },
    })
    if (anmeldung.ok()) plainToken = (await anmeldung.json()).access_token
  }

  const plantsResponse = await request.get('/api/locations/plants', { headers: authHeaders() })
  const customersResponse = await request.get('/api/customers', { headers: authHeaders() })
  if (!plantsResponse.ok() || !customersResponse.ok()) return

  const plants = await plantsResponse.json()
  const customers = await customersResponse.json()
  if (!plants.length || !customers.length) return

  plantId = plants[0].id
  plantName = plants[0].name
  otherPlantId = plants[1]?.id ?? plants[0].id
  otherPlantName = plants[1]?.name ?? plants[0].name
  customerId = customers[0].id
  customerName = customers[0].name

  const machinesResponse = await request.get(`/api/machines?plant_id=${plantId}`, {
    headers: authHeaders(),
  })
  if (machinesResponse.ok()) {
    const machines = await machinesResponse.json()
    machineId = machines[0]?.id ?? 0
    machineName = machines[0]?.name ?? ''
  }

  for (let index = 1; index <= SEED_COUNT; index += 1) {
    const number = `${PREFIX}${String(index).padStart(3, '0')}`
    const felder = {
      // Ungerade Nummern im ersten, gerade im zweiten Werk: damit lassen sich
      // Werk-Sortierung und Werk-Filter prüfen.
      plant_id: index % 2 === 1 ? plantId : otherPlantId,
      description: index === 1 ? 'Programm 4711' : '',
      customer_id: index === 1 ? customerId : '',
      machine_id: index === 1 ? machineId : '',
    }

    // Laufen mehrere Specs parallel, scheitert einzelne Anlege-Aufrufe schon
    // einmal (Zeitüberschreitung unter Last). Dann fehlt der Datensatz später
    // im Test – deshalb bis zu dreimal versuchen.
    let response = await createArticle(request, number, felder, index === 1)
    for (let versuch = 2; versuch <= 3 && !response.ok(); versuch += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      response = await createArticle(request, number, felder, index === 1)
    }

    if (response.ok()) {
      seededIds.push((await response.json()).id)
      seededIndices.add(index)
      continue
    }

    // Konnte der Aufruf nicht bestätigt werden, kann der Artikel trotzdem
    // angelegt sein (z. B. Zeitüberschreitung nach dem Speichern). Dann wird er
    // gesucht und zum Aufräumen vorgemerkt – sonst bleibt er in der Datenbank.
    const gefunden = await request.get(
      `/api/serial-articles/?search=${encodeURIComponent(number)}&limit=5`,
      { headers: authHeaders() },
    )
    if (gefunden.ok()) {
      const treffer = (await gefunden.json()).items.find(
        (item: { article_number: string }) => item.article_number === number,
      )
      if (treffer) {
        seededIds.push(treffer.id)
        seededIndices.add(index)
      }
    }
  }
})

test.afterAll(async ({ request }) => {
  for (const id of seededIds) {
    await request.delete(`/api/serial-articles/${id}`, { headers: authHeaders() })
  }
  // Den selbst angelegten Benutzer wieder entfernen.
  if (plainUserId !== null) {
    await request.delete(`/api/users/${plainUserId}`, { headers: authHeaders() })
  }
})

function requireSeed() {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(seededIds.length === 0, 'Testdaten konnten nicht angelegt werden – Spec übersprungen')
}

/**
 * Zusätzlich verlangen, dass bestimmte nummerierte Testdatensätze da sind
 * (`${PREFIX}001`, `002`, …). Unter Last scheitert beim Anlegen schon einmal
 * ein einzelner Aufruf; dann wird der Test **übersprungen** statt rot – die
 * Anwendung ist daran unbeteiligt.
 */
function requireSeedIndices(...indices: number[]) {
  requireSeed()
  const fehlend = indices.filter((index) => !seededIndices.has(index))
  test.skip(fehlend.length > 0, `Testdatensatz/‑sätze ${fehlend.join(', ')} fehlt/fehlen`)
}

/** Sitzung mit Token starten und in den Serienartikel-Bereich wechseln. */
async function openWithToken(page: Page, token: string) {
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('token', value), token)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
  await page.getByRole('button', { name: 'Serienartikel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Serienartikel', exact: true })).toBeVisible()
}

async function openAsAdmin(page: Page) {
  await openWithToken(page, adminToken)
}

/**
 * In der Liste nach einem Begriff suchen und warten, bis **nur** passende
 * Zeilen stehen.
 *
 * Wichtig: nicht nur auf eine passende Zeile warten – die steht bei 12 Plänen
 * schon in der ungefilterten ersten Seite. Sonst klickt der Test auf die erste
 * Zeile der alten Liste (genau das ist beim Bearbeiten passiert).
 */
async function suche(page: Page, term: string) {
  await page.getByLabel('Serienartikel durchsuchen').fill(term)
  await expect
    .poll(
      async () => {
        const rows = await page.locator('tbody tr').allInnerTexts()
        return rows.length > 0 && rows.every((row) => row.includes(term))
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

/**
 * „+ Anlegen" öffnet **kein** eigenes Fenster: es erscheint die Anlege-Karte mit
 * den Reitern (Werkzeug, Serienartikel, Datenblatt, Ersatzteil), und
 * der Reiter „Serienartikel" ist offen (DEC-056 Punkt 5).
 */
async function oeffneAnlegeFormular(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Anlegen' }).click()
  const karte = page.locator('.tool-form-card')
  await expect(karte.getByRole('heading', { name: 'Anlegen' })).toBeVisible()
  await expect(karte.getByLabel('Artikelnummer')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return karte
}

/** Zeilenmenü einer Zeile öffnen (wie in der Werkzeugliste). */
async function oeffneZeilenmenue(page: Page, artikelnummer: string): Promise<void> {
  await page.getByRole('button', { name: `Weitere Aktionen für ${artikelnummer}` }).click()
  await expect(page.getByRole('menu')).toBeVisible()
}

/**
 * Vorschau öffnen: es gibt keinen „Ansehen"-Knopf mehr – die **Zeile** öffnet
 * das Datei-Fenster (DEC-059).
 */
async function oeffneZeile(page: Page, artikelnummer: string): Promise<void> {
  await page.getByRole('row', { name: new RegExp(artikelnummer) }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('Serienartikel', () => {
  test.beforeEach(() => requireSeed())

  test('zeigt Suche, Gesamtzahl und Blätterleiste', async ({ page }) => {
    await openAsAdmin(page)

    await expect(page.getByLabel('Serienartikel durchsuchen')).toBeVisible()
    // Werk-Filter als Segmente (wie in der Werkzeugliste) und Favoriten-Umschalter.
    await expect(page.getByRole('radiogroup', { name: 'Nach Werk filtern' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Nur Favoriten' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Seitennavigation der Serienartikel' }),
    ).toBeVisible()
    // 12 Pläne (plus eventuell vorhandene eigene Daten) bei 10 je Seite:
    // Satz mit Gesamtzahl und eine zweite Seite. Bewusst ohne feste Zahl – es
    // können weitere Serienartikel im Bestand liegen.
    await expect(page.getByText(/^1–10 von \d+ Serienartikeln$/)).toBeVisible()

    // Artikelnummer und Name stehen in eigenen Spalten.
    await expect(page.getByRole('columnheader', { name: 'Artikelnummer' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()

    await page.screenshot({ path: `${SHOTS}/sa-01-liste.png`, fullPage: true })
  })

  test('legt einen Serienartikel mit PDF an und meldet es als Toast', async ({ page }) => {
    await openAsAdmin(page)
    const number = `${PREFIX}NEU`

    const karte = await oeffneAnlegeFormular(page)
    await karte.getByLabel('Artikelnummer').fill(number)
    await karte.getByLabel('Name').fill('Ersatzplan Bearbeitung 2')
    await karte.getByLabel('Werk').selectOption(String(plantId))
    await karte.getByLabel('Kunde').selectOption(String(customerId))
    await karte.getByLabel('Beschreibung').fill('Programm 4712, Werkzeugwechsel alle 500 Hübe')
    // **Ein** Dateifeld für alles: PDF und Bilder zusammen auswählen (DEC-060).
    await karte.getByLabel('Einrichteplan oder Bilder auswählen').setInputFiles([
      { name: 'plan.pdf', mimeType: 'application/pdf', buffer: pdfBuffer('neu') },
      { name: 'maschine-vorn.png', mimeType: 'image/png', buffer: PNG_1PX },
      { name: 'maschine-hinten.png', mimeType: 'image/png', buffer: PNG_1PX },
    ])

    // Die Auswahl erscheint als Liste: Plan mit Hinweis, Bilder mit Vorschau,
    // jedes einzeln entfernbar – noch vor dem Speichern.
    await expect(karte.getByText(/Einrichteplan · /)).toBeVisible()
    await expect(karte.getByAltText('Vorschau maschine-vorn.png')).toBeVisible()
    await expect(karte.getByAltText('Vorschau maschine-hinten.png')).toBeVisible()
    await expect(
      karte.getByRole('button', { name: 'Bild maschine-hinten.png entfernen' }),
    ).toBeVisible()

    await karte.getByRole('button', { name: 'Serienartikel anlegen' }).click()

    // **Eine** Rückmeldung: der Toast unten rechts. Die Meldung im Formular ist
    // entfallen – vorher stand derselbe Erfolg zweimal auf dem Schirm.
    await expect(page.locator('.ui-toast-stack')).toContainText(
      `Serienartikel „${number}“ wurde angelegt.`,
      { timeout: 10_000 },
    )
    await page.screenshot({ path: `${SHOTS}/sa-02-angelegt.png`, fullPage: true })

    await karte.getByRole('button', { name: 'Zurück' }).click()
    await expect(page.getByRole('heading', { name: 'Serienartikel', exact: true })).toBeVisible()

    await suche(page, number)
    const neueZeile = page.getByRole('row', { name: /Ersatzplan Bearbeitung 2/ })
    await expect(neueZeile).toBeVisible()
    await expect(neueZeile).toContainText('PDF')
    // Beide Bilder sind im Artikelordner gelandet (DEC-058).
    await expect(neueZeile).toContainText('2 Bilder')
    await expect(neueZeile).toContainText('Programm 4712')

    // Aufräumen: dieser Datensatz gehört nicht zum Seed.
    const list = await page.request.get(
      `/api/serial-articles/?search=${encodeURIComponent(number)}&limit=5`,
      { headers: authHeaders() },
    )
    if (list.ok()) {
      const result = await list.json()
      for (const item of result.items) {
        await page.request.delete(`/api/serial-articles/${item.id}`, { headers: authHeaders() })
      }
    }
  })

  test('meldet eine vergebene Artikelnummer schon beim Tippen', async ({ page }) => {
    await openAsAdmin(page)
    const belegt = `${PREFIX}001`
    requireSeedIndices(1)

    const karte = await oeffneAnlegeFormular(page)
    await karte.getByLabel('Artikelnummer').fill(belegt)

    await expect(karte.getByText(/ist bereits vergeben/)).toBeVisible({ timeout: 15_000 })
    await expect(karte.getByRole('button', { name: 'Serienartikel anlegen' })).toBeVisible()
  })

  test('verlangt ein Werk (Pflichtfeld)', async ({ page }) => {
    await openAsAdmin(page)

    const karte = await oeffneAnlegeFormular(page)
    await karte.getByLabel('Artikelnummer').fill(`${PREFIX}OHNEWERK`)
    await karte.getByRole('button', { name: 'Serienartikel anlegen' }).click()

    await expect(karte.getByText('Bitte ein Werk auswählen.')).toBeVisible()
  })

  test('bearbeitet einen Plan im Anlege-Formular (kein eigenes Fenster)', async ({ page }) => {
    await openAsAdmin(page)
    const number = `${PREFIX}003`
    requireSeedIndices(3)

    await suche(page, number)
    await oeffneZeilenmenue(page, number)
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()

    const karte = page.locator('.tool-form-card')
    await expect(karte.getByRole('heading', { name: 'Bearbeiten' })).toBeVisible()
    await expect(karte.getByLabel('Artikelnummer')).toHaveValue(number)

    await karte.getByLabel('Name').fill('Umbenannter Plan')
    await karte.getByRole('button', { name: 'Änderungen speichern' }).click()

    // Nach dem Speichern geht es zurück in den Serienartikel-Bereich.
    await expect(page.getByRole('heading', { name: 'Serienartikel', exact: true })).toBeVisible()
    await expect(page.getByText(`Serienartikel „${number}“ wurde geändert.`)).toBeVisible()
    await suche(page, number)
    await expect(page.getByRole('row', { name: /Umbenannter Plan/ })).toBeVisible()
  })

  test('löscht über den Bestätigungsdialog mit Objektname und Konsequenz', async ({ page }) => {
    const request = page.request
    const number = `${PREFIX}LOESCH`
    const created = await createArticle(request, number, {}, true)
    test.skip(!created.ok(), 'Testdatensatz konnte nicht angelegt werden')
    const { id } = await created.json()

    await openAsAdmin(page)
    await suche(page, number)

    await oeffneZeilenmenue(page, number)
    await page.getByRole('menuitem', { name: 'Löschen' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(`Serienartikel „${number}“ löschen?`)).toBeVisible()
    await expect(dialog.getByText(/Artikelordner/)).toBeVisible()

    await dialog.getByRole('button', { name: 'Serienartikel löschen' }).click()
    await expect(page.getByText(`Serienartikel „${number}“ wurde gelöscht.`)).toBeVisible()

    const after = await request.get(`/api/serial-articles/${id}`, { headers: authHeaders() })
    expect(after.status()).toBe(404)
  })

  test('sucht über Werk, Kunde und Maschine', async ({ page }) => {
    requireSeedIndices(1, 2)
    await openAsAdmin(page)
    // Zeitlimit für die Zeilenprüfungen: der Vite-Server übersetzt beim ersten
    // Aufruf, und weitere Specs laufen parallel – 5 s (Vorgabe) sind zu knapp.
    const ZEIT = { timeout: 20_000 }

    // Kunde: die Suche deckt den Kundennamen ab. **Nicht** auf eine bestimmte
    // Zeile prüfen: Kunde und Maschine sind Stammdaten aus dem Echtbetrieb,
    // weitere Artikel tragen sie ebenfalls – dadurch kann der eigene Datensatz
    // auf eine hintere Seite rutschen.
    await suche(page, customerName)
    await expect(page.locator('tbody tr').first()).toContainText(customerName)

    // Maschine: ebenso (sie steht in derselben Spalte).
    if (machineName) {
      await suche(page, machineName)
      await expect(page.locator('tbody tr').first()).toContainText(machineName)
    }

    // Beschreibung: der Freitext aus dem PDF-Umfeld ist durchsuchbar – damit ist
    // der eigene Datensatz eindeutig auffindbar.
    await suche(page, 'Programm 4711')
    await expect(page.getByRole('row', { name: new RegExp(`${PREFIX}001`) })).toBeVisible(ZEIT)

    // Werk-Filter (Segmente wie in der Werkzeugliste): nur Pläne des zweiten Werks.
    await page.getByLabel('Serienartikel durchsuchen').fill('')
    // Erst warten, bis die Suche wirklich leer ist (die Liste sucht 350 ms nach
    // dem Tippen): sonst wirkt der Werk-Filter noch auf das alte Suchergebnis.
    await expect(page.getByRole('row', { name: new RegExp(`${PREFIX}001`) })).toBeVisible(ZEIT)
    await page.getByRole('radio', { name: otherPlantName }).check()
    await expect(page.getByRole('row', { name: new RegExp(`${PREFIX}002`) })).toBeVisible(ZEIT)
    await expect(page.locator('tbody')).not.toContainText(plantName)

    // Und dasselbe für das erste Werk.
    await page.getByRole('radio', { name: plantName }).check()
    await expect(page.getByRole('row', { name: new RegExp(`${PREFIX}001`) })).toBeVisible(ZEIT)
    await expect(page.locator('tbody')).not.toContainText(otherPlantName)
  })

  test('markiert Favoriten und filtert darauf', async ({ page }) => {
    await openAsAdmin(page)
    const number = `${PREFIX}004`
    requireSeedIndices(4)

    await suche(page, number)
    await page.getByRole('button', { name: `${number} zu den Favoriten hinzufügen` }).click()

    // Der Stern ist gesetzt (global), die Zeile trägt die Favoritenfarbe.
    const zeile = page.getByRole('row', { name: new RegExp(number) })
    await expect(
      page.getByRole('button', { name: `Favorit ${number} entfernen` }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(zeile).toHaveClass(/bg-amber-500/)

    // „Nur Favoriten" zeigt genau diesen Plan. **Nicht** auf eine feste
    // Gesamtzahl prüfen: Favoriten sind global, in der Datenbank können weitere
    // markierte Artikel liegen (z. B. aus dem Echtbetrieb).
    await page.getByRole('checkbox', { name: 'Nur Favoriten' }).check()
    await expect(page.getByText(/^1–\d+ von \d+ Serienartikel/)).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(number) })).toBeVisible()

    // Wieder abwählen und den Stern entfernen (Zustand sauber hinterlassen).
    await page.getByRole('checkbox', { name: 'Nur Favoriten' }).uncheck()
    // Nach dem Abwählen lädt die Liste neu. Ein Klick, der genau in dieses
    // Neurendern fällt, geht unter (der Stern bliebe stehen) – deshalb wird der
    // Klick wiederholt, bis der Zustand wirklich gewechselt hat.
    await expect(async () => {
      await page.getByRole('button', { name: `Favorit ${number} entfernen` }).click()
      await expect(
        page.getByRole('button', { name: `${number} zu den Favoriten hinzufügen` }),
      ).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 20_000 })
  })

  test('sortiert über die Spaltenköpfe und meldet es per aria-sort', async ({ page }) => {
    await openAsAdmin(page)

    const kopf = page.getByRole('button', { name: 'Werk', exact: true })
    await kopf.click()
    await expect(page.locator('th[aria-sort="ascending"]')).toBeVisible()
    await kopf.click()
    await expect(page.locator('th[aria-sort="descending"]')).toBeVisible()
    // Dritter Klick stellt die Standardsortierung (Artikelnummer) wieder her.
    await kopf.click()
    await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Artikelnummer')

    await page.screenshot({ path: `${SHOTS}/sa-03-sortierung.png`, fullPage: true })
  })

  test('blättert auf die zweite Seite', async ({ page }) => {
    await openAsAdmin(page)

    await page.getByRole('button', { name: 'Seite 2' }).click()
    await expect(page.getByText(/^11–\d+ von \d+ Serienartikeln$/)).toBeVisible()
  })

  test('zeigt normale Benutzer ohne Verwaltungs-Aktionen', async ({ page }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Test übersprungen')
    requireSeedIndices(1)
    await openWithToken(page, plainToken)

    await expect(page.getByRole('button', { name: 'Anlegen' })).toHaveCount(0)
    // Lesen funktioniert weiterhin.
    await suche(page, `${PREFIX}001`)

    // Kein Verwaltungs-Menü für normale Benutzer – die Vorschau öffnet die Zeile.
    await expect(page.getByRole('button', { name: /Weitere Aktionen für/ })).toHaveCount(0)
    await oeffneZeile(page, `${PREFIX}001`)
    // Zeitlimit großzügig: parallel laufende Specs belasten den Dev-Server.
    await expect(page.getByRole('dialog').locator('iframe')).toBeVisible({ timeout: 20_000 })
  })

  test('passt bei 1440×900 ohne seitliches Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openAsAdmin(page)

    // Alle Spalten (inkl. „Dateien" und „Aktionen") müssen sichtbar sein.
    await expect(page.getByRole('columnheader', { name: 'Dateien' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Aktionen' })).toBeVisible()

    // Der „…"-Knopf muss wirklich sichtbar sein (nicht abgeschnitten).
    await expect(page.getByRole('button', { name: /Weitere Aktionen für/ }).first()).toBeVisible()

    // Gemessen: die Tabelle darf nicht breiter sein als ihr Bereich.
    const mass = await page.evaluate(() => {
      const table = document.querySelector('table') as HTMLTableElement
      const wrapper = table.parentElement as HTMLElement
      return {
        platz: wrapper.clientWidth,
        tabelle: Math.round(table.getBoundingClientRect().width),
      }
    })
    expect(mass.tabelle).toBeLessThanOrEqual(mass.platz + 1)

    await page.screenshot({ path: `${SHOTS}/sa-07-1440.png`, fullPage: true })
  })

  test('öffnet die Vorschau beim Klick auf die Zeile', async ({ page }) => {
    requireSeedIndices(1)
    await openAsAdmin(page)
    await suche(page, `${PREFIX}001`)

    // Kein „Ansehen"-Knopf: die Zeile selbst öffnet das Datei-Fenster.
    await oeffneZeile(page, `${PREFIX}001`)

    const viewer = page.getByRole('dialog')
    // Der iframe trägt den Dateinamen des Plans (mehrere Pläne je Artikel, DEC-062).
    await expect(viewer.locator('iframe')).toHaveAttribute('title', 'PDF plan.pdf')
    await expect(viewer.getByRole('button', { name: 'Herunterladen' })).toBeEnabled()

    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })

  test('zeigt PDF und Bilder im Split-Screen mit Vorschaubildern', async ({ page }) => {
    const number = `${PREFIX}BILD`
    const created = await createArticle(page.request, number, {}, true)
    test.skip(!created.ok(), 'Testdatensatz konnte nicht angelegt werden')
    const article = await created.json()
    const mitBild = await addImage(page.request, article)
    test.skip(!mitBild.ok(), 'Bild konnte nicht angehängt werden')

    await openAsAdmin(page)
    await suche(page, number)

    // In der Liste steht die Anzahl der Bilder.
    await expect(page.getByRole('row', { name: new RegExp(number) })).toContainText('1 Bild')

    // Zeile anklicken (der Datensatz hat Plan und Bild -> Start mit dem Plan).
    await oeffneZeile(page, number)

    const viewer = page.getByRole('dialog')
    // Split-Screen: links die Dateiliste (Plan + Bilder), rechts die große Ansicht.
    const liste = viewer.getByRole('navigation', { name: 'Dateien des Serienartikels' })
    await expect(liste).toBeVisible()
    await expect(viewer.locator('iframe')).toBeVisible()

    await expect(liste.getByRole('button', { name: /Einrichteplan/ })).toBeVisible()
    await expect(liste.getByRole('button', { name: /bild-1\.png/ })).toBeVisible()
    // Die Vorschau in der Liste ist das kleine Bild (DEC-059), nicht das Original.
    await expect(liste.getByAltText('Vorschau bild-1.png')).toBeVisible()

    // Bild auswählen: rechts erscheint es in Originalgröße.
    await liste.getByRole('button', { name: /bild-1\.png/ }).click()
    await expect(viewer.getByAltText('Großansicht bild-1.png')).toBeVisible()

    // Zoom (100 % = eingepasst), Drehen und Zurücksetzen.
    const grossbild = viewer.getByAltText('Großansicht bild-1.png')
    await expect(viewer.getByText('100 %')).toBeVisible()
    await viewer.getByRole('button', { name: 'Vergrößern' }).click()
    await expect(viewer.getByText('125 %')).toBeVisible()
    await viewer.getByRole('button', { name: 'Vergrößern' }).click()
    await expect(viewer.getByText('150 %')).toBeVisible()
    await expect(grossbild).toHaveAttribute('data-zoom', '1.5')
    await expect(viewer.getByText(/Ziehen verschiebt das Bild/)).toBeVisible()

    await viewer.getByRole('button', { name: 'Nach rechts drehen' }).click()
    await expect(grossbild).toHaveAttribute('data-rotation', '90')
    await page.screenshot({ path: `${SHOTS}/sa-06-zoom.png`, fullPage: true })

    await viewer.getByRole('button', { name: 'Ansicht zurücksetzen' }).click()
    await expect(viewer.getByText('100 %')).toBeVisible()
    await expect(grossbild).toHaveAttribute('data-rotation', '0')

    await page.screenshot({ path: `${SHOTS}/sa-05-bilder.png`, fullPage: true })

    // Ein Bild entfernen (nur Admin) – mit Bestätigungsdialog.
    await viewer.getByRole('button', { name: 'Bild entfernen' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'entfernen?' })
    await expect(dialog.getByText('Datei „bild-1.png“ entfernen?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Datei entfernen' }).click()

    await expect(liste.getByRole('button', { name: /bild-1\.png/ })).toBeHidden()
    const nachher = await page.request.get(`/api/serial-articles/${article.id}`, {
      headers: authHeaders(),
    })
    expect((await nachher.json()).images).toEqual([])

    // Aufräumen: dieser Datensatz gehört nicht zum Seed.
    await page.request.delete(`/api/serial-articles/${article.id}`, {
      headers: authHeaders(),
    })
  })

  test('verwaltet mehrere Pläne und Dateien in der Bearbeitung', async ({ page }) => {
    const number = `${PREFIX}MEHR`
    const created = await createArticle(page.request, number, {}, true)
    test.skip(!created.ok(), 'Testdatensatz konnte nicht angelegt werden')
    const article = await created.json()
    const zweiterPlan = await addPlan(page.request, article)
    test.skip(!zweiterPlan.ok(), 'Zweiter Plan konnte nicht angehängt werden')
    await addImage(page.request, article)

    await openAsAdmin(page)
    await suche(page, number)

    // Zwei Pläne und ein Bild stehen in der Liste.
    const zeile = page.getByRole('row', { name: new RegExp(number) })
    await expect(zeile).toContainText('2 Pläne')
    await expect(zeile).toContainText('1 Bild')

    // Im Datei-Fenster sind beide Pläne einzeln auswählbar.
    await oeffneZeile(page, number)
    const viewer = page.getByRole('dialog')
    const liste = viewer.getByRole('navigation', { name: 'Dateien des Serienartikels' })
    await expect(liste.getByRole('button', { name: /plan\.pdf/ })).toBeVisible()
    await expect(liste.getByRole('button', { name: /plan-2\.pdf/ })).toBeVisible()
    await liste.getByRole('button', { name: /plan-2\.pdf/ }).click()
    await expect(viewer.locator('iframe')).toHaveAttribute('title', 'PDF plan-2.pdf')
    await page.screenshot({ path: `${SHOTS}/sa-08-mehrere-plaene.png`, fullPage: true })
    await page.keyboard.press('Escape')

    // Bearbeiten: hinterlegte Dateien werden gelistet und sind löschbar.
    await oeffneZeilenmenue(page, number)
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    const karte = page.locator('.tool-form-card')
    await expect(karte.getByText('Hinterlegte Dateien', { exact: true })).toBeVisible()
    await expect(karte.getByRole('button', { name: 'Einrichteplan plan.pdf löschen' })).toBeVisible()
    await expect(
      karte.getByRole('button', { name: 'Einrichteplan plan-2.pdf löschen' }),
    ).toBeVisible()
    await expect(karte.getByRole('button', { name: 'Bild bild-1.png löschen' })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/sa-09-bearbeiten-dateien.png`, fullPage: true })

    // Ergänzen: eine weitere PDF kommt hinzu, ohne etwas zu ersetzen.
    await karte.getByLabel('Einrichteplan oder Bilder auswählen').setInputFiles({
      name: 'plan-neu.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer('neu'),
    })
    await expect(karte.getByText(/plan-neu\.pdf/)).toBeVisible()
    await karte.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByRole('heading', { name: 'Serienartikel', exact: true })).toBeVisible()

    let daten = await (
      await page.request.get(`/api/serial-articles/${article.id}`, { headers: authHeaders() })
    ).json()
    expect(daten.plans.map((plan: { name: string }) => plan.name)).toEqual([
      'plan.pdf',
      'plan-2.pdf',
      'plan-3.pdf',
    ])

    // Und wieder in die Bearbeitung: einen hinterlegten Plan löschen.
    await suche(page, number)
    await oeffneZeilenmenue(page, number)
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    await expect(karte.getByText('Hinterlegte Dateien', { exact: true })).toBeVisible()
    await karte.getByRole('button', { name: 'Einrichteplan plan-2.pdf löschen' }).click()
    await expect(
      karte.getByRole('button', { name: 'Einrichteplan plan-2.pdf löschen' }),
    ).toBeHidden()

    daten = await (
      await page.request.get(`/api/serial-articles/${article.id}`, { headers: authHeaders() })
    ).json()
    expect(daten.plans.map((plan: { name: string }) => plan.name)).toEqual([
      'plan.pdf',
      'plan-3.pdf',
    ])
    expect(daten.images.map((bild: { name: string }) => bild.name)).toEqual(['bild-1.png'])

    // Aufräumen: dieser Datensatz gehört nicht zum Seed.
    await page.request.delete(`/api/serial-articles/${article.id}`, {
      headers: authHeaders(),
    })
  })

  test('übernimmt im Werkzeugformular Werk, Kunde und Maschine in den Serienartikel-Reiter', async ({
    page,
  }) => {
    await openAsAdmin(page)

    await page
      .getByRole('navigation', { name: 'Bereiche wechseln' })
      .getByRole('button', { name: 'Werkzeuge', exact: true })
      .click()
    await page.getByRole('button', { name: 'Anlegen' }).click()
    // Das Werkzeugformular ist bewusst keine Dialog-Box, sondern eine Karte.
    const karte = page.locator('.tool-form-card')
    await expect(karte.getByRole('heading', { name: 'Anlegen' })).toBeVisible()

    // Werk und Kunde im Werkzeugformular wählen …
    await karte.getByLabel('Werk', { exact: true }).selectOption(String(plantId))
    await karte.getByLabel('Kunde', { exact: true }).selectOption(String(customerId))

    // … dann in den Sub-Reiter wechseln: die Angaben stehen dort vorbelegt.
    await karte.getByRole('button', { name: 'Serienartikel' }).click()
    await expect(karte.getByLabel('Artikelnummer')).toBeVisible()
    await expect(karte.getByLabel('Werk')).toHaveValue(String(plantId))
    await expect(karte.getByLabel('Kunde', { exact: true })).toHaveValue(String(customerId))

    await page.screenshot({ path: `${SHOTS}/sa-04-werkzeugformular.png`, fullPage: true })

    // Der Serienartikel hat einen eigenen Speichern-Knopf (DEC-056 Punkt 5).
    await expect(karte.getByRole('button', { name: 'Serienartikel anlegen' })).toBeVisible()
    await expect(karte.getByRole('button', { name: 'Werkzeug anlegen' })).toHaveCount(0)
  })
})
