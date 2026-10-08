/**
 * Anzeigename eines Werkzeugs für Stellen, an denen bisher die Werkzeug-ID stand.
 *
 * Stempel brauchen eine ID, Abstreifer und Matrize nicht (DEC-055). Damit
 * „keine ID" nicht wie ein Anzeigefehler aussieht – und damit aus einem
 * `null` nie „null" oder „undefined" auf dem Bildschirm wird – steht dort
 * überall „ohne ID" (gleiche Schreibweise wie „keine Maße" in der Liste).
 */
export const TOOL_WITHOUT_ID = 'ohne ID'

export function toolLabel(toolId: string | null | undefined): string {
  const cleaned = toolId?.trim()
  return cleaned ? cleaned : TOOL_WITHOUT_ID
}
