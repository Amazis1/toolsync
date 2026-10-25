// Tooltip – die Sprechblase, die früher an `title="…"` hing (DEC-088).
//
// Warum eine eigene Komponente statt `title`:
//   * Der Browser-Tooltip kommt **langsam** (rund eine Sekunde), sieht in jedem
//     Browser anders aus und lässt sich nicht gestalten. Für die Hinweise in
//     dieser Anwendung („bleibt reserviert, bis das Werkzeug zurück ist") ist er
//     die falsche Ebene.
//   * Er ist per Tastatur nicht erreichbar: wer nur mit Tab arbeitet, sieht ihn
//     nie. Diese Komponente zeigt die Blase auch bei **Fokus**.
//
// Warum ein Portal an `<body>`:
//   Die Blase stand im CSS `absolute` im Textfluss. In der Auftrags-Tabelle
//   (`overflow-x-auto`), im Rückgabe-Fenster (`overflow-hidden`) und an jeder
//   Fußzeile wurde sie dadurch **abgeschnitten** – genau dort, wo die Hinweise
//   gebraucht werden. Deshalb wird sie an `<body>` gelegt und ihre Lage am
//   Auslöser **gemessen** (dasselbe Muster wie `RowActionMenu`).
//
// Aussehen kommt aus `index.css` (Abschnitt „TOOLTIPS"): dunkle Blase,
// `.tooltip-top` / `.tooltip-bottom` / `.tooltip-right`.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Seite = 'top' | 'bottom' | 'right'

interface TooltipProps {
  /**
   * Text der Blase. Kurz halten – ein Halbsatz, keine Erklärung.
   * `null`/leer: kein Tooltip (das Kind wird unverändert gerendert) – so bleiben
   * Bedingungen wie „nur wenn ein Auftrag leer ist" beim Aufrufer.
   */
  text: string | null | undefined
  /** Wo die Blase steht. Vorgabe: oben (klappt automatisch nach unten). */
  seite?: Seite
  /** Zusätzliche Klassen für den Wirt (Standard: `tip-wirt`, `inline-flex`). */
  className?: string
  /** Auslöser: Knopf, Wert, Zeichen … */
  children: ReactNode
}

/** Abstand zwischen Auslöser und Blase (px). */
const ABSTAND = 8
/** So viel Platz muss für einen Wechsel nach oben/unten frei sein (px). */
const MINDESTPLATZ = 48

interface Lage {
  links: number
  oben: number
  seite: Seite
}

/**
 * Setzt die Sprechblase neben ihren Auslöser.
 *
 * `getBoundingClientRect` liefert die Lage im **Fenster** – passend zu
 * `position: fixed`. Der Anker wird am Rand eingeklemmt, damit eine lange Blase
 * nicht aus dem Bild läuft; die Blase selbst ist auf 18 rem begrenzt und bricht
 * um (kein `whitespace-nowrap` mehr).
 */
function lageFuer(el: HTMLElement, seite: Seite): Lage {
  const r = el.getBoundingClientRect()
  const breite = window.innerWidth
  const hoehe = window.innerHeight

  let ziel: Seite = seite
  if (seite === 'top' && r.top < MINDESTPLATZ) ziel = 'bottom'
  if (seite === 'bottom' && hoehe - r.bottom < MINDESTPLATZ) ziel = 'top'
  if (seite === 'right' && breite - r.right < 200) ziel = 'top'

  const rand = 16
  const links =
    ziel === 'right'
      ? Math.min(r.right + ABSTAND, breite - rand)
      : Math.min(Math.max(r.left + r.width / 2, rand), breite - rand)
  const oben =
    ziel === 'right'
      ? r.top + r.height / 2
      : ziel === 'bottom'
        ? r.bottom + ABSTAND
        : r.top - ABSTAND

  return { links, oben, seite: ziel }
}

/** Ausrichtung der Blase relativ zum Anker (kommt als Inline-Stil). */
const AUSRICHTUNG: Record<Seite, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  right: 'translate(0, -50%)',
}

/**
 * Das Element, an dem gemessen wird.
 *
 * Normalerweise der Wirt selbst. Mit `className="contents"` hat der Wirt
 * (`display: contents`) **keine eigene Box** – dann wird sein erstes Kind
 * gemessen. Das ist für Stellen gedacht, an denen eine zusätzliche Hülle das
 * Layout verändern würde (Feldbeschriftungen in einer Rasterzeile).
 */
function messElement(wirt: HTMLElement): HTMLElement {
  const box = wirt.getBoundingClientRect()
  if (box.width > 0 || box.height > 0) return wirt
  return (wirt.firstElementChild as HTMLElement | null) ?? wirt
}

export default function Tooltip({
  text,
  seite = 'top',
  className = '',
  children,
}: TooltipProps) {
  const id = useId()
  const wirt = useRef<HTMLSpanElement>(null)
  const [lage, setLage] = useState<Lage | null>(null)
  // Kein Text: kein Tooltip. Dann bleibt der Auslöser ohne Wirt-Hülle, damit
  // bedingte Hinweise (`text={… ? '…' : undefined}`) nichts am Layout ändern.
  const ohneText = !text

  const zeigen = useCallback(() => {
    const el = wirt.current
    if (!el) return
    setLage(lageFuer(messElement(el), seite))
  }, [seite])

  const verbergen = useCallback(() => {
    // Immer schließen – auch wenn der Auslöser gerade den Fokus hat. Ein Knopf,
    // der per Klick gedrückt wurde, behält den Fokus; mit einer Ausnahme für
    // „hat noch Fokus" bliebe seine Blase für immer stehen (im Test gemessen:
    // zwei Blasen gleichzeitig offen).
    setLage(null)
  }, [])

  // Beim Scrollen und bei Größenänderungen stimmt die gemessene Lage nicht mehr:
  // die Blase wird **nachgeführt** (wie im AdminPanel), statt neben dem Auslöser
  // hängen zu bleiben oder zu verschwinden. Während des Scrollens mit der Maus
  // über dem Auslöser bleibt sie damit an ihrem Platz.
  useEffect(() => {
    if (!lage) return
    const nachfuehren = () => {
      const el = wirt.current
      if (el) setLage(lageFuer(messElement(el), seite))
    }
    window.addEventListener('scroll', nachfuehren, true)
    window.addEventListener('resize', nachfuehren)
    return () => {
      window.removeEventListener('scroll', nachfuehren, true)
      window.removeEventListener('resize', nachfuehren)
    }
  }, [lage, seite])

  if (ohneText) return <>{children}</>

  return (
    <span
      ref={wirt}
      className={`tip-wirt ${className}`.trim()}
      aria-describedby={lage ? id : undefined}
      onMouseEnter={zeigen}
      onMouseLeave={verbergen}
      onFocus={zeigen}
      onBlur={verbergen}
    >
      {children}
      {lage &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            className={`tooltip-${lage.seite}`}
            style={{
              left: `${lage.links}px`,
              top: `${lage.oben}px`,
              transform: AUSRICHTUNG[lage.seite],
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
