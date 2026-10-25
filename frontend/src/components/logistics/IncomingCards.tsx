// Reiter „Eingang" (DEC-072/074/075).
//
// Je Auftrag eine Karte: **von wem, was fehlt, seit wann**. Die Karte ist eine
// Leseansicht – bestätigt wird im Fenster (DEC-075 Punkt 2), damit es für den
// Empfang **einen** Weg gibt und nicht zwei (Häkchen auf der Seite und Häkchen
// im Fenster wären zwei Wahrheiten über denselben Vorgang).

import type { TransportOrder } from '../../types/transport'
import { werkzeuge as werkzeugAnzahl } from '../../lib/format'
import {
  AlterMarke,
  Leerzustand,
  StatusMarke,
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  formatZeitpunkt,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

interface IncomingCardsProps {
  orders: TransportOrder[]
  onReceive: (order: TransportOrder) => void
  onDetail: (order: TransportOrder) => void
}

export default function IncomingCards({ orders, onReceive, onDetail }: IncomingCardsProps) {
  const werkFarbe = useWerkFarben()

  if (orders.length === 0) {
    return (
      <Leerzustand
        text="Nichts zu bestätigen."
        hinweis="Sobald ein anderes Werk Werkzeuge schickt, stehen sie hier."
      />
    )
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => {
        const offen = order.items.filter((item) => !item.received_at)
        const da = order.items.filter((item) => item.received_at)
        return (
          <div
            key={order.id}
            // Als Gruppe benannt: die Karte ist eine Einheit aus Kopf, Hinweis,
            // Tabelle und Aktionen – und über den Auftrag adressierbar (auch für
            // Prüfläufe, die nicht die erste Karte meinen).
            role="group"
            aria-label={`Auftrag ${order.order_number}`}
            className="overflow-hidden rounded-xl border border-white/60 bg-white/50"
          >
            {/* Kopf mit denselben Spalten wie in der Auftragsliste (`.kopf-eingang`,
                DEC-086): Nr · Zustand · Werke. Untereinander liegen die Angaben
                damit auf denselben Linien. */}
            <div className="kopf-eingang border-b border-white/70 px-3 py-2.5">
              <span className="truncate font-mono text-sm font-bold text-slate-900">
                {order.order_number}
              </span>
              <StatusMarke status={order.status} />
              <span className="flex min-w-0 items-center gap-1.5 text-xs">
                <WerkName plant={order.from_plant} />
                <span className="text-slate-500">→</span>
                <WerkName plant={order.to_plant} />
              </span>
            </div>

            <div className="space-y-2 bg-white/30 px-3 py-3">
              <div className="rounded-lg bg-[var(--werk-soft,rgba(15,118,110,0.1))] px-2.5 py-1.5 text-xs text-slate-700">
                <strong>
                  {offen.length} von {werkzeugAnzahl(order.item_count)} noch nicht bestätigt
                </strong>
                {da.length > 0 ? ` · ${da.length} schon angekommen` : ''}
                {order.sent_at
                  ? ` · verschickt ${formatZeitpunkt(order.sent_at)}${
                      order.sent_by_name ? ` von ${order.sent_by_name}` : ''
                    }`
                  : ''}
                {/* Wie lange es unterwegs ist (DEC-089) – Amber, wenn zu lange. */}
                {order.sent_at ? (
                  <>
                    {' · '}
                    <AlterMarke seit={order.sent_at} offen />
                  </>
                ) : null}
                {order.info ? ` · Info: ${order.info}` : ''}
              </div>

            <div className="overflow-x-auto rounded-lg">
              <table className="w-full min-w-[560px] text-left text-xs">
                <caption className="sr-only">
                  Werkzeuge im Auftrag {order.order_number}
                </caption>
                <thead className="bg-white/60 text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-2.5 py-1.5 font-semibold">Werkzeug-ID</th>
                    <th scope="col" className="px-2.5 py-1.5 font-semibold">Art · Typ · Maß</th>
                    <th scope="col" className="px-2.5 py-1.5 font-semibold">Heimatwerk</th>
                    <th scope="col" className="px-2.5 py-1.5 font-semibold">Heimatplatz</th>
                    <th scope="col" className="px-2.5 py-1.5 font-semibold">Empfang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {[...offen, ...da].map((item) => (
                    <tr
                      key={item.id}
                      className="werk-zeile"
                      style={werkZeile(werkFarbe(item.home_plant?.id))}
                    >
                      <td className="px-2.5 py-1.5">
                        <WerkzeugKennung code={item.tool_code} />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <WerkzeugKurz
                          category={item.category}
                          toolType={item.tool_type}
                          measure={item.measure_a}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <WerkName plant={item.home_plant} />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <code className="font-mono text-xs text-slate-700">
                          {item.home_position_code || 'Ablage'}
                        </code>
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        {item.received_at ? (
                          <span className="text-xs text-emerald-800">
                            angekommen · {formatZeitpunkt(item.received_at)}
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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDetail(order)}
                className="ui-btn ui-btn-secondary ui-btn-sm"
              >
                Auftrag öffnen
              </button>
              <button
                type="button"
                onClick={() => onReceive(order)}
                disabled={offen.length === 0}
                className="ui-btn ui-btn-werk ui-btn-sm"
              >
                Empfang bestätigen
              </button>
            </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
