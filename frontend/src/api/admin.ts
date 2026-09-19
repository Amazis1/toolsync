// API-Funktionen für den Admin-Bereich
import { http } from './client'
import type { Plant, ToolType } from './types'

// Kunden und Maschinen sind nach masterData.ts ausgelagert (dort auch für
// normale Benutzer lesbar) und werden hier re-exportiert, damit bestehende
// Admin-Importe unverändert weiterlaufen.
export {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getMachines,
  createMachine,
  updateMachine,
  deleteMachine,
} from './masterData'

// ------------------------------------------------------------
// Plants (Werke)
// ------------------------------------------------------------
export async function getPlants(): Promise<Plant[]> {
  return http.get<Plant[]>('/locations/plants')
}

export async function createPlant(name: string): Promise<Plant> {
  return http.post<Plant>('/locations/plants', { name })
}

export async function updatePlant(id: number, name: string): Promise<Plant> {
  return http.put<Plant>(`/locations/plants/${id}`, { name })
}

export async function deletePlant(id: number): Promise<void> {
  return http.delete<void>(`/locations/plants/${id}`)
}

// ------------------------------------------------------------
// Tool Types (Werkzeugtypen)
// ------------------------------------------------------------
export async function getToolTypes(): Promise<ToolType[]> {
  return http.get<ToolType[]>('/tools/types')
}

export async function createToolType(name: string): Promise<ToolType> {
  return http.post<ToolType>('/tools/types', { name })
}

export async function updateToolType(id: number, name: string): Promise<ToolType> {
  return http.put<ToolType>(`/tools/types/${id}`, { name })
}

export async function deleteToolType(id: number): Promise<void> {
  return http.delete<void>(`/tools/types/${id}`)
}