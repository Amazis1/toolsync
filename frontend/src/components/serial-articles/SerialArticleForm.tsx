import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useDropzone } from 'react-dropzone'

import {
  checkArticleNumber,
  createSerialArticle,
  deleteSerialArticleFile,
  updateSerialArticle,
} from '../../api/serialArticles'
import { getPlants } from '../../api/tools'
import { getCustomers, getMachines } from '../../api/masterData'
import { SerialIcon, CheckIcon, CircleXIcon, UploadIcon } from '../icons'
import { FieldLabel, FieldMessage } from '../Field'
import type { Customer, Machine, Plant } from '../../api/types'
import type { SerialArticle, SerialArticleInput } from '../../types/serial-article'

interface SerialArticleFormProps {
  /** null = anlegen, sonst bearbeiten. */
  initial?: SerialArticle | null
  /**
   * Vorbelegung aus dem Werkzeugformular – nur beim Anlegen und nur beim
   * Öffnen: Der Reiter wird beim Wechsel neu eingehängt und übernimmt dann die
   * aktuellen Angaben. Spätere Änderungen am Werkzeug ändern den Plan nicht
   * (DEC-056 Punkt 6).
   */
  prefill?: {
    plantId?: number | null
    customerId?: number | null
    machineId?: number | null
  }
  onSaved?: (article: SerialArticle) => void
  /**
   * Meldung anzeigen (Toast). **Eine** Quelle für alles, was dieses Formular
   * meldet: vorher stand zusätzlich eine Meldung im Formular selbst, sodass
   * derselbe Erfolg zweimal erschien (einmal im Block, einmal als Toast).
   */
  onNotify?: (variant: 'success' | 'error', title: string) => void
}

type NumberState = 'idle' | 'checking' | 'free' | 'taken' | 'error'

/** Wartezeit der Live-Prüfung der Artikelnummer (wie beim Werkzeug, DEC-054). */
const CHECK_DEBOUNCE_MS = 400

/**
 * Dateien, die die Ablage annimmt – **ein** Feld für alles (DEC-060):
 * Einrichteplan (PDF) und Bilder. Die Liste muss zum Backend passen
 * (PDF: DEC-056, Bilder: DEC-058).
 */
const DOC_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  // Handyfotos (Apple): sonst blendet der Dateidialog sie aus.
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
}

const IMAGE_NAME_PATTERN = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i

/** Ist die Datei der Einrichteplan? */
function isPlan(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Ist die Datei ein Bild? */
function isBild(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_NAME_PATTERN.test(file.name)
}

/**
 * Formular für einen Serienartikel: Artikelnummer, Name, Werk, Kunde, Maschine,
 * Beschreibung, Einrichteplan und Bilder.
 *
 * Es hat **kein eigenes Fenster**: das Formular sitzt im Anlege-Formular – im
 * Reiter „Serienartikel" (DEC-056 Punkt 5). Karte, Überschrift und „Zurück"
 * gehören dem Aufrufer.
 *
 * Aufbau wie im Werkzeugformular (DEC-056 Punkt 10): Felder mit **Innenlabel**
 * (`.ui-field`, Guide §1.9), die Beschreibung als mehrzeiliges Feld, Meldungen
 * direkt am Feld, Speichern-Knopf benennt die Aktion, die Artikelnummer wird
 * schon beim Tippen geprüft.
 */
export default function SerialArticleForm({
  initial = null,
  prefill,
  onSaved,
  onNotify,
}: SerialArticleFormProps) {
  const uid = useId()
  const editing = initial != null

  const [articleNumber, setArticleNumber] = useState(initial?.article_number ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [plantId, setPlantId] = useState<string>(
    initial ? String(initial.plant_id) : prefill?.plantId ? String(prefill.plantId) : '',
  )
  const [customerId, setCustomerId] = useState<string>(
    initial?.customer_id
      ? String(initial.customer_id)
      : prefill?.customerId
        ? String(prefill.customerId)
        : '',
  )
  const [machineId, setMachineId] = useState<string>(
    initial?.machine_id
      ? String(initial.machine_id)
      : prefill?.machineId
        ? String(prefill.machineId)
        : '',
  )
  const [newPlans, setNewPlans] = useState<File[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  // In der Bearbeitung gelöschte Dateien: sofort weg, die Liste bleibt aktuell.
  const [geloeschteDateien, setGeloeschteDateien] = useState<string[]>([])
  const [loeschend, setLoeschend] = useState<string | null>(null)

  const [plants, setPlants] = useState<Plant[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)

  const [numberState, setNumberState] = useState<NumberState>('idle')
  const [numberMessage, setNumberMessage] = useState('')
  // Nur für **Feldprüfungen** (welches Feld fehlt). Alles, was der Server
  // ablehnt, läuft über den Toast (`onNotify`).
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Stammdaten laden ----
  useEffect(() => {
    let cancelled = false
    Promise.all([getPlants(), getCustomers()])
      .then(([plantList, customerList]) => {
        if (cancelled) return
        setPlants(plantList)
        setCustomers(customerList)
      })
      .catch((err) => {
        if (!cancelled) {
          setMetaError(
            err instanceof Error
              ? err.message
              : 'Stammdaten konnten nicht geladen werden. Lade die Seite neu.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Maschinen des gewählten Werks ----
  useEffect(() => {
    if (!plantId) return
    let cancelled = false
    getMachines(Number(plantId))
      .then((list) => {
        if (!cancelled) setMachines(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setMetaError(
            err instanceof Error
              ? err.message
              : 'Maschinen konnten nicht geladen werden. Lade die Seite neu.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [plantId])

  // Aufräumen der laufenden Nummernprüfung beim Verlassen des Formulars.
  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current)
    }
  }, [])

  /**
   * Live-Prüfung der Artikelnummer (DEC-056 Punkt 7).
   *
   * Bewusst ereignisgesteuert statt in einem Effekt: geprüft wird, wenn der
   * Benutzer tippt – nach kurzer Pause. Die eigene Nummer beim Bearbeiten ist
   * keine Dublette.
   */
  function scheduleNumberCheck(value: string) {
    if (checkTimer.current) clearTimeout(checkTimer.current)

    const trimmed = value.trim()
    if (!trimmed || (editing && trimmed === initial?.article_number)) {
      setNumberState('idle')
      setNumberMessage('')
      return
    }

    setNumberState('checking')
    setNumberMessage('Wird geprüft …')
    checkTimer.current = setTimeout(() => {
      checkArticleNumber(trimmed, initial?.id)
        .then((result) => {
          setNumberState(result.available ? 'free' : 'taken')
          setNumberMessage(result.message)
        })
        .catch((err) => {
          setNumberState('error')
          setNumberMessage(
            err instanceof Error
              ? err.message
              : 'Die Artikelnummer konnte nicht geprüft werden.',
          )
        })
    }, CHECK_DEBOUNCE_MS)
  }

  // ---- Dateien: Einrichteplan und Bilder in **einem** Feld (DEC-060) ----
  // Die Dateien werden hier nur auseinandersortiert: der Plan geht als `file`,
  // die Bilder als `images` – verschickt wird beides zusammen in einer Anfrage.
  const onDocsDrop = useCallback((acceptedFiles: File[]) => {
    const plaene = acceptedFiles.filter(isPlan)
    const bilder = acceptedFiles.filter((selected) => !isPlan(selected) && isBild(selected))
    if (plaene.length === 0 && bilder.length === 0) {
      setError('Bitte einen Einrichteplan (PDF) oder Bilder auswählen.')
      return
    }

    // Mehrere Pläne je Artikel sind erlaubt (DEC-062): alle kommen hinzu.
    if (plaene.length > 0) {
      setNewPlans((current) => [...current, ...plaene])
    }
    if (bilder.length > 0) {
      setNewImages((current) => [...current, ...bilder])
    }
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDocsDrop,
    multiple: true,
    accept: DOC_ACCEPT,
  })

  // Vorschau der neu gewählten Bilder; die Objekt-URLs werden beim Wechsel
  // (und beim Verlassen des Formulars) wieder freigegeben.
  const imagePreviews = useMemo(
    () => newImages.map((bild) => ({ file: bild, url: URL.createObjectURL(bild) })),
    [newImages],
  )
  useEffect(() => {
    return () => {
      imagePreviews.forEach((entry) => URL.revokeObjectURL(entry.url))
    }
  }, [imagePreviews])

  /** Eine hinterlegte Datei sofort entfernen (nur Admin, DEC-062). */
  async function entferneDatei(name: string) {
    if (!initial) return
    setLoeschend(name)
    setError(null)
    try {
      await deleteSerialArticleFile(initial.id, name)
      setGeloeschteDateien((current) => [...current, name])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Die Datei konnte nicht entfernt werden. Versuche es erneut.',
      )
    } finally {
      setLoeschend(null)
    }
  }

  // ---- Speichern ----
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const number = articleNumber.trim()
    if (!number) {
      setError('Bitte eine Artikelnummer angeben.')
      return
    }
    if (numberState === 'taken') {
      setError(numberMessage || 'Diese Artikelnummer ist bereits vergeben.')
      return
    }
    if (!plantId) {
      setError('Bitte ein Werk auswählen.')
      return
    }

    const payload: SerialArticleInput = {
      article_number: number,
      name: name.trim() || null,
      plant_id: Number(plantId),
      customer_id: customerId ? Number(customerId) : null,
      machine_id: machineId ? Number(machineId) : null,
      description: description.trim() || null,
    }

    setSaving(true)
    try {
      const saved = editing && initial
        ? await updateSerialArticle(initial.id, payload, newPlans, newImages)
        : await createSerialArticle(payload, newPlans, newImages)
      onNotify?.(
        'success',
        editing
          ? `Serienartikel „${saved.article_number}“ wurde geändert.`
          : `Serienartikel „${saved.article_number}“ wurde angelegt.`,
      )
      onSaved?.(saved)

      if (!editing) {
        // Der Reiter bleibt offen: der nächste Plan kann direkt folgen.
        // Werk/Kunde/Maschine bleiben stehen, der Rest wird leer.
        setArticleNumber('')
        setName('')
        setDescription('')
        setNewPlans([])
        setNewImages([])
        setNumberState('idle')
        setNumberMessage('')
      } else {
        setNewPlans([])
        setNewImages([])
      }
    } catch (err) {
      // **Eine** Rückmeldung: der Toast. Vorher stand derselbe Fehler zusätzlich
      // als Block im Formular (doppelt). Feldprüfungen bleiben am Feld – sie
      // sagen, **welches** Feld fehlt; ein Toast taugt dafür nicht.
      setError(null)
      onNotify?.(
        'error',
        err instanceof Error
          ? err.message
          : 'Der Serienartikel konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Nur Maschinen des gewählten Werks anbieten (die Stammdaten führen sie so).
  const machineOptions = plantId
    ? machines.filter((machine) => String(machine.plant_id) === plantId)
    : []

  // Hinterlegte Dateien – in diesem Formular entfernte fallen sofort heraus.
  const storedPlans = (initial?.plans ?? []).filter(
    (eintrag) => !geloeschteDateien.includes(eintrag.name),
  )
  const storedImages = (initial?.images ?? []).filter(
    (eintrag) => !geloeschteDateien.includes(eintrag.name),
  )

  const body = (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
      {/* `noValidate`: Die Feldprüfung macht dieses Formular selbst, damit die
          Meldungen **deutsch** und in der Sprache der Oberfläche stehen. Ohne
          das Attribut hält der Browser das Absenden an und zeigt seinen eigenen
          Sprechblasentext („Please fill out this field") – die eigenen Meldungen
          wären nie zu sehen. Das Werkzeug-Formular macht es genauso. */}
      {metaError && (
        <div className="ui-alert ui-alert-error">
          <CircleXIcon className="h-4 w-4 shrink-0" />
          <div>{metaError}</div>
        </div>
      )}

      {/* Feldprüfung: sagt, **welches** Feld fehlt – steht oben im Formular,
          damit sie beim Absenden ohne Scrollen sichtbar ist. Alles, was der
          Server ablehnt, läuft dagegen als Toast (`onNotify`), nicht hier. */}
      {error && (
        <div className="ui-alert ui-alert-error">
          <CircleXIcon className="h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Felder mit Innenlabel (.ui-field, Guide §1.9) – wie im Werkzeugformular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="min-w-0">
          <div
            className={`ui-field ${
              numberState === 'taken' ? 'is-error' : numberState === 'free' ? 'is-ok' : ''
            }`}
          >
            <FieldLabel htmlFor={`${uid}-number`} required>
              Artikelnummer
            </FieldLabel>
            <input
              id={`${uid}-number`}
              type="text"
              value={articleNumber}
              onChange={(event) => {
                setArticleNumber(event.target.value)
                setError(null)
                scheduleNumberCheck(event.target.value)
              }}
              placeholder="z. B. 14592534"
              required
              aria-required
            />
            {numberState === 'checking' && (
              <span className="ui-spinner mr-3 h-3.5 w-3.5 self-center" />
            )}
          </div>
          {numberState === 'free' && (
            <FieldMessage tone="success">{numberMessage}</FieldMessage>
          )}
          {numberState === 'taken' && (
            <FieldMessage tone="error">{numberMessage}</FieldMessage>
          )}
          {numberState === 'error' && <FieldMessage>{numberMessage}</FieldMessage>}
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
            <input
              id={`${uid}-name`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Platte"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-plant`} required>
              Werk
            </FieldLabel>
            <select
              id={`${uid}-plant`}
              value={plantId}
              onChange={(event) => {
                setPlantId(event.target.value)
                // Eine Maschine eines anderen Werks wäre falsch – deshalb leeren.
                setMachineId('')
              }}
              required
              aria-required
            >
              <option value="">Werk wählen</option>
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
            <FieldLabel htmlFor={`${uid}-customer`}>Kunde</FieldLabel>
            <select
              id={`${uid}-customer`}
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">— kein Kunde —</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
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
              <option value="">{plantId ? '— keine Maschine —' : 'zuerst Werk wählen'}</option>
              {machineOptions.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Beschreibung – mehrzeiliges Feld zum Schreiben */}
      <div>
        <FieldLabel htmlFor={`${uid}-description`} standalone>
          Beschreibung
        </FieldLabel>
        <textarea
          id={`${uid}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="textarea-bordered w-full resize-none text-base sm:text-sm"
          placeholder="Zusätzliche Informationen"
        />
      </div>

      {/* Einrichteplan und Bilder: **ein** Feld für alles (DEC-060).
          Die Dateien werden beim Auswählen auseinandersortiert. */}
      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-700">
          Einrichteplan (PDF) und Bilder
        </span>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors ${
            isDragActive
              ? 'border-teal-700 bg-teal-700/10'
              : 'border-white/80 bg-white/40 hover:border-teal-700/50 hover:bg-white/60'
          }`}
        >
          <input
            {...getInputProps()}
            aria-label="Einrichteplan oder Bilder auswählen"
          />
          <UploadIcon className="mx-auto mb-1 h-6 w-6 text-teal-800" />
          <p className="text-slate-600">
            {isDragActive
              ? 'Dateien hier ablegen …'
              : 'PDF und Bilder hierher ziehen oder auswählen (mehrere möglich)'}
          </p>
        </div>

        {/* Hinterlegte Dateien: sichtbar und **einzeln löschbar** (DEC-062).
            Kein Hinweistext mehr – die Liste zeigt den echten Zustand. */}
        {(storedPlans.length > 0 || storedImages.length > 0) && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-slate-700">Hinterlegte Dateien</p>
            <ul className="space-y-1">
              {storedPlans.map((eintrag) => (
                <li
                  key={eintrag.name}
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/40 px-2 py-1.5 text-sm"
                >
                  <SerialIcon className="h-4 w-4 shrink-0 text-rose-700" />
                  <span className="min-w-0 flex-1 truncate text-slate-900">
                    {eintrag.name}
                    <span className="ml-2 text-xs text-slate-600">
                      Einrichteplan · {(eintrag.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void entferneDatei(eintrag.name)
                    }}
                    disabled={loeschend === eintrag.name}
                    aria-label={`Einrichteplan ${eintrag.name} löschen`}
                    className="ui-btn ui-btn-danger-soft ui-btn-sm shrink-0"
                  >
                    {loeschend === eintrag.name ? 'Wird gelöscht …' : 'Löschen'}
                  </button>
                </li>
              ))}

              {storedImages.map((eintrag) => (
                <li
                  key={eintrag.name}
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/40 px-2 py-1.5 text-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/80 bg-white/60 text-xs text-slate-600">
                    Bild
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">
                    {eintrag.name}
                    <span className="ml-2 text-xs text-slate-600">
                      Bild · {(eintrag.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void entferneDatei(eintrag.name)
                    }}
                    disabled={loeschend === eintrag.name}
                    aria-label={`Bild ${eintrag.name} löschen`}
                    className="ui-btn ui-btn-danger-soft ui-btn-sm shrink-0"
                  >
                    {loeschend === eintrag.name ? 'Wird gelöscht …' : 'Löschen'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Neu ausgewählte Dateien – vor dem Speichern einzeln entfernbar. */}
        {(newPlans.length > 0 || imagePreviews.length > 0) && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-slate-700">
              Kommt beim Speichern dazu
            </p>
            <ul className="space-y-1">
              {newPlans.map((plan, index) => (
                <li
                  key={`${plan.name}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/60 px-2 py-1.5 text-sm"
                >
                  <SerialIcon className="h-4 w-4 shrink-0 text-rose-700" />
                  <span className="min-w-0 flex-1 truncate text-slate-900">
                    {plan.name}
                    <span className="ml-2 text-xs text-slate-600">
                      Einrichteplan · {(plan.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewPlans((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Einrichteplan ${plan.name} entfernen`}
                    className="shrink-0 rounded px-1 text-xs font-bold text-rose-700"
                  >
                    ✕
                  </button>
                </li>
              ))}

              {imagePreviews.map((entry, index) => (
                <li
                  key={`${entry.file.name}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/60 px-2 py-1.5 text-sm"
                >
                  <img
                    src={entry.url}
                    alt={`Vorschau ${entry.file.name}`}
                    className="h-9 w-9 shrink-0 rounded-md border border-white/80 object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-900">
                    {entry.file.name}
                    <span className="ml-2 text-xs text-slate-600">
                      Bild · {(entry.file.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewImages((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Bild ${entry.file.name} entfernen`}
                    className="shrink-0 rounded px-1 text-xs font-bold text-rose-700"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-1 text-xs text-slate-600">
          {storedPlans.length + storedImages.length > 0 || newPlans.length + imagePreviews.length > 0
            ? 'Vorhandene Dateien bleiben erhalten, bis du sie löschst; neue kommen hinzu.'
            : 'Mehrere Einrichtepläne und mehrere Bilder je Artikel sind möglich.'}
        </p>
      </div>

      {/* Rückmeldung läuft als Toast (siehe `onNotify` in App.tsx) – hier steht
          keine Meldung mehr, sonst erschiene derselbe Erfolg zweimal. */}

      <div className="flex justify-end border-t border-white/60 pt-4">
        <button type="submit" disabled={saving} className="ui-btn ui-btn-primary">
          {saving ? (
            <span className="ui-spinner h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
          {saving
            ? 'Wird gespeichert …'
            : editing
              ? 'Änderungen speichern'
              : 'Serienartikel anlegen'}
        </button>
      </div>
    </form>
  )

  return <div>{body}</div>
}
