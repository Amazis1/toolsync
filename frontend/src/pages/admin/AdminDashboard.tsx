import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getTools } from '../../api/tools'
import type { Tool } from '../../api/types'
import AdminUsers from './AdminUsers'


export default function AdminDashboard() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    getTools()
      .then((data) => {
        if (mounted) {
          setTools(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const total = tools.length
  const borrowed = tools.filter((t) => t.status === 'lent').length
  const available = tools.filter((t) => t.status === 'available').length
  const maintenance = tools.filter(
    (t) => t.status === 'maintenance' || t.status === 'defective',
  ).length

  const filteredTools = tools.filter((tool) => {
    const q = search.toLowerCase()
    return (
      tool.tool_id.toLowerCase().includes(q) ||
      (tool.description ?? '').toLowerCase().includes(q) ||
      (tool.tool_type?.name ?? '').toLowerCase().includes(q)
    )
  })

  const getStatusBadge = (status: Tool['status']) => {
    switch (status) {
      case 'available':
        return <span className="admin-badge admin-badge-success"><span className="admin-dot" /> Frei</span>
      case 'lent':
        return <span className="admin-badge admin-badge-danger"><span className="admin-dot" /> Ausgeliehen</span>
      case 'maintenance':
        return <span className="admin-badge admin-badge-warning"><span className="admin-dot" /> Wartung</span>
      case 'defective':
        return <span className="admin-badge admin-badge-warning"><span className="admin-dot" /> Defekt</span>
      case 'in_transit':
        return <span className="admin-badge admin-badge-neutral"><span className="admin-dot" /> In Transit</span>
      default:
        return <span className="admin-badge admin-badge-neutral">—</span>
    }
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="admin-kpi" style={{ '--kpi-accent': 'var(--admin-neutral)' } as CSSProperties}>
          <div className="admin-kpi-label">Gesamt</div>
          <div className="admin-kpi-value tnum">{loading ? '…' : total}</div>
        </div>
        <div className="admin-kpi" style={{ '--kpi-accent': 'var(--admin-success)' } as CSSProperties}>
          <div className="admin-kpi-label">Frei</div>
          <div className="admin-kpi-value tnum">{loading ? '…' : available}</div>
        </div>
        <div className="admin-kpi" style={{ '--kpi-accent': 'var(--admin-danger)' } as CSSProperties}>
          <div className="admin-kpi-label">Ausgeliehen</div>
          <div className="admin-kpi-value tnum">{loading ? '…' : borrowed}</div>
        </div>
        <div className="admin-kpi" style={{ '--kpi-accent': 'var(--admin-warning)' } as CSSProperties}>
          <div className="admin-kpi-label">Wartung</div>
          <div className="admin-kpi-value tnum">{loading ? '…' : maintenance}</div>
        </div>
      </div>

      {/* Benutzerverwaltung */}
      <AdminUsers />

      {/* Suche */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-subtle)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Werkzeug, ID oder Typ filtern…"
              className="admin-input pl-8"
            />
          </div>
          {error && <span className="text-xs" style={{ color: 'var(--admin-danger)' }}>{error}</span>}
        </div>
      </div>

      {/* Tools-Tabelle */}
      <div className="admin-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--admin-divider)' }}>
          <span className="section-title">Werkzeugbestand</span>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--admin-text-subtle)' }}>{filteredTools.length} Einträge</span>
        </div>

        {loading ? (
          <div className="admin-table-empty">Wird geladen…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Bezeichnung</th>
                  <th>Typ</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.slice(0, 20).map((tool) => (
                  <tr key={tool.id}>
                    <td className="font-mono font-semibold" style={{ color: 'var(--admin-text)' }}>{tool.tool_id}</td>
                    <td>{tool.description || '—'}</td>
                    <td style={{ color: 'var(--admin-text-subtle)' }}>{tool.tool_type?.name ?? '—'}</td>
                    <td>{getStatusBadge(tool.status)}</td>
                  </tr>
                ))}
                {filteredTools.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      Keine Werkzeuge gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}



