import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '../icons'
import { TOOL_PAGE_SIZES, pageCount, pageWindow } from '../../lib/toolQuery'

interface ToolPaginationProps {
  total: number
  page: number
  pageSize: number
  /** Beim Laden einer neuen Seite bleiben die alten Zeilen stehen. */
  busy?: boolean
  /** Zugänglicher Name der Leiste. */
  ariaLabel?: string
  /** Bezeichnung der gezählten Dinge ("Werkzeug" / "Werkzeugen"). */
  itemSingular?: string
  itemPlural?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/**
 * Blätterleiste der Werkzeugliste (.ui-pagination aus dem Styleguide).
 *
 * Zeigt immer, wo man steht: „1–25 von 342". Ohne diesen Satz wüsste man bei
 * einer vollen Seite nicht, ob noch etwas folgt.
 *
 * Die Randknöpfe tragen bewusst KEINE .ui-btn-Klasse: `.ui-pagination button`
 * setzt Größe und Fläche selbst und gewinnt gegen die Button-Klassen — die
 * Reihe bleibt dadurch in einer Größe.
 */
export default function ToolPagination({
  total,
  page,
  pageSize,
  busy = false,
  ariaLabel = 'Seitennavigation der Werkzeugliste',
  itemSingular = 'Werkzeug',
  itemPlural = 'Werkzeugen',
  onPageChange,
  onPageSizeChange,
}: ToolPaginationProps) {
  if (total === 0) return null

  const pages = pageCount(total, pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const window = pageWindow(page, pages)

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/40 pt-3"
    >
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium text-slate-700" aria-live="polite">
          <span className="font-bold text-slate-900">
            {from}–{to}
          </span>{' '}
          von <span className="font-bold text-slate-900">{total}</span>{' '}
          {total === 1 ? itemSingular : itemPlural}
        </p>
        {pages > 1 && (
          <p className="hidden text-xs text-slate-600 sm:block">
            Seite <span className="font-bold text-slate-900">{page}</span> von {pages}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          Pro Seite
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="select-bordered cursor-pointer px-2 py-1 text-base sm:text-sm"
          >
            {TOOL_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {pages > 1 && (
          <div
            className={`ui-pagination flex items-center gap-1 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              aria-label="Erste Seite"
            >
              <ChevronsLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Vorherige Seite"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>

            {window.map((entry, index) =>
              entry === 'gap' ? (
                <span
                  key={`gap-${index}`}
                  className="px-1 text-xs font-bold text-slate-600"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onPageChange(entry)}
                  aria-label={`Seite ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  className={entry === page ? 'active' : undefined}
                >
                  {entry}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === pages}
              aria-label="Nächste Seite"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pages)}
              disabled={page === pages}
              aria-label="Letzte Seite"
            >
              <ChevronsRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
