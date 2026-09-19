import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { loginUser, loginAdmin, getCurrentUser, ApiError } from '../lib/api'
import type { UserInfo } from '../lib/api'

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  login: (personalNumber: string, isAdmin: boolean, password?: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  // Beim Start: gespeicherten Token prüfen und Benutzer wiederherstellen
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    setToken(storedToken)
    getCurrentUser(storedToken)
      .then((currentUser) => setUser(currentUser))
      .catch((error: unknown) => {
        // Token ungültig oder abgelaufen → aufräumen
        if (error instanceof ApiError) {
          console.warn('Session konnte nicht wiederhergestellt werden:', error.message)
        }
    localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (personalNumber: string, isAdmin: boolean, password?: string) => {
    const response = isAdmin
      ? await loginAdmin(personalNumber, password ?? '')
      : await loginUser(personalNumber)

    setUser(response.user)
    setToken(response.access_token)
    localStorage.setItem('token', response.access_token)
  }

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!user, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}