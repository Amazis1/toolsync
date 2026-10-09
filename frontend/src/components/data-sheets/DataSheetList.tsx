import { useEffect, useRef, useState } from 'react'

import {
  deleteDataSheet,
  getDataSheets,
  setDataSheetFavorite,
} from '../../api/dataSheets'
import { getPlants } from '../../api/tools'
import type { Plant } from '../../api/types'
import type { DataSheet, DataSheetPage, DataSheetSortKey } from '../../types/data-sheet'
import { pageCount } from '../../lib/toolQuery'
import ConfirmDialog from '../ConfirmDialog'
import RowActionMenu from '../tools/RowActionMenu'
import ToolPagination from '../tools/ToolPagination'
import {
  ResetIcon,
  SearchIcon,
  SortableIcon,
  SortAscIcon,
  SortDescIcon,
  StarIcon,
  XIcon,
} from '../icons'

interface DataSheetListProps {
  /** Erhöht sich nach jedem Speichern – dann lädt die Liste neu. */
  refreshKey: number
  /** Nur Admins dürfen verwalten (DEC-065 Punkt 9); Lesen darf jeder. */
  canManage: boolean
  /** Datei-Fenster öffnen (die Zeile selbst ist das Klickziel, DEC-059). */
  onOpenFiles: (sheet: DataSheet) => void
  onCreate: () => void
  onEdit: (sheet: DataSheet) => void
  onInfo: (message: string) => void
  onError: (message: string) => void
}

/** Wartezeit, bis nach dem Tippen gesucht wird. */
const SEARCH_DEBOUNCE_MS = 350

const DEFAULT_SORT: DataSheetSortKey = 'tool_id'
const DEFAULT_ORDER: 'asc' | 'desc' = 'asc'

const COLUMNS: { key: DataSheetSortKey | null; label: string; className?: string }[] = [
  { key: 'tool_id', label: 'Werkzeug-ID' },
  { key: 'name', label: 'Name' },
  { key: 'plant', label: 'Werk' },
  { key: 'machine', label: 'Maschine' },
  { key: null, label: 'Dateien' },
  { key: null, label: 'Aktionen', className: 'w-14 text-right' },
]

/**
 * Unsichtbare, aber **flächige** Eingabe in den Segmenten (wie in der
 * Werkzeug- und Serienartikel-Liste).
 */
const SEGMENT_INPUT = 'absolute inset-0 h-full w-full cursor-pointer opacity-0'

/**
 * Liste der Datenblätter mit Suche, Werk-Filter, Favoriten, Sortierung und
 * Blätterleiste.
 *
 * Suche, Sortierung und Ausschnitt laufen im Backend: die Liste lädt immer nur
 * eine Seite und weiß über `total`, wie viele Datenblätter es insgesamt gibt
 * (dieselbe Mechanik wie Werkzeug- und Serienartikel-Liste, DEC-063).
 */
export default function DataSheetList({
  refreshKey,
  canManage,
  onOpenFiles,
  onCreate,
  onEdit,
  onInfo,
  onError,
}: DataSheetListProps) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plantId, setPlantId] = useState<number | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [busyFavoriteId, setBusyFavoriteId] = useState<number | null>(null)
  const [sort, setSort] = useState<DataSheetSortKey>(DEFAULT_SORT)
  const [order, setOrder] = useState<'asc' | 'desc'>(DEFAULT_ORDER)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  const [plants, setPlants] = useState<Plant[]>([])
  const [data, setData] = useState<DataSheetPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [sheetToDelete, setSheetToDelete] = useState<DataSheet | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Läuft die Tabelle seitlich über? Nur dann erscheint der Hinweis (gemessen).
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [data])

  // Werk-Filter braucht die Werkliste (Lesezugriff für alle aktiven Benutzer).
  useEffect(() => {
    let cancelled = false
    getPlants()
      .then((list) => {
        if (!cancelled) setPlants(list)
      })
      .catch(() => {
        // Ohne Werkliste bleibt der Filter leer – die Liste selbst funktioniert.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Tippen -> kurze Pause -> suchen.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Liste laden. Die Verzögerung hält den Effektkörper frei von sofortigen
  // Zustandsänderungen (wie in der Serienartikel-Liste).
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      getDataSheets({
        search,
        plantId: plantId ?? undefined,
        favoritesOnly,
        sort,
        order,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      })
        .then((result) => {
          if (!cancelled) setData(result)
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : 'Datenblätter konnten nicht geladen werden. Lade die Seite neu.',
            )
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, plantId, favoritesOnly, sort, order, page, pageSize, refreshKey, reload])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const filterActive = search.trim() !== '' || plantId !== null || favoritesOnly

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setPlantId(null)
    setFavoritesOnly(false)
    setPage(1)
  }

  /** Klick auf den Spaltenkopf: auf → ab → Standardsortierung. */
  function handleSort(key: DataSheetSortKey) {
    if (sort !== key) {
      setSort(key)
      setOrder('asc')
    } else if (order === 'asc') {
      setOrder('desc')
    } else {
      setSort(DEFAULT_SORT)
      setOrder(DEFAULT_ORDER)
    }
    setPage(1)
  }

  /** Favorit umschalten – optimistisch, mit Rücknahme bei einem Fehler. */
  async function toggleFavorite(sheet: DataSheet) {
    const gewuenscht = !sheet.is_favorite
    setBusyFavoriteId(sheet.id)
    setData((current) =>
      current === null
        ? current
        : {
            ...current,
            items: current.items.map((eintrag) =>
              eintrag.id === sheet.id ? { ...eintrag, is_favorite: gewuenscht } : eintrag,
            ),
          },
    )
    try {
      await setDataSheetFavorite(sheet.id, gewuenscht)
    } catch (err) {
      // Rücknahme: der Stern steht wieder wie vorher.
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              items: current.items.map((eintrag) =>
                eintrag.id === sheet.id ? { ...eintrag, is_favorite: !gewuenscht } : eintrag,
              ),
            },
      )
      onError(
        err instanceof Error
          ? err.message
          : 'Die Favoriten-Markierung konnte nicht gesetzt werden.',
      )
    } finally {
      setBusyFavoriteId(null)
    }
  }

  async function confirmDelete() {
    if (!sheetToDelete) return
    const bezeichnung = sheetToDelete.tool_id ?? sheetToDelete.name ?? 'Datenblatt'
    setDeleting(true)
    setError(null)
    try {
      await deleteDataSheet(sheetToDelete.id)
      onInfo(`Datenblatt „${bezeichnung}" gelöscht.`)
      setSheetToDelete(null)
      setReload((value) => value + 1)
    } catch (err) {
      setSheetToDelete(null)
      onError(
        err instanceof Error
          ? err.message
          : 'Das Datenblatt konnte nicht gelöscht werden. Lade die Liste neu.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kopfzeile wie in der Werkzeugliste: Überschrift links, Schnellfilter rechts */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-base font-bold text-slate-900">Datenblätter</h2>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {plants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Werk</span>
              <div role="radiogroup" aria-label="Nach Werk filtern" className="ui-segments">
                <label>
                  <input
                    type="radio"
                    name="datenblatt-werk-filter"
                    className={SEGMENT_INPUT}
                    checked={plantId === null}
                    onChange={() => {
                      setPlantId(null)
                      setPage(1)
                    }}
                  />
                  Alle
                </label>
                {plants.map((plant) => (
                  <label key={plant.id}>
                    <input
                      type="radio"
                      name="datenblatt-werk-filter"
                      className={SEGMENT_INPUT}
                      checked={plantId === plant.id}
                      onChange={() => {
                        setPlantId(plant.id)
                        setPage(1)
                      }}
                    />
                    {plant.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-white/70 lg:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Favoriten</span>
            <div className="ui-segments">
              <label>
                <input
                  type="checkbox"
                  className={SEGMENT_INPUT}
                  checked={favoritesOnly}
                  onChange={(event) => {
                    setFavoritesOnly(event.target.checked)
                    setPage(1)
                  }}
                />
                <StarIcon
                  filled={favoritesOnly}
                  className={`h-3.5 w-3.5 ${favoritesOnly ? 'text-amber-600' : 'text-slate-600'}`}
                />
                Nur Favoriten
              </label>
            </div>
          </div>

          {filterActive && (
            <button type="button" onClick={resetFilters} className="ui-btn ui-btn-ghost ui-btn-sm">
              <ResetIcon className="h-3.5 w-3.5" />
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Suchleiste – ohne sichtbare Beschriftung, der Name kommt für
          Screenreader aus `aria-label`. */}
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          id="data-sheet-search"
          type="search"
          aria-label="Datenblätter durchsuchen"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Werkzeug-ID, Name, Werk oder Maschine …"
          className="input-bordered w-full py-2 pl-9 pr-9 text-base sm:text-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            aria-label="Suche leeren"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && (
          <span
            aria-label="Liste wird geladen"
            className="ui-spinner absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          />
        )}
      </div>

      {error && (
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{error}</div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-white/60 bg-white/30 glass-preview-card"
      >
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/70 text-left text-xs uppercase tracking-wider text-slate-600 bg-slate-200/40">
              <th scope="col" className="w-7 px-1 py-2">
                <StarIcon className="mx-auto h-4 w-4 text-slate-600" />
              </th>
              {COLUMNS.map((column) => {
                const isSorted = column.key !== null && sort === column.key
                return (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={
                      isSorted ? (order === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={`px-3 py-2.5 font-medium ${column.className ?? ''}`}
                  >
                    {column.key ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.key as DataSheetSortKey)}
                        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-800"
                        title="Sortierung wechseln (auf → ab → Standard)"
                      >
                        {column.label}
                        {isSorted ? (
                          order === 'asc' ? (
                            <SortAscIcon className="h-3.5 w-3.5 shrink-0 text-teal-800" />
                          ) : (
                            <SortDescIcon className="h-3.5 w-3.5 shrink-0 text-teal-800" />
                          )
                        ) : (
                          <SortableIcon className="h-3.5 w-3.5 shrink-0 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-slate-200/50 text-slate-700 ${
              loading ? 'opacity-60' : ''
            }`}
            aria-busy={loading}
          >
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center">
                  <span className="inline-flex items-center gap-3 text-sm text-slate-600">
                    <span className="ui-spinner" />
                    Datenblätter werden geladen …
                  </span>
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center">
                  {filterActive ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700">
                        {search.trim()
                          ? `Keine Treffer für „${search.trim()}“.`
                          : 'Keine Datenblätter für dieses Werk.'}
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="ui-btn ui-btn-secondary"
                      >
                        Filter zurücksetzen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-900">
                        Noch keine Datenblätter vorhanden.
                      </p>
                      <p className="text-sm text-slate-600">
                        Ein Datenblatt ist ein PDF mit den Einstellwerten eines Werkzeugs für eine
                        Maschine – die Werte, mit denen das Werkzeug eingerichtet wird.
                      </p>
                      {canManage ? (
                        <button type="button" onClick={onCreate} className="ui-btn ui-btn-primary">
                          Datenblatt anlegen
                        </button>
                      ) : (
                        <p className="text-sm text-slate-600">
                          Anlegen dürfen Administratoren.
                        </p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )}

            {items.map((sheet) => (
              // Die ganze Zeile öffnet das Datei-Fenster (DEC-059-Muster):
              // Tastaturbedienung über Enter/Leertaste.
              <tr
                key={sheet.id}
                tabIndex={0}
                onClick={() => onOpenFiles(sheet)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenFiles(sheet)
                  }
                }}
                className={`table-row-glass cursor-pointer transition-colors focus-visible:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700/60 ${
                  // Zebra über `even:bg-white/40`, Favoriten mit eigener
                  // Amber-Tönung **statt** des Zebras – beides zusammen würde sich
                  // aufheben (das `:nth-child(even)` wäre stärker als `bg-*`).
                  // Der Favorit hat deshalb auch einen eigenen Hover.
                  sheet.is_favorite
                    ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                    : 'even:bg-white/40 hover:bg-white/70'
                }`}
              >
                <td className="px-1 py-2">
                  <button
                    type="button"
                    aria-pressed={sheet.is_favorite}
                    aria-label={
                      sheet.is_favorite
                        ? `Favorit für ${sheet.tool_id ?? 'Datenblatt'} entfernen`
                        : `Favorit für ${sheet.tool_id ?? 'Datenblatt'} setzen`
                    }
                    disabled={busyFavoriteId === sheet.id}
                    onClick={(event) => {
                      // Ohne stopPropagation öffnete der Stern auch das Datei-Fenster.
                      event.stopPropagation()
                      void toggleFavorite(sheet)
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="rounded-lg p-1 hover:bg-white/70 disabled:opacity-50"
                  >
                    <StarIcon
                      filled={sheet.is_favorite}
                      className={`mx-auto h-4 w-4 ${
                        sheet.is_favorite ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    />
                  </button>
                </td>
                {/* Werkzeug-ID = Kennung: heller Kasten in Mono mit Teal-Kante,
                    dieselbe Markierung wie Werkzeug-ID und Artikelnummer. Ohne
                    ID steht dort eine ruhige neutrale Markierung (DEC-055). */}
                <td className="px-3 py-2">
                  {sheet.tool_id ? (
                    <span className="inline-flex rounded-lg border border-teal-600/30 bg-white/80 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                      {sheet.tool_id}
                    </span>
                  ) : (
                    <span className="ui-badge ui-badge-neutral">ohne ID</span>
                  )}
                </td>
                {/* Name = zweite Kennung: heller Kasten in Mono mit **Sky-Kante**,
                    genau wie der Name in der Serienartikel-Liste (DEC-063). Die
                    Werkzeug-ID trägt die Teal-Kante – nur die Kante
                    unterscheidet die beiden Kennungen. */}
                <td className="px-3 py-2">
                  {sheet.name ? (
                    <code className="inline-flex max-w-[13rem] rounded-lg border border-sky-500/30 bg-white/85 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                      <span className="truncate">{sheet.name}</span>
                    </code>
                  ) : (
                    <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
                      —
                    </span>
                  )}
                  {sheet.description && (
                    <span className="mt-1 block max-w-[13rem] truncate text-xs text-slate-600">
                      {sheet.description}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {sheet.plant?.name ?? '—'}
                </td>
                {/* Maschine mit dem Farbpunkt aus den Stammdaten – wie der Kunde in
                    der Serienartikel-Liste. */}
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {sheet.machine?.color && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80"
                        style={{ backgroundColor: sheet.machine.color }}
                      />
                    )}
                    <span className="max-w-[9rem] truncate text-slate-900">
                      {sheet.machine?.name ?? <span className="text-slate-600">—</span>}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {sheet.plans.length === 0 ? (
                      <span className="ui-badge ui-badge-neutral">Kein PDF</span>
                    ) : sheet.plans.length === 1 ? (
                      <span className="ui-badge ui-badge-success">PDF</span>
                    ) : (
                      <span className="ui-badge ui-badge-success">
                        {sheet.plans.length} PDFs
                      </span>
                    )}
                    {sheet.images.length > 0 && (
                      <span className="ui-badge ui-badge-info">
                        {sheet.images.length === 1
                          ? '1 Bild'
                          : `${sheet.images.length} Bilder`}
                      </span>
                    )}
                  </div>
                </td>
                {/* Aktionen im „…"-Menü – die Zeile selbst öffnet die Vorschau. */}
                <td className="w-14 px-2 py-2 text-right">
                  {canManage && (
                    <span
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <RowActionMenu
                        label={sheet.tool_id ?? sheet.name ?? 'Datenblatt'}
                        actions={[
                          {
                            key: 'edit',
                            label: 'Bearbeiten',
                            onSelect: () => onEdit(sheet),
                          },
                          {
                            key: 'delete',
                            label: 'Löschen',
                            danger: true,
                            onSelect: () => setSheetToDelete(sheet),
                          },
                        ]}
                      />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overflowing && (
        <p className="text-xs text-slate-600">
          Tabelle seitlich scrollbar – die Spalte „Aktionen“ (…) steht am rechten Rand.
        </p>
      )}

      <ToolPagination
        total={total}
        page={page}
        pageSize={pageSize}
        busy={loading}
        ariaLabel="Seitennavigation der Datenblätter"
        itemSingular="Datenblatt"
        itemPlural="Datenblättern"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {!loading && total > 0 && page > pageCount(total, pageSize) && (
        <p className="text-sm text-slate-600">Diese Seite ist leer. Bitte zurückblättern.</p>
      )}

      {sheetToDelete && (
        <ConfirmDialog
          title={`Datenblatt „${sheetToDelete.tool_id ?? sheetToDelete.name ?? ''}“ löschen?`}
          description={
            sheetToDelete.plans.length > 0
              ? 'Der Eintrag und alle hinterlegten Datenblätter werden entfernt. Das lässt sich nicht rückgängig machen.'
              : 'Der Eintrag wird endgültig entfernt. Das lässt sich nicht rückgängig machen.'
          }
          confirmLabel="Datenblatt löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => {
            void confirmDelete()
          }}
          onCancel={() => setSheetToDelete(null)}
        />
      )}
    </div>
  )
}
