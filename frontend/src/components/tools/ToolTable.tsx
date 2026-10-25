import { useEffect, useRef, useState } from 'react'
import {
  FileTextIcon,
  SortAscIcon,
  SortDescIcon,
  SortableIcon,
  StarIcon,
} from '../icons'
import RowActionMenu from './RowActionMenu'
import { TOOL_CATEGORY_LABELS } from '../../api/types'
import type { Tool, ToolCategory, ToolSortKey } from '../../api/types'
import type { ToolQuery } from '../../lib/toolQuery'
import { toolLabel } from '../../lib/toolLabel'
import { useWerkFarben } from '../logistics/logistikTeile'
import { formatMeasureMm } from './ToolForm'
import Tooltip from '../ui/Tooltip'

interface ToolTableProps {
  tools: Tool[]
  query: ToolQuery
  loading: boolean
  busyFavoriteId: number | null
  onSort: (key: ToolSortKey) => void
  onToggleFavorite: (tool: Tool) => void
  onEdit: (tool: Tool) => void
  onDelete: (tool: Tool) => void
  onLend: (tool: Tool) => void
  /** Rückgabe eines einzelnen Werkzeugs (DEC-078) – nur bei `status = lent`. */
  onReturn: (tool: Tool) => void
  /**
   * Datenblätter dieses Werkzeugs öffnen (DEC-065 Punkt 10): wer an der Maschine
   * steht, kommt vom Werkzeug – nicht aus einer Liste. Das Symbol in der Zeile
   * steht nur, wenn es zu der ID wirklich ein Datenblatt **mit Datei** gibt
   * (`has_data_sheet`, DEC-068).
   */
  onOpenDataSheets: (tool: Tool) => void
}

/**
 * Farbkennung der Kategorie für den Chip links neben der ID.
 *
 * Nur Textfarben aus Guide §1.8 (Primär/Erfolg `#115e59`, Info `#1e3a8a`,
 * Warnung `#92400e`). Der Chip gibt der Liste Farbe, ohne eine zweite
 * Bedeutungsachse aufzumachen: einen Status zeigt die Tabelle nicht mehr.
 */
const CATEGORY_CHIP: Record<ToolCategory, string> = {
  Stempel: 'bg-teal-700/12 text-teal-800',
  Abstreifer: 'bg-sky-500/12 text-sky-800',
  Matrize: 'bg-amber-500/15 text-amber-800',
}

/**
 * Werkzeugtyp in Typ-Code und Bezeichnung trennen ("01 Rund" → "01" + "Rund").
 * Der Typ-Code ist im Projekt Bestandteil des Namens („Typ-Code + Bezeichnung");
 * als eigener kleiner Chip ist er schneller zu erfassen.
 */
function splitTypeName(name: string | null | undefined): { code: string | null; label: string } {
  if (!name) return { code: null, label: '—' }
  const match = /^(\d{1,3})\s+(.+)$/.exec(name.trim())
  if (!match) return { code: null, label: name }
  return { code: match[1], label: match[2] }
}

/** Maße als Text, z. B. „2,00 mm" oder „2,00/4,00 mm". */
function measures(tool: Tool): string | null {
  const { measure_a: a, measure_b: b } = tool
  if (!a && !b) return null
  if (a && b) return `${a}/${formatMeasureMm(b)}`
  return formatMeasureMm((a ?? b) as string)
}

/** Spaltenkopf mit Sortierung. */
function SortHeader({
  label,
  sublabel,
  sortKey,
  query,
  onSort,
  className = '',
}: {
  label: string
  sublabel?: string
  sortKey: ToolSortKey
  query: ToolQuery
  onSort: (key: ToolSortKey) => void
  className?: string
}) {
  const isActive = query.sort === sortKey
  const direction = isActive ? (query.order === 'asc' ? 'aufsteigend' : 'absteigend') : ''

  return (
    <th
      scope="col"
      // aria-sort gehört an die Kopfzelle, nicht an den Knopf: Screenreader
      // lesen damit „Spalte Bezeichnung, aufsteigend sortiert" vor.
      aria-sort={
        isActive ? (query.order === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={`px-3 py-2.5 align-bottom ${className}`}
    >
      {/* Derselbe Hinweis wie in den übrigen Listen (DEC-088): dort stand er
          als `title`, hier fehlte er ganz. */}
      <Tooltip text="Sortierung wechseln (auf → ab → Standard)" className="contents">
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-label={`Nach ${label} sortieren${
            isActive ? ` (aktuell ${direction}, nächster Klick wechselt)` : ''
          }`}
          className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-800"
        >
          <span>
            {label}
            {sublabel && (
              <span className="block text-xs font-medium normal-case tracking-normal text-slate-600">
                {sublabel}
              </span>
            )}
          </span>
          {isActive ? (
            query.order === 'asc' ? (
              <SortAscIcon className="h-3.5 w-3.5 shrink-0 text-teal-800" />
            ) : (
              <SortDescIcon className="h-3.5 w-3.5 shrink-0 text-teal-800" />
            )
          ) : (
            <SortableIcon className="h-3.5 w-3.5 shrink-0 opacity-40" />
          )}
        </button>
      </Tooltip>
    </th>
  )
}

/**
 * Werkzeugtabelle.
 *
 * Aufbau nach Guide „Tabellen & Status Badges": zweizeilige Zellen, Glasrahmen
 * (`.glass-preview-card`), farbiger Kategorie-Chip (wie im Guide-Beispiel),
 * Aktionsspalte mit `…`-Menü. Ein Status steht **nicht** in der Tabelle — er war
 * fast immer leer und wiederholte bei ausgeliehenen Werkzeugen nur das Badge.
 *
 * Spaltenreihenfolge nach Wichtigkeit für die Werkstatt: erst **wo** das
 * Werkzeug liegt (Lagerplatz mit Werk), dann was es ist (Typ, Maße), dann die
 * Beschreibung und zuletzt die Zuordnung (Kunde, Maschine).
 */
export default function ToolTable({
  tools,
  query,
  loading,
  busyFavoriteId,
  onSort,
  onToggleFavorite,
  onEdit,
  onDelete,
  onLend,
  onReturn,
  onOpenDataSheets,
}: ToolTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  // Werkfarbe für „aktuell W2" (DEC-076): fremde Werke in **ihrer** Farbe.
  const farbeVon = useWerkFarben()

  // Läuft die Tabelle seitlich über? Nur dann ist ein Hinweis nötig. Gemessen
  // statt geraten, damit der Hinweis weder auf dem großen Bildschirm stört
  // noch auf dem Telefon fehlt.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [tools.length])

  return (
    <div>
      {/* Kein eigenes Scrollfeld: Die Tabelle scrollt mit der Seite.
          Ein eigenes Feld mit begrenzter Höhe (für eine klebende Kopfzeile)
          brachte eine zweite Bildlaufleiste IN der Tabelle mit — und mit zehn
          Werkzeugen je Seite ist sie unnötig. Nebenbedingung, die dabei gilt:
          Eine klebende Kopfzeile und kein eigener Scrollbalken schließen sich
          bei einer seitlich scrollbaren Tabelle aus, weil ein `overflow`-
          Container die Bezugsfläche für `sticky` ist. Gewählt: kein Balken.
          `overflow-x-auto` bleibt für schmale Fenster (dann erscheint der
          Hinweis unter der Tabelle). */}
      <div ref={scrollRef} className="glass-preview-card overflow-x-auto">
        <table className="w-full min-w-[780px] whitespace-nowrap text-left text-xs">
          <caption className="sr-only">
            Werkzeugliste. Spaltenköpfe sind Knöpfe und sortieren die Liste.
          </caption>
          <thead className="border-b border-slate-300/60 bg-slate-200/40">
            <tr>
              <th scope="col" className="w-7 px-1 py-2.5">
                <span className="sr-only">Favorit</span>
                <StarIcon className="mx-auto h-4 w-4 text-slate-600" />
              </th>
              <SortHeader
                label="Werkzeug-ID"
                sublabel="Kategorie"
                sortKey="tool_id"
                query={query}
                onSort={onSort}
              />
              <SortHeader
                label="Lagerplatz"
                sublabel="Werk"
                sortKey="location"
                query={query}
                onSort={onSort}
              />
              <SortHeader
                label="Typ"
                sublabel="Maße"
                sortKey="tool_type"
                query={query}
                onSort={onSort}
              />
              <SortHeader
                label="Beschreibung"
                sortKey="description"
                query={query}
                onSort={onSort}
              />
              <SortHeader
                label="Kunde"
                sublabel="Maschine"
                sortKey="customer"
                query={query}
                onSort={onSort}
              />
              <th
                scope="col"
                // Ausgeschrieben statt „…"-Symbol: die Überschrift soll sagen,
                // was in der Spalte steht. In der Zeile stehen zwei Knöpfe – das
                // Datenblatt-Symbol (nur mit Datenblatt) und der schmale „…"-Knopf
                // für alle übrigen Aktionen.
                className="w-[5.4rem] px-1.5 py-2.5 text-right font-semibold uppercase tracking-wider text-slate-600"
              >
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-slate-200/50 text-slate-700 ${
              loading ? 'opacity-60' : ''
            }`}
            aria-busy={loading}
          >
            {tools.map((tool) => {
              const mass = measures(tool)
              const typ = splitTypeName(tool.tool_type?.name)
              return (
                <tr
                  key={tool.id}
                  // Glasverlauf in der Zeile (`.table-row-glass`): derselbe
                  // diagonale Verlauf wie `.glass-card`, schwach dosiert. Er
                  // liegt als Hintergrundbild über den Farbwerten, Zebra/Hover/
                  // Favoritenfarbe bleiben dadurch sichtbar.
                  //
                  // Favoriten bekommen eine eigene Zeilenfarbe (Amber) statt des
                  // Zebras – beides zusammen würde sich nur gegenseitig aufheben.
                  className={`table-row-glass transition-colors ${
                    tool.is_favorite
                      ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                      : 'even:bg-white/40 hover:bg-white/70'
                  }`}
                >
                  <td className="w-7 px-1 py-2">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(tool)}
                      aria-pressed={tool.is_favorite}
                      aria-label={
                        tool.is_favorite
                          ? `Favorit ${toolLabel(tool.tool_id)} entfernen`
                          : `${toolLabel(tool.tool_id)} zu den Favoriten hinzufügen`
                      }
                      disabled={busyFavoriteId === tool.id}
                      className={`block rounded-lg p-1 hover:bg-white/70 disabled:opacity-50 ${
                        tool.is_favorite ? 'bg-amber-500/20' : ''
                      }`}
                    >
                      <StarIcon
                        filled={tool.is_favorite}
                        className={`h-4 w-4 ${
                          tool.is_favorite ? 'text-amber-600' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Werkzeug-ID (hervorgehoben) / Kategorie */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          CATEGORY_CHIP[tool.category] ?? 'bg-white/60 text-slate-700'
                        }`}
                      >
                        {(TOOL_CATEGORY_LABELS[tool.category] ?? '?').charAt(0)}
                      </span>
                      <span className="min-w-0">
                        {/* Ohne ID (Abstreifer/Matrize) steht hier dieselbe
                            ruhige Markierung wie für „Ablage" – eine leere
                            Mono-Markierung sähe wie ein Anzeigefehler aus. */}
                        {tool.tool_id ? (
                          <code className="inline-flex rounded-lg border border-teal-700/30 bg-white/80 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                            {tool.tool_id}
                          </code>
                        ) : (
                          <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
                            {toolLabel(tool.tool_id)}
                          </span>
                        )}
                        <Tooltip
                          text={tool.coating ? `Beschichtung: ${tool.coating.name}` : undefined}
                          className="contents"
                        >
                          <span className="mt-1 block text-xs text-slate-600">
                            {TOOL_CATEGORY_LABELS[tool.category] ?? tool.category}
                            {tool.is_storage ? ' · Lager/Ersatz' : ''}
                            {/* Beschichtung mit vollem Namen („MultiDur TiCN", DEC-083).
                                Eine eigene Zeile war zwischenzeitlich nötig, solange
                                die Inhaltsspalte 9/12 breit war; mit 10/12 (mehr Platz
                                rechts) paßt sie in die Kategorie-Zeile, ohne daß die
                                Tabelle seitlich überläuft. */}
                            {tool.coating ? ` · ${tool.coating.name}` : ''}
                          </span>
                        </Tooltip>
                      </span>
                    </div>
                  </td>

                  {/* Lagerplatz (wichtiger) / Werk */}
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {tool.position_code ? (
                        // Gleiche Markierung wie die Werkzeug-ID (Größe, Form,
                        // Mono, fett) – nur mit anderer Kante: Die ID trägt Teal
                        // (Primär = Identität), der Platz Sky (Info = Ort).
                        <code className="inline-flex rounded-lg border border-sky-500/30 bg-white/85 px-2 py-0.5 font-mono text-sm font-bold tracking-tight text-slate-900">
                          {tool.position_code}
                        </code>
                      ) : (
                        <span className="inline-flex rounded-lg border border-slate-300/70 bg-white/85 px-2 py-0.5 text-xs font-bold text-slate-700">
                          Ablage
                        </span>
                      )}
                      {/* Wo ist das Werkzeug **jetzt** (DEC-071/072)? Unterwegs und
                          ausgeliehen sieht man der Zeile sonst nicht an – die Tabelle
                          führt keinen Status. Die Marke steht bei **diesem** Platz,
                          nicht in der Werk-Spalte: dort wäre sie breiter als der
                          verfügbare Raum (gemessen: 4 px Überlauf bei 1440). */}
                      {tool.status === 'in_transit' && (
                        <span className="inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-sky-800">
                          unterwegs
                        </span>
                      )}
                      {tool.status === 'lent' && (
                        <span className="inline-flex items-center rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-slate-700">
                          ausgeliehen
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {tool.plant?.name ?? '—'}
                      {/* Liegt es woanders (nach bestätigtem Empfang), steht das
                          Zielwerk in **seiner** Farbe (DEC-076); der Heimatplatz
                          darüber bleibt reserviert. */}
                      {tool.current_plant &&
                        tool.current_plant_id !== undefined &&
                        tool.current_plant_id !== tool.plant_id && (
                          <>
                            {' · aktuell '}
                            <strong
                              className="font-bold"
                              style={{ color: farbeVon(tool.current_plant.id) }}
                            >
                              {tool.current_plant.name}
                            </strong>
                          </>
                        )}
                    </span>
                  </td>

                  {/* Typ (Code + Bezeichnung) / Maße */}
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {typ.code && (
                        <span className="rounded-md bg-white/70 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                          {typ.code}
                        </span>
                      )}
                      <span className="font-semibold text-slate-900">{typ.label}</span>
                    </span>
                    <span className="block text-xs text-slate-600">
                      {mass ?? 'keine Maße'}
                    </span>
                  </td>

                  {/* Beschreibung – eigene Spalte, kein Rückfall auf den Typ.
                      Gekürzt: sonst schiebt ein langer Freitext die ganze Tabelle
                      über die Breite. Grenze von 10rem auf 9rem gesenkt, als die
                      Zustandsmarke (unterwegs/ausgeliehen) an die Platz-Spalte kam –
                      gemessen: mit 10rem war die Tabelle bei 1440×900 vier Pixel
                      breiter als ihr Bereich (TASK-025b, DEC-081). */}
                  <td className="max-w-[9rem] truncate px-3 py-2 text-slate-700">
                    {tool.description || <span className="text-slate-600">—</span>}
                  </td>

                  {/* Zuordnung: Kunde (mit dessen Farbe) / Maschine */}
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {tool.customer?.color && (
                        // Farbe des Kunden aus den Stammdaten: gleiche Kunden
                        // sind damit ohne Lesen erkennbar.
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80"
                          style={{ backgroundColor: tool.customer.color }}
                        />
                      )}
                      <span className="max-w-[8rem] truncate text-slate-900">
                        {tool.customer?.name ?? <span className="text-slate-600">—</span>}
                      </span>
                    </span>
                    <span className="block max-w-[9rem] truncate text-xs text-slate-600">
                      {tool.machine?.name ?? '—'}
                    </span>
                  </td>

                  {/* Aktionen: Datenblatt-Symbol (nur wenn es eines gibt) und
                      „…"-Menü. Das Menü fährt nach links aus. Beide Knöpfe sind
                      rechtsbündig, deshalb bleibt der „…"-Knopf in jeder Zeile
                      an derselben Stelle – auch in Zeilen ohne Symbol. */}
                  <td className="w-[5.4rem] px-1.5 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {tool.has_data_sheet && (
                        <button
                          type="button"
                          onClick={() => onOpenDataSheets(tool)}
                          aria-label={`Datenblatt zu ${toolLabel(tool.tool_id)} öffnen`}
                          className="ui-btn ui-btn-secondary ui-btn-sm"
                        >
                          <FileTextIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <RowActionMenu
                        label={toolLabel(tool.tool_id)}
                        actions={[
                          // Ausgeliehen → zurückgeben (DEC-078); sonst ausleihen.
                          // Ein Werkzeug wird **einzeln** zurückgegeben, über das
                          // Menü seiner eigenen Zeile.
                          ...(tool.status === 'lent'
                            ? [
                                {
                                  key: 'return',
                                  label: 'Zurückgeben',
                                  primary: true,
                                  onSelect: () => onReturn(tool),
                                },
                              ]
                            : [
                                {
                                  key: 'lend',
                                  label: 'Ausleihen',
                                  primary: true,
                                  onSelect: () => onLend(tool),
                                },
                              ]),
                          {
                            key: 'edit',
                            label: 'Bearbeiten',
                            onSelect: () => onEdit(tool),
                          },
                          {
                            key: 'delete',
                            label: 'Löschen',
                            danger: true,
                            onSelect: () => onDelete(tool),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Ladeplatzhalter in Zeilenform: die Tabelle behält beim ersten Laden
          ihre Höhe, statt auf einen Satz zusammenzuklappen. */}
      {loading && tools.length === 0 && (
        <div className="space-y-3 px-3 py-4" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-4">
              <span className="ui-skeleton h-7 w-7" />
              <span className="ui-skeleton h-4 w-28" />
              <span className="ui-skeleton h-3 flex-1" />
              <span className="ui-skeleton h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Hinweis nur, wenn die Tabelle tatsächlich seitlich überläuft: sonst
          sieht die abgeschnittene Kante aus wie das Ende der Liste. */}
      {overflowing && (
        <p className="mt-2 text-xs text-slate-600">
          Tabelle seitlich scrollbar – die Spalte „Aktionen“ (…) steht am rechten Rand.
        </p>
      )}
    </div>
  )
}
