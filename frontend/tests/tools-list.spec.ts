import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Werkzeugtabelle: Suche, Filter, Sortierung, Favoriten und Pagination.
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173.
 *
 * Die Spec legt ihre Testdaten selbst an (20 Werkzeuge, damit es mehr als eine
 * Seite gibt) und räumt sie hinterher wieder weg. Fehlt das Admin-Konto, wird
 * die Datei übersprungen statt rot zu werden.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/tools-list.spec.ts
 */

const SHOTS = '../.audit/shots'
const ADMIN = { personal_number: 'admin1', password: '123' }
const SEED_COUNT = 20
/** Eigener Nummernkreis je Lauf: so kollidiert nichts mit vorhandenen Daten. */
const SEED_PREFIX = `TST-${String(Date.now()).slice(-6)}-`

let adminToken = ''
const seededIds: number[] = []
/** Name des ersten Werkzeugtyps – für die Prüfung der Typ-Spalte. */
let seedTypeName = ''

function authHeaders() {
  return { Authorization: `Bearer ${adminToken}` }
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  // Stammdaten lesen; ohne sie lässt sich nichts anlegen (dann wird übersprungen).
  const plantsResponse = await request.get('/api/locations/plants', {
    headers: authHeaders(),
  })
  const typesResponse = await request.get('/api/tools/types', { headers: authHeaders() })
  if (!plantsResponse.ok() || !typesResponse.ok()) return
  const plants = await plantsResponse.json()
  const types = await typesResponse.json()
  if (!plants.length || !types.length) return
  seedTypeName = types[0].name

  for (let index = 1; index <= SEED_COUNT; index += 1) {
    const response = await request.post('/api/tools/', {
      headers: authHeaders(),
      data: {
        tool_id: `${SEED_PREFIX}${String(index).padStart(3, '0')}`,
        category: 'Stempel',
        status: ['available', 'lent', 'maintenance'][index % 3],
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: `${index},00`,
        measure_b: null,
        description: `Testwerkzeug ${index}`,
        plant_id: plants[0].id,
        tool_type_id: types[0].id,
        position_id: null,
        machine_id: null,
        customer_id: null,
      },
    })
    if (response.ok()) seededIds.push((await response.json()).id)
  }

  // Ein Werkzeug ohne Beschreibung: dafür gilt die Ersatzdarstellung („—" in
  // der Beschreibung).
  //
  // **Ohne Maße geht das nicht mehr.** `assert_tool_identity` verlangt Maß A für
  // alle Kategorien (Audit), und in der Datenbank steht kein einziger
  // Altdatensatz ohne Maß – „keine Maße" in `ToolTable` ist damit nicht mehr
  // erreichbar. Der Datensatz braucht ein Maß; sonst kommt der POST als 400
  // zurück, der Datensatz fehlt und die Tests finden ihn nicht.
  await request.post('/api/tools/', {
    headers: authHeaders(),
    data: {
      tool_id: `${SEED_PREFIX}099`,
      category: 'Stempel',
      status: null,
      is_storage: false,
      allow_duplicate_id: false,
      measure_a: '9,00',
      measure_b: null,
      description: null,
      plant_id: plants[0].id,
      tool_type_id: types[0].id,
      position_id: null,
      machine_id: null,
      customer_id: null,
    },
  })

  // Je ein Werkzeug der beiden anderen Kategorien: nur damit lässt sich prüfen,
  // dass der Kategorie-Chip wirklich je Kategorie unterschiedlich färbt.
  for (const [index, category] of ['Abstreifer', 'Matrize'].entries()) {
    await request.post('/api/tools/', {
      headers: authHeaders(),
      data: {
        tool_id: `${SEED_PREFIX}09${index + 7}`,
        category,
        status: null,
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: '4,00',
        measure_b: null,
        description: `Kategorie ${category}`,
        plant_id: plants[0].id,
        tool_type_id: types[0].id,
        position_id: null,
        machine_id: null,
        customer_id: null,
      },
    })
  }
})

test.afterAll(async ({ request }) => {
  // Aufräumen über die Suche statt über die gemerkten IDs: so verschwindet
  // auch alles, was im selben Lauf entstanden ist, aber nicht in `seededIds`
  // gelandet wäre (z. B. ein Wiederholungsversuch).
  const found = await request.get(`/api/tools/?q=${SEED_PREFIX}&limit=200`, {
    headers: authHeaders(),
  })
  if (!found.ok()) return
  for (const tool of (await found.json()).items) {
    const response = await request.delete(`/api/tools/${tool.id}`, {
      headers: authHeaders(),
    })
    if (!response.ok()) {
      console.warn(`Testwerkzeug ${tool.tool_id} konnte nicht entfernt werden: ${response.status()}`)
    }
  }
})

/** Die Spec braucht ein Konto und Testdaten – sonst prüft sie nichts. */
function requireSeed() {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(seededIds.length === 0, 'Testdaten konnten nicht angelegt werden – Spec übersprungen')
}

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('Personalnummer').fill('1234')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible()
  // Erste Seite abwarten
  await expect(page.getByRole('table')).toBeVisible()
}

test.describe('Werkzeugliste', () => {
  test.beforeEach(() => requireSeed())

  test('zeigt Bereich, Gesamtzahl und Blätterleiste', async ({ page }) => {
    await login(page)

    await expect(page.getByRole('navigation', { name: 'Seitennavigation der Werkzeugliste' }))
      .toBeVisible()
    await expect(page.getByText(/^\d+–\d+ von \d+ Werkzeugen$/)).toBeVisible()
    await expect(page.getByLabel('Werkzeuge durchsuchen')).toBeVisible()

    await page.screenshot({ path: `${SHOTS}/wt-01-liste.png`, fullPage: true })
  })

  test('sortiert über die Spaltenköpfe und meldet es per aria-sort', async ({ page }) => {
    await login(page)

    const idHeader = page.getByRole('columnheader', { name: /Werkzeug-ID/ })
    await expect(idHeader).toHaveAttribute('aria-sort', 'ascending')

    const firstRowBefore = await page.locator('tbody tr').first().innerText()

    // Zweiter Klick auf dieselbe Spalte: absteigend. Die Zusicherung wartet,
    // bis die neu sortierte Seite da ist (die Abfrage läuft über das Netz).
    await page.getByRole('button', { name: /Nach Werkzeug-ID sortieren/ }).click()
    await expect(idHeader).toHaveAttribute('aria-sort', 'descending')
    await expect(page.locator('tbody tr').first()).not.toHaveText(firstRowBefore)

    // Andere Spalte: beginnt wieder aufsteigend
    await page.getByRole('button', { name: /Nach Lagerplatz sortieren/ }).click()
    await expect(page.getByRole('columnheader', { name: /Lagerplatz/ }))
      .toHaveAttribute('aria-sort', 'ascending')
    await expect(page.getByRole('columnheader', { name: /Werkzeug-ID/ }))
      .toHaveAttribute('aria-sort', 'none')

    // Die Sortierung steht in der Adresszeile
    expect(new URL(page.url()).searchParams.get('sort')).toBe('location')

    await page.screenshot({ path: `${SHOTS}/wt-02-sortiert.png`, fullPage: true })
  })

  test('sortiert nach Werkzeugtyp', async ({ page, request }) => {
    await login(page)

    await page.getByRole('button', { name: /Nach Typ sortieren/ }).click()
    await expect(page.getByRole('columnheader', { name: /Typ/ }))
      .toHaveAttribute('aria-sort', 'ascending')
    expect(new URL(page.url()).searchParams.get('sort')).toBe('tool_type')

    // Die angezeigte Reihenfolge muss der Reihenfolge entsprechen, die die API
    // für dieselbe Sortierung liefert (Spalte 4 ist Typ/Maße). Die Zelle trägt
    // Typ und Maßzeile — für den Vergleich bleibt nur die Typ-Zeile übrig.
    function typAusZelle(text: string): string {
      const zeilen = text
        .trim()
        .split('\n')
        .map((zeile) => zeile.trim())
        .filter(Boolean)
      if (zeilen.length > 1 && /(mm|keine Maße)$/.test(zeilen[zeilen.length - 1])) {
        zeilen.pop()
      }
      return zeilen.join(' ').replace(/\s+/g, ' ')
    }

    const erwartet = await request
      .get('/api/tools/?sort=tool_type&order=asc&limit=10', { headers: authHeaders() })
      .then((response) => response.json())
    const erwarteteTypen: string[] = erwartet.items.map(
      (entry: { tool_type: { name: string } | null }) =>
        (entry.tool_type?.name ?? '—').replace(/\s+/g, ' '),
    )

    await expect
      .poll(async () => {
        const cells = await page.locator('tbody tr td:nth-child(4)').allInnerTexts()
        return cells.map(typAusZelle)
      })
      .toEqual(erwarteteTypen)
  })

  test('zeigt Kunde und Maschine aus den Stammdaten', async ({ page, request }) => {
    await login(page)

    // Spalte 6 ist „Kunde / Maschine" — verglichen mit dem, was die API liefert.
    const erwartet = await request
      .get('/api/tools/?limit=10', { headers: authHeaders() })
      .then((response) => response.json())
    const erwartetePaare: string[] = erwartet.items.map(
      (entry: { customer: { name: string } | null; machine: { name: string } | null }) =>
        `${entry.customer?.name ?? '—'}|${entry.machine?.name ?? '—'}`,
    )
    // Mindestens ein Werkzeug mit Zuordnung, sonst prüft der Test nichts.
    expect(erwartetePaare.some((paar) => paar !== '—|—')).toBe(true)

    await expect
      .poll(async () => {
        const cells = await page.locator('tbody tr td:nth-child(6)').allInnerTexts()
        return cells.map((text) =>
          text
            .trim()
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('|'),
        )
      })
      .toEqual(erwartetePaare)
  })

  test('sucht, zeigt Filter als Chips und setzt sie zurück', async ({ page }) => {
    await login(page)

    const search = page.getByLabel('Werkzeuge durchsuchen')
    await search.fill('Testwerkzeug 1')
    await expect(page.getByText(/^1–\d+ von \d+ Werkzeugen$/)).toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: `${SHOTS}/wt-03-suche.png`, fullPage: true })

    // Chip erscheint mit dem Suchbegriff
    await expect(
      page.getByRole('button', { name: 'Filter entfernen: Suche: „Testwerkzeug 1“' }),
    ).toBeVisible()

    // Kein Treffer -> Leerzustand mit Ausweg
    await search.fill('gibtesnicht-xyz')
    await expect(page.getByText('Keine Treffer für „gibtesnicht-xyz“')).toBeVisible({
      timeout: 5000,
    })
    await page.screenshot({ path: `${SHOTS}/wt-04-kein-treffer.png` })

    // Zwei Orte bieten den Ausweg an: die Chip-Zeile und der Leerzustand.
    await page.getByRole('button', { name: 'Alle Filter zurücksetzen' }).first().click()
    await expect(page.getByLabel('Werkzeuge durchsuchen')).toHaveValue('')
    await expect(page.getByText(/^\d+–\d+ von \d+ Werkzeugen$/)).toBeVisible()
  })

  test('filtert nach Status über das Mehrfachmenü', async ({ page, request }) => {
    await login(page)

    await page.getByRole('button', { name: /Status filtern/ }).click()
    await page.getByRole('checkbox', { name: 'Ausgeliehen' }).check()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', { name: /Status filtern: Ausgeliehen/ })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('status')).toBe('lent')

    // Der Status steht nicht mehr als eigene Spalte in der Tabelle (er war dort
    // fast immer leer). Geprüft wird deshalb gegen die API: die sichtbaren
    // Werkzeug-IDs müssen genau die ausgeliehenen sein.
    //
    // Wichtig: die Liste zeigt **eine Seite** (10 Werkzeuge je Seite,
    // `DEFAULT_TOOL_QUERY`). Deshalb wird dieselbe Seite auch von der API
    // geholt – mit `limit=100` standen hier alle ausgeliehenen Werkzeuge den
    // zehn sichtbaren gegenüber und der Vergleich musste fehlschlagen.
    const erwartet = await request
      .get('/api/tools/?status=lent&limit=10&skip=0', { headers: authHeaders() })
      .then((response) => response.json())
    const erwarteteIds = erwartet.items.map((tool: { tool_id: string }) => tool.tool_id).sort()
    expect(erwarteteIds.length).toBeGreaterThan(0)

    await expect
      .poll(async () => {
        const ids = await page
          .locator('tbody tr td:nth-child(2) code')
          .allInnerTexts()
        return ids.map((id) => id.trim()).sort()
      })
      .toEqual(erwarteteIds)

    await page.screenshot({ path: `${SHOTS}/wt-05-statusfilter.png`, fullPage: true })
  })

  test('filtert Kategorien als Kontrollkästchen (mehrfach)', async ({ page }) => {
    await login(page)

    // Kategorie und Werk sitzen in der Kopfzeile der Liste.
    await page.getByLabel('Stempel').check()
    await expect(page.getByLabel('Stempel')).toBeChecked()
    expect(new URL(page.url()).searchParams.get('kategorie')).toBe('Stempel')

    await page.getByLabel('Abstreifer').check()
    expect(new URL(page.url()).searchParams.get('kategorie')).toBe('Stempel,Abstreifer')

    await page.screenshot({ path: `${SHOTS}/wt-11-kategorie.png`, fullPage: true })

    await page.getByLabel('Stempel').uncheck()
    await page.getByLabel('Abstreifer').uncheck()
    await expect(page.getByText(/^\d+–\d+ von \d+ Werkzeugen$/)).toBeVisible()
  })

  test('färbt den Kategorie-Chip je Kategorie unterschiedlich', async ({ page }) => {
    await login(page)

    // Die angelegten Werkzeuge 097 (Abstreifer), 098 (Matrize), 099 (Stempel)
    await page.getByLabel('Werkzeuge durchsuchen').fill(`${SEED_PREFIX}09`)
    await expect(page.getByText(/^1–3 von 3 Werkzeugen$/)).toBeVisible({ timeout: 5000 })

    const chips = await page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')].map((row) => {
        const chip = (row.children[1] as HTMLElement).querySelector('span[aria-hidden="true"]')
        if (!chip) return null
        return `${chip.textContent} ${getComputedStyle(chip).backgroundColor} ${getComputedStyle(chip).color}`
      }),
    )

    expect(chips.filter(Boolean)).toHaveLength(3)
    // Drei Kategorien, drei verschiedene Farbpaare (Hintergrund + Text).
    expect(new Set(chips).size).toBe(3)
  })

  test('setzt die Filter der Kopfzeile zurück', async ({ page }) => {
    await login(page)

    // Nur ein Kopffilter (Kategorie) aktiv: vorher gab es dafür keinen
    // Rückweg, weil die Chip-Zeile unter der Suchleiste nicht erschien.
    const zuruecksetzen = page.getByRole('button', { name: /^Zurücksetzen$/ })
    await expect(zuruecksetzen).toHaveCount(0)

    await page.getByLabel('Stempel').check()
    await expect(zuruecksetzen).toBeVisible()
    await zuruecksetzen.click()

    await expect(page.getByLabel('Stempel')).not.toBeChecked()
    expect(new URL(page.url()).searchParams.get('kategorie')).toBeNull()
    await expect(zuruecksetzen).toHaveCount(0)

    // Auch Werk und Favoriten lassen sich so zurückstellen.
    await page.getByLabel('Werk 1').check()
    await expect(zuruecksetzen).toBeVisible()
    await zuruecksetzen.click()
    await expect(page.getByLabel('Werk 1')).not.toBeChecked()
    expect(new URL(page.url()).searchParams.get('werk')).toBeNull()

    await page.getByLabel('Nur Favoriten').check()
    await expect(zuruecksetzen).toBeVisible()
    await zuruecksetzen.click()
    await expect(page.getByLabel('Nur Favoriten')).not.toBeChecked()
    expect(new URL(page.url()).searchParams.get('favoriten')).toBeNull()
  })

  test('setzt die Sortierung mit einem dritten Klick zurück', async ({ page }) => {
    await login(page)

    // Standard: Werkzeug-ID aufsteigend
    await expect(page.getByRole('columnheader', { name: /Werkzeug-ID/ }))
      .toHaveAttribute('aria-sort', 'ascending')

    // Erster Klick: nach Typ aufsteigend
    await page.getByRole('button', { name: /Nach Typ sortieren/ }).click()
    expect(new URL(page.url()).searchParams.get('sort')).toBe('tool_type')
    await expect(page.getByRole('columnheader', { name: /Typ/ }))
      .toHaveAttribute('aria-sort', 'ascending')

    // Zweiter Klick: absteigend
    await page.getByRole('button', { name: /Nach Typ sortieren/ }).click()
    await expect(page.getByRole('columnheader', { name: /Typ/ }))
      .toHaveAttribute('aria-sort', 'descending')

    // Dritter Klick: wieder Standardsortierung
    await page.getByRole('button', { name: /Nach Typ sortieren/ }).click()
    expect(new URL(page.url()).searchParams.get('sort')).toBeNull()
    expect(new URL(page.url()).searchParams.get('richtung')).toBeNull()
    await expect(page.getByRole('columnheader', { name: /Werkzeug-ID/ }))
      .toHaveAttribute('aria-sort', 'ascending')

    // Die Sortierung taucht bewusst NICHT in der Filterabwahl auf: nach dem
    // Sortieren erscheint dort kein Chip und kein Zurücksetzen-Knopf.
    await page.getByRole('button', { name: /Nach Kunde sortieren/ }).click()
    expect(new URL(page.url()).searchParams.get('sort')).toBe('customer')
    await expect(page.getByRole('button', { name: /Filter entfernen: Sortierung/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Zurücksetzen$/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Alle Filter zurücksetzen' })).toHaveCount(0)

    // Und der Weg zurück bleibt der dritte Klick
    await page.getByRole('button', { name: /Nach Kunde sortieren/ }).click()
    await page.getByRole('button', { name: /Nach Kunde sortieren/ }).click()
    expect(new URL(page.url()).searchParams.get('sort')).toBeNull()
  })

  test('zeigt keine eigene Bildlaufleiste in der Tabelle und zeichnet Zebra-Streifen', async ({
    page,
  }) => {
    await login(page)

    // Auf die angelegten Testwerkzeuge filtern: die sind garantiert keine
    // Favoriten (Favoritenzeilen haben eine eigene Farbe und würden das Zebra
    // verfälschen).
    await page.getByLabel('Werkzeuge durchsuchen').fill('Testwerkzeug')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 })
    // Auf die Chip-Zeile warten: mit dem Suchbegriff erscheint sie und schiebt
    // die Tabelle nach unten. Erst danach steht das Layout fest — sonst landet
    // die Maus beim Hover auf der Kopfzeile (schon passiert).
    await expect(
      page.getByRole('button', { name: /Filter entfernen: Suche/ }),
    ).toBeVisible({ timeout: 5000 })

    // 1) Zehn Werkzeuge je Seite passen in die Seite: das Tabellenfeld hat
    //    KEINE eigene (senkrechte) Bildlaufleiste.
    const feld = await page.evaluate(() => {
      const scroll = document.querySelector('.glass-preview-card') as HTMLElement
      const th = document.querySelector('thead th:nth-child(2)') as HTMLElement
      return {
        clientHeight: scroll.clientHeight,
        scrollHeight: scroll.scrollHeight,
        overflowX: getComputedStyle(scroll).overflowX,
        zeilen: document.querySelectorAll('tbody tr').length,
        kopfPosition: getComputedStyle(th).position,
      }
    })
    expect(feld.zeilen).toBe(10)
    expect(feld.overflowX).toBe('auto')
    // Kein Überlauf in der Höhe -> keine Leiste im Feld
    expect(feld.scrollHeight).toBeLessThanOrEqual(feld.clientHeight + 2)
    // Der Kopf ist bewusst NICHT klebend (siehe Kommentar in ToolTable.tsx:
    // klebender Kopf und kein eigener Scrollbalken schließen sich aus).
    expect(feld.kopfPosition).toBe('static')

    // 2) Zebra: gerade und ungerade Zeilen unterscheiden sich.
    const zebra = await page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')]
        .slice(0, 2)
        .map((row) => getComputedStyle(row).backgroundColor),
    )
    expect(zebra[0]).not.toBe(zebra[1])

    // 3) Der Hover ist stärker als das Zebra – auf beiden Zeilenarten gleich.
    //    Die Maus wird vor jedem Hover weggeparkt, damit Playwright für jede
    //    Zeile wirklich eine Bewegung ausführt; `hover()` selbst prüft, dass
    //    die Zeile steht (die Kopfzeile hat schon einmal den Treffer bekommen,
    //    als die Koordinaten veraltet waren).
    const hoverFarben: string[] = []
    for (const index of [0, 1]) {
      const zeile = page.locator('tbody tr').nth(index)
      const vorher = await zeile.evaluate((element) => getComputedStyle(element).backgroundColor)

      await page.mouse.move(4, 4)
      await zeile.hover()
      // transition-colors läuft 150 ms – erst danach messen.
      await page.waitForTimeout(300)

      const nachher = await zeile.evaluate((element) => getComputedStyle(element).backgroundColor)
      expect(nachher, `Zeile ${index} reagiert auf Hover`).not.toBe(vorher)
      hoverFarben.push(nachher)
    }
    expect(hoverFarben[0]).toBe(hoverFarben[1])

    await page.getByLabel('Werkzeuge durchsuchen').fill('')
  })

  test('hebt Favoriten mit eigener Sternfarbe und eigener Zeilenfarbe hervor', async ({
    page,
  }) => {
    await login(page)

    // Ein eigenes Testwerkzeug favorisieren (wird am Dateiende ohnehin gelöscht)
    const zielId = `${SEED_PREFIX}007`
    await page.getByLabel('Werkzeuge durchsuchen').fill(zielId)
    await expect(page.getByText(/^1–1 von 1 Werkzeug$/)).toBeVisible({ timeout: 5000 })

    // Die Zeile in die Fenstermitte holen: ihre Lage hängt an der Höhe der
    // Kopfbereiche (Tab-Leiste, Arbeitswerk-Leiste, TASK-030). Steht sie am
    // unteren Rand, trifft ein Scroll oder ein Klick daneben.
    const zeile = page.locator('tbody tr').first()
    await zeile.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const vorherZeile = await zeile.evaluate((element) => getComputedStyle(element).backgroundColor)

    await zeile.getByRole('button', { name: /zu den Favoriten hinzufügen/ }).click()
    await expect(zeile.getByRole('button', { name: /Favorit .* entfernen/ })).toBeVisible({
      timeout: 5000,
    })

    // Zeilenfarbe **warten**, nicht einmal messen: Der Favorit wird optimistisch
    // umgeschaltet (React-Zustand), die neue Farbe steht erst im nächsten Bild.
    // Eine Momentaufnahme direkt nach dem Klick war deshalb wackelig.
    await expect
      .poll(
        async () =>
          zeile.evaluate((element) => getComputedStyle(element).backgroundColor),
        { timeout: 5_000 },
      )
      .not.toBe(vorherZeile)
    const nachher = await zeile.evaluate((element) => {
      const stern = element.querySelector('svg') as SVGElement
      return {
        zeile: getComputedStyle(element).backgroundColor,
        stern: getComputedStyle(stern).color,
      }
    })

    // Zeile bekommt eine eigene (warme) Farbe ...
    expect(nachher.zeile).not.toBe(vorherZeile)
    // ... und der Stern ein sattes Gold statt des gedämpften Grau-Tons
    expect(nachher.stern).not.toBe('rgb(71, 85, 105)')
    // Aufräumen
    await zeile.getByRole('button', { name: /Favorit .* entfernen/ }).click()
    await expect(zeile.getByRole('button', { name: /zu den Favoriten hinzufügen/ })).toBeVisible({
      timeout: 5000,
    })
  })

  test('öffnet das Zeilenmenü nach links und schließt es per Escape', async ({ page, request }) => {
    await login(page)

    const row = page.locator('tbody tr').first()
    // Zustand der Zeile VOR dem Öffnen lesen: jedes weitere Zugriff auf die
    // Zeile kann die Tabelle scrollen, und das Menü schließt bei Scroll.
    // Der Status steht nicht in der Tabelle, deshalb kommt er aus der API.
    const toolId = (await row.locator('code').first().innerText()).trim()
    const tool = await request
      .get(`/api/tools/?q=${encodeURIComponent(toolId)}&limit=100`, { headers: authHeaders() })
      .then((response) => response.json())
    const ausleihbar = tool.items.some(
      (entry: { tool_id: string; status: string | null }) => entry.status !== 'lent',
    )
    const trigger = row.getByRole('button', { name: /Weitere Aktionen für/ })

    await trigger.click()

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    // Das Menü trägt die Aktionen der Zeile: „Ausleihen" nur, wenn nichts
    // bereits ausgeliehen ist; Bearbeiten und Löschen immer.
    const eintraege = await menu.getByRole('menuitem').allInnerTexts()
    expect(eintraege).toContain('Bearbeiten')
    expect(eintraege).toContain('Löschen')
    expect(eintraege.includes('Ausleihen')).toBe(ausleihbar)

    // Gerendert gemessen: das Menü wächst nach links – seine rechte Kante
    // landet auf der rechten Kante des „…"-Knopfes. Gemessen wird per evaluate,
    // weil `boundingBox()` die Seite scrollen und das Menü damit schließen
    // würde. `expect.poll` wiederholt die Messung, bis die Einfahrt-Animation
    // durch ist (währenddessen ist das Menü um bis zu 10 px verschoben).
    function menuGeometrie() {
      return page.evaluate(() => {
        const menu = document.querySelector('[role="menu"]') as HTMLElement | null
        const trigger = document.querySelector<HTMLElement>(
          '[aria-haspopup="menu"][aria-expanded="true"]',
        )
        if (!menu || !trigger) return null
        const m = menu.getBoundingClientRect()
        const t = trigger.getBoundingClientRect()
        return { menuLeft: m.left, menuRight: m.right, triggerLeft: t.left, triggerRight: t.right }
      })
    }

    await expect
      .poll(async () => {
        const boxes = await menuGeometrie()
        return boxes ? Math.round(boxes.menuRight - boxes.triggerRight) : 999
      }, { message: 'rechte Kante des Menüs liegt auf der des Knopfes' })
      .toBe(0)

    const boxes = await menuGeometrie()
    expect(boxes).not.toBeNull()
    // und es liegt tatsächlich links vom Knopf (nicht darüber)
    expect(boxes!.menuLeft).toBeLessThan(boxes!.triggerLeft)

    await page.screenshot({ path: `${SHOTS}/wt-12-zeilenmenue.png`, fullPage: false })

    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  })

  test('setzt Favoriten, filtert darauf und übersteht ein Neuladen', async ({ page }) => {
    await login(page)

    // Bewusst ein eigenes Testwerkzeug statt der ersten Zeile: diese Datensätze
    // werden am Ende der Datei ohnehin gelöscht, ein abgebrochener Lauf kann
    // also keinen Favoriten an echten Daten hinterlassen.
    const toolId = `${SEED_PREFIX}005`
    await page.getByLabel('Werkzeuge durchsuchen').fill(toolId)
    await expect(page.getByText(/^1–1 von 1 Werkzeug$/)).toBeVisible({ timeout: 5000 })
    const zeile = page.locator('tbody tr').first()

    await zeile.getByRole('button', { name: /zu den Favoriten hinzufügen/ }).click()
    // Optimistisch gesetzt: der Stern ist sofort gefüllt
    await expect(zeile.getByRole('button', { name: /Favorit .* entfernen/ })).toBeVisible({
      timeout: 5000,
    })

    // Neuladen: die Markierung ist global gespeichert
    await page.reload()
    await expect(page.getByRole('table')).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Favorit ${toolId} entfernen` }).first(),
    ).toBeVisible()

    // Nur Favoriten: Umschalter in der Kopfzeile
    await page.getByLabel('Nur Favoriten').check()
    await expect(page.getByLabel('Nur Favoriten')).toBeChecked()
    await expect(page.locator('tbody tr').first()).toContainText(toolId)
    await page.screenshot({ path: `${SHOTS}/wt-06-favoriten.png`, fullPage: true })

    // Aufräumen: Favorit wieder entfernen – die Zeile verlässt die Ansicht.
    await page.getByRole('button', { name: `Favorit ${toolId} entfernen` }).first().click()
    await expect(
      page.getByRole('button', { name: `Favorit ${toolId} entfernen` }),
    ).toHaveCount(0, { timeout: 5000 })
    await page.getByLabel('Nur Favoriten').uncheck()
    await expect(
      page.locator('tbody tr').first().getByRole('button', { name: /zu den Favoriten hinzufügen/ }),
    ).toBeVisible()
  })

  test('blättert, ändert die Seitengröße und behält die Ansicht beim Reload', async ({ page }) => {
    await login(page)

    // Standardseite: 10 Einträge. `exact` ist nötig: ohne das trifft
    // „Seite 1" auch „Seite 10", „Seite 17" und so weiter.
    await expect(page.getByRole('button', { name: 'Seite 1', exact: true }))
      .toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: `${SHOTS}/wt-07-seite1.png`, fullPage: true })

    await page.getByRole('button', { name: 'Nächste Seite' }).click()
    await expect(page.getByRole('button', { name: 'Seite 2', exact: true }))
      .toHaveAttribute('aria-current', 'page')
    expect(new URL(page.url()).searchParams.get('seite')).toBe('2')
    // Standardseitengröße ist 10 → Seite 2 beginnt bei 11
    await expect(page.getByText(/^11–\d+ von \d+ Werkzeugen$/)).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/wt-08-seite2.png`, fullPage: true })

    // Seitengröße ändern -> zurück auf Seite 1
    await page.getByLabel('Pro Seite').selectOption('50')
    await expect(page.getByText(/^1–\d+ von \d+ Werkzeugen$/)).toBeVisible()
    expect(new URL(page.url()).searchParams.get('seite')).toBeNull()

    // Reload behält die Seitengröße (Adresszeile ist der Zustand)
    await page.reload()
    await expect(page.getByLabel('Pro Seite')).toHaveValue('50')

    // Aufräumen für andere Tests
    await page.getByLabel('Pro Seite').selectOption('10')
  })

  test('Zurück-Taste führt zum vorherigen Filterzustand', async ({ page }) => {
    await login(page)

    await page.getByRole('button', { name: /Nach Beschreibung sortieren/ }).click()
    await expect(page.getByRole('columnheader', { name: /Beschreibung/ }))
      .toHaveAttribute('aria-sort', 'ascending')
    expect(new URL(page.url()).searchParams.get('sort')).toBe('description')

    await page.goBack()
    await expect(page.getByRole('columnheader', { name: /Werkzeug-ID/ }))
      .toHaveAttribute('aria-sort', 'ascending')
    expect(new URL(page.url()).searchParams.get('sort')).toBeNull()
  })

  test('zeigt eine leere Beschreibung als „—" und nicht den Typ', async ({ page }) => {
    await login(page)

    await page.getByLabel('Werkzeuge durchsuchen').fill(`${SEED_PREFIX}099`)
    // Erst wenn die Liste wirklich gefiltert ist, stehen die Zeilen fest.
    await expect(page.getByText(/^1–1 von 1 Werkzeug$/)).toBeVisible({ timeout: 5000 })
    const row = page.locator('tbody tr').first()
    await expect(row).toBeVisible()

    // Spalten: 1 Favorit, 2 Werkzeug-ID/Kategorie, 3 Lagerplatz/Werk,
    //          4 Typ/Maße, 5 Beschreibung, 6 Kunde/Maschine, 7 Aktionen
    const typ = (await row.locator('td').nth(3).innerText()).replace(/\s+/g, ' ').trim()
    const beschreibung = (await row.locator('td').nth(4).innerText()).trim()

    // Der Typ steht als Code-Chip + Bezeichnung, darunter die Maße.
    expect(typ).toContain(seedTypeName.replace(/^\d+\s+/, ''))
    expect(typ).toContain('9,00')
    // Ohne Beschreibung steht dort ein Strich – nicht noch einmal der Typ.
    expect(beschreibung).toBe('—')
  })

  test('meldet das Anlegen als Toast, nicht als Meldung im Block', async ({ page }) => {
    await login(page)

    const neueId = `${SEED_PREFIX}TOAST`
    await page.getByRole('button', { name: 'Anlegen' }).first().click()

    const formular = page.locator('.tool-form-card')
    await expect(formular).toBeVisible()
    await page.getByLabel('Werkzeug-ID').fill(neueId)
    await page.getByLabel('Werk', { exact: true }).selectOption({ index: 1 })
    await page.getByLabel('Werkzeug-Typ').selectOption({ index: 1 })
    await page.getByLabel('Maß A').fill('5,00')
    await page.getByLabel(/In Ablage legen/).check()
    await formular.getByRole('button', { name: 'Anlegen' }).click()

    // Toast unten rechts mit Titel und Fortschrittsbalken
    const toast = page.locator('.ui-toast-stack')
    await expect(toast).toBeVisible({ timeout: 10000 })
    await expect(toast).toContainText(`Werkzeug „${neueId}“ angelegt`)
    await expect(toast.locator('.ui-toast-life')).toHaveCount(1)

    // Gerendert gemessen: der Toast liegt im Bild, unten rechts. Ohne diese
    // Prüfung wäre ein Toast im Glasblock (backdrop-filter = Bezugsrahmen für
    // position:fixed) unsichtbar außerhalb des Fensters gelandet.
    const lage = await page.evaluate(() => {
      const el = document.querySelector('.ui-toast') as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        bottom: r.bottom,
        right: r.right,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })
    expect(lage).not.toBeNull()
    expect(lage!.right).toBeLessThanOrEqual(lage!.viewportWidth)
    expect(lage!.bottom).toBeLessThanOrEqual(lage!.viewportHeight)
    expect(lage!.bottom).toBeGreaterThan(lage!.viewportHeight / 2)
    expect(lage!.right).toBeGreaterThan(lage!.viewportWidth / 2)

    await page.screenshot({ path: `${SHOTS}/wt-13-toast.png`, fullPage: false })

    // und er räumt sich selbst wieder weg
    await expect(toast).toHaveCount(0, { timeout: 12000 })
  })

  test('legt einen Abstreifer ohne Werkzeug-ID an (ID freiwillig, Maß A Pflicht)', async ({
    page,
    request,
  }) => {
    await login(page)

    const beschreibung = `${SEED_PREFIX}OHNEID`
    await page.getByRole('button', { name: 'Anlegen' }).first().click()

    const formular = page.locator('.tool-form-card')
    await expect(formular).toBeVisible()

    // Stempel (Vorauswahl): die ID ist Pflicht – das Feld trägt `required`, und
    // das Sternchen steht **neben** dem Label (nicht darin: als Label-Kind wurde
    // der zugängliche Name „Werkzeug-ID*" und jeder exact-Locator lief ins Leere).
    const idFeld = page.getByLabel('Werkzeug-ID')
    await expect(idFeld).toHaveAttribute('required', '')

    // Abstreifer/Matrize: ID freiwillig, dafür erklärt ein Hinweis warum.
    await formular.getByLabel('Abstreifer').check()
    await expect(idFeld).not.toHaveAttribute('required', '')
    await expect(formular).toContainText('Abstreifer und Matrize brauchen keine ID')

    await page.getByLabel('Werk', { exact: true }).selectOption({ index: 1 })
    await page.getByLabel('Werkzeug-Typ').selectOption({ index: 1 })
    await page.getByLabel('Maß A').fill('12') // wird zu „12,00" normalisiert
    await page.getByLabel('Beschreibung').fill(beschreibung)
    await page.getByLabel(/In Ablage legen/).check()
    await formular.getByRole('button', { name: 'Anlegen' }).click()

    // Der Toast benennt den Datensatz, statt ein leeres Anführungszeichen zu zeigen.
    await expect(page.locator('.ui-toast-stack')).toContainText(
      'Werkzeug „ohne ID“ angelegt',
      { timeout: 10000 },
    )

    // In der Datenbank steht NULL (nicht der leere String) – der Datensatz ist
    // auch über die Liste auffindbar und zeigt dort „ohne ID" statt einer
    // leeren Mono-Markierung.
    const antwort = await request
      .get(`/api/tools/?q=${beschreibung}&limit=5`, { headers: authHeaders() })
      .then((response) => response.json())
    expect(antwort.total).toBe(1)
    expect(antwort.items[0].tool_id).toBeNull()
    expect(antwort.items[0].measure_a).toBe('12,00')

    await page.getByLabel('Werkzeuge durchsuchen').fill(beschreibung)
    const zeile = page.locator('tbody tr').first()
    await expect(zeile).toContainText('ohne ID')
  })

  test('setzt den Status im Formular um – „verfügbar" ist vorausgewählt', async ({
    page,
    request,
  }) => {
    await login(page)

    const zielId = `${SEED_PREFIX}001`
    const formular = page.locator('.tool-form-card')
    // Der Submit-Knopf heißt im Bearbeiten-Modus „Änderungen speichern",
    // im Anlege-Modus „Werkzeug anlegen".
    const speichern = formular.getByRole('button', { name: /speichern|anlegen/i })

    async function oeffneBearbeiten() {
      await page.getByLabel('Werkzeuge durchsuchen').fill(zielId)
      await expect(page.getByText(/^1–1 von 1 Werkzeug$/)).toBeVisible({ timeout: 5000 })
      await page
        .locator('tbody tr')
        .first()
        .getByRole('button', { name: /Weitere Aktionen für/ })
        .click()
      await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
      await expect(formular).toBeVisible()
    }

    async function statusInDerDatenbank() {
      const antwort = await request
        .get(`/api/tools/?q=${zielId}&limit=5`, { headers: authHeaders() })
        .then((response) => response.json())
      // Über die **Kennung** suchen, nicht über `items[0]`: In der Suche stehen
      // auch Werkzeuge, deren Kennung den Suchbegriff nur enthält – der erste
      // Treffer ist nicht zwingend der gesuchte (mögliche Ursache eines
      // einmaligen Ausfalls im Gesamtlauf, TASK-025b).
      const eintrag = (antwort.items as { tool_id: string | null; status: string | null }[]).find(
        (werkzeug) => werkzeug.tool_id === zielId,
      )
      return eintrag?.status ?? null
    }

    // „ohne Status" gibt es nicht mehr (DEC-080): Die Auswahl bietet nur noch die
    // fünf Zustände. Ein Datensatz ohne Status erscheint als „verfügbar".
    const vorher = (await statusInDerDatenbank()) ?? 'available'
    await oeffneBearbeiten()
    await expect(formular.getByLabel('Status')).toHaveValue(vorher)
    const auswahl = await formular
      .getByLabel('Status')
      .locator('option')
      .allTextContents()
    expect(auswahl).not.toContain('— ohne Status —')

    // 1) Status setzen
    await formular.getByLabel('Status').selectOption('maintenance')
    await speichern.click()
    await expect(page.locator('.ui-toast-stack')).toContainText('gespeichert', { timeout: 10000 })
    await expect.poll(statusInDerDatenbank, { timeout: 10_000 }).toBe('maintenance')

    // 2) Zurück auf „verfügbar": der geänderte Wert muss ankommen (der alte
    //    Fehler war, dass ein „leerer" Wert als „nicht ändern" galt).
    await oeffneBearbeiten()
    await expect(formular.getByLabel('Status')).toHaveValue('maintenance')
    await formular.getByLabel('Status').selectOption('available')
    await expect(formular.getByLabel('Status')).toHaveValue('available')
    await speichern.click()
    await expect(page.locator('.ui-toast-stack')).toContainText('gespeichert', { timeout: 10000 })
    // `poll` statt einer Momentaufnahme: im Verbund laeuft parallel ein anderer
    // Spec gegen dieselbe Datenbank, und unmittelbar nach dem Speichern kann die
    // Abfrage den Stand von vor dem Schreiben treffen.
    await expect.poll(statusInDerDatenbank, { timeout: 10_000 }).toBe('available')
  })

  test('sieht bei 1440×900 und auf dem Telefon ordentlich aus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    // Erste Datenzeile abwarten – sonst zeigt der Beleg nur Platzhalterzeilen.
    await expect(page.locator('tbody tr').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/wt-09-1440.png`, fullPage: false })

    // Gemessen: die Tabelle darf bei 1440 nicht breiter sein als ihr Bereich
    // (sonst liegt die Spalte „Aktionen" außerhalb des Sichtfelds).
    const mass = await page.evaluate(() => {
      const table = document.querySelector('table') as HTMLTableElement
      const wrapper = table.parentElement as HTMLElement
      return {
        platz: wrapper.clientWidth,
        tabelle: Math.round(table.getBoundingClientRect().width),
      }
    })
    expect(mass.tabelle).toBeLessThanOrEqual(mass.platz + 1)

    // Auf dem Telefon läuft die Tabelle seitlich – das muss angesagt werden.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText(/Tabelle seitlich scrollbar/)).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/wt-10-telefon.png`, fullPage: false })
  })
})

/**
 * Das Admin-Dashboard nutzt `getTools()` mit der neuen Antwortform (`items`,
 * `total`). Dieser Test hält fest, dass es weiterhin lädt.
 */
test.describe('Admin-Dashboard', () => {
  test('zeigt den Werkzeugbestand weiterhin an', async ({ page, request }) => {
    const login = await request.post('/api/auth/admin/login', { data: ADMIN })
    test.skip(!login.ok(), 'Admin-Konto (admin1/123) nicht vorhanden')
    const { access_token: token } = await login.json()

    await page.goto('/')
    await page.evaluate((value) => window.localStorage.setItem('token', value), token)
    await page.goto('/admin')

    await expect(page.getByText('Werkzeugbestand')).toBeVisible()
    await expect(page.getByRole('cell', { name: '01020000' }).first()).toBeVisible()
  })
})
