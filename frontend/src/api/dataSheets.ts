// API-Funktionen für Datenblätter (DEC-065)
import { http } from './client'
import type {
  DataSheet,
  DataSheetInput,
  DataSheetPage,
  DataSheetSortKey,
  DataSheetSortOrder,
  DataSheetToolIdCheck,
} from '../types/data-sheet'

/**
 * Parameter der Datenblatt-Liste. Suche, Filter, Sortierung und Ausschnitt gehen
 * an das Backend – die Liste lädt immer nur eine Seite und kennt über `total`
 * die Gesamtzahl.
 */
export interface DataSheetListQuery {
  search?: string
  plantId?: number
  machineId?: number
  hasPdf?: boolean
  favoritesOnly?: boolean
  sort?: DataSheetSortKey
  order?: DataSheetSortOrder
  skip?: number
  limit?: number
}

export async function getDataSheets(
  query: DataSheetListQuery = {},
): Promise<DataSheetPage> {
  const params = new URLSearchParams()

  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.plantId != null) params.set('plant_id', String(query.plantId))
  if (query.machineId != null) params.set('machine_id', String(query.machineId))
  if (query.hasPdf != null) params.set('has_pdf', String(query.hasPdf))
  if (query.favoritesOnly) params.set('favorites_only', 'true')
  if (query.sort) params.set('sort', query.sort)
  if (query.order) params.set('order', query.order)
  params.set('skip', String(query.skip ?? 0))
  params.set('limit', String(query.limit ?? 25))

  return http.get<DataSheetPage>(`/data-sheets/?${params.toString()}`)
}

/**
 * Live-Prüfung der Werkzeug-ID: wie viele Datenblätter gibt es dazu schon?
 *
 * Sie **blockiert nicht** – mehrere Datenblätter je ID sind der Normalfall
 * (andere Maschine, andere Auflage), anders als beim Serienartikel.
 */
export async function checkDataSheetToolId(
  toolId: string,
  excludeId?: number,
): Promise<DataSheetToolIdCheck> {
  const params = new URLSearchParams({ tool_id: toolId })
  if (excludeId !== undefined) params.set('exclude_id', String(excludeId))
  return http.get<DataSheetToolIdCheck>(`/data-sheets/check-tool-id?${params.toString()}`)
}

/**
 * Formulardaten für Anlegen und Ändern.
 *
 * Alle Felder werden **immer** mitgeschickt: ein leerer Wert bedeutet dem
 * Backend „Feld leeren" (Werkzeug-ID, Maschine, Name), ein fehlendes Feld
 * „unverändert". Nur so lässt sich eine Maschine wieder entfernen.
 *
 * **Ausnahme `description`:** Das Formular hat kein Beschreibungsfeld mehr.
 * Deshalb wird das Feld nur mitgeschickt, wenn der Aufrufer ausdrücklich einen
 * Wert übergibt – sonst bleibt eine vorhandene Beschreibung unangetastet.
 *
 * Wichtig: `Content-Type` wird **nicht** gesetzt – der Browser erzeugt die
 * multipart-Boundary selbst (siehe `api/client.ts`).
 */
function toFormData(
  input: DataSheetInput,
  plans: File[] = [],
  images: File[] = [],
): FormData {
  const form = new FormData()
  form.append('tool_id', input.tool_id?.trim() ?? '')
  form.append('plant_id', String(input.plant_id))
  form.append('machine_id', input.machine_id != null ? String(input.machine_id) : '')
  form.append('name', input.name?.trim() ?? '')
  if (input.description !== undefined) {
    form.append('description', input.description?.trim() ?? '')
  }
  // Mehrere Dateien: gleicher Feldname, mehrfach angehängt (List[UploadFile]).
  plans.forEach((plan) => form.append('plans', plan))
  images.forEach((bild) => form.append('images', bild))
  return form
}

/** Datenblatt anlegen (nur Admin). Mehrere PDFs und Bilder sind möglich. */
export async function createDataSheet(
  input: DataSheetInput,
  plans: File[] = [],
  images: File[] = [],
): Promise<DataSheet> {
  return http.post<DataSheet>('/data-sheets/', toFormData(input, plans, images))
}

/**
 * Datenblatt ändern (nur Admin). Mitgeschickte Dateien kommen **hinzu**;
 * entfernt wird einzeln über `deleteDataSheetFile()`.
 */
export async function updateDataSheet(
  id: number,
  input: DataSheetInput,
  plans: File[] = [],
  images: File[] = [],
): Promise<DataSheet> {
  return http.put<DataSheet>(`/data-sheets/${id}`, toFormData(input, plans, images))
}

/** Datensatz samt Ordner und Dateien löschen (nur Admin). */
export async function deleteDataSheet(id: number): Promise<void> {
  return http.delete<void>(`/data-sheets/${id}`)
}

/** Ein Datenblatt entfernen (nur Admin). Danach rückt `pdf_path` nach. */
export async function deleteDataSheetFile(id: number, name: string): Promise<void> {
  return http.delete<void>(`/data-sheets/${id}/files/${encodeURIComponent(name)}`)
}

/**
 * Lädt ein Datenblatt als **Blob** – nur so kommt der `Authorization`-Header mit
 * (ein direkter `<iframe src="/api/…">` wäre unauthentifiziert).
 *
 * `variant` bleibt in der Signatur, weil das Datei-Fenster beide Bereiche mit
 * **einer** Schnittstelle bedient (`types/viewer.ts`); Datenblätter haben keine
 * Vorschaubilder, der Parameter hat hier also keine Wirkung.
 */
export async function getDataSheetFile(
  id: number,
  name: string,
  variant?: 'thumb',
): Promise<Blob> {
  const suffix = variant ? `?variant=${variant}` : ''
  return http.blob(`/data-sheets/${id}/files/${encodeURIComponent(name)}${suffix}`)
}

/** Favoriten-Markierung setzen (global, kein Admin-Recht – wie DEC-063). */
export async function setDataSheetFavorite(
  id: number,
  isFavorite: boolean,
): Promise<DataSheet> {
  return http.put<DataSheet>(`/data-sheets/${id}/favorite`, {
    is_favorite: isFavorite,
  })
}
