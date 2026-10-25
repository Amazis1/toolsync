// „Wo ist was" (DEC-077) – die Antwort auf „wo sind meine Sachen gerade".
//
// Gezeigt wird **nur**, was nicht am Platz liegt: unterwegs zwischen Werken oder
// an eine Person ausgeliehen. Eingelagerte Werkzeuge stehen in der Werkzeugliste –
// sie hier zu wiederholen würde die Tabelle unbrauchbar machen. Der Heimatplatz
// bleibt sichtbar, aber als reserviert, nicht als Fundort.
//
// Seit DEC-093 lässt sich die Liste durchsuchen und filtern, und jede Zeile sagt
// **seit wann** das Werkzeug draußen ist: Genau das ist die Frage, die diese
// Ansicht beantworten soll („was liegt bei wem, und wie lange schon?").

import { useEffect, useMemo, useState } from 'react'
import { getAwayTools } from '../../api/transport'
import type { AwayTool } from '../../types/transport'
import { AlertCircleIcon, SearchIcon, XIcon } from '../icons'
import Tooltip from '../ui/Tooltip'
import {
  AlterMarke,
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  WerkzeugMarke,
  alterTage,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

type Umfang = 'alle' | 'unterwegs' | 'ausgeliehen'

/** Ab so vielen Tagen gilt ein Werkzeug als „zu lange draußen" (wie DEC-092). */
const LANGE_DRAUSSEN = 7

interface AwayTableProps {
  refreshKey: number
  onOpenOrder: (orderId: number) => void
}

export default function AwayTable({ refreshKey, onOpenOrder }: AwayTableProps) {
  const werkFarbe = useWerkFarben()
  const [werkzeuge, setWerkzeuge] = useState<AwayTool[]>([])
  const [umfang, setUmfang] = useState<Umfang>('alle')
  const [suche, setSuche] = useState('')
  const [werkFilter, setWerkFilter] = useState<number | null>(null)
  const [nurLange, setNurLange] = useState(false)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let gilt = true
    setLaden(true)
    setFehler(null)
    getAwayTools()
      .then((liste) => {
        if (gilt) setWerkzeuge(liste)
      })
      .catch((e: unknown) => {
        if (gilt) setFehler(e instanceof Error ? e.message : 'Die Liste konnte nicht geladen werden.')
      })
      .finally(() => {
        if (gilt) setLaden(false)
      })
    return () => {
      gilt = false
    }
  }, [refreshKey])

  const zahlen = useMemo(
    () => ({
      unterwegs: werkzeuge.filter((werkzeug) => werkzeug.status === 'in_transit').length,
      ausgeliehen: werkzeuge.filter((werkzeug) => werkzeug.status === 'lent').length,
      lange: werkzeuge.filter((werkzeug) => {
        const tage = alterTage(werkzeug.since)
        return tage !== null && tage >= LANGE_DRAUSSEN
      }).length,
    }),
    [werkzeuge],
  )

  /** Heimatwerke, die in der Liste vorkommen – Grundlage der Werk-Auswahl. */
  const heimatwerke = useMemo(() => {
    const gefunden = new Map<number, string>()
    for (const werkzeug of werkzeuge) {
      if (werkzeug.home_plant) gefunden.set(werkzeug.home_plant.id, werkzeug.home_plant.name)
    }
    return [...gefunden.entries()].map(([id, name]) => ({ id, name }))
  }, [werkzeuge])

  const zeilen = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    const treffer = werkzeuge.filter((werkzeug) => {
      if (umfang === 'unterwegs' && werkzeug.status !== 'in_transit') return false
      if (umfang === 'ausgeliehen' && werkzeug.status !== 'lent') return false
      if (werkFilter !== null && werkzeug.home_plant?.id !== werkFilter) return false
      if (nurLange) {
        const tage = alterTage(werkzeug.since)
        if (tage === null || tage < LANGE_DRAUSSEN) return false
      }
      if (!begriff) return true
      // Gesucht werden alle Angaben der Zeile – auch die Person und der Auftrag.
      const heu = [
        werkzeug.tool_code,
        werkzeug.description,
        werkzeug.category,
        werkzeug.tool_type,
        werkzeug.measure_a,
        werkzeug.home_plant?.name,
        werkzeug.home_position_code,
        werkzeug.current_plant?.name,
        werkzeug.target_plant?.name,
        werkzeug.lent_to,
        werkzeug.transport_number,
      ]
      return heu.some((wert) => (wert ?? '').toLowerCase().includes(begriff))
    })
    // Am längsten draußen zuerst – das ist die Frage dieser Ansicht.
    return treffer.sort((a, b) => {
      const zeitA = a.since ? new Date(a.since).getTime() : Number.MAX_SAFE_INTEGER
      const zeitB = b.since ? new Date(b.since).getTime() : Number.MAX_SAFE_INTEGER
      if (zeitA !== zeitB) return zeitA - zeitB
      return (a.tool_code ?? '').localeCompare(b.tool_code ?? '')
    })
  }, [werkzeuge, umfang, werkFilter, nurLange, suche])

  const filterAktiv = suche.trim() !== '' || werkFilter !== null || nurLange

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Wo ist was</h2>
        <div className="ui-tabs" role="group" aria-label="Umfang">
          <button
            type="button"
            className={umfang === 'alle' ? 'is-active' : undefined}
            aria-pressed={umfang === 'alle'}
            onClick={() => setUmfang('alle')}
          >
            Alles ({zahlen.unterwegs + zahlen.ausgeliehen})
          </button>
          <button
            type="button"
            className={umfang === 'unterwegs' ? 'is-active' : undefined}
            aria-pressed={umfang === 'unterwegs'}
            onClick={() => setUmfang('unterwegs')}
          >
            Unterwegs ({zahlen.unterwegs})
          </button>
          <button
            type="button"
            className={umfang === 'ausgeliehen' ? 'is-active' : undefined}
            aria-pressed={umfang === 'ausgeliehen'}
            onClick={() => setUmfang('ausgeliehen')}
          >
            Ausgeliehen ({zahlen.ausgeliehen})
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Nur Werkzeuge, die <strong>nicht an ihrem Platz</strong> liegen: unterwegs zwischen
        Werken oder an eine Person ausgeliehen. Der Heimatplatz bleibt dabei reserviert
        (DEC-071); eingelagerte Werkzeuge stehen in der Werkzeugliste.
      </p>

      {/* Suche und Filter (DEC-093): Die Liste ist klein, deshalb im Browser –
          sie reagiert damit ohne Anfrage, und die Person ist mit durchsuchbar. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suche: Werkzeug-ID, Art, Werk, Person, Auftrag …"
            aria-label="Draußen befindliche Werkzeuge durchsuchen"
            className="input-bordered w-full pl-8 text-sm"
          />
        </div>

        {heimatwerke.length > 1 && (
          <div className="ui-tabs" role="group" aria-label="Nach Heimatwerk filtern">
            <button
              type="button"
              className={werkFilter === null ? 'is-active' : undefined}
              aria-pressed={werkFilter === null}
              onClick={() => setWerkFilter(null)}
            >
              Alle Werke
            </button>
            {heimatwerke.map((werk) => (
              <button
                key={werk.id}
                type="button"
                className={werkFilter === werk.id ? 'is-active' : undefined}
                aria-pressed={werkFilter === werk.id}
                onClick={() => setWerkFilter(werk.id)}
              >
                {werk.name}
              </button>
            ))}
          </div>
        )}

        <label
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            nurLange
              ? 'border-amber-600/40 bg-amber-500/15 text-amber-900'
              : 'border-white/70 bg-white/50 text-slate-700'
          }`}
        >
          <input
            type="checkbox"
            checked={nurLange}
            onChange={(e) => setNurLange(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-amber-600"
          />
          <AlertCircleIcon className="h-3.5 w-3.5" />
          länger als {LANGE_DRAUSSEN} Tage ({zahlen.lange})
        </label>

        {filterAktiv && (
          <Tooltip text="Suche und Filter zurücksetzen">
            <button
              type="button"
              onClick={() => {
                setSuche('')
                setWerkFilter(null)
                setNurLange(false)
              }}
              className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1"
            >
              <XIcon className="h-3.5 w-3.5" />
              zurücksetzen
            </button>
          </Tooltip>
        )}

        <span className="text-xs text-slate-600">
          {zeilen.length} von {zahlen.unterwegs + zahlen.ausgeliehen}
        </span>
      </div>

      {fehler && (
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>{fehler}</div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
        <table className="w-full min-w-[860px] text-left text-xs" aria-busy={laden}>
          <caption className="sr-only">
            Werkzeuge, die gerade nicht an ihrem Platz liegen
          </caption>
          <thead className="bg-white/60 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th scope="col" className="px-2.5 py-2 font-semibold">Werkzeug-ID</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Art · Typ · Maß</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Heimatwerk</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Heimatplatz</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Ist jetzt</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Zustand</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Seit</th>
              <th scope="col" className="px-2.5 py-2 font-semibold">Auftrag / Ausleiher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {laden && (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-slate-600">
                  Wird geladen …
                </td>
              </tr>
            )}
            {!laden && zeilen.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-slate-600">
                  {filterAktiv
                    ? 'Kein Werkzeug passt zu dieser Suche.'
                    : umfang === 'alle'
                      ? 'Nichts unterwegs, nichts ausgeliehen – alle Werkzeuge liegen am Platz.'
                      : 'Für diesen Filter ist nichts vorhanden.'}
                </td>
              </tr>
            )}
            {zeilen.map((werkzeug) => (
              <tr
                key={werkzeug.tool_id}
                className="werk-zeile"
                style={werkZeile(werkFarbe(werkzeug.home_plant?.id))}
              >
                <td className="px-2.5 py-1.5">
                  <WerkzeugKennung code={werkzeug.tool_code} />
                </td>
                <td className="px-2.5 py-1.5">
                  <WerkzeugKurz
                    category={werkzeug.category}
                    toolType={werkzeug.tool_type}
                    measure={werkzeug.measure_a}
                  />
                </td>
                <td className="px-2.5 py-1.5">
                  <WerkName plant={werkzeug.home_plant} />
                </td>
                <td className="px-2.5 py-1.5">
                  <code className="font-mono text-xs text-slate-700">
                    {werkzeug.home_position_code || 'Ablage'}
                  </code>
                </td>
                <td className="px-2.5 py-1.5">
                  {werkzeug.status === 'in_transit' ? (
                    werkzeug.target_plant ? (
                      <WerkName plant={werkzeug.target_plant} />
                    ) : (
                      <strong className="text-slate-700">unterwegs</strong>
                    )
                  ) : (
                    <span className="text-slate-600">beim Ausleiher</span>
                  )}
                </td>
                <td className="px-2.5 py-1.5">
                  <WerkzeugMarke status={werkzeug.status} />
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  {/* „Seit wann draußen" – in Amber, wenn es zu lange ist. */}
                  <AlterMarke seit={werkzeug.since} offen />
                </td>
                <td className="px-2.5 py-1.5">
                  {werkzeug.status === 'lent' ? (
                    <span className="text-xs font-semibold text-slate-800">
                      {werkzeug.lent_to ?? '—'}
                    </span>
                  ) : werkzeug.transport_id !== null ? (
                    <button
                      type="button"
                      onClick={() => onOpenOrder(werkzeug.transport_id as number)}
                      className="ui-btn ui-btn-ghost ui-btn-sm"
                    >
                      {werkzeug.transport_number}
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
