import { useEffect, useState } from 'react'

interface SessionTimerProps {
  /** Absoluter Ablaufzeitpunkt (ms seit Epoche) oder null, wenn unbekannt. */
  expiresAt: number | null
  /** Wird aufgerufen, wenn die Restzeit 0 erreicht (Sitzung beenden). */
  onExpire: () => void
  /**
   * Kurzform „Sitzung 30 Min" statt „Sitzung läuft in 30 Min ab".
   * Für die Kopfzeile auf Telefon und Tablet, wo wenig Platz ist.
   */
  short?: boolean
}

/**
 * Zeigt die Restzeit der Sitzung als Countdown-Badge.
 *
 * Die Sitzung wird bei Aktivitaet im Backend erneuert; der Token-Wechsel
 * erreicht die App ueber das Event `auth:token-changed`, wodurch `expiresAt`
 * neu berechnet wird und der Countdown wieder oben beginnt.
 *
 * Erreicht die Restzeit 0, wird `onExpire` ausgeloest - die Sitzung endet
 * damit auch dann sauber, wenn kein Request mehr lief.
 */
export default function SessionTimer({ expiresAt, onExpire, short = false }: SessionTimerProps) {
  const [now, setNow] = useState(() => Date.now())

  // Alle 20 Sekunden neu rechnen - der angezeigte Wert aendert sich in Minuten.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])

  const remaining = expiresAt === null ? null : expiresAt - now

  useEffect(() => {
    if (remaining !== null && remaining <= 0) onExpire()
  }, [remaining, onExpire])

  if (remaining === null) return null

  const minutes = Math.max(0, Math.round(remaining / 60_000))
  const cls =
    minutes <= 2
      ? 'ui-badge ui-badge-danger'
      : minutes <= 5
        ? 'ui-badge ui-badge-warning'
        : 'ui-badge ui-badge-neutral'

  return (
    <span className={cls} title={`Sitzung läuft in ${minutes} Min ab`}>
      {short ? `Sitzung ${minutes} Min` : `Sitzung läuft in ${minutes} Min ab`}
    </span>
  )
}