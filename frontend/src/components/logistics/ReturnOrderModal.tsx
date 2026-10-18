// Fenster „Zurück schicken" (DEC-072 Punkt 1, DEC-078).
//
// Der Rückweg ist ein **eigener Auftrag** mit Bezug auf den Hinweg
// (`parent_order_id`) – dadurch ist die Spiegelung zwischen den Werken derselbe
// Vorgang und keine zweite Logik. Zurückgehen kann nur, was auch angekommen ist;
// Werkzeuge dürfen einzeln gewählt werden.

import { useState } from 'react'
import { returnOrder } from '../../api/transport'
import type { TransportOrder } from '../../types/transport'
import { useEscapeKey } from '../../lib/useEscapeKey'
import {
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

interface ReturnOrderModalProps {
  order: TransportOrder
  onClose: () => void
  onDone: (rueck: TransportOrder, anzahl: number) => void
}

export default function ReturnOrderModal({ order, onClose, onDone }: ReturnOrderModalProps) {
  const werkFarbe = useWerkFarben()
  const angekommen = order.items.filter((item) => item.received_at)
  const [gewaehlt, setGewaehlt] = useState<number[]>(angekommen.map((item) => item.tool_id))
  const [info, setInfo] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEscapeKey(onClose, !speichert)

  function umschalten(toolId: number) {
    setGewaehlt((alt) =>
      alt.includes(toolId) ? alt.filter((id) => id !== toolId) : [...alt, toolId],
    )
  }

  async function anlegen() {
    setFehler(null)
    if (gewaehlt.length === 0) {
      setFehler('Bitte mindestens ein Werkzeug wählen.')
      return
    }
    setSpeichert(true)
    try {
      const rueck = await returnOrder(order.id, gewaehlt, info)
      onDone(rueck, gewaehlt.length)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Rück-Auftrag konnte nicht angelegt werden.')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rueck-titel"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="rueck-titel" className="text-lg font-semibold text-slate-900">
            Zurück schicken · {order.order_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white/60 hover:text-slate-700"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-700">
          Welche Werkzeuge gehen zurück an <WerkName plant={order.from_plant} />? Zur Wahl
          stehen nur Werkzeuge, die hier angekommen sind.
        </p>

        <div className="rounded-xl border border-white/60 bg-white/30">
          {angekommen.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-600">
              In diesem Auftrag ist noch nichts angekommen.
            </p>
          )}
          {angekommen.map((item) => (
            <label
              key={item.id}
              className="werk-zeile flex cursor-pointer items-center gap-2 border-b border-slate-200/50 px-3 py-2 text-xs last:border-b-0"
              style={werkZeile(werkFarbe(item.home_plant?.id))}
            >
              <input
                type="checkbox"
                checked={gewaehlt.includes(item.tool_id)}
                onChange={() => umschalten(item.tool_id)}
                aria-label={`${item.tool_code ?? 'Werkzeug ohne ID'} zurück schicken`}
              />
              <WerkzeugKennung code={item.tool_code} />
              <WerkzeugKurz
                category={item.category}
                toolType={item.tool_type}
                measure={item.measure_a}
              />
              <span className="ml-auto text-[11px] text-slate-600">
                Heimatplatz {item.home_position_code || 'Ablage'}
              </span>
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Info für das Heimatwerk (optional)
          </span>
          <textarea
            id="rueck-info"
            rows={2}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder="z. B. Werkzeuge geprüft, alles in Ordnung"
            className="input-bordered text-sm"
          />
        </label>

        <p className="mt-2 text-[11px] text-slate-600">
          Der Rückweg wird ein eigener Auftrag mit Bezug auf{' '}
          <span className="font-mono">{order.order_number}</span>; bestätigt wird er vom
          Heimatwerk.
        </p>

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
            onClick={() => void anlegen()}
            disabled={speichert || angekommen.length === 0}
            className="ui-btn ui-btn-werk"
          >
            {speichert ? 'Wird angelegt …' : 'Rück-Auftrag anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
