import { useEffect } from 'react'

import { pingSession } from './session'

/**
 * Abstand des Lebenszeichens, solange ein Fenster offen ist, dessen Ereignisse
 * die Seite nicht sieht (Einrichteplan im iframe).
 */
const KEEP_ALIVE_MS = 60_000

/** Drosselung der Ereignis-Prüfung: höchstens ein Lebenszeichen je Minute. */
const EVENT_THROTTLE_MS = 60_000

/**
 * Haelt die Sitzung bei Aktivitaet am Leben.
 *
 * Jede authentifizierte Anfrage setzt die Laufzeit im Backend auf die volle
 * Dauer zurueck. Waehrend des Ausfuellens eines Formulars entstehen aber lange
 * Phasen ohne Request - deshalb loest dieses Modul bei Maus, Tastatur, Klick,
 * Fokus und Scroll ein Lebenszeichen aus (`pingSession`, hoechstens eines je
 * Minute).
 *
 * Bewusst KEIN festes Intervall im Normalfall: ohne Nutzer soll die Sitzung nach
 * der Laufzeit enden.
 *
 * **Ausnahme `keepAlive`:** Der Einrichteplan laeuft in einem `iframe`.
 * Mausrad, Klicks und Tasten darin erreichen das Hauptfenster **nicht** -
 * Dokumentgrenze, und der eingebaute PDF-Betrachter von Chrome meldet gar keine
 * Ereignisse an die Seite. Wer 30 Minuten Plaene liest, verlaengerte deshalb
 * nichts, und der naechste Klick lief in "Sitzung abgelaufen". Solange ein
 * solches Fenster offen ist, gilt der Nutzer deshalb als anwesend: es wird
 * regelmaessig ein Lebenszeichen geschickt - **aber nur bei sichtbarem Tab**.
 * Wer den Rechner verlaesst oder den Reiter wechselt, verlaengert nichts mehr,
 * und die Sitzung endet nach der eingestellten Laufzeit.
 */
export function useSessionHeartbeat(active: boolean, keepAlive = false) {
  useEffect(() => {
    if (!active) return

    let last = 0
    const ping = () => {
      const now = Date.now()
      if (now - last < EVENT_THROTTLE_MS) return
      last = now
      // Fehler nicht anzeigen - die normale Behandlung greift beim echten
      // Request. Ein 401 meldet die Sitzung ab (AuthContext raeumt auf).
      void pingSession()
    }

    const events = ['mousemove', 'keydown', 'click', 'focus', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, ping))
    return () => events.forEach((e) => window.removeEventListener(e, ping))
  }, [active])

  // Lebenszeichen, solange ein Plan-/Bildfenster offen ist (siehe oben).
  useEffect(() => {
    if (!active || !keepAlive) return

    const stoss = () => {
      // Nur bei sichtbarem Tab: ein unbeaufsichtigter, offener Rechner soll die
      // Sitzung nicht endlos am Leben halten.
      if (document.visibilityState !== 'visible') return
      void pingSession()
    }

    stoss()
    const id = setInterval(stoss, KEEP_ALIVE_MS)
    return () => clearInterval(id)
  }, [active, keepAlive])
}
