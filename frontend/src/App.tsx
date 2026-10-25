import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Tools from './pages/Tools';
import Logistics from './pages/Logistics';
import History from './pages/History';
import PlantSwitch from './components/PlantSwitch';
import { usePlantTheme } from './lib/plantTheme';
import SerialArticleList from './components/serial-articles/SerialArticleList';
import PDFViewer from './components/serial-articles/PDFViewer';
import SparePartList from './components/spare-parts/SparePartList';
import DataSheetList from './components/data-sheets/DataSheetList';
import type { SparePart } from './types/spare-part';
import type { DataSheet } from './types/data-sheet';
import type { SerialArticle } from './types/serial-article';
import type { ViewerRequest } from './types/viewer';
import { dataSheetViewer, serialArticleViewer } from './lib/viewerSources';
import { getDataSheets } from './api/dataSheets';
import { getDisplayName } from './lib/api';
import {
  LoginIcon,
  AddIcon,
  AdminIcon,
  TruckIcon,
  ToolIcon,
  CheckIcon,
  ClipboardListIcon,
  AlertCircleIcon,
} from './components/icons';
import AdminLayout from './pages/admin/AdminLayout';
import SessionTimer from './components/SessionTimer';
import Tooltip from './components/ui/Tooltip';
import SessionWarning from './components/SessionWarning';
import ToastStack from './components/ToastStack';
import { useToasts } from './lib/useToasts';
import { useSessionHeartbeat } from './lib/useSessionHeartbeat';
import { useStatistik } from './lib/useStatistik';
import KpiKarte from './components/ui/KpiKarte';
import type { StatsOverview } from './api/stats';

type TabKey =
  | 'werkzeuge'
  | 'serienartikel'
  | 'datenblaetter'
  | 'ersatzteile'
  | 'logistik'
  | 'historie'
  | 'create';
type ViewMode = 'main' | 'admin';

// Tab-Leiste der Hauptansicht (DEC-066): Werkzeuge · Serienartikel ·
// Datenblätter · Ersatzteile · Historie – das sind die **Stammdaten-Bereiche**.
// „Logistik" steht bewusst **daneben** und nicht in dieser Gruppe (DEC-086): dort
// geht es nicht um Stammdaten, sondern um Bewegung zwischen den Werken. Eigene
// Pille, eigenes Zeichen, im aktiven Zustand die Fläche in der Werkfarbe.
const TABS: { key: TabKey; label: string }[] = [
  { key: 'werkzeuge', label: 'Werkzeuge' },
  { key: 'serienartikel', label: 'Serienartikel' },
  { key: 'datenblaetter', label: 'Datenblätter' },
  { key: 'ersatzteile', label: 'Ersatzteile' },
  { key: 'historie', label: 'Historie' },
];

// Tab-Leiste und "+ Anlegen" kommen aus dem Guide-System (.ui-tabs / .ui-btn).
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Rechte Spalte: Kennzahlen des Arbeitswerks (DEC-089).
//
// Bis hierher standen die vier Karten auf „—": sie waren die letzte offene Frage
// aus `docs/21` (offene Frage 7, „rechte Spalte füllen"). Jetzt zeigen sie Zahlen
// aus `GET /api/stats/overview` und sind **Sprungziele**: Wer „3 Eingang offen"
// liest, will dorthin – ein Klick öffnet den passenden Bereich.
//
// Gestalt: KPI-Karten aus dem Styleguide (`components/ui/KpiKarte.tsx`, kompakte
// Spaltenform: `text-2xl`, Zeichen `h-10 w-10`, höchstens vier Karten).
function StatisticsSidebar({
  zahlen,
  onWerkzeuge,
  onLogistik,
  onEingang,
}: {
  zahlen: StatsOverview | null;
  onWerkzeuge: () => void;
  onLogistik: () => void;
  onEingang: () => void;
}) {
  const verfuegbar = zahlen?.tools_available ?? null;
  const gesamt = zahlen?.tools_total ?? 0;
  const anteil = gesamt > 0 && verfuegbar !== null ? Math.round((verfuegbar / gesamt) * 100) : 0;

  return (
    // `space-y-4` wie die Blöcke im Inhaltsbereich (vorher 12 px gegen 16 px –
    // die Karten standen enger als die Blöcke daneben, DEC-083).
    <div className="space-y-4">
      <KpiKarte
        kompakt
        farbe="sky"
        zahl={zahlen?.tools_lent ?? null}
        name="Aktive Ausleihen"
        icon={<ToolIcon className="h-5 w-5" />}
        titel="Werkzeuge, die gerade bei einer Person sind – Klick öffnet die Werkzeugliste"
        onClick={onWerkzeuge}
      />
      <KpiKarte
        kompakt
        farbe="emerald"
        zahl={verfuegbar}
        name="Verfügbare Werkzeuge"
        icon={<CheckIcon className="h-5 w-5" />}
        titel="Klick öffnet die Werkzeugliste"
        onClick={onWerkzeuge}
        fuss={
          <span className="block">
            <span className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600">von {gesamt || '—'} insgesamt</span>
              <span className="font-semibold text-slate-700">{anteil} %</span>
            </span>
            <span className="ui-progress mt-1">
              <span className="bg-gradient-to-r from-emerald-600 to-teal-400" style={{ width: `${anteil}%` }} />
            </span>
          </span>
        }
      />
      <KpiKarte
        kompakt
        farbe="teal"
        zahl={zahlen?.orders_open ?? null}
        name="Offene Aufträge"
        icon={<TruckIcon className="h-5 w-5" />}
        titel="Entwürfe und Aufträge, die unterwegs sind – Klick öffnet die Logistik"
        onClick={onLogistik}
        marke={
          zahlen && zahlen.orders_old > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/25">
              <AlertCircleIcon className="h-3 w-3" />
              {zahlen.orders_old} alt
            </span>
          ) : null
        }
      />
      <KpiKarte
        kompakt
        farbe="amber"
        zahl={zahlen?.orders_incoming_open ?? null}
        name="Eingang offen"
        icon={<ClipboardListIcon className="h-5 w-5" />}
        titel="Aufträge, die hier noch bestätigt werden müssen – Klick öffnet den Eingang"
        onClick={onEingang}
      />
    </div>
  );
}

const MainApp: React.FC = () => {
  const { user, logout, expireSession, extendSession, isLoading, expiresAt, refreshPlant } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('werkzeuge');
  // Werkfarbe des Arbeitswerks als CSS-Variablen (`--werk`, `--werk-soft`,
  // `--werk-line`) – jede Stelle nutzt sie über `var(--werk)` (DEC-076).
  usePlantTheme(user?.id, user?.plant_id ?? null);
  // Auftrag „Werkzeug anlegen“ an die Liste: eindeutiges Token statt Zähler,
  // damit ein bereits verbrauchter Auftrag nicht erneut greift.
  const createToken = useRef(0);
  const [toolCreateRequest, setToolCreateRequest] = useState<number | null>(null);

  // Serienartikel-Zustände
  // Datei-Fenster: Dokument + Datei-Quelle kommen als fertiger Auftrag herein
  // (`lib/viewerSources.ts`) – das Fenster selbst kennt keine Endpunkte (DEC-065).
  const [viewingFiles, setViewingFiles] = useState<ViewerRequest | null>(null);
  // Sitzung bei Aktivitaet verlaengern (Backend erneuert den Token). Solange ein
  // Plan-/Bildfenster offen ist, zusaetzlich ein Lebenszeichen: die Ereignisse
  // darin (Chrome-PDF im iframe) erreichen das Hauptfenster nicht.
  useSessionHeartbeat(!!user, viewingFiles !== null);
  const [serialArticleRefreshKey, setSerialArticleRefreshKey] = useState(0);
  // Es gibt EINEN Anlegen-Knopf: er öffnet das Anlege-Formular mit Reitern
  // (Werkzeug, Serienartikel, Datenblatt, Ersatzteil). Der Auftrag wandert als
  // Einmal-Token dorthin – ein eigenes Fenster für Serienartikel gibt es nicht
  // (DEC-056 Punkt 5). `article: null` = anlegen, sonst bearbeiten.
  const serialToken = useRef(0);
  const [serialRequest, setSerialRequest] = useState<
    { token: number; article: SerialArticle | null } | null
  >(null);
  // Verwalten (anlegen, bearbeiten, löschen) ist Administratoren vorbehalten
  // (DEC-056 Punkt 4) – die Server prüfen es zusätzlich selbst.
  const canManageSerialArticles = !!user?.is_admin;
  // Ersatzteile: Lesen, Anlegen und Ändern darf jeder aktive Benutzer, **Löschen
  // nur Admins** (DEC-064 Punkt 10) – serverseitig über `require_admin` geprüft.
  const canDeleteSpareParts = !!user?.is_admin;
  const [sparePartRefreshKey, setSparePartRefreshKey] = useState(0);
  // Derselbe Einmal-Token-Weg wie beim Serienartikel: `part: null` = anlegen,
  // sonst bearbeiten (DEC-066 Punkt 4).
  const sparePartToken = useRef(0);
  const [sparePartRequest, setSparePartRequest] = useState<
    { token: number; part: SparePart | null } | null
  >(null);

  // Datenblätter (DEC-065): eigener Bereich, Verwaltung durch Admins. Der
  // Auftrag aus einer Werkzeugzeile filtert die Liste **nicht** mehr: das Symbol
  // öffnet das Datenblatt direkt (DEC-068). Die Übersicht bleibt beim Öffnen des
  // Bereichs ungefiltert – eine vorbelegte Suche wäre eine zweite Wahrheit
  // darüber, was der Benutzer sehen will.
  const canManageDataSheets = !!user?.is_admin;
  // Im Datei-Fenster dürfen Dateien nur Admins entfernen – in **beiden**
  // Bereichen (Serienartikel DEC-062, Datenblatt DEC-065).
  const canManageViewerFiles = !!user?.is_admin;
  const [dataSheetRefreshKey, setDataSheetRefreshKey] = useState(0);
  // Werkzeug-Logistik (DEC-072): Auftragsliste, Eingang und „Wo ist was" hängen
  // am Arbeitswerk – ein Wechsel lädt sie neu.
  const [logisticsRefreshKey, setLogisticsRefreshKey] = useState(0);
  // Zähler am Logistik-Knopf (DEC-089): offene Aufträge des Arbeitswerks. Der
  // Knopf steht hier in der Leiste, die Liste im Bereich – der Zähler wird
  // deshalb außerhalb geladen und bei jeder Änderung im Bereich nachgeführt.
  // Aktionen **im** Bereich (verschicken, empfangen, zurück) melden sich über
  // `onAktion` – Kennzahlen und Zähler oben sollen sofort nachziehen (DEC-090).
  const [logistikAktionen, setLogistikAktionen] = useState(0);
  const statistik = useStatistik(
    user?.id ?? null,
    user?.plant_id ?? null,
    logisticsRefreshKey + logistikAktionen,
  );
  // Der Zähler am Logistik-Knopf ist `orders_open` aus derselben Antwort – eine
  // Quelle für Knopf und rechte Spalte (DEC-089).
  const offeneAuftraege = statistik?.orders_open ?? 0;
  // „Läuft zu lange“ (DEC-092): offene Aufträge ab 7 Tagen. Sie bekommen am
  // Logistik-Knopf eine Amber-Marke und beim Anmelden **einen** Hinweis.
  const ueberfaellig = statistik?.orders_old ?? 0;
  /** Sprung in den Eingang der Logistik (aus der rechten Spalte). */
  const [eingangWunsch, setEingangWunsch] = useState(0);
  const dataSheetToken = useRef(0);
  /**
   * Laufender Auftrag der Zeilenaktion „Datenblatt": eine späte Antwort einer
   * vorigen Anfrage darf das inzwischen gewählte Datenblatt nicht überschreiben.
   */
  const dataSheetRequestId = useRef(0);
  const [dataSheetRequest, setDataSheetRequest] = useState<
    { token: number; sheet: DataSheet | null } | null
  >(null);
  // Rückmeldungen als Toast (Guide „Feedback"), nicht als Meldung im Block.
  const { toasts, showToast, dismissToast } = useToasts();

  /** Anlege-Formular öffnen – mit dem Reiter „Serienartikel" (null = neuer Plan). */
  function openSerialForm(article: SerialArticle | null = null) {
    if (!canManageSerialArticles) return;
    serialToken.current += 1;
    setSerialRequest({ token: serialToken.current, article });
    setActiveTab('create');
  }

  /**
   * Zurück aus dem Anlege-Formular („Zurück" oder nach dem Bearbeiten): wieder in
   * den Serienartikel-Bereich und die Liste dort aktualisieren.
   */
  function handleSerialFormClosed() {
    setActiveTab('serienartikel');
    setSerialArticleRefreshKey((k) => k + 1);
  }

  /**
   * Werkswechsel (DEC-070/076): Arbeitswerk neu auflösen lassen (damit die
   * Werkfarbe auch in der Oberfläche ankommt) und alle werkabhängigen Listen neu
   * laden. Die Wahl selbst liegt bereits im Browser-Merkzettel; ab der nächsten
   * Anfrage geht sie als `X-Plant-Id` mit.
   */
  function handlePlantChanged() {
    void refreshPlant();
    setSerialArticleRefreshKey((k) => k + 1);
    setSparePartRefreshKey((k) => k + 1);
    setDataSheetRefreshKey((k) => k + 1);
    setLogisticsRefreshKey((k) => k + 1);
  }

  /**
   * Liste nach dem Speichern aktualisieren.
   *
   * Die **Meldung** kommt nicht von hier, sondern vom Formular selbst
   * (`onNotify`): es weiß, ob angelegt oder geändert wurde, und ist die eine
   * Stelle, an der die Rückmeldung entsteht. Vorher meldeten Formular und App
   * denselben Vorgang – der Benutzer sah denselben Satz zweimal.
   */
  function handleSerialArticleSaved() {
    setSerialArticleRefreshKey((k) => k + 1);
  }

  // Ersatzteil-Zustände (DEC-064): Der Bereich hat denselben Einmal-Token-Weg
  // wie die Serienartikel – ein Anlegen-Knopf, Reiter „Ersatzteil" offen.

  /** Anlege-Formular öffnen – mit dem Reiter „Ersatzteil" (null = neues Teil). */
  function openSparePartForm(part: SparePart | null = null) {
    sparePartToken.current += 1;
    setSparePartRequest({ token: sparePartToken.current, part });
    setActiveTab('create');
  }

  /** Zurück aus dem Anlege-Formular: wieder in den Ersatzteil-Bereich. */
  function handleSpareFormClosed() {
    setActiveTab('ersatzteile');
    setSparePartRefreshKey((k) => k + 1);
  }

  /** Liste nach dem Speichern aktualisieren – die Meldung macht das Formular. */
  function handleSparePartSaved() {
    setSparePartRefreshKey((k) => k + 1);
  }

  /** Anlege-Formular öffnen – mit dem Reiter „Datenblatt" (null = neues Blatt). */
  function openDataSheetForm(sheet: DataSheet | null = null) {
    if (!canManageDataSheets) return;
    dataSheetToken.current += 1;
    setDataSheetRequest({ token: dataSheetToken.current, sheet });
    setActiveTab('create');
  }

  /** Zurück aus dem Anlege-Formular: wieder in den Datenblatt-Bereich. */
  function handleDataSheetFormClosed() {
    setActiveTab('datenblaetter');
    setDataSheetRefreshKey((k) => k + 1);
  }

  /** Liste nach dem Speichern aktualisieren – die Meldung macht das Formular. */
  function handleDataSheetSaved() {
    setDataSheetRefreshKey((k) => k + 1);
  }

  /**
   * Zeilenaktion „Datenblatt" in der Werkzeugliste (DEC-065 Punkt 10, DEC-068).
   *
   * Das Symbol in der Zeile steht **nur**, wenn es zu dieser Werkzeug-ID ein
   * Datenblatt mit hinterlegter Datei gibt (`has_data_sheet`). Der Klick öffnet
   * es deshalb **direkt** – ohne Bereichswechsel, ohne vorbelegte Suche. Wer an
   * der Maschine steht, kommt vom Werkzeug; ein Umweg über die Liste wäre keiner.
   *
   * Gibt es mehrere Datenblätter zu der ID (DEC-065 Punkt 7: erlaubt, z. B. für
   * eine andere Auflage), öffnet das erste – sortiert nach Werkzeug-ID und
   * Datensatz-ID, also nachvollziehbar – und ein Hinweis nennt die Anzahl.
   */
  function openDataSheetsForTool(tool: { tool_id: string | null }) {
    const id = tool.tool_id?.trim();
    // Ohne ID (Abstreifer, Matrize – DEC-055) gibt es kein Datenblatt; das Symbol
    // steht dort nicht, der Aufruf kann also nur über einen veralteten Stand kommen.
    if (!id) return;

    // Ein Klick darf den vorigen Auftrag entwerten: kommt eine späte Antwort
    // nach einem zweiten Klick, öffnet sie sonst das falsche Datenblatt.
    const auftrag = ++dataSheetRequestId.current;

    void getDataSheets({ toolId: id, limit: 200 })
      .then((seite) => {
        if (auftrag !== dataSheetRequestId.current) return;

        // Gezählt wird, was sich öffnen lässt: nur Datenblätter mit Datei.
        const treffer = seite.items.filter((sheet) => sheet.has_pdf)
        if (treffer.length === 0) {
          // Zwischen Laden der Liste und Klick gelöscht – kein stiller Fehlschlag.
          showToast(
            'error',
            `Zu „${id}“ gibt es kein Datenblatt mehr.`,
            'Bitte die Werkzeugliste neu laden.',
          )
          return
        }
        if (treffer.length > 1) {
          showToast(
            'info',
            `Zu „${id}“ gibt es ${treffer.length} Datenblätter.`,
            'Angezeigt wird das erste.',
          )
        }
        setViewingFiles(dataSheetViewer(treffer[0]))
      })
      .catch((err: unknown) => {
        if (auftrag !== dataSheetRequestId.current) return;
        // Kein stiller Fehlschlag: ohne Rückmeldung bliebe der Klick wirkungslos.
        showToast(
          'error',
          'Datenblatt konnte nicht geöffnet werden.',
          err instanceof Error ? err.message : undefined,
        )
      })
  }

  // Direktaufruf von /admin (Lesezeichen, Neuladen): Startwert kommt aus der
  // Adresszeile – so wie bei den Werkzeugfiltern. Damit erscheint das
  // Admin-Panel ohne Umweg und ohne kurzes Aufblitzen der Hauptseite.
  const [view, setView] = useState<ViewMode>(() =>
    window.location.pathname === '/admin' ? 'admin' : 'main',
  );

  // Admin-View aktualisiert die URL
  function openAdmin() {
    setView('admin');
    window.history.pushState({}, '', '/admin');
  }

  function backToMain() {
    setView('main');
    window.history.pushState({}, '', '/');
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-slate-600">Wird geladen…</p>
      </div>
    );
  }

  function switchTab(key: TabKey) {
    setActiveTab(key);
    // Ein offener Serienartikel- oder Ersatzteil-Auftrag gehört zum Anlege-
    // Formular; beim Verlassen der Ansicht wird er verworfen (sonst öffnete er
    // sich später erneut, weil er nicht verbraucht wurde).
    if (key !== 'create') {
      setSerialRequest(null);
      setSparePartRequest(null);
      setDataSheetRequest(null);
    }
    if (key === 'create') {
      requestToolCreate();
    }
  }

  // Einmal-Auftrag an die Werkzeugliste: das Formular geht auf, der Auftrag ist
  // damit verbraucht. Ohne dieses Verbrauchen würde die Liste beim nächsten
  // Einhängen (Tab-Wechsel, Rückkehr aus dem Admin-Panel) das Anlegen-Formular
  // von selbst wieder öffnen.
  function requestToolCreate() {
    createToken.current += 1;
    setToolCreateRequest(createToken.current);
  }

  function handleToolCreateHandled() {
    setToolCreateRequest(null);
  }

  // + Anlegen in der Tabbar – immer EIN Weg: das Anlege-Formular mit Reitern
  function handleCreateClick() {
    if (activeTab === 'serienartikel') {
      openSerialForm(null);
      return;
    }
    if (activeTab === 'datenblaetter') {
      openDataSheetForm(null);
      return;
    }
    if (activeTab === 'ersatzteile') {
      openSparePartForm(null);
      return;
    }
    // Standard: Werkzeug anlegen (auch bei Historie oder Create)
    switchTab('create');
  }

  // Wenn Admin-View und eingeloggt → AdminLayout anzeigen
  if (view === 'admin' && user) {
    return <AdminLayout onBack={backToMain} />;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* MOBILE KOPFZEILE (nur < md): Branding, Benutzer, Admin-Panel, Abmelden.
          Die Sidebar ist erst ab md sichtbar – ohne diese Zeile gäbe es auf
          Telefon und Tablet keinen Weg zum Abmelden. */}
      <header className="app-tabbar sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 md:hidden">
        <span className="shrink-0 text-sm font-bold tracking-tight text-slate-900">ToolSync</span>
        {user && (
          <div className="flex min-w-0 items-center gap-3 text-xs font-medium text-slate-600">
            <span className="min-w-0 truncate">{getDisplayName(user)}</span>
            {/* Restzeit auch auf Telefon/Tablet: ohne diese Anzeige endet die
                Sitzung hier unbemerkt, weil die Sidebar (ab md) nicht sichtbar ist. */}
            <SessionTimer expiresAt={expiresAt} onExpire={expireSession} short />
            {user.is_admin && (
              <button
                type="button"
                onClick={openAdmin}
                className="ui-btn ui-btn-secondary ui-btn-sm shrink-0"
              >
                Admin-Panel
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="ui-btn ui-btn-secondary ui-btn-sm shrink-0"
            >
              Abmelden
            </button>
          </div>
        )}
      </header>

      {/* SIDEBAR (.app-sidebar): Branding, darunter direkt der Benutzerblock –
          KEINE Navigation. Ohne justify-between sitzt der Block oben unter den
          Logos statt am unteren Rand. */}
      <aside className="app-sidebar hidden md:flex w-60 p-6 flex-col shrink-0">
        <div className="flex flex-col items-center gap-3 pb-4 mb-4 border-b border-white/20">
          {/* Firmenlogo HPolytechnik (wie im LoginForm) */}
          <div className="logo-main relative w-[100px] h-[100px]">
            <span className="logo-text-hp text-[70px] absolute top-[-15px] left-[-5px] z-20">hp</span>
            <span className="logo-text text-xs absolute bottom-[16px] left-10 z-20">olytechnik</span>
          </div>
          {/* Logo + Slogan (ToolSync) */}
          <div className="min-w-0 text-center">
            <span className="block text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              ToolSync
            </span>
            <span className="block text-[12px] font-medium text-slate-600 leading-tight">
              Werkzeug- &amp; Lagerverwaltung
            </span>
          </div>
        </div>

        {/* Profil + Abmelden – nur wenn eingeloggt, direkt unter den Logos.
            Die Trennlinie kommt schon vom Logoblock darüber. */}
        {user && (
          <div className="space-y-2 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2 px-2 py-1 group">
              <div className="ui-avatar shrink-0">
                {getInitials(user.first_name, user.last_name)}
              </div>
              <span className="truncate">
                {getDisplayName(user)}
                {user.is_admin ? ' (Admin)' : ''}
              </span>
            </div>
            {/* Restzeit der Sitzung – wird bei Aktivitaet zurueckgesetzt */}
            <div className="px-2">
              <SessionTimer expiresAt={expiresAt} onExpire={expireSession} />
            </div>
            {/* Arbeitswerk (DEC-070): sitzt in der Sidebar unter dem Benutzer –
                in jedem Bereich sichtbar, kein eigener Tab, keine Leiste über
                dem Inhalt. Der Wechsel färbt die Oberfläche (DEC-076) und lädt
                die werkabhängigen Listen neu. */}
            <div className="pt-1">
              <PlantSwitch
                userId={user.id}
                serverPlantId={user.plant_id ?? null}
                onChanged={handlePlantChanged}
              />
            </div>
            {user.is_admin && (
              <button
                onClick={openAdmin}
                className="ui-btn ui-btn-ghost ui-btn-sm w-full justify-start"
              >
                <AdminIcon className="w-3.5 h-3.5" />
                Admin-Panel
              </button>
            )}
            <button
              onClick={logout}
              className="ui-btn ui-btn-ghost ui-btn-sm w-full justify-start"
            >
              <LoginIcon className="w-3.5 h-3.5" />
              Abmelden
            </button>
          </div>
        )}
      </aside>

      {/* MAIN WRAPPER */}
      {/* **Kein `max-w` mehr** (DEC-083): der Deckel erzeugte auf breiten
          Bildschirmen toten Raum – und der wurde entweder ganz rechts abgelegt
          oder (zentriert) links und rechts verteilt. In beiden Fällen waren die
          Außenabstände größer als der Abstand zwischen den Blöcken; genau das
          war als ungleicher Abstand sichtbar. Gemessen ist der Abstand jetzt an
          jeder Fensterbreite gleich: 24 px (Rand) = 24 px (Rasterlücke). */}
      <main className="flex-1 p-4 md:p-6 space-y-4">
        {/* `gap-6` = 24 px, dieselbe Kante wie das Seitenpolster `p-6`. */}
        <div className="grid grid-cols-12 gap-6">
          {/* CONTENT SPALTE – 10 von 12: die Statistik-Spalte rechts braucht nur
              Platz für vier kurze Karten. Das eine zusätzliche Zwölftel geht an
              die Listen und an das Formular; dort paßt die Beschichtung neben
              „Lager/Ersatz" damit in eine Zeile (DEC-083). */}
          <div className="col-span-12 xl:col-span-10 space-y-4">
            {/* TABBAR (.app-tabbar): NUR über dem Content, + Anlegen rechts */}
            <nav aria-label="Bereiche wechseln" className="app-tabbar flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl shadow-xs">
              <div className="flex min-w-0 items-center gap-2">
                <div className="ui-tabs min-w-0 overflow-x-auto">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => switchTab(tab.key)}
                      className={activeTab === tab.key ? 'is-active' : undefined}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Trennstrich: Logistik ist ein eigener Bereich, kein Reiter der
                    Stammdaten (DEC-086). */}
                <span aria-hidden="true" className="h-6 w-px shrink-0 bg-white/70" />

                <Tooltip
                  text={
                    offeneAuftraege > 0
                      ? `${offeneAuftraege} offene Aufträge${
                          ueberfaellig > 0
                            ? ` – davon ${ueberfaellig} seit über 7 Tagen`
                            : ''
                        }`
                      : 'Werkzeuge zwischen den Werken transportieren'
                  }
                >
                  <button
                    onClick={() => switchTab('logistik')}
                    className={`tab-logistik ${activeTab === 'logistik' ? 'is-active' : ''}`}
                    aria-pressed={activeTab === 'logistik'}
                  >
                    <TruckIcon className="h-4 w-4" />
                    Logistik
                    {offeneAuftraege > 0 && (
                      <span className="tab-zaehler">{offeneAuftraege}</span>
                    )}
                    {ueberfaellig > 0 && (
                      <span
                        className="tab-ueberfaellig"
                        aria-label={`${ueberfaellig} ${
                          ueberfaellig === 1 ? 'Auftrag läuft' : 'Aufträge laufen'
                        } seit über 7 Tagen`}
                      >
                        <AlertCircleIcon className="h-3 w-3" />
                        {ueberfaellig}
                      </span>
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* + Anlegen öffnet das passende Formular je nach aktivem Tab.
                  Im Serienartikel-Bereich nur für Admins (DEC-056 Punkt 4).
                  In der Logistik entfällt der Knopf: dort führt „+ Neuer
                  Auftrag" im Bereich selbst (DEC-075) – zwei Knöpfe für zwei
                  verschiedene Dinge wären eine Falle. */}
              {!(activeTab === 'serienartikel' && !canManageSerialArticles) &&
                activeTab !== 'logistik' && (
                <button
                  onClick={handleCreateClick}
                  className={`ui-btn ui-btn-primary shrink-0 ${
                    activeTab === 'create' ? 'ring-2 ring-teal-700/30' : ''
                  }`}
                >
                  <AddIcon className="w-3.5 h-3.5" />
                  Anlegen
                </button>
              )}
            </nav>

            {/* Hauptinhalt – nur wenn eingeloggt */}
            {user && (
              <>
                {activeTab === 'werkzeuge' && (
                  <Tools
                    createRequest={toolCreateRequest}
                    onCreateRequestHandled={handleToolCreateHandled}
                    serialRequest={serialRequest}
                    onSerialRequestHandled={() => setSerialRequest(null)}
                    onSerialArticleSaved={handleSerialArticleSaved}
                    onSerialFormClosed={handleSerialFormClosed}
                    // Meldungen aus dem Anlege-Formular: sie laufen über **diese**
                    // Ebene, weil die Werkzeugliste beim Speichern verschwindet
                    // (die Karte geht zu und `Tools` wird ausgehängt). Ein Toast
                    // aus der Liste heraus würde mit ihr verschwinden.
                    onNotify={showToast}
                    // Zeilenaktion „Datenblatt" gehört zur **Liste** – sie liegt
                    // hier, nicht in der Anlege-Instanz darunter (DEC-065).
                    onOpenDataSheets={openDataSheetsForTool}
                  />
                )}

                {activeTab === 'serienartikel' && (
                  <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
                    {/* Überschrift und Schnellfilter kommen aus der Liste – wie bei
                        den Werkzeugen stehen sie in einer Zeile. */}
                    <SerialArticleList
                      refreshKey={serialArticleRefreshKey}
                      canManage={canManageSerialArticles}
                      onOpenFiles={(article, tab) =>
                        setViewingFiles(serialArticleViewer(article, tab))
                      }
                      onCreate={() => openSerialForm(null)}
                      onEdit={(article) => openSerialForm(article)}
                      onInfo={(message) => showToast('success', message)}
                      onError={(message) => showToast('error', message)}
                    />
                  </div>
                )}

                {activeTab === 'datenblaetter' && (
                  <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
                    <DataSheetList
                      refreshKey={dataSheetRefreshKey}
                      canManage={canManageDataSheets}
                      onOpenFiles={(sheet) => setViewingFiles(dataSheetViewer(sheet))}
                      onCreate={() => openDataSheetForm(null)}
                      onEdit={(sheet) => openDataSheetForm(sheet)}
                      onInfo={(message) => showToast('success', message)}
                      onError={(message) => showToast('error', message)}
                    />
                  </div>
                )}

                {activeTab === 'ersatzteile' && (
                  <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
                    <SparePartList
                      refreshKey={sparePartRefreshKey}
                      canManage={canDeleteSpareParts}
                      onCreate={() => openSparePartForm(null)}
                      onEdit={(part) => openSparePartForm(part)}
                      onInfo={(message) => showToast('success', message)}
                      onError={(message) => showToast('error', message)}
                    />
                  </div>
                )}

                {activeTab === 'logistik' && (
                  <Logistics
                    refreshKey={logisticsRefreshKey}
                    eingangWunsch={eingangWunsch}
                    kennzahlen={statistik}
                    onAktion={() => setLogistikAktionen((alt) => alt + 1)}
                    notify={showToast}
                  />
                )}

                {activeTab === 'historie' && (
                  <History refreshKey={logisticsRefreshKey} />
                )}
                {activeTab === 'create' && (
                  <Tools
                    createRequest={toolCreateRequest}
                    onCreateRequestHandled={handleToolCreateHandled}
                    serialRequest={serialRequest}
                    onSerialRequestHandled={() => setSerialRequest(null)}
                    onSerialArticleSaved={handleSerialArticleSaved}
                    onSerialFormClosed={handleSerialFormClosed}
                    sparePartRequest={sparePartRequest}
                    onSparePartRequestHandled={() => setSparePartRequest(null)}
                    onSparePartSaved={handleSparePartSaved}
                    onSpareFormClosed={handleSpareFormClosed}
                    onOpenDataSheets={openDataSheetsForTool}
                    dataSheetRequest={dataSheetRequest}
                    onDataSheetRequestHandled={() => setDataSheetRequest(null)}
                    onDataSheetSaved={handleDataSheetSaved}
                    onDataSheetFormClosed={handleDataSheetFormClosed}
                    onNotify={showToast}
                  />
                )}
              </>
            )}
          </div>

          {/* RECHTE SPALTE: Statistik-Sidebar (.app-stat-card).
              Nur 2 von 12 Spalten: die Karten tragen eine Zeile Text und eine
              Zahl – dafür sind drei Spalten zu viel (DEC-083). `space-y-4` wie
              im Inhaltsbereich: gleicher Abstand zwischen allen Blöcken. */}
          <aside className="col-span-12 xl:col-span-2 space-y-4">
            <StatisticsSidebar
              zahlen={statistik}
              onWerkzeuge={() => switchTab('werkzeuge')}
              onLogistik={() => switchTab('logistik')}
              onEingang={() => {
                switchTab('logistik');
                setEingangWunsch((alt) => alt + 1);
              }}
            />
          </aside>
        </div>
      </main>

      {/* Login-Overlay – schwebt über der Hauptseite, die durchscheint */}
      {!user && (
        <div className="login-overlay">
          <LoginForm />
        </div>
      )}

      {user && viewingFiles && (
        <PDFViewer
          key={`${viewingFiles.document.id}-${viewingFiles.planLabel}-${viewingFiles.tab}`}
          document={viewingFiles.document}
          source={viewingFiles.source}
          planLabel={viewingFiles.planLabel}
          filesAriaLabel={viewingFiles.filesAriaLabel}
          initialTab={viewingFiles.tab}
          canManage={canManageViewerFiles}
          onFilesChanged={() =>
            viewingFiles.planLabel === 'Datenblatt'
              ? setDataSheetRefreshKey((k) => k + 1)
              : setSerialArticleRefreshKey((k) => k + 1)
          }
          onClose={() => setViewingFiles(null)}
        />
      )}

      {/* Warnung vor dem Ablauf der Sitzung – oberhalb aller Fenster, damit sie
          auch ueber der Plan-Vorschau sichtbar bleibt. */}
      {user && <SessionWarning onExtend={extendSession} />}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;