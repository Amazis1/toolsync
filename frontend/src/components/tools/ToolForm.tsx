import { useEffect, useState, type FormEvent } from 'react'
import { checkToolId, getPlants, getToolTypes } from '../../api/tools'
import { getCabinets, getDrawers, getPositions, getPositionContext } from '../../api/locations'
import { getCustomers, getMachines } from '../../api/masterData'
import { TOOL_CATEGORY_LABELS, TOOL_STATUS_LABELS } from '../../api/types'
import type {
  Customer,
  Machine,
  Plant,
  Tool,
  ToolCategory,
  ToolInput,
  ToolStatus,
  ToolType,
} from '../../api/types'
import type { Cabinet, Drawer, Position } from '../../api/locations'

interface ToolFormProps {
  initial: Tool | null
  onSave: (input: ToolInput) => Promise<void>
  onClose: () => void
}

function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

/**
 * Normalisiert ein Maß auf das Format "123,45" (Komma, immer 2 Stellen).
 *
 * "7"    -> "7,00"
 * "7.3"  -> "7,30"
 * "7,3"  -> "7,30"
 * "7 mm" -> "7,00"   (Einheit wird entfernt)
 * Ungültiges (leer, > 4 Vorkomma-/2 Nachkommastellen) -> null
 */
function normalizeMeasure(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, ',')
  if (cleaned === '') return null

  const [intPart, decPart = ''] = cleaned.split(',')
  if (intPart === '' || intPart.length > 4 || decPart.length > 2) return null

  return `${intPart},${decPart.padEnd(2, '0')}`
}

/** Maß mit Einheit für die Anzeige ("7,30 mm"). */
export function formatMeasureMm(value: string | null | undefined): string {
  return value ? `${value} mm` : '—'
}

type SubTab = 'tool' | 'series' | 'help' | 'storage'

// Beschriftete Felder nutzen `.ui-field` (Innenlabel, Guide §1.9) und bringen
// ihre Schriftgröße selbst mit – daher hier keine inputClass/selectClass mehr.

type IdState = 'idle' | 'checking' | 'ok' | 'error'

export default function ToolForm({ initial, onSave, onClose }: ToolFormProps) {
  const [toolTypes, setToolTypes] = useState<ToolType[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subTab, setSubTab] = useState<SubTab>('tool')

  const [toolId, setToolId] = useState(initial?.tool_id ?? '')
  const [category, setCategory] = useState<ToolCategory>(initial?.category ?? 'Stempel')
  const [status, setStatus] = useState<ToolStatus | ''>(initial?.status ?? '')
  const [isStorage, setIsStorage] = useState(initial?.is_storage ?? false)
  const [measureA, setMeasureA] = useState(initial?.measure_a ?? '')
  const [measureB, setMeasureB] = useState(initial?.measure_b ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [plantId, setPlantId] = useState<string>(initial ? String(initial.plant_id) : '')
  const [toolTypeId, setToolTypeId] = useState<string>(initial ? String(initial.tool_type_id) : '')

  // Stammdaten-Zuordnung (optional)
  const [customerId, setCustomerId] = useState<string>(initial?.customer_id ? String(initial.customer_id) : '')
  const [machineId, setMachineId] = useState<string>(initial?.machine_id ? String(initial.machine_id) : '')

  // Live-Prüfung der Werkzeug-ID
  const [idState, setIdState] = useState<IdState>('idle')
  const [idMessage, setIdMessage] = useState('')
  const [existingCount, setExistingCount] = useState(0)

  // Standort (echte API-Daten: Schrank → Schublade → Platz)
  const [cabinets, setCabinets] = useState<Cabinet[]>([])
  const [drawers, setDrawers] = useState<Drawer[]>([])
  const [freePositions, setFreePositions] = useState<Position[]>([])
  const [cabinetId, setCabinetId] = useState<string>('')
  const [drawerId, setDrawerId] = useState<string>('')
  const [positionId, setPositionId] = useState<string>('')
  // true = Werkzeug liegt in der Ablage (kein fester Lagerplatz)
  const [inTray, setInTray] = useState(initial ? initial.position_id === null : false)
  const [storageCount, setStorageCount] = useState(1)

  // Stammdaten laden. Beim Anlegen wird das erste Werk vorausgewählt,
  // damit Schrank/Schublade/Platz sofort geladen werden können.
  useEffect(() => {
    Promise.all([getToolTypes(), getPlants(), getCustomers()])
      .then(([types, pl, cus]) => {
        setToolTypes(types)
        setPlants(pl)
        setCustomers(cus)
        if (!initial && pl.length > 0) {
          setPlantId(String(pl[0].id))
        }
      })
      .catch((e) => setMetaError(e instanceof Error ? e.message : 'Stammdaten konnten nicht geladen werden. Lade die Seite neu.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Maschinen abhängig vom Werk laden
  useEffect(() => {
    if (!plantId) {
      setMachines([])
      return
    }
    getMachines(Number(plantId))
      .then(setMachines)
      .catch((e) => setMetaError(e instanceof Error ? e.message : 'Maschinen konnten nicht geladen werden. Lade die Seite neu.'))
  }, [plantId])

  // Live-Prüfung der Werkzeug-ID (Debounce 400 ms).
  // Erst prüfen, wenn ID und Werk gesetzt sind.
  useEffect(() => {
    const value = toolId.trim()
    if (!value || !plantId) {
      setIdState('idle')
      setIdMessage('')
      setExistingCount(0)
      return
    }
    setIdState('checking')
    const timer = setTimeout(() => {
      checkToolId(value, category, Number(plantId), isStorage, initial?.id)
        .then((res) => {
          setIdState(res.available ? 'ok' : 'error')
          setIdMessage(res.message)
          setExistingCount(res.existing_count)
        })
        .catch(() => {
          setIdState('idle')
          setIdMessage('')
          setExistingCount(0)
        })
    }, 400)
    return () => clearTimeout(timer)
  }, [toolId, category, plantId, isStorage])

  // Beim Bearbeiten: Schrank/Schublade/Platz aus den Stammdaten vorbelegen
  useEffect(() => {
    if (!initial?.position_id) return
    let cancelled = false
    getPositionContext(initial.position_id)
      .then((ctx) => {
        if (cancelled) return
        setPlantId(String(ctx.plant_id))
        setCabinetId(String(ctx.cabinet_id))
        setDrawerId(String(ctx.drawer_id))
        setPositionId(String(ctx.position_id))
      })
      .catch(() => {
        /* Vorbelegung ist optional – Fehler nicht anzeigen */
      })
    return () => {
      cancelled = true
    }
  }, [initial])

  // Schränke laden, sobald ein Werk gewählt ist
  useEffect(() => {
    if (!plantId) {
      setCabinets([])
      setDrawers([])
      setFreePositions([])
      return
    }
    getCabinets(Number(plantId))
      .then(setCabinets)
      .catch((e) => setMetaError(e instanceof Error ? e.message : 'Schränke konnten nicht geladen werden. Lade die Seite neu.'))
  }, [plantId])

  // Schubladen laden, sobald ein Schrank gewählt ist
  useEffect(() => {
    if (!cabinetId) {
      setDrawers([])
      setFreePositions([])
      return
    }
    getDrawers(Number(cabinetId))
      .then((drs) => {
        setDrawers(drs)
        setFreePositions([])
      })
      .catch((e) => setMetaError(e instanceof Error ? e.message : 'Schubladen konnten nicht geladen werden. Lade die Seite neu.'))
  }, [cabinetId])

  // Nur FREIE Plätze anzeigen. Beim Bearbeiten bleibt der eigene Platz
  // in der Liste, obwohl er belegt ist – sonst verschwindet die Auswahl.
  useEffect(() => {
    if (!drawerId) {
      setFreePositions([])
      return
    }
    getPositions(Number(drawerId))
      .then((allPos) => {
        setFreePositions(
          allPos.filter((p) => p.tool_id === null || p.id === initial?.position_id),
        )
      })
      .catch((e) => setMetaError(e instanceof Error ? e.message : 'Plätze konnten nicht geladen werden. Lade die Seite neu.'))
  }, [drawerId, initial])

  // Platz-Code für die Auswahl anzeigen (z. B. 01-A-01)
  function getPositionLabel(pos: Position): string {
    const cab = cabinets.find((c) => c.id === Number(cabinetId))
    const drw = drawers.find((d) => d.id === Number(drawerId))
    const cabName = cab?.name ?? '??'
    const drwName = drw?.name ?? '??'
    return `${cabName}-${drwName}-${pos.name}`
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!toolId.trim()) {
      setError('Die Werkzeug-ID ist erforderlich.')
      return
    }
    if (!plantId) {
      setError('Bitte ein Werk auswählen.')
      return
    }
    if (!toolTypeId) {
      setError('Bitte einen Werkzeugtyp auswählen.')
      return
    }
    // Lager/Ersatz darf nie blockieren (Mehrfach-IDs sind erlaubt)
    if (!isStorage && idState === 'error') {
      setError(idMessage || 'Diese Werkzeug-ID ist bereits vergeben.')
      return
    }
    if (!inTray && (!cabinetId || !drawerId || !positionId)) {
      setError('Bitte einen Lagerplatz wählen (Schrank → Schublade → Platz) oder „In Ablage legen“ aktivieren.')
      return
    }

    // Maße normalisieren: Komma, immer zwei Nachkommastellen
    const normA = normalizeMeasure(measureA)
    const normB = normalizeMeasure(measureB)
    if (normA === null) {
      setError('Maß A ist erforderlich (z. B. 7,00).')
      return
    }
    if (measureB.trim() !== '' && normB === null) {
      setError('Maß B ist ungültig (z. B. 7,00).')
      return
    }

    const baseInput: ToolInput = {
      tool_id: toolId.trim(),
      category,
      status: status === '' ? null : (status as ToolStatus),
      is_storage: isStorage,
      // Checkbox „Lager/Ersatz“ => Mehrfach-ID ausdrücklich erlaubt
      allow_duplicate_id: isStorage,
      measure_a: normA,
      measure_b: normB,
      description: emptyToNull(description),
      plant_id: Number(plantId),
      tool_type_id: Number(toolTypeId),
      position_id: inTray ? null : Number(positionId),
      machine_id: machineId ? Number(machineId) : null,
      customer_id: customerId ? Number(customerId) : null,
    }

    setSaving(true)
    try {
      // Lager/Ersatz: Anzahl = wieviele Exemplare in einem Zug entstehen.
      // Nur das erste Exemplar bekommt den gewählten Lagerplatz, die
      // übrigen gehen in die Ablage (ein Platz kann nur 1 Werkzeug halten).
      const copies = isStorage ? Math.max(1, storageCount) : 1
      for (let i = 0; i < copies; i++) {
        const input: ToolInput = {
          ...baseInput,
          position_id: i === 0 ? baseInput.position_id : null,
        }
        await onSave(input)
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Das Werkzeug konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      )
    } finally {
      setSaving(false)
    }
  }

  const subTabClass = (active: boolean) =>
    `w-full justify-start lg:justify-start ${active ? 'is-active' : ''}`

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Sub-Tabs Navigation – dasselbe Muster wie die Tabbar (.ui-tabs) */}
      <div className="ui-tabs w-full lg:w-1/5 flex-row lg:flex-col overflow-x-auto">
        {([
          ['tool', 'Werkzeug'],
          ['series', 'Serienartikel'],
          ['help', 'Info / Hilfe'],
          ['storage', 'Lager / Ersatz'],
        ] as [SubTab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={subTabClass(subTab === key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-full lg:w-4/5 p-4 rounded-xl border border-white/60 bg-white/30">
        {metaError && (
          <div className="ui-alert ui-alert-error mb-4">
            <span aria-hidden="true">×</span>
            <div>{metaError}</div>
          </div>
        )}

        {subTab === 'tool' && (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Kategorie + Lager */}
            <div className="flex gap-8 flex-wrap items-center bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="flex gap-6 flex-wrap">
                {(Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]).map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-900">
                    <input
                      type="radio"
                      name="category"
                      value={c}
                      checked={category === c}
                      onChange={() => setCategory(c)}
                      className="accent-teal-700 h-4 w-4"
                    />
                    {TOOL_CATEGORY_LABELS[c]}
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3 border-l border-slate-300 pl-6">
                <div className="flex items-center gap-2">
                  <input
                    id="tool-is-storage"
                    type="checkbox"
                    checked={isStorage}
                    onChange={(e) => setIsStorage(e.target.checked)}
                    className="rounded accent-teal-700 h-4 w-4"
                  />
                  <label htmlFor="tool-is-storage" className="text-xs font-medium text-slate-900 cursor-pointer">Lager/Ersatz</label>
                </div>
                <label htmlFor="tool-storage-count" className="text-xs font-medium text-slate-700">
                  Anzahl
                </label>
                <input
                  id="tool-storage-count"
                  type="number"
                  min={1}
                  value={storageCount}
                  onChange={(e) => setStorageCount(Number(e.target.value))}
                  disabled={!isStorage}
                  className="input-bordered w-20 text-base sm:text-sm py-1"
                />
              </div>
            </div>

            {isStorage && (
              <p className="-mt-2 text-xs font-medium text-sky-800">
                Lager/Ersatz: Mehrfach-IDs sind erlaubt – jedes Exemplar wird einzeln geführt.
                {existingCount > 0 && ` Diese ID existiert bereits ${existingCount}×.`}
              </p>
            )}

            {/* Werkzeug-ID & Typ – Innenlabel (.ui-field, Guide §1.9) spart je Zeile ~20px */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className={`ui-field ${idState === 'error' ? 'is-error' : idState === 'ok' ? 'is-ok' : ''}`}>
                  <label htmlFor="tool-id">
                    Werkzeug-ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="tool-id"
                    type="text"
                    value={toolId}
                    onChange={(e) => setToolId(e.target.value)}
                    placeholder="z. B. TS-1004"
                    required
                  />
                  {idState === 'checking' && (
                    <span className="ui-spinner mr-3 h-3.5 w-3.5 self-center" />
                  )}
                </div>
                {idState === 'ok' && (
                  <p className="mt-1 text-xs font-medium text-emerald-800">{idMessage}</p>
                )}
                {idState === 'error' && (
                  <p className="mt-1 text-xs font-medium text-rose-700">{idMessage}</p>
                )}
                {idState === 'idle' && !plantId && (
                  <p className="mt-1 text-xs text-slate-600">Bitte zuerst ein Werk wählen.</p>
                )}
              </div>
              <div className="min-w-0">
                <div className="ui-field">
                  <label htmlFor="tool-type">Werkzeug-Typ</label>
                  <select
                    id="tool-type"
                    value={toolTypeId}
                    onChange={(e) => setToolTypeId(e.target.value)}
                    required
                  >
                    <option value="">Bitte wählen …</option>
                    {toolTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Maße A & B – Werte werden auf "123,45" normalisiert (Komma, 2 Stellen) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="ui-field">
                  <label htmlFor="tool-measure-a">
                    Maß A <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="tool-measure-a"
                    type="text"
                    inputMode="decimal"
                    value={measureA}
                    onChange={(e) => setMeasureA(e.target.value)}
                    onBlur={() => {
                      const normalized = normalizeMeasure(measureA)
                      if (normalized) setMeasureA(normalized)
                    }}
                    placeholder="z. B. 7"
                    required
                  />
                  <span className="flex items-center pr-3 text-xs text-slate-600" aria-hidden="true">mm</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="ui-field">
                  <label htmlFor="tool-measure-b">Maß B</label>
                  <input
                    id="tool-measure-b"
                    type="text"
                    inputMode="decimal"
                    value={measureB}
                    onChange={(e) => setMeasureB(e.target.value)}
                    onBlur={() => {
                      const normalized = normalizeMeasure(measureB)
                      if (normalized) setMeasureB(normalized)
                    }}
                    placeholder="z. B. 8"
                  />
                  <span className="flex items-center pr-3 text-xs text-slate-600" aria-hidden="true">mm</span>
                </div>
              </div>
            </div>

            {/* Werk & Status – steht VOR dem Lagerplatz, damit Schrank und
                Schublade geladen werden können, sobald das Werk feststeht. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="ui-field">
                  <label htmlFor="tool-plant">Werk</label>
                  <select
                    id="tool-plant"
                    value={plantId}
                    onChange={(e) => {
                      setPlantId(e.target.value)
                      setCabinetId('')
                      setDrawerId('')
                      setPositionId('')
                      setMachineId('')
                    }}
                    required
                  >
                    <option value="">Werk wählen</option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="min-w-0">
                <div className="ui-field">
                  <label htmlFor="tool-status">Status</label>
                  <select
                    id="tool-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ToolStatus | '')}
                  >
                    <option value="">— ohne Status —</option>
                    {(Object.keys(TOOL_STATUS_LABELS) as ToolStatus[]).map((s) => (
                      <option key={s} value={s}>{TOOL_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lagerplatz: fester Platz ODER Ablage */}
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-700 mb-1">Lagerplatz</span>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={inTray}
                    onChange={(e) => setInTray(e.target.checked)}
                    className="rounded accent-teal-700 h-4 w-4"
                  />
                  In Ablage legen (kein fester Platz)
                </label>
              </div>

              {!inTray && (
                <>
                  {/* Ausnahme von §1.9: In einer 3-spaltigen Reihe bliebe dem Select
                      neben dem Tag zu wenig Platz für „Bitte zuerst Schrank wählen". */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <label htmlFor="tool-cabinet" className="mb-1 block text-xs font-semibold text-slate-700">Schrank</label>
                      <select
                        id="tool-cabinet"
                        value={cabinetId}
                        onChange={(e) => { setCabinetId(e.target.value); setDrawerId(''); setPositionId('') }}
                        disabled={!plantId}
                        required
                        className="select-bordered text-base sm:text-sm"
                      >
                        <option value="">{plantId ? 'Schrank wählen' : 'Bitte zuerst Werk wählen'}</option>
                        {cabinets.map((c) => (
                          <option key={c.id} value={c.id}>Schrank {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="tool-drawer" className="mb-1 block text-xs font-semibold text-slate-700">Schublade</label>
                      <select
                        id="tool-drawer"
                        value={drawerId}
                        onChange={(e) => { setDrawerId(e.target.value); setPositionId('') }}
                        disabled={!cabinetId}
                        required
                        className="select-bordered text-base sm:text-sm"
                      >
                        <option value="">{cabinetId ? 'Schublade wählen' : 'Bitte zuerst Schrank wählen'}</option>
                        {drawers.map((d) => (
                          <option key={d.id} value={d.id}>Schublade {d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="tool-position" className="mb-1 block text-xs font-semibold text-slate-700">Platz</label>
                      <select
                        id="tool-position"
                        value={positionId}
                        onChange={(e) => setPositionId(e.target.value)}
                        disabled={!drawerId || freePositions.length === 0}
                        required
                        className="select-bordered text-base sm:text-sm"
                      >
                        <option value="">{freePositions.length === 0 && drawerId ? 'Keine freien Plätze' : 'Platz wählen'}</option>
                        {freePositions.map((p) => (
                          <option key={p.id} value={p.id}>{getPositionLabel(p)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {plantId && cabinets.length === 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-800">
                      In diesem Werk sind keine Schränke angelegt (Admin → Lagerplätze).
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Zuordnung: Kunde / Maschine (beide optional) */}
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <span className="mb-2 block text-xs font-bold text-slate-700">
                Zuordnung <span className="text-xs font-normal text-slate-600">(optional)</span>
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="ui-field">
                    <label htmlFor="tool-customer">Kunde</label>
                    <select
                      id="tool-customer"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">— kein Kunde —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="ui-field">
                    <label htmlFor="tool-machine">Maschine</label>
                    <select
                      id="tool-machine"
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      disabled={!plantId}
                    >
                      <option value="">{plantId ? '— keine Maschine —' : 'zuerst Werk wählen'}</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Beschreibung */}
            <div>
              <label htmlFor="tool-description" className="font-semibold text-xs mb-1 block text-slate-700">Beschreibung</label>
              <textarea
                id="tool-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="textarea-bordered text-base sm:text-sm resize-none"
                placeholder="Zusätzliche Informationen..."
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-500/20">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-white/40">
              <button
                type="button"
                onClick={onClose}
                className="ui-btn ui-btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="ui-btn ui-btn-primary flex-1"
              >
                {saving ? 'Wird gespeichert …' : initial ? 'Änderungen speichern' : 'Werkzeug anlegen'}
              </button>
            </div>
          </form>
        )}

        {subTab === 'series' && (
          <div>
            <h3 className="text-xs font-bold mb-2">Serienartikel anlegen</h3>
            <p className="text-xs text-slate-600">Hier können PDF-Einrichtepläne zugeordnet werden.</p>
          </div>
        )}

        {subTab === 'help' && (
          <div>
            <h3 className="text-xs font-bold mb-2">Hilfe & Anleitung</h3>
            <p className="text-xs text-slate-600">Erklärungen zu den Werkzeug-IDs und Pflichtfeldern.</p>
          </div>
        )}

        {subTab === 'storage' && (
          <div>
            <h3 className="text-xs font-bold mb-2">Lagerplatz verwalten</h3>
            <p className="text-xs text-slate-600">Standortverwaltung für Schrank, Schublade und Position.</p>
          </div>
        )}
      </div>
    </div>
  )
}
