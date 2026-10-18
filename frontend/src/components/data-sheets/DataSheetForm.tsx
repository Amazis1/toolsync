import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import {
  checkDataSheetToolId,
  createDataSheet,
  deleteDataSheetFile,
  getDataSheetFile,
  updateDataSheet,
} from '../../api/dataSheets'
import { getMachines } from '../../api/masterData'
import { getPlants } from '../../api/tools'
import type { Machine, Plant } from '../../api/types'
import type { DataSheet, DataSheetFile, DataSheetInput } from '../../types/data-sheet'
import { CheckIcon, CircleXIcon, TrashIcon, UploadIcon } from '../icons'
import { FieldLabel, FieldMessage } from '../Field'

interface DataSheetFormProps {
  /** null = anlegen, sonst bearbeiten. */
  initial?: DataSheet | null
  /**
   * Vorbelegung aus dem Werkzeugformular – nur beim Anlegen und nur beim Öffnen
   * (dieselbe Regel wie beim Serienartikel, DEC-056 Punkt 6).
   */
  prefill?: {
    plantId?: number | null
    machineId?: number | null
  }
  /** Vorbelegte Werkzeug-ID, wenn das Formular aus einer Werkzeugzeile kommt. */
  prefillToolId?: string | null
  onSaved?: (sheet: DataSheet) => void
  /** Meldung anzeigen (Toast) – **eine** Quelle, siehe `onNotify` in App.tsx. */
  onNotify?: (variant: 'success' | 'error', title: string) => void
}

/** Wartezeit der Live-Prüfung der Werkzeug-ID. */
const CHECK_DEBOUNCE_MS = 400

/**
 * **Ein** Dateifeld für Datenblätter (PDF) und Bilder – dieselbe Idee wie im
 * Serienartikel-Formular (DEC-060): die Auswahl wird beim Ablegen sortiert,
 * erstes PDF wird ein Datenblatt, alles andere ein Bild.
 */
const DOC_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif']

function isPlan(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf')
}

function isBild(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  return IMAGE_EXTENSIONS.includes(extension)
}

/**
 * Formular für ein **Datenblatt** (DEC-065).
 *
 * Aufbau wie das Serienartikel-Formular – **Innenlabel** (`.ui-field`,
 * Guide §1.9), Meldungen direkt am Feld, Speichern unabhängig vom Werkzeug.
 * Felder: **Werkzeug-ID** (freiwillig), **Werk** (freiwillig – ohne Werk gilt der
 * Datensatz für **alle** Werke, DEC-085), Maschine, Name und Dateien
 * (Datenblätter als PDF **und** Bilder).
 *
 * Es gibt bewusst **kein** Beschreibungsfeld und **keinen** Kunden: Ein
 * Datenblatt ist über Werkzeug-ID, Name, Werk und Maschine auffindbar; eine
 * vorhandene Beschreibung aus früheren Datensätzen bleibt in der Datenbank
 * erhalten (das Feld wird nicht mehr mitgeschickt).
 */
export default function DataSheetForm({
  initial = null,
  prefill,
  prefillToolId,
  onSaved,
  onNotify,
}: DataSheetFormProps) {
  const uid = useId()

  const [toolId, setToolId] = useState(initial?.tool_id ?? prefillToolId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [plantId, setPlantId] = useState(
    initial?.plant_id != null
      ? String(initial.plant_id)
      : prefill?.plantId != null
        ? String(prefill.plantId)
        : '',
  )
  const [machineId, setMachineId] = useState(
    initial?.machine_id != null
      ? String(initial.machine_id)
      : prefill?.machineId != null
        ? String(prefill.machineId)
        : '',
  )
  // Beschreibung: Feld bleibt, aber **ohne** die Beschriftung „Beschreibung" im
  // Feld. Für Screenreader bleibt der Name über `aria-label` erhalten.
  const [description, setDescription] = useState(initial?.description ?? '')

  const [plants, setPlants] = useState<Plant[]>([])
  const [machines, setMachines] = useState<Machine[]>([])

  // Dateien, die beim Speichern mitgeschickt werden (PDFs und Bilder gemischt).
  const [neueDateien, setNeueDateien] = useState<File[]>([])
  const [zieht, setZieht] = useState(false)
  const dateiFeld = useRef<HTMLInputElement>(null)

  // Dateien, die bereits am Datensatz hängen (beim Bearbeiten einzeln löschbar).
  const [hinterlegteBlaetter, setHinterlegteBlaetter] = useState<DataSheetFile[]>(
    initial?.plans ?? [],
  )
  const [hinterlegteBilder, setHinterlegteBilder] = useState<DataSheetFile[]>(
    initial?.images ?? [],
  )
  const [bildVorschau, setBildVorschau] = useState<Record<string, string>>({})
  const [loescheDatei, setLoescheDatei] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idMessage, setIdMessage] = useState('')
  const [idChecking, setIdChecking] = useState(false)

  // Werkliste (Lesezugriff für alle aktiven Benutzer).
  useEffect(() => {
    let cancelled = false
    getPlants()
      .then((list) => {
        if (!cancelled) setPlants(list)
      })
      .catch(() => {
        // Ohne Werkliste bleibt das Auswahlfeld leer – die Meldung kommt beim Speichern.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Maschinen gehören zu einem Werk: bei Werkwechsel neu laden.
  useEffect(() => {
    let cancelled = false
    const wanted = plantId ? Number(plantId) : undefined
    getMachines(wanted)
      .then((list) => {
        if (!cancelled) setMachines(list)
      })
      .catch(() => {
        if (!cancelled) setMachines([])
      })
    return () => {
      cancelled = true
    }
  }, [plantId])

  // Live-Prüfung: wie viele Datenblätter gibt es zu dieser Werkzeug-ID schon?
  // Ein Treffer ist **kein** Fehler (andere Maschine, andere Auflage).
  // Alles läuft im Zeitgeber – der Effektkörper bleibt frei von Zustandsänderungen.
  useEffect(() => {
    const value = toolId.trim()
    let cancelled = false
    const timer = setTimeout(() => {
      if (!value) {
        setIdMessage('')
        setIdChecking(false)
        return
      }
      setIdChecking(true)
      checkDataSheetToolId(value, initial?.id)
        .then((result) => {
          if (!cancelled) setIdMessage(result.message)
        })
        .catch(() => {
          if (!cancelled) setIdMessage('')
        })
        .finally(() => {
          if (!cancelled) setIdChecking(false)
        })
    }, CHECK_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [toolId, initial?.id])

  // Vorschaubilder der hinterlegten Bilder (feste Größe, vom Server erzeugt).
  useEffect(() => {
    if (!initial || hinterlegteBilder.length === 0) return
    let cancelled = false
    const erzeugteUrls: string[] = []
    Promise.all(
      hinterlegteBilder.map(async (eintrag) => {
        const blob = await getDataSheetFile(initial.id, eintrag.name, 'thumb')
        const url = URL.createObjectURL(blob)
        erzeugteUrls.push(url)
        return [eintrag.name, url] as const
      }),
    )
      .then((eintraege) => {
        if (!cancelled) setBildVorschau(Object.fromEntries(eintraege))
      })
      .catch(() => {
        // Ohne Vorschau bleibt die Liste bedienbar (der Name steht daneben).
      })
    return () => {
      cancelled = true
      erzeugteUrls.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, hinterlegteBilder.length])

  function dateienUebernehmen(auswahl: FileList | null) {
    if (!auswahl || auswahl.length === 0) return
    const liste = Array.from(auswahl)
    const unbekannt = liste.find((datei) => !isPlan(datei) && !isBild(datei))
    if (unbekannt) {
      setError(
        `„${unbekannt.name}" ist weder PDF noch Bild. Erlaubt sind PDF, JPG, PNG, WEBP, GIF, BMP und HEIC.`,
      )
      return
    }
    setError(null)
    setNeueDateien((current) => [...current, ...liste])
  }

  async function entferneDatei(dateiname: string) {
    if (!initial) return
    setLoescheDatei(dateiname)
    setError(null)
    try {
      await deleteDataSheetFile(initial.id, dateiname)
      setHinterlegteBlaetter((current) => current.filter((e) => e.name !== dateiname))
      setHinterlegteBilder((current) => current.filter((e) => e.name !== dateiname))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Die Datei konnte nicht entfernt werden. Versuche es erneut.',
      )
    } finally {
      setLoescheDatei(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const payload: DataSheetInput = {
      tool_id: toolId.trim() || null,
      // Kein Werk = gilt für **alle** Werke (DEC-085).
      plant_id: plantId ? Number(plantId) : null,
      machine_id: machineId ? Number(machineId) : null,
      name: name.trim() || null,
      description: description.trim() || null,
    }

    const plaene = neueDateien.filter(isPlan)
    const bilder = neueDateien.filter(isBild)

    setSaving(true)
    try {
      const saved = initial
        ? await updateDataSheet(initial.id, payload, plaene, bilder)
        : await createDataSheet(payload, plaene, bilder)

      onNotify?.(
        'success',
        initial
          ? `Datenblatt „${saved.tool_id ?? saved.name ?? 'Ohne Werkzeug-ID'}“ wurde geändert.`
          : `Datenblatt „${saved.tool_id ?? saved.name ?? 'Ohne Werkzeug-ID'}“ wurde angelegt.`,
      )

      if (initial) {
        setHinterlegteBlaetter(saved.plans)
        setHinterlegteBilder(saved.images)
      } else {
        // Der Reiter bleibt offen: das nächste Blatt kann direkt folgen.
        // Werk und Maschine bleiben stehen, der Rest wird geleert.
        setToolId(prefillToolId ?? '')
        setName('')
        setIdMessage('')
      }
      setNeueDateien([])
      if (dateiFeld.current) dateiFeld.current.value = ''
      onSaved?.(saved)
    } catch (err) {
      // **Eine** Rückmeldung: der Toast (vorher zusätzlich als Block im Formular).
      setError(null)
      onNotify?.(
        'error',
        err instanceof Error
          ? err.message
          : 'Das Datenblatt konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      )
    } finally {
      setSaving(false)
    }
  }

  const dateiZeile = (eintrag: DataSheetFile) => (
    <li
      key={eintrag.name}
      className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/50 px-2 py-1 text-xs"
    >
      <span className="flex min-w-0 items-center gap-2">
        {eintrag.kind === 'image' &&
          (bildVorschau[eintrag.name] ? (
            <img
              src={bildVorschau[eintrag.name]}
              alt={`Vorschau ${eintrag.name}`}
              className="h-8 w-8 shrink-0 rounded border border-white/80 object-cover"
            />
          ) : (
            <span className="h-8 w-8 shrink-0 rounded bg-white/60" aria-hidden="true" />
          ))}
        <span className="min-w-0 truncate">
          {eintrag.name} · {(eintrag.size / 1024).toFixed(0)} KB
        </span>
      </span>
      <button
        type="button"
        onClick={() => void entferneDatei(eintrag.name)}
        disabled={loescheDatei === eintrag.name}
        aria-label={`${eintrag.kind === 'image' ? 'Bild' : 'Datenblatt'} ${eintrag.name} löschen`}
        title={
          loescheDatei === eintrag.name
            ? 'Wird gelöscht …'
            : `${eintrag.kind === 'image' ? 'Bild' : 'Datenblatt'} löschen`
        }
        className="ui-btn ui-btn-danger-soft ui-btn-sm shrink-0"
      >
        {loescheDatei === eintrag.name ? (
          <span className="ui-spinner h-3.5 w-3.5" />
        ) : (
          <TrashIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </li>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
      {/* `noValidate`: Die Feldprüfung macht dieses Formular selbst, damit die
          Meldungen **deutsch** und in der Sprache der Oberfläche stehen. Ohne
          das Attribut hält der Browser das Absenden an und zeigt seinen eigenen
          Sprechblasentext – die eigenen Meldungen wären nie zu sehen. */}
      {/* Feldprüfung und Dateiauswahl: sagen, **welches** Feld oder welche
          Datei nicht passt. Erfolg und Serverfehler laufen als Toast. */}
      {error && (
        <div className="ui-alert ui-alert-error">
          <CircleXIcon className="h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Felder mit Innenlabel (.ui-field, Guide §1.9) – wie im Werkzeugformular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="min-w-0">
          <div className="ui-field">
            {/* Werkzeug-ID ist hier **freiwillig** (Abstreifer und Matrize haben
                keine, DEC-055) – deshalb kein Sternchen, aber auch keins im
                Werkzeug-Formular, wo sie Pflicht ist. */}
            <FieldLabel htmlFor={`${uid}-tool-id`}>Werkzeug-ID</FieldLabel>
            <input
              id={`${uid}-tool-id`}
              type="text"
              value={toolId}
              onChange={(event) => {
                setToolId(event.target.value)
                setError(null)
              }}
              placeholder="z. B. 1075000"
            />
            {idChecking && <span className="ui-spinner mr-3 h-3.5 w-3.5 self-center" />}
          </div>
          {idMessage && <FieldMessage>{idMessage}</FieldMessage>}
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
            <input
              id={`${uid}-name`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Gewindeformer"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            {/* Werk ist **freiwillig** (DEC-085): leer = gilt für alle Werke. */}
            <FieldLabel htmlFor={`${uid}-plant`}>Werk</FieldLabel>
            <select
              id={`${uid}-plant`}
              value={plantId}
              onChange={(event) => {
                setPlantId(event.target.value)
                setMachineId('')
              }}
            >
              <option value="">Alle Werke (allgemein)</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-machine`}>Maschine</FieldLabel>
            <select
              id={`${uid}-machine`}
              value={machineId}
              onChange={(event) => setMachineId(event.target.value)}
              disabled={!plantId}
            >
              <option value="">
                {plantId ? 'keine Maschine' : 'nur mit Werk wählbar'}
              </option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Beschreibung – Beschriftung **über** dem Feld, nicht darin (dasselbe
          Muster wie im Serienartikel-Formular). */}
      <div>
        <FieldLabel htmlFor={`${uid}-description`} standalone>
          Beschreibung
        </FieldLabel>
        <textarea
          id={`${uid}-description`}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="textarea-bordered w-full resize-none text-base sm:text-sm"
          placeholder="Zusätzliche Informationen"
        />
      </div>

      {/* Ein Feld für alles: Datenblätter (PDF) und Bilder */}
      <div>
        <label
          htmlFor={`${uid}-files`}
          onDragOver={(event) => {
            event.preventDefault()
            setZieht(true)
          }}
          onDragLeave={() => setZieht(false)}
          onDrop={(event) => {
            event.preventDefault()
            setZieht(false)
            dateienUebernehmen(event.dataTransfer.files)
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            zieht ? 'border-teal-700/70 bg-white/70' : 'border-white/80 bg-white/40'
          }`}
        >
          <UploadIcon className="mb-1 h-6 w-6 text-teal-800" />
          <span className="text-sm font-medium text-slate-900">
            Datenblätter und Bilder hierher ziehen oder auswählen
          </span>
          <span className="mt-1 text-xs text-slate-600">
            PDF wird ein Datenblatt, alles andere ein Bild – mehrere Dateien möglich.
          </span>
          <input
            id={`${uid}-files`}
            ref={dateiFeld}
            type="file"
            multiple
            accept={Object.entries(DOC_ACCEPT)
              .flatMap(([typ, endungen]) => [typ, ...endungen])
              .join(',')}
            className="sr-only"
            onChange={(event) => {
              dateienUebernehmen(event.target.files)
              // Feld leeren, damit dieselbe Datei erneut wählbar bleibt.
              event.target.value = ''
            }}
          />
        </label>

        {/* Hinterlegte Dateien – beim Bearbeiten einzeln entfernbar */}
        {initial && (hinterlegteBlaetter.length > 0 || hinterlegteBilder.length > 0) && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600">Hinterlegte Dateien</p>
            <ul className="mt-1 space-y-1">
              {hinterlegteBlaetter.map(dateiZeile)}
              {hinterlegteBilder.map(dateiZeile)}
            </ul>
          </div>
        )}

        {/* Kommt beim Speichern dazu */}
        {neueDateien.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600">Kommt beim Speichern dazu</p>
            <ul className="mt-1 space-y-1">
              {neueDateien.map((datei, index) => (
                <li
                  key={`${datei.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/50 px-2 py-1 text-xs"
                >
                  <span className="min-w-0 truncate">
                    {datei.name} · {(datei.size / 1024).toFixed(0)} KB ·{' '}
                    {isPlan(datei) ? 'Datenblatt' : 'Bild'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNeueDateien((current) => current.filter((_, i) => i !== index))
                    }
                    className="ui-btn ui-btn-secondary ui-btn-sm shrink-0"
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-white/60 pt-4">
        <button type="submit" disabled={saving} className="ui-btn ui-btn-primary">
          {saving ? (
            <span className="ui-spinner h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
          {saving
            ? 'Wird gespeichert …'
            : initial
              ? 'Änderungen speichern'
              : 'Datenblatt anlegen'}
        </button>
      </div>
    </form>
  )
}
