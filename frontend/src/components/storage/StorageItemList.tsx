import { useCallback, useEffect, useState } from 'react'
import { deleteStorageItem, getStorageItems } from '../../api/storage'
import type { StorageItem } from '../../types/storage-item'

interface StorageItemListProps {
  onEdit: (item: StorageItem) => void
  refreshKey: number
  onRefreshDone: () => void
}

export default function StorageItemList({ onEdit, refreshKey, onRefreshDone }: StorageItemListProps) {
  const [items, setItems] = useState<StorageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await getStorageItems(search))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
      onRefreshDone()
    }
  }, [onRefreshDone, search])

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [load, refreshKey])

  async function handleDelete(item: StorageItem) {
    const ok = window.confirm(`Lager-/Ersatzobjekt "${item.storage_id}" wirklich löschen?`)
    if (!ok) return
    try {
      await deleteStorageItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/40 shadow-sm backdrop-blur-xl">
      <div className="border-b border-white/70 p-4">
        <input
          type="text"
          placeholder="Lager/Ersatz durchsuchen (ID, Name, Typ, Artikelnummer) …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-bordered text-sm w-full max-w-md"
        />
      </div>

      {error && (
        <div className="mx-4 my-3 ui-alert ui-alert-error">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="ui-spinner" />
          <p className="text-sm text-slate-500">Lager/Ersatz wird geladen …</p>
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {search.trim()
            ? 'Keine Lager-/Ersatzobjekte gefunden.'
            : 'Noch keine Lager-/Ersatzobjekte vorhanden. Lege das erste Objekt an.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-white/70">
                <th className="px-3 py-2">Lager-ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Artikelnummer</th>
                <th className="px-3 py-2">Maschine</th>
                <th className="px-3 py-2">Ort</th>
                <th className="px-3 py-2">Duplikate</th>
                <th className="px-3 py-2">Beschreibung</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-white/40">
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
                      {item.storage_id}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-800">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.type ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{item.article_number ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{item.machine_id ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{item.location_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    {item.allow_duplicate_id ? (
                      <span className="ui-badge ui-badge-warning">erlaubt</span>
                    ) : (
                      <span className="ui-badge ui-badge-neutral">eindeutig</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-600" title={item.description ?? ''}>
                    {item.description ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEdit(item)}
                      className="ui-btn ui-btn-secondary ui-btn-sm mr-2"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
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
    </div>
  )
}
