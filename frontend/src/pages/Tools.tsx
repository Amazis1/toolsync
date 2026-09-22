import { useEffect, useState } from 'react'
import ToolList from '../components/tools/ToolList'
import ToolForm from '../components/tools/ToolForm'
import ConfirmDialog from '../components/ConfirmDialog'
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
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function confirmDelete() {
    if (!toolToDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTool(toolToDelete.id)
      setToolToDelete(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      setToolToDelete(null)
      setDeleteError(
        e instanceof Error
          ? e.message
          : 'Das Werkzeug konnte nicht gelöscht werden. Lade die Liste neu.',
      )
    } finally {
      setDeleting(false)
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
              <svg className="w-4 h-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {editingTool ? 'Bearbeiten' : 'Anlegen'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="ui-btn ui-btn-secondary ui-btn-sm"
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

      {deleteError && (
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{deleteError}</div>
        </div>
      )}

      <ToolList
        onEdit={openEditForm}
        onDelete={setToolToDelete}
        refreshKey={refreshKey}
        onRefreshDone={() => {}}
      />

      {toolToDelete && (
        <ConfirmDialog
          title={`Werkzeug „${toolToDelete.tool_id}“ löschen?`}
          description="Das Werkzeug wird endgültig entfernt. Das lässt sich nicht rückgängig machen."
          confirmLabel="Werkzeug löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => { void confirmDelete() }}
          onCancel={() => setToolToDelete(null)}
        />
      )}
    </div>
  )
}