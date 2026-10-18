// Kleine Textbausteine für die Oberfläche.
//
// Anlass: In der Werkzeug-Logistik stand überall „1 Werkzeug(e)" – eine
// Schreibweise, die für jede Zahl passt und deshalb nie richtig klingt
// (TASK-025b, DEC-082). Deutsch braucht den passenden Plural.

/** „1 Werkzeug" / „3 Werkzeuge" – für Zähler, Sätze und Knöpfe. */
export function werkzeuge(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Werkzeug' : 'Werkzeuge'}`
}

/** „1 Auftrag" / „3 Aufträge" – dieselbe Logik für die Logistik. */
export function auftraege(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Auftrag' : 'Aufträge'}`
}
