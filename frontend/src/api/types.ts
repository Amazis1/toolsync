// Zentrale TypeScript-Typen für die API (Spiegelung der Backend-Schemas)

// ------------------------------------------------------------
// User, Role, Permission (Admin-Bereich)
// ------------------------------------------------------------
export interface Role {
  id: number
  name: string
  permissions: Permission[]
  created_at: string
  updated_at: string
}

export interface Permission {
  id: number
  name: string
  codename: string
  created_at: string
  updated_at: string
}

export interface RoleInput {
  name: string
  permission_ids?: number[]
}

export interface PermissionInput {
  name: string
  codename: string
}

export interface User {
  id: number
  first_name: string
  last_name: string
  display_name?: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface UserInput {
  personal_number: string
  first_name: string
  last_name: string
  display_name?: string | null
  is_active: boolean
  is_admin: boolean
  hashed_password?: string | null
}

// ------------------------------------------------------------
// Stammdaten (Plants, Customers, Machines, ToolTypes)
// ------------------------------------------------------------

export interface Plant {
  id: number
  name: string
}

export interface Customer {
  id: number
  name: string
  // Optionale Kundenfarbe als Hex-Code (z. B. "#0f766e"); null = keine Farbe
  color: string | null
  created_at: string
  updated_at: string
}

export interface Machine {
  id: number
  name: string
  plant_id: number | null
  /** Optionale Farbe aus den Stammdaten (#RRGGBB); null = kein Farbpunkt. */
  color: string | null
  created_at: string
  updated_at: string
}

export interface ToolType {
  id: number
  name: string
}

// Exakte Werte aus backend/app/models/enums.py (ToolCategory)
export type ToolCategory = 'Stempel' | 'Abstreifer' | 'Matrize'

// Exakte Werte aus backend/app/models/enums.py (ToolStatus)
export type ToolStatus = 'available' | 'lent' | 'in_transit' | 'defective' | 'maintenance'

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  Stempel: 'Stempel',
  Abstreifer: 'Abstreifer',
  Matrize: 'Matrize',
}

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  available: 'Verfügbar',
  lent: 'Ausgeliehen',
  in_transit: 'In Transit',
  defective: 'Defekt',
  maintenance: 'In Wartung',
}

export interface Tool {
  id: number
  /** Fachliche Werkzeug-ID. null = ohne ID (Abstreifer/Matrize), siehe DEC-055. */
  tool_id: string | null
  category: ToolCategory
  status: ToolStatus | null
  is_storage: boolean
  allow_duplicate_id: boolean
  measure_a: string | null
  measure_b: string | null
  description: string | null
  plant_id: number
  tool_type_id: number
  position_id: number | null
  machine_id: number | null
  customer_id: number | null
  /** Globaler Favorit (für alle Benutzer gleich) – siehe ToolList. */
  is_favorite: boolean
  /** Lagerplatz-Code wie "01-A-25"; null = Ablage (kein fester Platz). */
  position_code: string | null
  // Beziehungen werden vom Backend direkt mitgeliefert (lazy="joined")
  plant: Plant | null
  tool_type: ToolType | null
  customer?: Customer | null
  machine?: Machine | null
  created_at: string
  updated_at: string
}

/** Sortierbare Spalten der Werkzeugliste (Whitelist, spiegelt das Backend). */
export type ToolSortKey =
  | 'tool_id'
  | 'description'
  | 'measure_a'
  | 'status'
  | 'plant'
  | 'tool_type'
  | 'location'
  | 'customer'
  | 'machine'

export type ToolSortOrder = 'asc' | 'desc'

/** Eine Seite der Werkzeugliste samt Gesamtzahl der Treffer. */
export interface ToolPage {
  items: Tool[]
  total: number
  skip: number
  limit: number
}

export interface ToolInput {
  /** null = ohne ID. Nur für Abstreifer und Matrize erlaubt (DEC-055). */
  tool_id: string | null
  category: ToolCategory
  status: ToolStatus | null
  is_storage: boolean
  allow_duplicate_id: boolean
  measure_a: string | null
  measure_b: string | null
  description: string | null
  plant_id: number
  tool_type_id: number
  position_id: number | null
  machine_id: number | null
  customer_id: number | null
}

