import { test, expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Datenblätter: eigener Bereich mit Werkzeug-ID, Werk, Maschine und PDF (DEC-065).
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173.
 * Die Spec legt ihre Testdaten über die API an und räumt sie hinterher weg.
 * Fehlt das Admin-Konto, wird die Datei übersprungen statt rot zu werden.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/data-sheets.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
/** Eigener Nummernkreis je Lauf: kollidiert nicht mit vorhandenen Daten. */
const PREFIX = `DB-${String(Date.now()).slice(-6)}-`

let adminToken = ''
let plainToken = ''
/** Der normale Benutzer dieser Spec – angelegt in `beforeAll`. */
let plainUserId: number | null = null
let plantId = 0
let plantName = ''
let otherPlantId = 0
let machineId = 0
let machineName = ''
/** Farbe der Testmaschine vor dem Lauf – wird hinterher zurückgesetzt. */
let machineColorBefore: string | null = null
const seededIds: number[] = []

function authHeaders(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

/** Ein winziges „PDF" – geprüft wird nur die Endung (DEC-056 Punkt 12). */
function pdfBuffer(label = 'A') {
  return Buffer.from(`%PDF-1.4 Testinhalt ${label}`)
}

/** Ein echtes 1×1-PNG, damit die Vorschau wirklich lädt. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

interface SheetFields {
  tool_id?: string
  plant_id: number
  machine_id?: string
  name?: string
  description?: string
}

/** Wie viele Bilder beim Anlegen mitgeschickt werden. */
interface SeedOptions {
  withPdf?: boolean
  images?: number
}

async function createSheet(
  request: APIRequestContext,
  fields: SheetFields,
  options: SeedOptions = {},
) {
  const multipart: Record<string, unknown> = {
    tool_id: fields.tool_id ?? '',
    plant_id: String(fields.plant_id),
    machine_id: fields.machine_id ?? '',
    name: fields.name ?? '',
    description: fields.description ?? '',
  }
  if (options.withPdf) {
    multipart.plans = { name: 'plan.pdf', mimeType: 'application/pdf', buffer: pdfBuffer() }
  }
  // Mehrere Dateien im selben Feld: FastAPI liest sie als Liste.
  if (options.images) {
    const bilder = Array.from({ length: options.images }, (_, index) => ({
      name: `bild-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: PNG_1PX,
    }))
    multipart.images = bilder.length === 1 ? bilder[0] : bilder
  }
  return request.post('/api/data-sheets/', { headers: authHeaders(), multipart })
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  // Ein normaler Benutzer fuer die Rechte-Pruefungen. Vorher war dafuer ein
  // **vorhandenes** Konto `1233` Voraussetzung; fehlte es, uebersprang die Spec
  // vier Tests still. Jetzt legt die Spec es selbst an und raeumt es weg – wie
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

  const plantsResponse = await request.get('/api/locations/plants', {
    headers: authHeaders(),
  })
  if (!plantsResponse.ok()) return
  const plants = await plantsResponse.json()
  if (!plants.length) return

  plantId = plants[0].id
  plantName = plants[0].name
  otherPlantId = plants[1]?.id ?? plants[0].id

  const machinesResponse = await request.get(`/api/machines?plant_id=${plantId}`, {
    headers: authHeaders(),
  })
  if (machinesResponse.ok()) {
    const machines = await machinesResponse.json()
    machineId = machines[0]?.id ?? 0
    machineName = machines[0]?.name ?? ''
  }

  // Vier Datenblätter, damit die Position im Zebra (gerade/ungerade) prüfbar ist:
  // Sortierung nach Werkzeug-ID aufsteigend, Datensätze **ohne** ID stehen zuletzt
  // (NULLS LAST). Position 2 ist ein Favorit, Position 4 ebenfalls gerade – nur so
  // fällt auf, wenn das Zebra die Favoriten-Tönung überschreibt.
  const daten: { fields: SheetFields; options: SeedOptions; favorite?: boolean }[] = [
    {
      fields: {
        tool_id: `${PREFIX}1075000`,
        plant_id: plantId,
        machine_id: machineId ? String(machineId) : '',
        name: 'Einstellwerte Presse',
        description: 'Druck und Hub eingestellt',
      },
      options: { withPdf: true, images: 1 },
      favorite: true,
    },
    {
      fields: { tool_id: `${PREFIX}2000`, plant_id: plantId, name: 'Zweites Blatt' },
      options: { withPdf: true },
    },
    {
      fields: { tool_id: `${PREFIX}3000`, plant_id: plantId, name: 'Drittes Blatt' },
      options: {},
    },
    {
      fields: { plant_id: otherPlantId, name: 'Abstreifer ohne ID' },
      options: {},
      favorite: true,
    },
  ]

  for (const eintrag of daten) {
    const response = await createSheet(request, eintrag.fields, eintrag.options)
    if (!response.ok()) continue
    const sheet = await response.json()
    seededIds.push(sheet.id)
    if (eintrag.favorite) {
      await request.put(`/api/data-sheets/${sheet.id}/favorite`, {
        headers: authHeaders(),
        data: { is_favorite: true },
      })
    }
  }

  // Maschinenfarbe aus den Stammdaten setzen (und später zurückgeben) – die Liste
  // zeigt daraus einen Farbpunkt. Ohne Farbe gibt es keinen Punkt zu prüfen.
  if (machineId) {
    const machines = await (
      await request.get(`/api/machines?plant_id=${plantId}`, { headers: authHeaders() })
    ).json()
    const used = machines.find((m: { id: number }) => m.id === machineId)
    machineColorBefore = used?.color ?? null
    await request.put(`/api/machines/${machineId}`, {
      headers: authHeaders(),
      data: { name: used?.name ?? machineName, plant_id: plantId, color: '#dc2626' },
    })
  }
})

test.afterAll(async ({ request }) => {
  // Maschinenfarbe zurücksetzen (Stammdaten gehören dem Anwender).
  if (machineId) {
    await request.put(`/api/machines/${machineId}`, {
      headers: authHeaders(),
      data: { name: machineName, plant_id: plantId, color: machineColorBefore },
    })
  }

  // Auch Datensätze aufräumen, die **im Browser** entstanden sind – deshalb über
  // den Nummernkreis suchen und alles Passende löschen.
  const gefunden = await request.get(
    `/api/data-sheets/?search=${encodeURIComponent(PREFIX)}&limit=200`,
    { headers: authHeaders() },
  )
  if (gefunden.ok()) {
    const items = (await gefunden.json()).items as { id: number; tool_id: string | null }[]
    for (const item of items) {
      if ((item.tool_id ?? '').startsWith(PREFIX)) {
        await request.delete(`/api/data-sheets/${item.id}`, { headers: authHeaders() })
      }
    }
  }

  for (const id of seededIds) {
    await request.delete(`/api/data-sheets/${id}`, { headers: authHeaders() })
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

/** Sitzung mit Token starten und in den Datenblatt-Bereich wechseln. */
async function openWithToken(page: Page, token: string) {
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('token', value), token)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
  await page.getByRole('button', { name: 'Datenblätter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Datenblätter', exact: true })).toBeVisible()
}

async function openAsAdmin(page: Page) {
  await openWithToken(page, adminToken)
}

/** Nach einem Begriff suchen und warten, bis nur noch passende Zeilen stehen. */
/**
 * Suchen und warten, bis die Zeile wirklich steht.
 *
 * `feld` ist der Name des Suchfelds: Der Bereich „Datenblätter" und die
 * **Werkzeugliste** haben je ein eigenes („Datenblätter durchsuchen" /
 * „Werkzeuge durchsuchen"). Die Zeilenaktion „Datenblatt" startet in der
 * Werkzeugliste – dort muss dieses Feld gefüllt werden.
 */
async function suche(page: Page, term: string, feld = 'Datenblätter durchsuchen') {
  await page.getByLabel(feld).fill(term)
  await expect
    .poll(
      async () => {
        const rows = await page.locator('tbody tr').allInnerTexts()
        return rows.length > 0 && rows.some((row) => row.includes(term))
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

/** Anlege-Karte öffnen; der Reiter „Datenblatt" ist offen. */
async function oeffneAnlegeKarte(page: Page) {
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
  const karte = page.locator('.tool-form-card')
  await expect(karte.getByRole('heading', { name: 'Anlegen' })).toBeVisible()
  await expect(karte.getByLabel('Werkzeug-ID')).toBeVisible()
  // Achtung: `getByLabel('Werk')` ist hier mehrdeutig – „Werkzeug-ID" enthält
  // „Werk" (dieselbe Falle wie in `docs/06-serial-articles.md` §12). Deshalb
  // gezielt über die Rolle: ein Auswahlfeld namens „Werk *".
  await expect(karte.getByRole('combobox', { name: /Werk/ })).toBeVisible()
  return karte
}

async function oeffneZeilenmenue(page: Page, kennung: string) {
  await page.getByRole('button', { name: `Weitere Aktionen für ${kennung}` }).first().click()
  await expect(page.getByRole('menu')).toBeVisible()
}

test.describe('Datenblätter', () => {
  test.beforeEach(() => requireSeed())

  test('hat einen eigenen Tab mit Suche, Werk-Filter und Favoriten', async ({ page }) => {
    await openAsAdmin(page)

    const nav = page.getByRole('navigation', { name: 'Bereiche wechseln' })
    await expect(nav.getByRole('button', { name: 'Datenblätter', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Ersatzteile', exact: true })).toBeVisible()

    await expect(page.getByLabel('Datenblätter durchsuchen')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Nach Werk filtern' })).toBeVisible()
    await expect(page.getByText('Nur Favoriten')).toBeVisible()
  })

  test('listet Werkzeug-ID, Werk und Datei-Zustand', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}1075000`)

    const zeile = page.locator('tbody tr').filter({ hasText: `${PREFIX}1075000` }).first()
    await expect(zeile).toContainText(plantName)
    // Ein Datenblatt (PDF) und ein Bild – beide Zustände stehen als Badge da.
    await expect(zeile).toContainText('PDF')
    await expect(zeile).toContainText('1 Bild')
  })

  test('hebt den Namen als zweite Kennung hervor', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}1075000`)

    const zeile = page.locator('tbody tr').filter({ hasText: `${PREFIX}1075000` }).first()
    // Der Name steht in einem eigenen Kasten (Mono, eigene Kante) – wie in der
    // Serienartikel-Liste (DEC-063), nicht als nackter Text.
    const name = zeile.locator('code').filter({ hasText: 'Einstellwerte Presse' })
    await expect(name).toBeVisible()
    // Geprüft wird die Kasten-Darstellung, nicht ein Farbwert: Tailwind v4
    // rechnet Farben mit `color-mix` und `getComputedStyle` liefert dann
    // `oklab(…)` statt `rgb(…)` – ein Zahlenvergleich darauf wäre unbrauchbar.
    const stil = await name.evaluate((el) => {
      const s = getComputedStyle(el)
      return { rahmen: s.borderTopWidth, familie: s.fontFamily, gewicht: s.fontWeight }
    })
    expect(stil.rahmen).not.toBe('0px')
    expect(stil.familie.toLowerCase()).toContain('mono')
    expect(Number(stil.gewicht)).toBeGreaterThanOrEqual(700)
  })

  test('zeigt die Maschine mit dem Farbpunkt aus den Stammdaten', async ({ page }) => {
    test.skip(!machineId, 'Keine Maschine im Bestand – Spec übersprungen')
    await openAsAdmin(page)
    await suche(page, `${PREFIX}1075000`)

    const zeile = page.locator('tbody tr').filter({ hasText: `${PREFIX}1075000` }).first()
    await expect(zeile).toContainText(machineName)
    const punkt = zeile.locator('span[style*="background-color"]').first()
    await expect(punkt).toBeVisible()
  })

  test('Favoriten-Zeile ist getönt und reagiert auf Hover', async ({ page }) => {
    await openAsAdmin(page)
    // Ohne Filter: nur so steht die Favoriten-Zeile an einer **geraden**
    // Position – genau dort hat das Zebra die Tönung vorher überschrieben.
    const favorit = page.locator('tbody tr').filter({ hasText: 'Abstreifer ohne ID' }).first()
    const zebra = page.locator('tbody tr').filter({ hasText: `${PREFIX}3000` }).first()
    await expect(favorit).toBeVisible()
    await expect(zebra).toBeVisible()

    const hintergrund = (zeile: typeof favorit) =>
      zeile.evaluate((el) => getComputedStyle(el).backgroundColor)
    const favoritRuhe = await hintergrund(favorit)
    const zebraRuhe = await hintergrund(zebra)
    // Beide Zeilen sind „gerade" – ohne eigene Favoriten-Tönung wären sie gleich.
    expect(favoritRuhe).not.toBe(zebraRuhe)

    // Bewusst über Koordinaten **innerhalb** der Zeile: `locator.hover()` zielt
    // auf die Mitte, die bei einer schmalen Zeile auf der Zellgrenze liegen kann.
    const kasten = await favorit.boundingBox()
    expect(kasten).not.toBeNull()
    await page.mouse.move(kasten!.x + 30, kasten!.y + kasten!.height / 2)
    await expect
      .poll(async () => hintergrund(favorit), { timeout: 5_000 })
      .not.toBe(favoritRuhe)
  })

  test('zeigt ein Datenblatt ohne Werkzeug-ID als „ohne ID"', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, 'Abstreifer ohne ID')

    const zeile = page.locator('tbody tr').filter({ hasText: 'Abstreifer ohne ID' }).first()
    await expect(zeile).toContainText('ohne ID')
    await expect(zeile).toContainText('Kein PDF')
  })

  test('Anlegen mit PDF, Bild und Werkzeug-ID', async ({ page }) => {
    await openAsAdmin(page)
    const karte = await oeffneAnlegeKarte(page)

    const kennung = `${PREFIX}2222`
    await karte.getByLabel('Werkzeug-ID').fill(kennung)
    // Der Hinweis nennt die Anzahl, blockiert aber nicht – mehrere Datenblätter
    // je Werkzeug-ID sind erlaubt (DEC-065).
    await expect(karte.getByText(/gibt es (noch kein|bereits)/)).toBeVisible({ timeout: 10_000 })
    await karte.getByRole('combobox', { name: /Werk/ }).selectOption(String(plantId))
    await karte.getByLabel('Name').fill('Einstellwerte Prüfstand')
    // **Ein** Dateifeld für beides: PDF wird ein Datenblatt, PNG ein Bild.
    await karte.locator('input[type="file"]').setInputFiles([
      { name: 'werte.pdf', mimeType: 'application/pdf', buffer: pdfBuffer('B') },
      { name: 'skizze.png', mimeType: 'image/png', buffer: PNG_1PX },
    ])
    await expect(karte.getByText('Kommt beim Speichern dazu')).toBeVisible()
    // Die Art steht an der Zeile – der Nutzer sieht, was woraus wird.
    await expect(karte.getByText(/werte\.pdf.*Datenblatt/)).toBeVisible()
    await expect(karte.getByText(/skizze\.png.*Bild/)).toBeVisible()

    await karte.getByRole('button', { name: 'Datenblatt anlegen' }).click()
    // **Eine** Rückmeldung: der Toast unten rechts (die Meldung im Formular ist
    // entfallen, sonst stünde derselbe Erfolg zweimal auf dem Schirm).
    await expect(page.locator('.ui-toast-stack')).toContainText(/angelegt/, {
      timeout: 10_000,
    })
    // Der Reiter bleibt offen, das Werk bleibt stehen.
    await expect(karte.getByRole('combobox', { name: /Werk/ })).not.toHaveValue('')

    await page.getByRole('button', { name: 'Zurück' }).click()
    await suche(page, kennung)
    const zeile = page.locator('tbody tr').filter({ hasText: kennung }).first()
    await expect(zeile).toContainText('PDF')
    await expect(zeile).toContainText('1 Bild')
  })

  test('Werk ist Pflicht', async ({ page }) => {
    await openAsAdmin(page)
    const karte = await oeffneAnlegeKarte(page)

    await karte.getByLabel('Name').fill('Ohne Werk')
    await karte.getByRole('button', { name: 'Datenblatt anlegen' }).click()
    await expect(karte.getByText('Bitte ein Werk auswählen.')).toBeVisible()
  })

  test('Zeilenklick öffnet das Datei-Fenster mit dem Datenblatt', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}1075000`)

    await page.getByRole('row', { name: new RegExp(`${PREFIX}1075000`) }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Beschriftung des Bereichs: „Datenblatt", nicht „Einrichteplan".
    await expect(dialog.getByText('Datenblatt', { exact: true }).first()).toBeVisible()
    await expect(dialog.locator('iframe')).toBeVisible({ timeout: 15_000 })
    // Bearbeiten von Dateien ist Admin-Sache.
    await expect(dialog.getByRole('button', { name: 'Datenblatt entfernen' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Schließen' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('Bearbeiten ergänzt ein zweites Datenblatt', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}1075000`)

    await oeffneZeilenmenue(page, `${PREFIX}1075000`)
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    const karte = page.locator('.tool-form-card')
    await expect(karte.getByRole('heading', { name: 'Bearbeiten' })).toBeVisible()
    await expect(karte.getByText('Hinterlegte Dateien')).toBeVisible()

    await karte.locator('input[type="file"]').setInputFiles({
      name: 'werte-2.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer('C'),
    })
    await karte.getByRole('button', { name: 'Änderungen speichern' }).click()

    await expect(page.getByRole('heading', { name: 'Datenblätter', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await suche(page, `${PREFIX}1075000`)
    // Zwei Datenblätter: die Spalte zeigt die Anzahl.
    await expect(
      page.locator('tbody tr').filter({ hasText: `${PREFIX}1075000` }).first(),
    ).toContainText('2 PDFs')
  })

  test('Löschen mit Bestätigung – nur als Admin', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, 'Abstreifer ohne ID')

    await oeffneZeilenmenue(page, 'Abstreifer ohne ID')
    await page.getByRole('menuitem', { name: 'Löschen' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Abstreifer ohne ID')
    await dialog.getByRole('button', { name: 'Datenblatt löschen' }).click()

    await expect(page.getByText(/gelöscht/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Keine Treffer für/)).toBeVisible({ timeout: 10_000 })
  })

  test('Maschinenfarbe im Admin-Panel setzen – der Punkt erscheint in der Liste', async ({
    page,
  }) => {
    test.skip(!machineId, 'Keine Maschine im Bestand – Spec übersprungen')

    // Über den **Bedienweg** prüfen, nicht über die API: Admin-Panel →
    // Stammdaten → Maschine bearbeiten → Farbe setzen → Speichern.
    await page.goto('/')
    await page.evaluate((value) => window.localStorage.setItem('token', value), adminToken)
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
    await page.getByRole('button', { name: 'Admin-Panel' }).click()
    await page.getByRole('button', { name: 'Stammdaten' }).click()

    const karte = page.locator('.admin-card').filter({ hasText: 'Maschinen (Machines)' })
    const zeilen = karte.locator('tbody tr')
    // Erst warten, bis die Stammdaten geladen sind – sonst ist die Tabelle leer
    // und die Zeilensuche findet nichts.
    await expect(karte).toBeVisible({ timeout: 10_000 })
    // Die Zeile **einmal** über ihren Text finden und dann über den Index halten:
    // im Bearbeiten-Modus steht der Name in einem Eingabefeld und ist damit kein
    // Textinhalt der Zeile mehr – ein `hasText`-Filter liefe dort ins Leere.
    const zeilenIndex = async () =>
      zeilen.evaluateAll(
        (rows, name) =>
          rows.findIndex((row) => (row.textContent ?? '').includes(name)),
        machineName,
      )
    await expect.poll(zeilenIndex, { timeout: 10_000 }).toBeGreaterThanOrEqual(0)
    const zeile = zeilen.nth(await zeilenIndex())
    await expect(zeile).toBeVisible()

    await zeile.getByRole('button', { name: 'Aktionen' }).click()
    await zeile.getByRole('button', { name: 'Bearbeiten' }).click()
    // Die Farbe **wirklich ändern**: erst „Keine Farbe" setzen, dann wieder
    // abwählen – der Wähler nimmt dann seine Standardfarbe #0f766e. Ein bloßes
    // Abwählen würde nichts ändern, weil die Maschine aus dem Setup schon eine
    // Farbe hat (genau daran ist der erste Versuch dieses Tests gescheitert).
    const keineFarbe = zeile.getByRole('checkbox')
    await keineFarbe.check()
    await keineFarbe.uncheck()
    await zeile.getByRole('button', { name: 'Speichern' }).click()

    // Zurück in die Hauptansicht: die Liste zeigt jetzt den Farbpunkt.
    await page.getByRole('button', { name: /Hauptseite/ }).click()
    await page.getByRole('button', { name: 'Datenblätter', exact: true }).click()
    await suche(page, `${PREFIX}1075000`)

    const liste = page.locator('tbody tr').filter({ hasText: `${PREFIX}1075000` }).first()
    const punkt = liste.locator('span[style*="background-color"]').first()
    await expect(punkt).toBeVisible()
    // Der Wähler setzt #0f766e (Teal) – geprüft wird der tatsächliche Wert.
    await expect(punkt).toHaveAttribute('style', /rgb\(15,\s*118,\s*110\)/)
  })

  test('normaler Benutzer sieht keine Verwaltungs-Aktionen', async ({ page }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    await openWithToken(page, plainToken)

    await suche(page, `${PREFIX}1075000`)
    await expect(
      page.getByRole('button', { name: /Weitere Aktionen für/ }),
    ).toHaveCount(0)

    // Das Datei-Fenster darf er öffnen – nur entfernen nicht.
    await page.getByRole('row', { name: new RegExp(`${PREFIX}1075000`) }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Datenblatt entfernen' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Schließen' }).click()
  })
})

test.describe('Datenblätter – Weg vom Werkzeug', () => {
  test.beforeEach(() => requireSeed())

  /**
   * Werkzeuge, die diese Tests nur für die Zeilenaktion anlegen.
   *
   * Sie werden **nach jedem Test** wieder entfernt (`afterEach` läuft auch nach
   * einem Fehlschlag). Ohne das blieb je Lauf ein Werkzeug in der Liste stehen –
   * die Werkzeugliste des Entwicklungsstands war voll von `DB-…`-Zeilen aus
   * früheren Läufen.
   */
  const angelegteWerkzeuge: number[] = []

  test.afterEach(async ({ request }) => {
    for (const id of angelegteWerkzeuge.splice(0)) {
      await request.delete(`/api/tools/${id}`, { headers: authHeaders() })
    }
  })

  /**
   * **Gibt es ein Datenblatt zu dieser ID, steht das Symbol in der Zeile und
   * öffnet es direkt** (DEC-065 Punkt 10, DEC-068). Wer an der Maschine steht,
   * kommt vom Werkzeug: weder Bereichswechsel noch vorbelegte Suche.
   */
  test('öffnet das Datenblatt direkt über das Symbol in der Zeile', async ({ page, request }) => {
    const werkzeugId = `${PREFIX}1075000`

    // Aufräumen **vor** dem Anlegen: ein Rest aus einem früheren Lauf würde das
    // Anlegen mit HTTP 400 scheitern lassen, und der Test wäre dann still
    // übersprungen statt aussagekräftig.
    const alte = await request.get(
      `/api/tools/?q=${encodeURIComponent(werkzeugId)}&limit=50`,
      { headers: authHeaders() },
    )
    if (alte.ok()) {
      for (const eintrag of (await alte.json()).items as { id: number; tool_id: string | null }[]) {
        if (eintrag.tool_id === werkzeugId) {
          await request.delete(`/api/tools/${eintrag.id}`, { headers: authHeaders() })
        }
      }
    }

    // Werkzeugtyp hier holen, nicht in `beforeAll`: ein zusätzlicher Aufruf im
    // Aufbau ließ dessen 30-Sekunden-Zeitfenster reißen.
    const typen = await (
      await request.get('/api/tools/types', { headers: authHeaders() })
    ).json()
    const typId = (typen as { id: number }[])[0]?.id
    test.skip(!typId, 'Kein Werkzeugtyp im Bestand – Spec übersprungen')

    // Ein Werkzeug mit der ID des Test-Datenblatts anlegen – die Zeilenaktion
    // startet in der **Werkzeugliste**, dort muss das Werkzeug stehen.
    const angelegt = await request.post('/api/tools/', {
      headers: authHeaders(),
      data: {
        tool_id: werkzeugId,
        category: 'Stempel',
        status: null,
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: '7,00',
        measure_b: null,
        description: 'Für die Zeilenaktion',
        plant_id: plantId,
        tool_type_id: typId,
        position_id: null,
        machine_id: null,
        customer_id: null,
      },
    })
    expect(angelegt.ok(), `Testwerkzeug anlegen: HTTP ${angelegt.status()}`).toBe(true)
    angelegteWerkzeuge.push((await angelegt.json()).id)

    await openWithToken(page, adminToken)
    await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click()
    // Auf der Werkzeuge-Seite heisst das Suchfeld anders als im Datenblatt-Bereich.
    await suche(page, werkzeugId, 'Werkzeuge durchsuchen')

    // Die Zeile steht wirklich da, bevor das Symbol geklickt wird.
    const zeile = page.locator('tbody tr').filter({ hasText: werkzeugId }).first()
    await expect(zeile).toBeVisible({ timeout: 10_000 })

    const symbol = zeile.getByRole('button', {
      name: `Datenblatt zu ${werkzeugId} öffnen`,
    })
    await expect(symbol).toBeVisible()

    // Ein echtes Inline-SVG (Lucide, Guide §1.7) – kein Bild, keine Schrift, und
    // ohne Netzzugriff: die Datei steht im Bundle.
    await expect(symbol.locator('svg')).toHaveCount(1)

    // Gerendert gemessen: Symbol und „…"-Knopf stehen in **einer** Zeile
    // nebeneinander, das Symbol links davon (die Zelle ist rechtsbündig).
    const lage = await zeile.evaluate((row) => {
      const knoepfe = row.querySelectorAll('td:last-child button')
      const links = knoepfe[0].getBoundingClientRect()
      const rechts = knoepfe[1].getBoundingClientRect()
      return {
        linksRechts: links.right,
        rechtsLinks: rechts.left,
        linksOben: Math.round(links.top),
        rechtsOben: Math.round(rechts.top),
      }
    })
    expect(lage.linksRechts).toBeLessThanOrEqual(lage.rechtsLinks + 1)
    expect(lage.linksOben).toBe(lage.rechtsOben)

    // „Datenblatt" steht **nicht** mehr im „…"-Menü: die Aktion liegt jetzt als
    // eigenes Symbol daneben.
    await oeffneZeilenmenue(page, werkzeugId)
    await expect(page.getByRole('menuitem', { name: 'Datenblatt' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await symbol.click()

    // Kein Bereichswechsel: das Datei-Fenster geht auf und nennt die ID.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText(werkzeugId)
    await dialog.getByRole('button', { name: 'Schließen' }).click()

    // Danach steht weiterhin die Werkzeugliste – die Suche dort ist unverändert.
    await expect(page.getByLabel('Werkzeuge durchsuchen')).toHaveValue(werkzeugId)
  })

  /**
   * **Ohne Datenblatt zur ID gibt es kein Symbol** (DEC-068) – und der Klick
   * kann schon deshalb nicht in den Datenblatt-Bereich führen.
   *
   * Das Testwerkzeug wird hier angelegt, nicht aus dem Bestand genommen: die
   * Testdaten dieser Spec enthalten selbst ein Datenblatt zu ihrer ID, ein
   * beliebiges vorhandenes Werkzeug kann also eines haben – der Test wäre dann
   * vom Zufall abhaengig.
   */
  test('zeigt kein Symbol, wenn es kein Datenblatt gibt', async ({ page, request }) => {
    const werkzeugId = `${PREFIX}OHNE-BLATT`

    const typen = await (
      await request.get('/api/tools/types', { headers: authHeaders() })
    ).json()
    const typId = (typen as { id: number }[])[0]?.id
    test.skip(!typId, 'Kein Werkzeugtyp im Bestand – Spec übersprungen')

    const angelegt = await request.post('/api/tools/', {
      headers: authHeaders(),
      data: {
        tool_id: werkzeugId,
        category: 'Stempel',
        status: null,
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: '7,00',
        measure_b: null,
        description: 'Ohne Datenblatt',
        plant_id: plantId,
        tool_type_id: typId,
        position_id: null,
        machine_id: null,
        customer_id: null,
      },
    })
    expect(angelegt.ok(), `Testwerkzeug anlegen: HTTP ${angelegt.status()}`).toBe(true)
    angelegteWerkzeuge.push((await angelegt.json()).id)

    await openWithToken(page, adminToken)
    await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click()
    await suche(page, werkzeugId, 'Werkzeuge durchsuchen')

    const zeile = page.locator('tbody tr').filter({ hasText: werkzeugId }).first()
    await expect(zeile).toBeVisible({ timeout: 10_000 })

    // Kein Datenblatt: kein Symbol. (Ausgegraut wäre die Alternative; gewählt ist
    // „gar nicht anzeigen", damit keine toten Knöpfe in der Liste stehen.)
    await expect(
      zeile.getByRole('button', { name: `Datenblatt zu ${werkzeugId} öffnen` }),
    ).toHaveCount(0)

    // Das „…"-Menü enthält die Aktion auch nicht mehr – es gibt sie nur als Symbol.
    await oeffneZeilenmenue(page, werkzeugId)
    await expect(page.getByRole('menuitem', { name: 'Datenblatt' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Und die Ansicht bleibt die Werkzeugliste (kein Wechsel in die Suche).
    await expect(page.getByLabel('Werkzeuge durchsuchen')).toBeVisible()
  })
})

/**
 * Rechteprüfung serverseitig: Verwalten ist Administratoren vorbehalten
 * (DEC-065 Punkt 9). Diese Tests laufen ohne Browser.
 */
test.describe('Datenblätter – Rechte am Endpunkt', () => {
  test('Anlegen ohne Adminrechte wird abgewiesen', async ({ request }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    const response = await request.post('/api/data-sheets/', {
      headers: authHeaders(plainToken),
      multipart: { tool_id: 'X', plant_id: '1' },
    })
    expect(response.status()).toBe(403)
  })

  test('Löschen ohne Adminrechte wird abgewiesen', async ({ request }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    test.skip(seededIds.length === 0, 'Testdaten fehlen – Spec übersprungen')
    const response = await request.delete(`/api/data-sheets/${seededIds[0]}`, {
      headers: authHeaders(plainToken),
    })
    expect(response.status()).toBe(403)
  })

  test('Lesen darf jeder aktive Benutzer', async ({ request }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    const response = await request.get('/api/data-sheets/', {
      headers: authHeaders(plainToken),
    })
    expect(response.status()).toBe(200)
  })
})
