import { useEffect, useRef, useState } from 'react'

import {
  deleteSerialArticle,
  getSerialArticles,
  setSerialArticleFavorite,
} from '../../api/serialArticles'
import { getPlants } from '../../api/tools'
import ConfirmDialog from '../ConfirmDialog'
import Tooltip from '../ui/Tooltip'
import RowActionMenu from '../tools/RowActionMenu'
import ToolPagination from '../tools/ToolPagination'
import {
  ResetIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
  SortableIcon,
  StarIcon,
  XIcon,
} from '../icons'
import { pageCount } from '../../lib/toolQuery'
import type { Plant } from '../../api/types'
import type {
  SerialArticle,
  SerialArticlePage,
  SerialArticleSortKey,
} from '../../types/serial-article'

interface SerialArticleListProps {
  /** Erhöht sich nach jedem Speichern – dann lädt die Liste neu. */
  refreshKey: number
  /** Nur Admins dürfen verwalten (DEC-056 Punkt 4); Lesen darf jeder. */
  canManage: boolean
  /** Dateien des Artikels ansehen – `tab` sagt, womit das Fenster öffnet. */
  onOpenFiles: (article: SerialArticle, tab: 'plan' | 'bilder') => void
  onCreate: () => void
  onEdit: (article: SerialArticle) => void
  /** Erfolgsmeldung (Toast) für den Aufrufer. */
  onInfo: (message: string) => void
  /** Fehlermeldung (Toast) für den Aufrufer. */
  onError: (message: string) => void
}

/** Wartezeit, bis nach dem Tippen gesucht wird. */
const SEARCH_DEBOUNCE_MS = 350

const DEFAULT_SORT: SerialArticleSortKey = 'article_number'
const DEFAULT_ORDER: 'asc' | 'desc' = 'asc'

const COLUMNS: { key: SerialArticleSortKey | null; label: string; className?: string }[] = [
  { key: 'article_number', label: 'Artikelnummer' },
  { key: 'name', label: 'Name / Beschreibung' },
  { key: 'plant', label: 'Werk' },
  { key: 'customer', label: 'Kunde / Maschine' },
  { key: null, label: 'Dateien' },
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
 * Liste der Serienartikel mit Suche, Sortierung, Blätterleiste und Gesamtzahl.
 *
 * Suche, Sortierung und Ausschnitt laufen im Backend: die Liste lädt immer nur
 * eine Seite und weiß über `total`, wie viele Pläne es insgesamt gibt. Vorher
 * holte sie höchstens 100 Datensätze und zeigte keine Gesamtzahl (DEC-056
 * Punkt 8).
 */
export default function SerialArticleList({
  refreshKey,
  canManage,
  onOpenFiles,
  onCreate,
  onEdit,
  onInfo,
  onError,
}: SerialArticleListProps) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plantId, setPlantId] = useState<number | null>(null)
  // Globaler Favorit (nicht pro Benutzer) – wie in der Werkzeugliste (DEC-063).
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [busyFavoriteId, setBusyFavoriteId] = useState<number | null>(null)
  const [sort, setSort] = useState<SerialArticleSortKey>(DEFAULT_SORT)
  const [order, setOrder] = useState<'asc' | 'desc'>(DEFAULT_ORDER)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

  const [plants, setPlants] = useState<Plant[]>([])
  const [data, setData] = useState<SerialArticlePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [articleToDelete, setArticleToDelete] = useState<SerialArticle | null>(null)
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

  // Tippen -> kurze Pause -> suchen. Verhindert eine Anfrage je Tastendruck.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Liste laden. Der Ausschnitt wird aus Seite und Seitengröße berechnet; die
  // Verzögerung hält den Effektkörper frei von sofortigen Zustandsänderungen.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      getSerialArticles({
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
                : 'Serienartikel konnten nicht geladen werden. Lade die Seite neu.',
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

  /** Spaltenkopf-Klick: aufsteigend → absteigend → Standardsortierung. */
  function handleSort(key: SerialArticleSortKey) {
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

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setPlantId(null)
    setFavoritesOnly(false)
    setPage(1)
  }

  /**
   * Favorit umschalten: sofort sichtbar, bei einem Fehler wieder zurück
   * (dasselbe Vorgehen wie in der Werkzeugliste).
   */
  async function toggleFavorite(article: SerialArticle) {
    const next = !article.is_favorite
    setBusyFavoriteId(article.id)
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((entry) =>
              entry.id === article.id ? { ...entry, is_favorite: next } : entry,
            ),
          }
        : current,
    )

    try {
      await setSerialArticleFavorite(article.id, next)
      // Bei „Nur Favoriten" fällt die Zeile nach dem Entfernen aus der Ansicht.
      if (favoritesOnly && !next) {
        setReload((value) => value + 1)
      }
    } catch (err) {
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((entry) =>
                entry.id === article.id ? { ...entry, is_favorite: !next } : entry,
              ),
            }
          : current,
      )
      onError(
        err instanceof Error
          ? err.message
          : 'Der Favorit konnte nicht gespeichert werden. Versuche es erneut.',
      )
    } finally {
      setBusyFavoriteId(null)
    }
  }

  async function confirmDelete() {
    if (!articleToDelete) return
    const target = articleToDelete
    setDeleting(true)
    try {
      await deleteSerialArticle(target.id)
      setArticleToDelete(null)
      // Die letzte Zeile einer hinteren Seite: dann eine Seite zurück.
      if (items.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        setReload((value) => value + 1)
      }
      onInfo(`Serienartikel „${target.article_number}“ wurde gelöscht.`)
    } catch (err) {
      setArticleToDelete(null)
      onError(
        err instanceof Error
          ? err.message
          : 'Der Serienartikel konnte nicht gelöscht werden. Lade die Liste neu.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kopfzeile wie in der Werkzeugliste: Überschrift links, Schnellfilter rechts */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-base font-bold text-slate-900">Serienartikel</h2>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {plants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Werk</span>
              <div role="radiogroup" aria-label="Nach Werk filtern" className="ui-segments">
                <label>
                  <input
                    type="radio"
                    name="serienartikel-werk-filter"
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
                      name="serienartikel-werk-filter"
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

      {/* Suchleiste – ohne sichtbare Beschriftung (wie in der Werkzeugliste),
          der Name kommt für Screenreader aus `aria-label`. */}
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          id="serial-search"
          type="search"
          aria-label="Serienartikel durchsuchen"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Artikelnummer, Name, Werk, Kunde oder Maschine …"
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
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/70 text-left text-xs uppercase tracking-wider text-slate-600 bg-slate-200/40">
              {/* Favoriten-Spalte: der Stern steht in der Zeile (wie bei den Werkzeugen) */}
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
                      <Tooltip text="Sortierung wechseln (auf → ab → Standard)" className="contents">
                        <button
                          type="button"
                          onClick={() => handleSort(column.key as SerialArticleSortKey)}
                          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-800"
                        >
                          {column.label}
                          {/* SVG-Icons statt Textglyphen (▲▼↕) – wie in der Werkzeugliste */}
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
                      </Tooltip>
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
                    Serienartikel werden geladen …
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
                          : 'Keine Serienartikel für dieses Werk.'}
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
                        Noch keine Serienartikel vorhanden.
                      </p>
                      <p className="text-sm text-slate-600">
                        Ein Serienartikel ist ein PDF-Einrichteplan mit Artikelnummer, Werk und
                        optional Kunde, Maschine, Name und Beschreibung.
                      </p>
                      {canManage ? (
                        <button type="button" onClick={onCreate} className="ui-btn ui-btn-primary">
                          Serienartikel anlegen
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

            {items.map((article) => (
              // Die ganze Zeile öffnet die Vorschau (DEC-059): kein eigener
              // „Ansehen"-Knopf mehr. Tastaturbedienung über Enter/Leertaste,
              // damit die Zeile auch ohne Maus erreichbar bleibt.
              <tr
                key={article.id}
                tabIndex={0}
                onClick={() => onOpenFiles(article, article.has_pdf ? 'plan' : 'bilder')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenFiles(article, article.has_pdf ? 'plan' : 'bilder');
                  }
                }}
                // Glasverlauf wie in der Werkzeugliste (`.table-row-glass`),
                // Zebra über `even:bg-white/40`, Favoriten mit eigener Amber-Tönung
                // statt des Zebras – beides zusammen würde sich aufheben.
                className={`table-row-glass cursor-pointer transition-colors focus-visible:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700/60 ${
                  article.is_favorite
                    ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                    : 'even:bg-white/40 hover:bg-white/70'
                }`}
              >
                {/* Favorit: global für alle Benutzer (DEC-063) */}
                <td className="w-7 px-1 py-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleFavorite(article)
                    }}
                    aria-pressed={article.is_favorite}
                    aria-label={
                      article.is_favorite
                        ? `Favorit ${article.article_number} entfernen`
                        : `${article.article_number} zu den Favoriten hinzufügen`
                    }
                    disabled={busyFavoriteId === article.id}
                    className={`block rounded-lg p-1 hover:bg-white/70 disabled:opacity-50 ${
                      article.is_favorite ? 'bg-amber-500/20' : ''
                    }`}
                  >
                    <StarIcon
                      filled={article.is_favorite}
                      className={`h-4 w-4 ${
                        article.is_favorite ? 'text-amber-600' : 'text-slate-600'
                      }`}
                    />
                  </button>
                </td>
                {/* Artikelnummer in eigener Spalte – dieselbe Markierung wie die
                    Werkzeug-ID (Teal-Kante = Identität), damit sie sofort ins
                    Auge fällt. */}
                <td className="whitespace-nowrap px-3 py-2">
                  <code className="inline-flex rounded-lg border border-teal-700/30 bg-white/80 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                    {article.article_number}
                  </code>
                </td>
                {/* Name in genau derselben Markierung wie der Lagerplatz in der
                    Werkzeugliste (Sky-Kante, Mono, 14 px, fett, gleiche
                    Innenabstände) – nur die Kante unterscheidet die zweite
                    Kennung von der Nummer. Die Beschreibung steht darunter wie
                    dort der Werkname. */}
                <td className="px-3 py-2">
                  {article.name ? (
                    <code className="inline-flex max-w-[13rem] rounded-lg border border-sky-500/30 bg-white/85 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                      <span className="truncate">{article.name}</span>
                    </code>
                  ) : (
                    <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
                      —
                    </span>
                  )}
                  {article.description && (
                    <span className="mt-1 block max-w-[13rem] truncate text-xs text-slate-600">
                      {article.description}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{article.plant?.name ?? '—'}</td>
                {/* Zuordnung: Kunde in der Farbe aus den Stammdaten, Maschine darunter */}
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {article.customer?.color && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80"
                        style={{ backgroundColor: article.customer.color }}
                      />
                    )}
                    <span className="max-w-[9rem] truncate text-slate-900">
                      {article.customer?.name ?? <span className="text-slate-600">—</span>}
                    </span>
                  </span>
                  <span className="block max-w-[9rem] truncate text-xs text-slate-600">
                    {article.machine?.name ?? '—'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    {article.plans.length === 0 ? (
                      <span className="ui-badge ui-badge-neutral">Kein PDF</span>
                    ) : article.plans.length === 1 ? (
                      <span className="ui-badge ui-badge-success">PDF</span>
                    ) : (
                      <span className="ui-badge ui-badge-success">
                        {article.plans.length} Pläne
                      </span>
                    )}
                    {article.images.length > 0 && (
                      <span className="ui-badge ui-badge-info">
                        {article.images.length === 1
                          ? '1 Bild'
                          : `${article.images.length} Bilder`}
                      </span>
                    )}
                  </div>
                </td>
                {/* Aktionen im „…"-Menü – wie in der Werkzeugliste. Das Ansehen
                    läuft über die Zeile selbst, hier stehen nur noch Bearbeiten
                    und Löschen (nur Admin). Der Wrapper fängt den Klick ab,
                    damit das Menü nicht die Vorschau mit öffnet. */}
                <td className="w-12 px-2 py-2 text-right">
                  {canManage && (
                    <span
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <RowActionMenu
                        label={article.article_number}
                        actions={[
                          {
                            key: 'edit',
                            label: 'Bearbeiten',
                            onSelect: () => onEdit(article),
                          },
                          {
                            key: 'delete',
                            label: 'Löschen',
                            danger: true,
                            onSelect: () => setArticleToDelete(article),
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

      {/* Hinweis nur, wenn die Tabelle tatsächlich seitlich überläuft: sonst sieht
          die abgeschnittene Kante aus wie das Ende der Liste (wie in der
          Werkzeugliste). */}
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
        ariaLabel="Seitennavigation der Serienartikel"
        itemSingular="Serienartikel"
        itemPlural="Serienartikeln"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {!loading && total > 0 && page > pageCount(total, pageSize) && (
        <p className="text-sm text-slate-600">
          Diese Seite ist leer. Bitte zurückblättern.
        </p>
      )}

      {articleToDelete && (
        <ConfirmDialog
          title={`Serienartikel „${articleToDelete.article_number}“ löschen?`}
          description={
            articleToDelete.has_pdf
              ? 'Der Eintrag, der Einrichteplan und alle Dateien im Artikelordner werden entfernt. Das lässt sich nicht rückgängig machen.'
              : 'Der Eintrag und der Artikelordner samt Inhalt werden entfernt. Das lässt sich nicht rückgängig machen.'
          }
          confirmLabel="Serienartikel löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => {
            void confirmDelete()
          }}
          onCancel={() => setArticleToDelete(null)}
        />
      )}
    </div>
  )
}
