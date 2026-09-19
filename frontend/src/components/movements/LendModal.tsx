import { useState, type FormEvent } from 'react'
import { createMovement } from '../../api/movements'
import { TOOL_CATEGORY_LABELS } from '../../api/types'
import type { Tool } from '../../api/types'

interface LendModalProps {
  tool: Tool
  onClose: () => void
  onSuccess: () => void
}

export default function LendModal({ tool, onClose, onSuccess }: LendModalProps) {
  const [personalNumber, setPersonalNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass = 'input-bordered text-sm'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!personalNumber.trim()) {
      setError('Die Personalnummer ist erforderlich.')
      return
    }

    setSaving(true)
    try {
      // TODO: user_id aus JWT-Token holen, sobald implementiert
      await createMovement({
        movement_type: 'lend',
        tool_id: tool.id,
        user_id: null,
        note: `Personalnummer: ${personalNumber.trim()}${note.trim() ? ` | ${note.trim()}` : ''}`,
      })
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ausleihe fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-panel w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Werkzeug ausleihen</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-white/60 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/70 bg-white/40 px-4 py-3 text-sm">
          <p>
            <span className="font-medium text-slate-700">Werkzeug-ID:</span>{' '}
            <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
              {tool.tool_id}
            </span>
          </p>
          <p className="mt-2">
            <span className="font-medium text-slate-700">Kategorie:</span>{' '}
            {TOOL_CATEGORY_LABELS[tool.category] ?? tool.category}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Personalnummer *</label>
            <input
              type="text"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              placeholder="z.B. 4711"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notiz (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. für welche Maschine"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="ui-alert ui-alert-error">
              <span>×</span>
              <div>{error}</div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-secondary"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="ui-btn ui-btn-primary"
            >
              {saving ? 'Wird ausgeliehen …' : 'Ausleihen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
