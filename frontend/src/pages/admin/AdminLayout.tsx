import { useState } from 'react'
import type { ReactNode } from 'react'
import AdminDashboard from './AdminDashboard'
import AdminStammdaten from './AdminStammdaten'
import AdminStorageLocations from './AdminStorageLocations'
import { useAuth } from '../../context/AuthContext'
import { getDisplayName } from '../../lib/api'

type AdminSection = 'dashboard' | 'stammdaten' | 'storage'

// Navigations-Labels bleiben unverändert (Tests greifen auf die Namen zu).
const SECTIONS: { key: AdminSection; label: string; icon: ReactNode }[] = [
  {
    key: 'dashboard',
    label: 'Übersicht',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    key: 'stammdaten',
    label: 'Stammdaten',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="1.2" />
        <circle cx="16" cy="12" r="1.2" />
        <circle cx="10" cy="18" r="1.2" />
      </svg>
    ),
  },
  {
    key: 'storage',
    label: 'Lagerplätze',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
  },
]

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

interface AdminLayoutProps {
  onBack: () => void
}

export default function AdminLayout({ onBack }: AdminLayoutProps) {
  const { user, logout } = useAuth()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeLabel = SECTIONS.find((s) => s.key === section)?.label ?? ''

  const renderSection = () => {
    switch (section) {
      case 'stammdaten':
        return <AdminStammdaten />
      case 'storage':
        return <AdminStorageLocations />
      default:
        return <AdminDashboard />
    }
  }

  return (
    <div className="admin-shell">
      <a href="#admin-main" className="admin-skip">Zum Inhalt springen</a>

      {/* SIDEBAR (dark, Split-Tone) */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`} id="admin-sidebar">
        {/* Marke */}
        <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--admin-sidebar-border)' }}>
          <div className="flex items-center gap-2.5">
            <span className="admin-brand-mark">TS</span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-tight text-white leading-tight">ToolSync</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-sidebar-dim)' }}>Admin Panel</span>
            </span>
          </div>
        </div>

        {/* Navigation mit Gruppen */}
        <nav className="flex-1 p-3 overflow-y-auto" aria-label="Admin-Navigation">
          <div className="admin-nav-group">Verwaltung</div>
          <div className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setSection(s.key)
                  setSidebarOpen(false)
                }}
                className={`admin-nav-item ${section === s.key ? 'is-active' : ''}`}
                aria-current={section === s.key ? 'page' : undefined}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Nutzerkarte im Fuß */}
        {user && (
          <div className="p-3 border-t" style={{ borderColor: 'var(--admin-sidebar-border)' }}>
            <div className="admin-user-card cursor-default" title={`${user.first_name} ${user.last_name}`}>
              <span className="admin-avatar">{getInitials(user.first_name, user.last_name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-white truncate">{getDisplayName(user)}</span>
                <span className="block text-[10px] truncate" style={{ color: 'var(--admin-sidebar-dim)' }}>
                  {user.is_admin ? 'Administrator' : 'Benutzer'}
                </span>
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <button onClick={onBack} className="admin-btn admin-btn-secondary w-full">
                ← Zur Hauptseite
              </button>
              <button onClick={logout} className="admin-btn admin-btn-danger-ghost w-full">
                Abmelden
              </button>
            </div>
          </div>
        )}
      </aside>

      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* MAIN (light) */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="admin-icon-btn admin-burger"
              onClick={() => setSidebarOpen(true)}
              aria-controls="admin-sidebar"
              aria-expanded={sidebarOpen}
              aria-label="Navigation öffnen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--admin-text-subtle)' }} aria-label="Brotkrumen">
                <span>Admin</span>
                <span aria-hidden="true">/</span>
                <span style={{ color: 'var(--admin-primary)' }}>{activeLabel}</span>
              </nav>
              <div className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--admin-text)' }}>Admin Panel</div>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <span className="admin-badge admin-badge-success hidden sm:inline-flex">
                <span className="admin-dot" /> System aktiv
              </span>
              <span className="admin-avatar" title={`${user.first_name} ${user.last_name}`}>
                {getInitials(user.first_name, user.last_name)}
              </span>
            </div>
          )}
        </header>

        <main id="admin-main" className="admin-content max-w-[1600px] space-y-5">
          {renderSection()}
        </main>
      </div>
    </div>
  )
}
