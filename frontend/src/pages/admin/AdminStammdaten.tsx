import { useEffect, useState } from 'react'
import {
  getPlants,
  createPlant,
  updatePlant,
  deletePlant,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getMachines,
  createMachine,
  updateMachine,
  deleteMachine,
  getToolTypes,
  createToolType,
  updateToolType,
  deleteToolType,
} from '../../api/admin'
import type { Plant, Customer, Machine, ToolType } from '../../api/types'

// ------------------------------------------------------------
// Inline-Icons (Lucide, offline-fähig – keine externen Assets)
// ------------------------------------------------------------
function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

// ------------------------------------------------------------
// Icon-Button mit Styleguide-Tooltip (.admin-tip / .admin-tip-bubble)
// Quelle: AdminPanel-Styleguide.html – Tooltip bei Hover und Fokus
// ------------------------------------------------------------
function IconTipButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="admin-tip"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <button
        type="button"
        className="admin-icon-btn"
        aria-label={label}
        title={label}
        onClick={onClick}
      >
        {children}
      </button>
      {show && (
        <span className="admin-tip-bubble" role="tooltip">
          {label}
        </span>
      )}
    </span>
  )
}

// ------------------------------------------------------------
// Farbwähler (Hex) für Kunden; "Keine Farbe" -> null
// ------------------------------------------------------------
function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value ?? '#0f766e'}
        disabled={value === null}
        onChange={(e) => onChange(e.target.value)}
        title="Farbe wählen"
        aria-label="Farbe wählen"
        style={{
          width: 36,
          height: 28,
          padding: 0,
          border: '1px solid var(--admin-border-strong)',
          borderRadius: 'var(--admin-radius-sm)',
          background: 'transparent',
          cursor: value === null ? 'not-allowed' : 'pointer',
          opacity: value === null ? 0.5 : 1,
        }}
      />
      <label className="flex items-center gap-1 text-xs admin-text-subtle">
        <input
          type="checkbox"
          className="admin-check"
          checked={value === null}
          onChange={(e) => onChange(e.target.checked ? null : '#0f766e')}
        />
        Keine Farbe
      </label>
    </div>
  )
}

// ------------------------------------------------------------
// Werk-Auswahl für Maschinen
// ------------------------------------------------------------
function PlantSelect({
  value,
  onChange,
  plants,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  plants: Plant[]
  ariaLabel: string
}) {
  return (
    <select
      className="admin-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">Kein Werk</option>
      {plants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

const inputClass = 'admin-input'
const btnClass = 'admin-btn'

// ------------------------------------------------------------
// Komponente: Tabelle mit Inline-Hinzufügen/Editieren/Löschen
// Aktionen laufen über ein Kebab-Menü (⋮), das als Slide-out nach
// links hereinfährt (kein Modal). Schließt per ⋮-Toggle, Klick außerhalb und Esc.
// ------------------------------------------------------------
function TableEditor<T extends { id: number; name: string }>({
  title,
  items,
  onCreate,
  onUpdate,
  onDelete,
  placeholder,
  renderExtra,
  renderCreateFields,
  renderEditFields,
  onEditStart,
}: {
  title: string
  items: T[]
  onCreate: (name: string) => Promise<void>
  onUpdate: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  placeholder: string
  renderExtra?: (item: T) => React.ReactNode
  renderCreateFields?: () => React.ReactNode
  renderEditFields?: (item: T) => React.ReactNode
  onEditStart?: (item: T) => void
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [menuItem, setMenuItem] = useState<T | null>(null)

  // Aktions-Menü schließen: Esc und Klick außerhalb
  useEffect(() => {
    if (!menuItem) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuItem(null)
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      // Klicks innerhalb der Aktionsfläche (Trigger/Panel) nicht auswerten
      if (target && target.closest('.admin-row-actions')) return
      setMenuItem(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [menuItem])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!newName.trim()) return
    try {
      await onCreate(newName.trim())
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.')
    }
  }

  async function handleUpdate(id: number) {
    setError(null)
    if (!editingValue.trim()) return
    try {
      await onUpdate(id, editingValue.trim())
      setEditingId(null)
      setEditingValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  async function handleDelete(id: number) {
    setMenuItem(null)
    if (!window.confirm('Eintrag wirklich löschen?')) return
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  function startEdit(item: T) {
    setMenuItem(null)
    setEditingId(item.id)
    setEditingValue(item.name)
    onEditStart?.(item)
  }

  return (
    <section className="admin-card p-3 flex flex-col h-full">
      <h3 className="mb-3 text-sm font-bold shrink-0" style={{ color: 'var(--admin-text)' }}>
        {title}
      </h3>

      <form onSubmit={handleCreate} className="mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            className={`${inputClass} flex-1 min-w-0`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={placeholder}
          />
          <button type="submit" className={`${btnClass} admin-btn-primary shrink-0`}>
            Hinzufügen
          </button>
        </div>
        {renderCreateFields && (
          <div className="mt-2">{renderCreateFields()}</div>
        )}
      </form>

      {error && (
        <div className="admin-alert admin-alert-error mb-3 shrink-0">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}

      <div className="admin-scroll-y flex-1 min-h-0">
        <table className="admin-table admin-table-compact admin-table-sticky">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              {renderExtra && <th>Details</th>}
              <th className="text-right" aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={renderExtra ? 3 : 2} className="text-center py-4 text-slate-400">
                  Noch keine Einträge.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <input
                        className={inputClass}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                      {renderEditFields && renderEditFields(item)}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--admin-text)' }}>
                      {'color' in item && (item as { color?: string | null }).color ? (
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: (item as { color?: string | null }).color ?? undefined }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {item.name}
                    </span>
                  )}
                </td>
                {renderExtra && <td>{renderExtra(item)}</td>}
                <td>
                  <div className={`admin-row-actions ${menuItem?.id === item.id ? 'is-open' : ''}`}>
                    {editingId === item.id ? (
                      <>
                        <button
                          className="admin-btn admin-btn-primary !py-1 !px-2.5"
                          onClick={() => handleUpdate(item.id)}
                        >
                          Speichern
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost !py-1 !px-2.5"
                          onClick={() => setEditingId(null)}
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="admin-icon-btn admin-row-actions-trigger"
                          onClick={() => setMenuItem(menuItem?.id === item.id ? null : item)}
                          title="Aktionen"
                          aria-label="Aktionen"
                          aria-haspopup="true"
                          aria-expanded={menuItem?.id === item.id}
                        >
                          <MoreVerticalIcon className="w-4 h-4" />
                        </button>
                        <div className="admin-row-actions-panel" role="menu" aria-label="Aktionen">
                          <IconTipButton label="Bearbeiten" onClick={() => startEdit(item)}>
                            <PencilIcon className="w-4 h-4" />
                          </IconTipButton>
                          <IconTipButton label="Löschen" onClick={() => handleDelete(item.id)}>
                            <TrashIcon className="w-4 h-4" />
                          </IconTipButton>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </section>
  )
}

export default function AdminStammdaten() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [toolTypes, setToolTypes] = useState<ToolType[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Eingaben für Anlegen/Bearbeiten (Kundenfarbe, Maschinen-Werk)
  const [newCustomerColor, setNewCustomerColor] = useState<string | null>(null)
  const [editCustomerColor, setEditCustomerColor] = useState<string | null>(null)
  const [newMachinePlantId, setNewMachinePlantId] = useState('')
  const [editMachinePlantId, setEditMachinePlantId] = useState('')

  useEffect(() => {
    Promise.all([getPlants(), getCustomers(), getMachines(), getToolTypes()])
      .then(([p, c, m, t]) => {
        setPlants(p)
        setCustomers(c)
        setMachines(m)
        setToolTypes(t)
      })
      .catch(console.error)
  }, [refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  async function handleCreateMachine(name: string, plantId: number | null) {
    await createMachine(name, plantId)
    refresh()
  }

  async function handleUpdateMachine(id: number, name: string, plantId: number | null) {
    const machine = machines.find((m) => m.id === id)
    await updateMachine(id, name, plantId ?? machine?.plant_id ?? null)
    refresh()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 auto-rows-fr gap-4">
      {/* Werkzeugtypen */}
      <TableEditor<ToolType>
        title="Werkzeugtypen"
        items={toolTypes}
        onCreate={(name) => createToolType(name).then(refresh)}
        onUpdate={(id, name) => updateToolType(id, name).then(refresh)}
        onDelete={(id) => deleteToolType(id).then(refresh)}
        placeholder="Neuer Typ, z. B. 01 Rund"
      />

      {/* Werke */}
      <TableEditor<Plant>
        title="Werke (Plants)"
        items={plants}
        onCreate={(name) => createPlant(name).then(refresh)}
        onUpdate={(id, name) => updatePlant(id, name).then(refresh)}
        onDelete={(id) => deletePlant(id).then(refresh)}
        placeholder="Neues Werk, z. B. Werk 1"
      />

      {/* Kunden inkl. Farbe */}
      <TableEditor<Customer>
        title="Kunden (Customers)"
        items={customers}
        onCreate={(name) => createCustomer(name, newCustomerColor).then(refresh)}
        onUpdate={(id, name) => updateCustomer(id, name, editCustomerColor).then(refresh)}
        onDelete={(id) => deleteCustomer(id).then(refresh)}
        placeholder="Neuer Kunde"
        onEditStart={(c) => setEditCustomerColor(c.color)}
        renderCreateFields={() => (
          <ColorPicker value={newCustomerColor} onChange={setNewCustomerColor} />
        )}
        renderEditFields={() => (
          <ColorPicker value={editCustomerColor} onChange={setEditCustomerColor} />
        )}
      />

      {/* Maschinen mit Werk-Zuordnung */}
      <TableEditor<Machine>
        title="Maschinen (Machines)"
        items={machines}
        onCreate={(name) =>
          handleCreateMachine(name, newMachinePlantId ? Number(newMachinePlantId) : null)
        }
        onUpdate={(id, name) =>
          handleUpdateMachine(id, name, editMachinePlantId ? Number(editMachinePlantId) : null)
        }
        onDelete={(id) => deleteMachine(id).then(refresh)}
        placeholder="Neue Maschine"
        onEditStart={(m) => setEditMachinePlantId(m.plant_id != null ? String(m.plant_id) : '')}
        renderCreateFields={() => (
          <PlantSelect
            value={newMachinePlantId}
            onChange={setNewMachinePlantId}
            plants={plants}
            ariaLabel="Werk für neue Maschine wählen"
          />
        )}
        renderEditFields={() => (
          <PlantSelect
            value={editMachinePlantId}
            onChange={setEditMachinePlantId}
            plants={plants}
            ariaLabel="Werk für Maschine wählen"
          />
        )}
        renderExtra={(m) => (
          <span className="text-xs text-slate-500">
            {plants.find((p) => p.id === m.plant_id)?.name ?? 'Kein Werk'}
          </span>
        )}
      />
    </div>
  )
}
