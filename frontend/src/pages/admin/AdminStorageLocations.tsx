import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { getPlants } from '../../api/admin'
import {
  getCabinets,
  deleteCabinetWithResult,
  createCabinetMatrix,
  createDrawer,
  getDrawers,
  deleteDrawerWithResult,
  getPositions,
  movePosition,
  getTrayTools,
  placeToolAtPosition,
  releaseToolFromPosition,
  type MoveAction,
  type TrayTool,
} from '../../api/locations'
import { getToolById, updateTool, deleteTool } from '../../api/tools'
import MovementLog from '../../components/movements/MovementLog'

import type { Position } from '../../api/locations'
import type { Tool, ToolInput, ToolStatus } from '../../api/types'

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
function pad2(num: number): string {
  return String(num).padStart(2, '0')
}

function getCodeKurz(cabinetName: string, drawerName: string, positionName: string): string {
  return `${cabinetName}-${drawerName}-${positionName}`
}

function getCodeVoll(cabinetName: string, drawerName: string, positionName: string): string {
  return `Schrank ${cabinetName} - Schublade ${drawerName} - Platz ${positionName}`
}

// ------------------------------------------------------------
// Icons (Lucide, inline SVG – offline-fähig)
// ------------------------------------------------------------
function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

// Plätze visuell anordnen: unterste Reihe (y=max) zuerst, in der Reihe von links nach rechts
function sortPositionsForDisplay(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => {
    const yDiff = b.y - a.y
    if (yDiff !== 0) return yDiff
    return a.x - b.x
  })
}

// ------------------------------------------------------------
// Typen
// ------------------------------------------------------------
interface DrawerConfig {
  id: number
  name: string
  cols: number
  rows: number
  positions: Position[]
}

interface CabinetView {
  id: number
  name: string
  drawers: DrawerConfig[]
}

interface Slot {
  cabinetName: string
  drawerName: string
  pos: Position
  codeKurz: string
}

type Selection =
  | { kind: 'slot'; slotId: number; label: string }
  | { kind: 'tray'; toolId: number; label: string }

// ------------------------------------------------------------
// Ablage-Tool (draggable Chip)
// ------------------------------------------------------------
interface TrayToolCardProps {
  tool: TrayTool
  isSelected: boolean
  onClick: (tool: TrayTool) => void
}

function TrayToolCard({ tool, isSelected, onClick }: TrayToolCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tray-${tool.id}`,
  })

  const style: CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(tool)}
      title={tool.description ?? tool.tool_id}
      className={`
        inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold shadow-sm transition-all
        ${isSelected
          ? 'ring-3 ring-amber-500 bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-teal-700 border-teal-800 text-white hover:bg-teal-800'}
      `}
    >
      <span className="font-mono">{tool.tool_id}</span>
      {tool.status === 'lent' && (
        <span className="text-[9px] px-1 rounded-full bg-white/20 text-white whitespace-nowrap">
          Ausgeliehen
        </span>
      )}
    </button>
  )
}

// ------------------------------------------------------------
// Ablage als Drop-Zone (Werkzeug vom Platz entfernen)
// ------------------------------------------------------------
function TrayDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray-drop' })

  return (
    <div
      ref={setNodeRef}
      className={`
        mt-2 flex min-h-[52px] items-center justify-center rounded-xl border-2 border-dashed px-4 py-2 text-xs font-bold transition-all
        ${isOver
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'admin-line-strong admin-surface-sub admin-text-subtle'}
      `}
    >
      Werkzeug hierher ziehen, um es in die Ablage zu legen (Platz wird frei)
    </div>
  )
}

// ------------------------------------------------------------
// Einzelne Platz-Karte (draggable + droppable via dnd-kit)
// ------------------------------------------------------------
interface SlotCardProps {
  position: Position
  codeKurz: string
  codeVoll: string
  isSelected: boolean
  onPlatzClick: (codeKurz: string) => void
  onEditTool: (toolId: number) => void
  onDeleteTool: (toolId: number) => void
}

function SlotCard({
  position,
  codeKurz,
  codeVoll,
  isSelected,
  onPlatzClick,
  onEditTool,
  onDeleteTool,
}: SlotCardProps) {
  const isBelegt = position.tool_id !== null
  const istAusgeliehen = position.tool?.status === 'lent'

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `slot-${position.id}`,
    disabled: !isBelegt,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `slot-${position.id}` })

  const style: CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <div
      ref={setDropRef}
      onClick={() => onPlatzClick(codeKurz)}
      title={
        isBelegt && position.tool
          ? `${codeVoll}\n${position.tool.tool_id} - ${position.tool.description ?? ''}`
          : `${codeVoll}\n${isBelegt ? 'Ziehen: belegtes Ziel = Tausch, freies = Verschieben, Ablage = Entfernen' : 'Freier Platz'}`
      }
      className={`border rounded-lg p-3 min-h-[80px] flex flex-col justify-between text-xs font-mono transition-all cursor-pointer ${
        isSelected
          ? 'ring-3 ring-amber-500 bg-amber-50 admin-text'
          : isOver
            ? 'ring-3 ring-emerald-500 bg-emerald-50 admin-text'
            : isBelegt
              ? 'bg-blue-600 border-blue-700 text-white shadow-sm hover:bg-blue-700'
              : 'admin-surface-sub admin-line admin-text-subtle hover:border-blue-400'
      }`}
    >
      <div
        ref={setDragRef}
        style={style}
        {...attributes}
        {...(isBelegt ? listeners : {})}
        className="flex flex-col flex-1"
      >
        <div className="flex justify-between items-center text-[10px] font-bold border-b pb-1 admin-line-soft">
          <span>Platz {position.name}</span>
          <span className="text-[9px] opacity-75">X:{position.x} Y:{position.y}</span>
        </div>
        <div
          className={`font-sans font-semibold text-xs my-1 ${
            isBelegt && !isSelected ? 'text-white' : isSelected ? 'text-amber-900' : 'admin-text-subtle italic'
          }`}
        >
          {position.tool_id === null ? (
            '[Frei]'
          ) : position.tool ? (
            <span title={position.tool.description ?? position.tool.tool_id} className="cursor-help">
              {position.tool.tool_id}
            </span>
          ) : (
            `Werkzeug ${position.tool_id}`
          )}
        </div>
        <div className="flex items-center justify-between mt-auto">
          {istAusgeliehen && (
            <span className="admin-badge admin-badge-warning !text-[9px] !px-1.5 !py-0.5">
              Ausgeliehen
            </span>
          )}
          {isBelegt && position.tool_id !== null && (
            <div
              className="flex items-center gap-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
                title="Werkzeug bearbeiten"
                aria-label="Werkzeug bearbeiten"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditTool(position.tool_id!)
                }}
              >
                <PencilIcon />
              </button>
              <button
                className="w-6 h-6 rounded bg-rose-500/30 hover:bg-rose-500/60 text-white flex items-center justify-center transition-colors"
                title="Werkzeug löschen"
                aria-label="Werkzeug löschen"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTool(position.tool_id!)
                }}
              >
                <TrashIcon />
              </button>
            </div>
          )}
          {isBelegt && (
            <span
              className={`w-2 h-2 rounded-full ${istAusgeliehen ? 'bg-amber-400' : 'bg-emerald-400'}`}
            ></span>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Hauptkomponente
// ------------------------------------------------------------
export default function AdminStorageLocations() {
  const [plants, setPlants] = useState<{ id: number; name: string }[]>([])

  // Formular: Werk für das ANLEGEN eines Schranks
  const [formPlantId, setFormPlantId] = useState<number | null>(null)

  // Ansicht: Werk für die LAGERSTRUKTUR-Anzeige
  const [viewPlantId, setViewPlantId] = useState<number | null>(null)

  // Schrank-Anlage-Formular
  const [schrankId, setSchrankId] = useState('')
  const [schubladenAnzahl, setSchubladenAnzahl] = useState(1)
  const [drawerConfigs, setDrawerConfigs] = useState<{ name: string; cols: number; rows: number }[]>([])

  // NEU: Panel „Schublade hinzufügen“ – je Schrank-ID geöffnet
  const [addDrawerCabinetId, setAddDrawerCabinetId] = useState<number | null>(null)
  const [newDrawerName, setNewDrawerName] = useState('')
  const [newDrawerCols, setNewDrawerCols] = useState(5)
  const [newDrawerRows, setNewDrawerRows] = useState(2)

  // Geladene Schränke
  const [cabinets, setCabinets] = useState<CabinetView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Akkordeon
  const [expandedCabinet, setExpandedCabinet] = useState<string | null>(null)
  const [expandedDrawer, setExpandedDrawer] = useState<string | null>(null)

  // Verschieben/Tauschen: Quelle per Klick merken (Ablage oder Platz)
  const [selection, setSelection] = useState<Selection | null>(null)
  // Werkzeug-Ablage: nicht eingelagerte Werkzeuge des aktiven Werks
  const [trayTools, setTrayTools] = useState<TrayTool[]>([])

  // dnd-kit: Zeiger-Sensor; erst nach minimaler Bewegung wird Drag aktiv
  // -> verhindert versehentliches Ziehen beim Klicken
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Bearbeiten/Löschen eingelagerter Werkzeuge
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<ToolInput | null>(null)

  // Wird nach jeder Verschiebung inkrementiert, um den Verlauf neu zu laden
  const [movementRefreshKey, setMovementRefreshKey] = useState(0)

  // Werke laden
  useEffect(() => {
    getPlants()
      .then((data) => {
        setPlants(data)
        if (data.length > 0) {
          setViewPlantId((prev) => (prev === null ? data[0].id : prev))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.'))
  }, [])

  // Schränke + Schubladen + Plätze laden, wenn ANSICHT-Werk gewählt
  const loadStructure = useCallback(async () => {
    if (!viewPlantId) {
      setCabinets([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const cabs = await getCabinets(viewPlantId)
      const views: CabinetView[] = []
      for (const c of cabs) {
        const drawersData = await getDrawers(c.id)
        const drawers: DrawerConfig[] = []
        for (const d of drawersData) {
          const pos = await getPositions(d.id)
          drawers.push({ id: d.id, name: d.name, cols: d.cols, rows: d.rows, positions: sortPositionsForDisplay(pos) })
        }
        views.push({ id: c.id, name: c.name, drawers })
      }
      setCabinets(views)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }, [viewPlantId])

  useEffect(() => {
    loadStructure()
  }, [loadStructure])

  // Werkzeug-Ablage laden, wenn das Ansichts-Werk wechselt
  useEffect(() => {
    if (!viewPlantId) {
      setTrayTools([])
      return
    }
    getTrayTools(viewPlantId)
      .then(setTrayTools)
      .catch(() => setTrayTools([]))
  }, [viewPlantId])

  // Schubladen-Konfiguration generieren (A, B, C …)
  const updateDrawerConfigs = useCallback((count: number) => {
    setDrawerConfigs((prev) => {
      const next: { name: string; cols: number; rows: number }[] = []
      for (let i = 0; i < Math.min(count, 26); i++) {
        const name = String.fromCharCode(65 + i)
        const existing = prev.find((p) => p.name === name)
        next.push({ name, cols: existing?.cols ?? 5, rows: existing?.rows ?? 2 })
      }
      return next
    })
  }, [])

  useEffect(() => {
    updateDrawerConfigs(1)
  }, [updateDrawerConfigs])

  function handleSchubladenAnzahlChange(value: number) {
    setSchubladenAnzahl(value)
    updateDrawerConfigs(value)
  }

  // Schrank anlegen (als Matrix)
  async function handleCreateCabinet() {
    if (!formPlantId) {
      setError('Bitte zuerst ein Werk auswählen.')
      return
    }
    if (!schrankId.trim()) {
      setError('Bitte Schrank-ID eingeben.')
      return
    }
    const name = pad2(Number(schrankId))
    const drawers = drawerConfigs.length > 0
      ? drawerConfigs.map((d) => ({ name: d.name, cols: d.cols, rows: d.rows }))
      : [{ name: 'A', cols: 5, rows: 2 }]
    try {
      await createCabinetMatrix(name, formPlantId, drawers)
      setError(null)
      setInfo(`Schrank ${name} erstellt!`)
      setSchrankId('')
      if (viewPlantId) {
        await loadStructure()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.')
    }
  }

  // Alle Slots (Karten) für Verschieben/Tauschen
  function getAllSlots(): Slot[] {
    const slots: Slot[] = []
    cabinets.forEach((c) =>
      c.drawers.forEach((d) =>
        d.positions.forEach((p) => {
          slots.push({
            cabinetName: c.name,
            drawerName: d.name,
            pos: p,
            codeKurz: getCodeKurz(c.name, d.name, p.name),
          })
        }),
      ),
    )
    return slots
  }

  // Antwort des Backends (nur betroffene Schubladen) in den lokalen State übernehmen.
  // Verhindert das Neuladen der kompletten Lagerstruktur nach move/swap.
  function mergeUpdatedPositions(updatedPositions: Position[]) {
    const positionsByDrawer = new Map<number, Position[]>()
    for (const p of updatedPositions) {
      const list = positionsByDrawer.get(p.drawer_id)
      if (list) {
        list.push(p)
      } else {
        positionsByDrawer.set(p.drawer_id, [p])
      }
    }
    setCabinets((prev) =>
      prev.map((cab) => ({
        ...cab,
        drawers: cab.drawers.map((drawer) => {
          const positions = positionsByDrawer.get(drawer.id)
          return positions
            ? { ...drawer, positions: sortPositionsForDisplay(positions) }
            : drawer
        }),
      })),
    )
  }

  // Ablage nach Strukturänderungen neu laden
  const loadTray = useCallback(async () => {
    if (!viewPlantId) {
      setTrayTools([])
      return
    }
    try {
      setTrayTools(await getTrayTools(viewPlantId))
    } catch {
      setTrayTools([])
    }
  }, [viewPlantId])

  // Ein Werkzeug aus der Ablage auf einen Platz legen/einreihen.
  async function placeTrayOnSlot(tool: TrayTool, targetPosition: Position) {
    try {
      const updatedPositions = await placeToolAtPosition(tool.id, targetPosition.id)
      const wasFrei = targetPosition.tool_id === null
      setInfo(
        wasFrei
          ? `Werkzeug ${tool.tool_id} auf Platz gelegt.`
          : `Einreihen: ${tool.tool_id} eingeordnet, nachfolgende Werkzeuge rücken auf.`,
      )
      mergeUpdatedPositions(updatedPositions)
      setMovementRefreshKey((k) => k + 1)
      await loadTray()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einreihen fehlgeschlagen.')
    }
  }

  // Belegten Platz auf einen anderen Platz verschieben oder tauschen.
  async function moveSlotToSlot(source: Slot, target: Slot) {
    if (source.pos.id === target.pos.id) return
    const action: MoveAction = target.pos.tool_id !== null ? 'swap' : 'move'
    try {
      const updatedPositions = await movePosition(source.pos.id, target.pos.id, action)
      setInfo(
        action === 'swap'
          ? 'Werkzeuge getauscht: nur die beiden Plätze haben sich geändert.'
          : 'Werkzeug auf den freien Platz verschoben.',
      )
      mergeUpdatedPositions(updatedPositions)
      setMovementRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verschieben fehlgeschlagen.')
    }
  }

  // Belegten Platz in die Ablage legen (Platz freigeben).
  async function releaseSlotToTray(slot: Slot) {
    if (!slot.pos.tool_id) return
    const toolLabel = slot.pos.tool?.tool_id ?? slot.pos.tool_id
    try {
      const updatedPositions = await releaseToolFromPosition(slot.pos.id)
      setInfo(`Werkzeug ${toolLabel} in die Ablage gelegt.`)
      mergeUpdatedPositions(updatedPositions)
      setMovementRefreshKey((k) => k + 1)
      await loadTray()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    }
  }

  // Auswahl aufheben (Esc)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Ablage-Werkzeug anklicken
  function handleTrayClick(tool: TrayTool) {
    setSelection((prev) =>
      prev?.kind === 'tray' && prev.toolId === tool.id
        ? null
        : { kind: 'tray', toolId: tool.id, label: tool.tool_id },
    )
  }

  // Platz anklicken: entweder Quelle wählen oder Zielaktion ausführen.
  async function handlePlatzClick(codeKurz: string) {
    const slot = getAllSlots().find((s) => s.codeKurz === codeKurz)
    if (!slot) return

    if (!selection) {
      if (slot.pos.tool_id) {
        setSelection({ kind: 'slot', slotId: slot.pos.id, label: codeKurz })
        setInfo(`Quelle gewählt: ${codeKurz}. Klicke jetzt auf das Ziel!`)
      }
      return
    }

    if (selection.kind === 'tray') {
      const tool = trayTools.find((t) => t.id === selection.toolId)
      if (tool) {
        setSelection(null)
        await placeTrayOnSlot(tool, slot.pos)
      }
      return
    }

    // selection.kind === 'slot'
    if (selection.slotId === slot.pos.id) {
      setSelection(null)
      return
    }
    const source = getAllSlots().find((s) => s.pos.id === selection.slotId)
    setSelection(null)
    if (source) {
      await moveSlotToSlot(source, slot)
    }
  }

  // Drag & Drop (dnd-kit): ziehen und ablegen.
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    // Ablage-Werkzeug auf Platz
    if (activeId.startsWith('tray-') && overId.startsWith('slot-')) {
      const tool = trayTools.find((t) => `tray-${t.id}` === activeId)
      const position = getAllSlots().find((s) => `slot-${s.pos.id}` === overId)?.pos
      if (tool && position) await placeTrayOnSlot(tool, position)
      return
    }

    // Platz auf Platz
    if (activeId.startsWith('slot-') && overId.startsWith('slot-')) {
      const source = getAllSlots().find((s) => `slot-${s.pos.id}` === activeId)
      const target = getAllSlots().find((s) => `slot-${s.pos.id}` === overId)
      if (source && target) await moveSlotToSlot(source, target)
      return
    }

    // Platz in Ablage (Entfernen)
    if (activeId.startsWith('slot-') && overId === 'tray-drop') {
      const source = getAllSlots().find((s) => `slot-${s.pos.id}` === activeId)
      if (source) await releaseSlotToTray(source)
    }
  }

  // Akkordeon-Logik
  function toggleCabinet(name: string) {
    setExpandedCabinet((prev) => (prev === name ? null : name))
    setExpandedDrawer(null)
  }

  function toggleDrawer(name: string) {
    setExpandedDrawer((prev) => (prev === name ? null : name))
  }

  async function handleDeleteCabinet(id: number) {
    if (!window.confirm('Schrank wirklich löschen? Eingelagerte Werkzeuge bleiben erhalten und liegen danach in der Ablage.')) return
    try {
      const result = await deleteCabinetWithResult(id)
      setCabinets((prev) => prev.filter((c) => c.id !== id))
      setInfo(
        result.released_tools > 0
          ? `Schrank gelöscht – ${result.released_tools} Werkzeug(e) in die Ablage gelegt.`
          : 'Schrank gelöscht.',
      )
      await loadTray()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  // Nächsten freien Schubladen-Buchstaben im Schrank vorschlagen (A, B, C …).
  function nextFreeDrawerName(cab: CabinetView): string {
    for (let i = 0; i < 26; i++) {
      const candidate = String.fromCharCode(65 + i)
      if (!cab.drawers.some((d) => d.name === candidate)) return candidate
    }
    return ''
  }

  // Panel „Schublade hinzufügen“ für einen Schrank öffnen/schließen.
  function toggleAddDrawer(cab: CabinetView) {
    if (addDrawerCabinetId === cab.id) {
      setAddDrawerCabinetId(null)
      return
    }
    // Vorbelegung: nächster freier Name, Standardgröße 5 x 2
    setNewDrawerName(nextFreeDrawerName(cab))
    setNewDrawerCols(5)
    setNewDrawerRows(2)
    setAddDrawerCabinetId(cab.id)
    setError(null)
  }

  // Neue Schublade in einen BEREITS EXISTIERENDEN Schrank einfügen.
  // Das Backend erzeugt die Plätze (cols x rows) automatisch mit.
  async function handleCreateDrawer(cab: CabinetView) {
    const name = newDrawerName.trim()
    if (!name) {
      setError('Bitte einen Namen für die neue Schublade eingeben.')
      return
    }
    if (newDrawerCols < 1 || newDrawerRows < 1) {
      setError('Anzahl X und Y müssen mindestens 1 betragen.')
      return
    }
    if (cab.drawers.some((d) => d.name === name)) {
      setError(`Schublade ${name} existiert im Schrank ${cab.name} bereits.`)
      return
    }
    try {
      const newDrawer = await createDrawer(name, newDrawerCols, newDrawerRows, cab.id)
      setError(null)
      setInfo(
        `Schublade ${name} in Schrank ${cab.name} angelegt (${newDrawerCols * newDrawerRows} Plätze).`,
      )
      setAddDrawerCabinetId(null)

      // Neue Schublade direkt in den lokalen State übernehmen -> sofort sichtbar,
      // ohne die gesamte Lagerstruktur neu zu laden.
      const positions = sortPositionsForDisplay(
        (newDrawer.positions ?? []).map((p) => ({ ...p, tool: p.tool ?? null })),
      )
      setCabinets((prev) =>
        prev.map((c) =>
          c.id === cab.id
            ? {
                ...c,
                drawers: [
                  ...c.drawers,
                  { id: newDrawer.id, name: newDrawer.name, cols: newDrawer.cols, rows: newDrawer.rows, positions },
                ],
              }
            : c,
        ),
      )
      setExpandedCabinet(cab.name)
      setExpandedDrawer(newDrawer.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen der Schublade fehlgeschlagen.')
    }
  }

  async function handleDeleteDrawer(cabinetId: number, drawer: DrawerConfig) {
    if (!window.confirm(`Schublade ${drawer.name} wirklich löschen? Eingelagerte Werkzeuge bleiben erhalten und liegen danach in der Ablage.`)) return
    try {
      const result = await deleteDrawerWithResult(drawer.id)
      setCabinets((prev) =>
        prev.map((c) =>
          c.id === cabinetId
            ? { ...c, drawers: c.drawers.filter((d) => d.id !== drawer.id) }
            : c,
        ),
      )
      setInfo(
        result.released_tools > 0
          ? `Schublade ${drawer.name} gelöscht – ${result.released_tools} Werkzeug(e) in die Ablage gelegt.`
          : `Schublade ${drawer.name} gelöscht.`,
      )
      await loadTray()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  // (Werkzeug-Anzeige ist jetzt direkt in SlotCard integriert)

  // Eingelagertes Werkzeug bearbeiten
  async function handleEditTool(toolId: number) {
    try {
      const tool = await getToolById(toolId)
      setEditingTool(tool)
      setEditFormData({
        tool_id: tool.tool_id,
        category: tool.category,
        status: tool.status,
        is_storage: tool.is_storage,
        allow_duplicate_id: tool.allow_duplicate_id,
        measure_a: tool.measure_a,
        measure_b: tool.measure_b,
        description: tool.description,
        plant_id: tool.plant_id,
        tool_type_id: tool.tool_type_id,
        position_id: tool.position_id,
        machine_id: tool.machine_id,
        customer_id: tool.customer_id,
      })
      setEditFormOpen(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden des Werkzeugs fehlgeschlagen.')
    }
  }

  async function handleSaveEditedTool() {
    if (!editingTool || !editFormData) return
    try {
      const updatedTool = await updateTool(editingTool.id, editFormData)

      // Nur die Karte des bearbeiteten Werkzeugs im State anpassen.
      setCabinets((prev) =>
        prev.map((cab) => ({
          ...cab,
          drawers: cab.drawers.map((drawer) => ({
            ...drawer,
            positions: drawer.positions.map((p) =>
              p.tool_id === updatedTool.id
                ? {
                    ...p,
                    tool: {
                      id: updatedTool.id,
                      tool_id: updatedTool.tool_id,
                      description: updatedTool.description,
                      status: updatedTool.status,
                    },
                  }
                : p,
            ),
          })),
        })),
      )

      setEditFormOpen(false)
      setEditingTool(null)
      setEditFormData(null)
      setInfo('Werkzeug erfolgreich aktualisiert.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen.')
    }
  }

  // Eingelagertes Werkzeug löschen (Platz wird automatisch freigegeben)
  async function handleDeleteTool(toolId: number) {
    if (!window.confirm('Eingelagertes Werkzeug wirklich löschen?')) return
    try {
      await deleteTool(toolId)

      // Den ehemals belegten Platz direkt als frei markieren.
      setCabinets((prev) =>
        prev.map((cab) => ({
          ...cab,
          drawers: cab.drawers.map((drawer) => ({
            ...drawer,
            positions: drawer.positions.map((p) =>
              p.tool_id === toolId ? { ...p, tool_id: null, tool: null } : p,
            ),
          })),
        })),
      )

      setInfo('Werkzeug gelöscht und Platz freigegeben.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  // Inline-Bearbeiten-Formular (Beschreibung + Status)
  function renderEditForm() {
    if (!editFormOpen || !editingTool || !editFormData) return null
    return (
      <div className="admin-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">

          <h3 className="text-sm font-bold admin-text">
            Werkzeug bearbeiten: {editingTool.tool_id}
          </h3>
          <button
            className="admin-btn admin-btn-secondary !py-1 !px-2 !text-xs"
            onClick={() => {
              setEditFormOpen(false)
              setEditingTool(null)
              setEditFormData(null)
            }}
          >
            Schließen
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold admin-text-muted mb-1">Beschreibung</label>
            <input
              className="admin-input"
              value={editFormData.description ?? ''}
              onChange={(e) =>
                setEditFormData({ ...editFormData, description: e.target.value === '' ? null : e.target.value })
              }
              placeholder="Kurzbeschreibung…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold admin-text-muted mb-1">Status</label>
            <select
              className="admin-select"
              value={editFormData.status ?? ''}
              onChange={(e) =>
                setEditFormData({ ...editFormData, status: (e.target.value || null) as ToolStatus | null })
              }
            >
              <option value="">Kein Status</option>
              <option value="available">Verfügbar</option>
              <option value="lent">Ausgeliehen</option>
              <option value="in_transit">In Transit</option>
              <option value="defective">Defekt</option>
              <option value="maintenance">In Wartung</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--admin-divider)' }}>
          <button className="admin-btn admin-btn-primary" onClick={handleSaveEditedTool}>
            Speichern
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="admin-alert admin-alert-error">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}
      {info && (
        <div className="admin-alert admin-alert-success">
          <span>✓</span>
          <div>{info}</div>
        </div>
      )}

      {/* Bearbeiten-Formular für eingelagerte Werkzeuge */}
      {renderEditForm()}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* LINKE SPALTE: SCHRANK ANLEGEN + VERLAUF */}
        <div className="lg:col-span-1 space-y-5">
        {/* FORMULAR: SCHRANK ANLEGEN */}
        <div className="admin-card p-4 space-y-4 h-fit">

          <h3 className="section-title border-b pb-2" style={{ borderColor: 'var(--admin-divider)' }}>
            Schrank anlegen
          </h3>

          <div>
            <label className="block text-xs font-semibold admin-text-muted mb-1">Werk</label>
            <select
              className="admin-select"
              value={formPlantId ?? ''}
              onChange={(e) => setFormPlantId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Werk auswählen…</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold admin-text-muted mb-1">Schrank Nummern-ID</label>
            <input
              type="number"
              className="admin-input"
              value={schrankId}
              onChange={(e) => setSchrankId(e.target.value)}
              placeholder="z. B. 3 (wird zu 03)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold admin-text-muted mb-1">Anzahl Schubladen</label>
            <input
              type="number"
              min={1}
              max={26}
              className="admin-input"
              value={schubladenAnzahl}
              onChange={(e) => handleSchubladenAnzahlChange(Number(e.target.value))}
            />
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {drawerConfigs.map((d) => (
              <div key={d.name} className="p-3 border rounded text-xs space-y-2 admin-line admin-surface-sub">
                <span className="font-bold admin-text-muted block">Schublade {d.name}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] admin-text-subtle">Anzahl X:</label>
                    <input
                      type="number"
                      className="admin-input"
                      min={1}
                      value={d.cols}
                      onChange={(e) =>
                        setDrawerConfigs((prev) =>
                          prev.map((p) => (p.name === d.name ? { ...p, cols: Number(e.target.value) } : p)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] admin-text-subtle">Anzahl Y:</label>
                    <input
                      type="number"
                      className="admin-input"
                      min={1}
                      value={d.rows}
                      onChange={(e) =>
                        setDrawerConfigs((prev) =>
                          prev.map((p) => (p.name === d.name ? { ...p, rows: Number(e.target.value) } : p)),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleCreateCabinet} className="admin-btn admin-btn-primary w-full">
            Schrank anlegen
          </button>
        </div>

        {/* VERLAUF als eigener Block */}
        <div className="admin-card p-4">
          <div className="border-b pb-2 mb-3 admin-line-soft">
            <span className="section-title">Verlauf</span>
          </div>
          <MovementLog plantId={viewPlantId} refreshKey={movementRefreshKey} />
        </div>
        </div>

        {/* RECHTE SPALTE: LAGERSTRUKTUR */}
        <div className="lg:col-span-3 space-y-4">
          {/* Werk-Auswahl als Tabs */}
          <div className="admin-tabs" role="tablist" aria-label="Werk auswählen">
            {plants.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={viewPlantId === p.id}
                onClick={() => {
                  setViewPlantId(p.id)
                  // Verlauf neu laden, falls er gerade sichtbar ist
                  setMovementRefreshKey((k) => k + 1)
                }}
                className={viewPlantId === p.id ? 'is-active' : ''}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* INFO: Verschieben, Tauschen & Einreihen */}
          <div className="admin-alert admin-alert-info">
            <span>ℹ</span>
            <div className="space-y-1">
              <strong>Wege zum Verschieben, Tauschen & Einreihen</strong>
              <div className="opacity-80 space-y-0.5">
                <p>1. <strong>Per Klick:</strong> Quelle antippen (Ablage-Chip oder belegtes Fach), danach das Ziel-Fach antippen.</p>
                <p>2. <strong>Per Drag & Drop:</strong> Ablage-Chip auf Platz ziehen, Fach auf Fach ziehen oder Fach in die Ablage-Fläche ziehen.</p>
                <p>Belegtes Ziel = <strong>Tausch</strong>. Leeres Ziel = <strong>Verschieben</strong>. Ablage → belegter Platz = <strong>Einreihen</strong> (blockiert bei voller Schublade).</p>
              </div>
            </div>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {/* WERKZEUG-ABLAGE */}
            <div className="admin-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                <div>


                  <span className="text-sm font-bold admin-text">Werkzeug-Ablage</span>
                  <p className="text-xs admin-text-subtle mt-0.5">
                    Nicht eingelagerte Werkzeuge – per Drag & Drop oder Klick auf einen Platz einreihen.
                  </p>
                </div>
                <span className="admin-badge admin-badge-neutral">{trayTools.length} Werkzeuge</span>
              </div>
              {trayTools.length === 0 ? (
                <p className="text-xs admin-text-subtle italic">
                  Keine Werkzeuge ohne Platz. Über die Werkzeug-Anlage oder durch Herausziehen aus einer Schublade gelangen Werkzeuge in die Ablage.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trayTools.map((tool) => (
                    <TrayToolCard
                      key={tool.id}
                      tool={tool}
                      isSelected={selection?.kind === 'tray' && selection.toolId === tool.id}
                      onClick={handleTrayClick}
                    />
                  ))}
                </div>
              )}
              <TrayDropZone />
            </div>

            {/* LAGERSTRUKTUR-ANSICHT */}
            <div className="admin-card p-4 mt-4">
              <div className="flex items-center justify-between border-b pb-2 mb-4" style={{ borderColor: 'var(--admin-divider)' }}>
                <span className="section-title">Lagerstruktur-Ansicht</span>
                {selection && (
                  <span className="text-xs text-amber-600 font-bold">
                    [Ausgewählt: {selection.label}]
                  </span>
                )}
              </div>


              {loading ? (

                <p className="admin-text-subtle text-sm italic">Wird geladen…</p>
              ) : cabinets.length === 0 ? (

                <p className="admin-text-subtle text-sm italic">
                  {viewPlantId
                    ? 'In diesem Werk sind noch keine Schränke angelegt. Lege links einen Schrank an.'
                    : 'Bitte wähle oben ein Werk aus.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {cabinets.map((c) => {
                  const isCabinetOpen = expandedCabinet === c.name
                  return (
                    <div key={c.id} className="admin-card overflow-hidden">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleCabinet(c.name)}

                          className="flex-1 flex items-center gap-2 p-3 admin-rowhead text-left"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block transition-transform ${isCabinetOpen ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6"/></svg>
                          <span className="font-bold text-sm" style={{ color: 'var(--admin-text)' }}>Schrank {c.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-500/25">
                            {c.drawers.length}{' '}
                            {c.drawers.length === 1 ? 'Schublade' : 'Schubladen'}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5 mr-2 shrink-0">
                          <button
                            type="button"

                            className={`admin-btn admin-btn-secondary admin-btn-sm gap-1.5 ${addDrawerCabinetId === c.id ? 'ring-2 ring-teal-500' : ''}`}
                            title="Neue Schublade in diesem Schrank anlegen"
                            aria-label="Schublade hinzufügen"
                            aria-expanded={addDrawerCabinetId === c.id}
                            onClick={() => {
                              setExpandedCabinet(c.name)
                              toggleAddDrawer(c)
                            }}
                          >
                            <PlusIcon />
                            Schublade hinzufügen
                          </button>
                          <button
                            className="admin-btn gap-1.5 py-1! px-2.5! text-[11px]! bg-rose-500/15! text-rose-700! border! border-rose-500/25! hover:bg-rose-500/25!"
                            title="Schrank inkl. Schubladen löschen"
                            aria-label="Schrank löschen"
                            onClick={() => handleDeleteCabinet(c.id)}
                          >
                            <TrashIcon />
                            Löschen
                          </button>
                        </div>
                      </div>

                      {isCabinetOpen && (
                        <div className="space-y-2 p-3 border-t admin-line-soft">
                          {addDrawerCabinetId === c.id && (
                            <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-teal-900">
                                  Neue Schublade in Schrank {c.name}
                                </span>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-tertiary"
                                  title="Abbrechen"
                                  aria-label="Schublade hinzufügen abbrechen"
                                  onClick={() => setAddDrawerCabinetId(null)}
                                >
                                  <XIcon />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div>

                                  <label className="block text-[10px] font-semibold admin-text-muted mb-1">
                                    Name
                                  </label>
                                  <input
                                    className="admin-input"
                                    value={newDrawerName}
                                    placeholder="z. B. C"
                                    onChange={(e) => setNewDrawerName(e.target.value)}
                                  />
                                </div>
                                <div>

                                  <label className="block text-[10px] font-semibold admin-text-muted mb-1">
                                    Anzahl X
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    className="admin-input"
                                    value={newDrawerCols}
                                    onChange={(e) => setNewDrawerCols(Number(e.target.value))}
                                  />
                                </div>
                                <div>

                                  <label className="block text-[10px] font-semibold admin-text-muted mb-1">
                                    Anzahl Y
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    className="admin-input"
                                    value={newDrawerRows}
                                    onChange={(e) => setNewDrawerRows(Number(e.target.value))}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2">

                                <span className="text-[10px] admin-text-subtle">
                                  {newDrawerCols > 0 && newDrawerRows > 0
                                    ? `Erzeugt ${newDrawerCols * newDrawerRows} Plätze.`
                                    : 'Bitte X und Y angeben.'}
                                </span>
                                <button
                                  type="button"

                                  className="admin-btn admin-btn-primary admin-btn-sm gap-1.5"
                                  onClick={() => handleCreateDrawer(c)}
                                >
                                  Schublade anlegen
                                </button>
                              </div>
                            </div>
                          )}
                          {c.drawers.length === 0 && (
                            <p className="text-xs admin-text-subtle italic px-2">Keine Schubladen vorhanden.</p>
                          )}
                          {c.drawers.map((d) => {
                            const isDrawerOpen = expandedDrawer === d.name
                            return (
                              <div key={d.id} className="admin-card !rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => toggleDrawer(d.name)}
                                    className="flex-1 flex items-center gap-2 p-2.5 admin-rowhead text-left"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block transition-transform ${isDrawerOpen ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6"/></svg>
                                    <span className="font-bold text-xs" style={{ color: 'var(--admin-text-muted)' }}>Schublade {d.name}</span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-500/25">
                                      {d.positions.length}{' '}
                                      {d.positions.length === 1 ? 'Platz' : 'Plätze'}
                                    </span>
                                  </button>
                                  <button
                                    className="admin-btn admin-btn-danger-ghost admin-btn-sm gap-1.5 mr-1.5 shrink-0"
                                    title="Schublade löschen"
                                    aria-label="Schublade löschen"
                                    onClick={() => handleDeleteDrawer(c.id, d)}
                                  >
                                    <TrashIcon />
                                    Löschen
                                  </button>
                                </div>

                                {isDrawerOpen && (
                                  <div className="p-3">
                                    <div
                                      className="grid gap-3"
                                      style={{ gridTemplateColumns: `repeat(${d.cols}, minmax(0, 1fr))` }}
                                    >
                                      {d.positions.map((p) => {
                                        const codeKurz = getCodeKurz(c.name, d.name, p.name)
                                        const codeVoll = getCodeVoll(c.name, d.name, p.name)
                                        const isSelected =
                                          selection?.kind === 'slot' && selection.slotId === p.id
                                        return (
                                          <SlotCard
                                            key={p.id}
                                            position={p}
                                            codeKurz={codeKurz}
                                            codeVoll={codeVoll}
                                            isSelected={isSelected}
                                            onPlatzClick={handlePlatzClick}
                                            onEditTool={handleEditTool}
                                            onDeleteTool={handleDeleteTool}
                                          />
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                  })}
                </div>
              )}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  )
}
