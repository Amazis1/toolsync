// Fenster „Neuer Auftrag" (DEC-072/075).
//
// Alles Ausfüllbare liegt in einem Fenster, nichts steht dauerhaft auf der
// Seite. Die Werkzeugauswahl zeigt **alle** Werkzeuge mit Sperrgrund: was nicht
// verschickt werden darf, steht sichtbar da und nennt den Grund – eine
// ausgeblendete Zeile ließe den Benutzer rätseln (DEC-072 Punkt 6).

import { useEffect, useMemo, useState } from 'react'
import { createOrder, getCandidates, sendOrder } from '../../api/transport'
import type { Plant } from '../../api/types'
import type { TransportCandidate, TransportOrder } from '../../types/transport'
import { useEscapeKey } from '../../lib/useEscapeKey'
import {
  OHNE_WERKFARBE,
  WerkName,
  WerkzeugKennung,
  WerkzeugKurz,
  useWerkFarben,
  werkZeile,
} from './logistikTeile'

interface NewOrderModalProps {
  aktivPlant: Plant | null
  zielWerke: Plant[]
  onClose: () => void
  /** Nach dem Speichern: Auftrag und ob er gleich verschickt wurde. */
  onSaved: (order: TransportOrder, gesendet: boolean, weiterOffen: boolean) => void
}

export default function NewOrderModal({
  aktivPlant,
  zielWerke,
  onClose,
  onSaved,
}: NewOrderModalProps) {
  const werkFarbe = useWerkFarben()
  const [nummer, setNummer] = useState('')
  const [referenz, setReferenz] = useState('')
  const [info, setInfo] = useState('')
  const [zielId, setZielId] = useState<number | null>(zielWerke[0]?.id ?? null)
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState<number[]>([])
  const [kandidaten, setKandidaten] = useState<TransportCandidate[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  useEscapeKey(onClose, !speichert)

  // Auswahl einmal laden; die Suche filtert im Browser (die Liste ist die des
  // Arbeitswerks, nicht die des ganzen Konzerns).
  useEffect(() => {
    let gilt = true
    setLaden(true)
    getCandidates()
      .then((liste) => {
        if (gilt) setKandidaten(liste)
      })
      .catch((e: unknown) => {
        if (gilt) {
          setFehler(
            e instanceof Error ? e.message : 'Die Werkzeugauswahl konnte nicht geladen werden.',
          )
        }
      })
      .finally(() => {
        if (gilt) setLaden(false)
      })
    return () => {
      gilt = false
    }
  }, [])

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    const gefiltert = q
      ? kandidaten.filter((k) =>
          [k.tool_code, k.category, k.tool_type, k.measure_a, k.description]
            .filter((wert): wert is string => !!wert)
            .some((wert) => wert.toLowerCase().includes(q)),
        )
      : kandidaten
    return [...gefiltert].sort((a, b) =>
      String(a.tool_code ?? '').localeCompare(String(b.tool_code ?? ''), 'de'),
    )
  }, [kandidaten, suche])

  const gewaehlteWerkzeuge = kandidaten.filter((k) => gewaehlt.includes(k.tool_id))

  function umschalten(kandidat: TransportCandidate) {
    if (kandidat.blocked) return
    setGewaehlt((alt) =>
      alt.includes(kandidat.tool_id)
        ? alt.filter((id) => id !== kandidat.tool_id)
        : [...alt, kandidat.tool_id],
    )
  }

  async function speichern(undSenden: boolean, undWeiter: boolean) {
    setFehler(null)
    const nummerSauber = nummer.trim()
    if (!nummerSauber) {
      setFehler('Bitte eine Auftrags-Nr. eintragen (Freitext).')
      return
    }
    if (gewaehlt.length === 0) {
      setFehler('Bitte mindestens ein Werkzeug auswählen.')
      return
    }
    if (zielId === null) {
      setFehler('Bitte das Empfängerwerk wählen.')
      return
    }
    if (zielId === aktivPlant?.id) {
      setFehler('Absender und Empfänger sind dasselbe Werk.')
      return
    }

    setSpeichert(true)
    let auftrag: TransportOrder
    try {
      auftrag = await createOrder({
        order_number: nummerSauber,
        reference: referenz.trim() || null,
        to_plant_id: zielId,
        info: info.trim() || null,
        items: gewaehlt.map((toolId) => ({ tool_id: toolId })),
      })
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Auftrag konnte nicht angelegt werden.')
      setSpeichert(false)
      return
    }

    if (undSenden) {
      try {
        auftrag = await sendOrder(auftrag.id)
      } catch (e) {
        // Der Entwurf steht – nur das Verschicken scheiterte. Beides melden,
        // statt den Entwurf zu verschweigen.
        setSpeichert(false)
        setFehler(
          `Der Auftrag ist als Entwurf gespeichert, konnte aber nicht verschickt werden: ${
            e instanceof Error ? e.message : 'unbekannter Fehler'
          }`,
        )
        onSaved(auftrag, false, true)
        return
      }
    }

    setSpeichert(false)
    onSaved(auftrag, undSenden, undWeiter)
    if (undWeiter) {
      // „Mehrere Aufträge nacheinander": Fenster bleibt offen, Auswahl geleert.
      setNummer('')
      setReferenz('')
      setInfo('')
      setGewaehlt([])
      setSuche('')
      setKandidaten(await getCandidates().catch(() => kandidaten))
    } else {
      onClose()
    }
  }

  const fehlerAnzeige = fehler
  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="neu-auftrag-titel"
    >
      <div className="modal-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="neu-auftrag-titel" className="text-lg font-semibold text-slate-900">
              Neuer Auftrag – Werkzeuge auswählen
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Aus <WerkName plant={aktivPlant} fallback="dem Arbeitswerk" /> – wählbar ist nur,
              was hier liegt und verfügbar ist.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white/60 hover:text-slate-700"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Auftrags-Nr. (Freitext)
            </span>
            <input
              id="auftrag-nummer"
              type="text"
              value={nummer}
              onChange={(e) => setNummer(e.target.value)}
              placeholder="z. B. AUF-2026-0044"
              className="input-bordered text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">An Werk</span>
            <select
              id="auftrag-ziel"
              value={zielId ?? ''}
              onChange={(e) => setZielId(Number(e.target.value))}
              className="input-bordered text-sm"
            >
              {zielWerke.length === 0 && <option value="">Kein anderes Werk vorhanden</option>}
              {zielWerke.map((werk) => (
                <option key={werk.id} value={werk.id}>
                  {werk.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Referenz (frei)</span>
            <input
              id="auftrag-referenz"
              type="text"
              value={referenz}
              onChange={(e) => setReferenz(e.target.value)}
              placeholder="Lieferschein …"
              className="input-bordered text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Info für das Empfängerwerk
          </span>
          <textarea
            id="auftrag-info"
            rows={2}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder="z. B. für Auftrag 4711, bitte bis Donnerstag zurück"
            className="input-bordered text-sm"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suche: ID, Art, Typ, Maß …"
            aria-label="Werkzeuge durchsuchen"
            className="input-bordered max-w-[18rem] text-sm"
          />
          <span className="text-xs text-slate-600">
            {treffer.length} Treffer · {gewaehlt.length} ausgewählt · wählbar nur aus{' '}
            <strong style={{ color: werkFarbe(aktivPlant?.id) || OHNE_WERKFARBE }}>
              {aktivPlant?.name ?? 'dem Arbeitswerk'}
            </strong>
          </span>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[720px] text-left text-xs">
            <caption className="sr-only">Werkzeuge für den neuen Auftrag</caption>
            <thead className="sticky top-0 bg-white/85 text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="w-8 px-2 py-2 font-semibold">
                  <span className="sr-only">Auswahl</span>
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">Werkzeug-ID</th>
                <th scope="col" className="px-2 py-2 font-semibold">Art · Typ · Maß</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatwerk</th>
                <th scope="col" className="px-2 py-2 font-semibold">Heimatplatz</th>
                {/* Keine eigene Spalte „Zustand": ob ein Werkzeug verschickt
                    werden darf, sagt die Spalte „Hinweis" im Klartext („liegt in
                    Werk 2", „unterwegs (AUF-12)", „ausgeliehen an eine Person").
                    Eine zweite Aussage über dieselbe Sache wäre nur Rauschen
                    (DEC-080). */}
                <th scope="col" className="px-2 py-2 font-semibold">Hinweis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {laden && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-slate-600">
                    Werkzeuge werden geladen …
                  </td>
                </tr>
              )}
              {!laden && treffer.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-slate-600">
                    Kein Treffer.
                  </td>
                </tr>
              )}
              {treffer.map((kandidat) => {
                const gesperrt = !!kandidat.blocked
                const istGewaehlt = gewaehlt.includes(kandidat.tool_id)
                return (
                  <tr
                    key={kandidat.tool_id}
                    className="werk-zeile"
                    style={werkZeile(werkFarbe(kandidat.home_plant?.id))}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={istGewaehlt}
                        disabled={gesperrt}
                        onChange={() => umschalten(kandidat)}
                        aria-label={`${kandidat.tool_code ?? 'Werkzeug ohne ID'} auswählen`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <WerkzeugKennung code={kandidat.tool_code} />
                    </td>
                    <td className="px-2 py-1.5">
                      <WerkzeugKurz
                        category={kandidat.category}
                        toolType={kandidat.tool_type}
                        measure={kandidat.measure_a}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <WerkName plant={kandidat.home_plant} />
                    </td>
                    <td className="px-2 py-1.5">
                      <code className="font-mono text-xs text-slate-700">
                        {kandidat.home_position_code || 'Ablage'}
                      </code>
                    </td>
                    <td className="px-2 py-1.5">
                      {gesperrt ? (
                        <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {kandidat.blocked}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          wählbar
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {gewaehlteWerkzeuge.length > 0 && (
          <div className="mt-2 rounded-xl bg-white/55 px-3 py-2 text-xs text-slate-700">
            <strong>{gewaehlteWerkzeuge.length} ausgewählt:</strong>{' '}
            {gewaehlteWerkzeuge
              .map((kandidat) => kandidat.tool_code ?? 'ohne ID')
              .join(', ')}
          </div>
        )}

        {fehlerAnzeige && (
          <div className="ui-alert ui-alert-error mt-3">
            <span>×</span>
            <div>{fehlerAnzeige}</div>
          </div>
        )}

        {/* Fußleiste mit Trennlinie: die Auswahl scrollt darüber, ohne dass die
            Knöpfe die abgeschnittene letzte Zeile berühren. */}
        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-200/70 pt-3">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void speichern(false, true)}
            disabled={speichert}
            className="ui-btn ui-btn-secondary"
            title="Entwurf speichern und gleich den nächsten anlegen"
          >
            Speichern und nächster
          </button>
          <button
            type="button"
            onClick={() => void speichern(false, false)}
            disabled={speichert}
            className="ui-btn ui-btn-secondary"
          >
            Entwurf speichern
          </button>
          <button
            type="button"
            onClick={() => void speichern(true, false)}
            disabled={speichert}
            className="ui-btn ui-btn-werk"
          >
            {speichert ? 'Wird gespeichert …' : 'Als unterwegs melden'}
          </button>
        </div>
      </div>
    </div>
  )
}
