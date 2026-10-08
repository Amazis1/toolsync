/**
 * Zustand der Werkzeugliste: Suche, Filter, Sortierung und Seite.
 *
 * Warum das hier steht und nicht in der Komponente: Derselbe Zustand wird an
 * drei Stellen gebraucht — an das Backend (als Abfrage), in die Adresszeile
 * (damit ein Neuladen die Ansicht behält) und in die Oberfläche. Eine Quelle
 * verhindert, dass die drei auseinanderlaufen.
 *
 * Die Adresszeile ist die einzige Ablage: nach einem Reload, einem Lesezeichen
 * oder einem Sprung ins Formular und zurück ist die Ansicht dieselbe.
 */

import type {
  ToolCategory,
  ToolSortKey,
  ToolSortOrder,
  ToolStatus,
} from '../api/types'
import type { ToolListQuery } from '../api/tools'

/** Auswahl für „normale Werkzeuge vs. Lager/Ersatz". */
export type StorageFilter = 'all' | 'tools' | 'storage'
/** Auswahl für „mit festem Lagerplatz vs. Ablage". */
export type PlaceFilter = 'all' | 'with' | 'tray'

export interface ToolQuery {
  q: string
  categories: ToolCategory[]
  statuses: ToolStatus[]
  plantId: number | null
  toolTypeId: number | null
  storage: StorageFilter
  place: PlaceFilter
  favoritesOnly: boolean
  sort: ToolSortKey
  order: ToolSortOrder
  /** 1-basiert (Seite 1 ist die erste Seite). */
  page: number
  pageSize: number
}

/**
 * Seitengrößen, die die Oberfläche anbietet.
 *
 * 10 ist die Vorgabe: Die Liste ist damit kurz genug, dass sie ohne eigenes
 * Scrollfeld in die Seite passt — die Tabelle soll keine eigene Bildlaufleiste
 * bekommen. Größere Seiten sind wählbar, dann scrollt das Tabellenfeld.
 */
export const TOOL_PAGE_SIZES = [10, 25, 50, 100] as const

/** Sortierbare Spalten – muss zum Backend passen (`ToolSortKey`). */
export const TOOL_SORT_KEYS: ToolSortKey[] = [
  'tool_id',
  'description',
  'measure_a',
  'location',
  'plant',
  'status',
  'tool_type',
  'customer',
  'machine',
]

export const DEFAULT_TOOL_QUERY: ToolQuery = {
  q: '',
  categories: [],
  statuses: [],
  plantId: null,
  toolTypeId: null,
  storage: 'all',
  place: 'all',
  favoritesOnly: false,
  sort: 'tool_id',
  order: 'asc',
  page: 1,
  pageSize: 10,
}

const CATEGORY_VALUES: ToolCategory[] = ['Stempel', 'Abstreifer', 'Matrize']
const STATUS_VALUES: ToolStatus[] = [
  'available',
  'lent',
  'in_transit',
  'defective',
  'maintenance',
]

function parseList<T extends string>(raw: string | null, allowed: T[]): T[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as string[]).includes(value))
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * Adresszeile lesen. Unbekannte oder unsinnige Werte fallen still auf den
 * Standard zurück — eine getippte URL darf die Liste nicht in einen
 * ungültigen Zustand bringen.
 */
export function readToolQuery(search: string): ToolQuery {
  const params = new URLSearchParams(search)

  const sort = params.get('sort')
  const order = params.get('richtung')
  const storage = params.get('bestand')
  const place = params.get('platz')
  const pageSize = parsePositiveInt(params.get('groesse'), DEFAULT_TOOL_QUERY.pageSize)
  return {
    q: params.get('q') ?? '',
    categories: parseList(params.get('kategorie'), CATEGORY_VALUES),
    statuses: parseList(params.get('status'), STATUS_VALUES),
    plantId: params.has('werk') ? Number(params.get('werk')) || null : null,
    toolTypeId: params.has('typ') ? Number(params.get('typ')) || null : null,
    storage:
      storage === 'tools' || storage === 'storage' ? storage : DEFAULT_TOOL_QUERY.storage,
    place: place === 'with' || place === 'tray' ? place : DEFAULT_TOOL_QUERY.place,
    favoritesOnly: params.get('favoriten') === '1',
    sort: (TOOL_SORT_KEYS as string[]).includes(sort ?? '')
      ? (sort as ToolSortKey)
      : DEFAULT_TOOL_QUERY.sort,
    order: order === 'desc' ? 'desc' : 'asc',
    page: parsePositiveInt(params.get('seite'), 1),
    pageSize: (TOOL_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_TOOL_QUERY.pageSize,
  }
}

/**
 * Adresszeile schreiben. Nur Werte, die vom Standard abweichen, erscheinen in
 * der URL — sonst stünde nach jedem Klick eine lange Kette aus Voreinstellungen
 * in der Adresszeile.
 */
export function writeToolQuery(query: ToolQuery): string {
  const params = new URLSearchParams()

  if (query.q.trim()) params.set('q', query.q.trim())
  if (query.categories.length) params.set('kategorie', query.categories.join(','))
  if (query.statuses.length) params.set('status', query.statuses.join(','))
  if (query.plantId != null) params.set('werk', String(query.plantId))
  if (query.toolTypeId != null) params.set('typ', String(query.toolTypeId))
  if (query.storage !== 'all') params.set('bestand', query.storage)
  if (query.place !== 'all') params.set('platz', query.place)
  if (query.favoritesOnly) params.set('favoriten', '1')
  if (query.sort !== DEFAULT_TOOL_QUERY.sort) params.set('sort', query.sort)
  if (query.order !== DEFAULT_TOOL_QUERY.order) params.set('richtung', query.order)
  if (query.page > 1) params.set('seite', String(query.page))
  if (query.pageSize !== DEFAULT_TOOL_QUERY.pageSize) {
    params.set('groesse', String(query.pageSize))
  }

  return params.toString()
}

/** Zustand der Oberfläche in die Abfrage des Backends übersetzen. */
export function toApiQuery(query: ToolQuery): ToolListQuery {
  return {
    q: query.q,
    categories: query.categories,
    statuses: query.statuses,
    plantId: query.plantId ?? undefined,
    toolTypeId: query.toolTypeId ?? undefined,
    isStorage: query.storage === 'all' ? undefined : query.storage === 'storage',
    hasPlace: query.place === 'all' ? undefined : query.place === 'with',
    favoritesOnly: query.favoritesOnly,
    sort: query.sort,
    order: query.order,
    skip: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  }
}

/** Ein Filterwechsel setzt immer auf Seite 1 zurück. */
export function withPageReset(query: ToolQuery): ToolQuery {
  return query.page === 1 ? query : { ...query, page: 1 }
}

/** Wie viele Filter gerade gesetzt sind (ohne Suche, Sortierung und Seite). */
export function countActiveFilters(query: ToolQuery): number {
  return (
    query.categories.length +
    query.statuses.length +
    (query.plantId != null ? 1 : 0) +
    (query.toolTypeId != null ? 1 : 0) +
    (query.storage !== 'all' ? 1 : 0) +
    (query.place !== 'all' ? 1 : 0) +
    (query.favoritesOnly ? 1 : 0)
  )
}

export function hasActiveSearch(query: ToolQuery): boolean {
  return query.q.trim().length > 0 || countActiveFilters(query) > 0
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Nächster Zustand beim Klick auf einen Spaltenkopf:
 * aufsteigend → absteigend → **Standardsortierung**.
 *
 * Der dritte Klick stellt die Voreinstellung wieder her (Werkzeug-ID
 * aufsteigend). Ohne diesen Schritt käme man aus einer einmal gesetzten
 * Sortierung nie wieder heraus – die Reihenfolge bleibt dabei immer bestimmt,
 * sie fällt nie in eine unbestimmte Ordnung zurück.
 */
export function nextSort(
  query: ToolQuery,
  key: ToolSortKey,
): Pick<ToolQuery, 'sort' | 'order' | 'page'> {
  if (query.sort !== key) return { sort: key, order: 'asc', page: 1 }
  if (query.order === 'asc') return { sort: key, order: 'desc', page: 1 }
  return {
    sort: DEFAULT_TOOL_QUERY.sort,
    order: DEFAULT_TOOL_QUERY.order,
    page: 1,
  }
}

/** Seitennummern für die Pagination, mit Auslassung bei vielen Seiten. */
export function pageWindow(
  current: number,
  totalPages: number,
): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1])
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  const result: (number | 'gap')[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap')
    result.push(page)
  })
  return result
}
