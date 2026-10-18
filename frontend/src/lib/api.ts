// Anmeldung und Benutzerinfo.
//
// Der eigentliche Anfrageweg (Token, Sitzungs-Prüfung, Fehlertexte) liegt in
// `lib/transport.ts` – hier stehen nur noch die fachlichen Aufrufe.

import { ApiError, getErrorMessage, requestJson } from './transport'

export { ApiError, getErrorMessage }

export interface UserInfo {
  id: number
  first_name: string
  last_name: string
  display_name?: string | null
  is_active: boolean
  is_admin: boolean
  /**
   * Vorgabe für das Arbeitswerk aus dem Benutzerkonto (DEC-070).
   * Kein Pflichtfeld – das Personal rotiert zwischen den Werken.
   */
  default_plant_id?: number | null
  /** Aufgelöstes Arbeitswerk dieses Requests (Server-Antwort von `/auth/me`). */
  plant_id?: number | null
  plant_name?: string | null
  plant_color?: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserInfo
}

export async function loginUser(personalNumber: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ personal_number: personalNumber }),
  })
}

export async function loginAdmin(personalNumber: string, password: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ personal_number: personalNumber, password }),
  })
}

/**
 * Den angemeldeten Benutzer laden (`GET /auth/me`).
 *
 * Bewusst **ohne** Token-Parameter: welcher Token mitgeht, entscheidet allein
 * der Anfrageweg aus dem Speicher. Ein übergebener Token konnte nach einer
 * Erneuerung veraltet sein – genau daraus entstanden Anfragen mit totem Token.
 */
export async function getCurrentUser(): Promise<UserInfo> {
  return requestJson<UserInfo>('/auth/me')
}

export function getDisplayName(user: UserInfo): string {
  if (user.display_name) return user.display_name
  return `${user.first_name} ${user.last_name}`.trim()
}
