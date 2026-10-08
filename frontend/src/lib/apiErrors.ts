// Nutzersichtbare API-Fehlertexte – eine Quelle für Haupt-Frontend und AdminPanel.
//
// Eigenes Modul, damit der Anfrageweg (`lib/transport.ts`) diese Texte nutzen
// kann, ohne dass `lib/api.ts` und `api/client.ts` sich gegenseitig importieren.

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Technische Rumpftexte, die nie in der Oberfläche erscheinen dürfen:
 * Datenbank-/Stacktrace-Reste und englische Backend-Meldungen
 * (z. B. "Tool not found", "UNIQUE constraint failed", "str(exc)").
 */
const TECHNICAL_DETAIL =
  /(sql|alchemy|psycopg|asyncpg|integrity|constraint|violat|duplicate|unique|null|column|relation|foreign|traceback|exception|\berror\b|\bfailed\b|\binvalid\b|\bnot found\b|\bmissing\b|\bavailable\b|\bfile\b|\bcannot\b|\bundefined\b|\bunauthorized\b|\bforbidden\b|[{}=])/i

/** Ist der vom Backend gelieferte Text ein verständlicher, deutscher Satz? */
function isUserFacingDetail(text: string): boolean {
  if (!text || text.length > 160) return false
  if (/[\r\n]/.test(text)) return false
  return !TECHNICAL_DETAIL.test(text)
}

/** Deutsche, handlungsfähige Meldung nach HTTP-Status (wenn das Backend nichts Brauchbares sagt). */
function fallbackFor(status: number): string {
  if (status === 0) return 'Keine Verbindung zum Server. Prüfe das Netzwerk und versuche es erneut.'
  if (status === 400) return 'Die Eingaben wurden nicht übernommen. Prüfe deine Angaben und versuche es erneut.'
  if (status === 401) return 'Die Anmeldung ist abgelaufen. Melde dich neu an.'
  if (status === 403) return 'Dafür fehlt die Berechtigung. Wende dich an die Administration.'
  if (status === 404) return 'Der Eintrag existiert nicht mehr. Lade die Liste neu.'
  if (status === 409) return 'Der Eintrag existiert bereits. Prüfe deine Angaben.'
  if (status === 422) return 'Die Eingaben sind unvollständig oder ungültig. Prüfe die markierten Felder.'
  if (status >= 500) return 'Der Server konnte die Anfrage nicht verarbeiten. Versuche es später erneut.'
  return 'Das hat nicht funktioniert. Versuche es erneut.'
}

/**
 * Einzige Quelle für nutzersichtbare API-Fehlertexte (Haupt-Frontend und AdminPanel).
 * Bewusst formulierte deutsche Meldungen des Backends werden übernommen,
 * technische oder englische Texte ersetzt.
 */
export function getErrorMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail.trim() : ''
  if (isUserFacingDetail(text)) return text
  return fallbackFor(status)
}
