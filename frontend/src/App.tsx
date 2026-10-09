import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Tools from './pages/Tools';
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
import { LoginIcon, AddIcon, AdminIcon } from './components/icons';
import AdminLayout from './pages/admin/AdminLayout';
import SessionTimer from './components/SessionTimer';
import SessionWarning from './components/SessionWarning';
import ToastStack from './components/ToastStack';
import { useToasts } from './lib/useToasts';
import { useSessionHeartbeat } from './lib/useSessionHeartbeat';

type TabKey =
  | 'werkzeuge'
  | 'serienartikel'
  | 'datenblaetter'
  | 'ersatzteile'
  | 'historie'
  | 'create';
type ViewMode = 'main' | 'admin';

// Tab-Leiste der Hauptansicht (DEC-066): Werkzeuge · Serienartikel ·
// Datenblätter · Ersatzteile · Historie. „Lager/Ersatz" ist entfallen:
// Ersatzwerkzeuge stehen in der Werkzeugliste, Ersatzteile im eigenen Tab.
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

// Platzhalter für Bereiche, die noch nicht gebaut sind. Der Text benennt das
// Vorhaben, statt nur „folgt später" zu sagen (DEC-066 Punkt 3).
function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="app-content-block rounded-2xl p-5 shadow-xs">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-600">
        {note ?? 'Dieser Bereich folgt in einem späteren Schritt.'}
      </p>
    </div>
  );
}

// Rechte Spalte: Statistik-Sidebar (.app-stat-card) nach test.html
function StatisticsSidebar() {
  return (
    <div className="space-y-3">
      <div className="app-stat-card rounded-2xl p-4">
        <p className="text-xs font-medium text-slate-600">Aktive Ausleihen</p>
        <p className="mt-1 text-xl font-bold text-slate-900">—</p>
      </div>
      <div className="app-stat-card rounded-2xl p-4">
        <p className="text-xs font-medium text-slate-600">Verfügbare Werkzeuge</p>
        <p className="mt-1 text-xl font-bold text-slate-900">—</p>
      </div>
      <div className="app-stat-card rounded-2xl p-4">
        <p className="text-xs font-medium text-slate-600">Lagerbestand</p>
        <p className="mt-1 text-xl font-bold text-slate-900">—</p>
      </div>
      <div className="app-stat-card rounded-2xl p-4">
        <p className="text-xs font-medium text-slate-600">Serienartikel</p>
        <p className="mt-1 text-xl font-bold text-slate-900">—</p>
      </div>
    </div>
  );
}

const MainApp: React.FC = () => {
  const { user, logout, expireSession, extendSession, isLoading, expiresAt } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('werkzeuge');
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
  // Auftrag aus einer Werkzeugzeile filtert die Liste auf diese Werkzeug-ID.
  const canManageDataSheets = !!user?.is_admin;
  // Im Datei-Fenster dürfen Dateien nur Admins entfernen – in **beiden**
  // Bereichen (Serienartikel DEC-062, Datenblatt DEC-065).
  const canManageViewerFiles = !!user?.is_admin;
  const [dataSheetRefreshKey, setDataSheetRefreshKey] = useState(0);
  const [dataSheetFilter, setDataSheetFilter] = useState<string | null>(null);
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
   * Zeilenaktion „Datenblatt" in der Werkzeugliste (DEC-065 Punkt 10).
   *
   * **Gibt es genau ein Datenblatt zu dieser ID, geht es direkt auf.** Wer an
   * der Maschine steht, kommt vom Werkzeug: der Weg über den Bereich und die
   * Liste wäre ein Umweg, den er nicht braucht.
   *
   * Sonst (kein Datenblatt, mehrere zu dieser ID, oder eines ohne hinterlegte
   * Datei) wechselt die Ansicht in den Datenblatt-Bereich und filtert dort auf
   * die ID – dann ist die Liste die richtige Antwort. Bei mehreren sagt ein
   * Hinweis, warum.
   */
  function openDataSheetsForTool(tool: { tool_id: string | null }) {
    const id = tool.tool_id?.trim();
    // Ohne ID (Abstreifer, Matrize – DEC-055) gibt es nichts zu suchen; das
    // Datenblatt ist dann nur über Werk und Maschine auffindbar.
    if (!id) {
      setDataSheetFilter('');
      setActiveTab('datenblaetter');
      return;
    }

    // Ein Klick darf den vorigen Auftrag entwerten: kommt eine späte Antwort
    // nach einem zweiten Klick, öffnet sie sonst das falsche Datenblatt.
    const auftrag = ++dataSheetRequestId.current;

    void getDataSheets({ toolId: id, limit: 200 })
      .then((seite) => {
        if (auftrag !== dataSheetRequestId.current) return;
        const treffer = seite.items;
        if (treffer.length === 1 && treffer[0].has_pdf) {
          setViewingFiles(dataSheetViewer(treffer[0]));
          return;
        }
        if (treffer.length > 1) {
          showToast(
            'info',
            `Zu „${id}“ gibt es ${treffer.length} Datenblätter.`,
            'Bitte das passende in der Liste wählen.',
          );
        }
        setDataSheetFilter(id);
        setActiveTab('datenblaetter');
      })
      .catch((err: unknown) => {
        if (auftrag !== dataSheetRequestId.current) return;
        // Kein stiller Fehlschlag: ohne Rückmeldung bliebe der Klick wirkungslos.
        showToast(
          'error',
          'Datenblatt konnte nicht geöffnet werden.',
          err instanceof Error ? err.message : undefined,
        );
      });
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
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px]">
        <div className="grid grid-cols-12 gap-5">
          {/* CONTENT SPALTE */}
          <div className="col-span-12 xl:col-span-9 space-y-4">
            {/* TABBAR (.app-tabbar): NUR über dem Content, + Anlegen rechts */}
            <nav aria-label="Bereiche wechseln" className="app-tabbar flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl shadow-xs">
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

              {/* + Anlegen öffnet das passende Formular je nach aktivem Tab.
                  Im Serienartikel-Bereich nur für Admins (DEC-056 Punkt 4). */}
              {!(activeTab === 'serienartikel' && !canManageSerialArticles) && (
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
                      key={dataSheetFilter ?? 'alle'}
                      refreshKey={dataSheetRefreshKey}
                      canManage={canManageDataSheets}
                      initialSearch={dataSheetFilter ?? ''}
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

                {activeTab === 'historie' && (
                  <Placeholder
                    title="Historie"
                    note={
                      'Hier erscheinen später alle Werkzeugbewegungen (Ausleihe, Rückgabe, ' +
                      'Verschieben, Statuswechsel) mit Filter und Auswertung. Der Verlauf wird ' +
                      'heute im Admin-Panel unter „Lagerplätze“ geführt; der eigene Tab kommt ' +
                      'mit dem Bewegungspaket (TASK-025).'
                    }
                  />
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

          {/* RECHTE SPALTE: Statistik-Sidebar (.app-stat-card) */}
          <aside className="col-span-12 xl:col-span-3 space-y-3">
            <StatisticsSidebar />
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