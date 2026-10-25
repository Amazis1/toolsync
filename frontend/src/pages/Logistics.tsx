// Bereich „Logistik" der Hauptseite (DEC-072, Einordnung nach DEC-075).
//
// Vier Aussagen trägt diese Seite, jede an genau einer Stelle:
//   * **Aufträge**  – was aus diesem Werk rausgeht und was hereinkommt (Zeilen,
//                     zugeklappt; Details im Fenster).
//   * **Eingang**   – was zu bestätigen ist, mit Absender, Menge und Zeitpunkt.
//   * **Wo ist was**– nur Unterwegs/Ausgeliehenes (DEC-077).
// Alles Ausfüllbare liegt in Fenstern; kein Formular steht dauerhaft auf der
// Seite. Die Werkfarbe des Arbeitswerks färbt Knopf, Reiter und Zeilen (DEC-076).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useActivePlantId } from '../lib/activePlant'
import { usePlants } from '../lib/plantTheme'
import { auftraege as auftragAnzahl, werkzeuge as werkzeugAnzahl } from '../lib/format'
import { AddIcon, ReturnIcon } from '../components/icons'
import Tooltip from '../components/ui/Tooltip'
import { cancelOrder, getOrders, sendOrder } from '../api/transport'
import type { Plant } from '../api/types'
import type { ToastVariant } from '../lib/useToasts'
import type { TransportOrder } from '../types/transport'
import type { StatsOverview } from '../api/stats'
import AwayTable from '../components/logistics/AwayTable'
import IncomingCards from '../components/logistics/IncomingCards'
import NewOrderModal from '../components/logistics/NewOrderModal'
import OrderDetailModal from '../components/logistics/OrderDetailModal'
import OrderList from '../components/logistics/OrderList'
import ReceiveModal from '../components/logistics/ReceiveModal'
import ReturnOrderModal from '../components/logistics/ReturnOrderModal'
import ZurueckModal from '../components/logistics/ZurueckModal'
import { WerkName, alterTage } from '../components/logistics/logistikTeile'
import { AlertCircleIcon, FileTextIcon, TruckIcon, XIcon } from '../components/icons'
import KpiKarte from '../components/ui/KpiKarte'

type Bereich = 'auftraege' | 'eingang' | 'wowas'

/**
 * Schnellfilter der Auftragsliste (DEC-089) – gesetzt durch einen Klick auf eine
 * Kennzahl-Kachel. `alt` heißt: offen und seit mindestens `LANGE_OFFEN` Tagen.
 */
type Schnellfilter = 'entwurf' | 'unterwegs' | 'alt'

/** Ab so vielen Tagen gilt ein offener Auftrag als „liegt zu lange" (Kachel). */
const LANGE_OFFEN = 7

interface LogisticsProps {
  /** Wechsel des Arbeitswerks oder abgeschlossener Vorgang: Liste neu laden. */
  refreshKey: number
  /**
   * Zähler aus der rechten Spalte (DEC-089): Ändert er sich, springt der Bereich
   * in den Eingang. Ein Zähler statt eines Bool, damit derselbe Sprung mehrfach
   * hintereinander wirkt.
   */
  eingangWunsch: number
  /**
   * Kennzahlen des Arbeitswerks (DEC-089/090). Die drei Filter-Karten zeigen
   * damit die **Gesamtzahl** des Arbeitswerks – auch während eine Suche läuft,
   * sonst stünde auf der Karte die Zahl der Treffer.
   */
  kennzahlen: StatsOverview | null
  /** Meldet dem App-Rahmen, dass sich Zahlen geändert haben (Zähler, Karten). */
  onAktion: () => void
  notify: (variant: ToastVariant, title: string, message?: string) => void
}

/** Zeitraum-Filter der Auftragsliste (DEC-090). */
type Zeitraum = 'alle' | '7' | '30'

/**
 * Adresszeile: gelesen beim Öffnen, geschrieben bei jeder Änderung.
 *
 * Warum überhaupt: „die offenen Aufträge von letzter Woche" ist eine Ansicht, die
 * man weitergeben oder neu laden will. Dasselbe Muster nutzt die Werkzeugliste
 * (`lib/toolQuery.ts`); hier mit eigenem Präfix `log-…`, damit die Parameter
 * beider Bereiche nicht kollidieren.
 */
function leseAusUrl(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

function leseZeitraumAusUrl(): Zeitraum {
  const wert = leseAusUrl('log-zeit')
  return wert === '7' || wert === '30' ? wert : 'alle'
}

function leseBereichAusUrl(): Bereich {
  const wert = leseAusUrl('log-bereich')
  return wert === 'eingang' || wert === 'wowas' ? wert : 'auftraege'
}

/** Liegt der Zeitpunkt höchstens `tage` Tage zurück? */
function innerhalb(iso: string | null | undefined, tage: number): boolean {
  if (!iso) return false
  const zeit = new Date(iso).getTime()
  if (Number.isNaN(zeit)) return false
  return Date.now() - zeit <= tage * 86_400_000
}

/** Aufträge, die noch unterwegs sind (`sent`/`partly_received`). */
const UNTERWEGS = new Set(['sent', 'partly_received'])

export default function Logistics({
  refreshKey,
  eingangWunsch,
  kennzahlen,
  onAktion,
  notify,
}: LogisticsProps) {
  const { user } = useAuth()
  const plants = usePlants()
  const aktivId = useActivePlantId(user?.id ?? null, user?.plant_id ?? null)
  const werk: Plant | null = plants.find((p) => p.id === aktivId) ?? null

  const [bereich, setBereich] = useState<Bereich>(() => leseBereichAusUrl())
  const [orders, setOrders] = useState<TransportOrder[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [aufgeklappt, setAufgeklappt] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  /** Schnellfilter aus den Kennzahl-Kacheln (DEC-089); `null` = alles. */
  const [schnellfilter, setSchnellfilter] = useState<Schnellfilter | null>(() => {
    const wert = leseAusUrl('log-filter')
    return wert === 'entwurf' || wert === 'unterwegs' || wert === 'alt' ? wert : null
  })
  /** Zähler „Liste wurde neu geladen" – „Wo ist was" hängt daran. */
  const [stand, setStand] = useState(0)

  // Suche und Filter (DEC-090). Sie stehen in der Adresszeile: Ein Lesezeichen
  // auf „die offenen Aufträge" oder ein Neuladen behält die Ansicht (dasselbe
  // Muster wie die Werkzeugliste).
  const [suche, setSuche] = useState(() => leseAusUrl('log-suche'))
  const [zeitraum, setZeitraum] = useState<Zeitraum>(() => leseZeitraumAusUrl())
  const [nurMeine, setNurMeine] = useState(() => leseAusUrl('log-meine') === '1')
  /** Verzögerter Suchbegriff – erst nach 300 ms geht die Anfrage los. */
  const [suchbegriff, setSuchbegriff] = useState(suche)

  useEffect(() => {
    const takt = window.setTimeout(() => setSuchbegriff(suche.trim()), 300)
    return () => window.clearTimeout(takt)
  }, [suche])

  // Fenster (DEC-075 Punkt 2)
  const [neuOffen, setNeuOffen] = useState(false)
  const [empfang, setEmpfang] = useState<TransportOrder | null>(null)
  const [rueck, setRueck] = useState<TransportOrder | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  /** Rückgabe-Liste: nur die ausgeliehenen Werkzeuge (DEC-081). */
  const [rueckListeOffen, setRueckListeOffen] = useState(false)

  const ladeAuftraege = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      // Suche und „nur meine" fragt der **Server**: Sonst fände man nur, was in
      // den geladenen 200 Zeilen steht – und die Werkzeug-ID ist erst seit
      // DEC-090 überhaupt suchbar.
      const seite = await getOrders({
        direction: 'both',
        limit: 200,
        q: suchbegriff || undefined,
        mine: nurMeine || undefined,
      })
      setOrders(seite.items)
      setStand((alt) => alt + 1)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Aufträge konnten nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [suchbegriff, nurMeine])

  useEffect(() => {
    void ladeAuftraege()
  }, [ladeAuftraege, refreshKey])

  // Ansicht in die Adresszeile schreiben (ohne neuen Verlaufseintrag, damit die
  // Zurück-Taste weiter seitenweise arbeitet wie bisher).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const setze = (name: string, wert: string | null) => {
      if (wert) params.set(name, wert)
      else params.delete(name)
    }
    setze('log-suche', suche.trim() || null)
    setze('log-zeit', zeitraum === 'alle' ? null : zeitraum)
    setze('log-meine', nurMeine ? '1' : null)
    setze('log-filter', schnellfilter)
    setze('log-bereich', bereich === 'auftraege' ? null : bereich)
    const neu = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', neu)
  }, [suche, zeitraum, nurMeine, schnellfilter, bereich])

  // Sprung aus der rechten Spalte: „Eingang offen" öffnet den Eingang. Der erste
  // Lauf (0) tut nichts – sonst stünde der Bereich immer schon im Eingang.
  useEffect(() => {
    if (eingangWunsch > 0) setBereich('eingang')
  }, [eingangWunsch])

  const ausgang = useMemo(
    () => orders.filter((order) => order.direction === 'out'),
    [orders],
  )
  const eingangOffen = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.direction === 'in' &&
          UNTERWEGS.has(order.status) &&
          order.received_count < order.item_count,
      ),
    [orders],
  )
  const eingegangen = useMemo(
    () => orders.filter((order) => order.direction === 'in' && order.status === 'received'),
    [orders],
  )

  /** Zahlen auf den Filter-Karten: aus der Kennzahlen-Antwort, sonst Liste. */
  const karten = useMemo(
    () => ({
      entwuerfe: kennzahlen?.orders_out_draft ?? 0,
      unterwegs: kennzahlen?.orders_out_sent ?? 0,
      alt: kennzahlen?.orders_out_old ?? 0,
    }),
    [kennzahlen],
  )

  const zahlen = useMemo(() => {
    const offeneZeilen = eingangOffen.reduce(
      (summe, order) => summe + (order.item_count - order.received_count),
      0,
    )
    // „Älter als 7 Tage": offene Aufträge, deren Versand (sonst Anlage) zu lange
    // zurückliegt – in beiden Richtungen, denn ein Paket kann hier ankommen oder
    // von hier ausgehen (DEC-089).
    const alt = orders.filter((order) => {
      if (!UNTERWEGS.has(order.status) && order.status !== 'draft') return false
      const tage = alterTage(order.sent_at ?? order.created_at)
      return tage !== null && tage >= LANGE_OFFEN
    }).length
    return {
      gesamt: ausgang.length,
      unterwegs: ausgang.filter((order) => UNTERWEGS.has(order.status)).length,
      entwuerfe: ausgang.filter((order) => order.status === 'draft').length,
      eingangAuftraege: eingangOffen.length,
      eingangZeilen: offeneZeilen,
      alt,
    }
  }, [ausgang, eingangOffen, orders])

  /**
   * Die Liste, wie sie unter den Kacheln steht: Der Schnellfilter wirkt **nur**
   * auf die Auftragsliste des Ausgangs – ein Klick auf „Eingang offen" wechselt
   * stattdessen den Unterbereich.
   */
  const ausgangGefiltert = useMemo(() => {
    const imZeitraum = (order: TransportOrder) => {
      if (zeitraum === 'alle') return true
      const tage = Number(zeitraum)
      return innerhalb(order.sent_at ?? order.created_at, tage)
    }
    const basis = ausgang.filter(imZeitraum)
    if (schnellfilter === 'entwurf') {
      return basis.filter((order) => order.status === 'draft')
    }
    if (schnellfilter === 'unterwegs') {
      return basis.filter((order) => UNTERWEGS.has(order.status))
    }
    if (schnellfilter === 'alt') {
      return basis.filter((order) => {
        if (!UNTERWEGS.has(order.status) && order.status !== 'draft') return false
        const tage = alterTage(order.sent_at ?? order.created_at)
        return tage !== null && tage >= LANGE_OFFEN
      })
    }
    return basis
  }, [ausgang, schnellfilter, zeitraum])

  function umschalten(orderId: number) {
    setAufgeklappt((alt) =>
      alt.includes(orderId) ? alt.filter((id) => id !== orderId) : [...alt, orderId],
    )
  }

  /** Auftrag aufklappen, ohne den Bereich zu wechseln. */
  function aufklappen(orderId: number) {
    setAufgeklappt((alt) => (alt.includes(orderId) ? alt : [...alt, orderId]))
  }

  /** Auftrag in der Auftragsliste zeigen (Sprung aus „Wo ist was"). */
  function oeffnen(orderId: number) {
    aufklappen(orderId)
    setBereich('auftraege')
  }

  async function verschicken(order: TransportOrder) {
    setBusyId(order.id)
    try {
      await sendOrder(order.id)
      onAktion()
      notify(
        'success',
        `${order.order_number} ist unterwegs`,
        `${werkzeugAnzahl(order.item_count)} von ${order.from_plant?.name ?? '?'} nach ${
          order.to_plant?.name ?? '?'
        }.`,
      )
      await ladeAuftraege()
      oeffnen(order.id)
    } catch (e) {
      notify(
        'error',
        'Der Auftrag konnte nicht verschickt werden.',
        e instanceof Error ? e.message : undefined,
      )
    } finally {
      setBusyId(null)
    }
  }

  async function stornieren(order: TransportOrder) {
    setBusyId(order.id)
    try {
      await cancelOrder(order.id)
      onAktion()
      notify('success', `${order.order_number} wurde storniert`, 'Die Werkzeuge sind wieder frei.')
      await ladeAuftraege()
    } catch (e) {
      notify(
        'error',
        'Der Auftrag konnte nicht storniert werden.',
        e instanceof Error ? e.message : undefined,
      )
    } finally {
      setBusyId(null)
    }
  }

  if (!werk) {
    return (
      <div className="app-content-block rounded-2xl p-5 shadow-xs">
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>
            Für diesen Benutzer ist kein Arbeitswerk hinterlegt. Bitte in der Seitenleiste ein
            Werk wählen.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Kopfzeile: Bereichsreiter links, Aktionen rechts in der Werkfarbe.
          Höhe und Abstände wie die Haupt-Tab-Leiste (px-3 py-1.5); Innenabstand
          der Karten wie in den übrigen Bereichen (p-5) – die Logistik soll sich
          nicht „enger" anfühlen als Werkzeuge/Serienartikel (DEC-082). */}
      <div className="app-content-block flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-1.5 shadow-xs">
        <div className="ui-tabs min-w-0 overflow-x-auto" role="group" aria-label="Logistik">
          <button
            type="button"
            className={bereich === 'auftraege' ? 'is-active' : undefined}
            aria-pressed={bereich === 'auftraege'}
            onClick={() => setBereich('auftraege')}
          >
            Aufträge
          </button>
          <button
            type="button"
            className={bereich === 'eingang' ? 'is-active' : undefined}
            aria-pressed={bereich === 'eingang'}
            onClick={() => setBereich('eingang')}
          >
            Eingang
            {zahlen.eingangAuftraege > 0 && (
              <span className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--werk,#0f766e)] px-1 text-[10px] font-bold text-white">
                {zahlen.eingangAuftraege}
              </span>
            )}
          </button>
          <button
            type="button"
            className={bereich === 'wowas' ? 'is-active' : undefined}
            aria-pressed={bereich === 'wowas'}
            onClick={() => setBereich('wowas')}
          >
            Wo ist was
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* „Werkzeug zurück" (DEC-081): der zweite Weg neben dem Zeilenmenü –
              hier, weil es eine Aktion des Logistik-Bereichs ist. */}
          <Tooltip text="Werkzeuge aus anderen Werken an ihr Heimatwerk zurückschicken">
            <button
              type="button"
              onClick={() => setRueckListeOffen(true)}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              <ReturnIcon className="h-3.5 w-3.5" />
              Werkzeug zurück
            </button>
          </Tooltip>
          <Tooltip text="Neuen Transportauftrag anlegen">
            <button
              type="button"
              onClick={() => setNeuOffen(true)}
              className="ui-btn ui-btn-werk ui-btn-sm"
            >
              <AddIcon className="h-3.5 w-3.5" />
              Neuer Auftrag
            </button>
          </Tooltip>
        </div>
      </div>

      {fehler && (
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>{fehler}</div>
        </div>
      )}

      {/* Kennzahl-Karten über der Liste (DEC-089): **drei Filter**, jeder ein
          Knopf. „Eingang offen" steht nicht mehr hier – die Zahl sitzt in der
          rechten Spalte (sie gilt für den ganzen Bereich, nicht für diese Liste),
          und der Reiter „Eingang" ist zwei Zentimeter weiter links. Dadurch ist
          immer **höchstens eine** Karte gedrückt; vorher sahen „unterwegs" und
          „Eingang offen" gleichzeitig aktiv aus. */}
      {bereich === 'auftraege' && (
        <div
          className="bereich-in flex flex-wrap gap-3"
          role="group"
          aria-label="Schnellfilter"
        >
          <div className="w-36">
            <KpiKarte
              zahl={karten.entwuerfe}
              name="Entwürfe"
              farbe="sky"
              icon={<FileTextIcon className="h-4 w-4" />}
              aktiv={schnellfilter === 'entwurf'}
              titel="Nur Entwürfe zeigen"
              onClick={() =>
                setSchnellfilter((alt) => (alt === 'entwurf' ? null : 'entwurf'))
              }
            />
          </div>
          <div className="w-36">
            <KpiKarte
              zahl={karten.unterwegs}
              name="unterwegs"
              farbe="teal"
              icon={<TruckIcon className="h-4 w-4" />}
              aktiv={schnellfilter === 'unterwegs'}
              titel="Nur unterwegs befindliche Aufträge zeigen"
              onClick={() =>
                setSchnellfilter((alt) => (alt === 'unterwegs' ? null : 'unterwegs'))
              }
            />
          </div>
          <div className="w-36">
            <KpiKarte
              zahl={karten.alt}
              name={`älter als ${LANGE_OFFEN} Tage`}
              farbe="amber"
              icon={<AlertCircleIcon className="h-4 w-4" />}
              aktiv={schnellfilter === 'alt'}
              titel={`Offene Aufträge, die seit mindestens ${LANGE_OFFEN} Tagen laufen`}
              onClick={() => setSchnellfilter((alt) => (alt === 'alt' ? null : 'alt'))}
            />
          </div>
        </div>
      )}

      {bereich === 'auftraege' && (
        <div className="bereich-in app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Aufträge aus <WerkName plant={werk} fallback="dem Arbeitswerk" />
            </h2>
            <span className="text-xs text-slate-600">
              {suche.trim() || nurMeine
                ? `${ausgangGefiltert.length} Treffer`
                : `${zahlen.gesamt} gesamt`}{' '}
              · {zahlen.unterwegs} unterwegs · {zahlen.entwuerfe}{' '}
              {zahlen.entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'}
            </span>
          </div>

          {/* Suche und Filter (DEC-090). Die Suche fragt den **Server**: Sie
              findet auch Auftrags-Nr., Info, Werkzeug-ID und Personennamen – und
              zwar in allen Aufträgen, nicht nur in den geladenen 200 Zeilen. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suche: Auftrags-Nr., Werkzeug-ID, Person, Info …"
              aria-label="Aufträge durchsuchen"
              className="input-bordered min-w-[16rem] flex-1 text-sm"
            />
            <div className="ui-tabs" role="group" aria-label="Zeitraum">
              {([
                ['alle', 'Alle'],
                ['7', 'letzte 7 Tage'],
                ['30', 'letzte 30 Tage'],
              ] as const).map(([wert, text]) => (
                <button
                  key={wert}
                  type="button"
                  className={zeitraum === wert ? 'is-active' : undefined}
                  aria-pressed={zeitraum === wert}
                  onClick={() => setZeitraum(wert)}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={nurMeine}
                onChange={(e) => setNurMeine(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-700"
              />
              nur meine
            </label>
            {(suche.trim() || zeitraum !== 'alle' || nurMeine) && (
              <Tooltip text="Suche und Zeitraum zurücksetzen">
                <button
                  type="button"
                  onClick={() => {
                    setSuche('')
                    setZeitraum('alle')
                    setNurMeine(false)
                  }}
                  className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  zurücksetzen
                </button>
              </Tooltip>
            )}
            <span className="text-xs text-slate-600">
              {ausgangGefiltert.length} {ausgangGefiltert.length === 1 ? 'Auftrag' : 'Aufträge'}
            </span>
          </div>

          {/* Gesetzter Schnellfilter: als Chip sichtbar und mit einem Klick weg.
               Ein Filter, den man nicht sieht, ist eine zweite Wahrheit über die
               Liste (DEC-082). */}
          {schnellfilter && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600">Filter:</span>
              <Tooltip text="Filter aufheben">
                <button
                  type="button"
                  onClick={() => setSchnellfilter(null)}
                  className="ui-badge ui-badge-neutral inline-flex items-center gap-1"
                >
                  {schnellfilter === 'entwurf'
                    ? 'nur Entwürfe'
                    : schnellfilter === 'unterwegs'
                      ? 'nur unterwegs'
                      : `älter als ${LANGE_OFFEN} Tage`}
                  <XIcon className="h-3 w-3" />
                </button>
              </Tooltip>
              <span className="text-slate-600">
                {ausgangGefiltert.length} von {ausgang.length}
              </span>
            </div>
          )}

          {laden && orders.length === 0 ? (
            <p className="text-xs text-slate-600">Aufträge werden geladen …</p>
          ) : (
            <OrderList
              orders={ausgangGefiltert}
              aufgeklappt={aufgeklappt}
              busyId={busyId}
              leerText={
                schnellfilter
                  ? 'Kein Auftrag passt zu diesem Filter.'
                  : 'Kein Auftrag aus diesem Werk.'
              }
              leerHinweis={
                schnellfilter
                  ? 'Filter über das Kreuz über der Liste aufheben.'
                  : undefined
              }
              onToggle={umschalten}
              onSend={(order) => void verschicken(order)}
              onCancel={(order) => void stornieren(order)}
              onReceive={setEmpfang}
              onReturn={setRueck}
              onDetail={(order) => setDetailId(order.id)}
            />
          )}
        </div>
      )}

      {bereich === 'eingang' && (
        <>
          <div className="bereich-in app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Eingang in <WerkName plant={werk} fallback="dem Arbeitswerk" />
              </h2>
              <span className="text-xs text-slate-600">
                {auftragAnzahl(zahlen.eingangAuftraege)} offen ·{' '}
                {werkzeugAnzahl(zahlen.eingangZeilen)} zu bestätigen
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Bestätigen darf, wer sein Arbeitswerk auf{' '}
              <strong>{werk.name}</strong> gestellt hat; Person, Arbeitswerk und Zeitpunkt
              werden festgehalten (DEC-074).
            </p>
            <IncomingCards
              orders={eingangOffen}
              onReceive={setEmpfang}
              onDetail={(order) => setDetailId(order.id)}
            />
          </div>

          {/* „Angenommen" erscheint erst, wenn es etwas zu zeigen gibt – eine
              Karte mit „0 abgeschlossen" wäre nur Fläche ohne Inhalt. */}
          {eingegangen.length > 0 && (
            <div className="bereich-in app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Angenommen</h2>
                <span className="text-xs text-slate-600">
                  {eingegangen.length} angekommen
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Angekommene Werkzeuge liegen hier, bis sie zurückgehen. Zurück schicken lässt
                sich einzeln aus dem aufgeklappten Auftrag (DEC-078).
              </p>
              <OrderList
                orders={eingegangen}
                aufgeklappt={aufgeklappt}
                busyId={busyId}
                leerText="Noch nichts angekommen."
                onToggle={umschalten}
                onSend={(order) => void verschicken(order)}
                onCancel={(order) => void stornieren(order)}
                onReceive={setEmpfang}
                onReturn={setRueck}
                onDetail={(order) => setDetailId(order.id)}
              />
            </div>
          )}
        </>
      )}

      {bereich === 'wowas' && (
        <div className="bereich-in app-content-block rounded-2xl p-5 shadow-xs">
          <AwayTable refreshKey={stand} onOpenOrder={oeffnen} />
        </div>
      )}

      {neuOffen && (
        <NewOrderModal
          aktivPlant={werk}
          zielWerke={plants.filter((p) => p.id !== werk.id)}
          onClose={() => setNeuOffen(false)}
          onSaved={(order, gesendet, weiterOffen) => {
            notify(
              'success',
              gesendet
                ? `${order.order_number} ist unterwegs`
                : `${order.order_number} gespeichert`,
              gesendet
                ? `${werkzeugAnzahl(order.item_count)} nach ${order.to_plant?.name ?? '?'}.`
                : 'Der Auftrag liegt als Entwurf bereit – verschickt wird er aus der Liste.',
            )
            onAktion()
            void ladeAuftraege()
            if (!weiterOffen) {
              setNeuOffen(false)
              oeffnen(order.id)
            }
          }}
        />
      )}

      {empfang && (
        <ReceiveModal
          order={empfang}
          onClose={() => setEmpfang(null)}
          onDone={(aktualisiert, anzahl) => {
            notify(
              'success',
              `${werkzeugAnzahl(anzahl)} bestätigt`,
              `Auftrag ${aktualisiert.order_number} · ${
                aktualisiert.status === 'received' ? 'vollständig angekommen' : 'teilweise angekommen'
              }.`,
            )
            setEmpfang(null)
            onAktion()
            void ladeAuftraege()
            // Im Eingang bleiben und den Auftrag dort aufklappen – dort steht er
            // gleich darauf unter „Angenommen".
            aufklappen(aktualisiert.id)
          }}
        />
      )}

      {rueck && (
        <ReturnOrderModal
          order={rueck}
          onClose={() => setRueck(null)}
          onDone={(angelegt, anzahl) => {
            notify(
              'success',
              `Rück-Auftrag ${angelegt.order_number} angelegt`,
              `${werkzeugAnzahl(anzahl)} gehen zurück nach ${angelegt.to_plant?.name ?? '?'} – `
                + 'verschickt wird er aus der Auftragsliste.',
            )
            setRueck(null)
            onAktion()
            void ladeAuftraege()
            oeffnen(angelegt.id)
          }}
        />
      )}

      {detailId !== null && (
        <OrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onReceive={(order) => {
            setDetailId(null)
            setEmpfang(order)
          }}
          onReturn={(order) => {
            setDetailId(null)
            setRueck(order)
          }}
        />
      )}

      {rueckListeOffen && (
        <ZurueckModal
          onClose={() => setRueckListeOffen(false)}
          onSent={(anzahl, anWerk, auftragsNummer) => {
            notify(
              'success',
              `${werkzeugAnzahl(anzahl)} zurückgeschickt`,
              `${auftragsNummer}: zurück an ${anWerk} – dort im Eingang bestätigen.`,
            )
            setRueckListeOffen(false)
            onAktion()
            void ladeAuftraege()
          }}
        />
      )}
    </div>
  )
}
