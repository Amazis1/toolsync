import { useEffect, useState } from 'react'
import ToolList from '../components/tools/ToolList'
import ToolForm from '../components/tools/ToolForm'
import { createTool, deleteTool, updateTool } from '../api/tools'
import type { Tool, ToolInput } from '../api/types'

interface ToolsProps {
  /** Signal vom Header-Button: Zähler erhöht sich, wenn + Anlegen geklickt wird */
  createSignal?: number
}

export default function Tools({ createSignal }: ToolsProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Öffnet das Anlege-Formular (Inline im .tool-form-card), wenn + Anlegen geklickt wurde
  useEffect(() => {
    if (createSignal && createSignal > 0) {
      openCreateForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSignal])

  function openCreateForm() {
    setEditingTool(null)
    setShowForm(true)
  }

  function openEditForm(tool: Tool) {
    setEditingTool(tool)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTool(null)
  }

  async function handleDelete(id: number) {
    const ok = window.confirm('Werkzeug wirklich löschen?')
    if (!ok) return
    try {
      await deleteTool(id)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      console.error('Löschen fehlgeschlagen', e)
      alert('Löschen fehlgeschlagen. Bitte erneut versuchen.')
    }
  }

  async function handleSave(data: ToolInput): Promise<void> {
    if (editingTool) {
      await updateTool(editingTool.id, data)
    } else {
      await createTool(data)
    }
    setRefreshKey((k) => k + 1)
    closeForm()
  }

  // Anlegen-Formular als .tool-form-card – inline statt Modal, wie in test.html
  if (showForm) {
    return (
      <div className="tool-form-card rounded-2xl p-4 shadow-xs">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/40">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {editingTool ? 'Bearbeiten' : 'Anlegen'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition-all flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Zurück
            </button>
          </div>

          <ToolForm
            initial={editingTool}
            onSave={handleSave}
            onClose={closeForm}
          />
        </div>
      </div>
    )
  }

  // Werkzeugliste als .app-content-block (Anlegen erfolgt über + Anlegen in der Tabbar)
  return (
    <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
      <h2 className="text-base font-bold text-slate-900">Werkzeuge</h2>

      <ToolList
        onEdit={openEditForm}
        onDelete={handleDelete}
        refreshKey={refreshKey}
        onRefreshDone={() => {}}
      />
    </div>
  )
}