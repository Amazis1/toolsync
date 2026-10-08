// Prueft, was `lucide-react` mit **genau den Props** rendert, die der Wrapper in
// `src/components/iconBase.tsx` setzt – ohne tsx, ohne Testframework:
//
//   node .audit/verify-icons-lucide.mjs
//
// Geprueft wird:
//   1. Existiert jeder Lucide-Export, den `icons.tsx` importiert?
//   2. Rendert er die Pflichtattribute aus Guide §1.7?
//   3. Sind alle Icon-Namen, die die App importiert, auch exportiert?
//   4. Tragen die Eigenbauten (kein Lucide-Zeichen) die Pflichtattribute?
//
// Das Skript liest `node_modules/lucide-react` – also **denselben** Code, der
// spaeter im Bundle landet. Kein Internet noetig.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Lucide from 'lucide-react'

const ICONS_TSX = 'src/components/icons.tsx'
const quelle = readFileSync(ICONS_TSX, 'utf8')

const fehler = []
const meldungen = []

// ---------------------------------------------------------------------------
// 1. Welche Lucide-Exporte importiert die Wrapper-Datei?
// ---------------------------------------------------------------------------
const importBlock = /import \{([\s\S]*?)\} from 'lucide-react'/.exec(quelle)
if (!importBlock) fehler.push('Import aus lucide-react nicht gefunden')

const importiert = importBlock[1]
  .split(',')
  .map((zeile) => zeile.trim())
  .filter(Boolean)

for (const name of importiert) {
  if (!(name in Lucide)) fehler.push(`lucide-react hat keinen Export "${name}"`)
}

// ---------------------------------------------------------------------------
// 2. Pflichtattribute am gerenderten SVG
// ---------------------------------------------------------------------------
const PFLICHT = {
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

/** genau die Props aus `fromLucideBody` */
function propsWieImWrapper(extra = {}) {
  return {
    size: 24,
    strokeWidth: 2,
    className: 'h-4 w-4',
    'aria-hidden': 'true',
    focusable: 'false',
    ...extra,
  }
}

function pruefeAttribute(svg, wer) {
  for (const [name, wert] of Object.entries(PFLICHT)) {
    const treffer = new RegExp(`${name}="([^"]*)"`).exec(svg)
    if (!treffer) fehler.push(`${wer}: Attribut ${name} fehlt`)
    else if (treffer[1] !== wert) fehler.push(`${wer}: ${name}="${treffer[1]}" statt "${wert}"`)
  }

  // Die eigene Klasse muss **in** der Klassenliste stehen, nicht gleich sein:
  // `lucide-react` stellt seine eigenen Klassen voran
  // (`class="lucide lucide-check h-4 w-4"`). Auf Gleichheit zu pruefen war der
  // Fehler der ersten Fassung dieses Skripts – es meldete 33 Befunde, obwohl
  // die Klasse korrekt durchgereicht wurde.
  const klassen = /class="([^"]*)"/.exec(svg)
  if (!klassen) fehler.push(`${wer}: kein class-Attribut`)
  else {
    const liste = klassen[1].split(/\s+/)
    for (const erwartet of ['h-4', 'w-4']) {
      if (!liste.includes(erwartet)) {
        fehler.push(`${wer}: Klasse "${erwartet}" fehlt (class="${klassen[1]}")`)
      }
    }
  }

  // `aria-hidden` und `focusable` duerfen nicht verloren gehen: sonst liest ein
  // Screenreader den Knopfnamen doppelt vor.
  if (!svg.includes('aria-hidden="true"')) fehler.push(`${wer}: aria-hidden fehlt`)
  if (!svg.includes('focusable="false"')) fehler.push(`${wer}: focusable fehlt`)
}

let geprueft = 0
for (const name of importiert) {
  const Icon = Lucide[name]
  if (typeof Icon !== 'function' && typeof Icon !== 'object') {
    fehler.push(`${name}: kein renderbares Zeichen`)
    continue
  }
  const svg = renderToStaticMarkup(createElement(Icon, propsWieImWrapper()))
  pruefeAttribute(svg, name)
  geprueft++
}

// Stichprobe: rendert das Zeichen ueberhaupt Formen?
const cog = renderToStaticMarkup(createElement(Lucide.Cog, propsWieImWrapper()))
if (!/<(path|circle|rect|line)/.test(cog)) fehler.push('Cog: rendert keine Formen')

meldungen.push(
  `${geprueft}/${importiert.length} Lucide-Zeichen importiert und gerendert`,
)

// ---------------------------------------------------------------------------
// 3. Alle Namen, die die App importiert, muessen exportiert sein
// ---------------------------------------------------------------------------
function quelldateien(verzeichnis) {
  const out = []
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = `${verzeichnis}/${eintrag}`
    if (statSync(pfad).isDirectory()) out.push(...quelldateien(pfad))
    else if (/\.tsx?$/.test(eintrag)) out.push(pfad)
  }
  return out
}

/**
 * Die Namen aus `import { A, B } from '<pfad>icons'` holen.
 *
 * **Kein Regex.** Ein Muster wie `/import\s*\{([\s\S]*?)\}/` trifft bis zur
 * ersten schliessenden Klammer und frisst bei mehrzeiligen Imports den halben
 * Dateikopf mit – das Skript meldete dann Namen wie `AuthProvider` oder
 * `useEffect` als fehlend. Deshalb: Position der schliessenden Klammer vor dem
 * `from`-Ausdruck suchen und von dort rueckwaerts die oeffnende.
 */
function namenAusIconsImport(text) {
  const namen = []
  const fromMuster = /from\s*'([^']*icons)'/g
  let treffer
  while ((treffer = fromMuster.exec(text)) !== null) {
    const ende = text.lastIndexOf('}', treffer.index)
    if (ende === -1) continue
    const start = text.lastIndexOf('{', ende)
    if (start === -1 || start > ende) continue
    const davor = text.slice(Math.max(0, start - 40), start)
    if (!/import\s*$/.test(davor) && !/import\s/.test(davor)) continue
    for (const roh of text.slice(start + 1, ende).split(',')) {
      // `type X` ueberspringen: Typen sind keine Komponenten.
      const name = roh.replace(/\/\/.*$/gm, '').trim()
      if (!name || name.startsWith('type ')) continue
      namen.push(name)
    }
  }
  return namen
}

const benutzt = new Set()
for (const pfad of quelldateien('src')) {
  if (pfad.endsWith('icons.tsx') || pfad.endsWith('iconBase.tsx')) continue
  for (const name of namenAusIconsImport(readFileSync(pfad, 'utf8'))) benutzt.add(name)
}

for (const name of benutzt) {
  if (!new RegExp(`export (function|const) ${name}\\b`).test(quelle)) {
    fehler.push(`${ICONS_TSX} exportiert "${name}" nicht (wird aber importiert)`)
  }
}
meldungen.push(`${benutzt.size} Icon-Namen in der App importiert, alle exportiert`)

// ---------------------------------------------------------------------------
// 4. Eigenbauten: Pflichtattribute im Quelltext
// ---------------------------------------------------------------------------
const eigenbauten = [...quelle.matchAll(/export function (\w+Icon)\(\{ className \}: EigenbauProps\)/g)]
for (const [, name] of eigenbauten) {
  const start = quelle.indexOf(`export function ${name}(`)
  const ende = quelle.indexOf('\n}', start)
  const koerper = quelle.slice(start, ende)
  for (const [attribut, wert] of [
    ['width', '24'],
    ['height', '24'],
    ['viewBox', '0 0 24 24'],
    ['fill', 'none'],
    ['stroke', 'currentColor'],
    ['strokeWidth', '2'],
    ['strokeLinecap', 'round'],
    ['strokeLinejoin', 'round'],
  ]) {
    if (!koerper.includes(`${attribut}="${wert}"`)) {
      fehler.push(`${name}: ${attribut}="${wert}" fehlt`)
    }
  }
  geprueft++
}
meldungen.push(`${eigenbauten.length} Eigenbauten auf Pflichtattribute geprueft`)

// ---------------------------------------------------------------------------
console.log('--- Pruefung der Icons ---')
for (const m of meldungen) console.log('  ' + m)
if (fehler.length === 0) {
  console.log('\nOK: alles wie im Guide §1.7 gefordert.')
} else {
  console.log(`\n${fehler.length} Befund(e):`)
  for (const f of fehler) console.log('  - ' + f)
  process.exitCode = 1
}
