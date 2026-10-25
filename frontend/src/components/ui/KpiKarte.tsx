// Kennzahl-Karte im Stil der Styleguide-KPI-Karten („KPI- & Statistik-Karten",
// `UI-Styleguide.html`). Eine Karte für **beide** Stellen (DEC-089):
//
//   * rechte Spalte (`.app-stat-card`, kompakt: kleines Zeichen, `text-2xl`)
//     – Zahlen des Arbeitswerks, jede Karte ein Sprung in den Bereich,
//   * Logistik-Bereich (Filter-Karten: `aktiv` + `onClick`), dieselbe Form,
//     damit Kachel und Karte nicht wie zwei Systeme aussehen.
//
// Der Farb-Glow ist rein dekorativ und trägt `pointer-events-none`; die Zahlen
// sind `tabular-nums`, damit sie beim Nachführen nicht springen.

import type { ReactNode } from 'react'
import { ChevronRightIcon } from '../icons'
import Tooltip from './Tooltip'

type Farbe = 'teal' | 'emerald' | 'amber' | 'sky'

/** Tailwind-Klassen **wörtlich** – nur so erzeugt der Compiler sie. */
const FARBEN: Record<Farbe, { glow: string; zeichen: string; rand: string }> = {
  teal: {
    glow: 'bg-teal-400/25',
    zeichen: 'bg-teal-500/15 text-teal-700 ring-1 ring-teal-500/20',
    rand: 'ring-teal-500/25',
  },
  emerald: {
    glow: 'bg-emerald-400/25',
    zeichen: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20',
    rand: 'ring-emerald-500/25',
  },
  amber: {
    glow: 'bg-amber-400/25',
    zeichen: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/20',
    rand: 'ring-amber-500/25',
  },
  sky: {
    glow: 'bg-sky-400/25',
    zeichen: 'bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20',
    rand: 'ring-sky-500/25',
  },
}

interface KpiKarteProps {
  /** Die große Zahl. `null` = noch nicht geladen (zeigt „—"). */
  zahl: number | null
  /** Was gezählt wird („Aktive Ausleihen"). */
  name: string
  /** Zeichen in der Kachel. */
  icon: ReactNode
  farbe?: Farbe
  /** Sprungziel oder Filter – mit `onClick` wird die Karte ein Knopf. */
  onClick?: () => void
  /** Zusatz oben rechts (z. B. „davon 2 alt"). */
  marke?: ReactNode
  /** Fußzeile (Meta-Zeile, Fortschritt) – nur in der rechten Spalte. */
  fuss?: ReactNode
  /** Kompakte Form für die schmale rechte Spalte. */
  kompakt?: boolean
  /** Noch schmaler (Seitenleiste, Filterzeile): ohne Glow, kleine Zahl. */
  mini?: boolean
  /** Filter aktiv (nur sinnvoll mit `onClick`). */
  aktiv?: boolean
  /**
   * Karte **sieht aus wie ein Knopf** (DEC-096): Fläche in der Werkfarbe, weiße
   * Schrift, Pfeil rechts und ein CTA-Satz („öffnen"). Für die Logistik-Karte in
   * der rechten Spalte: Sie ist keine Kennzahl zum Lesen, sondern der Einstieg in
   * einen Bereich – das soll man sehen, ohne zu überfahren.
   */
  alsKnopf?: boolean
  /** Zusatz rechts unten in der Knopf-Form („öffnen"). */
  cta?: string
  /** Steht auf dem Knopf, wenn kein `onClick` gesetzt ist. */
  titel?: string
}

export default function KpiKarte({
  zahl,
  name,
  icon,
  farbe = 'teal',
  onClick,
  marke,
  fuss,
  kompakt = false,
  mini = false,
  aktiv = false,
  alsKnopf = false,
  cta = 'öffnen',
  titel,
}: KpiKarteProps) {
  const ton = FARBEN[farbe]
  const innen = (
    <>
      {/* Dekorativer Glow, aus der Styleguide-KPI-Karte (nicht in der Mini-Form:
          dort zählt jede Zeile Platz). */}
      {!mini && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl ${ton.glow}`}
        />
      )}
      <span className="relative flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={`flex items-center justify-center ${
            kompakt ? 'h-10 w-10 rounded-lg' : mini ? 'h-7 w-7 rounded-md' : 'h-9 w-9 rounded-lg'
          } ${alsKnopf ? 'bg-white/20 text-white ring-1 ring-white/30' : ton.zeichen}`}
        >
          {icon}
        </span>
        {marke}
      </span>
      <span
        className={`relative block font-extrabold tracking-tight tabular-nums ${
          alsKnopf ? 'text-white' : 'text-slate-800'
        } ${mini ? 'mt-1.5 text-lg leading-tight' : kompakt ? 'mt-3 text-2xl' : 'mt-3 text-xl'}`}
      >
        {zahl === null ? '—' : zahl}
      </span>
      <span
        className={`relative flex items-center gap-1 font-medium ${
          alsKnopf ? 'text-white/90' : 'text-slate-600'
        } ${mini ? 'mt-0 text-[11px]' : 'mt-0.5 text-xs'}`}
      >
        {name}
        {alsKnopf && (
          <>
            <span className="opacity-70">·</span>
            <span className="font-semibold uppercase tracking-wide">{cta}</span>
            <ChevronRightIcon className="h-3 w-3 shrink-0 opacity-90 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </span>
      {fuss && !mini && (
        <span className="relative mt-3 block border-t border-white/50 pt-2">{fuss}</span>
      )}
    </>
  )

  // Knopf-Form: Fläche in der Werkfarbe (wie `.ui-btn-werk`), weiße Schrift.
  // Die Karte behält `app-stat-card` als Grundform, überschreibt aber Fläche und
  // Rahmen – so bleibt das Raster gleich und der Unterschied ist die Farbe.
  const knopfKlassen = `kpi-als-knopf text-white shadow-lg`;

  const klassen = `app-stat-card group relative block w-full overflow-hidden text-left ${
    mini ? 'rounded-xl px-2.5 py-2' : kompakt ? 'rounded-2xl p-4' : 'rounded-xl p-3'
  } ${alsKnopf ? knopfKlassen : ton.rand} shadow-lg transition-all duration-300 ${
    onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''
  } ${aktiv && !alsKnopf ? 'is-aktiv' : ''}`

  // Kein `title`: erklärende Hinweise laufen über `<Tooltip>` (DEC-088), damit
  // sie auch in Tabellen und an Rändern vollständig erscheinen.
  const karte = onClick ? (
    <button type="button" onClick={onClick} className={klassen} aria-pressed={aktiv}>
      {innen}
    </button>
  ) : (
    <div className={klassen}>{innen}</div>
  )

  if (!titel) return karte
  return (
    <Tooltip text={titel} className="block w-full">
      {karte}
    </Tooltip>
  )
}
