import { test, expect, type Page } from '@playwright/test'

/**
 * Logistik: Kennzahl-Karten, Schnellfilter, Zähler am Knopf und die deutlicheren
 * Zustandsmarken (DEC-089).
 *
 * Auftrag des Inhabers: „In der Logistik fehlen mir Filter … evtl. mehr deutlich
 * farbig anzeigen", „Logistik-Button: es muss sofort erkennbar sein" und – nach
 * dem ersten Einbau – „wenn man auf Kachel unterwegs und Eingang offen klickt sind
 * beide aktiv, ist das so richtig?" (Nein: höchstens **eine** Karte ist gedrückt;
 * „Eingang offen" sitzt jetzt in der rechten Spalte.)
 *
 * Geprüft wird:
 *
 *   1. Der Knopf trägt die Fläche der Werkfarbe und den Zähler der offenen Aufträge.
 *   2. Die rechte Spalte zeigt vier Kennzahl-Karten mit Zahlen; „Eingang offen"
 *      springt in den Eingang.
 *   3. Drei Filter-Karten über der Liste; nur **eine** ist je gedrückt, der Filter
 *      steht als Chip über der Liste und lässt sich dort aufheben.
 *   4. Zustandsmarke gefüllt mit Verlauf und Zeichen; jede Zeile nennt ihr Alter.
 *
 * Läuft gegen eine Datenbank-Kopie:
 *
 *     pwsh -File .audit/browser-tests-gegen-kopie.ps1 -Filter tests/logistik-kacheln.spec.ts
 */

const ADMIN = { personal_number: 'admin1', password: '123' }
const SHOTS = '../.audit/shots'

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

/** Eine Karte der rechten Spalte über ihren Namen. */
function karteRechts(page: Page, name: RegExp) {
  return page.locator('aside .app-stat-card', { hasText: name })
}

/** Eine Filter-Karte über der Logistik-Liste (Gruppe „Schnellfilter"). */
function filterKarte(page: Page, name: RegExp) {
  return page
    .getByRole('group', { name: 'Schnellfilter' })
    .locator('.app-stat-card', { hasText: name })
}

test.describe('Logistik-Übersicht (DEC-089)', () => {
  test.beforeEach(async ({ page }) => {
    await anmelden(page)
  })

  test('die Logistik-Karte nennt offene Aufträge und markiert überfällige', async ({ page }) => {
    // Seit DEC-095 ist der Logistik-Knopf eine **Karte der rechten Spalte**.
    const karte = page.getByRole('complementary').getByRole('button', { name: /Logistik/ })

    const kennzahlen = await page.evaluate(async () => {
      const antwort = await fetch('/api/stats/overview', {
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('token')}`,
          'X-Plant-Id': String(document.documentElement.dataset.werk),
        },
      })
      return antwort.json()
    })

    await expect(karte).toBeVisible()
    // Die Zahl der Karte ist `orders_open` aus den Kennzahlen.
    await expect(karte).toContainText(String(kennzahlen.orders_open))
    // Überfällige (DEC-092): Amber-Marke mit `orders_old`, sonst keine.
    if (kennzahlen.orders_old > 0) {
      await expect(karte).toContainText(String(kennzahlen.orders_old))
      // Zeichen: Truck, Warndreieck und der Pfeil des Knopfes.
      await expect(karte.locator('svg')).toHaveCount(3)
    } else {
      // Ohne Überfällige bleiben Truck und Pfeil.
      await expect(karte.locator('svg')).toHaveCount(2)
    }
    // Ein Klick öffnet den Bereich und markiert die Karte.
    await karte.click()
    await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
    await expect(karte).toHaveAttribute('aria-pressed', 'true')

    // Sie **sieht aus wie ein Knopf** (DEC-096): Fläche in der Werkfarbe, weiße
    // Schrift, CTA „öffnen". Das unterscheidet sie von den Kennzahl-Karten, die
    // nur etwas anzeigen. (Die Fläche wird als `oklab(...)` ausgegeben, sobald
    // `color-mix` im Spiel ist – verglichen wird deshalb mit der Kennzahl-Karte
    // daneben, nicht mit einem Hex-Wert.)
    const farben = await page.evaluate(() => {
      const karten = [...document.querySelectorAll('aside .app-stat-card')]
      const logistik = karten.find((el) => (el.textContent ?? '').includes('Logistik'))
      const kennzahl = karten.find((el) => (el.textContent ?? '').includes('Aktive Ausleihen'))
      if (!logistik || !kennzahl) return null
      return {
        knopf: getComputedStyle(logistik).backgroundColor,
        knopfSchrift: getComputedStyle(logistik).color,
        kennzahl: getComputedStyle(kennzahl).backgroundColor,
      }
    })
    expect(farben, 'Karten sind messbar').not.toBeNull()
    expect(farben!.knopf, 'Logistik-Karte hat eine eigene (farbige) Fläche').not.toBe(
      farben!.kennzahl,
    )
    expect(farben!.knopfSchrift, 'weiße Schrift auf der Knopf-Fläche').toBe(
      'rgb(255, 255, 255)',
    )
    await expect(karte).toHaveClass(/kpi-als-knopf/)
    await expect(karte).toContainText(/öffnen/i)

    await page.screenshot({ path: `${SHOTS}/logistik-01-knopf.png` })
  })

  test('rechte Spalte: vier Kennzahl-Karten mit Zahlen, „Eingang offen" springt', async ({
    page,
  }) => {
    const ausleihen = karteRechts(page, /Aktive Ausleihen/)
    const verfuegbar = karteRechts(page, /Verfügbare Werkzeuge/)
    const offene = karteRechts(page, /Offene Aufträge/)
    const eingang = karteRechts(page, /Eingang offen/)

    for (const karte of [ausleihen, verfuegbar, offene, eingang]) {
      await expect(karte).toBeVisible()
      // Keine „—" mehr: die Karten tragen eine Zahl.
      await expect(karte).not.toContainText('—')
    }
    await expect(verfuegbar).toContainText('%')

    await page.screenshot({ path: `${SHOTS}/logistik-03-rechte-spalte.png` })

    // „Eingang offen" ist ein Sprungziel in den Eingang der Logistik.
    await eingang.click()
    await expect(page.getByText(/Eingang in/)).toBeVisible()
  })

  test('drei Filter-Karten, höchstens eine gedrückt, Chip hebt den Filter auf', async ({
    page,
  }) => {
    await logistik(page)

    const entwuerfe = filterKarte(page, /Entwürfe/)
    const unterwegs = filterKarte(page, /unterwegs/)
    const alt = filterKarte(page, /über 7 Tage|alter als 7 Tage/)
    for (const karte of [entwuerfe, unterwegs, alt]) {
      await expect(karte).toBeVisible()
      await expect(karte).toHaveAttribute('aria-pressed', 'false')
    }

    // „Eingang offen" ist **keine** Karte dieses Bereichs mehr (sie sitzt rechts).
    await expect(filterKarte(page, /Eingang offen/)).toHaveCount(0)

    // Ein Klick setzt den Filter; nur diese eine Karte ist gedrückt.
    await unterwegs.click()
    await expect(unterwegs).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('group', { name: 'Schnellfilter' }).locator('.app-stat-card[aria-pressed="true"]'),
    ).toHaveCount(1)

    const chip = page.getByRole('button', { name: /nur unterwegs/ })
    await expect(chip).toBeVisible()
    // In der Liste steht dann kein Entwurf.
    const koepfe = page.locator('button.kopf-auftrag')
    const anzahl = await koepfe.count()
    for (let i = 0; i < anzahl; i += 1) {
      await expect(koepfe.nth(i)).not.toContainText('Entwurf')
    }
    await page.screenshot({ path: `${SHOTS}/logistik-02-kacheln.png` })

    // Der Chip hebt den Filter wieder auf.
    await chip.click()
    await expect(chip).toHaveCount(0)
    await expect(unterwegs).toHaveAttribute('aria-pressed', 'false')
  })

  test('Zustandsmarke ist gefüllt und trägt ein Zeichen; die Zeile nennt das Alter', async ({
    page,
  }) => {
    await logistik(page)

    const marke = page.locator('.ui-status').first()
    await expect(marke).toBeVisible()
    const hintergrund = await marke.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(hintergrund).toContain('linear-gradient')
    await expect(marke.locator('svg')).toHaveCount(1)

    const kopf = page.locator('button.kopf-auftrag')
    expect(await kopf.count(), 'mindestens ein Auftrag in der Liste').toBeGreaterThan(0)
    await expect(kopf.first().locator('.ui-alter')).toHaveText(/seit|gerade eben/)
  })
})
