// Icons fuer die Oberflaeche – **duenne Wrapper um `lucide-react`**.
//
// ============================================================================
// OFFLINE-GARANTIE (Guide §1.7)
// ============================================================================
// Die Oberflaeche muss ohne Internet laufen. Deshalb gilt:
//
//   1. `lucide-react` ist eine **npm-Abhaengigkeit** (`package.json`). Nach
//      `npm install` liegen die Icons in `node_modules` und werden beim Bauen
//      ins JavaScript-Bundle gelegt – wie jeder andere Programmtext. Zur
//      Laufzeit gibt es **keine** Anfrage: kein CDN, kein `<script>`-Tag von
//      einer fremden URL, keine Icon-Font, kein Sprite.
//   2. `lucide-react` rendert **Inline-SVG** (ein echtes `<svg>` im DOM), nicht
//      ein Bild und nicht eine Schrift.
//   3. Die Pflichtattribute aus Guide §1.7 setzt die Bibliothek selbst – hier
//      einmal in `BasisIcon` (siehe `./iconBase.tsx`) nachgehalten, damit die
//      Werte nicht in 34 Komponenten wiederholt werden.
//
// **Einmalig installieren, danach autark:** `npm install` (mit Internet), dann
// laeuft `npm run build` ohne Netz. Ohne `node_modules` baut nichts – das gilt
// fuer React genauso.
//
// Geprueft wird die Zuordnung mit:
//
//   node scripts/verify-icons.mjs
//
// **Diese Datei exportiert ausschliesslich Komponenten.** Helfer (`fromLucide`)
// und Typen liegen in `./iconBase.tsx`: exportiert eine Datei Komponenten und
// zusaetzlich Funktionen, verliert Vite die schnelle Aktualisierung im
// Entwicklungsmodus (`react-refresh/only-export-components`).
// ============================================================================

import {
  Archive,
  ArrowDownNarrowWide,
  ArrowUpDown,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  CircleX,
  ClipboardList,
  Ellipsis,
  FileText,
  Filter,
  Info,
  Keyboard,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash,
  TrendingUp,
  Truck,
  Undo2,
  Upload,
  User,
  Warehouse,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { fromLucideBody, type IconProps } from './iconBase'

/** Lucide `ZoomIn` – Zoom im Datei-Fenster (DEC-061). */
export function ZoomInIcon(props: IconProps) {
  return fromLucideBody(ZoomIn, props)
}

/** Lucide `ZoomOut` – Zoom im Datei-Fenster (DEC-061). */
export function ZoomOutIcon(props: IconProps) {
  return fromLucideBody(ZoomOut, props)
}

/** Lucide `RotateCcw` – Bild nach links drehen (DEC-061). */
export function RotateLeftIcon(props: IconProps) {
  return fromLucideBody(RotateCcw, props)
}

/** Lucide `RotateCw` – Bild nach rechts drehen (DEC-061). */
export function RotateRightIcon(props: IconProps) {
  return fromLucideBody(RotateCw, props)
}

/** Lucide `Search` – Suche in Listen und Filterleisten. */
export function SearchIcon(props: IconProps) {
  return fromLucideBody(Search, props)
}

/** Lucide `User` – Benutzer (Sidebar, Anmeldung). */
export function UserIcon(props: IconProps) {
  return fromLucideBody(User, props)
}

/** Lucide `Plus` – „+ Anlegen" und „hinzufügen". */
export function AddIcon(props: IconProps) {
  return fromLucideBody(Plus, props)
}

/** Lucide `LogIn` – „Abmelden" und Anmeldeformular. */
export function LoginIcon(props: IconProps) {
  return fromLucideBody(LogIn, props)
}

/** Lucide `Info` – Hinweis in einer Meldung oder unter einem Feld. */
export function InfoIcon(props: IconProps) {
  return fromLucideBody(Info, props)
}

/** Lucide `CircleAlert` – Warnung (z. B. Toast „Achtung"). */
export function AlertCircleIcon(props: IconProps) {
  return fromLucideBody(CircleAlert, props)
}

/** Lucide `ClipboardList` – Reiter „Serienartikel" (Einrichteplan). */
export function ClipboardListIcon(props: IconProps) {
  return fromLucideBody(ClipboardList, props)
}

/** Lucide `FileText` – Reiter „Datenblatt" (Einstellwerte). */
export function FileTextIcon(props: IconProps) {
  return fromLucideBody(FileText, props)
}

/** Lucide `Settings` – Zahnrad für den Reiter „Ersatzteil" (Reparatur und Wartung). */
export function SettingsIcon(props: IconProps) {
  return fromLucideBody(Settings, props)
}

/** Lucide `Check` – Erfolgsmeldung und Speichern-Knopf. */
export function CheckIcon(props: IconProps) {
  return fromLucideBody(Check, props)
}

/** Lucide `CircleX` – Fehlermeldung (ersetzt das Textzeichen „×"). */
export function CircleXIcon(props: IconProps) {
  return fromLucideBody(CircleX, props)
}

/** Lucide `Upload` – Dateifeld „hierher ziehen oder auswählen". */
export function UploadIcon(props: IconProps) {
  return fromLucideBody(Upload, props)
}

/** Lucide `Trash` – „Löschen" in einer Dateizeile. */
export function TrashIcon(props: IconProps) {
  return fromLucideBody(Trash, props)
}

/** Lucide `Pencil` – Überschrift der Anlege-/Bearbeiten-Karte. */
export function PencilIcon(props: IconProps) {
  return fromLucideBody(Pencil, props)
}

/** Lucide `Keyboard` – Abzeichen für die Esc-Taste neben „Zurück". */
export function KeyboardIcon(props: IconProps) {
  return fromLucideBody(Keyboard, props)
}

/** Lucide `Filter` – Filter öffnen und schließen. */
export function FilterIcon(props: IconProps) {
  return fromLucideBody(Filter, props)
}

/** Lucide `TrendingUp` – Entwicklung in der Statistik. */
export function TrendingIcon(props: IconProps) {
  return fromLucideBody(TrendingUp, props)
}

/** Lucide `Truck` – Bereich „Logistik": Werkzeuge zwischen den Werken (DEC-086). */
export function TruckIcon(props: IconProps) {
  return fromLucideBody(Truck, props)
}

/** Lucide `ShieldCheck` – Admin-Panel: Rechte und Verwaltung. */
export function AdminIcon(props: IconProps) {
  return fromLucideBody(ShieldCheck, props)
}

/**
 * Lucide `Undo2` – „zurück" (Rückweg zwischen Werken, Werkzeug zurück).
 *
 * Eigener Wrapper, weil `ResetIcon` bereits „Filter zurücksetzen" bedeutet und
 * `LoginIcon` das Abmelden: ein Zeichen hat genau eine Bedeutung (DEC-082).
 */
export function ReturnIcon(props: IconProps) {
  return fromLucideBody(Undo2, props)
}

/**
 * Lucide `Star` – Favoriten-Spalte (gefüllt = gesetzt).
 *
 * `filled` ist eine **eigene** Eigenschaft und darf nicht am `<svg>` landen:
 * React verwirft unbekannte boolesche Attribute nicht, sondern meldet
 * „Received `false` for a non-boolean attribute `filled`". Sie wird deshalb hier
 * in `fill` übersetzt – der Stern ist damit auch sichtbar gefüllt, nicht nur
 * anders eingefärbt.
 */
export function StarIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return fromLucideBody(Star, { ...props, fill: filled ? 'currentColor' : 'none' })
}

/** Lucide `ArrowUpDown` – Spalte ist sortierbar, aber nicht aktiv. */
export function SortableIcon(props: IconProps) {
  return fromLucideBody(ArrowUpDown, props)
}

/** Lucide `ArrowDownNarrowWide` – Aktive Sortierung aufsteigend. */
export function SortAscIcon(props: IconProps) {
  return fromLucideBody(ArrowDownNarrowWide, props)
}

/** Lucide `ArrowUpWideNarrow` – Aktive Sortierung absteigend. */
export function SortDescIcon(props: IconProps) {
  return fromLucideBody(ArrowUpWideNarrow, props)
}

/** Lucide `Ellipsis` – Weitere Aktionen einer Tabellenzeile. */
export function MoreHorizontalIcon(props: IconProps) {
  return fromLucideBody(Ellipsis, props)
}

/** Lucide `ChevronDown` – Auswahl öffnen. */
export function ChevronDownIcon(props: IconProps) {
  return fromLucideBody(ChevronDown, props)
}

/** Lucide `ChevronLeft` – Eine Seite zurück. */
export function ChevronLeftIcon(props: IconProps) {
  return fromLucideBody(ChevronLeft, props)
}

/** Lucide `ChevronRight` – Eine Seite vor. */
export function ChevronRightIcon(props: IconProps) {
  return fromLucideBody(ChevronRight, props)
}

/** Lucide `ChevronsLeft` – Erste Seite. */
export function ChevronsLeftIcon(props: IconProps) {
  return fromLucideBody(ChevronsLeft, props)
}

/** Lucide `ChevronsRight` – Letzte Seite. */
export function ChevronsRightIcon(props: IconProps) {
  return fromLucideBody(ChevronsRight, props)
}

/** Lucide `X` – Schließen, „Zurück", „Abbrechen". */
export function XIcon(props: IconProps) {
  return fromLucideBody(X, props)
}

/** Lucide `RotateCcw` – Filter zurücksetzen. */
export function ResetIcon(props: IconProps) {
  return fromLucideBody(RotateCcw, props)
}

/* ============================================================
 * Eigenbauten – Zeichen, die es in Lucide **nicht** gibt
 * ============================================================
 * Sie tragen die Pflichtattribute aus Guide §1.7 selbst (24×24,
 * `viewBox 0 0 24 24`, `fill="none"`, `stroke="currentColor"`,
 * `stroke-width 2`, runde Enden) – deshalb wiederholt sich der Kopf hier.
 * Jedes davon ist ein **Fachsymbol** dieser Anwendung: Werkzeug fuer Werkzeuge,
 * das Klemmbrett fuer Serienartikel, Lagerhaus und Archiv fuer die Ablage.
 * Geprueft werden sie von `scripts/verify-icons.mjs`.
 */

/**
 * Ab hier: Zeichen, die früher **von Hand** gezeichnet waren (Lucide-Pfade
 * nachgezeichnet). Jetzt echte Wrapper um `lucide-react` – die Bibliothek liegt
 * offline im Projekt (`node_modules`), damit sind Strichstärke, Rundungen und
 * Pflichtattribute garantiert identisch zu allen anderen Zeichen (DEC-087).
 */

/** Lucide `Wrench` – Reiter „Werkzeug". */
export function ToolIcon(props: IconProps) {
  return fromLucideBody(Wrench, props)
}

// `SerialIcon` ist entfallen: es zeigte dasselbe Zeichen wie
// `ClipboardListIcon` (Lucide `ClipboardList`). Ein Zeichen hat genau eine
// Bedeutung – die Aufrufer nutzen jetzt `ClipboardListIcon` (DEC-087).

/** Lucide `Warehouse` – Lagerplätze und Einlagerung. */
export function WarehouseIcon(props: IconProps) {
  return fromLucideBody(Warehouse, props)
}

/** Lucide `Archive` – abgelegte und ausgemusterte Datensätze. */
export function ArchiveIcon(props: IconProps) {
  return fromLucideBody(Archive, props)
}

/* ============================================================
 * Werkzeugliste: Favoriten, Sortierung, Filter, Pagination
 * ============================================================ */
