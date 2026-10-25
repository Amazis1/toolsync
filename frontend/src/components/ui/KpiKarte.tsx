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
  titel,
}: KpiKarteProps) {
  const ton = FARBEN[farbe]
  // Inhalt. **Mini** ist eine eigene Form (DEC-098): Zahl gegenüber dem Zeichen,
  // Unterschrift darunter – damit wird die Karte flacher (zwei Zeilen statt drei).
  const innen = mini ? (
    <>
      <span className="relative flex items-center justify-between gap-1.5">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 items-center justify-center rounded-md ${ton.zeichen}`}
        >
          {icon}
        </span>
        <span className="font-extrabold leading-none tracking-tight text-slate-800 tabular-nums text-base">
          {zahl === null ? '—' : zahl}
        </span>
      </span>
      <span className="relative mt-1 block text-[10px] font-medium leading-tight text-slate-600">
        {name}
      </span>
    </>
  ) : (
    <>
      {/* Dekorativer Glow, aus der Styleguide-KPI-Karte. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl ${ton.glow}`}
      />
      <span className="relative flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={`flex items-center justify-center ${
            kompakt ? 'h-10 w-10 rounded-lg' : 'h-9 w-9 rounded-lg'
          } ${ton.zeichen}`}
        >
          {icon}
        </span>
        {marke}
      </span>
      <span
        className={`relative block font-extrabold tracking-tight text-slate-800 tabular-nums ${
          kompakt ? 'mt-3 text-2xl' : 'mt-3 text-xl'
        }`}
      >
        {zahl === null ? '—' : zahl}
      </span>
      <span className="relative mt-0.5 block text-xs font-medium text-slate-600">{name}</span>
      {fuss && !mini && (
        <span className="relative mt-3 block border-t border-white/50 pt-2">{fuss}</span>
      )}
    </>
  )

  const klassen = `app-stat-card group relative block w-full overflow-hidden text-left ${
    mini ? 'rounded-xl px-2.5 py-2' : kompakt ? 'rounded-2xl p-4' : 'rounded-xl p-3'
  } ${ton.rand} shadow-lg transition-all duration-300 ${
    onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''
  } ${aktiv ? 'is-aktiv' : ''}`

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
