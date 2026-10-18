import { useState, type FormEvent } from 'react'
import { returnTool } from '../../api/movements'
import { TOOL_CATEGORY_LABELS } from '../../api/types'
import { useEscapeKey } from '../../lib/useEscapeKey'
import { toolLabel } from '../../lib/toolLabel'
import type { Tool } from '../../api/types'

interface ReturnModalProps {
  tool: Tool
  onClose: () => void
  onSuccess: () => void
}

/**
 * Rückgabe eines Werkzeugs an eine Person (DEC-078).
 *
 * Anders als die Ausleihe fragt die Rückgabe **keine Personalnummer** ab: Der
 * ausgeliehene Zustand ist schon erfasst, und die Rückgabe wird dem angemeldeten
 * Benutzer zugeschrieben (der Server nimmt ihn aus dem Token, nicht aus dem Body).
 * Das Arbeitswerk kommt aus dem Header – es bezeugt, für welches Werk
 * zurückgenommen wurde.
 *
 * `note` ist freiwillig und beschreibt den Zustand („Abstreifer gebrochen").
 */
export default function ReturnModal({ tool, onClose, onSuccess }: ReturnModalProps) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass = 'input-bordered text-base sm:text-sm'

  useEscapeKey(onClose, !saving)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await returnTool(tool.id, note)
      onSuccess()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Die Rückgabe konnte nicht gespeichert werden. Versuche es erneut.',
      )
    } finally {
      setSaving(false)
    }
  }

  const platz = tool.position_code || 'Ablage'

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-title"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="return-title" className="text-lg font-semibold text-slate-900">
            Werkzeug zurückgeben
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white/60 hover:text-slate-700"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/70 bg-white/40 px-4 py-3 text-sm">
          <p>
            <span className="font-medium text-slate-700">Werkzeug-ID:</span>{' '}
            <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
              {toolLabel(tool.tool_id)}
            </span>
          </p>
          <p className="mt-2">
            <span className="font-medium text-slate-700">Kategorie:</span>{' '}
            {TOOL_CATEGORY_LABELS[tool.category] ?? tool.category}
          </p>
          <p className="mt-2">
            <span className="font-medium text-slate-700">Heimatplatz:</span>{' '}
            <span className="font-mono">{platz}</span>
            <span className="ml-1 text-xs text-slate-500">
              (bleibt reserviert – das Werkzeug kommt dorthin zurück)
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="return-notiz"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Notiz (optional)
            </label>
            <input
              id="return-notiz"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. Zustand in Ordnung"
              className={inputClass}
            />
          </div>

          <p className="text-xs text-slate-600">
            Die Rückgabe wird mit deinem Benutzer und dem Arbeitswerk im Verlauf
            festgehalten. Danach steht das Werkzeug wieder auf „verfügbar“.
          </p>

          {error && (
            <div className="ui-alert ui-alert-error">
              <span>×</span>
              <div>{error}</div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="ui-btn ui-btn-primary">
              {saving ? 'Wird zurückgegeben …' : 'Zurückgeben'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
