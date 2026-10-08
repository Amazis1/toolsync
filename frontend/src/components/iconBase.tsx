// Gemeinsame Basis aller Icons: Pflichtattribute und Weiterleitung.
//
// **Eigene Datei**, weil `icons.tsx` nur Komponenten exportieren darf
// (`react-refresh/only-export-components`). Dieser Helfer ist keine
// Komponente, sondern eine Fabrik – er gehoert deshalb hierher.

import type { LucideIcon } from 'lucide-react'

/** Eigenschaften, die jedes Icon annimmt – genau die der Bibliothek. */
export type IconProps = {
  className?: string
  strokeWidth?: number | string
  'aria-hidden'?: boolean | 'true' | 'false'
} & Record<string, unknown>

/**
 * Ein Zeichen aus Lucide mit den Pflichtattributen dieser Oberflaeche rendern.
 *
 * **Funktion, nicht Fabrik.** Zuerst stand hier `fromLucide(Icon)`, das eine
 * Komponente zurueckgibt – dann waere jede Sammlung `export const XIcon =
 * fromLucide(X)`. ESLint beanstandet das zu Recht
 * (`react-refresh/only-export-components`): eine Konstante mit einem
 * Funktionsaufruf ist fuer das Plugin keine Komponente, und die schnelle
 * Aktualisierung im Entwicklungsmodus faellt aus. Mit einer Funktions-
 * deklaration (`export function XIcon(props)`) bleibt beides erhalten.
 */
export function fromLucideBody(Icon: LucideIcon, props: IconProps) {
  const { className, strokeWidth = 2, ...rest } = props
  return (
    <Icon
      size={24}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  )
}
