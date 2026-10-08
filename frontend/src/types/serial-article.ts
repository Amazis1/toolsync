/**
 * Typen für Serienartikel (PDF-Einrichtepläne).
 *
 * Ein Serienartikel ist fachlich ein PDF-basierter Einrichteplan und ein
 * **eigener** Bereich: keine Beziehung zu Werkzeugen, eigene Artikelnummer
 * (DEC-056). Gefunden wird er über Artikelnummer, Name, Beschreibung, Werk,
 * Kunde und Maschine; Kunde, Maschine und Werk sind Stammdaten aus dem
 * Admin-Bereich.
 */

import type { Customer, Machine, Plant } from '../api/types'

/** Eine Datei im Artikelordner: Einrichteplan oder Bild (DEC-058, DEC-062). */
export interface ArticleFile {
  name: string
  size: number
  kind: 'plan' | 'image'
}

/** Bilder: Kurzname für Aufrufer, die nur Bilder meinen. */
export type ArticleImage = ArticleFile

export interface SerialArticle {
  id: number
  article_number: string
  /** Kurze Bezeichnung des Plans (freiwillig). */
  name: string | null
  plant_id: number
  customer_id: number | null
  machine_id: number | null
  description: string | null
  /** Ist mindestens ein Einrichteplan hinterlegt? Der Speicherpfad bleibt intern. */
  has_pdf: boolean
  /** Globaler Favorit (nicht pro Benutzer) – wie bei den Werkzeugen (DEC-063). */
  is_favorite: boolean
  /** Einrichtepläne (`plan.pdf`, `plan-2.pdf` …), nach Nummer sortiert. */
  plans: ArticleFile[]
  /** Bilder zum Plan, aus dem Artikelordner gelesen. */
  images: ArticleFile[]
  created_at: string
  updated_at: string
  plant?: Plant | null
  customer?: Customer | null
  machine?: Machine | null
}

export interface SerialArticleInput {
  article_number: string
  name?: string | null
  plant_id: number
  customer_id?: number | null
  machine_id?: number | null
  description?: string | null
}

export interface SerialArticlePage {
  items: SerialArticle[]
  total: number
  skip: number
  limit: number
}

/** Sortierbare Spalten – muss zum Backend passen (`SerialArticleSortKey`). */
export type SerialArticleSortKey =
  | 'article_number'
  | 'name'
  | 'plant'
  | 'customer'
  | 'machine'
  | 'created_at'

export type SerialArticleSortOrder = 'asc' | 'desc'

/** Antwort der Live-Prüfung der Artikelnummer. */
export interface ArticleNumberCheck {
  available: boolean
  existing_count: number
  message: string
  existing_id?: number | null
  existing_label?: string | null
}
