import { useCallback, useEffect, useRef, useState } from 'react'
import { getMovements } from '../../api/movements'
import type { ToolMovement } from '../../types/movement'

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
// ------------------------------------------------------------
// Aktionsgruppen mit Farbe
// ------------------------------------------------------------
interface ActionStyle {
  /** Anzeigetext des Badges */
  label: string
  /** Badge-Farben aus der Tokenschicht (admin.css) */
  badge: string
  /** Farbiger linker Rand der Verlaufszeile */
  border: string
}

/**
 * Verwandte Aktionen teilen sich eine Farbe (Antwort des Projektinhabers):
 *   Lagerbewegungen -> Tausch / Verschieben / Einreihen / In Ablage
 *   Ausleihe & Rückgabe -> eigene Töne
 *   Statusänderung -> rot
 *
 * Die Farben kommen ausschließlich aus den --admin-* Tokens des Design-Systems.
 * "Ausleihe" war vorher violett; Violett gibt es im Guide nicht, deshalb läuft
 * die Gruppe über die Info-Familie (dort über --admin-info-line, damit sie von
 * "Verschieben" unterscheidbar bleibt).
 *
 * Hinweis: Die Badges nutzen nur die Farbfamilien-Klassen (.admin-badge-*);
 * Layout und Größe kommen weiterhin aus BADGE_BASE.
 */
const GROUP_STYLES = {
  swap: {
    label: 'Tausch',
    badge: 'admin-badge-success border border-[var(--admin-success-line)]',
    border: 'border-l-4 border-l-[var(--admin-success)]',
  },
  move: {
    label: 'Verschieben',
    badge:
      'bg-[var(--admin-info-bg)] text-[var(--admin-info-fg)] border border-[var(--admin-info-line)]',
    border: 'border-l-4 border-l-[var(--admin-info-fg)]',
  },
  insert: {
    label: 'Einreihen',
    badge: 'admin-badge-warning border border-[var(--admin-warning-line)]',
    border: 'border-l-4 border-l-[var(--admin-warning)]',
  },
  remove: {
    label: 'In Ablage',
    badge: 'admin-badge-neutral border border-[var(--admin-neutral-bg)]',
    border: 'border-l-4 border-l-[var(--admin-neutral)]',
  },
  lend: {
    label: 'Ausleihe',
    badge:
      'bg-[var(--admin-info-line)] text-[var(--admin-info-fg)] border border-[var(--admin-info-line)]',
    border: 'border-l-4 border-l-[var(--admin-info-line)]',
  },
  return: {
    label: 'Rückgabe',
    badge: 'admin-badge-primary border border-[var(--admin-primary-soft)]',
    border: 'border-l-4 border-l-[var(--admin-primary-soft)]',
  },
  status: {
    label: 'Statusänderung',
    badge: 'admin-badge-danger border border-[var(--admin-danger-line)]',
    border: 'border-l-4 border-l-[var(--admin-danger)]',
  },
  unknown: {
    label: 'Umplatzierung',
    badge: 'admin-badge-neutral border border-[var(--admin-neutral-bg)]',
    border: 'border-l-4 border-l-[var(--admin-border-strong)]',
  },
} as const

/** Legende für die Kopfzeile (verwandte Aktionen gruppiert). */
const LEGEND: { label: string; dot: string }[] = [
  { label: 'Tausch', dot: 'bg-[var(--admin-success)]' },
  { label: 'Verschieben', dot: 'bg-[var(--admin-info-fg)]' },
  { label: 'Einreihen', dot: 'bg-[var(--admin-warning)]' },
  { label: 'In Ablage', dot: 'bg-[var(--admin-neutral)]' },
  { label: 'Ausleihe', dot: 'bg-[var(--admin-info-line)]' },
  { label: 'Rückgabe', dot: 'bg-[var(--admin-primary)]' },
]

/**
 * Aktion + Farbe aus einer Bewegung ableiten.
 *
 * Die Note-Codes stammen aus dem location_service (Backend):
 *   move | swap | insert_at [shift] | place | release
 *   | insert_from_tray [shift]
 * Zusätzlich existieren die klassischen MovementTypes (lend/return/…).
 *
 * Gemappt wird tolerant über das ERSTE Wort der Note. Dadurch greifen
 * auch die Shift-Varianten ("insert_at shift", "insert_from_tray shift")
 * und Altbestände bleiben farbig.
 */
function getActionStyle(m: ToolMovement): ActionStyle {
  const note = (m.note ?? '').trim().toLowerCase()
  const code = note.split(/\s+/)[0] ?? ''

  if (m.movement_type === 'relocate') {
    if (code === 'swap') return GROUP_STYLES.swap
    if (code === 'move') return GROUP_STYLES.move
    if (code === 'insert_from_tray') {
      return { ...GROUP_STYLES.insert, label: 'Einlegen' }
    }
    if (code === 'place') {
      return { ...GROUP_STYLES.insert, label: 'Ablegen' }
    }
    if (code === 'insert_at') {
      return note.includes('shift')
        ? { ...GROUP_STYLES.insert, label: 'Einreihen (Shift)' }
        : GROUP_STYLES.insert
    }
    if (code === 'release') return GROUP_STYLES.remove

    // Altbestand / Freitext
    if (note.includes('swap')) return GROUP_STYLES.swap
    if (note.includes('verschieb')) return GROUP_STYLES.move
    if (note.includes('release') || note.includes('ablage')) return GROUP_STYLES.remove
    return GROUP_STYLES.unknown
  }

  if (m.movement_type === 'lend') return GROUP_STYLES.lend
  if (m.movement_type === 'return') return GROUP_STYLES.return
  if (m.movement_type === 'transfer') {
    return { ...GROUP_STYLES.move, label: 'Transfer' }
  }
  if (m.movement_type === 'status_change') return GROUP_STYLES.status

  return { ...GROUP_STYLES.unknown, label: m.movement_type }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLocation(code: string | null): string {
  if (!code) return '—'
  return code
}

// Badge-Basisklassen (die Farbe kommt je Aktion aus GROUP_STYLES)
const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap shrink-0'

// ------------------------------------------------------------
// Komponente: Verlauf
// ------------------------------------------------------------
interface MovementLogProps {
  plantId: number | null
  /** Wird nach jeder Verschiebung inkrementiert, um den Verlauf neu zu laden */
  refreshKey?: number
  /** Auf 0 = keine Begrenzung, sonst nur die letzten n Einträge */
  limit?: number
}

export default function MovementLog({ plantId, refreshKey = 0, limit = 50 }: MovementLogProps) {
  // Seitengröße = bisheriges limit (steuert zugleich die Abbruchbedingung)
  const pageSize = limit > 0 ? limit : 50

  const [movements, setMovements] = useState<ToolMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Nachladen möglich, solange die letzte Seite voll war
  const [hasMore, setHasMore] = useState(true)

  // Refs: verhindern parallele Nachlade-Aufrufe und halten skip ohne Re-Render
  const loadingRef = useRef(false)
  const skipRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  /**
   * Eine Seite laden. reset=true -> Liste ersetzen (skip=0),
   * reset=false -> nächste Seite anhängen.
   */
  const load = useCallback(
    async (reset: boolean) => {
      // Parallele Aufrufe (z. B. mehrfach ausgelöster Observer) unterbinden
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setError(null)

      const skip = reset ? 0 : skipRef.current
      try {
        const data = await getMovements({
          plant_id: plantId ?? undefined,
          skip,
          limit: pageSize,
        })
        skipRef.current = skip + data.length
        setMovements((prev) => (reset ? data : [...prev, ...data]))
        // Sind weniger als eine volle Seite zurückgekommen, ist das Ende erreicht
        setHasMore(data.length === pageSize)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verlauf laden fehlgeschlagen.')
        setHasMore(false)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    },
    [plantId, pageSize],
  )

  // Bei Werk-Wechsel oder Refresh-Signal: zurücksetzen und erste Seite laden
  useEffect(() => {
    skipRef.current = 0
    setHasMore(true)
    setMovements([])
    load(true)
  }, [load, refreshKey])

  /**
   * Infinite Scroll: Sentinel am Listenende beobachten. Der Observer wird bei
   * jeder Längenänderung neu aufgebaut – dadurch feuert er erneut, wenn der
   * Sentinel nach dem Anhängen weiterhin sichtbar ist (füllt den sichtbaren
   * Bereich, bis gescrollt werden kann oder das Ende erreicht ist).
   */
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load(false)
      },
      { root, rootMargin: '80px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, load, movements.length])

  if (loading && movements.length === 0) {

    return <p className="admin-text-subtle text-sm italic">Verlauf wird geladen…</p>
  }

  if (error && movements.length === 0) {
    return <div className="admin-alert admin-alert-error"><span>×</span><div>{error}</div></div>
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-10 admin-text-subtle">
        <p className="text-sm font-semibold">Noch keine Bewegungen</p>
        <p className="text-xs mt-1">
          Sobald Werkzeuge verschoben, getauscht oder eingereiht werden, erscheinen sie hier.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Kopfzeile */}

      <div className="border-b pb-2 space-y-1.5 admin-line-soft">
        <div className="flex items-center justify-between">

          <span className="text-sm font-bold admin-text">
            Verlauf der Werkzeugbewegungen
          </span>


          <span className="text-[10px] admin-text-subtle font-semibold">
            {movements.length}
            {hasMore ? '+' : ''} {movements.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>
        {/* Farb-Legende: verwandte Aktionen gruppiert */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGEND.map((entry) => (
            <span
              key={entry.label}
              className="inline-flex items-center gap-1 text-[10px] font-semibold admin-text-subtle"
            >
              <span className={`w-2 h-2 rounded-full ${entry.dot}`} aria-hidden="true" />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      {/* Liste (Scroll-Container für den IntersectionObserver) */}
      <div ref={scrollRef} className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
        {movements.map((m) => {
          const action = getActionStyle(m)
          return (
            <div
              key={m.id}

              className={`flex items-start gap-3 p-2.5 rounded-lg border admin-line-soft admin-surface-sub hover:bg-[var(--admin-surface-hover)] transition-colors ${action.border}`}
            >
              {/* Badge (Farbe je Aktion) */}
              <span className={`${BADGE_BASE} mt-0.5 ${action.badge}`}>{action.label}</span>

              {/* Inhalt */}
              <div className="flex-1 min-w-0 text-xs">

                <div className="font-semibold admin-text font-mono">
                  {m.tool_code ?? `Werkzeug #${m.tool_id}`}
                  {m.tool_description && (
                    <span className="ml-2 font-sans font-normal admin-text-subtle" title={m.tool_description}>
                      {m.tool_description.length > 35
                        ? m.tool_description.slice(0, 35) + '…'
                        : m.tool_description}
                    </span>
                  )}
                </div>
                <div className="admin-text-subtle mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono">{formatLocation(m.from_location)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="font-mono">{formatLocation(m.to_location)}</span>
                </div>
              </div>

              <div className="text-[10px] admin-text-subtle shrink-0 text-right mt-1">
                {m.user_display_name && (
                  <div className="font-medium admin-text-muted">{m.user_display_name}</div>
                )}
                <div>{formatTimestamp(m.timestamp)}</div>
              </div>
            </div>
          )
        })}

        {/* Sentinel für Infinite Scroll */}
        <div ref={sentinelRef} aria-hidden="true" />

        {/* Lade-Indikator beim Nachladen */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="ui-spinner" />
            <span className="text-xs admin-text-subtle">Weitere Einträge werden geladen …</span>
          </div>
        )}

        {/* Ende erreicht */}
        {!hasMore && (
          <p className="text-center text-[10px] admin-text-subtle py-3 font-semibold">
            — Ende des Verlaufs —
          </p>
        )}
      </div>

      {/* Nachlade-Fehler (Liste bereits sichtbar) */}
      {error && movements.length > 0 && (
        <div className="admin-alert admin-alert-error">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}
    </div>
  )
}