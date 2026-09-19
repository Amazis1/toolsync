import { useCallback, useEffect, useState } from 'react'
import { getTools } from '../../api/tools'
import { TOOL_CATEGORY_LABELS, TOOL_STATUS_LABELS } from '../../api/types'
import type { Tool, ToolCategory, ToolStatus } from '../../api/types'
import { formatMeasureMm } from './ToolForm'
import LendModal from '../movements/LendModal'

interface ToolListProps {
  onEdit: (tool: Tool) => void
  onDelete: (id: number) => void
  refreshKey: number
  onRefreshDone: () => void
}

export default function ToolList({ onEdit, onDelete, refreshKey, onRefreshDone }: ToolListProps) {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Modal-Status
  const [lendTool, setLendTool] = useState<Tool | null>(null)
  const [lendMessage, setLendMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTools(await getTools())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
      onRefreshDone()
    }
  }, [onRefreshDone])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function handleDelete(tool: Tool) {
    onDelete(tool.id)
  }

  const filtered = tools.filter((tool) => {
    const q = search.trim().toLowerCase()
    if (q) {
      const haystack = [
        tool.tool_id,
        tool.description ?? '',
        tool.tool_type?.name ?? '',
        tool.plant?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (categoryFilter && tool.category !== categoryFilter) return false
    if (statusFilter && tool.status !== statusFilter) return false
    return true
  })

  const statusBadgeClass = (status: ToolStatus | null): string => {
    switch (status) {
      case 'available':
        return 'ui-badge ui-badge-success'
      case 'lent':
        return 'ui-badge ui-badge-info'
      case 'maintenance':
        return 'ui-badge ui-badge-warning'
      case 'defective':
      case 'in_transit':
        return 'ui-badge ui-badge-danger'
      default:
        return 'ui-badge ui-badge-neutral'
    }
  }

  const statusDotClass = (status: ToolStatus | null): string => {
    switch (status) {
      case 'available':
        return 'bg-emerald-500'
      case 'lent':
        return 'bg-teal-500'
      case 'maintenance':
        return 'bg-amber-500'
      case 'defective':
      case 'in_transit':
        return 'bg-rose-500'
      default:
        return 'bg-slate-400'
    }
  }

  return (
    <div>
      {/* Such- und Filterleiste */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="search"
            placeholder="Werkzeug-ID, Bezeichnung, Typ oder Werk…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-bordered text-sm pl-10 pr-4 py-2"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select-bordered text-xs px-3 py-1.5 cursor-pointer"
        >
          <option value="">Alle Kategorien</option>
          {(Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]).map((c) => (
            <option key={c} value={c}>
              {TOOL_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-bordered text-xs px-3 py-1.5 cursor-pointer"
        >
          <option value="">Alle Status</option>
          {(Object.keys(TOOL_STATUS_LABELS) as ToolStatus[]).map((s) => (
            <option key={s} value={s}>
              {TOOL_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {lendMessage && (
        <div className="ui-alert ui-alert-success mb-4">
          <span>✓</span>
          <div>{lendMessage}</div>
        </div>
      )}

      {error && (
        <div className="ui-alert ui-alert-error mb-4">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="ui-spinner" />
          <p className="text-sm text-slate-500">Werkzeuge werden geladen …</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {tools.length === 0
            ? 'Noch keine Werkzeuge vorhanden. Lege das erste Werkzeug an.'
            : 'Keine Werkzeuge für die aktuellen Filter gefunden.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[760px] whitespace-nowrap text-left text-xs">
            <thead className="border-b border-slate-200/60 bg-white/50 font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-3">Werkzeug-ID</th>
                <th className="px-3.5 py-3">Bezeichnung</th>
                <th className="px-3.5 py-3">Maße</th>
                <th className="px-3.5 py-3">Standort</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tool) => (
                <tr
                  key={tool.id}
                  className="border-b border-slate-200/40 transition-colors last:border-b-0 hover:bg-white/50"
                >
                  <td className="px-3.5 py-3">
                    <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
                      {tool.tool_id}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">
                    {tool.description || tool.tool_type?.name || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {tool.measure_a || tool.measure_b
                      ? `${tool.measure_a ? formatMeasureMm(tool.measure_a) : '—'}${
                          tool.measure_b ? ` / ${formatMeasureMm(tool.measure_b)}` : ''
                        }`
                      : '—'}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{tool.plant?.name ?? '—'}</td>
                  <td className="px-3.5 py-3">
                    {tool.status ? (
                      <span className={statusBadgeClass(tool.status)}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(tool.status)}`} />
                        {TOOL_STATUS_LABELS[tool.status] ?? tool.status}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {tool.status === 'available' && (
                      <button
                        onClick={() => setLendTool(tool)}
                        className="ui-btn ui-btn-primary ui-btn-sm mr-2"
                      >
                        Ausleihen
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(tool)}
                      className="ui-btn ui-btn-secondary ui-btn-sm mr-2"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(tool)}
                      title="Löschen"
                      className="ui-btn ui-btn-danger-soft ui-btn-sm"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lendTool && (
        <LendModal
          tool={lendTool}
          onClose={() => setLendTool(null)}
          onSuccess={() => {
            setLendTool(null)
            setLendMessage(`"${lendTool.tool_id}" wurde ausgeliehen.`)
            setTimeout(() => setLendMessage(null), 4000)
            load()
          }}
        />
      )}
    </div>
  )
}
