import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  checkToolId,
  getPlants,
  getToolTypes,
  type ToolIdLocation,
  type ToolIdPrefill,
} from '../../api/tools'
import { getCabinets, getDrawers, getPositions, getPositionContext } from '../../api/locations'
import { getCustomers, getMachines } from '../../api/masterData'
import SerialArticleForm from '../serial-articles/SerialArticleForm'
import SparePartForm from '../spare-parts/SparePartForm'
import DataSheetForm from '../data-sheets/DataSheetForm'
import type { SerialArticle } from '../../types/serial-article'
import type { SparePart } from '../../types/spare-part'
import type { DataSheet } from '../../types/data-sheet'
import {
  CheckIcon,
  ClipboardListIcon,
  CogIcon,
  FileTextIcon,
  CircleXIcon,
  InfoIcon,
  ToolIcon,
  XIcon,
} from '../icons'
import { FieldLabel, FieldMessage, FormSection } from '../Field'
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
  /** Startreiter – 'series'/'spare', wenn das Formular aus einem der Bereiche kommt. */
  initialSubTab?: SubTab
  /** Vorhandener Serienartikel zum Bearbeiten (Reiter „Serienartikel“). */
  initialSerialArticle?: SerialArticle | null
  /** Ein Serienartikel wurde gespeichert (Meldung + Liste aktualisieren). */
  onSerialArticleSaved?: (article: SerialArticle) => void
  /** Vorhandenes Ersatzteil zum Bearbeiten (Reiter „Ersatzteil“, DEC-064). */
  initialSparePart?: SparePart | null
  /** Ein Ersatzteil wurde gespeichert (Meldung + Liste aktualisieren). */
  onSparePartSaved?: (part: SparePart) => void
  /** Vorhandenes Datenblatt zum Bearbeiten (Reiter „Datenblatt", DEC-065). */
  initialDataSheet?: DataSheet | null
  /** Die Werkzeug-ID, die im Reiter „Datenblatt" vorbelegt wird. */
  prefillDataSheetToolId?: string | null
  /** Ein Datenblatt wurde gespeichert (Meldung + Liste aktualisieren). */
  onDataSheetSaved?: (sheet: DataSheet) => void
  /** Meldung anzeigen (Toast) – geht an die Reiter durch, die eigene Fehler haben. */
  onNotify?: (variant: 'success' | 'error', title: string) => void
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

/**
 * Reiter des Anlege-Formulars. **Vier** Reiter – je einer pro Bereich:
 * Werkzeug (Ersatz **werkzeug** inbegriffen: die Checkbox „Lager/Ersatz"),
 * Serienartikel, Datenblatt, Ersatzteil (Maschinen-Reparatur/-Wartungsteil).
 *
 * „Info / Hilfe" und „Lager / Ersatz" sind entfallen: sie waren reine
 * Textseiten und ihr Inhalt gehört in die Reiter, die die Sache anlegen.
 */
type SubTab = 'tool' | 'series' | 'sheet' | 'spare'

/** Beschriftung und Icon je Reiter – EINE Quelle für die Reiterleiste. */
const SUB_TABS: { key: SubTab; label: string; icon: typeof ToolIcon }[] = [
  { key: 'tool', label: 'Werkzeug', icon: ToolIcon },
  { key: 'series', label: 'Serienartikel', icon: ClipboardListIcon },
  { key: 'sheet', label: 'Datenblatt', icon: FileTextIcon },
  { key: 'spare', label: 'Ersatzteil', icon: CogIcon },
]

// Beschriftete Felder nutzen `.ui-field` (Innenlabel, Guide §1.9) und bringen
// ihre Schriftgröße selbst mit – daher hier keine inputClass/selectClass mehr.

type IdState = 'idle' | 'checking' | 'ok' | 'error'

/**
 * Felder, die beim Anlegen automatisch aus einem vorhandenen Datensatz
 * derselben ID übernommen werden können.
 */
type PrefillField = 'measure_a' | 'measure_b' | 'tool_type_id' | 'description' | 'place'

const PREFILL_FIELD_LABELS: Record<PrefillField, string> = {
  measure_a: 'Maß A',
  measure_b: 'Maß B',
  tool_type_id: 'Werkzeug-Typ',
  description: 'Beschreibung',
  place: 'Lagerplatz (Ablage)',
}

/** "Ersatz · ohne Status" bzw. "Werkzeug · Verfügbar" für die Fundort-Liste. */
function describeExistingTool(tool: ToolIdLocation): string {
  const kind = tool.is_storage ? 'Ersatz' : 'Werkzeug'
  const status = tool.status
    ? (TOOL_STATUS_LABELS[tool.status as ToolStatus] ?? tool.status)
    : 'ohne Status'
  return `${kind} · ${status}`
}

export default function ToolForm({
  initial,
  onSave,
  onClose,
  initialSubTab,
  initialSerialArticle = null,
  onSerialArticleSaved,
  initialSparePart = null,
  onSparePartSaved,
  initialDataSheet = null,
  prefillDataSheetToolId = null,
  onDataSheetSaved,
  onNotify,
}: ToolFormProps) {
  const [toolTypes, setToolTypes] = useState<ToolType[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subTab, setSubTab] = useState<SubTab>(initialSubTab ?? 'tool')

  const [toolId, setToolId] = useState(initial?.tool_id ?? '')
  const [category, setCategory] = useState<ToolCategory>(initial?.category ?? 'Stempel')
  const [status, setStatus] = useState<ToolStatus | ''>(initial?.status ?? '')
  const [isStorage, setIsStorage] = useState(initial?.is_storage ?? false)
  const [measureA, setMeasureA] = useState(initial?.measure_a ?? '')
  const [measureB, setMeasureB] = useState(initial?.measure_b ?? '')
  // Ungültige Maß-Eingabe bleibt sichtbar stehen und wird benannt, statt beim
  // Verlassen des Feldes stillschweigend geleert zu werden (Audit B6).
  const [measureAError, setMeasureAError] = useState('')
  const [measureBError, setMeasureBError] = useState('')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [plantId, setPlantId] = useState<string>(initial ? String(initial.plant_id) : '')
  const [toolTypeId, setToolTypeId] = useState<string>(initial ? String(initial.tool_type_id) : '')

  // Stammdaten-Zuordnung (optional)
  const [customerId, setCustomerId] = useState<string>(initial?.customer_id ? String(initial.customer_id) : '')
  const [machineId, setMachineId] = useState<string>(initial?.machine_id ? String(initial.machine_id) : '')

  // Live-Prüfung der Werkzeug-ID
  const [idState, setIdState] = useState<IdState>('idle')
  const [idMessage, setIdMessage] = useState('')
  // Alle Datensätze mit dieser ID im Werk – normale Werkzeuge UND
  // Lager/Ersatz-Exemplare, jeweils mit Fundort (Platz-Code oder "Ablage").
  const [existingTools, setExistingTools] = useState<ToolIdLocation[]>([])
  // Übernahme-Vorschlag des Backends (Maße, Typ, Beschreibung, Ablage)
  const [idPrefill, setIdPrefill] = useState<{ key: string; data: ToolIdPrefill } | null>(null)
  // Hinweis „was wurde übernommen“ samt Rücknahme
  const [prefillInfo, setPrefillInfo] = useState<{ source: string; fields: PrefillField[] } | null>(null)
  // Felder, die der Benutzer selbst angefasst hat – werden nie überschrieben.
  // prefillOwned sind Felder, die wir gefüllt haben; nur die dürfen wir bei
  // einer korrigierten ID noch einmal überschreiben.
  const touchedFields = useRef<Set<PrefillField>>(new Set())
  const prefillOwned = useRef<Set<PrefillField>>(new Set())
  const prefilledFor = useRef('')

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

  // Pflichtfelder je Kategorie (DEC-055): Ein Stempel wird über seine
  // Werkzeug-ID geführt (sie kommt aus SAP und ist eingraviert), Abstreifer und
  // Matrize über ihr Maß. Alles andere (Maß A, Werk, Werkzeug-Typ) bleibt für
  // alle Kategorien Pflicht, Maß B bleibt freiwillig.
  const idRequired = category === 'Stempel'

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
  //
  // Bei Lager/Ersatz ist die ID nie ein Fehler (Mehrfach-IDs erlaubt) – dort
  // ist das Ergebnis nur eine Auskunft: existiert die ID schon, wird der
  // vorhandene Datensatz mit Fundort angezeigt und die Übernahme vorbereitet.
  useEffect(() => {
    const value = toolId.trim()
    if (!value || !plantId) {
      setIdState('idle')
      setIdMessage('')
      setExistingTools([])
      setIdPrefill(null)
      return
    }
    setIdState('checking')
    const timer = setTimeout(() => {
      const key = `${category}|${plantId}|${isStorage}|${value}`
      checkToolId(value, category, Number(plantId), isStorage, initial?.id)
        .then((res) => {
          setIdState(isStorage ? 'idle' : res.available ? 'ok' : 'error')
          setIdMessage(res.message)
          setExistingTools(res.locations ?? [])
          setIdPrefill(res.prefill ? { key, data: res.prefill } : null)
        })
        .catch(() => {
          setIdState('idle')
          setIdMessage('')
          setExistingTools([])
          setIdPrefill(null)
        })
    }, 400)
    return () => clearTimeout(timer)
  }, [toolId, category, plantId, isStorage])

  // Übernahme vorhandener Daten beim Anlegen von Lager/Ersatz:
  // Maß A/B, Werkzeug-Typ und Beschreibung kommen aus einem vorhandenen
  // Datensatz derselben ID; existiert die ID schon als Lager/Ersatz, wird das
  // neue Exemplar wie die vorhandenen in die Ablage gelegt.
  //
  // Nur leere, nicht selbst bearbeitete Felder werden gefüllt (siehe
  // touchedFields/prefillOwned), und jeder Wert nur einmal pro ID.
  useEffect(() => {
    if (!idPrefill || !isStorage || initial) return
    if (prefilledFor.current === idPrefill.key) return
    const { data } = idPrefill

    const taken: PrefillField[] = []
    const take = (
      field: PrefillField,
      next: string | null,
      current: string,
      apply: (value: string) => void,
    ) => {
      if (!next) return
      if (touchedFields.current.has(field)) return
      if (current.trim() !== '' && !prefillOwned.current.has(field)) return
      apply(next)
      prefillOwned.current.add(field)
      taken.push(field)
    }

    take('measure_a', data.measure_a, measureA, setMeasureA)
    take('measure_b', data.measure_b, measureB, setMeasureB)
    take('tool_type_id', data.tool_type_id ? String(data.tool_type_id) : null, toolTypeId, setToolTypeId)
    take('description', data.description, description, setDescription)
    if (
      data.in_tray &&
      !inTray &&
      !touchedFields.current.has('place') &&
      !prefillOwned.current.has('place')
    ) {
      setInTray(true)
      prefillOwned.current.add('place')
      taken.push('place')
    }

    prefilledFor.current = idPrefill.key
    if (taken.length === 0) return
    setPrefillInfo({
      source: `${data.source_is_storage ? 'Ersatz-Exemplar' : 'Werkzeug'}${
        data.source_location ? ` (${data.source_location})` : ''
      }`,
      fields: taken,
    })
  }, [idPrefill, isStorage, initial, measureA, measureB, toolTypeId, description, inTray])

  /** Übernommene Werte zurücknehmen und nicht erneut übernehmen. */
  function discardPrefill() {
    if (!prefillInfo) return
    prefillInfo.fields.forEach((field) => {
      touchedFields.current.add(field)
      prefillOwned.current.delete(field)
      if (field === 'measure_a') setMeasureA('')
      else if (field === 'measure_b') setMeasureB('')
      else if (field === 'tool_type_id') setToolTypeId('')
      else if (field === 'description') setDescription('')
      else if (field === 'place') setInTray(false)
    })
    setPrefillInfo(null)
  }

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
  // Ein Platz ist auch dann belegt, wenn ein **Ersatzteil** darauf liegt
  // (DEC-064, Anforderung 7.2).
  useEffect(() => {
    if (!drawerId) {
      setFreePositions([])
      return
    }
    getPositions(Number(drawerId))
      .then((allPos) => {
        setFreePositions(
          allPos.filter(
            (p) =>
              (p.tool_id === null && !p.spare_part) || p.id === initial?.position_id,
          ),
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

    if (idRequired && !toolId.trim()) {
      setError('Für Stempel ist die Werkzeug-ID erforderlich.')
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
    // Platzpflicht nur bei normalen Werkzeugen. Lager/Ersatz darf ohne Platz
    // angelegt werden und landet dann in der Werkzeug-Ablage (DEC-050/052).
    if (!isStorage && !inTray && (!cabinetId || !drawerId || !positionId)) {
      setError('Bitte einen Lagerplatz wählen (Schrank → Schublade → Platz) oder „In Ablage legen“ aktivieren.')
      return
    }

    // Maße normalisieren: Komma, immer zwei Nachkommastellen
    const normA = normalizeMeasure(measureA)
    const normB = normalizeMeasure(measureB)
    if (normA === null) {
      setError('Maß A ist erforderlich (z. B. 7,00).')
      setMeasureAError('Maß A ist erforderlich – z. B. 7 / 7,3 / 7.30')
      return
    }
    if (measureB.trim() !== '' && normB === null) {
      setError('Maß B ist ungültig (z. B. 7,00).')
      setMeasureBError('Maß B ist ungültig – z. B. 7 / 7,3 / 7.30')
      return
    }
    setMeasureAError('')
    setMeasureBError('')

    const baseInput: ToolInput = {
      // Leeres Feld = „ohne ID" (null). Nur Abstreifer und Matrize dürfen das;
      // für Stempel greift die Prüfung oben (DEC-055).
      tool_id: toolId.trim() === '' ? null : toolId.trim(),
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
      // Kein Platz gewählt (z. B. Lager/Ersatz ohne Platz) → Ablage (null).
      position_id: !inTray && positionId ? Number(positionId) : null,
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

  // `inline-flex` + `gap-2`: die Reiter tragen jetzt ein Icon. Ohne Flex
  // stünden Icon und Text direkt aneinander, und in der senkrechten Leiste
  // (lg) wäre der Text nicht linksbündig zu den übrigen Reitern.
  const subTabClass = (active: boolean) =>
    `inline-flex items-center gap-2 w-full justify-start lg:justify-start ${active ? 'is-active' : ''}`

  // Was beim Speichern entsteht – nur bei Lager/Ersatz sichtbar.
  // Nur das erste Exemplar bekommt den gewählten Platz (ein Platz kann nur
  // ein Werkzeug halten), alle weiteren gehen in die Ablage.
  const newCopies = Math.max(1, storageCount)
  const selectedPosition = freePositions.find((p) => String(p.id) === positionId)
  const selectedPositionLabel = selectedPosition ? getPositionLabel(selectedPosition) : ''
  const usesFixedPlace = !inTray && selectedPositionLabel !== ''
  const copySentence = usesFixedPlace
    ? newCopies === 1
      ? `Das neue Exemplar kommt auf ${selectedPositionLabel}.`
      : `Das erste neue Exemplar kommt auf ${selectedPositionLabel}, die übrigen ${newCopies - 1} in die Ablage.`
    : // Kein Platz vorbelegt: dann offen benennen, was passiert. Die Ablage ist
      // kein stiller Standard, solange ein Datensatz der ID einen Platz hat.
      newCopies === 1
      ? 'Noch kein Lagerplatz gewählt – ohne Auswahl geht das Exemplar in die Ablage.'
      : `Noch kein Lagerplatz gewählt – ohne Auswahl gehen die ${newCopies} Exemplare in die Ablage.`

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Sub-Tabs Navigation – dasselbe Muster wie die Tabbar (.ui-tabs).
          `is-vertical-labels` gibt dem aktiven Reiter in der senkrechten Leiste
          (lg) zusätzlich einen Primary-Streifen am linken Rand (index.css). */}
      <div
        className="ui-tabs is-vertical-labels w-full lg:w-1/5 flex-row lg:flex-col overflow-x-auto"
        aria-label="Bereiche des Anlege-Formulars"
      >
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            aria-current={subTab === key ? 'true' : undefined}
            className={subTabClass(subTab === key)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Der Inhalt liegt auf einer eigenen Fläche mit weicher Kante – damit ist
          die Reiterleiste optisch vom Inhalt getrennt, ohne eine zweite Farbe. */}
      <div className="w-full lg:w-4/5 rounded-xl border border-white/60 bg-white/30 p-4 shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
        {metaError && (
          <div className="ui-alert ui-alert-error mb-4">
            <CircleXIcon className="h-4 w-4 shrink-0" />
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
                      onChange={() => {
                        setCategory(c)
                        // Ein Pflichtfeld-Hinweis der vorigen Kategorie gilt
                        // jetzt nicht mehr (z. B. „ID erforderlich" → Abstreifer).
                        setError(null)
                      }}
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
                  title="Anzahl der Exemplare, die in einem Zug angelegt werden"
                  className="input-bordered w-20 text-base sm:text-sm py-1"
                />
              </div>
            </div>

            {/* Werkzeug-ID & Typ – Innenlabel (.ui-field, Guide §1.9) spart je Zeile ~20px */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className={`ui-field ${idState === 'error' ? 'is-error' : idState === 'ok' ? 'is-ok' : ''}`}>
                  {/* Pflicht nur bei Stempel (DEC-055) – das `*` kommt aus `idRequired`,
                      also aus derselben Angabe wie `required` am Feld. */}
                  <FieldLabel htmlFor="tool-id" required={idRequired}>
                    Werkzeug-ID
                  </FieldLabel>
                  <input
                    id="tool-id"
                    type="text"
                    value={toolId}
                    onChange={(e) => setToolId(e.target.value)}
                    placeholder="z. B. 01020000"
                    required={idRequired}
                    aria-required={idRequired}
                  />
                  {idState === 'checking' && (
                    <span className="ui-spinner mr-3 h-3.5 w-3.5 self-center" />
                  )}
                </div>
                {idState === 'ok' && (
                  <FieldMessage tone="success">{idMessage}</FieldMessage>
                )}
                {idState === 'error' && (
                  <FieldMessage tone="error">{idMessage}</FieldMessage>
                )}
                {idState === 'idle' && !plantId && (
                  <FieldMessage icon={<InfoIcon className="h-3.5 w-3.5 shrink-0" />}>
                    Bitte zuerst ein Werk wählen.
                  </FieldMessage>
                )}
                {/* Vor dem Ausfüllen erklärt, warum hier kein Sternchen steht –
                    sonst wirkt die leere Pflichtspalte wie ein vergessenes Feld. */}
                {!idRequired && (
                  <FieldMessage icon={<InfoIcon className="h-3.5 w-3.5 shrink-0" />}>
                    Abstreifer und Matrize brauchen keine ID – Pflichtfeld ist hier Maß A.
                  </FieldMessage>
                )}
              </div>
              <div className="min-w-0">
                <div className="ui-field">
                  {/* Der Server verlangt `tool_type_id` – vorher fehlte hier das Sternchen,
                      obwohl das Feld `required` trug (Audit B2). */}
                  <FieldLabel htmlFor="tool-type" required>
                    Werkzeug-Typ
                  </FieldLabel>
                  <select
                    id="tool-type"
                    value={toolTypeId}
                    onChange={(e) => {
                      touchedFields.current.add('tool_type_id')
                      setToolTypeId(e.target.value)
                    }}
                    required
                    aria-required
                  >
                    <option value="">Werkzeug-Typ wählen</option>
                    {toolTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stand der ID als Guide-konformer Alert (.ui-alert-info –
                Aufbau wie in UI-Styleguide.html, „Tooltips & Alerts“:
                Icon-Span + <strong> + Body mit opacity-80).
                Bei Lager/Ersatz ist die ID nie ein Fehler; der Alert nennt
                deshalb nur den Stand und was beim Speichern entsteht.
                Die Fundort-Liste führt normale Werkzeuge und Lager/Ersatz
                zusammen, damit „01020000“ nicht je nach Checkbox etwas
                anderes zu bedeuten scheint. */}
            {isStorage && idMessage && (
              <div className="ui-alert ui-alert-info">
                <InfoIcon className="h-4 w-4 shrink-0" />
                <div>
                  <strong>{idMessage}</strong>
                  {existingTools.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5" aria-label="Vorhandene Datensätze mit dieser ID">
                      {existingTools.map((tool) => (
                        <li key={tool.id} className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
                            {tool.location}
                          </span>
                          <span className="opacity-80">{describeExistingTool(tool)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1 opacity-80">{copySentence}</div>
                </div>
              </div>
            )}

            {/* Was automatisch übernommen wurde – mit Rücknahme */}
            {prefillInfo && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                <span>
                  Von vorhandenem {prefillInfo.source} übernommen:{' '}
                  {prefillInfo.fields.map((f) => PREFILL_FIELD_LABELS[f]).join(', ')}.
                </span>
                <button
                  type="button"
                  onClick={discardPrefill}
                  className="font-medium text-teal-800 underline underline-offset-2"
                >
                  Übernahme verwerfen
                </button>
              </div>
            )}

            {/* Maße A & B – Werte werden auf "123,45" normalisiert (Komma, 2 Stellen) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className={`ui-field ${measureAError ? 'is-error' : ''}`}>
                  <FieldLabel htmlFor="tool-measure-a" required>
                    Maß A
                  </FieldLabel>
                  <input
                    id="tool-measure-a"
                    type="text"
                    inputMode="decimal"
                    value={measureA}
                    onChange={(e) => {
                      touchedFields.current.add('measure_a')
                      setMeasureA(e.target.value)
                      setMeasureAError('')
                    }}
                    onBlur={() => {
                      const normalized = normalizeMeasure(measureA)
                      if (normalized) {
                        setMeasureA(normalized)
                        setMeasureAError('')
                      } else if (measureA.trim() !== '') {
                        // Nicht stillschweigend verwerfen: `normalizeMeasure` gibt bei
                        // ungültiger Eingabe `null` zurück (Audit B6).
                        setMeasureAError('Ungültiges Maß – erlaubt sind z. B. 7 / 7,3 / 7.30')
                      }
                    }}
                    placeholder="z. B. 7"
                    required
                    aria-required
                    aria-describedby={measureAError ? 'tool-measure-a-error' : undefined}
                  />
                  <span className="flex items-center pr-3 text-xs text-slate-600" aria-hidden="true">mm</span>
                </div>
                {measureAError && (
                  <FieldMessage tone="error" id="tool-measure-a-error">
                    {measureAError}
                  </FieldMessage>
                )}
              </div>
              <div className="min-w-0">
                <div className={`ui-field ${measureBError ? 'is-error' : ''}`}>
                  <FieldLabel htmlFor="tool-measure-b">Maß B</FieldLabel>
                  <input
                    id="tool-measure-b"
                    type="text"
                    inputMode="decimal"
                    value={measureB}
                    onChange={(e) => {
                      touchedFields.current.add('measure_b')
                      setMeasureB(e.target.value)
                      setMeasureBError('')
                    }}
                    onBlur={() => {
                      const normalized = normalizeMeasure(measureB)
                      if (normalized) {
                        setMeasureB(normalized)
                        setMeasureBError('')
                      } else if (measureB.trim() !== '') {
                        setMeasureBError('Ungültiges Maß – erlaubt sind z. B. 7 / 7,3 / 7.30')
                      }
                    }}
                    placeholder="z. B. 8"
                    aria-describedby={measureBError ? 'tool-measure-b-error' : undefined}
                  />
                  <span className="flex items-center pr-3 text-xs text-slate-600" aria-hidden="true">mm</span>
                </div>
                {measureBError && (
                  <FieldMessage tone="error" id="tool-measure-b-error">
                    {measureBError}
                  </FieldMessage>
                )}
              </div>
            </div>

            {/* Lagerplatz: fester Platz ODER Ablage */}
            <FormSection
              title="Lagerplatz"
              action={
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={inTray}
                    onChange={(e) => {
                      touchedFields.current.add('place')
                      setInTray(e.target.checked)
                    }}
                    className="rounded accent-teal-700 h-4 w-4"
                  />
                  In Ablage legen (kein fester Platz)
                </label>
              }
            >

              {!inTray && (
                <>
                  {/* Ausnahme von §1.9: In einer 3-spaltigen Reihe bliebe dem Select
                      neben dem Tag zu wenig Platz für „Bitte zuerst Schrank wählen". */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <FieldLabel htmlFor="tool-cabinet" required standalone>Schrank</FieldLabel>
                      <select
                        id="tool-cabinet"
                        value={cabinetId}
                        onChange={(e) => { touchedFields.current.add('place'); setCabinetId(e.target.value); setDrawerId(''); setPositionId('') }}
                        disabled={!plantId}
                        required
                        aria-required
                        className="select-bordered text-base sm:text-sm"
                      >
                        <option value="">{plantId ? 'Schrank wählen' : 'Bitte zuerst Werk wählen'}</option>
                        {cabinets.map((c) => (
                          <option key={c.id} value={c.id}>Schrank {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="tool-drawer" required standalone>Schublade</FieldLabel>
                      <select
                        id="tool-drawer"
                        value={drawerId}
                        onChange={(e) => { touchedFields.current.add('place'); setDrawerId(e.target.value); setPositionId('') }}
                        disabled={!cabinetId}
                        required
                        aria-required
                        className="select-bordered text-base sm:text-sm"
                      >
                        <option value="">{cabinetId ? 'Schublade wählen' : 'Bitte zuerst Schrank wählen'}</option>
                        {drawers.map((d) => (
                          <option key={d.id} value={d.id}>Schublade {d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="tool-position" required standalone>Platz</FieldLabel>
                      <select
                        id="tool-position"
                        value={positionId}
                        onChange={(e) => { touchedFields.current.add('place'); setPositionId(e.target.value) }}
                        disabled={!drawerId || freePositions.length === 0}
                        required
                        aria-required
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
            </FormSection>

            {/* Zuordnung: Werk, Kunde, Maschine und Status.
                „Werk" und „Status" waren vorher eine eigene Zeile über dem
                Lagerplatz, obwohl „Werk" zur Zuordnung gehört (Kunde und
                Maschine hängen an ihm: der Werkwechsel leert die Maschine).
                Die Ladereihenfolge bleibt: „Werk" steht innerhalb der Gruppe
                zuerst und lädt Schrank/Schublade/Platz im Block darüber. */}
            <FormSection title="Zuordnung" optional>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="ui-field">
                    <FieldLabel htmlFor="tool-plant" required>
                      Werk
                    </FieldLabel>
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
                      aria-required
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
                    <FieldLabel htmlFor="tool-status">Status</FieldLabel>
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
                <div className="min-w-0">
                  <div className="ui-field">
                    <FieldLabel htmlFor="tool-customer">Kunde</FieldLabel>
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
                    <FieldLabel htmlFor="tool-machine">Maschine</FieldLabel>
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
            </FormSection>

            {/* Beschreibung */}
            <div>
              <FieldLabel htmlFor="tool-description" standalone>Beschreibung</FieldLabel>
              <textarea
                id="tool-description"
                value={description}
                onChange={(e) => {
                  touchedFields.current.add('description')
                  setDescription(e.target.value)
                }}
                rows={2}
                className="textarea-bordered text-base sm:text-sm resize-none"
                placeholder="Zusätzliche Informationen"
              />
            </div>

            {error && (
              <div className="ui-alert ui-alert-error">
                <CircleXIcon className="h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-white/40">
              <button
                type="button"
                onClick={onClose}
                className="ui-btn ui-btn-secondary flex-1"
              >
                <XIcon className="h-3.5 w-3.5" />
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="ui-btn ui-btn-primary flex-1"
              >
                {saving ? (
                  <span className="ui-spinner h-3.5 w-3.5" />
                ) : (
                  <CheckIcon className="h-3.5 w-3.5" />
                )}
                {saving ? 'Wird gespeichert …' : initial ? 'Änderungen speichern' : 'Werkzeug anlegen'}
              </button>
            </div>
          </form>
        )}

        {subTab === 'series' && (
          <SerialArticleForm
            initial={initialSerialArticle}
            prefill={{
              plantId: plantId ? Number(plantId) : null,
              customerId: customerId ? Number(customerId) : null,
              machineId: machineId ? Number(machineId) : null,
            }}
            onSaved={onSerialArticleSaved}
            onNotify={onNotify}
          />
        )}

        {subTab === 'sheet' && (
          <DataSheetForm
            initial={initialDataSheet}
            prefill={{
              plantId: plantId ? Number(plantId) : null,
              machineId: machineId ? Number(machineId) : null,
            }}
            prefillToolId={initialDataSheet?.tool_id ?? prefillDataSheetToolId}
            onSaved={onDataSheetSaved}
            onNotify={onNotify}
          />
        )}

        {subTab === 'spare' && (
          <SparePartForm
            initial={initialSparePart}
            prefill={{ plantId: plantId ? Number(plantId) : null }}
            onSaved={onSparePartSaved}
            onNotify={onNotify}
          />
        )}
      </div>
    </div>
  )
}
