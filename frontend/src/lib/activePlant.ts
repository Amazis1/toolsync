// Arbeitswerk des Benutzers (DEC-070).
//
// Das Werk ist **kein** Stammdatenfeld am Benutzer, sondern der Kontext, in dem er
// gerade arbeitet: Das Personal rotiert zwischen den Werken, die Wahl gilt pro
// Benutzer **und** pro Rechner und ist jederzeit änderbar.
//
// Reihenfolge (dieselbe wie im Backend, `app/dependencies/plant.py`):
//   1. Wahl dieses Benutzers auf diesem Rechner   → `toolsync.plant.<benutzer-id>`
//   2. `users.default_plant_id` (Vorgabe im Konto)
//   3. Wahl dieses Rechners                       → `toolsync.plant.device`
//   4. erstes Werk der Anmeldung                  → `/auth/me` (Feld `plant_id`)
//
// Der Wert geht als Header `X-Plant-Id` mit **jeder** Anfrage hinaus
// (`lib/transport.ts`). Gespeichert wird nur die Kennung – keine Kopien von Daten,
// damit keine zweite Datenhaltung entsteht.
//
// `useSyncExternalStore` sorgt dafür, dass alle Bausteine (Umschalter, Werkfarbe,
// Formulare) dieselbe Wahl sehen und ein Wechsel überall sofort ankommt.

import { useSyncExternalStore } from 'react'

const KEY_USER = 'toolsync.plant.' // + Benutzer-Id
const KEY_DEVICE = 'toolsync.plant.device'

const listeners = new Set<() => void>()

function melde(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function lese(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel)
  } catch {
    return null
  }
}

function schreibe(schluessel: string, wert: string): void {
  try {
    localStorage.setItem(schluessel, wert)
  } catch {
    // Privater Modus o. Ä. – die Wahl gilt dann nur für diese Sitzung
  }
}

/**
 * Das gemerkte Arbeitswerk: Wahl des Benutzers, sonst Wahl des Rechners.
 * `null` heißt „noch nichts gewählt" – dann greift die Vorgabe aus dem Konto
 * bzw. die des Servers.
 */
export function getRememberedPlantId(userId: number | null | undefined): number | null {
  if (userId) {
    const wert = lese(KEY_USER + userId)
    if (wert) return Number(wert)
  }
  const geraet = lese(KEY_DEVICE)
  return geraet ? Number(geraet) : null
}

/** Arbeitswerk setzen – gemerkt für den Benutzer **und** für diesen Rechner. */
export function setActivePlantId(userId: number | null | undefined, plantId: number): void {
  if (userId) schreibe(KEY_USER + userId, String(plantId))
  schreibe(KEY_DEVICE, String(plantId))
  melde()
}

/** Wahl vergessen (z. B. beim Abmelden) – der Rechner-Schlüssel bleibt stehen. */
export function forgetPlantChoice(userId: number | null | undefined): void {
  if (!userId) return
  try {
    localStorage.removeItem(KEY_USER + userId)
  } catch {
    // ignorieren
  }
  melde()
}

/**
 * Das Arbeitswerk, das mit der nächsten Anfrage mitgeht.
 *
 * Der Anfrageweg ruft das bei **jeder** Anfrage auf, deshalb ist die zuletzt
 * gesetzte Wahl maßgeblich (sie ist bereits im Speicher abgelegt). `fallback` ist
 * das, was der Server zuletzt als Arbeitswerk genannt hat (`/auth/me`), und wird
 * nur benutzt, solange nichts gewählt ist.
 */
export function resolvePlantIdForRequest(
  userId: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  const gemerkt = getRememberedPlantId(userId)
  return gemerkt ?? (fallback ?? null)
}

/**
 * Reaktiver Zugriff auf die Wahl: liefert die Kennung, die der Umschalter zeigen
 * soll. Ohne Wahl ist das die Server-Vorgabe (Konto bzw. erstes Werk).
 */
export function useActivePlantId(
  userId: number | null | undefined,
  serverPlantId: number | null | undefined,
): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? getRememberedPlantId(userId) : null) ?? (serverPlantId ?? null),
    () => serverPlantId ?? null,
  )
}

/** Für Stellen ohne Hook (z. B. Ereignis-Handler): dieselbe Regel wie oben. */
export function currentPlantId(
  userId: number | null | undefined,
  serverPlantId: number | null | undefined,
): number | null {
  return resolvePlantIdForRequest(userId, serverPlantId)
}
