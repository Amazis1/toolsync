import { useEffect, useState } from 'react'
import {
  getToolTypes,
  createToolType,
  updateToolType,
  deleteToolType,
} from '../../api/admin'
import type { ToolType } from '../../api/types'

export default function AdminToolTypes() {
  const [toolTypes, setToolTypes] = useState<ToolType[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getToolTypes()
      .then(setToolTypes)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.'),
      )
  }, [refreshKey])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!newName.trim()) return
    try {
      await createToolType(newName.trim())
      setNewName('')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.')
    }
  }

  async function handleUpdate(id: number) {
    setError(null)
    if (!editingValue.trim()) return
    try {
      await updateToolType(id, editingValue.trim())
      setEditingId(null)
      setEditingValue('')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Werkzeugtyp wirklich löschen?')) return
    try {
      await deleteToolType(id)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Werkzeugtypen</h3>
      </div>

      {error && <div className="admin-alert admin-alert-error"><span>×</span><div>{error}</div></div>}

      <div className="admin-card p-4">
        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <input
            className="admin-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Neuer Typ, z. B. 01 Rund"
        />
          <button type="submit" className="admin-btn admin-btn-primary shrink-0">
          Hinzufügen
        </button>
      </form>

        <div className="overflow-x-auto">
          <table className="admin-table">
          <thead>
              <tr>
                <th>Typ-Code + Bezeichnung</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
            {toolTypes.map((type) => (
                <tr key={type.id}>
                  <td>
                    {editingId === type.id ? (
                      <input
                        className="admin-input"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                    ) : (
                      <span className="font-mono font-bold" style={{ color: 'var(--admin-text)' }}>{type.name}</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {editingId === type.id ? (
                        <>
                          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdate(type.id)}>
                            Speichern
                          </button>
                          <button className="admin-btn admin-btn-ghost !py-1 !px-2.5" onClick={() => {
                            setEditingId(null)
                            setEditingValue('')
                          }}>
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <>
                          <button className="admin-btn admin-btn-tertiary admin-btn-sm" onClick={() => {
                            setEditingId(type.id)
                            setEditingValue(type.name)
                          }}>
                            Bearbeiten
                          </button>
                          <button className="admin-btn admin-btn-danger-ghost admin-btn-sm" onClick={() => handleDelete(type.id)}>
                            Löschen
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}