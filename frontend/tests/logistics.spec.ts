import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Werkzeug-Logistik (DEC-072/074/075/076/077) – im Browser, über den Bedienweg.
 *
 * Der Lauf geht den **ganzen Vorgang** durch, so wie ihn ein Mitarbeiter geht:
 *
 *   1. Auftrag anlegen (Fenster, Werkzeugsuche, Auswahl) und gleich verschicken
 *   2. im anderen Werk: Eingang mit Zähler → Empfang bestätigen („Alles angekommen")
 *   3. zurück schicken (eigener Auftrag mit Bezug auf den Hinweg) und verschicken
 *   4. im Heimatwerk: Eingang bestätigen → Werkzeug ist wieder zu Hause
 *   5. Werkfarbe: ganze Zeile in der Farbe des Heimatwerks, aktiver Reiter farbig
 *   6. Sperre: Werkzeuge aus dem anderen Werk sind sichtbar, aber nicht wählbar
 *
 * **Voraussetzung:** Backend **mit** `/api/transport` und mindestens zwei Werke.
 * Weil ein Transport-Auftrag ein Nachweis ist, lässt er sich nicht löschen – der
 * Lauf gehört deshalb gegen eine **Datenbank-Kopie**, nicht gegen den
 * Produktivstand (`docs/21-werkzeug-logistik.md` § 9):
 *
 *     cp backend/toolsync.db backend/toolsync-ui-test.db
 *     DATABASE_URL=sqlite+aiosqlite:///./toolsync-ui-test.db uvicorn … --port 8002
 *     PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 npx playwright test tests/logistics.spec.ts --workers=1
 */

const ADMIN = { personal_number: 'admin1', password: '123' }

interface Werk {
  id: number
  name: string
  color: string | null
}

let werke: Werk[] = []
let werk1: Werk
let werk2: Werk
let adminToken: string | null = null
let mitarbeiterId: number | null = null
let mitarbeiterNummer = ''
let werkzeugCode = ''
let auftragsNummer = ''
let rueckNummer = ''

async function adminLogin(request: APIRequestContext): Promise<string | null> {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return null
  return (await login.json()).access_token as string
}

function kopf(plantId: number) {
  return { Authorization: `Bearer ${adminToken}`, 'X-Plant-Id': String(plantId) }
}

/** `#4338ca` mit Alphakanal als `rgba(67, 56, 202, 0.14)` – so rechnet der Browser. */
function rgba(hex: string, alpha: number): string {
  const wert = hex.replace('#', '')
  const zahl = Number.parseInt(wert, 16)
  return `rgba(${(zahl >> 16) & 255}, ${(zahl >> 8) & 255}, ${zahl & 255}, ${alpha})`
}

test.beforeAll(async ({ request }) => {
  adminToken = await adminLogin(request)
  if (!adminToken) return

  const liste = await request.get('/api/locations/plants', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (liste.ok()) werke = await liste.json()
  if (werke.length < 2) return
  werk1 = werke[0]
  werk2 = werke[1]

  // Ein Testbenutzer, der sich mit Personalnummer anmeldet (das Arbeitswerk
  // wählt er selbst in der Seitenleiste – DEC-070).
  mitarbeiterNummer = `LG${String(Date.now()).slice(-6)}`
  const erstellt = await request.post('/api/users/', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      personal_number: mitarbeiterNummer,
      first_name: 'Logistik',
      last_name: 'Test',
      is_admin: false,
      is_active: true,
    },
  })
  if (erstellt.ok()) mitarbeiterId = (await erstellt.json()).id

  // Ein verfügbares Werkzeug im ersten Werk – nur damit lässt sich arbeiten.
  // Die Werkzeug-ID ist **je Heimatwerk** eindeutig (DEC-052/055), dieselbe ID
  // kann also mehrfach vorkommen; der Test braucht eine eindeutige, sonst
  // adressiert er die falsche Zeile.
  const kandidaten = await request.get('/api/transport/candidates', { headers: kopf(werk1.id) })
  if (kandidaten.ok()) {
    const liste = (await kandidaten.json()) as { tool_code: string | null; blocked: string | null }[]
    const zaehler = new Map<string, number>()
    for (const eintrag of liste) {
      if (!eintrag.tool_code) continue
      zaehler.set(eintrag.tool_code, (zaehler.get(eintrag.tool_code) ?? 0) + 1)
    }
    const frei = liste.find(
      (eintrag) =>
        !eintrag.blocked && eintrag.tool_code && zaehler.get(eintrag.tool_code) === 1,
    )
    werkzeugCode = frei?.tool_code ?? ''
  }
  auftragsNummer = `LOG-${String(Date.now()).slice(-7)}`
  rueckNummer = `${auftragsNummer}-R`
})

test.afterAll(async ({ request }) => {
  if (!adminToken || mitarbeiterId === null) return
  await request.delete(`/api/users/${mitarbeiterId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
})

test.beforeEach(async () => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(werke.length < 2, `Mindestens zwei Werke nötig (gefunden: ${werke.length})`)
  test.skip(mitarbeiterId === null, 'Testbenutzer konnte nicht angelegt werden')
  test.skip(
    !werkzeugCode,
    'Kein verfügbares Werkzeug im ersten Werk – Spec übersprungen',
  )
})

/** Anmelden als Mitarbeiter (nur Personalnummer). */
async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByLabel('Personalnummer').fill(mitarbeiterNummer)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
}

/** Arbeitswerk in der Seitenleiste wählen (DEC-070). */
async function werkWaehlen(page: Page, werk: Werk) {
  const leiste = page.getByRole('group', { name: 'Arbeitswerk wählen' })
  await leiste.getByRole('button', { name: werk.name }).click()
  await expect(leiste.getByRole('button', { name: werk.name })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

/** In den Bereich „Logistik" wechseln. */
async function logistik(page: Page) {
  await page
    .getByRole('navigation', { name: 'Bereiche wechseln' })
    .getByRole('button', { name: 'Logistik' })
    .click()
  await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
}

/** Unterbereich der Logistik (Aufträge · Eingang · Wo ist was). */
function unterbereich(page: Page, name: RegExp) {
  return page.getByRole('group', { name: 'Logistik' }).getByRole('button', { name })
}

/**
 * Kopfzeile eines Auftrags in der Liste (klappt die Positionen auf).
 *
 * Der Name beginnt mit der Auftrags-Nr.; `(?!-R)` hält den **Rück**-Auftrag
 * (`…-R`) aus dem Treffer, sonst fände `LOG-123` auch `LOG-123-R`.
 */
function auftragsKopf(page: Page, nummer: string) {
  const muster = nummer.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
  return page.getByRole('button', { name: new RegExp(`^${muster}(?!-R)`) })
}

/** Eingangs-Karte eines bestimmten Auftrags – nicht „irgendeine" Karte. */
function eingangsKarte(page: Page, nummer: string) {
  return page.getByRole('group', { name: `Auftrag ${nummer}` })
}

test.describe('Werkzeug-Logistik', () => {
  test.describe.configure({ mode: 'serial' })

  test('Auftrag anlegen und als unterwegs melden', async ({ page }) => {
    await anmelden(page)
    await werkWaehlen(page, werk1)
    await logistik(page)

    // Vorher gibt es diesen Auftrag nicht (der Lauf ist wiederholbar, ohne dass
    // alte Aufträge aus früheren Läufen die Prüfung stören).
    await expect(auftragsKopf(page, auftragsNummer)).toHaveCount(0)

    await page.getByRole('button', { name: 'Neuer Auftrag' }).click()
    const dialog = page.getByRole('dialog', { name: /Neuer Auftrag/ })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Auftrags-Nr. (Freitext)').fill(auftragsNummer)
    await dialog.getByLabel('An Werk').selectOption(String(werk2.id))
    await dialog.getByLabel(`${werkzeugCode} auswählen`).check()

    await expect(dialog.getByText(/\d+ ausgewählt:/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Als unterwegs melden' }).click()

    // Zeile mit Zustand „unterwegs" und Weg von Werk 1 nach Werk 2
    const kopf = auftragsKopf(page, auftragsNummer)
    await expect(kopf).toBeVisible()
    await expect(kopf).toContainText('unterwegs')
    await expect(kopf).toContainText(werk1.name)
    await expect(kopf).toContainText(werk2.name)

    // Nach dem Verschicken ist der Auftrag aufgeklappt: das Werkzeug steht mit
    // „ausstehend" darin, der Heimatplatz bleibt unverändert. Eine eigene Spalte
    // „Zustand" gibt es nicht mehr – sie sagte dasselbe wie „Empfang" (DEC-080).
    await expect(kopf).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(werkzeugCode, { exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'ausstehend', exact: true }).first()).toBeVisible()

    // … und die Werkzeugliste sagt, dass es unterwegs ist. Der **Ort** wechselt
    // erst mit dem bestätigten Empfang – solange bleibt das Heimatwerk stehen.
    await page
      .getByRole('navigation', { name: 'Bereiche wechseln' })
      .getByRole('button', { name: 'Werkzeuge' })
      .click()
    const werkzeugZeile = page.getByRole('row', { name: new RegExp(werkzeugCode) })
    await expect(werkzeugZeile).toContainText('unterwegs')
  })

  test('Eingang zeigt den Zähler, Empfang bestätigt alles', async ({ page }) => {
    await anmelden(page)
    await werkWaehlen(page, werk2)
    await logistik(page)

    // Zähler am Reiter „Eingang": er zählt offene Aufträge dieses Werks, nicht
    // nur „unseren" – deshalb wird hier **eine Zahl** geprüft, nicht die Eins.
    const eingangReiter = unterbereich(page, /^Eingang/)
    await expect(eingangReiter).toContainText(/\d/)
    await eingangReiter.click()
    await expect(page.getByText(/Eingang in/)).toBeVisible()

    // Unsere Karte (nicht irgendeine): die Karte ist über den Auftrag adressiert.
    const karte = eingangsKarte(page, auftragsNummer)
    await expect(karte).toContainText('1 von 1 Werkzeug noch nicht bestätigt')
    await karte.getByRole('button', { name: 'Empfang bestätigen' }).click()

    const dialog = page.getByRole('dialog', { name: /Empfang bestätigen/ })
    await expect(dialog).toContainText(werkzeugCode)
    await dialog.getByRole('button', { name: 'Alles angekommen' }).click()
    await expect(dialog).toBeHidden()

    // Der Auftrag steht danach unter „Angenommen"
    await expect(page.getByText('Angenommen')).toBeVisible()
    await expect(auftragsKopf(page, auftragsNummer).last()).toBeVisible()

    // Jetzt ist der Ort gewechselt: die Werkzeugliste nennt das Heimatwerk und
    // darunter „aktuell Werk 2" – in der Farbe des Werks, in dem es liegt.
    await page
      .getByRole('navigation', { name: 'Bereiche wechseln' })
      .getByRole('button', { name: 'Werkzeuge' })
      .click()
    const werkzeugZeile = page.getByRole('row', { name: new RegExp(werkzeugCode) })
    await expect(werkzeugZeile).toContainText(`aktuell ${werk2.name}`)
  })

  test('Zurück schicken legt einen eigenen Rück-Auftrag an', async ({ page }) => {
    await anmelden(page)
    await werkWaehlen(page, werk2)
    await logistik(page)
    await unterbereich(page, /^Eingang/).click()

    // Auftrag unter „Angenommen" aufklappen
    await auftragsKopf(page, auftragsNummer).last().click()
    await page.getByRole('button', { name: 'Zurück schicken' }).first().click()

    const dialog = page.getByRole('dialog', { name: /Zurück schicken/ })
    await expect(dialog).toContainText(werkzeugCode)
    await dialog.getByRole('button', { name: 'Rück-Auftrag anlegen' }).click()

    // Der Rück-Auftrag ist ein eigener Auftrag mit dem Kennzeichen „Rückweg"
    const rueckKopf = auftragsKopf(page, rueckNummer)
    await expect(rueckKopf).toBeVisible()
    await expect(rueckKopf).toContainText('Rückweg')
    await expect(rueckKopf).toContainText('Entwurf')

    // Der angelegte Rück-Auftrag ist gleich aufgeklappt – er soll ja verschickt werden.
    await expect(rueckKopf).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Als unterwegs melden' }).first().click()
    await expect(rueckKopf).toContainText('unterwegs')
  })

  test('Rückweg im Heimatwerk bestätigen – Werkzeug ist wieder da', async ({ request, page }) => {
    await anmelden(page)
    await werkWaehlen(page, werk1)
    await logistik(page)

    const eingangReiter = unterbereich(page, /^Eingang/)
    await expect(eingangReiter).toContainText(/\d/)
    await eingangReiter.click()
    // Die Karte des **Rück**-Auftrags (er endet auf `-R`).
    await eingangsKarte(page, rueckNummer)
      .getByRole('button', { name: 'Empfang bestätigen' })
      .click()
    const dialog = page.getByRole('dialog', { name: /Empfang bestätigen/ })
    await dialog.getByRole('button', { name: 'Alles angekommen' }).click()
    // Erst wenn das Fenster zu ist, ist die Bestätigung durch (der Toast meldet sie).
    await expect(dialog).toBeHidden()
    await expect(page.getByText(/Werkzeug bestätigt|Werkzeuge bestätigt/).first()).toBeVisible()

    // Der Server sagt: Werkzeug liegt wieder am Heimatwerk und ist frei.
    // `expect.poll` statt einer Einzelabfrage – die Antwort der Oberfläche und die
    // nächste Abfrage liegen sonst im Wettlauf.
    await expect
      .poll(
        async () => {
          const antwort = await request.get(
            `/api/transport/candidates?q=${encodeURIComponent(werkzeugCode)}`,
            { headers: kopf(werk1.id) },
          )
          if (!antwort.ok()) return `HTTP ${antwort.status()}`
          const treffer = (await antwort.json()) as {
            tool_code: string
            blocked: string | null
          }[]
          return treffer.find((eintrag) => eintrag.tool_code === werkzeugCode)?.blocked ?? null
        },
        { message: 'Werkzeug ist wieder am Heimatwerk verfügbar' },
      )
      .toBeNull()

    await expect
      .poll(async () => {
        const antwort = await request.get('/api/transport/away', { headers: kopf(werk1.id) })
        const abwesend = (await antwort.json()) as { tool_code: string | null }[]
        return abwesend.some((eintrag) => eintrag.tool_code === werkzeugCode)
      })
      .toBe(false)
  })

  test('Werkfarbe: ganze Zeile und aktiver Reiter', async ({ page }) => {
    await anmelden(page)
    await werkWaehlen(page, werk1)
    await logistik(page)

    // Der aktive Reiter trägt die Werkfarbe des **Arbeitswerks** (DEC-076).
    const auftraegeReiter = unterbereich(page, /^Aufträge$/)
    await expect(auftraegeReiter).toHaveCSS(
      'color',
      `rgb(${hexZuRgb(werk1.color ?? '#0f766e')})`,
    )

    // Ganze Zeile in der Farbe ihres Heimatwerks: 14 % in Ruhe, 20 % überfahren.
    await page.getByRole('button', { name: 'Neuer Auftrag' }).click()
    const dialog = page.getByRole('dialog', { name: /Neuer Auftrag/ })
    const zeile = dialog.locator('tr.werk-zeile', { hasText: werk1.name }).first()
    await zeile.scrollIntoViewIfNeeded()
    await expect(zeile).toHaveCSS('background-color', rgba(werk1.color ?? '#0f766e', 0.14))
    await zeile.hover()
    await expect(zeile).toHaveCSS('background-color', rgba(werk1.color ?? '#0f766e', 0.2))
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('fremde Werkzeuge werden gar nicht erst angeboten', async ({ request, page }) => {
    // Ein Werkzeug im **anderen** Werk – es darf in der Auswahl nicht auftauchen.
    const fremde = await request.get('/api/transport/candidates', { headers: kopf(werk2.id) })
    const fremdeListe = (await fremde.json()) as { tool_code: string | null }[]
    const fremderCode = fremdeListe.find((eintrag) => eintrag.tool_code)?.tool_code
    expect(fremderCode, 'Werk 2 hat ein Werkzeug, das als Gegenprobe dient').toBeTruthy()

    await anmelden(page)
    await werkWaehlen(page, werk1)
    await logistik(page)
    await page.getByRole('button', { name: 'Neuer Auftrag' }).click()

    const dialog = page.getByRole('dialog', { name: /Neuer Auftrag/ })
    await expect(dialog).toBeVisible()

    // Die Auswahl enthält **nur** Werkzeuge aus Werk 1 (DEC-081).
    await expect(dialog.getByText(`liegt in ${werk2.name}`)).toHaveCount(0)
    await expect(dialog.getByText(fremderCode as string)).toHaveCount(0)
    const auswahl = await request.get('/api/transport/candidates', { headers: kopf(werk1.id) })
    const eigene = (await auswahl.json()) as { home_position_code: string }[]
    expect(eigene.length).toBeGreaterThan(0)
  })

  test('„Werkzeug zurück" schickt fremde Werkzeuge an ihr Heimatwerk', async ({
    request,
    page,
  }) => {
    // Ausgangslage über die API: ein Werkzeug aus Werk 1 nach Werk 2 bringen
    // (Auftrag anlegen, verschicken, in Werk 2 bestätigen).
    const eigene = await request.get('/api/transport/candidates', { headers: kopf(werk1.id) })
    const kandidaten = (await eigene.json()) as {
      tool_id: number
      tool_code: string | null
      blocked: string | null
    }[]
    const werkzeug = kandidaten.find((eintrag) => !eintrag.blocked && eintrag.tool_code)
    expect(werkzeug, 'Werk 1 hat ein verfügbares Werkzeug').toBeTruthy()

    const angelegt = await request.post('/api/transport/orders', {
      headers: kopf(werk1.id),
      data: {
        order_number: `ZR-${String(Date.now()).slice(-6)}`,
        to_plant_id: werk2.id,
        items: [{ tool_id: werkzeug!.tool_id }],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const auftrag = (await angelegt.json()) as { id: number }
    await request.post(`/api/transport/orders/${auftrag.id}/send`, { headers: kopf(werk1.id) })
    await request.post(`/api/transport/orders/${auftrag.id}/receive`, {
      headers: kopf(werk2.id),
      data: {},
    })

    // Jetzt liegt das Werkzeug in Werk 2 – und steht dort unter „Werkzeug zurück".
    const geliehen = await request.get('/api/transport/borrowed', { headers: kopf(werk2.id) })
    const liste = (await geliehen.json()) as { tool_code: string | null; home_plant: { id: number } }[]
    const eintrag = liste.find((zeile) => zeile.tool_code === werkzeug!.tool_code)
    expect(eintrag, 'Werkzeug steht in der Rückgabe-Liste von Werk 2').toBeTruthy()
    expect(eintrag!.home_plant.id).toBe(werk1.id)

    await anmelden(page)
    await werkWaehlen(page, werk2)
    await logistik(page)
    await page.getByRole('button', { name: 'Werkzeug zurück' }).click()

    const dialog = page.getByRole('dialog', { name: 'Werkzeug zurück' })
    await expect(dialog).toBeVisible()
    const zeile = dialog.locator('tr', { hasText: werkzeug!.tool_code as string })
    await expect(zeile).toBeVisible()
    await expect(zeile).toContainText(werk1.name)

    // --- Suche, Auswahlhilfen, Tooltips und Escape (wie in den anderen Fenstern)
    const suche = dialog.getByLabel('Geliehene Werkzeuge durchsuchen')
    await expect(suche).toBeVisible()

    await suche.fill(werkzeug!.tool_code as string)
    await expect(zeile).toBeVisible()
    await expect(dialog.getByText(/^\d+ Treffer · \d+ davon ausgewählt$/)).toBeVisible()

    await suche.fill('gibtesnicht')
    await expect(dialog.getByText(/Kein Treffer für/)).toBeVisible()
    await suche.fill('')
    await expect(zeile).toBeVisible()

    // Auswahlhilfen: „Auswahl aufheben" sperrt den Zurückschicken-Knopf,
    // „Alle auswählen" gibt ihn wieder frei.
    const zurueckKnopf = dialog.getByRole('button', {
      name: new RegExp(`An ${werk1.name} zurück schicken`),
    })
    await dialog.getByRole('button', { name: 'Auswahl aufheben' }).click()
    await expect(zurueckKnopf).toBeDisabled()
    await dialog.getByRole('button', { name: 'Alle auswählen' }).click()
    await expect(zurueckKnopf).toBeEnabled()

    // Tooltips (title) stehen an Knopf und Werten – nicht an Eingabefeldern.
    await expect(zurueckKnopf).toHaveAttribute('title', /unterwegs/)
    await expect(dialog.getByLabel('Schließen')).toHaveAttribute('title', 'Schließen (Esc)')

    // Escape schließt – auch wenn der Fokus im Suchfeld steht.
    await suche.focus()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5000 })

    // Wieder öffnen und wirklich zurückschicken: Auftrag wird angelegt **und**
    // als unterwegs gemeldet.
    await page.getByRole('button', { name: 'Werkzeug zurück' }).click()
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('button', { name: new RegExp(`An ${werk1.name} zurück schicken`) })
      .click()
    await expect(dialog).toBeHidden({ timeout: 10_000 })

    // Danach ist es bei uns weg (unterwegs) und beim Heimatwerk im Eingang.
    await expect
      .poll(async () => {
        const danach = await request.get('/api/transport/borrowed', { headers: kopf(werk2.id) })
        const rest = (await danach.json()) as { tool_code: string | null }[]
        return rest.some((zeile2) => zeile2.tool_code === werkzeug!.tool_code)
      })
      .toBe(false)

    const eingang = await request.get(
      '/api/transport/orders?direction=in&status=sent,partly_received',
      { headers: kopf(werk1.id) },
    )
    const seite = (await eingang.json()) as {
      items: { items: { tool_code: string | null }[] }[]
    }
    expect(
      seite.items.some((auftrag2) =>
        auftrag2.items.some((zeile2) => zeile2.tool_code === werkzeug!.tool_code),
      ),
      'im Eingang von Werk 1 steht der Rück-Auftrag',
    ).toBe(true)
  })

  test('Filter nach Heimatwerk erscheint bei Werkzeugen aus zwei Werken', async ({
    request,
    page,
  }) => {
    // Ein **drittes** Werk, damit in Werk 1 Werkzeuge aus zwei Heimatwerken liegen.
    // Es bleibt in der Wegwerf-Kopie stehen – ein Werk löschen sieht das Produkt
    // nicht vor (Stammdaten werden gepflegt, nicht gelöscht).
    const neuesWerk = await request.post('/api/locations/plants', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Werk 9 (Testdaten)', color: '#a16207' },
    })
    expect(neuesWerk.ok(), 'drittes Werk anlegen').toBeTruthy()
    const werk9 = (await neuesWerk.json()) as { id: number; name: string }

    const typen = await request.get('/api/tools/types', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const typListe = (await typen.json()) as { id: number }[]
    const werkzeugCode9 = `99${String(Date.now()).slice(-6)}`
    const angelegtesWerkzeug = await request.post('/api/tools/', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        tool_id: werkzeugCode9,
        category: 'Stempel',
        status: 'available',
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: '5,00',
        plant_id: werk9.id,
        tool_type_id: typListe[0].id,
      },
    })
    expect(angelegtesWerkzeug.ok(), 'Werkzeug in Werk 9 anlegen').toBeTruthy()
    const werkzeug9 = (await angelegtesWerkzeug.json()) as { id: number }

    // Von Werk 9 nach Werk 1 bringen: anlegen, verschicken, in Werk 1 bestätigen.
    const auftrag = await request.post('/api/transport/orders', {
      headers: kopf(werk9.id),
      data: {
        order_number: `W9-${String(Date.now()).slice(-6)}`,
        to_plant_id: werk1.id,
        items: [{ tool_id: werkzeug9.id }],
      },
    })
    const auftragId = ((await auftrag.json()) as { id: number }).id
    await request.post(`/api/transport/orders/${auftragId}/send`, { headers: kopf(werk9.id) })
    await request.post(`/api/transport/orders/${auftragId}/receive`, {
      headers: kopf(werk1.id),
      data: {},
    })

    await anmelden(page)
    await werkWaehlen(page, werk1)
    await logistik(page)
    await page.getByRole('button', { name: 'Werkzeug zurück' }).click()

    const dialog = page.getByRole('dialog', { name: 'Werkzeug zurück' })
    const filter = dialog.getByRole('group', { name: 'Nach Heimatwerk filtern' })
    await expect(filter).toBeVisible()
    await expect(filter.getByRole('button', { name: /^Alle \(/ })).toBeVisible()

    // Nur die Werkzeuge aus Werk 9 bleiben stehen.
    await filter.getByRole('button', { name: werk9.name }).click()
    await expect(dialog.getByText(werkzeugCode9)).toBeVisible()
    await expect(dialog.getByText(`liegt in`)).toHaveCount(0)
    await expect(dialog.getByText(/^1 Treffer · 1 davon ausgewählt$/)).toBeVisible()

    // Und zurück auf „Alle" stehen wieder mehrere Zeilen.
    await filter.getByRole('button', { name: /^Alle \(/ }).click()
    await expect(dialog.getByText(/^\d+ Treffer · \d+ davon ausgewählt$/)).toBeVisible()
  })
  test('Logistik steht als eigener Knopf neben den Reitern (DEC-086)', async ({ page }) => {
    await anmelden(page)
    const nav = page.getByRole('navigation', { name: 'Bereiche wechseln' })

    // Die Stammdaten-Reiter stehen in ihrer Gruppe – „Logistik" nicht.
    const reiter = nav.locator('.ui-tabs')
    await expect(reiter.getByRole('button', { name: 'Werkzeuge' })).toBeVisible()
    await expect(reiter.getByRole('button', { name: 'Logistik' })).toHaveCount(0)

    // Der eigene Knopf ist sichtbar, hat eine eigene Form und ein Zeichen.
    const knopf = nav.getByRole('button', { name: 'Logistik' })
    await expect(knopf).toBeVisible()
    await expect(knopf).toHaveClass(/tab-logistik/)
    await expect(knopf.locator('svg')).toHaveCount(1)

    // Rechts davon steht der Trennstrich, links die Reiter – er ist also getrennt.
    const lage = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label='Bereiche wechseln']")
      const gruppe = nav?.querySelector('.ui-tabs')
      const strich = nav?.querySelector("span[aria-hidden='true'].w-px")
      const pille = nav?.querySelector('.tab-logistik')
      if (!gruppe || !strich || !pille) return null
      const g = gruppe.getBoundingClientRect()
      const p = pille.getBoundingClientRect()
      return {
        abstand: Math.round(p.left - g.right),
        strichHoehe: Math.round(strich.getBoundingClientRect().height),
      }
    })
    expect(lage, 'Trennstrich und Abstand sind messbar').not.toBeNull()
    expect(lage!.abstand, 'Logistik steht mit Abstand neben den Reitern').toBeGreaterThan(8)
    expect(lage!.strichHoehe).toBeGreaterThan(10)

    // Im aktiven Zustand trägt er die Fläche der Werkfarbe. `expect.poll`:
    // Der Farbwechsel ist animiert (0,18 s) – ein einzelner Messwert läge sonst
    // mitten im Übergang und meldete noch die Ruhefarbe.
    await knopf.click()
    await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
    await expect(knopf).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const pille = document.querySelector('.tab-logistik')
            const werk = getComputedStyle(document.documentElement)
              .getPropertyValue('--werk')
              .trim()
            const zahl = Number.parseInt(werk.replace('#', ''), 16)
            const soll = `rgb(${(zahl >> 16) & 255}, ${(zahl >> 8) & 255}, ${zahl & 255})`
            return pille ? getComputedStyle(pille).backgroundColor === soll : false
          }),
        { message: 'aktive Pille trägt die Werkfarbe als Fläche' },
      )
      .toBe(true)
  })

  test('Auftragsköpfe stehen untereinander in denselben Spalten (DEC-086)', async ({
    page,
    request,
  }) => {
    // Zwei leere Entwürfe als Vergleichszeilen – unabhängig davon, ob der
    // serielle Teil vorher Aufträge angelegt hat (ein Einzellauf dieser Prüfung
    // hätte sonst gar keine Zeile zum Vergleichen).
    for (const index of [1, 2]) {
      await request.post('/api/transport/orders', {
        headers: kopf(werk1.id),
        data: {
          order_number: `SP-${index}-${String(Date.now()).slice(-5)}`,
          to_plant_id: werk2.id,
          items: [],
        },
      })
    }

    await anmelden(page)
    await logistik(page)
    await expect(page.locator('.kopf-auftrag').first()).toBeVisible({ timeout: 10_000 })

    const links = await page.evaluate(() =>
      [...document.querySelectorAll('.kopf-auftrag')].map((kopf) =>
        [...kopf.children].slice(0, 4).map((teil) => Math.round(teil.getBoundingClientRect().left)),
      ),
    )
    expect(links.length, 'mehrere Aufträge zum Vergleichen').toBeGreaterThan(1)
    for (const zeile of links) {
      for (const [index, x] of zeile.entries()) {
        expect(Math.abs(x - links[0][index]), `Spalte ${index + 1} liegt bündig`).toBeLessThanOrEqual(1)
      }
    }

    // Der Eingang nutzt dieselben zwei festen Spalten (Nr, Zustand).
    await unterbereich(page, /^Eingang/).click()
    const eingang = await page.evaluate(() => {
      const kopf = document.querySelector('.kopf-eingang')
      if (!kopf) return null
      return [...kopf.children].slice(0, 2).map((teil) => Math.round(teil.getBoundingClientRect().left))
    })
    if (eingang) {
      expect(eingang[0]).toBe(links[0][0])
      expect(eingang[1]).toBe(links[0][1])
    }
  })
})

/** `#4338ca` → `67, 56, 202` (für `toHaveCSS('color', …)`). */
function hexZuRgb(hex: string): string {
  const wert = hex.replace('#', '')
  const zahl = Number.parseInt(wert, 16)
  return `${(zahl >> 16) & 255}, ${(zahl >> 8) & 255}, ${zahl & 255}`
}
