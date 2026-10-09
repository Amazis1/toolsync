// API-Funktionen für Ersatzteile (DEC-064)
import { http } from './client'
import type {
  SparePart,
  SparePartInput,
  SparePartNumberCheck,
  SparePartPage,
  SparePartSortKey,
  SparePartSortOrder,
} from '../types/spare-part'

/**
 * Parameter der Ersatzteil-Liste. Suche, Filter, Sortierung und Ausschnitt gehen
 * an das Backend – die Liste lädt immer nur eine Seite und kennt trotzdem die
 * Gesamtzahl (`total`).
 */
export interface SparePartListQuery {
  search?: string
  plantId?: number
  machineId?: number
  type?: string
  /** Nur favorisierte Teile (globaler Stern, DEC-063). */
  favoritesOnly?: boolean
  sort?: SparePartSortKey
  order?: SparePartSortOrder
  skip?: number
  limit?: number
}

export async function getSpareParts(
  query: SparePartListQuery = {},
): Promise<SparePartPage> {
  const params = new URLSearchParams()

  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.plantId != null) params.set('plant_id', String(query.plantId))
  if (query.machineId != null) params.set('machine_id', String(query.machineId))
  if (query.type?.trim()) params.set('type', query.type.trim())
  if (query.favoritesOnly) params.set('favorites_only', 'true')
  if (query.sort) params.set('sort', query.sort)
  if (query.order) params.set('order', query.order)
  params.set('skip', String(query.skip ?? 0))
  params.set('limit', String(query.limit ?? 25))

  return http.get<SparePartPage>(`/spare-parts/?${params.toString()}`)
}

/**
 * Live-Prüfung der Artikelnummer während des Tippens.
 *
 * Sie **blockiert nicht** (anders als beim Serienartikel, wo die Nummer eindeutig
 * ist): sie sagt nur, wie oft es die Nummer schon gibt (DEC-064 Punkt 8).
 */
export async function checkSparePartNumber(
  articleNumber: string,
  excludeId?: number,
): Promise<SparePartNumberCheck> {
  const params = new URLSearchParams({ article_number: articleNumber })
  if (excludeId !== undefined) params.set('exclude_id', String(excludeId))
  return http.get<SparePartNumberCheck>(`/spare-parts/check-article-number?${params.toString()}`)
}

/** Ersatzteil anlegen – jeder aktive Benutzer darf das (DEC-064 Punkt 10). */
export async function createSparePart(input: SparePartInput): Promise<SparePart> {
  return http.post<SparePart>('/spare-parts/', input)
}

/** Ersatzteil ändern – jeder aktive Benutzer (Löschen ist Admin-Sache). */
export async function updateSparePart(
  id: number,
  input: SparePartInput,
): Promise<SparePart> {
  return http.put<SparePart>(`/spare-parts/${id}`, input)
}

/** Ersatzteil löschen (nur Admin). Es hängt nichts daran – keine Dateien, keine Bewegungen. */
export async function deleteSparePart(id: number): Promise<void> {
  return http.delete<void>(`/spare-parts/${id}`)
}

/**
 * Favoriten-Markierung setzen.
 *
 * Sie gilt **global** (für alle Benutzer), deshalb gibt es keinen Bezug zum
 * angemeldeten Konto – wie bei Werkzeug, Serienartikel und Datenblatt
 * (DEC-063). Eigener Endpunkt, damit Bearbeiten die Markierung nicht
 * zurücksetzt.
 */
export async function setSparePartFavorite(
  id: number,
  isFavorite: boolean,
): Promise<SparePart> {
  return http.put<SparePart>(`/spare-parts/${id}/favorite`, { is_favorite: isFavorite })
}
