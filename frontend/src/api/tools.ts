// API-Funktionen für die Werkzeugverwaltung
import { http } from './client'
import type { Plant, Tool, ToolCategory, ToolInput, ToolType } from './types'

/** Antwort der Live-Prüfung der Werkzeug-ID. */
export interface ToolIdCheck {
  available: boolean
  existing_count: number
  message: string
}

/**
 * Prüft live, ob eine Werkzeug-ID frei ist.
 *
 * Bei Lager/Ersatz (isStorage=true) sind Mehrfach-IDs erlaubt – dann ist
 * `available` immer true und `existing_count` sagt, als wievieltes
 * Exemplar ein neues angelegt würde.
 */
export async function checkToolId(
  toolId: string,
  category: ToolCategory,
  plantId: number,
  isStorage: boolean,
  excludeId?: number,
): Promise<ToolIdCheck> {
  const params = new URLSearchParams({
    tool_id: toolId,
    category,
    plant_id: String(plantId),
    is_storage: String(isStorage),
  })
  if (excludeId !== undefined) {
    params.set('exclude_id', String(excludeId))
  }
  return http.get<ToolIdCheck>(`/tools/check-id?${params.toString()}`)
}

export async function getTools(): Promise<Tool[]> {
  return http.get<Tool[]>('/tools/?limit=500')
}

export async function getToolById(id: number): Promise<Tool> {
  return http.get<Tool>(`/tools/${id}`)
}

export async function createTool(input: ToolInput): Promise<Tool> {
  return http.post<Tool>('/tools/', input)
}

export async function updateTool(id: number, input: ToolInput): Promise<Tool> {
  return http.put<Tool>(`/tools/${id}`, input)
}

export async function deleteTool(id: number): Promise<void> {
  return http.delete<void>(`/tools/${id}`)
}

export async function getToolTypes(): Promise<ToolType[]> {
  return http.get<ToolType[]>('/tools/types')
}

export async function getPlants(): Promise<Plant[]> {
  return http.get<Plant[]>('/locations/plants')
}
