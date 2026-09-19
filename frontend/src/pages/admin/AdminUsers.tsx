import { useCallback, useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users'
import type { User, UserInput } from '../../api/types'
import { AddIcon } from '../../components/icons'

const inputClass = 'admin-input'

function emptyInput(): UserInput {
  return {
    personal_number: '',
    first_name: '',
    last_name: '',
    display_name: '',
    is_active: true,
    is_admin: false,
    hashed_password: '',
  }
}

interface UserFormProps {
  initial: User | null
  onSave: (input: UserInput) => Promise<void>
  onClose: () => void
}

function UserForm({ initial, onSave, onClose }: UserFormProps) {
  const [input, setInput] = useState<UserInput>(
    initial
      ? {
          personal_number: '',
          first_name: initial.first_name,
          last_name: initial.last_name,
          display_name: initial.display_name ?? '',
          is_active: initial.is_active,
          is_admin: initial.is_admin,
          hashed_password: '',
        }
      : emptyInput(),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function set<K extends keyof UserInput>(key: K, value: UserInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (input.is_admin && !input.hashed_password && !initial) {
      setError('Admin-Benutzer benötigen beim Anlegen ein Passwort.')
      return
    }

    setBusy(true)
    try {
      const payload: UserInput = {
        ...input,
        display_name: input.display_name?.trim() || null,
        hashed_password: input.hashed_password?.trim() || null,
      }
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-card p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {initial ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-secondary"
          >
            Abbrechen
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Personalnummer</label>
            <input
              className={inputClass}
              type="password"
              value={input.personal_number}
              onChange={(e) => set('personal_number', e.target.value)}
              placeholder={initial ? 'Nur bei Änderung eingeben' : 'Z. B. 129100211'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Anzeigename (optional)</label>
            <input
              className={inputClass}
              value={input.display_name ?? ''}
              onChange={(e) => set('display_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vorname</label>
            <input
              className={inputClass}
              value={input.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nachname</label>
            <input
              className={inputClass}
              value={input.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              required
            />
          </div>
          {input.is_admin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Admin-Passwort</label>
              <input
                type="password"
                className={inputClass}
                value={input.hashed_password ?? ''}
                onChange={(e) => set('hashed_password', e.target.value)}
                placeholder={initial ? 'Leer lassen = unverändert' : 'Pflicht für Admins'}
              />
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={input.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
            />
            Aktiv
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={input.is_admin}
              onChange={(e) => set('is_admin', e.target.checked)}
            />
            Administrator
          </label>
        </div>

        {error && (
          <div className="admin-alert admin-alert-error">
            <span>×</span>
            <div>{error}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="admin-btn admin-btn-primary"
        >
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getUsers()
      .then((u) => {
        if (mounted) setUsers(u)
      })
      .catch((err) => mounted && setError(err.message))
    return () => {
      mounted = false
    }
  }, [refreshKey])

  const openCreate = useCallback(() => {
    setEditing(null)
    setShowForm(true)
  }, [])

  const openEdit = useCallback((user: User) => {
    setEditing(user)
    setShowForm(true)
  }, [])

  const handleSave = async (input: UserInput) => {
    if (editing) {
      await updateUser(editing.id, input)
    } else {
      await createUser(input)
    }
    setShowForm(false)
    setEditing(null)
    setRefreshKey((k) => k + 1)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Benutzer wirklich löschen?')) return
    try {
      await deleteUser(id)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    }
  }

  if (showForm) {
    return (
      <UserForm
        initial={editing}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Benutzer</h3>
        <button
          type="button"
          onClick={openCreate}
          className="admin-btn admin-btn-primary"
        >
          <AddIcon className="h-3.5 w-3.5" />
          Neu
        </button>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th className="text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.display_name || `${user.first_name} ${user.last_name}`}
                  {user.is_admin && (

                    <span className="ml-2 admin-badge admin-badge-primary">Admin</span>
                  )}
                </td>
                <td>
                  {user.is_active ? (
                    <span className="admin-badge admin-badge-success"><span className="admin-dot" /> Aktiv</span>
                  ) : (
                    <span className="admin-badge admin-badge-danger"><span className="admin-dot" /> Inaktiv</span>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <button
                      className="admin-btn admin-btn-tertiary admin-btn-sm"
                      onClick={() => openEdit(user)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="admin-btn admin-btn-danger-ghost admin-btn-sm"
                      onClick={() => handleDelete(user.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
