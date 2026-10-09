import type { Machine, Plant } from '../api/types'

/**
 * Ein Ersatzteil im Bereich „Ersatzteile" (DEC-064).
 *
 * Abgrenzung: Ein **Ersatzwerkzeug** ist ein Werkzeug mit Lagermarkierung
 * (`Tool.is_storage`) und steht in der Werkzeugliste. Ein **Ersatzteil** hat
 * keine Werkzeug-ID, sondern eine **Artikelnummer** als Identität, dazu Menge
 * und Einheit, einen Lagerort als Freitext und keinen Status.
 */

/** Sortierbare Spalten – müssen zur Whitelist im Backend passen. */
export type SparePartSortKey =
  | 'article_number'
  | 'name'
  | 'type'
  | 'plant'
  | 'machine'
  | 'storage_place'
  | 'quantity'
  | 'created_at'

export type SparePartSortOrder = 'asc' | 'desc'

export interface SparePart {
  id: number
  /** Identität des Teils – darf mehrfach vorkommen (Lagerorte, Chargen). */
  article_number: string
  name: string | null
  type: string | null
  /** Werk ist Pflicht (DEC-064 Punkt 5). */
  plant_id: number
  /** Mengenbestand als Spalte (Anforderung 8); 0 = aufgebraucht. */
  quantity: number
  unit: string | null
  machine_id: number | null
  /** Freitext „Regal B3 / Fach 2" – unabhängig vom Matrix-Platz. */
  storage_place: string | null
  /**
   * Konkreter Platz aus der **Werkzeug-Matrix** (freiwillig, zusätzlich zum
   * Freitext). Der Platz gilt dann als belegt: die Matrix zeigt das Ersatzteil,
   * Werkzeuge können dort nicht mehr abgelegt werden (DEC-064).
   */
  position_id: number | null
  /** Platz-Code wie „01-A-25" (aus Schrank, Schublade und Platzname). */
  position_code: string | null
  description: string | null
  created_at: string
  updated_at: string
  /**
   * GLOBALER Favorit (nicht pro Benutzer, DEC-063) – wie bei Werkzeug,
   * Serienartikel und Datenblatt. Gesetzt wird er über den eigenen Endpunkt
   * `PUT /spare-parts/{id}/favorite`, nicht über das Bearbeiten-Formular.
   */
  is_favorite: boolean
  // Für die Liste mitgelieferte Stammdaten (Werk ist Pflicht).
  plant: Plant | null
  machine: Machine | null
}

/** Werte aus dem Formular (Anlegen und Ändern sind identisch). */
export interface SparePartInput {
  article_number: string
  name: string | null
  type: string | null
  plant_id: number
  quantity: number
  unit: string | null
  machine_id: number | null
  storage_place: string | null
  position_id: number | null
  description: string | null
}

export interface SparePartPage {
  items: SparePart[]
  total: number
  skip: number
  limit: number
}

/**
 * Antwort der Live-Prüfung der Artikelnummer.
 *
 * Wichtig: `is_duplicate` ist **kein Fehler** – bei Ersatzteilen ist dieselbe
 * Nummer mehrfach der Normalfall (DEC-064 Punkt 8). Der Wert dient nur dem
 * Hinweis im Formular.
 */
export interface SparePartNumberCheck {
  existing_count: number
  message: string
  is_duplicate: boolean
}
