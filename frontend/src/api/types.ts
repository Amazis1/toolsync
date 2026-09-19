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
  tool_id: string
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
  // Beziehungen werden vom Backend direkt mitgeliefert (lazy="joined")
  plant: Plant | null
  tool_type: ToolType | null
  customer?: Customer | null
  created_at: string
  updated_at: string
}

export interface ToolInput {
  tool_id: string
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

