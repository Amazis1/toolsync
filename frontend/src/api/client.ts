// Schlanker API-Client: zentrale Fehlerbehandlung + Auth-Token
import { ApiError } from '../lib/api'

const API_BASE = '/api'

function getErrorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string' && detail) {
    return detail
  }
  if (status === 401) {
    return 'Nicht angemeldet oder Sitzung abgelaufen.'
  }
  if (status === 403) {
    return 'Du hast keine Berechtigung für diese Aktion.'
  }
  return 'Die Anfrage ist fehlgeschlagen. Bitte versuche es später erneut.'
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${url}`, { ...options, headers })
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

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export const http = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
