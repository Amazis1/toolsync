// Der eine Anfrageweg für alle API-Aufrufe.
//
// Vorher gab es zwei Implementierungen (`lib/api.ts` und `api/client.ts`), die
// sich unterschiedlich verhielten: die eine setzte den Token aus dem Speicher,
// die andere nahm den übergebenen – nach einer Erneuerung lief eine Anfrage
// dadurch mitunter mit dem **alten** Token hinaus. Hier ist alles an einer
// Stelle: Token, Vorab-Prüfung der Sitzung, Übernahme des erneuerten Tokens
// (`X-New-Token`), 401-Behandlung und Fehlertexte.

import { ApiError, getErrorMessage } from './apiErrors'
import { applyRenewedToken, ensureFreshToken, isLoginRequest, reportExpiredSession } from './session'

const API_BASE = '/api'

/** Formulardaten unverändert durchreichen, alles andere als JSON senden. */
export function toBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body
  return JSON.stringify(body)
}

function isFormData(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

/** Der Token geht **immer** aus dem Speicher hervor – eine einzige Quelle. */
function currentToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * Eine Anfrage an `/api…` ausführen.
 *
 * Ablauf:
 * 1. Sitzung prüfen: Ist der Token (fast) abgelaufen, wird er vorher erneuert
 *    (siehe `ensureFreshToken`). Nur wenn der Server ihn ablehnt, wird abgemeldet.
 * 2. Token **nach** der Prüfung lesen – so geht nie ein veralteter Token hinaus.
 * 3. Antwort auswerten: erneuerter Token übernehmen, 401 zentral melden,
 *    sonst ein `ApiError` mit deutschem Text werfen.
 */
export async function send(url: string, options: RequestInit = {}): Promise<Response> {
  const loginRequest = isLoginRequest(url)
  const hatteToken = currentToken() !== null

  // Login-Anfragen sind ausgenommen: dort bedeutet 401 "Zugangsdaten falsch".
  if (hatteToken && !loginRequest) {
    const zustand = await ensureFreshToken()
    if (zustand === 'expired') {
      // Die Abmeldung wurde in `ensureFreshToken` bereits gemeldet; hier wird
      // nur noch die aussichtslose Anfrage verhindert.
      throw new ApiError(401, getErrorMessage(401, null))
    }
  }

  const token = currentToken()
  const headers: Record<string, string> = {
    // Bei Formulardaten darf **kein** Content-Type gesetzt werden: den
    // multipart-Boundary erzeugt der Browser selbst, ein manuell gesetzter
    // Header würde den Upload zerstören (gilt für den PDF-Upload).
    ...(isFormData(options.body) ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${url}`, { ...options, headers })
  } catch {
    throw new ApiError(0, getErrorMessage(0, null))
  }

  // Bei Aktivität erneuert das Backend die Sitzung -> neuen Token übernehmen.
  applyRenewedToken(res)

  if (!res.ok) {
    // 401: Sitzung abgelaufen -> zentral abmelden (AuthContext räumt auf).
    // Der benutzte Token geht als Detail mit: eine verspätete 401 einer alten
    // Anfrage darf eine inzwischen neu angemeldete Sitzung nicht beenden.
    if (res.status === 401 && token && !loginRequest) {
      reportExpiredSession(token)
    }
    let detail: unknown
    try {
      const data = await res.json()
      detail = (data as { detail?: unknown }).detail
    } catch {
      // Kein JSON-Body vorhanden - generische Meldung verwenden
    }
    throw new ApiError(res.status, getErrorMessage(res.status, detail))
  }

  return res
}

/** Anfrage mit JSON-Antwort. */
export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await send(url, options)

  // 204 (No Content) hat keinen JSON-Body
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

/** Anfrage mit Binärdaten (z. B. eine PDF) – nicht als JSON geparst. */
export async function requestBlob(url: string): Promise<Blob> {
  return (await send(url)).blob()
}

export { ApiError, getErrorMessage }
