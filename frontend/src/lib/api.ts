import type { SerialArticle, SerialArticleInput } from '../types/serial-article'

const API_BASE = '/api'

export interface UserInfo {
  id: number
  first_name: string
  last_name: string
  display_name?: string | null
  is_active: boolean
    is_admin: boolean
  }

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserInfo
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function getErrorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string' && detail) {
    return detail
  }
  if (status === 401) {
    return 'Ungültige Personalnummer oder Passwort'
  }
  return 'Die Anfrage ist fehlgeschlagen. Bitte versuche es später erneut.'
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, options)
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server. Läuft das Backend?')
  }
  if (!res.ok) {
    let detail: unknown
    try {
      const data = await res.json()
      detail = (data as { detail?: unknown }).detail
    } catch {
      // Kein JSON-Body vorhanden – generische Meldung verwenden
  }
    throw new ApiError(res.status, getErrorMessage(res.status, detail))
}

  // 204 (No Content) hat keinen JSON-Body
  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

export async function loginUser(personalNumber: string): Promise<LoginResponse> {
  return request<LoginResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personal_number: personalNumber }),
  })
  }

export async function loginAdmin(personalNumber: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personal_number: personalNumber, password }),
  })
}

export async function getCurrentUser(token: string): Promise<UserInfo> {
  return request<UserInfo>(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  }

export function getDisplayName(user: UserInfo): string {
  if (user.display_name) return user.display_name
  return `${user.first_name} ${user.last_name}`.trim()
}

/* ============================================================
 * Serienartikel (PDF-Einrichtepläne)
 * ============================================================ */

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getSerialArticles(search?: string): Promise<SerialArticle[]> {
  const params = new URLSearchParams()
  if (search && search.trim()) params.set('search', search.trim())
  const query = params.toString()
  const url = `${API_BASE}/serial-articles/${query ? `?${query}` : ''}`
  return request<SerialArticle[]>(url, { headers: getAuthHeaders() })
}

/**
 * Erstellt einen Serienartikel. Das PDF wird als multipart/form-data
 * mitgeschickt. WICHTIG: Kein Content-Type manuell setzen – der Browser
 * erzeugt die multipart boundary automatisch.
 */
export async function createSerialArticle(
  input: SerialArticleInput,
  file: File | null,
): Promise<SerialArticle> {
  const formData = new FormData()
  formData.append('article_number', input.article_number)
  if (input.description) formData.append('description', input.description)
  if (file) formData.append('file', file)

  return request<SerialArticle>(`${API_BASE}/serial-articles/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
}

export async function deleteSerialArticle(id: number): Promise<void> {
  return request<void>(`${API_BASE}/serial-articles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
}

/**
 * Lädt das PDF eines Serienartikels als Blob herunter.
 * Wird für die Vorschau (Blob-URL im iframe) und den Download verwendet.
 */
export async function getSerialArticlePdf(id: number): Promise<Blob> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/serial-articles/${id}/pdf`, {
      headers: getAuthHeaders(),
    })
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server. Läuft das Backend?')
  }
  if (!res.ok) {
    let detail: unknown
    try {
      const data = await res.json()
      detail = (data as { detail?: unknown }).detail
    } catch {
      // Kein JSON-Body vorhanden
    }
    throw new ApiError(res.status, getErrorMessage(res.status, detail))
  }
  return res.blob()
}

