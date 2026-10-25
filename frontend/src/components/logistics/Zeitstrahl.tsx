// Zeitstrahl eines Auftrags (DEC-091) – der Nachweis als Ablauf.
//
// Vorher stand der Verlauf im Fenster „Auftrag öffnen" als **drei Sätze**
// („Angelegt … von …", „Unterwegs seit …", „abgeschlossen …") untereinander. Wer
// wissen wollte, wer wann was getan hat, musste die Sätze lesen und im Kopf
// sortieren – dabei ist der Vorgang genau eine Kette:
//
//   angelegt → verschickt → (teilweise) angekommen → abgeschlossen
//
// Hier ist jeder Schritt ein Punkt mit Zeichen, Zeitpunkt, Person (Initialen,
// Vollname im Tooltip) und Werk. Der Stand ist der letzte erreichte Schritt; was
// noch aussteht, bleibt sichtbar, aber leise.

import type { ReactElement } from 'react'
import {
  CheckIcon,
  CircleXIcon,
  ClipboardListIcon,
  FileTextIcon,
  TruckIcon,
} from '../icons'
import type { Plant } from '../../api/types'
import type { TransportOrder } from '../../types/transport'
import { PersonMarke, WerkName, formatZeitpunkt } from './logistikTeile'

interface Schritt {
  /** Was passiert ist. */
  titel: string
  /** Wann – `null` bei einem Schritt, der noch aussteht. */
  zeit: string | null
  /** Wer gehandelt hat (kann leer bleiben). */
  personen: string[]
  /** In welchem Werk der Schritt stattfand. */
  werk: Plant | null
  /** Kleine Zusatzzeile (z. B. „2 von 3 Werkzeugen"). */
  zusatz?: string
  icon: (props: { className?: string }) => ReactElement
  /** Farbton der Punktmarke. */
  ton: 'neutral' | 'sky' | 'amber' | 'emerald' | 'rose'
  /** Steht der Schritt noch aus? */
  ausstehend?: boolean
}

const TON: Record<NonNullable<Schritt['ton']>, { marke: string; text: string }> = {
  neutral: { marke: 'bg-slate-500/15 text-slate-700 ring-slate-500/25', text: 'text-slate-700' },
  sky: { marke: 'bg-sky-500/15 text-sky-700 ring-sky-500/25', text: 'text-sky-800' },
  amber: { marke: 'bg-amber-500/18 text-amber-800 ring-amber-500/30', text: 'text-amber-800' },
  emerald: {
    marke: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25',
    text: 'text-emerald-800',
  },
  rose: { marke: 'bg-rose-500/15 text-rose-700 ring-rose-500/25', text: 'text-rose-800' },
}

/** Namen eindeutig und in der Reihenfolge des ersten Auftretens. */
function personen(werte: (string | null)[]): string[] {
  const gesehen: string[] = []
  for (const wert of werte) {
    if (wert && !gesehen.includes(wert)) gesehen.push(wert)
  }
  return gesehen
}

/** Die Schritte eines Auftrags aus den vorhandenen Nachweisen (keine neuen Daten). */
export function schritteFuer(order: TransportOrder): Schritt[] {
  const schritte: Schritt[] = []

  // 1. Angelegt – immer vorhanden.
  schritte.push({
    titel: 'Angelegt',
    zeit: order.created_at,
    personen: personen([order.created_by_name]),
    werk: order.created_plant,
    zusatz: order.item_count > 0 ? `mit ${order.item_count} Werkzeug(en)` : 'ohne Werkzeuge',
    icon: FileTextIcon,
    ton: 'neutral',
  })

  // 2. Verschickt – oder „steht aus" beim Entwurf.
  if (order.status === 'cancelled') {
    schritte.push({
      titel: 'Storniert',
      // Der Zeitpunkt des Stornos wird nicht mitgeschrieben – der Zeitstempel
      // des letzten Zustands (closed_at) ist beim Storno leer. Deshalb steht hier
      // bewusst kein Datum, statt eines zu erfinden.
      zeit: order.closed_at ?? null,
      personen: [],
      werk: order.created_plant,
      zusatz: 'Der Entwurf wurde aufgelöst; die Werkzeuge sind wieder frei.',
      icon: CircleXIcon,
      ton: 'rose',
    })
    return schritte
  }

  const verschickt = !!order.sent_at
  schritte.push({
    titel: verschickt ? 'Verschickt' : 'Noch nicht verschickt',
    zeit: order.sent_at ?? null,
    personen: personen([order.sent_by_name]),
    werk: verschickt ? order.from_plant : null,
    zusatz: verschickt ? 'Heimatplätze bleiben reserviert' : 'Der Auftrag liegt als Entwurf',
    icon: TruckIcon,
    ton: 'sky',
    ausstehend: !verschickt,
  })

  // 3. Empfang – je Werkzeug bestätigt, deshalb zwei Stufen.
  const empfangen = order.items.filter((item) => !!item.received_at)
  const wer = personen(empfangen.map((item) => item.received_by_name))
  const werk = empfangen[0]?.received_plant ?? order.to_plant ?? null

  if (empfangen.length > 0 && empfangen.length < order.items.length) {
    const frueheste = empfangen
      .map((item) => item.received_at as string)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
    schritte.push({
      titel: 'Teilweise angekommen',
      zeit: frueheste,
      personen: wer,
      werk,
      zusatz: `${empfangen.length} von ${order.items.length} Werkzeugen bestätigt`,
      icon: ClipboardListIcon,
      ton: 'amber',
    })
  }

  const alleDa = order.items.length > 0 && empfangen.length === order.items.length
  if (alleDa) {
    const letzte = empfangen
      .map((item) => item.received_at as string)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    schritte.push({
      titel: 'Angekommen',
      zeit: order.closed_at ?? letzte,
      personen: wer,
      werk,
      zusatz: `alle ${order.items.length} Werkzeuge bestätigt`,
      icon: CheckIcon,
      ton: 'emerald',
    })
  } else if (verschickt) {
    schritte.push({
      titel: 'Empfang offen',
      zeit: null,
      personen: [],
      werk: order.to_plant,
      zusatz: `${order.items.length - empfangen.length} von ${order.items.length} Werkzeugen warten`,
      icon: ClipboardListIcon,
      ton: 'amber',
      ausstehend: true,
    })
  }

  return schritte
}

export default function Zeitstrahl({ order }: { order: TransportOrder }) {
  const schritte = schritteFuer(order)
  return (
    <section aria-label="Ablauf des Auftrags" className="rounded-xl bg-white/45 px-3 py-2.5">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
        Ablauf
      </h3>
      <ol className="space-y-0">
        {schritte.map((schritt, index) => {
          const ton = TON[schritt.ton]
          const Icon = schritt.icon
          return (
            <li key={`${schritt.titel}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
              {index < schritte.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.7rem] top-6 h-full w-px bg-slate-300/70"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${
                  schritt.ausstehend
                    ? 'bg-white/60 text-slate-500 ring-dashed ring-slate-400/50'
                    : ton.marke
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className={`text-xs font-bold ${
                      schritt.ausstehend ? 'text-slate-500' : ton.text
                    }`}
                  >
                    {schritt.titel}
                  </span>
                  {schritt.zeit && (
                    <span className="text-[11px] text-slate-600">
                      {formatZeitpunkt(schritt.zeit)}
                    </span>
                  )}
                  {schritt.personen.map((name) => (
                    <PersonMarke
                      key={name}
                      rolle={schritt.titel.toLowerCase()}
                      name={name}
                      farbe="werk"
                    />
                  ))}
                  {schritt.werk && <WerkName plant={schritt.werk} />}
                </div>
                {schritt.zusatz && (
                  <p className="mt-0.5 text-[11px] text-slate-600">{schritt.zusatz}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
