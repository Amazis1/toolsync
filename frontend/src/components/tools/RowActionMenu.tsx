import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontalIcon } from '../icons'
import { useEscapeKey } from '../../lib/useEscapeKey'

export interface RowAction {
  key: string
  label: string
  onSelect: () => void
  /** Destruktive Aktion (rot beschriftet). */
  danger?: boolean
  /** Wichtigste Aktion der Zeile – farblich hervorgehoben. */
  primary?: boolean
}

interface RowActionMenuProps {
  /** Nur für den zugänglichen Namen: „Weitere Aktionen für TS-1004". */
  label: string
  actions: RowAction[]
}

/**
 * „…"-Knopf einer Tabellenzeile mit Menü, das nach links ausfährt.
 *
 * Das Menü liegt in `position: fixed` und wird aus der Position des Knopfes
 * berechnet — nicht `absolute` im Tabellencontainer: der hat `overflow-x-auto`
 * und würde ein Menü am rechten Rand abschneiden. Die rechte Kante des Menüs
 * liegt genau auf der rechten Kante des Knopfes, deshalb wächst es nach links.
 *
 * Schließen: Escape, Klick außerhalb, Scrollen (sonst bliebe das Menü an der
 * alten Stelle stehen) und nach jeder Auswahl. Der Fokus kehrt zum Knopf zurück.
 */
export default function RowActionMenu({ label, actions }: RowActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const flipped = useRef(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Bezug ist `window.innerWidth`, nicht `documentElement.clientWidth`: der
    // Fixpunkt-Bezugsrahmen eines `position: fixed`-Elements ist das Fenster
    // einschließlich Scrollbalken. Mit der schmaleren Zahl wäre das Menü um die
    // Balkenbreite verschoben (gemessen: 10 px).
    const viewportWidth = window.innerWidth
    flipped.current = false
    setPosition({
      top: rect.bottom + 4,
      right: Math.max(8, viewportWidth - rect.right),
    })
  }, [])

  function close(returnFocus = false) {
    setOpen(false)
    setPosition(null)
    if (returnFocus) triggerRef.current?.focus()
  }

  function toggle() {
    if (open) {
      close()
      return
    }
    place()
    setOpen(true)
  }

  // Zu wenig Platz nach unten? Dann über dem Knopf öffnen (einmalig).
  useLayoutEffect(() => {
    if (!open || flipped.current) return
    const menu = menuRef.current?.getBoundingClientRect()
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (!menu || !trigger) return
    const viewportHeight = window.innerHeight
    if (viewportHeight - trigger.bottom < menu.height + 12 && trigger.top > menu.height + 12) {
      flipped.current = true
      setPosition((prev) => (prev ? { ...prev, top: trigger.top - menu.height - 4 } : prev))
    }
  }, [open, position])

  // Beim Öffnen den ersten Eintrag fokussieren – Tastaturbedienung ohne Klick.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open])

  useEscapeKey(() => close(true), open)

  useEffect(() => {
    if (!open) return
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    /**
     * Bei Scrollen und Größenänderung **mitwandern** statt schließen.
     *
     * Schließen wäre die einfachere Variante, trifft aber den Falschen: schon
     * ein Fokuswechsel oder das seitliche Scrollen der Tabelle ließ das Menü
     * verschwinden. Stattdessen wird die Position nachgeführt; ist der Knopf
     * ganz aus dem Bild, wird geschlossen (ein Menü ohne Anker wäre sinnlos).
     */
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        close()
        return
      }
      place()
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Weitere Aktionen für ${label}`}
        className="ui-btn ui-btn-secondary ui-btn-sm"
      >
        <MoreHorizontalIcon className="h-3.5 w-3.5" />
      </button>

      {open &&
        position &&
        // Portal an <body>: Die Tabelle liegt in einem Container mit
        // `overflow-x-auto` und Glasflächen mit `backdrop-filter`. Ein
        // backdrop-filter macht das Element zum Bezugsrahmen für
        // `position: fixed` – das Menü säße dann verschoben in der Zelle und
        // wäre am Rand abgeschnitten. Im Portal stimmen die berechneten
        // Koordinaten und die Reihenfolge (über allem anderen).
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Weitere Aktionen für ${label}`}
            style={{ top: `${position.top}px`, right: `${position.right}px` }}
            // .ui-menu liefert Fläche, Rahmen, Radius und Schatten (Guide §1.6);
            // .ui-menu-left die Einfahrt von rechts nach links.
            className="ui-menu ui-menu-left fixed z-50"
          >
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  action.onSelect()
                }}
                className={
                  action.danger
                    ? 'text-rose-700'
                    : action.primary
                      ? 'font-bold text-teal-800'
                      : undefined
                }
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
