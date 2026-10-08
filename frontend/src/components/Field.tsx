// Feld-Beschriftung, Hinweis und Fehlermeldung — EINE Quelle für alle Formulare.
//
// Warum es dieses Modul gibt: Vorher trug jedes Formular sein Sternchen selbst.
// Im Werkzeugformular stand `<span aria-hidden="true">*</span>` hinter „Werkzeug-ID"
// und „Maß A", aber nicht hinter „Werkzeug-Typ" und „Werk" – obwohl der Server
// alle vier verlangt. In den drei Bereichs-Formularen gab es **gar kein**
// Sternchen, obwohl „Artikelnummer" und „Werk" Pflicht sind.
//
// Hier gilt Guide §1.9 Regel 3 an genau einer Stelle: **ein** `required` je Feld
// steuert (a) das sichtbare `*` im Label und (b) das `required` am Eingabefeld.
// Beides kann damit nicht mehr auseinanderlaufen. Welches Feld Pflicht ist,
// bleibt bewusst Sache des Formulars: die Regeln sind je Reiter **unterschiedlich**
// (im Werkzeugformular hängt die ID sogar an der Kategorie) – sie sind nur noch
// nicht mehr unterschiedlich *dargestellt*.

import type { ReactNode } from 'react'

/**
 * Sichtbares Pflichtzeichen.
 *
 * Es steht **neben** dem `<label>`, nicht darin. Grund (gemessen an den
 * Browser-Tests): Steht der Stern im Label, wird der **zugängliche Name** des
 * Feldes zu „Werk*" statt „Werk". Damit trifft kein Locator mehr, der ein Feld
 * über seinen Namen sucht (`getByLabel('Werk', { exact: true })` → 0 Treffer),
 * und ein Screenreader liest das Sternchen mit vor. Neben dem Label bleibt der
 * Name sauber – die Pflicht sagt ohnehin `required` am Feld, und der Stern ist
 * reine Sehhilfe.
 */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-rose-700">
      *
    </span>
  )
}

interface FieldLabelProps {
  /** `htmlFor` des zugehörigen Feldes. */
  htmlFor: string
  children: ReactNode
  /**
   * Pflichtfeld: setzt das `*` im Label. **Dasselbe** `required` muss am
   * Eingabefeld stehen (siehe `Field`-Hinweis unten) – sonst behauptet das
   * Sternchen etwas anderes als der Browser prüft.
   */
  required?: boolean
  /**
   * Nur wenn das Label **nicht** im Inneren eines `.ui-field` sitzt, z. B. über
   * einem `textarea` (Guide §1.9 Regel 8) oder in der 3-spaltigen
   * Lagerplatz-Reihe (Ausnahme 11). Ohne diese Klasse erbt das Label die
   * Typografie des `.ui-field > label` nicht und wirkt zu groß.
   */
  standalone?: boolean
  className?: string
}

/**
 * Beschriftung eines Feldes.
 *
 * Innerhalb von `.ui-field` ist das Label ein **direktes** Kind des Wrappers –
 * `.ui-field > label` in `index.css` greift nur dann (feste Breite 7,5 rem,
 * Typografie Ebene 3). Diese Komponente gibt deshalb das `<label>` selbst
 * zurück und **keinen** umschließenden Rahmen.
 *
 * Das Pflicht-Sternchen ist ein **Geschwister** des Labels (siehe
 * `RequiredMark`), kein Kind: als Kind landete es im zugänglichen Namen und
 * damit in jedem `getByLabel('Werk', { exact: true })`. Innerhalb der
 * senkrechten `.ui-field`-Reihe sitzt es direkt neben dem Label; bei
 * `standalone` (Label über dem Feld) direkt dahinter.
 */
export function FieldLabel({
  htmlFor,
  children,
  required = false,
  standalone = false,
  className,
}: FieldLabelProps) {
  return (
    <>
      <label
        htmlFor={htmlFor}
        className={`${standalone ? 'mb-1 inline-block text-xs font-semibold text-slate-700' : ''} ${
          className ?? ''
        }`}
      >
        {children}
      </label>
      {required && (
        <span className={standalone ? 'mb-1 inline-block text-xs font-semibold' : 'mr-1 self-center'}>
          <RequiredMark />
        </span>
      )}
    </>
  )
}

type MessageTone = 'hint' | 'error' | 'success'

const MESSAGE_TONE: Record<MessageTone, string> = {
  // Ebene 3b der Textskala: die ruhige Auskunft unter einem Feld stand im
  // Ersatzteil-Formular schon auf `slate-500` – hier steht der eine Wert.
  hint: 'text-slate-500',
  error: 'font-medium text-rose-700',
  success: 'font-medium text-emerald-800',
}

interface FormSectionProps {
  /** Überschrift der Gruppe, z. B. „Lagerplatz". */
  title: string
  /** `true` hängt ein leises „(optional)" an – für Gruppen ohne Pflichtfeld. */
  optional?: boolean
  /** Rechts in der Kopfzeile, z. B. das Kontrollkästchen „In Ablage legen". */
  action?: ReactNode
  children: ReactNode
}

/**
 * Gruppe zusammengehöriger Felder – die Glasfläche mit Kopfzeile.
 *
 * Vorher trug **nur** das Werkzeugformular diese Gruppen („Lagerplatz",
 * „Zuordnung"): dasselbe Muster stand dreimal als wörtlich wiederholte
 * Klassenzeichenkette im Markup, und im Ersatzteil-Formular, wo dieselbe
 * Lagerplatz-Sache steht, kam es gar nicht vor. Genau daraus entstand der
 * Eindruck „hier aufgeteilt, dort nicht".
 */
export function FormSection({ title, optional = false, action, children }: FormSectionProps) {
  return (
    <div className="bg-white/40 p-3 rounded-xl border border-white/60">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">
          {title}
          {optional && <span className="text-xs font-normal text-slate-600"> (optional)</span>}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

interface FieldMessageProps {
  /** `hint` = ruhige Auskunft, `error` = Ablehnung, `success` = Bestätigung. */
  tone?: MessageTone
  /** Für `aria-describedby` am Eingabefeld, wenn die Meldung es erklären soll. */
  id?: string
  /** Optionales Icon links (z. B. `InfoIcon`) – muss `aria-hidden` tragen. */
  icon?: ReactNode
  children: ReactNode
}

/**
 * Meldung **direkt unter** einem Feld (im Werkzeugformular bereits das Muster
 * für die Werkzeug-ID). Fehlermeldungen sind `role="alert"`, damit Screenreader
 * sie nach dem Absenden vorlesen, ohne dass der Fokus springen muss.
 */
export function FieldMessage({ tone = 'hint', id, icon, children }: FieldMessageProps) {
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : undefined}
      className={`mt-1 text-xs ${MESSAGE_TONE[tone]}`}
    >
      {icon ? (
        <span className="inline-flex items-center gap-1">
          {icon}
          {children}
        </span>
      ) : (
        children
      )}
    </p>
  )
}
