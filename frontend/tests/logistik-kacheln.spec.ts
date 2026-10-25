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

  test('der Logistik-Knopf: Glas, Verlauf-Zeichen, Zahl und „Öffnen ›"', async ({ page }) => {
    // DEC-097: Der Knopf folgt der Demo `docs/demo-Logistik-Button.html`
    // (Glasfläche, Zeichen im Verlauf, Zahl + „Logistik · Öffnen ›").
    const knopf = page
      .getByRole('complementary')
      .getByRole('button', { name: /Logistik öffnen/ })

    const kennzahlen = await page.evaluate(async () => {
      const antwort = await fetch('/api/stats/overview', {
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('token')}`,
          'X-Plant-Id': String(document.documentElement.dataset.werk),
        },
      })
      return antwort.json()
    })

    await expect(knopf).toBeVisible()
    await expect(knopf).toHaveClass(/logistik-knopf/)
    // Zahl = `orders_open`, Beschriftung mit CTA.
    await expect(knopf.locator('.logistik-zahl')).toHaveText(String(kennzahlen.orders_open))
    await expect(knopf).toContainText('Öffnen')

    // Glasfläche (halbtransparentes Weiß) und Verlauf im Zeichen.
    const stil = await page.evaluate(() => {
      const el = document.querySelector('.logistik-knopf') as HTMLElement | null
      const zeichen = el?.querySelector('.logistik-zeichen') as HTMLElement | null
      if (!el || !zeichen) return null
      return {
        flaeche: getComputedStyle(el).backgroundColor,
        verlauf: getComputedStyle(zeichen).backgroundImage,
        schrift: getComputedStyle(zeichen).color,
      }
    })
    expect(stil, 'Knopf und Zeichen sind messbar').not.toBeNull()
    expect(stil!.flaeche, 'Glasfläche (Weiß mit Alpha)').toMatch(/^rgba?\(255, 255, 255/)
    expect(stil!.verlauf, 'Zeichen trägt den Verlauf').toContain('linear-gradient')
    expect(stil!.schrift, 'Zeichen in Weiß').toBe('rgb(255, 255, 255)')

    // Überfällige (DEC-092): Amber-Marke mit `orders_old`, sonst keine.
    const marke = knopf.locator('.logistik-marke')
    if (kennzahlen.orders_old > 0) {
      await expect(marke).toContainText(String(kennzahlen.orders_old))
    } else {
      await expect(marke).toHaveCount(0)
    }

    // Ein Klick öffnet den Bereich und markiert den Knopf.
    await knopf.click()
    await expect(page.getByRole('group', { name: 'Logistik' })).toBeVisible()
    await expect(knopf).toHaveAttribute('aria-pressed', 'true')

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

    // Flacher als vorher (DEC-098): Zahl steht **neben** dem Zeichen, der Name
    // darunter. Gemessen: Karte ≤ 64 px hoch, Zahl und Zeichen in einer Zeile.
    const form = await entwuerfe.evaluate((el) => {
      const zeichen = el.querySelector('span[aria-hidden="true"]') as HTMLElement | null
      const zahl = el.querySelector('.tabular-nums') as HTMLElement | null
      const text = [...el.querySelectorAll('span')].find(
        (knoten) => (knoten.textContent ?? '').trim() === 'Entwürfe',
      ) as HTMLElement | null
      if (!zeichen || !zahl || !text) return null
      const z = zeichen.getBoundingClientRect()
      const n = zahl.getBoundingClientRect()
      const s = text.getBoundingClientRect()
      return {
        hoehe: Math.round(el.getBoundingClientRect().height),
        gleicheZeile: Math.abs(z.top + z.height / 2 - (n.top + n.height / 2)) <= 3,
        nameUnterZahl: s.top >= n.bottom - 1,
      }
    })
    expect(form, 'Karte ist messbar').not.toBeNull()
    expect(form!.hoehe, 'Karte ist flach').toBeLessThanOrEqual(64)
    expect(form!.gleicheZeile, 'Zahl steht neben dem Zeichen').toBe(true)
    expect(form!.nameUnterZahl, 'Name steht unter der Zahl').toBe(true)

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
