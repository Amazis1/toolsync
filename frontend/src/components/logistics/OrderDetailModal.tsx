// Fenster „Auftrag öffnen" – der Nachweis (DEC-072).
//
// Es zeigt, was der Auftrag festhält: Werke, Zustand, wer wann gehandelt hat
// (angelegt, verschickt, abgeschlossen) und je Werkzeug den Heimatplatz **zum
// Versandzeitpunkt**. Diese Angaben bleiben richtig, auch wenn die Matrix später
// umgebaut wird – deshalb werden sie mitgeschrieben und nicht nachgeschlagen.

import { useEffect, useState } from 'react'
import { getOrder } from '../../api/transport'
import type { TransportOrder } from '../../types/transport'
import { OFFENE_AUFTRAEGE } from '../../types/transport'
import { useEscapeKey } from '../../lib/useEscapeKey'
import {
  StatusMarke,
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  formatZeitpunkt,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'
import EscHinweis from '../ui/EscHinweis'

interface OrderDetailModalProps {
  orderId: number
  onClose: () => void
  onReceive: (order: TransportOrder) => void
  onReturn: (order: TransportOrder) => void
}

export default function OrderDetailModal({
  orderId,
  onClose,
  onReceive,
  onReturn,
}: OrderDetailModalProps) {
  const werkFarbe = useWerkFarben()
  const [order, setOrder] = useState<TransportOrder | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEscapeKey(onClose)

  useEffect(() => {
    let gilt = true
    setFehler(null)
    getOrder(orderId)
      .then((geladen) => {
        if (gilt) setOrder(geladen)
      })
      .catch((e: unknown) => {
        if (gilt) {
          setFehler(e instanceof Error ? e.message : 'Der Auftrag konnte nicht geladen werden.')
        }
      })
    return () => {
      gilt = false
    }
  }, [orderId])

  const istOffen = order ? OFFENE_AUFTRAEGE.includes(order.status) : false
  const darfEmpfangen = !!order && istOffen && order.direction === 'in' && order.status !== 'draft'
  const darfZurueck =
    !!order &&
    order.direction === 'in' &&
    (order.status === 'received' || order.status === 'partly_received') &&
    order.received_count > 0

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-titel"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="detail-titel" className="text-lg font-semibold text-slate-900">
            Auftrag {order?.order_number ?? '…'}
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

        {fehler && (
          <div className="ui-alert ui-alert-error">
            <span>×</span>
            <div>{fehler}</div>
          </div>
        )}

        {!order && !fehler && <p className="text-xs text-slate-600">Wird geladen …</p>}

        {order && (
          <div className="space-y-3">
            <div className="rounded-xl bg-white/55 px-3 py-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <StatusMarke status={order.status} />
                {order.parent_order_id !== null && (
                  <span className="inline-flex items-center rounded-full bg-slate-500/12 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Rückweg
                  </span>
                )}
                <WerkName plant={order.from_plant} />
                <span className="text-slate-500">→</span>
                <WerkName plant={order.to_plant} />
              </div>
              <p className="mt-1">
                Angelegt {formatZeitpunkt(order.created_at)}
                {order.created_by_name ? ` von ${order.created_by_name}` : ''}
                {order.created_plant ? ` · Arbeitswerk ${order.created_plant.name}` : ''}
              </p>
              <p>
                {order.sent_at
                  ? `Unterwegs seit ${formatZeitpunkt(order.sent_at)}${
                      order.sent_by_name ? ` (${order.sent_by_name})` : ''
                    }`
                  : 'Noch nicht verschickt'}
                {order.closed_at ? ` · abgeschlossen ${formatZeitpunkt(order.closed_at)}` : ''}
              </p>
              {order.reference && (
                <p>
                  Referenz: <span className="font-mono">{order.reference}</span>
                </p>
              )}
              {order.info && <p>Info: {order.info}</p>}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/30">
              <table className="w-full min-w-[640px] text-left text-xs">
                <caption className="sr-only">Werkzeuge im Auftrag {order.order_number}</caption>
                <thead className="bg-white/45 text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-2 py-2 font-semibold">Werkzeug-ID</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Art · Typ · Maß</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Heimatwerk</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Heimatplatz</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Empfang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {order.items.map((item) => (
                    <tr
                      key={item.id}
                      className="werk-zeile"
                      style={werkZeile(werkFarbe(item.home_plant?.id))}
                    >
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
                      <td className="px-2 py-1.5">
                        {item.received_at ? (
                          <span className="text-xs text-emerald-800">
                            da · {formatZeitpunkt(item.received_at)}
                            {item.received_by_name ? ` · ${item.received_by_name}` : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">ausstehend</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="rounded-xl bg-white/55 px-3 py-2 text-[11px] text-slate-600">
              Der Heimatplatz bleibt während des ganzen Vorgangs reserviert und unverändert
              (DEC-071). Erst der bestätigte Empfang ändert den <em>aktuellen</em> Ort des
              Werkzeugs.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
                Schließen
              </button>
              {darfZurueck && (
                <button
                  type="button"
                  onClick={() => onReturn(order)}
                  className="ui-btn ui-btn-secondary"
                >
                  Zurück schicken
                </button>
              )}
              {darfEmpfangen && (
                <button
                  type="button"
                  onClick={() => onReceive(order)}
                  className="ui-btn ui-btn-secondary"
                >
                  Empfang bestätigen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
