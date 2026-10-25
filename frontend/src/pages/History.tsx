// Bereich „Historie" (DEC-094) – der Verlauf aller Werkzeugbewegungen.
//
// Bis hier stand im Reiter nur ein Platzhalter („Hier erscheinen später alle
// Werkzeugbewegungen"). Die Bewegungen wurden aber längst geschrieben: Ausleihe,
// Rückgabe, Umbuchung, Statuswechsel – jede mit Werkzeug, Person, Arbeitswerk
// (DEC-070) und Zeitpunkt. Dieser Bereich zeigt sie mit **Suche, Vorgangs- und
// Zeitraumfilter, Werk-Umschalter und Seiten**.
//
// Bewusst eine **Liste**, keine Auswertung: Zahlen (was ist draußen, was liegt zu
// lange) stehen in der Logistik und in der rechten Spalte (DEC-089/092). Hier geht
// es um die Frage „was ist passiert".

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useActivePlantId } from '../lib/activePlant'
import { usePlants } from '../lib/plantTheme'
import { getMovementHistory } from '../api/movements'
import { werkzeuge as werkzeugAnzahl } from '../lib/format'
import { SearchIcon, XIcon } from '../components/icons'
import ToolPagination from '../components/tools/ToolPagination'
import Tooltip from '../components/ui/Tooltip'
import type { MovementType, ToolMovement } from '../types/movement'
import { MOVEMENT_TYPE_LABELS } from '../types/movement'
import type { Plant } from '../api/types'
import {
  WerkName,
  formatZeitpunkt,
  useWerkFarben,
  werkZeile,
} from '../components/logistics/logistikTeile'

/** Vorgänge in der Reihenfolge, in der sie im Alltag vorkommen. */
const ARTEN: MovementType[] = ['lend', 'return', 'relocate', 'status_change', 'transfer']

/** Zeitraum-Stufen (in Tagen; `alle` = kein Filter). */
type Zeitraum = 'alle' | '7' | '30' | '90'

const ZEITRAEUME: { wert: Zeitraum; text: string }[] = [
  { wert: 'alle', text: 'Alle' },
  { wert: '7', text: '7 Tage' },
  { wert: '30', text: '30 Tage' },
  { wert: '90', text: '90 Tage' },
]

/** Farbton je Vorgang – dieselbe Sprache wie die Zustandsmarken der Logistik. */
const ART_TON: Record<MovementType, string> = {
  lend: 'bg-sky-500/15 text-sky-800 ring-1 ring-sky-500/25',
  return: 'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25',
  relocate: 'bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/25',
  status_change: 'bg-amber-500/18 text-amber-900 ring-1 ring-amber-500/30',
  transfer: 'bg-teal-500/15 text-teal-800 ring-1 ring-teal-500/25',
}

interface HistoryProps {
  /** Wechsel des Arbeitswerks oder abgeschlossener Vorgang: Liste neu laden. */
  refreshKey: number
}

export default function History({ refreshKey }: HistoryProps) {
  const { user } = useAuth()
  const plants = usePlants()
  const aktivId = useActivePlantId(user?.id ?? null, user?.plant_id ?? null)
  const werk: Plant | null = plants.find((p) => p.id === aktivId) ?? null
  const werkFarbe = useWerkFarben()

  const [suche, setSuche] = useState('')
  const [suchbegriff, setSuchbegriff] = useState('')
  const [arten, setArten] = useState<MovementType[]>([])
  const [zeitraum, setZeitraum] = useState<Zeitraum>('alle')
  /** Standard: nur das eigene Arbeitswerk – die Bewegungen anderer Werke sind
   *  für den Alltag Rauschen, aber mit einem Klick sichtbar. */
  const [alleWerke, setAlleWerke] = useState(false)
  const [seite, setSeite] = useState(1)
  const [proSeite, setProSeite] = useState(25)

  const [zeilen, setZeilen] = useState<ToolMovement[]>([])
  const [gesamt, setGesamt] = useState(0)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  // Suche erst nach kurzer Pause – sonst eine Anfrage je Tastendruck.
  useEffect(() => {
    const takt = window.setTimeout(() => {
      setSuchbegriff(suche.trim())
      setSeite(1)
    }, 300)
    return () => window.clearTimeout(takt)
  }, [suche])

  const lade = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const von = zeitraum === 'alle' ? undefined : tageZurueck(Number(zeitraum))
      const antwort = await getMovementHistory({
        types: arten.length ? arten : undefined,
        q: suchbegriff || undefined,
        von,
        plant_id: alleWerke || aktivId === null ? undefined : aktivId,
        skip: (seite - 1) * proSeite,
        limit: proSeite,
      })
      setZeilen(antwort.items)
      setGesamt(antwort.total)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Verlauf konnte nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [arten, suchbegriff, zeitraum, alleWerke, aktivId, seite, proSeite])

  useEffect(() => {
    void lade()
  }, [lade, refreshKey])

  const filterAktiv = suchbegriff !== '' || arten.length > 0 || zeitraum !== 'alle' || alleWerke

  const seiten = Math.max(1, Math.ceil(gesamt / proSeite))
  const vonZeile = gesamt === 0 ? 0 : (seite - 1) * proSeite + 1
  const bisZeile = Math.min(seite * proSeite, gesamt)

  const zahlen = useMemo(() => {
    const nach: Record<string, number> = {}
    for (const zeile of zeilen) nach[zeile.movement_type] = (nach[zeile.movement_type] ?? 0) + 1
    return nach
  }, [zeilen])

  function artUmschalten(art: MovementType) {
    setSeite(1)
    setArten((alt) => (alt.includes(art) ? alt.filter((wert) => wert !== art) : [...alt, art]))
  }

  function zuruecksetzen() {
    setSuche('')
    setArten([])
    setZeitraum('alle')
    setAlleWerke(false)
    setSeite(1)
  }

  return (
    <div className="space-y-4">
      {/* Kopf: Titel und Erklärung */}
      <div className="app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Historie</h2>
          <span className="text-xs text-slate-600">
            {gesamt === 0 ? 'keine Bewegung' : `${vonZeile}–${bisZeile} von ${gesamt}`}
            {filterAktiv ? ' (gefiltert)' : ''}
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Jede Bewegung eines Werkzeugs: Ausleihe, Rückgabe, Umbuchung, Statuswechsel –
          mit Person, Arbeitswerk und Zeitpunkt (DEC-070/078).{' '}
          {alleWerke ? (
            <strong>Alle Werke sind eingeblendet.</strong>
          ) : (
            <>
              Angezeigt wird <strong>{werk?.name ?? 'das Arbeitswerk'}</strong>.
            </>
          )}
        </p>

        {/* Suche und Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suche: Werkzeug-ID, Beschreibung, Person, Ort, Notiz …"
              aria-label="Verlauf durchsuchen"
              className="input-bordered w-full pl-8 text-sm"
            />
          </div>

          <div className="ui-tabs" role="group" aria-label="Zeitraum">
            {ZEITRAEUME.map((stufe) => (
              <button
                key={stufe.wert}
                type="button"
                className={zeitraum === stufe.wert ? 'is-active' : undefined}
                aria-pressed={zeitraum === stufe.wert}
                onClick={() => {
                  setZeitraum(stufe.wert)
                  setSeite(1)
                }}
              >
                {stufe.text}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={alleWerke}
              onChange={(e) => {
                setAlleWerke(e.target.checked)
                setSeite(1)
              }}
              className="h-4 w-4 rounded accent-teal-700"
            />
            alle Werke
          </label>

          {filterAktiv && (
            <Tooltip text="Suche und Filter zurücksetzen">
              <button
                type="button"
                onClick={zuruecksetzen}
                className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1"
              >
                <XIcon className="h-3.5 w-3.5" />
                zurücksetzen
              </button>
            </Tooltip>
          )}
        </div>

        {/* Vorgangsarten als Mehrfachauswahl */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vorgang">
          {ARTEN.map((art) => {
            const aktiv = arten.includes(art)
            return (
              <button
                key={art}
                type="button"
                aria-pressed={aktiv}
                onClick={() => artUmschalten(art)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  aktiv ? ART_TON[art] : 'bg-white/50 text-slate-600 ring-1 ring-white/70'
                }`}
              >
                {MOVEMENT_TYPE_LABELS[art]}
                {zahlen[art] ? ` (${zahlen[art]})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {fehler && (
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>{fehler}</div>
        </div>
      )}

      {/* Tabelle */}
      <div className="app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
        <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[820px] text-left text-xs" aria-busy={laden}>
            <caption className="sr-only">Verlauf der Werkzeugbewegungen</caption>
            <thead className="bg-white/60 text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-2.5 py-2 font-semibold">Zeit</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Werkzeug</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Vorgang</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">von → nach</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Person</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Arbeitswerk</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Notiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {laden && (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-slate-600">
                    Verlauf wird geladen …
                  </td>
                </tr>
              )}
              {!laden && zeilen.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-slate-600">
                    {filterAktiv
                      ? 'Keine Bewegung passt zu dieser Auswahl.'
                      : 'Noch keine Bewegung verzeichnet.'}
                  </td>
                </tr>
              )}
              {zeilen.map((zeile) => (
                <tr
                  key={zeile.id}
                  className="werk-zeile"
                  style={werkZeile(werkFarbe(zeile.plant?.id))}
                >
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-700">
                    {formatZeitpunkt(zeile.timestamp)}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex flex-col gap-0.5">
                      <code className="font-mono text-xs font-bold text-slate-900">
                        {zeile.tool_code ?? `#${zeile.tool_id}`}
                      </code>
                      {zeile.tool_description && (
                        <span className="text-[11px] text-slate-600">
                          {zeile.tool_description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ART_TON[zeile.movement_type] ?? ''
                      }`}
                    >
                      {MOVEMENT_TYPE_LABELS[zeile.movement_type] ?? zeile.movement_type}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span className="font-mono text-[11px] text-slate-700">
                      {zeile.from_location ?? '—'} → {zeile.to_location ?? '—'}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-800">
                    {zeile.user_display_name ?? '—'}
                  </td>
                  <td className="px-2.5 py-1.5">
                    {zeile.plant ? (
                      <WerkName plant={zeile.plant} />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-600">{zeile.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {gesamt > 0 && (
          <ToolPagination
            total={gesamt}
            page={seite}
            pageSize={proSeite}
            busy={laden}
            ariaLabel="Seitennavigation des Verlaufs"
            itemSingular="Bewegung"
            itemPlural="Bewegungen"
            onPageChange={setSeite}
            onPageSizeChange={(groesse) => {
              setProSeite(groesse)
              setSeite(1)
            }}
          />
        )}

        <p className="text-[11px] text-slate-600">
          {werkzeugAnzahl(gesamt)} {gesamt === 1 ? 'Bewegung' : 'Bewegungen'} insgesamt
          {seiten > 1 ? ` · ${seiten} Seiten` : ''}. Der Verlauf wird nicht bearbeitet –
          er ist der Nachweis (DEC-072).
        </p>
      </div>
    </div>
  )
}

/** `YYYY-MM-DD` von vor `tage` Tagen (für den Zeitraum-Filter). */
function tageZurueck(tage: number): string {
  const zeit = new Date(Date.now() - tage * 86_400_000)
  return zeit.toISOString().slice(0, 10)
}
