// API-Funktionen für die Werkzeugverwaltung
import { http } from './client'
import type {
  Plant,
  Tool,
  ToolCategory,
  ToolInput,
  ToolPage,
  ToolSortKey,
  ToolSortOrder,
  ToolStatus,
  ToolType,
} from './types'

/**
 * Parameter der Werkzeugliste. Filter, Sortierung und Ausschnitt gehen an das
 * Backend – die Liste lädt immer nur eine Seite, nie die ganze Tabelle.
 */
export interface ToolListQuery {
  q?: string
  categories?: ToolCategory[]
  statuses?: ToolStatus[]
  plantId?: number
  toolTypeId?: number
  isStorage?: boolean
  hasPlace?: boolean
  favoritesOnly?: boolean
  sort?: ToolSortKey
  order?: ToolSortOrder
  skip?: number
  limit?: number
}

/** Ein vorhandener Datensatz mit derselben Werkzeug-ID (Fundort + Daten). */
export interface ToolIdLocation {
  id: number
  /** Platz-Code (z. B. "01-A-25") oder "Ablage". */
  location: string
  status: string | null
  /** false = normales Werkzeug, true = Lager/Ersatz. */
  is_storage: boolean
  position_id: number | null
  measure_a: string | null
  measure_b: string | null
  description: string | null
  tool_type_id: number
  tool_type_name: string | null
}

/** Vorschlag, welche Daten aus einem vorhandenen Datensatz übernommen werden. */
export interface ToolIdPrefill {
  source_id: number
  /** Fundort der Vorlage ("01-A-25" oder "Ablage"). */
  source_location: string | null
  source_is_storage: boolean
  measure_a: string | null
  measure_b: string | null
  description: string | null
  tool_type_id: number
  /** true = das neue Exemplar wird in die Ablage gelegt. */
  in_tray: boolean
}

/** Antwort der Live-Prüfung der Werkzeug-ID. */
export interface ToolIdCheck {
  available: boolean
  existing_count: number
  message: string
  /** Alle Datensätze dieser ID im Werk – normale Werkzeuge und Lager/Ersatz. */
  locations?: ToolIdLocation[]
  /** Übernahme-Vorschlag; null, wenn es nichts zu übernehmen gibt. */
  prefill?: ToolIdPrefill | null
}

/**
 * Prüft live, ob eine Werkzeug-ID frei ist.
 *
 * Bei Lager/Ersatz (isStorage=true) sind Mehrfach-IDs erlaubt – dann ist
 * `available` immer true. `locations` listet alle vorhandenen Datensätze
 * dieser ID (normale Werkzeuge und Lager/Ersatz), `prefill` schlägt vor,
 * welche Daten beim Anlegen übernommen werden.
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

export async function getTools(query: ToolListQuery = {}): Promise<ToolPage> {
  const params = new URLSearchParams()

  if (query.q?.trim()) params.set('q', query.q.trim())
  // Mehrfachwerte als wiederholte Parameter (?status=a&status=b) – so erwartet
  // es das Backend, und ein Komma in einem Suchbegriff kann nichts zerlegen.
  query.categories?.forEach((c) => params.append('category', c))
  query.statuses?.forEach((s) => params.append('status', s))
  if (query.plantId != null) params.set('plant_id', String(query.plantId))
  if (query.toolTypeId != null) params.set('tool_type_id', String(query.toolTypeId))
  if (query.isStorage != null) params.set('is_storage', String(query.isStorage))
  if (query.hasPlace != null) params.set('has_place', String(query.hasPlace))
  if (query.favoritesOnly) params.set('favorites_only', 'true')
  if (query.sort) params.set('sort', query.sort)
  if (query.order) params.set('order', query.order)
  params.set('skip', String(query.skip ?? 0))
  params.set('limit', String(query.limit ?? 25))

  return http.get<ToolPage>(`/tools/?${params.toString()}`)
}

/**
 * Setzt die Favoriten-Markierung. Sie gilt global (für alle Benutzer), deshalb
 * gibt es keinen Bezug zum angemeldeten Konto.
 */
export async function setToolFavorite(id: number, isFavorite: boolean): Promise<Tool> {
  return http.put<Tool>(`/tools/${id}/favorite`, { is_favorite: isFavorite })
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
