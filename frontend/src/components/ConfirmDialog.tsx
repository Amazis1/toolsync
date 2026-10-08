import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../lib/useEscapeKey'

interface ConfirmDialogProps {
  /** Frage, die das betroffene Objekt benennt – z. B. `Werkzeug „TS-1004" löschen?` */
  title: string
  /** Was passiert und ob es rückgängig zu machen ist. */
  description?: string
  /** Beschriftung des Bestätigen-Buttons: wiederholt die Konsequenz, nie „OK“. */
  confirmLabel: string
  cancelLabel?: string
  /** Läuft die Aktion gerade? Dann sind beide Buttons gesperrt. */
  busy?: boolean
  busyLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Bestätigungsdialog für destruktive Aktionen – im Glas-System
 * (`.modal-overlay` / `.modal-panel` / `.ui-btn-danger`), damit die
 * Bestätigung aussieht wie der Rest der Anwendung und der Bestätigen-Button
 * die Konsequenz benennt statt „OK“ zu sagen.
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  busy = false,
  busyLabel = 'Wird ausgeführt …',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Fokus in den Dialog holen und beim Schließen zurückgeben – sonst verlieren
  // Tastaturnutzer ihre Position in der Liste. „Abbrechen“ ist der sichere Start.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  // Escape bricht ab (Nutzerkontrolle) – nicht, während die Aktion läuft.
  useEscapeKey(onCancel, !busy)

  // Der Dialog liegt in einem Portal an <body>: `.app-content-block` (und jede
  // Glasfläche) hat `backdrop-filter`, und das macht ein Element zum
  // Bezugsrahmen für `position: fixed`. Ohne Portal deckt die Abdunklung nur den
  // Inhaltsblock ab und der Dialog klebt darin statt im Fenster (Regel 11,
  // „Zwei Fallen im Glas-System").
  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-slate-600">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="ui-btn ui-btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
