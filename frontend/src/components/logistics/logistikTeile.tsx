// Kleine Bausteine der Werkzeug-Logistik (DEC-072/076).
//
// Alles, was mehrere Logistik-Ansichten gemeinsam brauchen: Werknamen in der
// Farbe **ihres** Werks, Zustandsmarken mit eigenen Tönen und die Zeilenfarbe
// der Tabelle. Keine farbigen Kanten – die Werkfarbe steht auf Flächen, Knöpfen,
// Namen und als ganze Zeile (Vorgabe des Projektinhabers, DEC-076).

import type { CSSProperties, ReactElement } from 'react'
import type { TransportOrder } from '../../types/transport'
import Tooltip from '../ui/Tooltip'
import { plantColor, usePlants, withAlpha } from '../../lib/plantTheme'
import type { Plant } from '../../api/types'
import {
  TRANSPORT_STATUS_LABELS,
  type TransportStatus,
} from '../../types/transport'
import {
  AlertCircleIcon,
  CheckIcon,
  CircleXIcon,
  ClipboardListIcon,
  FileTextIcon,
  TruckIcon,
} from '../icons'

/** Ersatzfarbe, wenn ein Werk keine Farbe gepflegt hat. */
export const OHNE_WERKFARBE = '#475569'

/** Zeilenfarbe: ganze Zeile in der Werkfarbe, 14 %, beim Überfahren 20 %. */
const ZEILE = 0.14
const ZEILE_HOVER = 0.2

/** Liefert die Werkfarbe zu einer Werk-ID (mit Rückfall auf Neutralgrau). */
export function useWerkFarben(): (plantId: number | null | undefined) => string {
  const plants = usePlants()
  return (plantId) => plantColor(plants, plantId) ?? OHNE_WERKFARBE
}

/**
 * Stil für eine ganze Tabellenzeile in der Farbe ihres Werks.
 *
 * Die Werte gehen als CSS-Variablen an die Zeile; die Regel `.werk-zeile` in
 * `index.css` liest sie. So bleibt die Farbe **eine** Entscheidung und steht
 * nicht in jeder Zelle erneut.
 */
export function werkZeile(farbe: string): CSSProperties {
  return {
    '--row': withAlpha(farbe, ZEILE),
    '--row-hover': withAlpha(farbe, ZEILE_HOVER),
  } as CSSProperties
}

/** Werkname in der Farbe seines Werks – auch bei fremden Werken (DEC-076). */
export function WerkName({
  plant,
  fallback = '—',
}: {
  plant: Plant | null
  fallback?: string
}) {
  const farbe = useWerkFarben()(plant?.id)
  if (!plant) return <span className="text-slate-600">{fallback}</span>
  return (
    <strong className="font-bold" style={{ color: farbe }}>
      {plant.name}
    </strong>
  )
}

/** Kleiner Farbpunkt eines Werks. */
export function WerkPunkt({ plant }: { plant: Plant | null }) {
  const farbe = useWerkFarben()(plant?.id)
  if (!plant) return null
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/80"
      style={{ backgroundColor: farbe }}
    />
  )
}

/** Zeichen je Zustand – die Marke ist damit auch ohne Lesen zu unterscheiden. */
const STATUS_BILD: Record<TransportStatus, (props: { className?: string }) => ReactElement> = {
  draft: FileTextIcon,
  sent: TruckIcon,
  partly_received: ClipboardListIcon,
  received: CheckIcon,
  cancelled: CircleXIcon,
}

/**
 * Zustand eines Auftrags als **gefüllte** Marke mit Verlauf und Zeichen
 * (DEC-089). Vorher war sie eine 15-%-Tinte: Der wichtigste Wert einer Zeile war
 * damit der leiseste. Der Verlauf sitzt nur auf der Marke – die Karte bleibt
 * ruhig (DEC-076: keine farbigen Kanten, keine getönten Karten).
 */
export function StatusMarke({ status }: { status: TransportStatus }) {
  const Bild = STATUS_BILD[status] ?? FileTextIcon
  return (
    <span className={`ui-status ui-status-${status}`}>
      <Bild className="h-3 w-3 shrink-0" />
      {TRANSPORT_STATUS_LABELS[status] ?? status}
    </span>
  )
}

/** Ab dieser Dauer gilt ein Auftrag als „liegt zu lange" (Tage). */
export const LANGE_UNTERWEGS = 3

/** Alter in Tagen (0 = heute) – `null`, wenn kein Zeitpunkt bekannt ist. */
export function alterTage(iso: string | null | undefined): number | null {
  if (!iso) return null
  const zeit = new Date(iso).getTime()
  if (Number.isNaN(zeit)) return null
  return Math.floor((Date.now() - zeit) / 86_400_000)
}

/** „gerade eben", „seit 20 Min.", „seit 4 Std.", „seit 3 Tagen". */
export function seitText(iso: string | null | undefined): string {
  if (!iso) return ''
  const zeit = new Date(iso).getTime()
  if (Number.isNaN(zeit)) return ''
  const minuten = Math.floor((Date.now() - zeit) / 60_000)
  if (minuten < 1) return 'gerade eben'
  if (minuten < 60) return `seit ${minuten} Min.`
  const stunden = Math.floor(minuten / 60)
  if (stunden < 24) return `seit ${stunden} Std.`
  const tage = Math.floor(stunden / 24)
  return tage === 1 ? 'seit 1 Tag' : `seit ${tage} Tagen`
}

/**
 * Wie lange ein Auftrag schon läuft: „seit 3 Tagen" – in Amber, sobald es
 * länger als `LANGE_UNTERWEGS` dauert **und** der Auftrag noch offen ist.
 *
 * Der Zeitpunkt ist der Versand (sonst das Anlegen): Ein Entwurf, der drei
 * Wochen liegt, ist ein anderes Problem als ein Paket, das drei Wochen unterwegs
 * ist – deshalb entscheidet `offen` über die Farbe, nicht der Zustand allein.
 */
export function AlterMarke({
  seit,
  offen,
}: {
  seit: string | null | undefined
  offen: boolean
}) {
  const tage = alterTage(seit)
  if (tage === null) return null
  const lang = offen && tage >= LANGE_UNTERWEGS
  // Kein `title`: Der Text sagt selbst, wie lange es läuft – und Hinweise hängen
  // an `<Tooltip>`, nicht am Attribut (DEC-088).
  return (
    <span className={`ui-alter ${lang ? 'ui-alter-lang' : 'text-slate-600'}`}>
      {lang && <AlertCircleIcon className="h-3 w-3 shrink-0" />}
      {seitText(seit)}
    </span>
  )
}

/**
 * „Rückweg" kennzeichnet einen Auftrag, der aus einem anderen hervorgeht.
 * Eigene Farbe, damit sie nicht mit „Entwurf"/„storniert" verwechselt wird.
 */
export function RueckwegMarke() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/60 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-slate-600">
      <span aria-hidden="true">↩</span>
      Rückweg
    </span>
  )
}

/**
 * Einheitlicher Leerzustand der Logistik-Ansichten.
 *
 * Vorher hatte jede Ansicht ihre eigene Form (gepolsterte Fläche, nackter Satz,
 * Tabellenzeile). Jetzt überall dieselbe ruhige Fläche mit einem Satz – und,
 * wenn es einen naheliegenden nächsten Schritt gibt, einem Knopf dazu.
 */
export function Leerzustand({
  text,
  hinweis,
  aktion,
}: {
  text: string
  hinweis?: string
  aktion?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-white/60 bg-white/30 px-4 py-5">
      <p className="text-sm font-semibold text-slate-700">{text}</p>
      {hinweis && <p className="text-xs text-slate-600">{hinweis}</p>}
      {aktion && (
        <button type="button" onClick={aktion.onClick} className="ui-btn ui-btn-secondary ui-btn-sm">
          {aktion.label}
        </button>
      )}
    </div>
  )
}

const WERKZEUG_TON: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-800',
  lent: 'bg-slate-500/15 text-slate-700',
  in_transit: 'bg-sky-500/15 text-sky-800',
  defective: 'bg-amber-500/18 text-amber-800',
  maintenance: 'bg-amber-500/18 text-amber-800',
}

const WERKZEUG_TEXT: Record<string, string> = {
  available: 'verfügbar',
  lent: 'ausgeliehen',
  in_transit: 'unterwegs',
  defective: 'defekt',
  maintenance: 'in Wartung',
}

/** Zustand eines Werkzeugs als Marke (eigene Töne, getrennt vom Auftrag). */
export function WerkzeugMarke({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-600">—</span>
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
        WERKZEUG_TON[status] ?? 'bg-slate-500/12 text-slate-700'
      }`}
    >
      {WERKZEUG_TEXT[status] ?? status}
    </span>
  )
}

/** „18.10.2026, 14:05" – oder ein Strich, wenn nichts gesetzt ist. */
/** Initialen einer Person: „Anna Ausleiherin" → „AA" (höchstens zwei Buchstaben). */
export function initialen(name: string | null | undefined): string {
  if (!name) return '–'
  const teile = name.trim().split(/\s+/)
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase()
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase()
}

/**
 * Eine Person in der Kette „angelegt → verschickt → bestätigt" (DEC-090).
 *
 * Angezeigt werden die **Initialen** – der volle Name steht im Tooltip. So bleibt
 * die Zeile schmal, und trotzdem ist zu sehen, wer gehandelt hat: das war die
 * Lücke, die der Inhaber genannt hat („wer angelegt hat, wer verschickt hat, wer
 * angenommen hat").
 */
export function PersonMarke({
  rolle,
  name,
  farbe = 'neutral',
}: {
  /** Was die Person getan hat („angelegt"). */
  rolle: string
  name: string
  /** `neutral` (grau) oder `werk` (in der Farbe des Arbeitswerks). */
  farbe?: 'neutral' | 'werk'
}) {
  return (
    <Tooltip text={`${rolle}: ${name}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          farbe === 'werk'
            ? 'bg-[var(--werk-soft,rgba(15,118,110,0.1))] text-[var(--werk-text,#115e59)]'
            : 'bg-slate-900/[0.06] text-slate-700'
        }`}
      >
        <span className="font-normal opacity-80">{rolle}</span>
        <span className="font-mono">{initialen(name)}</span>
      </span>
    </Tooltip>
  )
}

/** Die Personen eines Auftrags als Kette: wer angelegt, verschickt, bestätigt hat. */
export function PersonenKette({ order }: { order: TransportOrder }) {
  const bestaetiger = [
    ...new Set(
      order.items
        .map((item) => item.received_by_name)
        .filter((name): name is string => !!name),
    ),
  ]
  const teile: { rolle: string; name: string }[] = []
  if (order.created_by_name) teile.push({ rolle: 'angelegt', name: order.created_by_name })
  if (order.sent_by_name) teile.push({rolle: 'verschickt', name: order.sent_by_name })
  bestaetiger.forEach((name) => teile.push({ rolle: 'bestätigt', name }))
  if (teile.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {teile.map((teil, index) => (
        <PersonMarke
          key={`${teil.rolle}-${teil.name}-${index}`}
          rolle={teil.rolle}
          name={teil.name}
        />
      ))}
      {order.item_count > 0 && (
        <span className="text-[10px] font-semibold text-slate-600">
          {order.received_count}/{order.item_count} angekommen
        </span>
      )}
    </div>
  )
}

export function formatZeitpunkt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const datum = new Date(iso)
  if (Number.isNaN(datum.getTime())) return iso
  return datum.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** „18.10.2026" – für Kopfzeilen. */
export function formatTag(iso: string | null | undefined): string {
  if (!iso) return '—'
  const datum = new Date(iso)
  if (Number.isNaN(datum.getTime())) return iso
  return datum.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Werkzeug-ID in Mono-Markierung; ohne ID steht „ohne ID" (DEC-055). */
export function WerkzeugKennung({ code }: { code: string | null }) {
  if (!code) {
    return (
      <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
        ohne ID
      </span>
    )
  }
  return (
    <code className="inline-flex rounded-lg border border-teal-700/30 bg-white/80 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
      {code}
    </code>
  )
}

/** „Art · Typ · Maß" in einer Zelle (die Demo-Spalte der Logistik). */
export function WerkzeugKurz({
  category,
  toolType,
  measure,
}: {
  category: string | null
  toolType: string | null
  measure: string | null
}) {
  const teile = [category, toolType, measure].filter(
    (teil): teil is string => !!teil && teil.trim() !== '',
  )
  return (
    <span className="text-xs text-slate-600">{teile.length ? teile.join(' · ') : '—'}</span>
  )
}
