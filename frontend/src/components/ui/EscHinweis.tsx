// „Esc"-Kürzel neben dem ✕ in der Kopfzeile eines Fensters (DEC-087).
//
// Der Projektinhaber wollte keinen Hinweisblock („nimmt zu viel Platz weg"),
// sondern das Kürzel selbst: „einfach neben dem Kreuz den ‚Esc'-Hinweis".
// Es ist genau die Taste, die in jedem Fenster dasselbe tut – ein Zeichen pro
// Fenster statt einer Zeile, und die Kopfzeile wächst nicht.
//
// Der erklärende Satz hängt als Tooltip an der Taste (DEC-088) – nicht mehr als
// `title`, damit überall dieselbe Sprechblase erscheint.
//
// Einsatz: in der Kopfzeile **unmittelbar links vom ✕** (im selben Flex-Block)
// und im Anlegeformular links neben „Zurück".

import Tooltip from './Tooltip'

interface EscHinweisProps {
  /** Wofür die Taste hier steht – als Tooltip, nicht als Text (Platz). */
  titel?: string
}

export default function EscHinweis({ titel = 'Mit der Esc-Taste schließen' }: EscHinweisProps) {
  return (
    <Tooltip text={titel}>
      <kbd className="select-none rounded border border-blue-900/20 bg-white/70 px-1 font-mono text-[11px] font-bold text-slate-700">
        Esc
      </kbd>
    </Tooltip>
  )
}
