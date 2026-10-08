import { useEffect, useRef, useState } from 'react'
import {
  ChevronDownIcon,
  FilterIcon,
  ResetIcon,
  SearchIcon,
  XIcon,
} from '../icons'
import { TOOL_STATUS_LABELS } from '../../api/types'
import type { ToolStatus, ToolType } from '../../api/types'
import type { ToolQuery } from '../../lib/toolQuery'
import { useEscapeKey } from '../../lib/useEscapeKey'

interface ToolFilterBarProps {
  query: ToolQuery
  searchText: string
  toolTypes: ToolType[]
  loading: boolean
  onSearchTextChange: (value: string) => void
  onQueryChange: (patch: Partial<ToolQuery>) => void
  onReset: () => void
}

const MENU_OPTION =
  'flex cursor-pointer items-center gap-2 rounded-[0.55rem] px-2 py-1.5 text-xs text-slate-700 hover:bg-teal-700/10'

/**
 * Mehrfachauswahl als aufklappbares Menü (.ui-menu).
 *
 * Ein natives Mehrfach-Auswahlfeld wäre auf dem Tablet nicht bedienbar
 * (Zeilen müssen mit Strg/Shift markiert werden). Hier genügt ein Tippen je
 * Wert, und der Knopf zeigt jederzeit, wie viele Werte gewählt sind.
 */
function MultiFilterMenu<T extends string>({
  label,
  allLabel,
  values,
  labels,
  selected,
  onChange,
}: {
  label: string
  /** Beschriftung, wenn nichts gewählt ist („Alle Status"). */
  allLabel: string
  values: T[]
  labels: Record<T, string>
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Klick außerhalb schließt das Menü.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Escape schließt nur das Menü – nicht die ganze Ansicht.
  useEscapeKey(() => setOpen(false), open)

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    )
  }

  const buttonText =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? labels[selected[0]]
        : `${selected.length} gewählt`

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${label} filtern${
          selected.length === 0 ? ' (alle)' : `: ${buttonText}`
        }`}
        className={`input-bordered flex w-auto cursor-pointer items-center gap-2 px-3 py-1.5 text-base font-medium sm:text-sm ${
          selected.length > 0 ? 'text-teal-800' : 'text-slate-700'
        }`}
      >
        {buttonText}
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <div className="ui-menu absolute left-0 top-full z-20 mt-1">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 flex w-full items-center gap-2 border-b border-white/70 py-1.5 text-teal-800"
            >
              <ResetIcon className="h-3.5 w-3.5" />
              Auswahl aufheben
            </button>
          )}
          {values.map((value) => (
            <label key={value} className={MENU_OPTION}>
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              {labels[value]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Such- und Filterleiste über der Werkzeugliste.
 *
 * Kategorie, Werk und Favoriten sitzen bewusst **nicht** hier, sondern in der
 * Kopfzeile der Liste (`ToolQuickFilters`) – dort als segmentierte Auswahl
 * neben der Überschrift. Hier bleiben Suche, Status, Bestand und Lagerplatz.
 */
export default function ToolFilterBar({
  query,
  searchText,
  toolTypes,
  loading,
  onSearchTextChange,
  onQueryChange,
  onReset,
}: ToolFilterBarProps) {
  const hasSearch = query.q.trim().length > 0
  // Chips nur für die Filter, die hier eingestellt werden. Kategorie, Werk und
  // Favoriten zeigen ihren Zustand in der Kopfzeile selbst (gedrückter Knopf).
  // Die **Sortierung** steht bewusst nicht hier: sie wird über die
  // Spaltenköpfe gesetzt und mit einem dritten Klick auf denselben Kopf wieder
  // abgewählt — sie ist keine Filterauswahl.
  const chipsVisible =
    hasSearch ||
    query.statuses.length > 0 ||
    query.toolTypeId != null ||
    query.storage !== 'all' ||
    query.place !== 'all'

  const selectClass =
    'select-bordered w-auto cursor-pointer px-3 py-1.5 text-base font-medium sm:text-sm'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="search"
            aria-label="Werkzeuge durchsuchen"
            placeholder="Werkzeug-ID, Bezeichnung, Typ, Werk, Kunde oder Maschine …"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            className="input-bordered w-full py-2 pl-9 pr-9 text-base sm:text-sm"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => onSearchTextChange('')}
              aria-label="Suche leeren"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-600 hover:bg-white/70"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {loading && (
            <span
              className="ui-spinner absolute right-9 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              role="status"
              aria-label="Liste wird geladen"
            />
          )}
        </div>

        <MultiFilterMenu
          label="Status"
          allLabel="Alle Status"
          values={Object.keys(TOOL_STATUS_LABELS) as ToolStatus[]}
          labels={TOOL_STATUS_LABELS}
          selected={query.statuses}
          onChange={(statuses) => onQueryChange({ statuses })}
        />

        <select
          aria-label="Nach Werkzeugtyp filtern"
          value={query.toolTypeId ?? ''}
          onChange={(event) =>
            onQueryChange({
              toolTypeId: event.target.value ? Number(event.target.value) : null,
            })
          }
          className={selectClass}
        >
          <option value="">Alle Werkzeugtypen</option>
          {toolTypes.map((toolType) => (
            <option key={toolType.id} value={toolType.id}>
              {toolType.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Nach Bestand filtern"
          value={query.storage}
          onChange={(event) =>
            onQueryChange({ storage: event.target.value as ToolQuery['storage'] })
          }
          className={selectClass}
        >
          <option value="all">Werkzeuge und Ersatz</option>
          <option value="tools">Nur Werkzeuge</option>
          <option value="storage">Nur Lager/Ersatz</option>
        </select>

        <select
          aria-label="Nach Lagerplatz filtern"
          value={query.place}
          onChange={(event) =>
            onQueryChange({ place: event.target.value as ToolQuery['place'] })
          }
          className={selectClass}
        >
          <option value="all">Alle Lagerplätze</option>
          <option value="with">Mit festem Lagerplatz</option>
          <option value="tray">Nur Ablage</option>
        </select>
      </div>

      {chipsVisible && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <FilterIcon className="h-3.5 w-3.5" />
            Aktive Filter
          </span>

          {hasSearch && (
            <FilterChip
              label={`Suche: „${query.q.trim()}“`}
              onRemove={() => onSearchTextChange('')}
            />
          )}
          {query.statuses.length > 0 && (
            <FilterChip
              label={query.statuses.map((s) => TOOL_STATUS_LABELS[s]).join(', ')}
              onRemove={() => onQueryChange({ statuses: [] })}
            />
          )}
          {query.toolTypeId != null && (
            <FilterChip
              label={
                toolTypes.find((type) => type.id === query.toolTypeId)?.name ??
                `Typ ${query.toolTypeId}`
              }
              onRemove={() => onQueryChange({ toolTypeId: null })}
            />
          )}
          {query.storage !== 'all' && (
            <FilterChip
              label={query.storage === 'storage' ? 'Nur Lager/Ersatz' : 'Nur Werkzeuge'}
              onRemove={() => onQueryChange({ storage: 'all' })}
            />
          )}
          {query.place !== 'all' && (
            <FilterChip
              label={query.place === 'with' ? 'Mit festem Lagerplatz' : 'Nur Ablage'}
              onRemove={() => onQueryChange({ place: 'all' })}
            />
          )}

          <button
            type="button"
            onClick={onReset}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            <ResetIcon className="h-3.5 w-3.5" />
            Alle Filter zurücksetzen
          </button>
        </div>
      )}
    </div>
  )
}

/** Ein gesetzter Filter als entfernbarer Chip. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="ui-badge ui-badge-neutral gap-1.5 pr-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Filter entfernen: ${label}`}
        className="rounded-full p-0.5 hover:bg-white/70"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  )
}
