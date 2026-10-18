// Fenster „Werkzeug zurück" (DEC-081) – Werkzeuge, die **hier** liegen, aber einem
// anderen Werk gehören, gehen zurück an ihr Heimatwerk.
//
// Das ist der Weg, den der Inhaber beschrieben hat: „Der jeweilige Werk schickt die
// Werkzeuge zurück." Niemand muss den alten Auftrag suchen, mit dem die Werkzeuge
// einmal kamen – dieses Fenster listet sie und legt je Heimatwerk einen
// Rück-Auftrag an, der gleich verschickt wird.
//
// Ein Werkzeug kann aus **mehreren** Heimatwerken stammen; deshalb ist die Liste
// nach Heimatwerk filterbar, und jede Gruppe hat ihren eigenen Knopf.
//
// Aufbau wie die übrigen Fenster der Logistik (`.modal-overlay`/`.modal-panel`,
// Kopf mit ✕, Fußleiste mit Trennlinie, Escape über `useEscapeKey`). Tooltips
// (`title=`) stehen nur an Knöpfen und Werten – an Eingabefeldern sind sie laut
// Styleguide (§ Formulare) nicht erlaubt.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createOrder, getBorrowedTools, sendOrder } from '../../api/transport'
import type { BorrowedTool } from '../../types/transport'
import { useEscapeKey } from '../../lib/useEscapeKey'
import { werkzeuge as werkzeugAnzahl } from '../../lib/format'
import {
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  formatZeitpunkt,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

interface ZurueckModalProps {
  onClose: () => void
  /** Nach dem Zurückschicken: Listen neu laden und Meldung zeigen. */
  onSent: (anzahl: number, anWerk: string, auftragsNummer: string) => void
}

/** Auftragsnummer des Rückwegs: lesbar, mit Datum und laufender Nummer. */
function rueckNummer(index: number): string {
  const heute = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return `RÜCK-${heute}-${index + 1}`
}

export default function ZurueckModal({ onClose, onSent }: ZurueckModalProps) {
  const werkFarbe = useWerkFarben()
  const [werkzeuge, setWerkzeuge] = useState<BorrowedTool[]>([])
  const [gewaehlt, setGewaehlt] = useState<number[]>([])
  const [suche, setSuche] = useState('')
  // `null` = alle Heimatwerke; sonst nur die Werkzeuge dieses Heimatwerks.
  const [werkFilter, setWerkFilter] = useState<number | null>(null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busyWerk, setBusyWerk] = useState<number | null>(null)

  useEscapeKey(onClose, busyWerk === null)

  const ladeListe = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const liste = await getBorrowedTools()
      setWerkzeuge(liste)
      setGewaehlt(liste.map((eintrag) => eintrag.tool_id))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Liste konnte nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladeListe()
  }, [ladeListe])

  /** Alle Heimatwerke der Liste (für die Filter-Reiter). */
  const heimatwerke = useMemo(() => {
    const gefunden = new Map<number, string>()
    for (const eintrag of werkzeuge) {
      if (eintrag.home_plant) gefunden.set(eintrag.home_plant.id, eintrag.home_plant.name)
    }
    return [...gefunden.entries()].map(([id, name]) => ({ id, name }))
  }, [werkzeuge])

  /** Was die Tabelle zeigt: Suche über ID, Art, Typ, Maß und Heimatwerk. */
  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return werkzeuge.filter((eintrag) => {
      if (werkFilter !== null && eintrag.home_plant?.id !== werkFilter) return false
      if (!q) return true
      return [
        eintrag.tool_code,
        eintrag.category,
        eintrag.tool_type,
        eintrag.measure_a,
        eintrag.description,
        eintrag.home_plant?.name,
      ]
        .filter((wert): wert is string => !!wert)
        .some((wert) => wert.toLowerCase().includes(q))
    })
  }, [werkzeuge, suche, werkFilter])

  /** Nach Heimatwerk gruppiert – je Gruppe ein eigener Rück-Auftrag. */
  const gruppen = useMemo(() => {
    const karte = new Map<number, BorrowedTool[]>()
    for (const eintrag of werkzeuge) {
      if (eintrag.home_plant == null) continue
      const liste = karte.get(eintrag.home_plant.id) ?? []
      liste.push(eintrag)
      karte.set(eintrag.home_plant.id, liste)
    }
    return karte
  }, [werkzeuge])

  /** Auswahl **innerhalb** der sichtbaren Zeilen (der Zähler nennt nur diese). */
  const ausgewaehltSichtbar = useMemo(
    () => sichtbar.filter((eintrag) => gewaehlt.includes(eintrag.tool_id)).length,
    [sichtbar, gewaehlt],
  )

  function umschalten(toolId: number) {
    setGewaehlt((alt) => (alt.includes(toolId) ? alt.filter((id) => id !== toolId) : [...alt, toolId]))
  }

  /** Alle **sichtbaren** Werkzeuge anhaken (die Suche bleibt stehen). */
  function alleAuswaehlen() {
    setGewaehlt((alt) => [...new Set([...alt, ...sichtbar.map((eintrag) => eintrag.tool_id)])])
  }

  function auswahlAufheben() {
    setGewaehlt([])
  }

  async function zurueckschicken(heimatWerkId: number, nummer: number) {
    const auswahl = (gruppen.get(heimatWerkId) ?? []).filter((eintrag) =>
      gewaehlt.includes(eintrag.tool_id),
    )
    if (auswahl.length === 0) {
      setFehler('Bitte die Werkzeuge anhaken, die zurückgehen.')
      return
    }
    setBusyWerk(heimatWerkId)
    setFehler(null)
    const auftragsNummer = rueckNummer(nummer)
    try {
      const auftrag = await createOrder({
        order_number: auftragsNummer,
        reference: 'Rückweg',
        to_plant_id: heimatWerkId,
        info: 'Werkzeuge gehen zurück an das Heimatwerk.',
        items: auswahl.map((eintrag) => ({ tool_id: eintrag.tool_id })),
      })
      await sendOrder(auftrag.id)
      const zielWerk = auswahl[0]?.home_plant?.name ?? 'das Heimatwerk'
      onSent(auswahl.length, zielWerk, auftragsNummer)
      // Suche und Filter bleiben stehen – nur die Liste wird neu geholt.
      await ladeListe()
    } catch (e) {
      setFehler(
        e instanceof Error ? e.message : 'Die Werkzeuge konnten nicht zurückgeschickt werden.',
      )
    } finally {
      setBusyWerk(null)
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zurueck-titel"
    >
      <div className="modal-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="zurueck-titel" className="text-lg font-semibold text-slate-900">
              Werkzeug zurück
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Werkzeuge aus anderen Werken, die <strong>hier</strong> liegen. Sie gehen zurück
              an ihr Heimatwerk – der Auftrag wird beim Zurückschicken gleich als unterwegs
              gemeldet, das Heimatwerk bestätigt den Empfang.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            title="Schließen (Esc)"
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white/60 hover:text-slate-700"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Suche und Filter – dieselbe Zeile wie im Fenster „Neuer Auftrag". */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suche: ID, Art, Typ, Maß, Heimatwerk …"
            aria-label="Geliehene Werkzeuge durchsuchen"
            className="input-bordered max-w-[20rem] flex-1 text-sm"
          />

          {heimatwerke.length > 1 && (
            <div className="ui-tabs" role="group" aria-label="Nach Heimatwerk filtern">
              <button
                type="button"
                className={werkFilter === null ? 'is-active' : undefined}
                aria-pressed={werkFilter === null}
                onClick={() => setWerkFilter(null)}
                title="Werkzeuge aller Heimatwerke zeigen"
              >
                Alle ({werkzeuge.length})
              </button>
              {heimatwerke.map((werk) => (
                <button
                  key={werk.id}
                  type="button"
                  className={werkFilter === werk.id ? 'is-active' : undefined}
                  aria-pressed={werkFilter === werk.id}
                  onClick={() => setWerkFilter(werk.id)}
                  title={`Nur Werkzeuge aus ${werk.name} zeigen`}
                >
                  {werk.name}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={alleAuswaehlen}
              disabled={sichtbar.length === 0}
              className="ui-btn ui-btn-ghost ui-btn-sm"
              title="Alle sichtbaren Werkzeuge anhaken"
            >
              Alle auswählen
            </button>
            <button
              type="button"
              onClick={auswahlAufheben}
              disabled={gewaehlt.length === 0}
              className="ui-btn ui-btn-ghost ui-btn-sm"
              title="Keine Werkzeuge angehakt lassen"
            >
              Auswahl aufheben
            </button>
          </div>
        </div>

        <p className="mt-1.5 mb-1 text-xs text-slate-600">
          {sichtbar.length} Treffer · {ausgewaehltSichtbar} davon ausgewählt
        </p>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[620px] text-left text-xs">
            <caption className="sr-only">Werkzeuge aus anderen Werken in diesem Werk</caption>
            <thead className="sticky top-0 bg-white/85 text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="w-8 px-2 py-2 font-semibold">
                  <span className="sr-only">Auswahl</span>
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">Werkzeug-ID</th>
                <th scope="col" className="px-2 py-2 font-semibold">Art · Typ · Maß</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatwerk</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatplatz</th>
                <th scope="col" className="px-2 py-2 font-semibold">Hier seit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {laden && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-slate-600">
                    Liste wird geladen …
                  </td>
                </tr>
              )}
              {!laden && werkzeuge.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-slate-600">
                    Kein Werkzeug aus einem anderen Werk hier – es ist alles zu Hause.
                  </td>
                </tr>
              )}
              {!laden && werkzeuge.length > 0 && sichtbar.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-slate-600">
                    Kein Treffer für „{suche.trim()}“.
                  </td>
                </tr>
              )}
              {sichtbar.map((eintrag) => (
                <tr
                  key={eintrag.tool_id}
                  className="werk-zeile"
                  style={werkZeile(werkFarbe(eintrag.home_plant?.id))}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={gewaehlt.includes(eintrag.tool_id)}
                      onChange={() => umschalten(eintrag.tool_id)}
                      aria-label={`${eintrag.tool_code ?? 'Werkzeug ohne ID'} zurück schicken`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkzeugKennung code={eintrag.tool_code} />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkzeugKurz
                      category={eintrag.category}
                      toolType={eintrag.tool_type}
                      measure={eintrag.measure_a}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <WerkName plant={eintrag.home_plant} />
                  </td>
                  <td className="px-2 py-1.5">
                    <code
                      className="font-mono text-xs text-slate-700"
                      title="Heimatplatz – bleibt reserviert, bis das Werkzeug zurück ist"
                    >
                      {eintrag.home_position_code || 'Ablage'}
                    </code>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">
                    <span
                      title={
                        eintrag.arrived_with
                          ? `Angekommen mit Auftrag ${eintrag.arrived_with}`
                          : 'Ankunft nicht verzeichnet'
                      }
                    >
                      {formatZeitpunkt(eintrag.arrived_at)}
                    </span>
                    {eintrag.arrived_with ? (
                      <span className="text-slate-600"> · {eintrag.arrived_with}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fehler && (
          <div className="ui-alert ui-alert-error mt-2">
            <span>×</span>
            <div>{fehler}</div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
          <span className="text-xs text-slate-600">
            {gewaehlt.length} von {werkzeugAnzahl(werkzeuge.length)} ausgewählt
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
              Schließen
            </button>
            {/* Je Heimatwerk ein Knopf: Werkzeuge können aus mehreren Werken stammen. */}
            {[...gruppen.entries()].map(([heimatWerkId, liste], index) => {
              const anzahl = liste.filter((eintrag) => gewaehlt.includes(eintrag.tool_id)).length
              return (
                <button
                  key={heimatWerkId}
                  type="button"
                  onClick={() => void zurueckschicken(heimatWerkId, index)}
                  disabled={busyWerk !== null || anzahl === 0}
                  className="ui-btn ui-btn-werk"
                  title={
                    anzahl === 0
                      ? 'Kein Werkzeug dieses Heimatwerks angehakt'
                      : 'Legt einen Rück-Auftrag an und meldet ihn sofort als unterwegs'
                  }
                >
                  {busyWerk === heimatWerkId
                    ? 'Wird zurückgeschickt …'
                    : `An ${liste[0]?.home_plant?.name ?? 'Heimatwerk'} zurück schicken (${anzahl})`}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
