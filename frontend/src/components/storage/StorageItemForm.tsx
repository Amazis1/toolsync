import { useState, type FormEvent } from 'react'
import { useEscapeKey } from '../../lib/useEscapeKey'
import type { StorageItem, StorageItemInput } from '../../types/storage-item'

interface StorageItemFormProps {
  initial: StorageItem | null
  onSave: (input: StorageItemInput) => Promise<void>
  onClose: () => void
}

function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

export default function StorageItemForm({ initial, onSave, onClose }: StorageItemFormProps) {
  const [storageId, setStorageId] = useState(initial?.storage_id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? '')
  const [articleNumber, setArticleNumber] = useState(initial?.article_number ?? '')
  const [machineId, setMachineId] = useState(initial?.machine_id ? String(initial.machine_id) : '')
  const [locationId, setLocationId] = useState(initial?.location_id ? String(initial.location_id) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [allowDuplicate, setAllowDuplicate] = useState(initial?.allow_duplicate_id ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape schließt das Formular (Tastaturbedienung), außer während gespeichert wird.
  useEscapeKey(onClose, !saving)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!storageId.trim()) {
      setError('Die Lager-ID ist erforderlich.')
      return
    }
    if (!name.trim()) {
      setError('Der Name ist erforderlich.')
      return
    }

    const input: StorageItemInput = {
      storage_id: storageId.trim(),
      name: name.trim(),
      type: emptyToNull(type),
      article_number: emptyToNull(articleNumber),
      machine_id: machineId ? Number(machineId) : null,
      location_id: locationId ? Number(locationId) : null,
      description: emptyToNull(description),
      allow_duplicate_id: allowDuplicate,
    }

    setSaving(true)
    try {
      await onSave(input)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Das Objekt konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      )
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'input-bordered text-base sm:text-sm'

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-form-title"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto p-6 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="storage-form-title" className="text-lg font-semibold text-slate-900">
            {initial ? `Lager-/Ersatzobjekt bearbeiten: ${initial.storage_id}` : 'Neues Lager-/Ersatzobjekt anlegen'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-1 text-slate-700 hover:bg-white/60 hover:text-slate-900"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="storage-id" className="mb-1 block text-sm font-medium text-slate-700">
                Lager-ID <span aria-hidden="true">*</span>
              </label>
              <input
                id="storage-id"
                type="text"
                value={storageId}
                onChange={(e) => setStorageId(e.target.value)}
                placeholder="z. B. 01075000"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="storage-name" className="mb-1 block text-sm font-medium text-slate-700">
                Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="storage-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Rundstempel 75x120"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="storage-type" className="mb-1 block text-sm font-medium text-slate-700">Typ</label>
              <input
                id="storage-type"
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="z. B. Rundstempel"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="storage-article-number" className="mb-1 block text-sm font-medium text-slate-700">Artikelnummer</label>
              <input
                id="storage-article-number"
                type="text"
                value={articleNumber}
                onChange={(e) => setArticleNumber(e.target.value)}
                placeholder="z. B. 01075000"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="storage-machine-id" className="mb-1 block text-sm font-medium text-slate-700">Maschinen-ID</label>
              <input
                id="storage-machine-id"
                type="number"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder="z. B. 3"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="storage-location-id" className="mb-1 block text-sm font-medium text-slate-700">Ort / Lagerplatz</label>
              <input
                id="storage-location-id"
                type="number"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="z. B. 5"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="storage-description" className="mb-1 block text-sm font-medium text-slate-700">Beschreibung</label>
              <input
                id="storage-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allowDuplicate}
              onChange={(e) => setAllowDuplicate(e.target.checked)}
              className="rounded accent-teal-700 h-4 w-4"
            />
            Doppelte ID erlaubt (Mehrfachobjekt)
          </label>

          {error && (
            <div className="ui-alert ui-alert-error">
              <span>×</span>
              <div>{error}</div>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-white/70 bg-white/95 px-6 pb-6 pt-4 backdrop-blur">
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
              {saving ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
