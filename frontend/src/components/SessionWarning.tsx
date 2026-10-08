import { useEffect, useState } from 'react'

import { decodeTokenExp, TOKEN_WARN_MARGIN_MS } from '../lib/session'

interface SessionWarningProps {
  /** Sitzung beim Server verlaengern (loest eine Anfrage aus). */
  onExtend: () => void | Promise<void>
}

/** Wie oft die Restlaufzeit nachgerechnet wird (die Anzeige wechselt in Minuten). */
const TICK_MS = 5_000

/**
 * Warnung vor dem Ablauf der Sitzung („Sitzung läuft in X Min ab") mit dem
 * Knopf „Sitzung verlängern".
 *
 * Warum das gebraucht wird: Die Sitzung endet nach der eingestellten Laufzeit
 * ohne Aktivität. Wer in dieser Zeit einen Einrichteplan liest oder einen
 * Ausdruck holt, wurde bisher ohne Vorwarnung abgemeldet – mitten in der Arbeit.
 * Die Warnung erscheint 5 Minuten vorher, oberhalb aller Fenster (auch über der
 * Plan-Vorschau), damit sie nicht übersehen wird.
 *
 * Die Restlaufzeit wird aus dem **gespeicherten Token** gelesen, nicht aus dem
 * Zustand der Anwendung: der Token ist die Wahrheit, mit der die nächste Anfrage
 * tatsächlich hinausgeht.
 */
export default function SessionWarning({ onExtend }: SessionWarningProps) {
  const [restMs, setRestMs] = useState<number | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const messen = () => {
      const token = localStorage.getItem('token')
      const exp = token ? decodeTokenExp(token) : null
      setRestMs(exp === null ? null : exp - Date.now())
    }

    messen()
    const id = setInterval(messen, TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Nichts anzeigen, solange genug Zeit ist oder die Sitzung schon vorbei ist
  // (dann erscheint die Anmeldung).
  if (restMs === null || restMs <= 0 || restMs > TOKEN_WARN_MARGIN_MS) return null

  const minuten = Math.max(1, Math.round(restMs / 60_000))

  async function verlaengern() {
    setLaeuft(true)
    try {
      await onExtend()
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div
      // `pointer-events-none` am Rahmen, `auto` nur auf der Meldung selbst:
      // sonst schluckt die Warnung Klicks auf die Reiterleiste darunter
      // (dasselbe Vorgehen wie beim Toast-Stapel).
      className="pointer-events-none fixed left-1/2 top-4 z-[70] w-full max-w-xl -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="ui-alert ui-alert-warning pointer-events-auto shadow-lg">
        <span aria-hidden="true">!</span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Sitzung läuft in {minuten} Min ab. Jede Eingabe verlängert sie – oder
            gleich hier:
          </span>
          <button
            type="button"
            onClick={() => {
              void verlaengern()
            }}
            disabled={laeuft}
            className="ui-btn ui-btn-primary ui-btn-sm"
          >
            {laeuft ? 'Wird verlängert …' : 'Sitzung verlängern'}
          </button>
        </div>
      </div>
    </div>
  )
}
