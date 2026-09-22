import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Tools from './pages/Tools';
import SerialArticleList from './components/serial-articles/SerialArticleList';
import SerialArticleUpload from './components/serial-articles/SerialArticleUpload';
import PDFViewer from './components/serial-articles/PDFViewer';
import StorageItemList from './components/storage/StorageItemList';
import StorageItemForm from './components/storage/StorageItemForm';
import { createStorageItem, updateStorageItem } from './api/storage';
import type { StorageItem, StorageItemInput } from './types/storage-item';
import type { SerialArticle } from './types/serial-article';
import { getDisplayName } from './lib/api';
import { LoginIcon, AddIcon, AdminIcon } from './components/icons';
import AdminLayout from './pages/admin/AdminLayout';

type TabKey = 'werkzeuge' | 'serienartikel' | 'lager' | 'historie' | 'create';
type ViewMode = 'main' | 'admin';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'werkzeuge', label: 'Werkzeuge' },
  { key: 'serienartikel', label: 'Serienartikel' },
  { key: 'lager', label: 'Lager/Ersatz' },
  { key: 'historie', label: 'Historie' },
];

// Tab-Leiste und "+ Anlegen" kommen aus dem Guide-System (.ui-tabs / .ui-btn).
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="app-content-block rounded-2xl p-5 shadow-xs">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-600">
        Dieser Bereich folgt in einem späteren Schritt.
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
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('werkzeuge');
  const [view, setView] = useState<ViewMode>('main');
  const [toolCreateSignal, setToolCreateSignal] = useState(0);

  // Serienartikel-Zustände
  const [showSerialArticleForm, setShowSerialArticleForm] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<SerialArticle | null>(null);
  const [serialArticleRefreshKey, setSerialArticleRefreshKey] = useState(0);

  // Lager/Ersatz-Zustände
  const [showStorageForm, setShowStorageForm] = useState(false);
  const [editingStorageItem, setEditingStorageItem] = useState<StorageItem | null>(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);

  // Prüfen, ob die URL /admin ist
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setView('admin');
    }
  }, []);

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

  async function handleStorageSave(input: StorageItemInput): Promise<void> {
    if (editingStorageItem) {
      await updateStorageItem(editingStorageItem.id, input);
    } else {
      await createStorageItem(input);
    }
    setShowStorageForm(false);
    setEditingStorageItem(null);
    setStorageRefreshKey((k) => k + 1);
  }

  function openStorageCreate() {
    setEditingStorageItem(null);
    setShowStorageForm(true);
  }

  function openStorageEdit(item: StorageItem) {
    setEditingStorageItem(item);
    setShowStorageForm(true);
  }

  function switchTab(key: TabKey) {
    setActiveTab(key);
    if (key !== 'serienartikel') {
      setShowSerialArticleForm(false);
    }
    if (key === 'create') {
      setToolCreateSignal((k) => k + 1);
    }
  }

  // + Anlegen in der Tabbar – öffnet je nach aktivem Tab das passende Formular
  function handleCreateClick() {
    if (activeTab === 'serienartikel') {
      setShowSerialArticleForm(true);
      return;
    }
    if (activeTab === 'lager') {
      openStorageCreate();
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

      {/* SIDEBAR (.app-sidebar): NUR Branding + User/Abmelden – KEINE Navigation */}
      <aside className="app-sidebar hidden md:flex w-60 p-6 flex-col justify-between shrink-0">
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

        {/* Profil + Abmelden – nur wenn eingeloggt */}
        {user && (
          <div className="space-y-2 border-t border-white/40 pt-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2 px-2 py-1 group">
              <div className="ui-avatar shrink-0">
                {getInitials(user.first_name, user.last_name)}
              </div>
              <span className="truncate">
                {getDisplayName(user)}
                {user.is_admin ? ' (Admin)' : ''}
              </span>
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

              {/* + Anlegen öffnet das passende Formular je nach aktivem Tab */}
              <button
                onClick={handleCreateClick}
                className={`ui-btn ui-btn-primary shrink-0 ${
                  activeTab === 'create' ? 'ring-2 ring-teal-700/30' : ''
                }`}
              >
                <AddIcon className="w-3.5 h-3.5" />
                Anlegen
              </button>
            </nav>

            {/* Hauptinhalt – nur wenn eingeloggt */}
            {user && (
              <>
                {activeTab === 'werkzeuge' && <Tools createSignal={toolCreateSignal} />}

                {activeTab === 'serienartikel' && (
                  <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
                    <h2 className="text-base font-bold text-slate-900">Serienartikel</h2>
                    {showSerialArticleForm && (
                      <SerialArticleUpload
                        onCreated={() => {
                          setShowSerialArticleForm(false);
                          setSerialArticleRefreshKey((k) => k + 1);
                        }}
                        onClose={() => setShowSerialArticleForm(false)}
                      />
                    )}
                    {!showSerialArticleForm && (
                      <SerialArticleList
                        refreshKey={serialArticleRefreshKey}
                        onOpenPdf={setViewingPdf}
                      />
                    )}
                  </div>
                )}

                {activeTab === 'lager' && (
                  <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
                    <h2 className="text-base font-bold text-slate-900">Lager/Ersatz</h2>
                    <StorageItemList
                      onEdit={openStorageEdit}
                      refreshKey={storageRefreshKey}
                      onRefreshDone={() => {}}
                    />
                  </div>
                )}

                {activeTab === 'historie' && <Placeholder title="Historie" />}
                {activeTab === 'create' && <Tools createSignal={toolCreateSignal} />}
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

      {user && showStorageForm && (
        <StorageItemForm
          initial={editingStorageItem}
          onSave={handleStorageSave}
          onClose={() => {
            setShowStorageForm(false);
            setEditingStorageItem(null);
          }}
        />
      )}

      {user && viewingPdf && (
        <PDFViewer article={viewingPdf} onClose={() => setViewingPdf(null)} />
      )}
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