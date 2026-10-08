import type { ReactNode } from 'react'
import { ResetIcon, StarIcon } from '../icons'
import { TOOL_CATEGORY_LABELS } from '../../api/types'
import type { Plant, ToolCategory } from '../../api/types'
import type { ToolQuery } from '../../lib/toolQuery'

interface ToolQuickFiltersProps {
  query: ToolQuery
  plants: Plant[]
  onQueryChange: (patch: Partial<ToolQuery>) => void
  /** Setzt alle Filter zurück (auch Suche, Status, Typ, Bestand, Lagerplatz). */
  onReset: () => void
}

/** Trennstrich zwischen den Gruppen – auf schmalen Geräten entfällt er,
 *  weil die Zeile dort umbricht und ein Strich am Zeilenanfang irreführt. */
function Separator() {
  return <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-white/70 lg:block" />
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold text-slate-600">{children}</span>
}

/**
 * Unsichtbare, aber **flächige** Eingabe.
 *
 * `sr-only` würde die Eingabe auf 1×1 px schrumpfen lassen; dann liegt das
 * Label darüber und fängt jeden Klick ab (auch Klick-Automatisierung scheitert
 * daran). Als transparente Fläche über dem Segment ist die Eingabe selbst das
 * Klickziel, bleibt für Screenreader vorhanden (opacity 0 versteckt nichts) und
 * bekommt über `.ui-segments label:has(input:focus-visible)` einen Fokusring.
 */
const INPUT_COVER = 'absolute inset-0 h-full w-full cursor-pointer opacity-0'

/**
 * Schnellfilter in der Kopfzeile der Liste („in der Zeile, wo Werkzeuge steht").
 *
 * Kategorie ist ein **Kontrollkästchen** (mehrere Kategorien gleichzeitig sind
 * sinnvoll: „Stempel und Abstreifer"), Werk ein **Radio** (ein Werkzeug gehört
 * genau einem Werk) und Favoriten ein einzelner Umschalter.
 *
 * Alle drei sind native `<input>`-Felder, die nur unsichtbar sind – die
 * Beschriftung ist der Knopf. Das spart eine halbe ARIA-Nachbildung: Semantik,
 * Pfeiltasten-Navigation und Fokusverhalten kommen vom Browser.
 */
export default function ToolQuickFilters({
  query,
  plants,
  onQueryChange,
  onReset,
}: ToolQuickFiltersProps) {
  const categories = Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]
  // Nur die Filter dieser Zeile – Suche und Detailfilter stehen in der Leiste
  // darunter, und die Sortierung gehört bewusst nicht hierher: sie wird über
  // die Spaltenköpfe gesetzt und mit einem dritten Klick wieder abgewählt.
  const quickActive =
    query.categories.length > 0 || query.plantId !== null || query.favoritesOnly

  function toggleCategory(category: ToolCategory, checked: boolean) {
    onQueryChange({
      categories: checked
        ? [...query.categories, category]
        : query.categories.filter((entry) => entry !== category),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-2">
        <GroupLabel>Kategorie</GroupLabel>
        <div role="group" aria-label="Nach Kategorie filtern" className="ui-segments">
          {categories.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                className={INPUT_COVER}
                checked={query.categories.includes(category)}
                onChange={(event) => toggleCategory(category, event.target.checked)}
              />
              {TOOL_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {plants.length > 0 && (
        <div className="flex items-center gap-2">
          <GroupLabel>Werk</GroupLabel>
          <div role="radiogroup" aria-label="Nach Werk filtern" className="ui-segments">
            <label>
              <input
                type="radio"
                name="werk-filter"
                className={INPUT_COVER}
                checked={query.plantId === null}
                onChange={() => onQueryChange({ plantId: null })}
              />
              Alle
            </label>
            {plants.map((plant) => (
              <label key={plant.id}>
                <input
                  type="radio"
                  name="werk-filter"
                  className={INPUT_COVER}
                  checked={query.plantId === plant.id}
                  onChange={() => onQueryChange({ plantId: plant.id })}
                />
                {plant.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="flex items-center gap-2">
        <GroupLabel>Favoriten</GroupLabel>
        <div className="ui-segments">
          <label>
            <input
              type="checkbox"
              className={INPUT_COVER}
              checked={query.favoritesOnly}
              onChange={(event) => onQueryChange({ favoritesOnly: event.target.checked })}
            />
            <StarIcon
              filled={query.favoritesOnly}
              className={`h-3.5 w-3.5 ${
                query.favoritesOnly ? 'text-amber-600' : 'text-slate-600'
              }`}
            />
            Nur Favoriten
          </label>
        </div>
      </div>

      {/* Zurücksetzen direkt dort, wo diese Filter sitzen. Vorher gab es nur
          „Alle Filter zurücksetzen" in der Chip-Zeile unter der Suchleiste —
          und die erscheint nicht, wenn nur Kategorie, Werk oder Favoriten
          gesetzt sind. Der Knopf erscheint auch, wenn nach einer Spalte
          sortiert ist: er stellt dann die Standardsortierung wieder her. */}
      {quickActive && (
        <button type="button" onClick={onReset} className="ui-btn ui-btn-ghost ui-btn-sm">
          <ResetIcon className="h-3.5 w-3.5" />
          Zurücksetzen
        </button>
      )}
    </div>
  )
}
