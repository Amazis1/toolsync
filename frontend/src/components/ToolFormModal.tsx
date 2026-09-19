import { useEffect, useState, type FormEvent } from 'react'
import { TOOL_CATEGORY_LABELS, TOOL_STATUS_LABELS } from '../api/types'
import type { Tool, ToolCategory, ToolInput, ToolStatus } from '../api/types'

interface ToolFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ToolInput) => Promise<void>
  initialData?: Tool | null
  title: string
}

// Leere Strings werden vor dem Speichern zu null – sonst würde das Backend
// leere Werte statt "kein Wert" speichern.
function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

const ToolFormModal: React.FC<ToolFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
}) => {
  const [formData, setFormData] = useState<ToolInput>({
    tool_id: '',
    category: 'Stempel',
    status: null,
    is_storage: false,
    allow_duplicate_id: false,
    measure_a: null,
    measure_b: null,
    description: null,
    plant_id: 0,
    tool_type_id: 0,
    position_id: null,
    machine_id: null,
    customer_id: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Felder befüllen/zurücksetzen, sobald sich initialData ändert oder das Modal öffnet
  useEffect(() => {
    if (initialData) {
      setFormData({
        tool_id: initialData.tool_id,
        category: initialData.category,
        status: initialData.status,
        is_storage: initialData.is_storage,
        allow_duplicate_id: initialData.allow_duplicate_id,
        measure_a: initialData.measure_a,
        measure_b: initialData.measure_b,
        description: initialData.description,
        plant_id: initialData.plant_id,
        tool_type_id: initialData.tool_type_id,
        position_id: initialData.position_id,
        machine_id: initialData.machine_id,
        customer_id: initialData.customer_id,
      })
    } else {
      setFormData({
        tool_id: '',
        category: 'Stempel',
        status: null,
        is_storage: false,
        allow_duplicate_id: false,
        measure_a: null,
        measure_b: null,
        description: null,
        plant_id: 0,
        tool_type_id: 0,
        position_id: null,
        machine_id: null,
        customer_id: null,
      })
    }
    setError(null)
  }, [initialData, isOpen])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Pflichfelder, die das Backend erwartet
      const payload: ToolInput = {
        ...formData,
        tool_id: formData.tool_id.trim(),
        measure_a: emptyToNull(formData.measure_a ?? ''),
        measure_b: emptyToNull(formData.measure_b ?? ''),
        description: emptyToNull(formData.description ?? ''),
      }
      await onSave(payload)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Fehler beim Speichern.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const inputClass = 'w-full mt-1 rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-sm backdrop-blur-sm focus:ring-2 focus:ring-teal-500/20 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/70 bg-white/50 p-6 shadow-xl backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Werkzeug-ID *</label>
            <input
              type="text"
              name="tool_id"
              value={formData.tool_id}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Kategorie *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={inputClass}
            >
              {(Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]).map((c) => (
                <option key={c} value={c}>
                  {TOOL_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select
              name="status"
              value={formData.status ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  status: e.target.value === '' ? null : (e.target.value as ToolStatus),
                }))
              }
              className={inputClass}
            >
              <option value="">— ohne Status —</option>
              {(Object.keys(TOOL_STATUS_LABELS) as ToolStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TOOL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Maß A (optional)</label>
            <input
              type="text"
              name="measure_a"
              value={formData.measure_a ?? ''}
              onChange={handleChange}
              placeholder="z.B. 75,0"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Maß B (optional)</label>
            <input
              type="text"
              name="measure_b"
              value={formData.measure_b ?? ''}
              onChange={handleChange}
              placeholder="z.B. 120,0"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Beschreibung (optional)</label>
            <textarea
              name="description"
              value={formData.description ?? ''}
              onChange={handleChange}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_storage"
              checked={formData.is_storage}
              onChange={handleChange}
              className="mr-2"
            />
            <label className="text-sm font-medium text-slate-700">Ersatzteil / Lagerware</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="allow_duplicate_id"
              checked={formData.allow_duplicate_id}
              onChange={handleChange}
              className="mr-2"
            />
            <label className="text-sm font-medium text-slate-700">Doppelte ID erlaubt</label>
          </div>

          <div className="flex justify-end gap-3 border-t border-white/70 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ToolFormModal