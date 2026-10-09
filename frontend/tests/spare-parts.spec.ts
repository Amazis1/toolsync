import { test, expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Ersatzteile: eigener Bereich mit Artikelnummer, Werk, Menge und Lagerort
 * (DEC-064, DEC-066).
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173.
 * Die Spec legt ihre Testdaten über die API an und räumt sie hinterher weg.
 * Fehlt das Admin-Konto, wird die Datei übersprungen statt rot zu werden.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/spare-parts.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
/** Eigener Nummernkreis je Lauf: kollidiert nicht mit vorhandenen Daten. */
const PREFIX = `ET-${String(Date.now()).slice(-6)}-`

let adminToken = ''
let plainToken = ''
/** Der normale Benutzer dieser Spec – angelegt in `beforeAll`. */
let plainUserId: number | null = null
let plantId = 0
let plantName = ''
let otherPlantId = 0
let otherPlantName = ''
let machineId = 0
let machineName = ''
/** Farbe der Testmaschine vor dem Lauf – wird hinterher zurückgesetzt. */
let machineColorBefore: string | null = null
/**
 * Ein **freier** Matrix-Platz für den Platz-Test: Schrank, Schublade, Platz und
 * der erwartete Code („01-A-07"). Wird im `beforeAll` gesucht, weil er vom
 * Bestand abhängt.
 */
let freierPlatz: {
  id: number
  name: string
  cabinet_id: number
  drawer_id: number
  code: string
} | null = null
const seededIds: number[] = []

function authHeaders(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/admin/login', { data: ADMIN })
  if (!login.ok()) return
  adminToken = (await login.json()).access_token

  // Ein normaler Benutzer fuer die Rechte-Pruefungen. Vorher war dafuer ein
  // **vorhandenes** Konto `1233` Voraussetzung (siehe docs/06-serial-articles.md);
  // fehlte es, uebersprang die Spec vier Tests still. Jetzt legt die Spec es
  // selbst an und raeumt es hinterher weg – wie `login.spec.ts`.
  // Die Nummer traegt Prozess- und Zeitanteil, damit parallele Laeufe sich
  // nicht in die Quere kommen.
  //
  // Achtung: Die Personalnummer muss **hier** gemerkt werden. Das Backend gibt
  // sie nie zurueck (`schemas/user.py`: „Nur für Eingabe beim Anlegen, wird nie
  // zurückgegeben") – `angelegt.personal_number` ist `undefined`, und die
  // anschliessende Anmeldung liefe mit leerer Nummer ins Leere.
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
  otherPlantName = plants[1]?.name ?? plants[0].name

  const machinesResponse = await request.get(`/api/machines?plant_id=${plantId}`, {
    headers: authHeaders(),
  })
  if (machinesResponse.ok()) {
    const machines = await machinesResponse.json()
    machineId = machines[0]?.id ?? 0
    machineName = machines[0]?.name ?? ''
  }

  // Zwei Teile mit **derselben** Artikelnummer (Lagerorte) und eines in Werk 2.
  const daten = [
    {
      article_number: `${PREFIX}4711`,
      name: 'Dichtung Ø40',
      type: 'Dichtung',
      plant_id: plantId,
      quantity: 25,
      unit: 'Stk',
      machine_id: machineId || null,
      storage_place: 'Regal B3 / Fach 2',
      description: 'NBR, hitzebeständig',
    },
    {
      article_number: `${PREFIX}4711`,
      name: 'Dichtung Ø40',
      type: 'Dichtung',
      plant_id: plantId,
      quantity: 4,
      unit: 'Stk',
      machine_id: null,
      storage_place: 'Regal B4 / Fach 1',
      description: null,
    },
    {
      article_number: `${PREFIX}8020`,
      name: 'Näherungsschalter',
      type: 'Sensor',
      plant_id: otherPlantId,
      quantity: 0,
      unit: 'Stk',
      machine_id: null,
      storage_place: null,
      description: null,
    },
  ]

  for (const teil of daten) {
    const response = await request.post('/api/spare-parts/', {
      headers: authHeaders(),
      data: teil,
    })
    if (response.ok()) seededIds.push((await response.json()).id)
  }

  // Einen **freien** Matrix-Platz suchen (kein Werkzeug, kein Ersatzteil darauf):
  // nur solche Plätze bietet das Formular an (DEC-064).
  const cabinets = await (
    await request.get(`/api/locations/cabinets?plant_id=${plantId}`, {
      headers: authHeaders(),
    })
  ).json()
  for (const cabinet of cabinets as { id: number; name: string }[]) {
    const drawers = await (
      await request.get(`/api/locations/drawers?cabinet_id=${cabinet.id}`, {
        headers: authHeaders(),
      })
    ).json()
    for (const drawer of drawers as { id: number; name: string }[]) {
      const positions = await (
        await request.get(`/api/locations/positions?drawer_id=${drawer.id}`, {
          headers: authHeaders(),
        })
      ).json()
      const frei = (
        positions as {
          id: number
          name: string
          tool_id: number | null
          spare_part?: unknown
        }[]
      ).find((position) => position.tool_id === null && !position.spare_part)
      if (frei) {
        freierPlatz = {
          id: frei.id,
          name: frei.name,
          cabinet_id: cabinet.id,
          drawer_id: drawer.id,
          code: `${cabinet.name}-${drawer.name}-${frei.name}`,
        }
        break
      }
    }
    if (freierPlatz) break
  }

  // Maschinenfarbe aus den Stammdaten setzen (und hinterher zurückgeben): die
  // Liste zeigt daraus einen Punkt neben dem Maschinennamen (DEC-067).
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

  // Auch Datensätze aufräumen, die **im Browser** entstanden sind (der
  // Anlege-Test legt eines über die Oberfläche an) – deshalb über den
  // Nummernkreis suchen und alles Passende löschen.
  const gefunden = await request.get(
    `/api/spare-parts/?search=${encodeURIComponent(PREFIX)}&limit=200`,
    { headers: authHeaders() },
  )
  if (gefunden.ok()) {
    const items = (await gefunden.json()).items as { id: number; article_number: string }[]
    for (const item of items) {
      if (item.article_number.startsWith(PREFIX)) {
        await request.delete(`/api/spare-parts/${item.id}`, { headers: authHeaders() })
      }
    }
  }

  for (const id of seededIds) {
    await request.delete(`/api/spare-parts/${id}`, { headers: authHeaders() })
  }

  // Den selbst angelegten Benutzer wieder entfernen.
  if (plainUserId !== null) {
    await request.delete(`/api/users/${plainUserId}`, { headers: authHeaders() })
  }
})

function requireSeed() {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(seededIds.length === 0, 'Testdaten konnten nicht angelegt werden – Spec übersprungen')}

/** Sitzung mit Token starten und in den Ersatzteil-Bereich wechseln. */
async function openWithToken(page: Page, token: string) {
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('token', value), token)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible()
  await page.getByRole('button', { name: 'Ersatzteile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ersatzteile', exact: true })).toBeVisible()
}

async function openAsAdmin(page: Page) {
  await openWithToken(page, adminToken)
}

/** Nach einem Begriff suchen und warten, bis nur noch passende Zeilen stehen. */
async function suche(page: Page, term: string) {
  await page.getByLabel('Ersatzteile durchsuchen').fill(term)
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

/** Anlege-Karte öffnen; der Reiter „Ersatzteil" ist offen. */
async function oeffneAnlegeKarte(page: Page) {
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
  const karte = page.locator('.tool-form-card')
  await expect(karte.getByRole('heading', { name: 'Anlegen' })).toBeVisible()
  await expect(karte.getByLabel('Artikelnummer')).toBeVisible()
  await expect(karte.getByLabel('Werk')).toBeVisible()
  return karte
}

async function oeffneZeilenmenue(page: Page, artikelnummer: string) {
  await page
    .getByRole('button', { name: `Weitere Aktionen für ${artikelnummer}` })
    .first()
    .click()
  await expect(page.getByRole('menu')).toBeVisible()
}

test.describe('Ersatzteile', () => {
  test.beforeEach(() => requireSeed())

  test('hat einen eigenen Tab; „Lager/Ersatz" gibt es nicht mehr', async ({ page }) => {
    await openAsAdmin(page)

    const nav = page.getByRole('navigation', { name: 'Bereiche wechseln' })
    await expect(nav.getByRole('button', { name: 'Ersatzteile', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Lager/Ersatz', exact: true })).toHaveCount(0)

    // Suche ohne sichtbare Beschriftung (aria-label) und Werk-Filter als Segmente.
    await expect(page.getByLabel('Ersatzteile durchsuchen')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Nach Werk filtern' })).toBeVisible()
  })

  test('listet Artikelnummer, Menge und Lagerort', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}4711`)

    // Dieselbe Artikelnummer zweimal – bei Ersatzteilen der Normalfall (DEC-064).
    await expect(page.locator('tbody tr')).toHaveCount(2)
    const zeile = page.locator('tbody tr').filter({ hasText: 'Regal B3' }).first()
    await expect(zeile).toContainText('25')
    await expect(zeile).toContainText('Stk')

    // Spaltenreihenfolge (Entscheidung des Projektinhabers): Favorit als erste
    // Spalte (wie in der Serienartikel- und Datenblattliste), dann
    // Artikelnummer, Name/Typ, Menge, Lagerort, Werk, Maschine, Aktionen.
    const kopf = (await page.locator('thead th').allInnerTexts()).map((titel) =>
      titel.trim().toUpperCase(),
    )
    expect(kopf[0]).toBe('') // Favoritenspalte: nur der Stern, kein Text
    expect(kopf.indexOf('ARTIKELNUMMER')).toBe(1)
    expect(kopf.indexOf('NAME / TYP')).toBe(kopf.indexOf('ARTIKELNUMMER') + 1)
    expect(kopf.indexOf('MENGE')).toBe(kopf.indexOf('NAME / TYP') + 1)
    expect(kopf.indexOf('LAGERORT')).toBe(kopf.indexOf('MENGE') + 1)
    expect(kopf.indexOf('WERK')).toBe(kopf.indexOf('LAGERORT') + 1)
    expect(kopf.indexOf('MASCHINE')).toBe(kopf.indexOf('WERK') + 1)
    expect(kopf.indexOf('AKTIONEN')).toBe(kopf.indexOf('MASCHINE') + 1)
  })

  test('hebt Name und Maschinenfarbe hervor wie die anderen Listen', async ({ page }) => {
    test.skip(!machineId, 'Keine Maschine im Bestand – Spec übersprungen')
    await openAsAdmin(page)
    await suche(page, 'Regal B3')

    const zeile = page.locator('tbody tr').filter({ hasText: 'Regal B3' }).first()
    // Name als eigene Kennung: Mono-Kasten mit Rahmen – wie in der Serienartikel-
    // und Datenblatt-Liste (DEC-063). Geprüft wird die Darstellung, nicht ein
    // Farbwert: Tailwind v4 rechnet Farben mit `color-mix`, `getComputedStyle`
    // liefert dann `oklab(…)`.
    const name = zeile.locator('code').filter({ hasText: 'Dichtung Ø40' })
    await expect(name).toBeVisible()
    const stil = await name.evaluate((el) => {
      const s = getComputedStyle(el)
      return { rahmen: s.borderTopWidth, familie: s.fontFamily }
    })
    expect(stil.rahmen).not.toBe('0px')
    expect(stil.familie.toLowerCase()).toContain('mono')

    // Maschine mit dem Farbpunkt aus den Stammdaten (DEC-067).
    await expect(zeile).toContainText(machineName)
    await expect(zeile.locator('span[style*="background-color"]').first()).toBeVisible()
  })

  test('Anlegen: doppelte Artikelnummer ist ein Hinweis, kein Hindernis', async ({ page }) => {
    await openAsAdmin(page)
    const karte = await oeffneAnlegeKarte(page)

    const nummer = `${PREFIX}4711`
    await karte.getByLabel('Artikelnummer').fill(nummer)
    // Der Hinweis nennt die Anzahl, blockiert aber nicht (Unterschied zum
    // Serienartikel, wo die Nummer eindeutig sein muss – DEC-056).
    await expect(karte.getByText(/gibt es hier bereits \d+×/)).toBeVisible({ timeout: 10_000 })

    await karte.getByLabel('Werk').selectOption(String(plantId))
    await karte.getByLabel('Menge').fill('7')
    await karte.getByLabel('Einheit').fill('Stk')
    // Das Freitextfeld der Gruppe „Lagerort" – die Gruppe traegt den Namen,
    // das Feld darunter heisst „Freitext" (daneben steht die Werkzeug-Matrix).
    await karte.getByLabel('Freitext').fill('Regal Z9')
    // Die Beschriftung der Beschreibung steht **über** dem Feld, nicht darin.
    await expect(karte.getByLabel('Beschreibung')).toBeVisible()
    await karte.getByLabel('Beschreibung').fill('Notiz zur Einlagerung')
    await karte.getByRole('button', { name: 'Ersatzteil anlegen' }).click()

    // **Eine** Rückmeldung: der Toast unten rechts (die Meldung im Formular ist
    // entfallen, sonst stünde derselbe Erfolg zweimal auf dem Schirm).
    await expect(page.locator('.ui-toast-stack')).toContainText(/angelegt/, {
      timeout: 10_000,
    })
    // Der Reiter bleibt offen, das Werk bleibt stehen (nächster Teil direkt).
    await expect(karte.getByLabel('Werk')).not.toHaveValue('')

    await page.getByRole('button', { name: 'Zurück' }).click()
    await suche(page, nummer)
    await expect(page.locator('tbody tr').filter({ hasText: 'Regal Z9' })).toHaveCount(1)

    // Die Beschreibung wurde wirklich gespeichert (nicht nur angezeigt).
    // Achtung: alle Testteile tragen dieselbe Artikelnummer – gesucht wird
    // deshalb der eben angelegte Datensatz über seinen Lagerort.
    const geprueft = await page.request.get(
      `/api/spare-parts/?search=${encodeURIComponent('Regal Z9')}&limit=5`,
      { headers: authHeaders() },
    )
    const eintrag = (await geprueft.json()).items.find(
      (item: { storage_place: string | null }) => item.storage_place === 'Regal Z9',
    )
    expect(eintrag?.description).toBe('Notiz zur Einlagerung')
  })

  test('Anlegen mit Matrix-Platz: der Platz-Code steht in der Liste', async ({ page }) => {
    test.skip(!freierPlatz, 'Kein freier Matrix-Platz im Bestand – Spec übersprungen')
    await openAsAdmin(page)
    const karte = await oeffneAnlegeKarte(page)

    const nummer = `${PREFIX}3300`
    await karte.getByLabel('Artikelnummer').fill(nummer)
    await karte.getByRole('combobox', { name: /Werk/ }).selectOption(String(plantId))
    // Schrank → Schublade → Platz; angeboten werden nur freie Plätze.
    await karte.getByLabel('Schrank').selectOption(String(freierPlatz!.cabinet_id))
    await karte.getByLabel('Schublade').selectOption(String(freierPlatz!.drawer_id))
    await karte.getByLabel('Platz').selectOption(String(freierPlatz!.id))
    await karte.getByRole('button', { name: 'Ersatzteil anlegen' }).click()
    await expect(page.locator('.ui-toast-stack')).toContainText(/angelegt/, {
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Zurück' }).click()
    await suche(page, nummer)
    const zeile = page.locator('tbody tr').filter({ hasText: nummer }).first()
    await expect(zeile).toContainText(freierPlatz!.code)

    // Der Platz gilt jetzt als belegt: die Platz-Abfrage liefert das Ersatzteil
    // mit – daraus zeichnet die Matrix den belegten Platz (DEC-064).
    const positionen = await (
      await page.request.get(
        `/api/locations/positions?drawer_id=${freierPlatz!.drawer_id}`,
        { headers: authHeaders() },
      )
    ).json()
    const belegt = (positionen as { id: number; spare_part?: { article_number: string } }[]).find(
      (position) => position.id === freierPlatz!.id,
    )
    expect(belegt?.spare_part?.article_number).toBe(nummer)
  })

  test('Werk ist Pflicht', async ({ page }) => {
    await openAsAdmin(page)
    const karte = await oeffneAnlegeKarte(page)

    await karte.getByLabel('Artikelnummer').fill(`${PREFIX}9999`)
    await karte.getByRole('button', { name: 'Ersatzteil anlegen' }).click()
    await expect(karte.getByText('Bitte ein Werk auswählen.')).toBeVisible()
  })

  test('Bearbeiten ändert die Menge', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}4711`)

    await oeffneZeilenmenue(page, `${PREFIX}4711`)
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    const karte = page.locator('.tool-form-card')
    await expect(karte.getByRole('heading', { name: 'Bearbeiten' })).toBeVisible()

    await karte.getByLabel('Menge').fill('42')
    await karte.getByRole('button', { name: 'Änderungen speichern' }).click()

    // Beim Bearbeiten schließt sich das Formular und die Liste ist wieder da.
    await expect(page.getByRole('heading', { name: 'Ersatzteile', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await suche(page, `${PREFIX}4711`)
    await expect(page.locator('tbody tr').filter({ hasText: '42' })).toHaveCount(1)
  })

  test('Favorit setzen und darauf filtern', async ({ page, request }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}4711`)

    // Zwei Zeilen mit derselben Artikelnummer; markiert wird die mit „Regal B3".
    const zeile = page.locator('tbody tr').filter({ hasText: 'Regal B3' }).first()
    await expect(zeile).toBeVisible()

    const stern = zeile.getByRole('button', { name: /Favorit für .* (hinzufügen|entfernen)/ })
    await expect(stern).toHaveAttribute('aria-pressed', 'false')

    await stern.click()
    // Der Stern ist gesetzt: die Form traegt die Information (`aria-pressed`),
    // nicht nur die Farbe.
    await expect(stern).toHaveAttribute('aria-pressed', 'true')

    // Die Markierung ist **global** – sie steht auch in der Datenbank (DEC-063).
    //
    // `poll` statt einer Momentaufnahme: das Umschalten ist **optimistisch**, die
    // Oberflaeche zeigt den Stern also schon, waehrend die Anfrage noch laeuft.
    // Unmittelbar nach dem Klick kann die Abfrage deshalb den alten Stand
    // treffen – im Verbund (mehr Last) ist genau das passiert.
    const markiertInDerDatenbank = async () => {
      const daten = await (
        await request.get(`/api/spare-parts/?search=${encodeURIComponent(`${PREFIX}4711`)}`, {
          headers: authHeaders(),
        })
      ).json()
      return (daten.items as { storage_place: string | null; is_favorite: boolean }[]).filter(
        (eintrag) => eintrag.is_favorite,
      )
    }
    await expect
      .poll(async () => (await markiertInDerDatenbank()).length, { timeout: 10_000 })
      .toBe(1)
    const markiert = await markiertInDerDatenbank()
    expect(markiert[0].storage_place).toBe('Regal B3 / Fach 2')

    // „Nur Favoriten" zeigt genau diese Zeile.
    await page.getByText('Nur Favoriten').click()
    await expect(page.locator('tbody tr').filter({ hasText: 'Regal B3' })).toHaveCount(1)
    await expect(page.locator('tbody tr').filter({ hasText: 'Regal B4' })).toHaveCount(0)

    // Wieder abwählen: der Filter ist dann leer.
    await page.locator('tbody tr').filter({ hasText: 'Regal B3' }).first()
      .getByRole('button', { name: /Favorit für .* entfernen/ })
      .click()
    await expect(page.getByText(/Keine Treffer für/)).toBeVisible({ timeout: 10_000 })
  })

  test('Löschen mit Bestätigung – nur als Admin', async ({ page }) => {
    await openAsAdmin(page)
    await suche(page, `${PREFIX}8020`)

    await oeffneZeilenmenue(page, `${PREFIX}8020`)
    await page.getByRole('menuitem', { name: 'Löschen' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`${PREFIX}8020`)
    await dialog.getByRole('button', { name: 'Ersatzteil löschen' }).click()

    await expect(page.getByText(/gelöscht/)).toBeVisible({ timeout: 10_000 })
    // Nach dem Löschen bleibt kein Treffer übrig. Geprüft wird der Leerzustand,
    // nicht die Zeilenzahl: die Meldung „Keine Treffer für …" steht selbst in
    // einer `<tr>` und würde einen Zeilenzähler verfälschen.
    await expect(page.getByText(/Keine Treffer für/)).toBeVisible({ timeout: 10_000 })
  })

  test('normaler Benutzer darf pflegen, aber nicht löschen', async ({ page }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    await openWithToken(page, plainToken)

    // Pflegen ist erlaubt: das Zeilenmenü bietet „Bearbeiten" an.
    await suche(page, `${PREFIX}4711`)
    await oeffneZeilenmenue(page, `${PREFIX}4711`)
    await expect(page.getByRole('menuitem', { name: 'Bearbeiten' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Löschen' })).toHaveCount(0)
  })
})

/**
 * Die Rechteprüfung serverseitig: Löschen ist Administratoren vorbehalten
 * (DEC-064 Punkt 10). Der Test läuft ohne Browser.
 */
test.describe('Ersatzteile – Rechte am Endpunkt', () => {
  test('Löschen ohne Adminrechte wird abgewiesen', async ({ request }) => {
    test.skip(!plainToken, 'Normaler Benutzer konnte nicht angelegt werden – Spec übersprungen')
    test.skip(seededIds.length === 0, 'Testdaten fehlen – Spec übersprungen')

    const response = await request.delete(`/api/spare-parts/${seededIds[0]}`, {
      headers: authHeaders(plainToken),
    })
    expect(response.status()).toBe(403)
  })

  test('die alte Route /api/storage gibt es nicht mehr', async ({ request }) => {
    test.skip(!adminToken, 'Admin-Konto nicht vorhanden – Spec übersprungen')
    const response = await request.get('/api/storage/', { headers: authHeaders() })
    expect(response.status()).toBe(404)
  })
})
