// API-Funktionen für die Lagerplatz-Verwaltung (Admin)
import { http } from './client'
import type { ToolStatus } from './types'

// ------------------------------------------------------------
// Cabinet (Schrank)
// ------------------------------------------------------------
export interface Cabinet {
  id: number
  name: string
  plant_id: number
  created_at: string
  updated_at: string
}

export async function getCabinets(plantId: number): Promise<Cabinet[]> {
  return http.get<Cabinet[]>(`/locations/cabinets?plant_id=${plantId}`)
}

export async function createCabinet(name: string, plantId: number): Promise<Cabinet> {
  return http.post<Cabinet>('/locations/cabinets', { name, plant_id: plantId })
}

export async function updateCabinet(id: number, name: string, plantId: number): Promise<Cabinet> {
  return http.put<Cabinet>(`/locations/cabinets/${id}`, { name, plant_id: plantId })
}

export async function deleteCabinet(id: number): Promise<void> {
  return http.delete<void>(`/locations/cabinets/${id}`)
}

// ------------------------------------------------------------
// Schrank als Matrix anlegen (Schubladen + Plätze automatisch)
// ------------------------------------------------------------
export interface DrawerMatrixInput {
  name: string
  cols: number
  rows: number
}

export async function createCabinetMatrix(
  name: string,
  plantId: number,
  drawers: DrawerMatrixInput[],
): Promise<Cabinet> {
  return http.post<Cabinet>('/locations/cabinets/matrix', {
    name,
    plant_id: plantId,
    drawers,
  })
}

// ------------------------------------------------------------
// Drawer (Schublade)
// ------------------------------------------------------------
export interface Drawer {
  id: number
  name: string
  cols: number
  rows: number
  cabinet_id: number
  positions?: Position[]
  created_at: string
  updated_at: string
}

export async function getDrawers(cabinetId: number): Promise<Drawer[]> {
  return http.get<Drawer[]>(`/locations/drawers?cabinet_id=${cabinetId}`)
}

export async function createDrawer(
  name: string,
  cols: number,
  rows: number,
  cabinetId: number,
): Promise<Drawer> {
  return http.post<Drawer>('/locations/drawers', {
    name,
    cols,
    rows,
    cabinet_id: cabinetId,
  })
}

export async function updateDrawer(
  id: number,
  name: string,
  cols: number,
  rows: number,
  cabinetId: number,
): Promise<Drawer> {
  return http.put<Drawer>(`/locations/drawers/${id}`, {
    name,
    cols,
    rows,
    cabinet_id: cabinetId,
  })
}

export async function deleteDrawer(id: number): Promise<void> {
  return http.delete<void>(`/locations/drawers/${id}`)
}

// ------------------------------------------------------------
// Position (Platz) – ist der eigentliche Lagerort
// ------------------------------------------------------------
export interface Position {
  id: number
  name: string
  x: number
  y: number
  drawer_id: number
  tool_id: number | null
  tool?: {
    id: number
    tool_id: string
    description: string | null
    status: ToolStatus | null
  } | null
  created_at: string
  updated_at: string
}

// Auflösung Position -> Schublade -> Schrank (für die Formular-Vorbelegung)
export interface PositionContext {
  position_id: number
  position_name: string
  drawer_id: number
  drawer_name: string
  cabinet_id: number
  cabinet_name: string
  plant_id: number
}

export async function getPositionContext(positionId: number): Promise<PositionContext> {
  return http.get<PositionContext>(`/locations/positions/${positionId}/context`)
}

export async function getPositions(drawerId: number): Promise<Position[]> {
  return http.get<Position[]>(`/locations/positions?drawer_id=${drawerId}`)
}

export type MoveAction = 'move' | 'swap' | 'insert_at'

export async function movePosition(
  sourcePositionId: number,
  targetPositionId: number,
  action: MoveAction,
): Promise<Position[]> {
  return http.post<Position[]>('/locations/positions/move', {
    source_position_id: sourcePositionId,
    target_position_id: targetPositionId,
    action,
  })
}

// ------------------------------------------------------------
// Werkzeug-Ablage (nicht eingelagerte Werkzeuge)
// ------------------------------------------------------------
export interface TrayTool {
  id: number
  tool_id: string
  description: string | null
  status: ToolStatus | null
}

export async function getTrayTools(plantId: number): Promise<TrayTool[]> {
  return http.get<TrayTool[]>(`/locations/tray?plant_id=${plantId}`)
}

export async function placeToolAtPosition(
  toolId: number,
  targetPositionId: number,
): Promise<Position[]> {
  return http.post<Position[]>('/locations/positions/place-tool', {
    tool_id: toolId,
    target_position_id: targetPositionId,
  })
}

export async function releaseToolFromPosition(positionId: number): Promise<Position[]> {
  return http.post<Position[]>('/locations/positions/release-tool', {
    position_id: positionId,
  })
}

export interface ReleaseResult {
  released_tools: number
}

export async function deleteCabinetWithResult(id: number): Promise<ReleaseResult> {
  return http.delete<ReleaseResult>(`/locations/cabinets/${id}`)
}

export async function deleteDrawerWithResult(id: number): Promise<ReleaseResult> {
  return http.delete<ReleaseResult>(`/locations/drawers/${id}`)
}