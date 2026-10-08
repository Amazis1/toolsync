// API-Funktionen für Serienartikel (PDF-Einrichtepläne, DEC-056/DEC-057)
import { http } from './client'
import type {
  ArticleNumberCheck,
  SerialArticle,
  SerialArticleInput,
  SerialArticlePage,
  SerialArticleSortKey,
  SerialArticleSortOrder,
} from '../types/serial-article'

/**
 * Parameter der Serienartikel-Liste. Suche, Filter, Sortierung und Ausschnitt
 * gehen an das Backend – die Liste lädt immer nur eine Seite und kennt trotzdem
 * die Gesamtzahl (`total`).
 */
export interface SerialArticleListQuery {
  search?: string
  plantId?: number
  customerId?: number
  machineId?: number
  hasPdf?: boolean
  favoritesOnly?: boolean
  sort?: SerialArticleSortKey
  order?: SerialArticleSortOrder
  skip?: number
  limit?: number
}

export async function getSerialArticles(
  query: SerialArticleListQuery = {},
): Promise<SerialArticlePage> {
  const params = new URLSearchParams()

  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.plantId != null) params.set('plant_id', String(query.plantId))
  if (query.customerId != null) params.set('customer_id', String(query.customerId))
  if (query.machineId != null) params.set('machine_id', String(query.machineId))
  if (query.hasPdf != null) params.set('has_pdf', String(query.hasPdf))
  if (query.favoritesOnly) params.set('favorites_only', 'true')
  if (query.sort) params.set('sort', query.sort)
  if (query.order) params.set('order', query.order)
  params.set('skip', String(query.skip ?? 0))
  params.set('limit', String(query.limit ?? 25))

  return http.get<SerialArticlePage>(`/serial-articles/?${params.toString()}`)
}

/**
 * Live-Prüfung der Artikelnummer während des Tippens (DEC-056 Punkt 7).
 * `excludeId` ist beim Bearbeiten die eigene Artikel-ID.
 */
export async function checkArticleNumber(
  articleNumber: string,
  excludeId?: number,
): Promise<ArticleNumberCheck> {
  const params = new URLSearchParams({ article_number: articleNumber })
  if (excludeId !== undefined) params.set('exclude_id', String(excludeId))
  return http.get<ArticleNumberCheck>(`/serial-articles/check-number?${params.toString()}`)
}

/**
 * Formulardaten für Anlegen und Ändern.
 *
 * Alle Felder werden **immer** mitgeschickt: ein leerer Wert bedeutet dem
 * Backend „Feld leeren" (Name, Beschreibung, Kunde, Maschine), ein fehlendes
 * Feld „unverändert". Nur so lässt sich ein Kunde wieder entfernen.
 *
 * Wichtig: `Content-Type` wird nicht gesetzt – der Browser erzeugt die
 * multipart-Boundary selbst (siehe `api/client.ts`).
 */
function toFormData(
  input: SerialArticleInput,
  plans: File[] = [],
  images: File[] = [],
): FormData {
  const form = new FormData()
  form.append('article_number', input.article_number.trim())
  form.append('plant_id', String(input.plant_id))
  form.append('name', input.name?.trim() ?? '')
  form.append('customer_id', input.customer_id != null ? String(input.customer_id) : '')
  form.append('machine_id', input.machine_id != null ? String(input.machine_id) : '')
  form.append('description', input.description?.trim() ?? '')
  // Mehrere Dateien: gleicher Feldname, mehrfach angehängt (List[UploadFile]).
  plans.forEach((plan) => form.append('plans', plan))
  images.forEach((bild) => form.append('images', bild))
  return form
}

/** Serienartikel anlegen (nur Admin). Pläne und Bilder sind optional. */
export async function createSerialArticle(
  input: SerialArticleInput,
  plans: File[] = [],
  images: File[] = [],
): Promise<SerialArticle> {
  return http.post<SerialArticle>('/serial-articles/', toFormData(input, plans, images))
}

/**
 * Serienartikel ändern (nur Admin). Mitgeschickte Pläne und Bilder kommen
 * **hinzu**; entfernt wird einzeln über `deleteSerialArticleFile()` (DEC-062).
 */
export async function updateSerialArticle(
  id: number,
  input: SerialArticleInput,
  plans: File[] = [],
  images: File[] = [],
): Promise<SerialArticle> {
  return http.put<SerialArticle>(
    `/serial-articles/${id}`,
    toFormData(input, plans, images),
  )
}

/** Serienartikel löschen – samt Artikelordner und allen Dateien darin (nur Admin). */
export async function deleteSerialArticle(id: number): Promise<void> {
  return http.delete<void>(`/serial-articles/${id}`)
}

/**
 * Favoriten-Markierung setzen. Sie gilt **global** (für alle Benutzer), deshalb
 * kein Admin-Recht und kein Bezug zum angemeldeten Konto (DEC-063).
 */
export async function setSerialArticleFavorite(
  id: number,
  isFavorite: boolean,
): Promise<SerialArticle> {
  return http.put<SerialArticle>(`/serial-articles/${id}/favorite`, {
    is_favorite: isFavorite,
  })
}

/**
 * Lädt eine Datei des Artikels (Plan oder Bild) als Blob – damit der
 * `Authorization`-Header mitkommt.
 *
 * Mit `variant: 'thumb'` kommt die **Vorschau in fester Größe** (400 px, JPEG,
 * DEC-059) statt des Originals – damit die Thumbnail-Liste schnell lädt.
 */
export async function getSerialArticleFile(
  id: number,
  name: string,
  variant?: 'thumb',
): Promise<Blob> {
  const suffix = variant ? `?variant=${variant}` : ''
  return http.blob(`/serial-articles/${id}/files/${encodeURIComponent(name)}${suffix}`)
}

/**
 * Eine Datei entfernen – Einrichteplan **oder** Bild (nur Admin, DEC-062).
 * Wird der letzte Plan entfernt, ist `has_pdf` danach falsch.
 */
export async function deleteSerialArticleFile(id: number, name: string): Promise<void> {
  return http.delete<void>(`/serial-articles/${id}/files/${encodeURIComponent(name)}`)
}
