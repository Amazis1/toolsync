// Werkfarbe in der Oberfläche (DEC-076).
//
// Das Arbeitswerk färbt Knöpfe, den aktiven Reiter und Tabellenzeilen. Die Farbe
// wird als CSS-Variablen auf `document.documentElement` gesetzt – dieselbe Bauart
// wie die übrigen Design-Tokens (`--ui-*`) – damit jede Stelle sie über `var(--werk)`
// benutzen kann, ohne sie durch alle Bausteine zu reichen.
//
// Keine farbigen Kanten: die Werkfarbe steht nur auf Flächen, Knöpfen, Werk-Namen
// und als Zeilenfarbe von Tabellen (Vorgabe des Projektinhabers, DEC-076).

import { useEffect, useSyncExternalStore } from 'react'
import { getPlants } from '../api/admin'
import type { Plant } from '../api/types'
import { useActivePlantId } from './activePlant'

/** Primärfarbe, wenn ein Werk keine eigene Farbe gepflegt hat. */
export const FALLBACK_PLANT_COLOR = '#0f766e'

/** `#rrggbb` mit Alphakanal, z. B. für den 10-%-Schimmer. */
export function withAlpha(hex: string, alpha: number): string {
  const wert = hex.replace('#', '')
  const voll = wert.length === 3 ? wert.split('').map((z) => z + z).join('') : wert
  const zahl = Number.parseInt(voll, 16)
  const r = (zahl >> 16) & 255
  const g = (zahl >> 8) & 255
  const b = zahl & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Dieselbe Farbe **dunkler** – für Text auf einer getönten Fläche (DEC-089).
 *
 * `#0f766e` als Text hat 4,3:1; auf einer 18-%-Tinte bleibt davon zu wenig übrig.
 * Der Faktor 0,78 macht daraus `#0b5c56` (rund 7:1 auf hellem Glas) und hält den
 * Farbton – der Knopf trägt weiter die Farbe des Werks, nur lesbar.
 */
export function dunkler(hex: string, faktor = 0.78): string {
  const wert = hex.replace('#', '')
  const voll = wert.length === 3 ? wert.split('').map((z) => z + z).join('') : wert
  const zahl = Number.parseInt(voll, 16)
  const teil = (v: number) => Math.max(0, Math.min(255, Math.round(v * faktor)))
  const r = teil((zahl >> 16) & 255)
  const g = teil((zahl >> 8) & 255)
  const b = teil(zahl & 255)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/* Werkliste einmal je Sitzung laden – sie ändert sich nur im Admin-Panel.
   Ein kleiner Zwischenspeicher genügt: die Komponenten fragen im Renderzyklus. */
let werkListe: Plant[] = []
let werkZusage: Promise<Plant[]> | null = null
const horcher = new Set<() => void>()

function melde(): void {
  for (const z of horcher) z()
}

function subscribe(listener: () => void): () => void {
  horcher.add(listener)
  return () => horcher.delete(listener)
}

function ladeWerkListe(): void {
  if (werkZusage) return
  werkZusage = getPlants()
    .then((liste) => {
      werkListe = liste
      melde()
      return liste
    })
    .catch(() => werkListe)
    .finally(() => {
      werkZusage = null
    })
}

/** Werkliste reaktiv (für den Umschalter und die Farbzuordnung). */
export function usePlants(): Plant[] {
  const liste = useSyncExternalStore(
    subscribe,
    () => werkListe,
    () => werkListe,
  )
  useEffect(() => {
    ladeWerkListe()
  }, [])
  return liste
}

/** Farbe eines Werks – `null`, wenn keine gepflegt ist. */
export function plantColor(plants: Plant[], plantId: number | null | undefined): string | null {
  if (plantId == null) return null
  const werk = plants.find((p) => p.id === plantId)
  return werk?.color || null
}

/**
 * Setzt `--werk`, `--werk-soft` und `--werk-line` für das aktive Werk.
 * Liefert die Farbe zurück (für Stellen, die sie direkt brauchen).
 */
export function usePlantTheme(
  userId: number | null | undefined,
  serverPlantId: number | null | undefined,
): string {
  const plants = usePlants()
  const aktiv = useActivePlantId(userId, serverPlantId)
  const farbe = plantColor(plants, aktiv) ?? FALLBACK_PLANT_COLOR

  useEffect(() => {
    const wurzel = document.documentElement
    wurzel.style.setProperty('--werk', farbe)
    wurzel.style.setProperty('--werk-soft', withAlpha(farbe, 0.1))
    wurzel.style.setProperty('--werk-line', withAlpha(farbe, 0.3))
    // Für den Logistik-Knopf (DEC-089): ruhende Fläche, Hover und Textfarbe.
    wurzel.style.setProperty('--werk-tinte', withAlpha(farbe, 0.18))
    wurzel.style.setProperty('--werk-tinte-hover', withAlpha(farbe, 0.28))
    wurzel.style.setProperty('--werk-text', dunkler(farbe))
    wurzel.dataset.werk = String(aktiv ?? '')
  }, [farbe, aktiv])

  return farbe
}
