// API-Funktionen für Werkzeugbewegungen
import { http } from './client'
import type { ToolMovement, ToolMovementInput } from '../types/movement'

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
 * id und timestamp werden vom Backend erzeugt.
 */
export async function createMovement(data: ToolMovementInput): Promise<ToolMovement> {
  return http.post<ToolMovement>('/movements/', data)
}
