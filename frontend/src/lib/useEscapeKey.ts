import { useEffect } from 'react'

/**
 * Schließt ein Overlay per Escape-Taste.
 *
 * Tastaturnutzer brauchen einen Ausweg, ohne die Maus zu benutzen – deshalb
 * hören alle Modals und Dialoge auf `Escape`. `active: false` kann genutzt
 * werden, solange eine Aktion läuft (dann darf nicht abgebrochen werden).
 */
export function useEscapeKey(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, active])
}
