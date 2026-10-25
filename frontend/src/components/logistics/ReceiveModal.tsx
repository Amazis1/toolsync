// Fenster „Empfang bestätigen" (DEC-072, Stufe 1 nach DEC-074).
//
// Bestätigt wird **je Werkzeug** – „eine Kiste fehlt" ist der Normalfall, nicht
// die Ausnahme. „Alles angekommen" ist die Abkürzung dafür. Wer bestätigt, wird
// mit Person, Arbeitswerk und Zeitpunkt festgehalten; es gibt keine
// Rechteprüfung (Stufe 1: Nachweis statt Recht).

import { useState } from 'react'
import { receiveOrder } from '../../api/transport'
import type { TransportOrder } from '../../types/transport'
import { useEscapeKey } from '../../lib/useEscapeKey'
import {
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'
import EscHinweis from '../ui/EscHinweis'

interface ReceiveModalProps {
  order: TransportOrder
  onClose: () => void
  onDone: (order: TransportOrder, anzahl: number) => void
}

export default function ReceiveModal({ order, onClose, onDone }: ReceiveModalProps) {
  const werkFarbe = useWerkFarben()
  const offene = order.items.filter((item) => !item.received_at)
  const [gewaehlt, setGewaehlt] = useState<number[]>(offene.map((item) => item.id))
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEscapeKey(onClose, !speichert)

  function umschalten(itemId: number) {
    setGewaehlt((alt) =>
      alt.includes(itemId) ? alt.filter((id) => id !== itemId) : [...alt, itemId],
    )
  }

  async function bestaetigen(alle: boolean) {
    setFehler(null)
    if (!alle && gewaehlt.length === 0) {
      setFehler('Bitte die angekommenen Werkzeuge anhaken.')
      return
    }
    setSpeichert(true)
    try {
      const aktualisiert = await receiveOrder(order.id, alle ? undefined : gewaehlt)
      onDone(aktualisiert, alle ? offene.length : gewaehlt.length)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Empfang konnte nicht bestätigt werden.')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="empfang-titel"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="empfang-titel" className="text-lg font-semibold text-slate-900">
            Empfang bestätigen · {order.order_number}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <EscHinweis />
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white/60 hover:text-slate-700"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-xl bg-white/55 px-3 py-2 text-xs text-slate-700">
          <WerkName plant={order.from_plant} /> <span className="text-slate-500">→</span>{' '}
          <WerkName plant={order.to_plant} /> · bestätigt wird mit dem Arbeitswerk{' '}
          <WerkName plant={order.to_plant} />. Person, Arbeitswerk und Zeitpunkt werden
          festgehalten; der Heimatplatz des Werkzeugs bleibt reserviert.
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">Noch nicht bestätigte Werkzeuge</caption>
            <thead className="bg-white/45 text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="w-8 px-2 py-2 font-semibold">
                  <span className="sr-only">Angekommen</span>
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">Werkzeug-ID</th>
                <th scope="col" className="px-2 py-2 font-semibold">Art · Typ · Maß</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatwerk</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatplatz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {offene.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-slate-600">
                    Es ist schon alles bestätigt.
                  </td>
                </tr>
              )}
              {offene.map((item) => (
                <tr
                  key={item.id}
                  className="werk-zeile"
                  style={werkZeile(werkFarbe(item.home_plant?.id))}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={gewaehlt.includes(item.id)}
                      onChange={() => umschalten(item.id)}
                      aria-label={`${item.tool_code ?? 'Werkzeug ohne ID'} ist angekommen`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkzeugKennung code={item.tool_code} />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkzeugKurz
                      category={item.category}
                      toolType={item.tool_type}
                      measure={item.measure_a}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkName plant={item.home_plant} />
                  </td>
                  <td className="px-2 py-1.5">
                    <code className="font-mono text-xs text-slate-700">
                      {item.home_position_code || 'Ablage'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fehler && (
          <div className="ui-alert ui-alert-error mt-3">
            <span>×</span>
            <div>{fehler}</div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-200/70 pt-3">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void bestaetigen(false)}
            disabled={speichert || offene.length === 0}
            className="ui-btn ui-btn-secondary"
          >
            Nur Auswahl
          </button>
          <button
            type="button"
            onClick={() => void bestaetigen(true)}
            disabled={speichert || offene.length === 0}
            className="ui-btn ui-btn-werk"
          >
            {speichert ? 'Wird bestätigt …' : 'Alles angekommen'}
          </button>
        </div>
      </div>
    </div>
  )
}
