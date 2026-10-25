import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Fenster (Dialoge): Esc, Hinweiszeile und Öffnungs-Übergang (DEC-087).
 *
 * Der Auftrag des Inhabers war: „Alle Modal-Fenster sollen mit ‚ESC' geschlossen
 * werden können und ein Hinweis soll dort auch sein wie im Anlegeformular …
 * Kopfzeilen etc. sollen beim Aufmachen nicht aufplatzen, sondern eine Art
 * Animation haben."
 *
 * Deshalb prüft diese Spec **an jedem erreichbaren Fenster** dieselben drei
 * Dinge:
 *
 *   1. Der Hinweis „Mit Esc schließen." steht unter der Kopfzeile.
 *   2. Esc schließt das Fenster (und der Vorgang wird **nicht** ausgeführt).
 *   3. Das Fenster fährt ein (`.modal-panel` → `animation-name: panel-in`).
 *
 * Sie schreibt **nichts** in die Datenbank: jedes Fenster wird ohne Absenden
 * geschlossen. Ausführen wie die übrigen Specs gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/modals.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

let adminToken: string | null = null
let werke: { id: number; name: string }[] = []

async function adminLogin(request: APIRequestContext): Promise<string | null> {
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
  if (liste.ok()) werke = await liste.json()
})

test.beforeEach(() => {
  test.skip(!adminToken, 'Admin-Konto (admin1/123) nicht vorhanden – Spec übersprungen')
  test.skip(werke.length === 0, 'Kein Werk vorhanden – Spec übersprungen')
})

/** Anmelden als Admin (Personalnummer + Passwort). */
async function anmelden(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible({
    timeout: 30_000,
  })
}

/** Arbeitswerk in der Seitenleiste wählen (DEC-070). */
async function werkWaehlen(page: Page, name: string) {
  const leiste = page.getByRole('group', { name: 'Arbeitswerk wählen' })
  await leiste.getByRole('button', { name }).click()
  await expect(leiste.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
}

async function logistik(page: Page) {
  await page
    .getByRole('navigation', { name: 'Bereiche wechseln' })
    .getByRole('button', { name: 'Logistik' })
    .click()
  await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
}

/**
 * Prüft, was jedes Fenster gemeinsam hat: das „Esc"-Kürzel neben dem ✕ und den
 * Öffnungs-Übergang. Danach wird mit Esc geschlossen.
 */
async function pruefeUndSchliesse(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  bild?: string,
) {
  await expect(dialog).toBeVisible()
  if (bild) await page.screenshot({ path: `${SHOTS}/${bild}.png` })

  // 1. Das Kürzel steht **neben** dem ✕ – nicht als eigener Hinweisblock.
  //    (Der Block nahm zu viel Platz weg: „einfach neben dem Kreuz".)
  await expect(dialog.locator('kbd')).toHaveText('Esc')
  const lage = await dialog.evaluate((el) => {
    const schliessen = el.querySelector('[aria-label="Schließen"]') as HTMLElement | null
    const kuerzel = el.querySelector('kbd') as HTMLElement | null
    if (!schliessen || !kuerzel) return { lage: 'fehlt' }
    const k = kuerzel.getBoundingClientRect()
    const s = schliessen.getBoundingClientRect()
    return {
      // Der Wirt des Kürzels (`.tip-wirt`) ist das Geschwister des ✕ – so steht
      // beides in derselben Reihe. Der Tooltip selbst liegt nicht im Fenster,
      // sondern als eigene Ebene an <body> (DEC-088).
      lage:
        kuerzel.closest('.tip-wirt')?.parentElement === schliessen.parentElement
          ? 'daneben'
          : 'woanders',
      // gleiche Zeile: die Mitten liegen auf derselben Höhe
      zeile: Math.round(Math.abs(k.top + k.height / 2 - (s.top + s.height / 2))),
      // und das Kürzel steht links vom ✕
      links: k.right <= s.left,
      hoeheKopf: Math.round((schliessen.closest('div') as HTMLElement).getBoundingClientRect().height),
    }
  })
  expect(lage.lage).toBe('daneben')
  expect(lage.zeile ?? 99).toBeLessThanOrEqual(2)
  expect(lage.links).toBe(true)

  // Kein Hinweisblock mehr im Fenster – das war die Beschwerde.
  await expect(dialog.locator('.ui-alert-info')).toHaveCount(0)

  // 2. Das Fenster fährt ein, statt aufzuplatzen (nur ohne reduzierende Bewegung).
  const animationen = await dialog.evaluate((el) => {
    const panel = el.querySelector('.modal-panel')
    return {
      panel: panel ? getComputedStyle(panel).animationName : null,
      overlay: getComputedStyle(el).animationName,
    }
  })
  expect(animationen.panel).toBe('panel-in')
  expect(animationen.overlay).toBe('overlay-in')


  // Das Fenster passt trotz Hinweiszeile vollständig in den Bildschirm.
  // `expect.poll`: während der Einfahrt ist das Fenster noch ein paar Pixel
  // unterwegs – gemessen wird der Ruhezustand.
  const hoehe = page.viewportSize()?.height ?? 0
  await expect
    .poll(
      async () => {
        const rahmen = await dialog.locator('.modal-panel').first().boundingBox()
        if (!rahmen) return 999
        return rahmen.y < 0 ? 999 : Math.max(0, Math.round(rahmen.y + rahmen.height - hoehe))
      },
      { message: 'Fenster liegt vollständig im Bild' },
    )
    .toBe(0)

  // 3. Esc schließt.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}

/** In die Werkzeugliste wechseln und die erste Zeile liefern. */
async function erstesWerkzeug(page: Page) {
  await page
    .getByRole('navigation', { name: 'Bereiche wechseln' })
    .getByRole('button', { name: 'Werkzeuge' })
    .click()
  await expect(page.getByRole('table')).toBeVisible()
  return page.locator('tbody tr').first()
}

test.describe('Fenster – Esc, Hinweis, Übergang', () => {
  test('Logistik: „Neuer Auftrag" und „Werkzeug zurück"', async ({ page }) => {
    await anmelden(page)
    await werkWaehlen(page, werke[0].name)
    await logistik(page)

    await page.getByRole('button', { name: 'Neuer Auftrag' }).click()
    await pruefeUndSchliesse(
      page,
      page.getByRole('dialog', { name: /Neuer Auftrag/ }),
      'fenster-01-neuer-auftrag',
    )

    await page.getByRole('button', { name: 'Werkzeug zurück' }).click()
    await pruefeUndSchliesse(
      page,
      page.getByRole('dialog', { name: /^Werkzeug zurück/ }),
      'fenster-02-werkzeug-zurueck',
    )
  })

  test('Bewegung: das Ausleih-Fenster', async ({ page }) => {
    await anmelden(page)
    const zeile = await erstesWerkzeug(page)

    // „Ausleihen" bietet das Zeilenmenü nur für Werkzeuge, die nicht schon
    // ausgeliehen sind – ohne ein solches Werkzeug prüft der Test nichts.
    await zeile.getByRole('button', { name: /Weitere Aktionen für/ }).click()
    const ausleihen = page.getByRole('menuitem', { name: 'Ausleihen' })
    test.skip((await ausleihen.count()) === 0, 'Kein ausleihbares Werkzeug in der Liste')
    await ausleihen.click()

    await pruefeUndSchliesse(
      page,
      page.getByRole('dialog', { name: /Werkzeug ausleihen/ }),
      'fenster-03-ausleihen',
    )
  })

  test('Bestätigungsdialog: Esc bricht ab, gelöscht wird nichts', async ({ page, request }) => {
    await anmelden(page)
    const zeile = await erstesWerkzeug(page)
    const werkzeugId = (await zeile.locator('code').first().innerText()).trim()

    await zeile.getByRole('button', { name: /Weitere Aktionen für/ }).click()
    await page.getByRole('menuitem', { name: 'Löschen' }).click()

    const dialog = page.getByRole('dialog', { name: /löschen\?/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('kbd')).toHaveText('Esc')
    await page.screenshot({ path: `${SHOTS}/fenster-04-bestaetigung.png` })

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // Der Datensatz lebt noch – Esc ist ein Abbruch, keine stille Löschung.
    const antwort = await request.get(`/api/tools/?q=${encodeURIComponent(werkzeugId)}&limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(antwort.ok()).toBe(true)
    const seite = (await antwort.json()) as { items: { tool_id: string | null }[] }
    expect(seite.items.some((eintrag) => eintrag.tool_id === werkzeugId)).toBe(true)
  })

  test('Anlegeformular: dasselbe Esc-Kürzel wie in den Fenstern', async ({ page }) => {
    await anmelden(page)
    await erstesWerkzeug(page)

    await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
    const karte = page.locator('.tool-form-card')
    await expect(karte.getByRole('heading', { name: 'Anlegen' })).toBeVisible()
    // Eine Taste, eine Darstellung: hier stand vorher ein Abzeichen „⌨ Esc".
    await expect(karte.locator('kbd')).toHaveText('Esc')
    // Der erklärende Satz hängt als Tooltip an der Taste (DEC-088).
    await karte.locator('kbd').hover()
    await expect(page.getByRole('tooltip')).toContainText('Esc-Taste schließen')

    // Esc führt zurück in die Liste – wie „Zurück".
    await page.keyboard.press('Escape')
    await expect(karte).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('Datei-Fenster: Kürzel steht auch dort, Esc schließt', async ({ page, request }) => {
    // Welches Datenblatt? Die Liste ist beim Öffnen noch leer, und ein Klick auf
    // die Platzhalter-Zeile („Anlegen dürfen Administratoren") öffnet nichts.
    // Deshalb wird ein vorhandenes Datenblatt gesucht und seine Zeile abgewartet.
    const antwort = await request.get('/api/data-sheets/?limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const seite = (await antwort.json()) as {
      items: { tool_id: string | null; name: string | null }[]
    }
    const blatt = seite.items.find((eintrag) => eintrag.tool_id || eintrag.name)
    test.skip(!blatt, 'Kein Datenblatt vorhanden – Spec übersprungen')
    const suchbegriff = (blatt!.tool_id ?? blatt!.name) as string

    await anmelden(page)
    await page
      .getByRole('navigation', { name: 'Bereiche wechseln' })
      .getByRole('button', { name: 'Datenblätter' })
      .click()
    await expect(page.getByLabel('Datenblätter durchsuchen')).toBeVisible()

    await page.getByLabel('Datenblätter durchsuchen').fill(suchbegriff)
    const zeile = page.locator('tbody tr', { hasText: suchbegriff }).first()
    await expect(zeile).toBeVisible({ timeout: 15_000 })
    await zeile.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Auch das Datei-Fenster trägt das Kürzel – hier neben „Schließen".
    await expect(dialog.locator('kbd')).toHaveText('Esc')
    await page.screenshot({ path: `${SHOTS}/fenster-05-datei-fenster.png` })

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
