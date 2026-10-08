// Schlanker API-Client für die fachlichen Module (`http.get/post/…`).
//
// Der Anfrageweg selbst liegt in `lib/transport.ts` – Token, Sitzungs-Prüfung,
// Übernahme des erneuerten Tokens, 401-Behandlung und Fehlertexte gibt es damit
// nur **einmal** (vorher liefen `lib/api.ts` und diese Datei getrennt).

import { requestBlob, requestJson, toBody } from '../lib/transport'

export const http = {
  get: <T>(url: string) => requestJson<T>(url),
  post: <T>(url: string, body: unknown) =>
    requestJson<T>(url, { method: 'POST', body: toBody(body) }),
  put: <T>(url: string, body: unknown) =>
    requestJson<T>(url, { method: 'PUT', body: toBody(body) }),
  patch: <T>(url: string, body: unknown) =>
    requestJson<T>(url, { method: 'PATCH', body: toBody(body) }),
  delete: <T>(url: string) => requestJson<T>(url, { method: 'DELETE' }),
  /** Binärdaten (z. B. eine PDF) laden – nicht als JSON geparst. */
  blob: (url: string): Promise<Blob> => requestBlob(url),
}
