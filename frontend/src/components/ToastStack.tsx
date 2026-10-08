import { createPortal } from 'react-dom'
import { AlertCircleIcon, InfoIcon, XIcon } from './icons'
import type { Toast, ToastVariant } from '../lib/useToasts'

interface ToastStackProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

/** Kurzzeichen im Toast: Erfolg = Haken, alles andere = Ausrufezeichen/Info. */
function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === 'success') return <span className="ui-toast-icon">✓</span>
  if (variant === 'info') {
    return (
      <span className="ui-toast-icon">
        <InfoIcon className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span className="ui-toast-icon">
      <AlertCircleIcon className="h-3 w-3" />
    </span>
  )
}

/**
 * Toast-Stapel unten rechts (`.ui-toast-stack`).
 *
 * `role="status"` + `aria-live="polite"`: Screenreader lesen die Meldung vor,
 * ohne die laufende Bedienung zu unterbrechen. Der Fortschrittsbalken
 * (`.ui-toast-life`) zeigt, wie lange die Meldung noch bleibt — er ist rein
 * visuell und deshalb `aria-hidden`.
 *
 * Der Stapel liegt in einem **Portal an `<body>`**: `.app-content-block` hat
 * `backdrop-filter`, und das macht ein Element zum Bezugsrahmen für
 * `position: fixed`. Innerhalb des Blocks würde der Toast unten rechts im
 * *Block* landen (also außerhalb des Bildes) statt im Fenster.
 */
export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className="ui-toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`ui-toast ui-toast-${toast.variant}`}>
          <ToastIcon variant={toast.variant} />
          <div className="min-w-0 flex-1">
            <p className="ui-toast-title">{toast.title}</p>
            {toast.message && <p className="ui-toast-msg">{toast.message}</p>}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Meldung schließen"
            className="ui-toast-close"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
          <span
            className="ui-toast-life"
            style={{ animationDuration: `${toast.duration}ms` }}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>,
    document.body,
  )
}
