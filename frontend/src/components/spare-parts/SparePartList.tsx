import { useEffect, useRef, useState } from 'react'

import { getPlants } from '../../api/tools'
import {
  deleteSparePart,
  getSpareParts,
  setSparePartFavorite,
} from '../../api/spareParts'
import type { Plant } from '../../api/types'
import type { SparePart, SparePartPage, SparePartSortKey } from '../../types/spare-part'
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

interface SparePartListProps {
  /** Erhöht sich nach jedem Speichern – dann lädt die Liste neu. */
  refreshKey: number
  /** Nur Admins dürfen löschen (DEC-064 Punkt 10); Lesen und Pflegen darf jeder. */
  canManage: boolean
  onCreate: () => void
  onEdit: (part: SparePart) => void
  /** Erfolgsmeldung (Toast) für den Aufrufer. */
  onInfo: (message: string) => void
  /** Fehlermeldung (Toast) für den Aufrufer. */
  onError: (message: string) => void
}

/** Wartezeit, bis nach dem Tippen gesucht wird. */
const SEARCH_DEBOUNCE_MS = 350

const DEFAULT_SORT: SparePartSortKey = 'article_number'
const DEFAULT_ORDER: 'asc' | 'desc' = 'asc'

// Spaltenreihenfolge (Entscheidung des Projektinhabers): erst **was** es ist
// (Artikelnummer), dann **wie** es heisst (Name/Typ), dann **wie viel** daliegt
// (Menge), dann **wo** (Lagerort), zuletzt die Zuordnung (Werk, Maschine).
// Favorit und Aktionen stehen rechts aussen – wie in der Datenblattliste.
const COLUMNS: { key: SparePartSortKey | null; label: string; className?: string }[] = [
  { key: 'article_number', label: 'Artikelnummer' },
  { key: 'name', label: 'Name / Typ' },
  // Menge mittig: die Zahl ist der haeufigste Blick in dieser Liste.
  { key: 'quantity', label: 'Menge', className: 'text-center' },
  { key: 'storage_place', label: 'Lagerort' },
  { key: 'plant', label: 'Werk' },
  { key: 'machine', label: 'Maschine' },
  { key: null, label: 'Favorit', className: 'w-16 text-center' },
  { key: null, label: 'Aktionen', className: 'w-14 text-right' },
]

/**
 * Unsichtbare, aber **flächige** Eingabe in den Segmenten.
 *
 * `sr-only` würde die Eingabe auf 1×1 px schrumpfen lassen; dann liegt das Label
 * darüber und fängt jeden Klick ab. Als transparente Fläche bleibt die Eingabe
 * das Klickziel und für Screenreader vorhanden (wie in `ToolQuickFilters`).
 */
const SEGMENT_INPUT = 'absolute inset-0 h-full w-full cursor-pointer opacity-0'

/**
 * Liste der Ersatzteile mit Suche, Werk-Filter, Sortierung und Blätterleiste.
 *
 * Suche, Sortierung und Ausschnitt laufen im Backend: die Liste lädt immer nur
 * eine Seite und weiß über `total`, wie viele Teile es insgesamt gibt – dieselbe
 * Mechanik wie in der Werkzeug- und Serienartikel-Liste (DEC-063).
 */
export default function SparePartList({
  refreshKey,
  canManage,
  onCreate,
  onEdit,
  onInfo,
  onError,
}: SparePartListProps) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plantId, setPlantId] = useState<number | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SparePartSortKey>(DEFAULT_SORT)
  const [order, setOrder] = useState<'asc' | 'desc'>(DEFAULT_ORDER)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  const [plants, setPlants] = useState<Plant[]>([])
  const [data, setData] = useState<SparePartPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [partToDelete, setPartToDelete] = useState<SparePart | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Welcher Stern gerade gespeichert wird (Knopf ist so lange gesperrt). */
  const [busyFavoriteId, setBusyFavoriteId] = useState<number | null>(null)

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

  // Tippen -> kurze Pause -> suchen. Verhindert eine Anfrage je Tastendruck.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Liste laden. Der Ausschnitt wird aus Seite und Seitengröße berechnet; die
  // Gesamtzahl kommt aus `total` und trägt die Blätterleiste.
  // Die Verzögerung hält den Effektkörper frei von sofortigen Zustandsänderungen.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      getSpareParts({
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
                : 'Ersatzteile konnten nicht geladen werden. Lade die Seite neu.',
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

  /** Favorit umschalten – optimistisch, mit Rücknahme bei einem Fehler. */
  async function toggleFavorite(part: SparePart) {
    const gewuenscht = !part.is_favorite
    setBusyFavoriteId(part.id)
    setData((current) =>
      current === null
        ? current
        : {
            ...current,
            items: current.items.map((eintrag) =>
              eintrag.id === part.id ? { ...eintrag, is_favorite: gewuenscht } : eintrag,
            ),
          },
    )
    try {
      await setSparePartFavorite(part.id, gewuenscht)
      // Bei „Nur Favoriten" fällt die Zeile nach dem Entfernen aus der Ansicht.
      if (favoritesOnly && !gewuenscht) {
        setData((current) =>
          current === null
            ? current
            : {
                ...current,
                items: current.items.filter((eintrag) => eintrag.id !== part.id),
                total: Math.max(0, current.total - 1),
              },
        )
      }
    } catch (err) {
      // Rücknahme: der Stern steht wieder wie vorher.
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              items: current.items.map((eintrag) =>
                eintrag.id === part.id ? { ...eintrag, is_favorite: !gewuenscht } : eintrag,
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
  function handleSort(key: SparePartSortKey) {
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

  async function confirmDelete() {
    if (!partToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteSparePart(partToDelete.id)
      onInfo(`Ersatzteil „${partToDelete.article_number}“ gelöscht.`)
      setPartToDelete(null)
      setReload((value) => value + 1)
    } catch (err) {
      setPartToDelete(null)
      onError(
        err instanceof Error
          ? err.message
          : 'Das Ersatzteil konnte nicht gelöscht werden. Lade die Liste neu.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kopfzeile wie in der Werkzeugliste: Überschrift links, Schnellfilter rechts */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-base font-bold text-slate-900">Ersatzteile</h2>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {plants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Werk</span>
              <div role="radiogroup" aria-label="Nach Werk filtern" className="ui-segments">
                <label>
                  <input
                    type="radio"
                    name="ersatzteile-werk-filter"
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
                      name="ersatzteile-werk-filter"
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

          {/* Favoriten-Filter wie in der Datenblattliste: derselbe Stern, der
              auch in der Spalte steht, damit die Verbindung sichtbar ist. */}
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

      {/* Suchleiste – ohne sichtbare Beschriftung (wie in der Werkzeugliste),
          der Name kommt für Screenreader aus `aria-label`. */}
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          id="spare-part-search"
          type="search"
          aria-label="Ersatzteile durchsuchen"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Artikelnummer, Bezeichnung, Typ, Lagerort, Werk oder Maschine …"
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
                        onClick={() => handleSort(column.key as SparePartSortKey)}
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
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center">
                  <span className="inline-flex items-center gap-3 text-sm text-slate-600">
                    <span className="ui-spinner" />
                    Ersatzteile werden geladen …
                  </span>
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center">
                  {filterActive ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700">
                        {search.trim()
                          ? `Keine Treffer für „${search.trim()}“.`
                          : 'Keine Ersatzteile für dieses Werk.'}
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
                        Noch keine Ersatzteile vorhanden.
                      </p>
                      <p className="text-sm text-slate-600">
                        Ein Ersatzteil hat eine Artikelnummer, ein Werk und einen Mengenbestand –
                        zum Beispiel eine Dichtung, einen Sensor oder ein Normteil. Ersatzwerkzeuge
                        stehen dagegen in der Werkzeugliste.
                      </p>
                      <button type="button" onClick={onCreate} className="ui-btn ui-btn-primary">
                        Ersatzteil anlegen
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {items.map((part) => (
              <tr key={part.id} className="table-row-glass even:bg-white/40 hover:bg-white/70">
                {/* Artikelnummer = Identität: heller Kasten in Mono, Teal-Kante –
                    dieselbe Markierung wie Werkzeug-ID und Serienartikel-Nummer. */}
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-lg border border-teal-600/30 bg-white/80 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                    {part.article_number}
                  </span>
                </td>
                {/* Name = zweite Kennung: heller Kasten in Mono mit **Sky-Kante**,
                    genau wie in der Serienartikel- und Datenblatt-Liste (DEC-063).
                    Die Artikelnummer trägt die Teal-Kante – unterschieden wird nur
                    die Kante. */}
                <td className="px-3 py-2">
                  {part.name ? (
                    <code className="inline-flex max-w-[13rem] rounded-lg border border-sky-500/30 bg-white/85 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                      <span className="truncate">{part.name}</span>
                    </code>
                  ) : (
                    <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
                      —
                    </span>
                  )}
                  {part.type && (
                    <span className="mt-1 block max-w-[13rem] truncate text-xs text-slate-600">
                      {part.type}
                    </span>
                  )}
                </td>
                {/* Menge: mittig und als **Zahl im Kasten** – der Bestand ist der
                    häufigste Blick in dieser Liste, und eine nackte Ziffer geht
                    zwischen den Textspalten unter. `tnum` hält die Ziffern
                    untereinander gleich breit, damit die Spalte ruhig steht. */}
                <td className="px-3 py-2 text-center">
                  <span className="tnum inline-flex min-w-[3.25rem] items-baseline justify-center gap-1 rounded-lg border border-teal-600/25 bg-white/85 px-2 py-0.5">
                    <span className="text-base font-bold leading-none text-slate-900">
                      {part.quantity}
                    </span>
                    {part.unit ? (
                      <span className="text-xs text-slate-600">{part.unit}</span>
                    ) : null}
                  </span>
                </td>
                {/* Lagerort – **deutlich** wie der Lagerplatz in der Werkzeugliste:
                    der Matrix-Platz als Mono-Kasten mit **Sky-Kante** (Ort = Info),
                    der Freitext als ruhige neutrale Markierung daneben/darunter.
                    Beides ist freiwillig, beides kann gleichzeitig stehen. */}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {part.position_code ? (
                      <code className="inline-flex rounded-lg border border-sky-500/30 bg-white/85 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                        {part.position_code}
                      </code>
                    ) : null}
                    {part.storage_place ? (
                      <span
                        className="inline-flex max-w-[11rem] rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700"
                        title={part.storage_place}
                      >
                        <span className="truncate">{part.storage_place}</span>
                      </span>
                    ) : null}
                    {!part.position_code && !part.storage_place && (
                      <span className="text-slate-600">—</span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {part.plant?.name ?? '—'}
                </td>
                {/* Maschine mit dem Farbpunkt aus den Stammdaten (DEC-067) –
                    wie in der Datenblätter-Liste. */}
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {part.machine?.color && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80"
                        style={{ backgroundColor: part.machine.color }}
                      />
                    )}
                    <span className="max-w-[9rem] truncate text-slate-900">
                      {part.machine?.name ?? <span className="text-slate-600">—</span>}
                    </span>
                  </span>
                </td>
                {/* Favorit: **global** (nicht pro Benutzer, DEC-063). Gefüllter
                    Stern = gesetzt, offener Stern = nicht gesetzt – die Form
                    trägt die Information, nicht nur die Farbe. */}
                <td className="w-16 px-2 py-2 text-center">
                  <button
                    type="button"
                    aria-label={
                      part.is_favorite
                        ? `Favorit für ${part.article_number} entfernen`
                        : `Favorit für ${part.article_number} hinzufügen`
                    }
                    aria-pressed={part.is_favorite}
                    title={part.is_favorite ? 'Favorit entfernen' : 'Zu den Favoriten'}
                    disabled={busyFavoriteId === part.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleFavorite(part)
                    }}
                    className="rounded-lg p-1 hover:bg-white/70 disabled:opacity-50"
                  >
                    <StarIcon
                      filled={part.is_favorite}
                      className={`mx-auto h-4 w-4 ${
                        part.is_favorite ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    />
                  </button>
                </td>
                <td className="w-14 px-2 py-2 text-right">
                  <RowActionMenu
                    label={part.article_number}
                    actions={[
                      {
                        key: 'edit',
                        label: 'Bearbeiten',
                        onSelect: () => onEdit(part),
                      },
                      ...(canManage
                        ? [
                            {
                              key: 'delete',
                              label: 'Löschen',
                              danger: true,
                              onSelect: () => setPartToDelete(part),
                            },
                          ]
                        : []),
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hinweis nur, wenn die Tabelle tatsächlich seitlich überläuft: sonst sieht
          die abgeschnittene Kante aus wie das Ende der Liste. */}
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
        ariaLabel="Seitennavigation der Ersatzteile"
        itemSingular="Ersatzteil"
        itemPlural="Ersatzteilen"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {!loading && total > 0 && page > pageCount(total, pageSize) && (
        <p className="text-sm text-slate-600">Diese Seite ist leer. Bitte zurückblättern.</p>
      )}

      {partToDelete && (
        <ConfirmDialog
          title={`Ersatzteil „${partToDelete.article_number}“ löschen?`}
          description="Der Eintrag wird endgültig entfernt. Das lässt sich nicht rückgängig machen."
          confirmLabel="Ersatzteil löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => {
            void confirmDelete()
          }}
          onCancel={() => setPartToDelete(null)}
        />
      )}
    </div>
  )
}
