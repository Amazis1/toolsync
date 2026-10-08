// Sitzungs-Helfer: Token-Ablauf lesen, Sitzung beim Server prüfen, erneuerten
// Token übernehmen.
//
// Das Backend (app/middleware/session.py) hängt bei jeder gültigen
// authentifizierten Anfrage einen frischen Token in den Header "X-New-Token".
// Diese Datei ist die einzige Stelle, die das auswertet.

/** Liest `exp` (Millisekunden) aus einem JWT, ohne ihn zu verifizieren. */
export function decodeTokenExp(token: string): number | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Uebernimmt einen vom Server erneuerten Token und informiert die App.
 *
 * Wird vom Anfrageweg (`lib/transport.ts`) und von `pingSession` nach jedem
 * `fetch` aufgerufen. Ohne den Header passiert nichts - die Sitzung laeuft
 * dann normal ab.
 */
export function applyRenewedToken(res: Response): void {
  const fresh = res.headers.get('X-New-Token')
  if (!fresh) return
  localStorage.setItem('token', fresh)
  // AuthContext hoert auf dieses Event und aktualisiert den Countdown.
  window.dispatchEvent(new CustomEvent('auth:token-changed', { detail: fresh }))
}

/**
 * Ist der Token nach seiner eigenen Ablaufzeit abgelaufen?
 *
 * Nur dann darf "Sitzung abgelaufen" erscheinen. Ein Token, der aus anderen
 * Gruenden abgelehnt wird (unbekanntes Format, Server mit neuer Datenbank,
 * geloeschter Benutzer), ist nicht abgelaufen - dort wird still abgemeldet.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return false
  const exp = decodeTokenExp(token)
  return exp !== null && exp <= Date.now()
}

/**
 * Login-Endpunkte: ein 401 heisst dort "Zugangsdaten falsch", nicht
 * "Sitzung abgelaufen". Solche Antworten duerfen keinen Ablauf-Hinweis ausloesen.
 */
export function isLoginRequest(url: string): boolean {
  return /\/auth\/(?:admin\/)?login\/?$/.test(url.split('?')[0])
}

/**
 * Meldet eine 401-Antwort an die App - **mit** dem Token, der dabei mitgeschickt
 * wurde (`event.detail`).
 *
 * Der Token ist der entscheidende Teil: eine 401 kann von einer Anfrage stammen,
 * die schon lange laeuft (grosser Einrichteplan ueber das Netz), waehrend die
 * Sitzung laengst erneuert oder neu angemeldet wurde. `expireSession` im
 * AuthContext vergleicht den gemeldeten Token mit dem aktuell gespeicherten und
 * laesst die neuere Sitzung bestehen - sonst beendet die verspaetete Antwort
 * eine gerade erst angemeldete Sitzung, und der Nutzer landet ohne Fehlermeldung
 * sofort wieder auf der Anmeldeseite.
 */
export function reportExpiredSession(token: string | null): void {
  if (!token) return
  window.dispatchEvent(new CustomEvent('auth:expired', { detail: token }))
}

/**
 * Ab dieser Restlaufzeit wird vor einer Anfrage beim Server nachgefragt, ob die
 * Sitzung noch gilt (siehe `ensureFreshToken`).
 */
export const TOKEN_RENEW_MARGIN_MS = 5_000

/**
 * Ab dieser Restlaufzeit wird der Nutzer gewarnt ("Sitzung läuft in X Min ab")
 * und kann sie mit einem Klick verlängern.
 */
export const TOKEN_WARN_MARGIN_MS = 5 * 60_000

/** Ergebnis einer Sitzungs-Prüfung. */
export type SessionPing = 'ok' | 'expired'

/** Läuft gerade eine Prüfung? Verhindert, dass mehrere Anfragen sie auslösen. */
let renewing: Promise<SessionPing> | null = null

/**
 * Beim Server nachfragen, ob die Sitzung noch gilt, und den erneuerten Token
 * übernehmen (`GET /auth/me` + `X-New-Token`).
 *
 * Gebraucht an drei Stellen: vor einer Anfrage, für den Knopf „Sitzung
 * verlängern" und für das Lebenszeichen, solange ein Einrichteplan offen ist.
 *
 * Wichtig: **Nur eine 401 bedeutet „abgelaufen".** Ein Serverfehler (500, 502)
 * oder ein Netzfehler darf niemanden abmelden – sonst wirft ein kurzer Aussetzer
 * des Backends den Nutzer aus einer völlig gültigen Sitzung.
 */
export async function pingSession(): Promise<SessionPing> {
  const token = localStorage.getItem('token')
  // Ohne Token gibt es nichts zu prüfen (z. B. Login-Anfrage).
  if (!token) return 'ok'

  let res: Response
  try {
    res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    // Netzfehler: nicht abmelden - die eigentliche Anfrage zeigt den Fehler.
    return 'ok'
  }

  if (res.ok) {
    applyRenewedToken(res)
    return 'ok'
  }

  // Alles außer 401 ist **kein** Ablauf (Serverfehler, Proxy-Fehler, 403 …).
  if (res.status !== 401) return 'ok'

  // Während der Prüfung kann eine andere Antwort die Sitzung erneuert haben -
  // dann ist diese Ablehnung veraltet und die Anfrage darf laufen.
  const current = localStorage.getItem('token')
  if (!current) return 'expired'
  if (current !== token && !isTokenExpired(current)) return 'ok'

  reportExpiredSession(current)
  return 'expired'
}

/**
 * Sorgt dafür, dass eine Anfrage **nicht** mit einem abgelaufenen Token
 * hinausgeht.
 *
 * Ist der gespeicherte Token (fast) abgelaufen, wird zuerst `pingSession()`
 * gefragt:
 *
 * - Der Server nimmt den Token noch an (gerade eben abgelaufen, oder die Uhr des
 *   Rechners geht vor) -> erneuerter Token wird übernommen, die Anfrage läuft.
 * - Der Server lehnt mit 401 ab -> Sitzung ist wirklich vorbei; es wird
 *   abgemeldet (`auth:expired`) und die aussichtslose Anfrage unterbleibt.
 *
 * Die Entscheidung liegt damit **beim Server**, nicht bei der Uhr des Browsers -
 * eine falsch gestellte Uhr kann so niemanden aussperren. Ohne diese Prüfung
 * lief der Klick auf einen Serienartikel mit abgelaufener Sitzung in eine Salve
 * von 401-Antworten: Die Vorschau ging kurz auf, alle Dateien wurden abgelehnt
 * und erst danach erschien die Anmeldeseite.
 */
export async function ensureFreshToken(): Promise<SessionPing> {
  const token = localStorage.getItem('token')
  // Keine Sitzung (z. B. Login-Anfrage): nichts zu prüfen.
  if (!token) return 'ok'

  const exp = decodeTokenExp(token)
  // Unlesbarer Ablauf oder noch genug Zeit: nicht extra nachfragen.
  if (exp === null || exp > Date.now() + TOKEN_RENEW_MARGIN_MS) return 'ok'

  renewing ??= pingSession().finally(() => {
    renewing = null
  })
  return renewing
}
