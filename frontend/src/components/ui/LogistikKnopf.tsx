// Logistik-Knopf der rechten Spalte (DEC-097).
//
// Vorlage war die Demo des Inhabers (`docs/demo-Logistik-Button.html`, „Variante 7
// Glass"): **Glasfläche**, darin links ein Zeichen in einem **Verlauf**-Feld, rechts
// die Zahl und der Satz „Logistik · Öffnen ›". Das ist mehr Knopf als Karte – und
// genau das war der Wunsch: „mach bitte KPI Logistik so, dass er auch wie ein
// Button aussieht."
//
// Angepasst an dieses Design (nicht an die Demo-Farben):
//   * Glas statt weißer Fläche (dieselbe Fläche wie die Karten daneben),
//   * Verlauf und Schatten in der **Werkfarbe** (`--werk-hell` → `--werk`),
//   * Ecken und Abstände wie die übrigen Bausteine (0,85 rem / 12 px).
//
// Er steht **über** den Kennzahl-Karten: erst der Weg in den Bereich, dann die
// Zahlen. Ampel-Regel der Spalte: dieser Knopf ist der einzige mit Verlauf.

import { AlertCircleIcon, ChevronRightIcon, TruckIcon } from '../icons'
import Tooltip from './Tooltip'

interface LogistikKnopfProps {
  /** Offene Aufträge (Zahl im Knopf). `null` = noch nicht geladen. */
  zahl: number | null
  /** Aufträge, die länger als 7 Tage offen sind (Amber-Marke, DEC-092). */
  ueberfaellig: number
  /** Steht der Bereich gerade offen? */
  aktiv: boolean
  onClick: () => void
}

export default function LogistikKnopf({
  zahl,
  ueberfaellig,
  aktiv,
  onClick,
}: LogistikKnopfProps) {
  return (
    <Tooltip
      text="Werkzeuge zwischen den Werken: Aufträge, Eingang, Wo ist was, Historie"
      className="block w-full"
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={aktiv}
        aria-label={`Logistik öffnen – ${zahl ?? 0} offene Aufträge${
          ueberfaellig > 0 ? `, davon ${ueberfaellig} über 7 Tage alt` : ''
        }`}
        className={`logistik-knopf ${aktiv ? 'is-active' : ''}`}
      >
        {/* Zeichen im Verlauf der Werkfarbe – das auffälligste Element. */}
        <span aria-hidden="true" className="logistik-zeichen">
          <TruckIcon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-baseline gap-1.5">
            <span className="logistik-zahl">{zahl === null ? '—' : zahl}</span>
            {ueberfaellig > 0 && (
              <span className="logistik-marke" aria-hidden="true">
                <AlertCircleIcon className="h-3 w-3" />
                {ueberfaellig}
              </span>
            )}
          </span>
          <span className="logistik-label">
            Logistik · <strong>Öffnen</strong>
            <ChevronRightIcon className="logistik-pfeil h-3 w-3" />
          </span>
        </span>
      </button>
    </Tooltip>
  )
}
