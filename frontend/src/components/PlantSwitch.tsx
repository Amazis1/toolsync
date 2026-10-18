// Arbeitswerk (DEC-070) in der Oberfläche – als **Baustein der Sidebar**.
//
// Das Arbeitswerk steht unter dem Benutzerblock in der Sidebar: dort, wo auch
// Profil, Admin-Panel und Abmelden sitzen. Damit ist es in jedem Bereich sichtbar
// und braucht weder einen eigenen Tab noch eine zusätzliche Leiste über dem
// Inhalt (die hat die Tabellen nach unten gedrückt – TASK-030).
//
// Jede Wahl ist ein Knopf mit dem Farbpunkt ihres Werks (DEC-076). Der Wechsel
// lädt die aktiven Daten neu (`onChanged`) und gilt sofort für alle folgenden
// Anfragen (Header `X-Plant-Id`, `lib/plantContext.ts`).

import { useEffect, useState } from 'react'
import { getPlants } from '../api/admin'
import type { Plant } from '../api/types'
import { currentPlantId } from '../lib/activePlant'
import { choosePlant } from '../lib/plantContext'

interface PlantSwitchProps {
  /** Angemeldeter Benutzer – für den Merkzettel pro Person. */
  userId: number | null | undefined
  /** Arbeitswerk, das der Server aufgelöst hat (aus `/auth/me`). */
  serverPlantId: number | null | undefined
  /** Wird nach einem Wechsel gerufen (Daten neu laden). */
  onChanged?: () => void
}

export default function PlantSwitch({
  userId,
  serverPlantId,
  onChanged,
}: PlantSwitchProps) {
  const [plants, setPlants] = useState<Plant[]>([])
  const [error, setError] = useState<string | null>(null)
  const aktiv = currentPlantId(userId, serverPlantId)

  useEffect(() => {
    let abgesagt = false
    getPlants()
      .then((liste) => {
        if (!abgesagt) setPlants(liste)
      })
      .catch(() => {
        if (!abgesagt) setError('Werkliste nicht geladen')
      })
    return () => {
      abgesagt = true
    }
  }, [])

  function wechseln(plantId: number) {
    if (plantId === aktiv) return
    choosePlant(plantId)
    onChanged?.()
  }

  return (
    <div className="space-y-1" role="group" aria-label="Arbeitswerk wählen">
      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Arbeitswerk
        </span>
        {error && <span className="text-[10px] text-slate-500">{error}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        {plants.map((plant) => {
          const istAktiv = plant.id === aktiv
          const farbe = plant.color || '#0f766e'
          return (
            <button
              key={plant.id}
              type="button"
              onClick={() => wechseln(plant.id)}
              aria-pressed={istAktiv}
              title={istAktiv ? `${plant.name} (Arbeitswerk)` : `Zu ${plant.name} wechseln`}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs font-semibold transition-colors"
              style={{
                color: istAktiv ? farbe : '#334155',
                background: istAktiv ? `${farbe}1a` : 'transparent',
                boxShadow: istAktiv ? `inset 2px 0 0 ${farbe}` : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: farbe }}
              />
              <span className="truncate">{plant.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
