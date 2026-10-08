import { useEffect, useId, useState, type FormEvent } from 'react'

import { getCabinets, getDrawers, getPositions, getPositionContext } from '../../api/locations'
import type { Cabinet, Drawer, Position } from '../../api/locations'
import { getMachines } from '../../api/masterData'
import { getPlants } from '../../api/tools'
import { checkSparePartNumber, createSparePart, updateSparePart } from '../../api/spareParts'
import type { Machine, Plant } from '../../api/types'
import type { SparePart, SparePartInput } from '../../types/spare-part'
import { CheckIcon, CircleXIcon } from '../icons'
import { FieldLabel, FieldMessage, FormSection } from '../Field'

interface SparePartFormProps {
  /** null = anlegen, sonst bearbeiten. */
  initial?: SparePart | null
  /**
   * Vorbelegung aus dem Werkzeugformular – nur beim Anlegen und nur beim Öffnen.
   * Beim Werkzeug gibt es kein Werk-Feld mit Maschinenbezug, deshalb kommt hier
   * höchstens das Werk an; spätere Änderungen am Werkzeug ändern das Ersatzteil
   * nicht (dieselbe Regel wie beim Serienartikel, DEC-056 Punkt 6).
   */
  prefill?: {
    plantId?: number | null
    machineId?: number | null
  }
  onSaved?: (part: SparePart) => void
  /** Meldung anzeigen (Toast) – **eine** Quelle, siehe `onNotify` in App.tsx. */
  onNotify?: (variant: 'success' | 'error', title: string) => void
}

/** Wartezeit der Live-Prüfung der Artikelnummer (wie beim Werkzeug, DEC-054). */
const CHECK_DEBOUNCE_MS = 400

/**
 * Formular für ein Ersatzteil (DEC-064).
 *
 * Aufbau wie das Serienartikel-Formular: **Innenlabel** (`.ui-field`,
 * Guide §1.9), Meldungen direkt am Feld, Speichern unabhängig vom Werkzeug.
 * Der Unterschied liegt im Inhalt: statt „Artikelnummer (eindeutig), Werk, Kunde,
 * Maschine" gibt es **Artikelnummer (mehrfach erlaubt), Werk, Menge + Einheit,
 * Maschine und Lagerort**.
 *
 * **Ausnahme vom Innenlabel:** Die Felder der Gruppe „Lagerort" (Freitext,
 * Schrank, Schublade, Platz) tragen ihre Beschriftung **über** dem Feld – wie
 * der Lagerplatz im Werkzeugformular. In einer dreispaltigen Reihe bliebe dem
 * Select neben einem 7,5-rem-Innenlabel zu wenig Platz (Guide §1.9 Ausnahme 11).
 *
 * Die Artikelnummer ist die Identität, aber **nicht eindeutig**: mehrere Zeilen
 * mit derselben Nummer sind der Normalfall (mehrere Lagerorte, mehrere Chargen).
 * Die Live-Prüfung sagt deshalb nur, wie oft es die Nummer schon gibt – sie
 * blockiert das Speichern nicht.
 */
export default function SparePartForm({ initial = null, prefill, onSaved, onNotify }: SparePartFormProps) {
  const uid = useId()

  const [articleNumber, setArticleNumber] = useState(initial?.article_number ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? '')
  const [plantId, setPlantId] = useState(
    initial?.plant_id != null
      ? String(initial.plant_id)
      : prefill?.plantId != null
        ? String(prefill.plantId)
        : '',
  )
  const [machineId, setMachineId] = useState(
    initial?.machine_id != null ? String(initial.machine_id) : '',
  )
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1))
  const [unit, setUnit] = useState(initial?.unit ?? 'Stk')
  const [storagePlace, setStoragePlace] = useState(initial?.storage_place ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  // Matrix-Platz: Schrank → Schublade → Platz. Der Platz gilt als belegt
  // (DEC-064), deshalb werden nur **freie** Plätze angeboten.
  const [cabinetId, setCabinetId] = useState('')
  const [drawerId, setDrawerId] = useState('')
  const [positionId, setPositionId] = useState(
    initial?.position_id != null ? String(initial.position_id) : '',
  )
  const [cabinets, setCabinets] = useState<Cabinet[]>([])
  const [drawers, setDrawers] = useState<Drawer[]>([])
  const [freePositions, setFreePositions] = useState<Position[]>([])

  const [plants, setPlants] = useState<Plant[]>([])
  const [machines, setMachines] = useState<Machine[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numberMessage, setNumberMessage] = useState('')
  const [numberChecking, setNumberChecking] = useState(false)

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

  // Maschinen gehören zu einem Werk: bei Werkwechsel neu laden und die Auswahl
  // zurücksetzen, damit keine Maschine aus einem anderen Werk stehen bleibt.
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

  // Schränke des gewählten Werks. Alles läuft im Zeitgeber – der Effektkörper
  // bleibt dadurch frei von sofortigen Zustandsänderungen (wie in den Listen).
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!plantId) {
        setCabinets([])
        return
      }
      getCabinets(Number(plantId))
        .then((list) => {
          if (!cancelled) setCabinets(list)
        })
        .catch(() => {
          if (!cancelled) setCabinets([])
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [plantId])

  // Schubladen des gewählten Schranks.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cabinetId) {
        setDrawers([])
        return
      }
      getDrawers(Number(cabinetId))
        .then((list) => {
          if (!cancelled) setDrawers(list)
        })
        .catch(() => {
          if (!cancelled) setDrawers([])
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cabinetId])

  // Nur **freie** Plätze: kein Werkzeug darauf (`tool_id`) und kein Ersatzteil
  // (`spare_part`). Beim Bearbeiten bleibt der eigene Platz in der Liste, sonst
  // verschwindet die Auswahl (dieselbe Regel wie im Werkzeugformular).
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!drawerId) {
        setFreePositions([])
        return
      }
      getPositions(Number(drawerId))
        .then((allPos) => {
          if (!cancelled) {
            setFreePositions(
              allPos.filter(
                (p) =>
                  (p.tool_id === null && !p.spare_part) ||
                  p.id === initial?.position_id,
              ),
            )
          }
        })
        .catch(() => {
          if (!cancelled) setFreePositions([])
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [drawerId, initial?.position_id])

  // Beim Bearbeiten den vorhandenen Platz auflösen (Platz → Schublade → Schrank),
  // damit die Auswahlfelder gefüllt sind.
  useEffect(() => {
    if (initial?.position_id == null) return
    let cancelled = false
    getPositionContext(initial.position_id)
      .then((context) => {
        if (cancelled) return
        setCabinetId(String(context.cabinet_id))
        setDrawerId(String(context.drawer_id))
      })
      .catch(() => {
        // Ohne Kontext bleiben die Auswahlfelder leer – der Platz bleibt trotzdem
        // gespeichert (er wird nur nicht angezeigt).
      })
    return () => {
      cancelled = true
    }
  }, [initial?.position_id])

  // Live-Prüfung: 400 ms nach dem Tippen. Sie ist ein **Hinweis**, kein Verbot.
  // Alles läuft im Zeitgeber – so bleibt der Effektkörper frei von sofortigen
  // Zustandsänderungen, und beim Leeren des Feldes verschwindet der Hinweis
  // zusammen mit dem nächsten Durchlauf.
  useEffect(() => {
    const value = articleNumber.trim()
    let cancelled = false
    const timer = setTimeout(() => {
      if (!value) {
        setNumberMessage('')
        setNumberChecking(false)
        return
      }
      setNumberChecking(true)
      checkSparePartNumber(value, initial?.id)
        .then((result) => {
          if (!cancelled) setNumberMessage(result.message)
        })
        .catch(() => {
          if (!cancelled) setNumberMessage('')
        })
        .finally(() => {
          if (!cancelled) setNumberChecking(false)
        })
    }, CHECK_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [articleNumber, initial?.id])

  function handlePlantChange(value: string) {
    setPlantId(value)
    setMachineId('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const number = articleNumber.trim()
    if (!number) {
      setError('Bitte eine Artikelnummer angeben.')
      return
    }
    if (!plantId) {
      setError('Bitte ein Werk auswählen.')
      return
    }

    // Die Menge kommt aus einem Textfeld: „" bedeutet 1, „-2" ist ungültig.
    const rawQuantity = quantity.trim()
    const parsedQuantity = rawQuantity === '' ? 1 : Number(rawQuantity.replace(',', '.'))
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      setError('Die Menge muss eine ganze Zahl sein und darf nicht negativ sein.')
      return
    }

    const payload: SparePartInput = {
      article_number: number,
      name: name.trim() || null,
      type: type.trim() || null,
      plant_id: Number(plantId),
      quantity: parsedQuantity,
      unit: unit.trim() || null,
      machine_id: machineId ? Number(machineId) : null,
      storage_place: storagePlace.trim() || null,
      position_id: positionId ? Number(positionId) : null,
      description: description.trim() || null,
    }

    setSaving(true)
    try {
      const saved = initial
        ? await updateSparePart(initial.id, payload)
        : await createSparePart(payload)

      onNotify?.(
        'success',
        initial
          ? `Ersatzteil „${saved.article_number}“ wurde geändert.`
          : `Ersatzteil „${saved.article_number}“ wurde angelegt.`,
      )

      if (!initial) {
        // Der Reiter bleibt offen: das nächste Teil kann direkt folgen.
        // Werk und Maschine bleiben stehen, der Rest wird geleert.
        setArticleNumber('')
        setName('')
        setType('')
        setQuantity('1')
        setUnit('Stk')
        setStoragePlace('')
        setPositionId('')
        setDescription('')
        setNumberMessage('')
      }
      onSaved?.(saved)
    } catch (err) {
      // **Eine** Rückmeldung: der Toast (vorher zusätzlich als Block im
      // Formular – derselbe Fehler erschien zweimal).
      setError(null)
      onNotify?.(
        'error',
        err instanceof Error
          ? err.message
          : 'Das Ersatzteil konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
      {/* `noValidate`: Die Feldprüfung macht dieses Formular selbst (siehe
          `handleSubmit`), damit die Meldungen **deutsch** und in der Sprache der
          Oberfläche stehen. Ohne das Attribut hält der Browser das Absenden an
          und zeigt seinen eigenen, englischen Sprechblasentext – die eigenen
          Meldungen wären dann nie zu sehen. Das Werkzeug-Formular macht es
          genauso. */}
      {/* Feldprüfung: sagt, **welches** Feld fehlt (Toast taugt dafür nicht). */}
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
              }}
              placeholder="z. B. 4711-040"
              required
              aria-required
            />
            {numberChecking && <span className="ui-spinner mr-3 h-3.5 w-3.5 self-center" />}
          </div>
          {numberMessage && <FieldMessage>{numberMessage}</FieldMessage>}
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-type`}>Typ</FieldLabel>
            <input
              id={`${uid}-type`}
              type="text"
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="z. B. Dichtung, Sensor, Normteil"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
            <input
              id={`${uid}-name`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Dichtung Ø40"
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
              onChange={(event) => handlePlantChange(event.target.value)}
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
            {/* Kurze Beschriftung: das Innenlabel ist 7,5 rem breit und schneidet
                ab (Guide §1.9 Regel 2). Die Bedeutung von 0 steht darunter. */}
            <FieldLabel htmlFor={`${uid}-quantity`}>Menge</FieldLabel>
            <input
              id={`${uid}-quantity`}
              type="number"
              min={0}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-describedby={`${uid}-quantity-hint`}
            />
          </div>
          <FieldMessage id={`${uid}-quantity-hint`}>0 bedeutet: aufgebraucht.</FieldMessage>
        </div>

        <div className="min-w-0">
          <div className="ui-field">
            <FieldLabel htmlFor={`${uid}-unit`}>Einheit</FieldLabel>
            <input
              id={`${uid}-unit`}
              type="text"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="Stk, m, kg …"
            />
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
              <option value="">{plantId ? 'keine Maschine' : 'zuerst Werk wählen'}</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lagerort als eigene Gruppe – dasselbe Muster wie „Lagerplatz" im
          Werkzeugformular. Vorher standen diese drei Felder ohne Gruppe mitten
          im Feldraster, obwohl es dieselbe Sache ist.

          Die Beschriftungen stehen **über** den Feldern, nicht darin: In einer
          dreispaltigen Reihe bliebe dem Select neben einem 7,5-rem-Innenlabel
          zu wenig Platz (Guide §1.9 Ausnahme 11) – das Werkzeugformular macht
          es bei Schrank/Schublade/Platz genauso. */}
      <FormSection title="Lagerort" optional>
        <div className="grid grid-cols-1 gap-3">
          <div className="min-w-0">
            {/* „Freitext", nicht „Lagerort": die Beschriftung der Gruppe ist
                bereits „Lagerort", und die Zeile darunter erklaert den
                Unterschied zur Matrix. */}
            <FieldLabel htmlFor={`${uid}-place`} standalone>
              Freitext
            </FieldLabel>
            <input
              id={`${uid}-place`}
              type="text"
              value={storagePlace}
              onChange={(event) => setStoragePlace(event.target.value)}
              placeholder="z. B. Regal B3 / Fach 2"
              aria-describedby={`${uid}-place-hint`}
              className="input-bordered w-full text-base sm:text-sm"
            />
            <FieldMessage id={`${uid}-place-hint`}>
              Für Schütten und Fächer, die nicht in der Werkzeug-Matrix liegen.
            </FieldMessage>
          </div>

          {/* Lagerplatz aus der Werkzeug-Matrix – zusätzlich zum Freitext.
              Nur freie Plätze: ein Platz mit Werkzeug oder Ersatzteil ist belegt. */}
          <div className="min-w-0">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="min-w-0">
                <FieldLabel htmlFor={`${uid}-cabinet`} standalone>
                  Schrank
                </FieldLabel>
                <select
                  id={`${uid}-cabinet`}
                  value={cabinetId}
                  disabled={!plantId}
                  onChange={(event) => {
                    setCabinetId(event.target.value)
                    setDrawerId('')
                    setPositionId('')
                  }}
                  className="select-bordered w-full text-base sm:text-sm"
                >
                  {/* Die Abhängigkeit trägt der Optionstext, nicht ein Tooltip
                      (Guide §1.9 Regel 12). */}
                  <option value="">{plantId ? 'kein Schrank' : 'Bitte zuerst Werk wählen'}</option>
                  {cabinets.map((cabinet) => (
                    <option key={cabinet.id} value={cabinet.id}>
                      {cabinet.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <FieldLabel htmlFor={`${uid}-drawer`} standalone>
                  Schublade
                </FieldLabel>
                <select
                  id={`${uid}-drawer`}
                  value={drawerId}
                  disabled={!cabinetId}
                  onChange={(event) => {
                    setDrawerId(event.target.value)
                    setPositionId('')
                  }}
                  className="select-bordered w-full text-base sm:text-sm"
                >
                  <option value="">
                    {cabinetId ? 'keine Schublade' : 'Bitte zuerst Schrank wählen'}
                  </option>
                  {drawers.map((drawer) => (
                    <option key={drawer.id} value={drawer.id}>
                      {drawer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <FieldLabel htmlFor={`${uid}-position`} standalone>
                  Platz
                </FieldLabel>
                <select
                  id={`${uid}-position`}
                  value={positionId}
                  disabled={!drawerId}
                  onChange={(event) => setPositionId(event.target.value)}
                  className="select-bordered w-full text-base sm:text-sm"
                >
                  <option value="">
                    {!drawerId
                      ? 'Bitte zuerst Schublade wählen'
                      : freePositions.length === 0
                        ? 'Keine freien Plätze'
                        : 'kein Platz'}
                  </option>
                  {freePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <FieldMessage>
              Optionaler Platz aus der Werkzeug-Matrix. Der Platz gilt dann als{' '}
              <strong>belegt</strong>: Werkzeuge können dort nicht mehr abgelegt werden, und
              die Matrix zeigt das Ersatzteil.
            </FieldMessage>
          </div>
        </div>
      </FormSection>

      {/* Beschreibung – Beschriftung **über** dem Feld, mehrzeiliges Feld
          (dasselbe Muster wie im Serienartikel-Formular). */}
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

      <div className="flex justify-end border-t border-white/60 pt-4">
        <button type="submit" disabled={saving} className="ui-btn ui-btn-primary">
          {saving ? (
            <span className="ui-spinner h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
          {saving ? 'Wird gespeichert …' : initial ? 'Änderungen speichern' : 'Ersatzteil anlegen'}
        </button>
      </div>
    </form>
  )
}
