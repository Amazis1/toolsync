import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * Sitzung: Rauswurf und Wieder-Anmelden (Regression zu TASK-013).
 *
 * Auslöser war dieser Bericht: „Sobald ich auf einen Artikel klicke, werde ich
 * ausgeloggt (‚Sitzung abgelaufen‘) – und danach kann ich mich nicht mehr
 * anmelden, erst nach Strg+F5.“
 *
 * Zwei Ursachen, beide hier abgesichert:
 *
 * 1. Der Heartbeat (`useSessionHeartbeat`) holte den erneuerten Token
 *    (`X-New-Token`) nicht ab. Wer nur las und scrollte, hielt deshalb einen
 *    längst abgelaufenen Token – der Klick auf einen Artikel lief in eine 401
 *    und beendete die Sitzung.
 *
 * 2. Eine **verspätete** 401 einer alten Anfrage (z. B. ein großer
 *    Einrichteplan, der noch lädt) beendete die gerade neu angemeldete Sitzung
 *    sofort wieder. Der Nutzer sah ohne Fehlermeldung erneut die Anmeldeseite –
 *    und kam ohne Neuladen der Seite nicht hinein.
 *
 * Voraussetzung: Backend auf 127.0.0.1:8000, Dev-Server auf 127.0.0.1:5173.
 *
 * Ausführen im frontend-Verzeichnis:
 *
 *     npx playwright test tests/session-expiry.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }

/**
 * Zeitlimit für die Prüfungen.
 *
 * Die Spec läuft parallel gegen den Vite-Entwicklungsserver; beim ersten Aufruf
 * übersetzt er die Module erst. Die Vorgabe von 5 s ist dabei zu knapp – ein
 * Fehlschlag wäre dann ein Messfehler und kein Fehler der Anwendung.
 */
const ZEIT = { timeout: 20_000 }

/**
 * Abgelaufener, aber **korrekt signierter** Token – so sieht der Zustand aus,
 * den ein Nutzer nach 30 Minuten ohne Aktivität hat. Das Secret wird aus
 * `backend/.env` gelesen; fehlt es, wird die Spec übersprungen.
 */
function abgelaufenerToken(): string | null {
  return tokenMitLaufzeit(-180)
}

/**
 * Korrekt signierter Token mit **kurzer** Restlaufzeit (`sekunden` ab jetzt,
 * negativ = abgelaufen). Das Secret wird aus `backend/.env` gelesen; fehlt es,
 * wird die Spec übersprungen.
 */
function tokenMitLaufzeit(sekunden: number): string | null {
  let env: string
  try {
    env = readFileSync('../backend/.env', 'utf8')
  } catch {
    return null
  }
  const secret = /^\s*JWT_SECRET_KEY\s*=\s*(.+)$/m.exec(env)?.[1]?.trim() ?? ''
  if (!secret) return null

  const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const kopf = base64url({ alg: 'HS256', typ: 'JWT' })
  const rumpf = base64url({
    sub: ADMIN.personal_number,
    is_admin: true,
    exp: Math.floor(Date.now() / 1000) + sekunden,
  })
  const signatur = createHmac('sha256', secret).update(`${kopf}.${rumpf}`).digest('base64url')
  return `${kopf}.${rumpf}.${signatur}`
}

/** Restlaufzeit des gespeicherten Tokens in Sekunden (`null`, wenn unlesbar). */
async function restlaufzeit(page: import('@playwright/test').Page): Promise<number | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.exp === 'number'
      ? payload.exp - Math.floor(Date.now() / 1000)
      : null
  } catch {
    return null
  }
}

/** Anmelden als Admin und in den Serienartikel-Bereich wechseln. */
async function anmeldenUndListeOeffnen(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
  await page.getByLabel('Passwort').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Serienartikel', exact: true }).click()
  await expect(page.locator('tbody tr').nth(1)).toBeVisible(ZEIT)
}

/**
 * Zählt die gerade laufenden Anfragen der Seite.
 *
 * Wird gebraucht, um einen bestimmten Zustand herzustellen: Solange noch eine
 * Antwort unterwegs ist, kann sie den eingesetzten Token überschreiben.
 */
function anfragenZaehler(page: import('@playwright/test').Page) {
  let offen = 0
  const start = () => {
    offen += 1
  }
  const ende = () => {
    // Nicht unter 0 zählen: Anfragen, die vor dem Anhängen des Zählers begonnen
    // haben, melden ihr Ende trotzdem noch.
    offen = Math.max(0, offen - 1)
  }
  page.on('request', start)
  page.on('requestfinished', ende)
  page.on('requestfailed', ende)
  return {
    offen: () => offen,
    stop: () => {
      page.off('request', start)
      page.off('requestfinished', ende)
      page.off('requestfailed', ende)
    },
  }
}

/**
 * Sitzung „ablaufen lassen“: einen Token mit kurzer/abgelaufener Laufzeit in den
 * Speicher legen.
 *
 * Der eingesetzte Token muss **halten**. Eine Antwort, die noch unterwegs ist,
 * trägt den vom Backend erneuerten Token (`X-New-Token`) und ersetzt ihn sonst
 * wieder – der Test liefe dann mit einer gültigen Sitzung weiter und würde
 * scheinbar grundlos fehlschlagen. Deshalb wird gewartet, bis keine Anfrage mehr
 * läuft, und der Token erst dann gesetzt und gehalten.
 *
 * (`page.waitForLoadState('networkidle')` hilft hier nicht: das Ereignis ist
 * nach dem Laden der Seite längst gefeuert, der Aufruf kehrt sofort zurück.)
 */
async function sitzungAblaufenLassen(page: import('@playwright/test').Page, token: string) {
  const zaehler = anfragenZaehler(page)
  try {
    await expect
      .poll(() => zaehler.offen(), { timeout: 30_000, intervals: [250] })
      .toBe(0)
    await expect
      .poll(
        async () => {
          await page.evaluate((value) => window.localStorage.setItem('token', value), token)
          await page.waitForTimeout(1000)
          const gespeichert = await page.evaluate(() => localStorage.getItem('token'))
          return `${gespeichert}#${zaehler.offen()}`
        },
        { timeout: 30_000, intervals: [250] },
      )
      .toBe(`${token}#0`)
  } finally {
    zaehler.stop()
  }
}

/**
 * Zeile eines Artikels in der Liste finden – **über den Zeileninhalt**, nicht
 * über das Suchfeld. Wichtig: Tippen in die Suche löst eine eigene Anfrage aus;
 * mit abgelaufener Sitzung würde die schon abmelden (richtig, aber hier nicht
 * das, was geprüft werden soll).
 */
function zeile(page: import('@playwright/test').Page, nummer: string) {
  return page.locator('tbody tr').filter({ hasText: nummer }).first()
}

/**
 * Artikelzeile öffnen und prüfen, dass die Vorschau wirklich lädt.
 * Gibt zurück, wie viele 401-Antworten dabei auftraten.
 */
async function zeileOeffnen(
  page: import('@playwright/test').Page,
  nummer: string,
): Promise<number> {
  let fehlgeschlagen = 0
  const zaehlen = (res: { status: () => number }) => {
    if (res.status() === 401) fehlgeschlagen += 1
  }
  page.on('response', zaehlen)

  const reihe = zeile(page, nummer)
  await expect(reihe).toBeVisible(ZEIT)
  await reihe.click()
  await expect(page.getByRole('dialog')).toBeVisible(ZEIT)
  // Der Plan läuft im iframe (Blob-URL) – er ist wirklich geladen.
  await expect(page.getByRole('dialog').locator('iframe')).toBeVisible(ZEIT)

  page.off('response', zaehlen)
  return fehlgeschlagen
}

/** Zeile anklicken – ohne Erwartung an das Datei-Fenster (Ablauf-Fall). */
async function zeileAnklicken(page: import('@playwright/test').Page, nummer: string) {
  const reihe = zeile(page, nummer)
  await expect(reihe).toBeVisible(ZEIT)
  await reihe.click()
}

test.describe('Sitzung', () => {
  test('Aktivität erneuert den Token im Browser (Heartbeat übernimmt X-New-Token)', async ({
    page,
  }) => {
    const kurz = tokenMitLaufzeit(70)
    test.skip(!kurz, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await page.goto('/')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
    await page.getByLabel('Passwort').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByRole('navigation', { name: 'Bereiche wechseln' })).toBeVisible({
      timeout: 30_000,
    })

    // Einen Token mit nur 70 Sekunden Restlaufzeit einsetzen. So ist eindeutig
    // messbar, ob der Heartbeat den vom Backend erneuerten Token übernimmt:
    // ohne die Korrektur blieb der kurzlebige Token im Speicher stehen.
    await sitzungAblaufenLassen(page, kurz!)
    expect(await restlaufzeit(page)).toBeLessThan(120)

    // Aktivität auslösen, bis die Sitzung wieder volle Laufzeit hat. Der
    // Heartbeat ist auf eine Anfrage je Minute gedrosselt – deshalb wird die
    // Bewegung wiederholt, statt auf einen festen Zeitpunkt zu vertrauen.
    await expect
      .poll(
        async () => {
          await page.mouse.move(400 + Math.floor(Math.random() * 60), 300)
          return restlaufzeit(page)
        },
        { timeout: 80_000, intervals: [1000] },
      )
      .toBeGreaterThan(600)
  })

  test('jeder Serienartikel öffnet sich ohne Abmeldung (auch 659942)', async ({ page }) => {
    await anmeldenUndListeOeffnen(page)

    for (const nummer of ['555', '659942', '66523']) {
      const fehlgeschlagen = await zeileOeffnen(page, nummer)

      // Kein Rauswurf: der Hinweis darf nicht erscheinen, die Sitzung bleibt.
      await expect(page.getByText('Sitzung abgelaufen. Bitte melde dich neu an.')).toBeHidden()
      await expect(page.getByLabel('Personalnummer')).toBeHidden()
      await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull()
      expect(fehlgeschlagen, `${nummer}: keine 401 beim Öffnen`).toBe(0)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()
    }
  })

  test('659942: nach dem Ablauf bleibt die Neuanmeldung bestehen und die Vorschau öffnet wieder', async ({
    page,
  }) => {
    const token = abgelaufenerToken()
    test.skip(!token, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await anmeldenUndListeOeffnen(page)
    await sitzungAblaufenLassen(page, token!)
    await zeileAnklicken(page, '659942')

    // Abmeldung mit Hinweis (die Sitzung war wirklich abgelaufen) …
    await expect(page.getByText('Sitzung abgelaufen. Bitte melde dich neu an.')).toBeVisible(ZEIT)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()

    // … neu anmelden: die Sitzung muss bestehen bleiben und die Vorschau
    // des Artikels von selbst wieder aufgehen (der Auftrag bleibt erhalten).
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
    await page.getByLabel('Passwort').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
    await expect(page.getByRole('dialog').locator('iframe')).toBeVisible(ZEIT)
    await expect(page.getByLabel('Personalnummer')).toBeHidden()

    // Kurz warten: auch danach bleibt die Sitzung bestehen.
    await page.waitForTimeout(4000)
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
    await expect(page.getByLabel('Personalnummer')).toBeHidden()
  })

  test('am Rand des Ablaufs geht keine Datei-Anfrage mit totem Token hinaus', async ({ page }) => {
    // Bewusst knapp: nur bei weniger als 5 Sekunden Restlaufzeit fragt die App
    // vor der Anfrage beim Server nach (TOKEN_RENEW_MARGIN_MS).
    const kurz = tokenMitLaufzeit(4)
    test.skip(!kurz, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    let dateiAnfragen = 0
    let dateiAbgelehnt = 0
    const zaehlen = (res: { url: () => string; status: () => number }) => {
      if (!res.url().includes('/files/')) return
      dateiAnfragen += 1
      if (res.status() === 401) dateiAbgelehnt += 1
    }
    page.on('response', zaehlen)

    await anmeldenUndListeOeffnen(page)
    await sitzungAblaufenLassen(page, kurz!)
    await zeileAnklicken(page, '555')
    await page.waitForTimeout(3000)

    // Zwei Ausgänge sind richtig: Die Sitzung wurde rechtzeitig erneuert (die
    // Vorschau lädt) oder sie war beim Klick schon vorbei (saubere Abmeldung mit
    // Hinweis). Falsch wäre nur, Dateien mit einem abgelaufenen Token anzufragen.
    expect(dateiAbgelehnt, 'keine abgelehnte Datei-Anfrage').toBe(0)
    const eingeloggt = await page.getByRole('button', { name: 'Abmelden' }).isVisible()
    const hinweis = await page.getByText('Sitzung abgelaufen. Bitte melde dich neu an.').isVisible()
    expect(eingeloggt || hinweis, 'Zustand ist eindeutig').toBe(true)
    if (eingeloggt) {
      expect(dateiAnfragen, 'Vorschau wurde geladen').toBeGreaterThan(0)
      expect(await restlaufzeit(page)).toBeGreaterThan(600)
    }

    page.off('response', zaehlen)
  })

  test('warnt 5 Minuten vor dem Ablauf und verlängert auf Klick', async ({ page }) => {
    // 4 Minuten Restlaufzeit: innerhalb der Warnschwelle (TOKEN_WARN_MARGIN_MS).
    const kurz = tokenMitLaufzeit(4 * 60)
    test.skip(!kurz, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await anmeldenUndListeOeffnen(page)
    await sitzungAblaufenLassen(page, kurz!)

    // Der Text der Warnung ist eindeutig – das Badge im Seitenbalken zeigt
    // ebenfalls "Sitzung läuft in X Min ab" und würde sonst mitgetroffen.
    const warnung = page.getByText(/Sitzung läuft in \d+ Min ab\. Jede Eingabe verlängert sie/)
    await expect(warnung).toBeVisible(ZEIT)

    await page.getByRole('button', { name: 'Sitzung verlängern' }).click()

    // Die Sitzung hat wieder volle Laufzeit, die Warnung verschwindet.
    await expect(warnung).toBeHidden(ZEIT)
    expect(await restlaufzeit(page)).toBeGreaterThan(600)
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
  })

  test('ein Serverfehler beim Sitzungs-Check meldet nicht ab', async ({ page }) => {
    // 4 Minuten Restlaufzeit: die Warnung erscheint, der Knopf ist da.
    const kurz = tokenMitLaufzeit(4 * 60)
    test.skip(!kurz, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await anmeldenUndListeOeffnen(page)

    // /auth/me antwortet mit 500 – wie ein kurzer Aussetzer des Backends.
    // Nur eine 401 darf abmelden; ein Serverfehler niemals.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    )

    await sitzungAblaufenLassen(page, kurz!)
    await expect(
      page.getByText(/Sitzung läuft in \d+ Min ab\. Jede Eingabe verlängert sie/),
    ).toBeVisible(ZEIT)

    await page.getByRole('button', { name: 'Sitzung verlängern' }).click()
    await page.waitForTimeout(2000)

    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
    await expect(page.getByLabel('Personalnummer')).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull()
  })

  test('ein offenes Plan-Fenster hält die Sitzung am Leben', async ({ page }) => {
    // Ereignisse im Plan-Fenster (Chrome-PDF im iframe) erreichen die Seite
    // nicht. Deshalb schickt die App dort ein Lebenszeichen – hier wird gewartet,
    // bis es eintrifft (Abstand KEEP_ALIVE_MS = 60 s).
    test.setTimeout(180_000)
    const kurz = tokenMitLaufzeit(70)
    test.skip(!kurz, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await anmeldenUndListeOeffnen(page)
    const fehlgeschlagen = await zeileOeffnen(page, '555')
    expect(fehlgeschlagen, 'keine 401 beim Öffnen').toBe(0)

    // Jetzt die Sitzung künstlich altern lassen – bei offenem Fenster.
    await sitzungAblaufenLassen(page, kurz!)
    expect(await restlaufzeit(page)).toBeLessThan(120)

    // Innerhalb des Lebenszeichen-Abstands muss die volle Laufzeit zurückkommen.
    await expect
      .poll(() => restlaufzeit(page), { timeout: 90_000, intervals: [1000] })
      .toBeGreaterThan(600)
    await expect(page.getByLabel('Personalnummer')).toBeHidden()
  })

  test('geschützte Dateien werden nicht zwischengespeichert', async ({ page }) => {
    await anmeldenUndListeOeffnen(page)
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const antwort = await page.request.get('/api/serial-articles/3/files/plan.pdf', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(antwort.status()).toBe(200)
    // Ohne `no-store` darf der Browser die Datei danach "heuristisch" selbst
    // anzeigen: Ein abgelaufener Zugang fiele nicht auf und nach dem Abmelden
    // blieben betrachtete Einrichtepläne auf dem Rechner abrufbar.
    expect(antwort.headers()['cache-control']).toBe('no-store')
  })

  test('zeigt die Restzeit auch auf schmalen Bildschirmen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
    await page.getByLabel('Passwort').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    // Ohne diese Anzeige endet die Sitzung auf Telefon/Tablet unbemerkt: die
    // Sidebar mit dem Countdown ist dort ausgeblendet (hidden md:flex).
    await expect(page.getByText(/^Sitzung \d+ Min$/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
  })

  test('Klick auf einen Serienartikel mit abgelaufener Sitzung: erst nachfragen, dann sauber abmelden', async ({
    page,
  }) => {
    const token = abgelaufenerToken()
    test.skip(!token, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    await anmeldenUndListeOeffnen(page)
    await sitzungAblaufenLassen(page, token!)

    // Ab hier zählen: Datei-Anfragen der Vorschau und Rückfragen zur Sitzung.
    let dateiAnfragen = 0
    let sitzungAnfragen = 0
    const zaehlen = (req: { url: () => string }) => {
      const pfad = req.url().split('/api')[1] ?? ''
      if (pfad.includes('/files/')) dateiAnfragen += 1
      if (pfad.startsWith('/auth/me')) sitzungAnfragen += 1
    }
    page.on('request', zaehlen)

    // Die Zeile öffnet das Datei-Fenster. Mit abgelaufener Sitzung darf die App
    // **keine** aussichtslosen Datei-Anfragen schicken: sie fragt zuerst beim
    // Server nach (GET /auth/me) und meldet dann ab.
    await zeileAnklicken(page, '555')

    await expect(page.getByLabel('Personalnummer')).toBeVisible(ZEIT)
    await expect(page.getByText('Sitzung abgelaufen. Bitte melde dich neu an.')).toBeVisible(ZEIT)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()

    page.off('request', zaehlen)
    expect(dateiAnfragen, 'keine Datei-Anfrage mit abgelaufenem Token').toBe(0)
    expect(sitzungAnfragen, 'Sitzung wurde vorher geprüft').toBeGreaterThan(0)
  })

  test('eine verspätete 401 einer alten Anfrage beendet die neu angemeldete Sitzung nicht', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const token = abgelaufenerToken()
    test.skip(!token, 'JWT_SECRET_KEY nicht in backend/.env gefunden – Spec übersprungen')

    // Die erste Datei-Anfrage 15 Sekunden verzögern – wie ein großer Plan über
    // ein langsames Netz. Sie geht noch mit dem alten Token hinaus.
    let verzoegert = false
    await page.route('**/api/serial-articles/*/files/*', async (route) => {
      if (!verzoegert) {
        verzoegert = true
        await new Promise((resolve) => setTimeout(resolve, 15_000))
      }
      await route.continue()
    })

    await anmeldenUndListeOeffnen(page)
    await sitzungAblaufenLassen(page, token!)
    await zeileAnklicken(page, '555')
    await expect(page.getByText('Sitzung abgelaufen. Bitte melde dich neu an.')).toBeVisible(ZEIT)

    // Neu anmelden, während die verzögerte Anfrage noch läuft.
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByLabel('Personalnummer').fill(ADMIN.personal_number)
    await page.getByLabel('Passwort').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)

    // Jetzt trifft die verspätete 401 ein: die Sitzung muss bestehen bleiben.
    await page.waitForTimeout(18_000)
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible(ZEIT)
    await expect(page.getByLabel('Personalnummer')).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull()
  })
})
