// Der Arbeitswerk-Kontext für den Anfrageweg (DEC-070).
//
// `lib/transport.ts` sendet bei **jeder** Anfrage den Header `X-Plant-Id`. Dafür
// muss der Anfrageweg drei Dinge kennen: den angemeldeten Benutzer (für den
// Merkzettel pro Benutzer), die zuletzt vom Server genannte Vorgabe und die Wahl
// des Benutzers. Diese Datei hält diesen kleinen Zustand – **ohne** React und
// ohne Import des AuthContext, damit kein Zyklus entsteht:
//
//   plantContext  ←  transport (Header)
//        ↑
//   AuthContext (setzt Benutzer und Server-Vorgabe, lädt bei Wechsel neu)

import { forgetPlantChoice, getRememberedPlantId, setActivePlantId } from './activePlant'

interface PlantContext {
  userId: number | null
  /** Arbeitswerk, das der Server zuletzt aufgelöst hat (`/auth/me`). */
  serverPlantId: number | null
}

let context: PlantContext = { userId: null, serverPlantId: null }
let neulader: (() => Promise<void>) | null = null

export function setPlantContext(next: Partial<PlantContext>): void {
  context = { ...context, ...next }
}

export function getPlantContext(): PlantContext {
  return context
}

/** Der Wert für den Header – Wahl des Benutzers, sonst die Server-Vorgabe. */
export function plantIdForHeader(): number | null {
  const gemerkt = getRememberedPlantId(context.userId)
  return gemerkt ?? context.serverPlantId
}

/**
 * Wahl ändern. Sie gilt sofort für alle folgenden Anfragen und alle Bausteine
 * (Werkfarbe, Umschalter, Vorbelegungen); `onChange` lädt die aktiven Daten neu.
 */
export function choosePlant(plantId: number): void {
  setActivePlantId(context.userId, plantId)
  void neulader?.()
}

/** Beim Abmelden: die Wahl des Benutzers vergessen (Rechner-Wahl bleibt). */
export function clearPlantChoice(): void {
  forgetPlantChoice(context.userId)
  context = { userId: null, serverPlantId: null }
}

/** Die App meldet hier an, wie sie nach einem Werkswechsel neu lädt. */
export function setPlantReloader(reloader: (() => Promise<void>) | null): void {
  neulader = reloader
}
