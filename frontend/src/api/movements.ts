// API-Funktionen für Werkzeugbewegungen
import { http } from './client'
import type { ActiveLoan, ToolMovement, ToolMovementInput } from '../types/movement'
import type { Tool } from './types'

/**
 * Lädt eine Liste von Werkzeugbewegungen.
 * Optional kann nach Werkzeug, Benutzer und per Pagination gefiltert werden.
 */
export async function getMovements(params?: {
  tool_id?: number
  user_id?: number
  plant_id?: number
  skip?: number
  limit?: number
}): Promise<ToolMovement[]> {
  const urlParams = new URLSearchParams()
  if (params?.tool_id !== undefined) urlParams.set('tool_id', String(params.tool_id))
  if (params?.user_id !== undefined) urlParams.set('user_id', String(params.user_id))
  if (params?.plant_id !== undefined) urlParams.set('plant_id', String(params.plant_id))
  if (params?.skip !== undefined) urlParams.set('skip', String(params.skip))
  if (params?.limit !== undefined) urlParams.set('limit', String(params.limit))

  const query = urlParams.toString()
  return http.get<ToolMovement[]>(`/movements/${query ? `?${query}` : ''}`)
}

/**
 * Erstellt eine neue Werkzeugbewegung.
 * id und timestamp werden vom Backend erzeugt; den ausführenden Benutzer setzt
 * der Server aus dem Token (DEC-078) – `user_id` im Body wird überschrieben.
 */
export async function createMovement(data: ToolMovementInput): Promise<ToolMovement> {
  return http.post<ToolMovement>('/movements/', data)
}

/**
 * Ein einzelnes Werkzeug zurücknehmen (DEC-078).
 *
 * Der Server setzt den Status auf `available` und schreibt die Bewegung mit
 * Ausgangsort (Heimatplatz), Rückgabeort (Arbeitswerk), Benutzer und Zeitpunkt –
 * in einer Transaktion. `note` ist freiwillig.
 */
export async function returnTool(toolId: number, note?: string | null): Promise<Tool> {
  return http.post<Tool>(`/movements/return/${toolId}`, {
    note: note?.trim() || null,
  })
}

/**
 * Laufende Ausleihen des Arbeitswerks (`GET /movements/active`, DEC-078):
 * Werkzeug, Platz, Ausleiher, Zeitpunkt.
 *
 * Die Oberfläche nutzt sie derzeit **nicht** – die Rückgabe an Personen läuft
 * über das Zeilenmenü, und „Werkzeug zurück" in der Logistik meint die
 * Werkzeuge aus anderen **Werken** (DEC-081). Der Endpunkt bleibt, weil die
 * Auswertung („was ist draußen") darauf aufbaut.
 */
export async function getActiveLoans(): Promise<ActiveLoan[]> {
  return http.get<ActiveLoan[]>('/movements/active')
}
