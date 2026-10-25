// Kennzahlen des Arbeitswerks – ein Haken für die rechte Spalte **und** den
// Zähler am Logistik-Knopf (DEC-089).
//
// Warum ein eigener Haken und nicht eine Zählung im Bereich: Die Karten und der
// Knopf sitzen in der App-Hülle (`App.tsx`), die Liste im Bereich „Logistik". Die
// Zahlen müssen also außerhalb bekannt sein – und sich ändern, wenn im Bereich
// etwas passiert ist (dafür gibt es `logisticsRefreshKey`).

import { useEffect, useRef, useState } from 'react'
import { getStatsOverview, type StatsOverview } from '../api/stats'
import { useActivePlantId } from './activePlant'

/** Wie oft die Zahlen ohne Anlass nachgeführt werden (ms). */
const TAKT = 60_000

export function useStatistik(
  userId: number | null | undefined,
  serverPlantId: number | null | undefined,
  auffrischen: number,
): StatsOverview | null {
  const plantId = useActivePlantId(userId ?? null, serverPlantId ?? null)
  const [zahlen, setZahlen] = useState<StatsOverview | null>(null)
  // Nur die letzte Anfrage darf schreiben: ein Werkwechsel löst zwei aus.
  const laufend = useRef(0)

  useEffect(() => {
    if (plantId === null) {
      setZahlen(null)
      return
    }
    let abgebrochen = false
    const lauf = ++laufend.current

    async function laden() {
      try {
        const antwort = await getStatsOverview()
        if (!abgebrochen && lauf === laufend.current) setZahlen(antwort)
      } catch {
        // Die Zahlen sind Beiwerk: Ohne Antwort bleiben die alten stehen, statt
        // die rechte Spalte mit einer Fehlermeldung zu belasten.
      }
    }

    void laden()
    const takt = window.setInterval(() => void laden(), TAKT)
    return () => {
      abgebrochen = true
      window.clearInterval(takt)
    }
  }, [plantId, auffrischen])

  return zahlen
}
