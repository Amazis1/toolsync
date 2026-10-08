import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent, ReactNode } from 'react'

type Placement = 'above' | 'below'

/**
 * Styleguide-Tooltip.
 * Quelle: AdminPanel-Styleguide.html – Tooltip-Konvention.
 *
 * Umsetzung als Portal in document.body mit position: fixed.
 * Grund: Eine absolut positionierte Bubble kommt aus Containern mit
 * overflow nicht heraus. Im AdminPanel gibt es beides —
 *   .admin-card { overflow: hidden }   -> Bubble wird abgeschnitten (unsichtbar)
 *   .admin-scroll-y { overflow-y: auto } -> overflow-x rechnet sich zu auto,
 *                                           die Bubble erzeugt einen Scrollbalken
 * Als Portal mit position: fixed entsteht kein Beitrag zum Scrollbereich und
 * kein Clipping. Der z-index liegt damit auch nicht mehr im Wettbewerb mit
 * dem Sticky-Tabellenkopf.
 *
 * Tooltip-Regel im AdminPanel:
 *   1. Button ohne sichtbaren Text      -> <IconTipButton> : Bubble + aria-label, KEIN title
 *   2. Button MIT Text, aber Zusatzinfo -> <Tip label="…"> : Bubble, KEIN title
 *   3. Abgeschnittener Text (truncate) oder mehrzeilige Container-Info
 *                                       -> natives `title` (einzige Möglichkeit,
 *                                          den Volltext lesbar zu machen)
 * Sobald `title` UND eine Bubble am selben Element hängen, zeigt der Browser
 * beide Tooltips gleichzeitig.
 */
export function Tip({
  label,
  children,
  placement = 'above',
}: {
  label: string
  children: ReactNode
  /** 'below' wenn über dem Auslöser kein Platz ist (z. B. oberste Tabellenzeile). */
  placement?: Placement
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const measure = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.round(r.left + r.width / 2),
      y: Math.round(placement === 'below' ? r.bottom + 6 : r.top - 6),
    })
  }, [placement])

  // Solange sichtbar an den Auslöser geheftet bleiben.
  useEffect(() => {
    if (!pos) return
    const onMove = () => measure()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [pos, measure])

  return (
    <>
      <span
        ref={anchorRef}
        className="admin-tip"
        onMouseEnter={measure}
        onMouseLeave={() => setPos(null)}
        onFocus={measure}
        onBlur={() => setPos(null)}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <span
            className={`admin-tip-bubble is-fixed${placement === 'below' ? ' is-below' : ''}`}
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  )
}

/**
 * Icon-Button mit Tooltip. `label` ist gleichzeitig die sichtbare
 * Tooltip-Beschriftung und das aria-label für Screenreader.
 */
export default function IconTipButton({
  label,
  onClick,
  children,
  buttonClassName = 'admin-icon-btn',
  ariaLabel,
  ariaHaspopup,
  ariaExpanded,
  placement = 'above',
}: {
  label: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
  buttonClassName?: string
  /** Abweichende Screenreader-Beschriftung, wenn die Kurzform im Tooltip zu knapp ist. */
  ariaLabel?: string
  ariaHaspopup?: boolean
  ariaExpanded?: boolean
  placement?: Placement
}) {
  return (
    <Tip label={label} placement={placement}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel ?? label}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
        onClick={onClick}
      >
        {children}
      </button>
    </Tip>
  )
}
