// Kleine Bausteine der Werkzeug-Logistik (DEC-072/076).
//
// Alles, was mehrere Logistik-Ansichten gemeinsam brauchen: Werknamen in der
// Farbe **ihres** Werks, Zustandsmarken mit eigenen Tönen und die Zeilenfarbe
// der Tabelle. Keine farbigen Kanten – die Werkfarbe steht auf Flächen, Knöpfen,
// Namen und als ganze Zeile (Vorgabe des Projektinhabers, DEC-076).

import type { CSSProperties } from 'react'
import { plantColor, usePlants, withAlpha } from '../../lib/plantTheme'
import type { Plant } from '../../api/types'
import {
  TRANSPORT_STATUS_LABELS,
  type TransportStatus,
} from '../../types/transport'

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

const STATUS_TON: Record<TransportStatus, string> = {
  // Entwurf ist „geplant" (gefüllt), storniert ist „erledigt/verfallen"
  // (nur Umriss). Vorher sahen beide gleich aus – zwei Zustände mit demselben
  // Grau sind auf einen Blick nicht zu unterscheiden (DEC-082).
  draft: 'bg-slate-500/15 text-slate-700',
  sent: 'bg-sky-500/15 text-sky-800',
  partly_received: 'bg-amber-500/18 text-amber-800',
  received: 'bg-emerald-500/15 text-emerald-800',
  cancelled: 'border border-slate-400/60 text-slate-500',
}

/** Zustand eines Auftrags als Marke. */
export function StatusMarke({ status }: { status: TransportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
        STATUS_TON[status] ?? STATUS_TON.draft
      }`}
    >
      {TRANSPORT_STATUS_LABELS[status] ?? status}
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
