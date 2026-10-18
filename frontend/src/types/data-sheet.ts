import type { Machine, Plant } from '../api/types'

/**
 * Ein **Datenblatt**: PDF mit den Einstellwerten eines Werkzeugs für eine
 * Maschine (DEC-065).
 *
 * Abgrenzung zum Serienartikel: Der Serienartikel beantwortet „**was** braucht
 * der Auftrag" (Artikelnummer, Kunde, Einrichteplan), das Datenblatt „**wie**
 * wird das Werkzeug eingerichtet" (Werkzeug-ID, Maschine, Einstellwerte).
 */

/** Sortierbare Spalten – müssen zur Whitelist im Backend passen. */
export type DataSheetSortKey = 'tool_id' | 'name' | 'plant' | 'machine' | 'created_at'

export type DataSheetSortOrder = 'asc' | 'desc'

/** Eine hinterlegte Datei (`plan.pdf`, `plan-2.pdf` … oder `bild-1.jpg` …). */
export interface DataSheetFile {
  name: string
  size: number
  kind: 'plan' | 'image'
}

export interface DataSheet {
  id: number
  /** Werkzeug-ID – empfohlen, aber **nicht** Pflicht (DEC-055) und nicht eindeutig. */
  tool_id: string | null
  /** Werk; **null** = gilt für alle Werke (DEC-085). */
  plant_id: number | null
  machine_id: number | null
  name: string | null
  description: string | null
  /** Ist mindestens ein Datenblatt (PDF) hinterlegt? */
  has_pdf: boolean
  /** Globaler Favorit (nicht pro Benutzer, wie DEC-063). */
  is_favorite: boolean
  /** Datenblätter (`plan.pdf`, `plan-2.pdf` …). */
  plans: DataSheetFile[]
  /** Bilder zum Datenblatt (`bild-1.jpg` …). */
  images: DataSheetFile[]
  plant: Plant | null
  machine: Machine | null
  created_at: string
  updated_at: string
}

/**
 * Werte aus dem Formular (Anlegen und Ändern).
 *
 * `description` ist **freiwillig im Formular** (das Feld wurde entfernt): bleibt
 * der Wert `undefined`, schickt die API das Feld gar nicht mit – das Backend
 * lässt es dann unverändert. So geht eine vorhandene Beschreibung bei einer
 * Änderung nicht verloren.
 */
export interface DataSheetInput {
  tool_id: string | null
  /** **null** = gilt für alle Werke (DEC-085). */
  plant_id: number | null
  machine_id: number | null
  name: string | null
  description?: string | null
}

export interface DataSheetPage {
  items: DataSheet[]
  total: number
  skip: number
  limit: number
}

/**
 * Antwort der Live-Prüfung „gibt es zu dieser Werkzeug-ID schon ein Datenblatt?".
 *
 * Ein Treffer ist **kein** Fehler: mehrere Datenblätter je Werkzeug-ID sind
 * erlaubt (andere Maschine, andere Auflage) – anders als die eindeutige
 * Artikelnummer des Serienartikels.
 */
export interface DataSheetToolIdCheck {
  existing_count: number
  message: string
}
