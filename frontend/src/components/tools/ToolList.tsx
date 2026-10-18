import { useRef } from 'react'
import ToolFilterBar from './ToolFilterBar'
import ToolPagination from './ToolPagination'
import ToolTable from './ToolTable'
import { ResetIcon, ToolIcon } from '../icons'
import type { Tool, ToolSortKey, ToolType } from '../../api/types'
import type { ToolQuery } from '../../lib/toolQuery'
import { hasActiveSearch } from '../../lib/toolQuery'

interface ToolListProps {
  query: ToolQuery
  searchText: string
  tools: Tool[]
  total: number
  loading: boolean
  /** Werkzeug, dessen Favorit gerade gespeichert wird (Knopf gesperrt). */
  busyFavoriteId: number | null
  toolTypes: ToolType[]
  onSearchTextChange: (value: string) => void
  /** Filterwechsel – setzt immer auf Seite 1 zurück. */
  onQueryChange: (patch: Partial<ToolQuery>) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onResetFilters: () => void
  onSort: (key: ToolSortKey) => void
  onToggleFavorite: (tool: Tool) => void
  onEdit: (tool: Tool) => void
  onDelete: (tool: Tool) => void
  onLend: (tool: Tool) => void
  /** Rückgabe eines einzelnen Werkzeugs (DEC-078). */
  onReturn: (tool: Tool) => void
  /** Datenblätter dieses Werkzeugs öffnen (DEC-065 Punkt 10). */
  onOpenDataSheets: (tool: Tool) => void
  onCreate: () => void
}

/**
 * Werkzeugliste: Filterleiste, Tabelle und Blätterleiste.
 *
 * Diese Komponente lädt nichts selbst — Zustand und Abfrage liegen in
 * `pages/Tools.tsx`. Nur so überlebt die Ansicht den Weg ins Formular und
 * zurück, und nur so passen Adresszeile und Liste immer zusammen.
 */
export default function ToolList({
  query,
  searchText,
  tools,
  total,
  loading,
  busyFavoriteId,
  toolTypes,
  onSearchTextChange,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  onSort,
  onToggleFavorite,
  onEdit,
  onDelete,
  onLend,
  onReturn,
  onOpenDataSheets,
  onCreate,
}: ToolListProps) {
  const tableRef = useRef<HTMLDivElement>(null)

  const filtered = hasActiveSearch(query)
  const showNoData = !loading && total === 0 && !filtered
  const showNoMatch = !loading && total === 0 && filtered
  const showEmptyPage = !loading && tools.length === 0 && total > 0

  /** Nach dem Blättern zurück zur Tabelle – sonst steht man auf der Leiste. */
  function goToPage(page: number) {
    onPageChange(page)
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      <ToolFilterBar
        query={query}
        searchText={searchText}
        toolTypes={toolTypes}
        loading={loading}
        onSearchTextChange={onSearchTextChange}
        onQueryChange={onQueryChange}
        onReset={onResetFilters}
      />

      {showNoData && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/60 bg-white/30 px-4 py-10 text-center">
          <ToolIcon className="h-6 w-6 text-slate-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">Noch keine Werkzeuge vorhanden</p>
            <p className="mt-1 text-xs text-slate-600">
              Lege das erste Werkzeug an – danach lässt sich die Liste durchsuchen,
              filtern und sortieren.
            </p>
          </div>
          <button type="button" onClick={onCreate} className="ui-btn ui-btn-primary">
            Werkzeug anlegen
          </button>
        </div>
      )}

      {showNoMatch && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/60 bg-white/30 px-4 py-10 text-center">
          <p className="text-sm font-bold text-slate-900">
            {query.q.trim()
              ? `Keine Treffer für „${query.q.trim()}“`
              : 'Keine Werkzeuge für die aktuellen Filter'}
          </p>
          <p className="text-xs text-slate-600">
            Suche oder Filter anpassen – oder alles zurücksetzen und die vollständige
            Liste ansehen.
          </p>
          <button type="button" onClick={onResetFilters} className="ui-btn ui-btn-secondary">
            <ResetIcon className="h-3.5 w-3.5" />
            Alle Filter zurücksetzen
          </button>
        </div>
      )}

      {showEmptyPage && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/60 bg-white/30 px-4 py-8 text-center">
          <p className="text-sm font-bold text-slate-900">
            Diese Seite ist leer
          </p>
          <p className="text-xs text-slate-600">
            Die Filter haben sich geändert und die Liste ist kürzer geworden.
          </p>
          <button
            type="button"
            onClick={() => goToPage(1)}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Zur ersten Seite
          </button>
        </div>
      )}

      {!showNoData && !showNoMatch && (
        <div ref={tableRef} className="scroll-mt-4">
          <ToolTable
            tools={tools}
            query={query}
            loading={loading}
            busyFavoriteId={busyFavoriteId}
            onSort={onSort}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onLend={onLend}
            onReturn={onReturn}
            onOpenDataSheets={onOpenDataSheets}
          />
        </div>
      )}

      <ToolPagination
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        busy={loading}
        onPageChange={goToPage}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
