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
import { cancelOrder, getOrders, sendOrder } from '../api/transport'
import type { Plant } from '../api/types'
import type { ToastVariant } from '../lib/useToasts'
import type { TransportOrder } from '../types/transport'
import AwayTable from '../components/logistics/AwayTable'
import IncomingCards from '../components/logistics/IncomingCards'
import NewOrderModal from '../components/logistics/NewOrderModal'
import OrderDetailModal from '../components/logistics/OrderDetailModal'
import OrderList from '../components/logistics/OrderList'
import ReceiveModal from '../components/logistics/ReceiveModal'
import ReturnOrderModal from '../components/logistics/ReturnOrderModal'
import ZurueckModal from '../components/logistics/ZurueckModal'
import { WerkName } from '../components/logistics/logistikTeile'

type Bereich = 'auftraege' | 'eingang' | 'wowas'

interface LogisticsProps {
  /** Wechsel des Arbeitswerks oder abgeschlossener Vorgang: Liste neu laden. */
  refreshKey: number
  notify: (variant: ToastVariant, title: string, message?: string) => void
}

/** Aufträge, die noch unterwegs sind (`sent`/`partly_received`). */
const UNTERWEGS = new Set(['sent', 'partly_received'])

export default function Logistics({ refreshKey, notify }: LogisticsProps) {
  const { user } = useAuth()
  const plants = usePlants()
  const aktivId = useActivePlantId(user?.id ?? null, user?.plant_id ?? null)
  const werk: Plant | null = plants.find((p) => p.id === aktivId) ?? null

  const [bereich, setBereich] = useState<Bereich>('auftraege')
  const [orders, setOrders] = useState<TransportOrder[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [aufgeklappt, setAufgeklappt] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  /** Zähler „Liste wurde neu geladen" – „Wo ist was" hängt daran. */
  const [stand, setStand] = useState(0)

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
      const seite = await getOrders({ direction: 'both', limit: 200 })
      setOrders(seite.items)
      setStand((alt) => alt + 1)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Aufträge konnten nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladeAuftraege()
  }, [ladeAuftraege, refreshKey])

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

  const zahlen = useMemo(() => {
    const offeneZeilen = eingangOffen.reduce(
      (summe, order) => summe + (order.item_count - order.received_count),
      0,
    )
    return {
      gesamt: ausgang.length,
      unterwegs: ausgang.filter((order) => UNTERWEGS.has(order.status)).length,
      entwuerfe: ausgang.filter((order) => order.status === 'draft').length,
      eingangAuftraege: eingangOffen.length,
      eingangZeilen: offeneZeilen,
    }
  }, [ausgang, eingangOffen])

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
          <button
            type="button"
            onClick={() => setRueckListeOffen(true)}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            title="Werkzeuge aus anderen Werken an ihr Heimatwerk zurückschicken"
          >
            <ReturnIcon className="h-3.5 w-3.5" />
            Werkzeug zurück
          </button>
          <button
            type="button"
            onClick={() => setNeuOffen(true)}
            className="ui-btn ui-btn-werk ui-btn-sm"
            title="Neuen Transportauftrag anlegen"
          >
            <AddIcon className="h-3.5 w-3.5" />
            Neuer Auftrag
          </button>
        </div>
      </div>

      {fehler && (
        <div className="ui-alert ui-alert-error">
          <span>×</span>
          <div>{fehler}</div>
        </div>
      )}

      {bereich === 'auftraege' && (
        <div className="app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Aufträge aus <WerkName plant={werk} fallback="dem Arbeitswerk" />
            </h2>
            <span className="text-xs text-slate-600">
              {zahlen.gesamt} gesamt · {zahlen.unterwegs} unterwegs · {zahlen.entwuerfe}{' '}
              {zahlen.entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'}
            </span>
          </div>
          {laden && orders.length === 0 ? (
            <p className="text-xs text-slate-600">Aufträge werden geladen …</p>
          ) : (
            <OrderList
              orders={ausgang}
              aufgeklappt={aufgeklappt}
              busyId={busyId}
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
          <div className="app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
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
            <div className="app-content-block space-y-3 rounded-2xl p-5 shadow-xs">
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
        <div className="app-content-block rounded-2xl p-5 shadow-xs">
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
            void ladeAuftraege()
          }}
        />
      )}
    </div>
  )
}
