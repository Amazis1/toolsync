

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
  /** Arbeitswerk, in dem gehandelt wurde (DEC-070); null bei Altdaten. */
  plant_id?: number | null
  plant?: { id: number; name: string; color?: string | null } | null
}

/**
 * Eingabedaten zum Anlegen einer neuen Bewegung.
 * Achtung: id und timestamp werden vom Backend erzeugt
 * und dürfen hier nicht mitgeschickt werden.
 *
 * `user_id` setzt der Server aus dem Token (DEC-078) – ein mitgeschickter Wert
 * wird überschrieben. Das Arbeitswerk kommt aus dem Header `X-Plant-Id`.
 */
export interface ToolMovementInput {
  movement_type: MovementType
  from_location?: string | null
  to_location?: string | null
  note?: string | null
  tool_id: number
  user_id?: number | null
}

/**
 * Eine laufende Ausleihe (`GET /movements/active`, DEC-078).
 *
 * Grundlage der Rückgabe: Welche Werkzeuge des Arbeitswerks sind gerade bei einer
 * Person? Zurückgegeben wird **einzelnes** Werkzeug – nicht die ganze Liste.
 */
export interface ActiveLoan {
  movement_id: number
  tool_id: number
  tool_code: string | null
  description: string | null
  category: string | null
  measure_a: string | null
  position_code: string | null
  lent_at: string | null
  user_id: number | null
  user_display_name: string | null
  note: string | null
}

