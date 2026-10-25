// Auftragsliste der Werkzeug-Logistik (DEC-072/075).
//
// Der Bildschirm zeigt **Zeilen, nicht Details**: ein Auftrag ist eine Zeile
// (Nr. · Zustand · Richtung · von → an · Anzahl · Datum), zugeklappt ist der
// Standard. Erst ein Klick klappt Positionen und Aktionen auf. Bei fünfzig
// offenen Aufträgen bleibt die Liste dadurch lesbar – „alles offen" war genau
// der Fehler der ersten Demo (DEC-075 Punkt 1).

import type { TransportOrder, TransportItem } from '../../types/transport'
import { OFFENE_AUFTRAEGE } from '../../types/transport'
import { werkzeuge as werkzeugAnzahl } from '../../lib/format'
import { ChevronDownIcon } from '../icons'
import Tooltip from '../ui/Tooltip'
import {
  AlterMarke,
  Leerzustand,
  RueckwegMarke,
  StatusMarke,
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  formatTag,
  formatZeitpunkt,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

interface OrderListProps {
  orders: TransportOrder[]
  aufgeklappt: number[]
  busyId: number | null
  /** Text, wenn es nichts zu zeigen gibt – je Bereich ein anderer. */
  leerText?: string
  /** Zweite Zeile des Leerzustands (was man als Nächstes tun kann). */
  leerHinweis?: string
  onToggle: (id: number) => void
  onSend: (order: TransportOrder) => void
  onCancel: (order: TransportOrder) => void
  onReceive: (order: TransportOrder) => void
  onReturn: (order: TransportOrder) => void
  onDetail: (order: TransportOrder) => void
}

/** Eine Zeile der Positions-Tabelle (Farbe = Heimatwerk des Werkzeugs). */
function ItemRow({ item }: { item: TransportItem }) {
  const farbe = useWerkFarben()(item.home_plant?.id)
  return (
    <tr className="werk-zeile" style={werkZeile(farbe)}>
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
          <span className="text-xs text-emerald-800">da · {formatZeitpunkt(item.received_at)}</span>
        ) : (
          // Keine eigene Spalte „Zustand" mehr: im Auftrag ist die eine Frage,
          // ob das Werkzeug angekommen ist. „ausstehend" sagt das, ohne den
          // Werkzeug-Zustand ein zweites Mal zu nennen (DEC-080).
          <span className="text-xs text-slate-600">ausstehend</span>
        )}
      </td>
    </tr>
  )
}

interface OrderRowProps {
  order: TransportOrder
  offen: boolean
  busyId: number | null
  onToggle: (id: number) => void
  onSend: (order: TransportOrder) => void
  onCancel: (order: TransportOrder) => void
  onReceive: (order: TransportOrder) => void
  onReturn: (order: TransportOrder) => void
  onDetail: (order: TransportOrder) => void
}

/** Ein Auftrag als Dropdown. */
function OrderRow({
  order,
  offen,
  busyId,
  onToggle,
  onSend,
  onCancel,
  onReceive,
  onReturn,
  onDetail,
}: OrderRowProps) {
  const beschaeftigt = busyId === order.id
  const istOffen = OFFENE_AUFTRAEGE.includes(order.status)
  const darfVerschicken = order.status === 'draft' && order.direction === 'out'
  const darfEmpfangen = istOffen && order.direction === 'in' && order.status !== 'draft'
  const darfZurueck =
    order.direction === 'in' &&
    (order.status === 'received' || order.status === 'partly_received') &&
    order.received_count > 0

  const richtung = order.direction === 'in' ? 'Eingang' : 'Ausgang'

  return (
    // **Ein Auftrag = eine Karte.** Vorher standen alle Aufträge in *einem*
    // Container, getrennt nur durch eine Haarlinie – von außen sah das wie ein
    // einziger Block aus, und wo ein Auftrag aufhört und der nächste beginnt, war
    // nicht zu erkennen. Der abgenommene Prototyp (`docs/demo-werkzeug-logistik.html`,
    // `.drop`) machte es genauso: eigene Karte je Auftrag, Kopf mit
    // Aufklapp-Zeichen, Körper mit eigener Fläche und Trennlinie (DEC-084).
    <div
      className={`overflow-hidden rounded-xl border border-white/60 transition-colors ${
        offen ? 'bg-white/55' : 'bg-white/35 hover:bg-white/50'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(order.id)}
        aria-expanded={offen}
        // Gleiche Spalten in jeder Karte (`.kopf-auftrag`, DEC-086): Nr · Zustand ·
        // Rückweg · Werke · rechts Anzahl/Datum/Details. Untereinander liegen die
        // Angaben damit auf denselben Linien; vorher stand jedes Element dort, wo
        // seine Breite es zuließ.
        className="kopf-auftrag px-3 py-2.5"
      >
        <span className="truncate font-mono text-sm font-bold text-slate-900">
          {order.order_number}
        </span>
        <StatusMarke status={order.status} />
        {order.parent_order_id !== null ? <RueckwegMarke /> : <span aria-hidden="true" />}
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {richtung}
          </span>
          <WerkName plant={order.from_plant} />
          <span className="text-slate-500">→</span>
          <WerkName plant={order.to_plant} />
        </span>
        <span className="kopf-rechts flex items-center gap-3 text-xs text-slate-600">
          <span className="whitespace-nowrap">
            {werkzeugAnzahl(order.item_count)}
            {order.received_count > 0 ? ` · ${order.received_count} davon da` : ''}
          </span>
          <span className="whitespace-nowrap">
            {order.sent_at
              ? `verschickt ${formatTag(order.sent_at)}`
              : `angelegt ${formatTag(order.created_at)}`}
          </span>
          {/* Wie lange der Auftrag schon läuft (DEC-089) – in Amber, wenn er zu
              lange offen ist. Die Zahl der Werkzeuge allein sagt nicht, ob etwas
              liegen bleibt. */}
          <AlterMarke seit={order.sent_at ?? order.created_at} offen={istOffen} />
          {/* Sichtbarer Hinweis, dass die Zeile aufgeht – ein nacktes Dreieck am
              Rand reichte für neue Benutzer nicht (DEC-084). „Zuklappen" statt
              „Schließen", damit es nicht mit dem Schließen der Fenster verwechselt
              wird. */}
          <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold text-slate-600">
            {offen ? 'Zuklappen' : 'Details'}
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${offen ? 'rotate-180' : ''}`}
            />
          </span>
        </span>
      </button>

      {offen && (
        // Körper auf eigener, etwas tieferer Fläche mit Trennlinie zum Kopf –
        // so ist die Grenze zwischen „Kopf des Auftrags" und „Inhalt" eindeutig.
        // `auftrag-koerper`: Er blendet beim Aufklappen ein, statt zu „platzen"
        // (DEC-087, nur bei `prefers-reduced-motion: no-preference`).
        <div className="auftrag-koerper space-y-3 border-t border-white/70 bg-white/30 px-3 py-3">
          {order.info && (
            // Hinweis in der Farbe des Arbeitswerks – dieselbe Sprache wie die
            // Info-Zeile im Eingang. Vorher war es eine vierte weiße Schicht, die
            // sich von der Tabelle kaum abhob.
            <div className="rounded-xl bg-[var(--werk-soft,rgba(15,118,110,0.1))] px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">Info:</span> {order.info}
            </div>
          )}

          {/* Kein eigenes Weiß: Die Zeilen tragen die Werkfarbe selbst. Drei
              übereinanderliegende weiße Schichten (Karte → Container → Tabelle)
              haben die Tönung vorher milchig gemacht (DEC-082). */}
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[640px] text-left text-xs">
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
                {order.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-2 text-slate-600">
                      Keine Werkzeuge im Auftrag.
                    </td>
                  </tr>
                )}
                {order.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {darfZurueck && (
              <button
                type="button"
                onClick={() => onReturn(order)}
                disabled={beschaeftigt}
                className="ui-btn ui-btn-secondary ui-btn-sm"
              >
                Zurück schicken
              </button>
            )}
            {darfEmpfangen && (
              <button
                type="button"
                onClick={() => onReceive(order)}
                disabled={beschaeftigt}
                className="ui-btn ui-btn-secondary ui-btn-sm"
              >
                Empfang bestätigen
              </button>
            )}
            {darfVerschicken && (
              <>
                <Tooltip
                  text={
                    order.item_count === 0
                      ? 'Ein Auftrag ohne Werkzeuge lässt sich stornieren.'
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onCancel(order)}
                    disabled={beschaeftigt}
                    className="ui-btn ui-btn-danger-soft ui-btn-sm"
                  >
                    Stornieren
                  </button>
                </Tooltip>
                <Tooltip
                  text={
                    order.item_count === 0
                      ? 'Ein Auftrag ohne Werkzeuge kann nicht verschickt werden.'
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSend(order)}
                    disabled={beschaeftigt || order.item_count === 0}
                    className="ui-btn ui-btn-primary ui-btn-sm"
                  >
                    Als unterwegs melden
                  </button>
                </Tooltip>
              </>
            )}
            <button
              type="button"
              onClick={() => onDetail(order)}
              className="ui-btn ui-btn-ghost ui-btn-sm"
            >
              Auftrag öffnen
            </button>
          </div>

          <p className="px-0.5 text-xs text-slate-600">
            Angelegt{order.created_by_name ? ` von ${order.created_by_name}` : ''}
            {order.created_plant ? ` · Arbeitswerk ${order.created_plant.name}` : ''}
            {order.sent_at ? ` · verschickt ${formatZeitpunkt(order.sent_at)}` : ''}
            {order.closed_at ? ` · abgeschlossen ${formatZeitpunkt(order.closed_at)}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default function OrderList({
  orders,
  aufgeklappt,
  busyId,
  leerText = 'Kein Auftrag aus diesem Werk.',
  leerHinweis = 'Mit „+ Neuer Auftrag" Werkzeuge an ein anderes Werk schicken.',
  onToggle,
  onSend,
  onCancel,
  onReceive,
  onReturn,
  onDetail,
}: OrderListProps) {
  if (orders.length === 0) {
    return <Leerzustand text={leerText} hinweis={leerHinweis} />
  }
  return (
    // Abstand **zwischen** den Aufträgen: der Prototyp nahm 6 px, hier sind es die
    // 8 px des Projekts (`space-y-2`) – Karten brauchen Luft, sonst kleben sie
    // wieder zu einem Block zusammen (DEC-084).
    <div className="space-y-2">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          offen={aufgeklappt.includes(order.id)}
          busyId={busyId}
          onToggle={onToggle}
          onSend={onSend}
          onCancel={onCancel}
          onReceive={onReceive}
          onReturn={onReturn}
          onDetail={onDetail}
        />
      ))}
    </div>
  )
}
