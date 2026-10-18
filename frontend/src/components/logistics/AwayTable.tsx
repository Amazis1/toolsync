// „Wo ist was" (DEC-077) – die Antwort auf „wo sind meine Sachen gerade".
//
// Gezeigt wird **nur**, was nicht am Platz liegt: unterwegs zwischen Werken oder
// an eine Person ausgeliehen. Eingelagerte Werkzeuge stehen in der
// Werkzeugliste – sie hier zu wiederholen würde die Tabelle unbrauchbar machen.
// Der Heimatplatz bleibt sichtbar, aber als reserviert, nicht als Fundort.

import { useEffect, useMemo, useState } from 'react'
import { getAwayTools } from '../../api/transport'
import type { AwayTool } from '../../types/transport'
import {
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  WerkzeugMarke,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

type Umfang = 'alle' | 'unterwegs' | 'ausgeliehen'

interface AwayTableProps {
  refreshKey: number
  onOpenOrder: (orderId: number) => void
}

export default function AwayTable({ refreshKey, onOpenOrder }: AwayTableProps) {
  const werkFarbe = useWerkFarben()
  const [werkzeuge, setWerkzeuge] = useState<AwayTool[]>([])
  const [umfang, setUmfang] = useState<Umfang>('alle')
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
    }),
    [werkzeuge],
  )

  const zeilen = werkzeuge.filter((werkzeug) => {
    if (umfang === 'unterwegs') return werkzeug.status === 'in_transit'
    if (umfang === 'ausgeliehen') return werkzeug.status === 'lent'
    return true
  })

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

      {fehler && (
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>{fehler}</div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
        <table className="w-full min-w-[720px] text-left text-xs" aria-busy={laden}>
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
              <th scope="col" className="px-2.5 py-2 font-semibold">Auftrag / Ausleiher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {laden && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-slate-600">
                  Wird geladen …
                </td>
              </tr>
            )}
            {!laden && zeilen.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-slate-600">
                  {umfang === 'alle'
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
                <td className="px-2.5 py-1.5">
                  {werkzeug.status === 'lent' ? (
                    <span className="text-xs text-slate-700">{werkzeug.lent_to ?? '—'}</span>
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
