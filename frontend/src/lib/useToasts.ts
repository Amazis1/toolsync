import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  variant: ToastVariant
  title: string
  message?: string
  /** Millisekunden bis zum automatischen Schließen. */
  duration: number
}

/** Standarddauer: lang genug zum Lesen, kurz genug zum Weitermachen. */
const DEFAULT_DURATION = 5000

/**
 * Aktions-Feedback als Toast (Guide „Feedback": gestapelt unten rechts,
 * automatisch schließend, manuell schließbar).
 *
 * Warum nicht als Meldung im Seiteninhalt: Eine Meldung im Block schiebt die
 * Liste nach unten, wird beim Blättern übersehen und steht nach einem Filter-
 * wechsel an falscher Stelle. Der Toast erscheint dort, wo der Blick nach dem
 * Klick ohnehin ist, und verschwindet von selbst. Für Meldungen, die eine
 * Entscheidung verlangen (Fehler, die man beheben muss), bleibt die feste
 * Meldung im Block – die sieht man auch noch später.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (variant: ToastVariant, title: string, message?: string, duration = DEFAULT_DURATION) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, variant, title, message, duration }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss],
  )

  // Beim Verlassen der Seite alle Timer aufräumen.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return { toasts, showToast: show, dismissToast: dismiss }
}
