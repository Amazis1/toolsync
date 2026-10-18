// Typen der Werkzeug-Logistik (DEC-072).
//
// Sie spiegeln `backend/app/schemas/transport.py` **eins zu eins** – die Werte
// der Zustände kommen aus `backend/app/models/enums.py` (`TransportStatus`).

import type { Plant } from '../api/types'

/** Zustand eines Auftrags (Backend: `TransportStatus`). */
export type TransportStatus =
  | 'draft'
  | 'sent'
  | 'partly_received'
  | 'received'
  | 'cancelled'

export const TRANSPORT_STATUS_LABELS: Record<TransportStatus, string> = {
  draft: 'Entwurf',
  sent: 'unterwegs',
  partly_received: 'teilweise da',
  received: 'angekommen',
  cancelled: 'storniert',
}

/** Offene Zustände – ein Werkzeug darin ist belegt (DEC-072 Punkt 5). */
export const OFFENE_AUFTRAEGE: TransportStatus[] = ['draft', 'sent', 'partly_received']

/** Ein Werkzeug in einem Auftrag – der Empfang hängt an **dieser** Zeile. */
export interface TransportItem {
  id: number
  tool_id: number
  /** Fachliche Werkzeug-ID (`01025000`) – nur zum Anzeigen. */
  tool_code: string | null
  description: string | null
  category: string | null
  tool_type: string | null
  measure_a: string | null
  tool_status: string | null
  /** Heimatwerk des Werkzeugs. */
  home_plant: Plant | null
  /** Heimatplatz **zum Versandzeitpunkt** (`03-C-02`) – Nachweis, DEC-071. */
  home_position_code: string | null
  received_at: string | null
  received_by_name: string | null
  received_plant: Plant | null
  note: string | null
}

export interface TransportOrder {
  id: number
  /** Freitext der Auftrags-Nr. (SAP, Lieferschein …) – führend in der Liste. */
  order_number: string
  reference: string | null
  status: TransportStatus
  info: string | null
  from_plant: Plant | null
  to_plant: Plant | null
  /** Gesetzt beim Rück-Auftrag: zeigt auf den Hinweg (DEC-072 Punkt 1). */
  parent_order_id: number | null
  created_at: string
  created_by_name: string | null
  created_plant: Plant | null
  sent_at: string | null
  sent_by_name: string | null
  closed_at: string | null
  items: TransportItem[]
  item_count: number
  received_count: number
  /** Sicht des Arbeitswerks: `out` = Ausgang, `in` = Eingang, `null` = fremd. */
  direction: 'out' | 'in' | null
}

export interface TransportPage {
  items: TransportOrder[]
  total: number
}

/** Ein wählbares Werkzeug im Fenster „Neuer Auftrag". */
export interface TransportCandidate {
  tool_id: number
  tool_code: string | null
  description: string | null
  category: string | null
  tool_type: string | null
  measure_a: string | null
  status: string | null
  home_plant: Plant | null
  current_plant: Plant | null
  home_position_code: string | null
  open_order_number: string | null
  /** `null` = wählbar; sonst der Grund im Klartext („liegt in Werk 2"). */
  blocked: string | null
}

/** „Wo ist was" (DEC-077): nur unterwegs oder ausgeliehen. */
export interface AwayTool {  tool_id: number
  tool_code: string | null
  description: string | null
  category: string | null
  tool_type: string | null
  measure_a: string | null
  status: string | null
  home_plant: Plant | null
  home_position_code: string | null
  current_plant: Plant | null
  /** Bei Ausleihe: die Person. */
  lent_to: string | null
  /** Bei Transport: der offene Auftrag. */
  transport_id: number | null
  transport_number: string | null
  target_plant: Plant | null
}

/**
 * Ein Werkzeug aus einem **anderen** Werk, das hier liegt (DEC-081).
 * Grundlage des Fensters „Werkzeug zurück" – es geht an sein Heimatwerk zurück.
 */
export interface BorrowedTool {
  tool_id: number
  tool_code: string | null
  description: string | null
  category: string | null
  tool_type: string | null
  measure_a: string | null
  status: string | null
  /** Heimatwerk – dorthin geht es zurück. */
  home_plant: Plant | null
  home_position_code: string | null
  /** Wann es hier angekommen ist (letzter bestätigter Empfang). */
  arrived_at: string | null
  /** Auftrag, mit dem es kam. */
  arrived_with: string | null
}

export interface TransportItemInput {
  tool_id: number
  note?: string | null
}

/** Kopfdaten eines Auftrags (anlegen und ändern). */
export interface TransportOrderInput {
  order_number: string
  reference?: string | null
  to_plant_id: number
  info?: string | null
  items: TransportItemInput[]
}
