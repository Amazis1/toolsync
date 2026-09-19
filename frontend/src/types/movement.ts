

/**
 * Typen für Werkzeugbewegungen.
 *
 * Eine Bewegung beschreibt einen Vorgang an einem Werkzeug:
 * Ausleihe, Rückgabe, Transfer, Umplatzierung oder Statusänderung.
 * Der timestamp wird vom Backend gesetzt und ist beim Erstellen nicht anzugeben.
 */

/**
 * Art der Bewegung:
 * - lend: Ausleihe
 * - return: Rückgabe
 * - transfer: Übergabe / Weitergabe
 * - relocate: Umplatzierung an einen anderen Lagerort
 * - status_change: Nur eine Statusänderung
 */
export type MovementType =
  | 'lend'
  | 'return'
  | 'transfer'
  | 'relocate'
  | 'status_change'

/**
 * Status einer Bewegung:
 * - open: angelegt, aber noch nicht abgeschlossen
 * - completed: abgeschlossen
 * - cancelled: storniert
 */
export type MovementStatus = 'open' | 'completed' | 'cancelled'

/**
 * Vollständige Bewegung, wie sie vom Backend geliefert wird.
 */
export interface ToolMovement {
  id: number
  movement_type: MovementType
  from_location: string | null
  to_location: string | null
  status: MovementStatus
  note: string | null
  timestamp: string
  tool_id: number
  user_id: number | null
  // Lesbare Infos für den Verlauf (vom Backend mitgeliefert)
  tool_code: string | null
  tool_description: string | null
  user_display_name: string | null
}

/**
 * Eingabedaten zum Anlegen einer neuen Bewegung.
 * Achtung: id und timestamp werden vom Backend erzeugt
 * und dürfen hier nicht mitgeschickt werden.
 */
export interface ToolMovementInput {
  movement_type: MovementType
  from_location?: string | null
  to_location?: string | null
  note?: string | null
  tool_id: number
  user_id?: number | null
}

