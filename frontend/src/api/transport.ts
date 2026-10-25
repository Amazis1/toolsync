// API-Funktionen der Werkzeug-Logistik (DEC-072).
//
// Das Arbeitswerk geht **nicht** als Parameter mit: es steckt als `X-Plant-Id`
// in jeder Anfrage (`lib/transport.ts`) und entscheidet auf dem Server, was
// „mein Ausgang", „mein Eingang" und „hier wählbar" bedeutet.

import { http } from './client'
import type {
  AwayTool,
  BorrowedTool,
  TransportCandidate,
  TransportOrder,
  TransportOrderInput,
  TransportPage,
  TransportStatus,
} from '../types/transport'

/** Aufträge des Arbeitswerks – Richtung, Zustand, Suche, Seiten. */
export async function getOrders(params?: {
  direction?: 'out' | 'in' | 'both'
  status?: TransportStatus[]
  q?: string
  /** Nur Aufträge, die **ich** angelegt habe (DEC-090). */
  mine?: boolean
  skip?: number
  limit?: number
}): Promise<TransportPage> {
  const such = new URLSearchParams()
  if (params?.direction) such.set('direction', params.direction)
  if (params?.status?.length) such.set('status', params.status.join(','))
  if (params?.q?.trim()) such.set('q', params.q.trim())
  if (params?.mine) such.set('mine', 'true')
  if (params?.skip !== undefined) such.set('skip', String(params.skip))
  if (params?.limit !== undefined) such.set('limit', String(params.limit))
  const query = such.toString()
  return http.get<TransportPage>(`/transport/orders${query ? `?${query}` : ''}`)
}

/** Einzelner Auftrag mit Zeilen – Grundlage des Nachweis-Fensters. */
export async function getOrder(id: number): Promise<TransportOrder> {
  return http.get<TransportOrder>(`/transport/orders/${id}`)
}

/** Auftrag anlegen (Entwurf) – die Werkzeuge sind damit belegt. */
export async function createOrder(input: TransportOrderInput): Promise<TransportOrder> {
  return http.post<TransportOrder>('/transport/orders', input)
}

/** Kopf und Zeilen eines **Entwurfs** ändern. */
export async function updateOrder(
  id: number,
  input: TransportOrderInput,
): Promise<TransportOrder> {
  return http.put<TransportOrder>(`/transport/orders/${id}`, input)
}

/** „Als unterwegs melden": Werkzeuge werden `in_transit`, Plätze bleiben. */
export async function sendOrder(id: number): Promise<TransportOrder> {
  return http.post<TransportOrder>(`/transport/orders/${id}/send`, undefined)
}

/** Entwurf stornieren – gibt die Werkzeuge wieder frei. */
export async function cancelOrder(id: number): Promise<TransportOrder> {
  return http.post<TransportOrder>(`/transport/orders/${id}/cancel`, undefined)
}

/**
 * Empfang bestätigen.
 *
 * Ohne `itemIds` gilt der Empfang **allen** noch offenen Zeilen („Alles
 * angekommen"); mit Auswahl nur den angehakten („Nur Auswahl").
 */
export async function receiveOrder(
  id: number,
  itemIds?: number[],
  note?: string | null,
): Promise<TransportOrder> {
  return http.post<TransportOrder>(`/transport/orders/${id}/receive`, {
    item_ids: itemIds && itemIds.length > 0 ? itemIds : null,
    note: note?.trim() || null,
  })
}

/**
 * Rück-Auftrag anlegen (DEC-072 Punkt 1): ein eigener Auftrag mit
 * `parent_order_id` auf den Hinweg. Ohne `toolIds` gehen alle angekommenen
 * Werkzeuge zurück (DEC-078: einzeln ist der Normalfall).
 */
export async function returnOrder(
  id: number,
  toolIds?: number[],
  info?: string | null,
): Promise<TransportOrder> {
  return http.post<TransportOrder>(`/transport/orders/${id}/return`, {
    tool_ids: toolIds && toolIds.length > 0 ? toolIds : null,
    info: info?.trim() || null,
  })
}

/** Auswahl für „Neuer Auftrag": alle Werkzeuge **mit** Sperrgrund. */
export async function getCandidates(q?: string): Promise<TransportCandidate[]> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return http.get<TransportCandidate[]>(`/transport/candidates${query}`)
}

/** „Wo ist was" (DEC-077): unterwegs + ausgeliehen. */
export async function getAwayTools(): Promise<AwayTool[]> {
  return http.get<AwayTool[]>('/transport/away')
}

/**
 * Werkzeuge aus **anderen** Werken, die hier liegen (DEC-081).
 * Grundlage des Fensters „Werkzeug zurück": Sie gehen an ihr Heimatwerk zurück.
 */
export async function getBorrowedTools(): Promise<BorrowedTool[]> {
  return http.get<BorrowedTool[]>('/transport/borrowed')
}
