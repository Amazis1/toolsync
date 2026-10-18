import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { loginUser, loginAdmin, getCurrentUser, ApiError } from '../lib/api'
import type { UserInfo } from '../lib/api'
import { decodeTokenExp, isTokenExpired, pingSession } from '../lib/session'
import { clearPlantChoice, setPlantContext, setPlantReloader } from '../lib/plantContext'

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  /** Absoluter Ablaufzeitpunkt der Sitzung (ms) – fuer den Countdown. */
  expiresAt: number | null
  /** true, wenn die letzte Abmeldung wegen Ablauf erfolgte (Hinweis beim Login). */
  sessionExpired: boolean
  login: (personalNumber: string, isAdmin: boolean, password?: string) => Promise<void>
  logout: () => void
  /**
   * Sitzung wegen Zeitablauf beenden (Countdown 0 oder 401 mit abgelaufenem
   * Token). Anders als `logout` erscheint danach der Hinweis beim Login.
   */
  expireSession: () => void
  /**
   * Sitzung beim Server verlaengern (Knopf "Sitzung verlaengern" in der Warnung).
   * Lehnt der Server ab, wird abgemeldet - der Hinweis erscheint dann beim Login.
   */
  extendSession: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
  /** Arbeitswerk neu laden (`/auth/me` mit der aktuellen Wahl, DEC-070/076). */
  refreshPlant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)
  // Ablauf direkt aus dem gespeicherten Token ableiten – ueberlebt ein Reload.
  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    const stored = localStorage.getItem('token')
    return stored ? decodeTokenExp(stored) : null
  })
  const [sessionExpired, setSessionExpired] = useState(false)

  /**
   * Abmelden wegen abgelaufener Sitzung (401 mit abgelaufenem Token oder Countdown 0).
   *
   * Der Hinweis "Sitzung abgelaufen" erscheint nur, wenn die Sitzung wirklich
   * wegen Zeitablauf endet. Ein Token, der aus anderen Gruenden abgelehnt wird
   * (unbekanntes Format, Server mit neuer Datenbank, geloeschter Benutzer),
   * wird still verworfen - sonst steht der Hinweis schon beim ersten Aufruf
   * der Login-Seite, ohne dass je eine Sitzung bestanden haette.
   *
   * `event.detail` nennt den Token der Anfrage, die die 401 bekommen hat. Ist
   * das **nicht mehr** der gespeicherte Token und ist der gespeicherte noch
   * gueltig, war die Antwort veraltet (die Sitzung wurde zwischenzeitlich
   * erneuert oder neu angemeldet) - dann bleibt die Sitzung bestehen. Ohne
   * diese Pruefung beendet eine verspaetete 401 einer alten Anfrage die gerade
   * erst angemeldete Sitzung, und der Nutzer kommt ohne Neuladen der Seite
   * nicht mehr hinein.
   */
  const expireSession = useCallback((event?: Event) => {
    // Vor dem Aufraeumen lesen: nur der abgelegte Token sagt, ob er abgelaufen ist.
    const stored = localStorage.getItem('token')
    const used = (event as CustomEvent<string> | undefined)?.detail ?? null
    if (used && stored && used !== stored && !isTokenExpired(stored)) return
    const expired = isTokenExpired(stored)
    // Nur hochsetzen, nie loeschen: treffen mehrere 401-Antworten ein (React
    // StrictMode verdoppelt Effekte, parallele Anfragen sind moeglich), findet
    // der zweite Aufruf keinen Token mehr und darf den Hinweis nicht entfernen.
    setSessionExpired((prev) => prev || expired)
    setUser(null)
    setToken(null)
    setExpiresAt(null)
    localStorage.removeItem('token')
    localStorage.removeItem('token_expires_at')
  }, [])

  // Zentrale 401-Behandlung (api/client.ts, lib/api.ts) und Countdown-Ablauf
  // melden sich ueber dieses Event – beide Wege fuehren zum selben Ergebnis.
  useEffect(() => {
    window.addEventListener('auth:expired', expireSession)
    return () => window.removeEventListener('auth:expired', expireSession)
  }, [expireSession])

  // Vom Backend erneuerten Token uebernehmen -> Countdown springt zurueck.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<string>).detail
      setToken(next)
      setExpiresAt(decodeTokenExp(next))
    }
    window.addEventListener('auth:token-changed', onChanged)
    return () => window.removeEventListener('auth:token-changed', onChanged)
  }, [])

  // Beim Start: gespeicherten Token prüfen und Benutzer wiederherstellen
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    setToken(storedToken)
    setExpiresAt(decodeTokenExp(storedToken))
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser)
        // Arbeitswerk-Kontext übernehmen: die Wahl aus dem Browser geht beim
        // `/auth/me`-Aufruf bereits mit, der Server nennt das gültige Werk.
        setPlantContext({
          userId: currentUser.id,
          serverPlantId: currentUser.plant_id ?? null,
        })
      })
      .catch((error: unknown) => {
        // Token ungültig oder abgelaufen → aufräumen
        if (error instanceof ApiError) {
          console.warn('Session konnte nicht wiederhergestellt werden:', error.message)
        }
        localStorage.removeItem('token')
        setToken(null)
        setExpiresAt(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  /**
   * Nach einem Werkswechsel: `/auth/me` mit der neuen Wahl holen. Der Server
   * antwortet mit dem aufgelösten Arbeitswerk (`plant_id`, `plant_name`,
   * `plant_color`); damit kommt die Werkfarbe überall an (DEC-076).
   */
  const refreshPlant = useCallback(async () => {
    try {
      const aktuell = await getCurrentUser()
      setUser(aktuell)
      setPlantContext({ userId: aktuell.id, serverPlantId: aktuell.plant_id ?? null })
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn('Arbeitswerk konnte nicht neu geladen werden:', error.message)
      }
    }
  }, [])

  // Die App meldet an, wie nach einem Werkswechsel neu geladen wird.
  useEffect(() => {
    setPlantReloader(refreshPlant)
    return () => setPlantReloader(null)
  }, [refreshPlant])

  const login = async (personalNumber: string, isAdmin: boolean, password?: string) => {
    const response = isAdmin
      ? await loginAdmin(personalNumber, password ?? '')
      : await loginUser(personalNumber)

    setUser(response.user)
    setToken(response.access_token)
    setExpiresAt(decodeTokenExp(response.access_token))
    setSessionExpired(false)
    localStorage.setItem('token', response.access_token)
    // Arbeitswerk-Kontext für den Anfrageweg setzen (DEC-070): ab der nächsten
    // Anfrage geht die Wahl des Benutzers als Header `X-Plant-Id` mit.
    setPlantContext({
      userId: response.user.id,
      serverPlantId: response.user.plant_id ?? null,
    })
  }

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setExpiresAt(null)
    setSessionExpired(false)
    localStorage.removeItem('token')
    localStorage.removeItem('token_expires_at')
    clearPlantChoice()
  }, [])

  /**
   * Sitzung verlaengern: einmal beim Server nachfragen. Der erneuerte Token
   * erreicht die App ueber `auth:token-changed`, der Countdown springt damit
   * zurueck. Lehnt der Server ab (401), meldet `pingSession` die Abmeldung - der
   * Hinweis erscheint dann beim Login.
   */
  const extendSession = useCallback(async () => {
    await pingSession()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        expiresAt,
        sessionExpired,
        login,
        logout,
        expireSession,
        extendSession,
        isAuthenticated: !!user,
        isLoading,
        refreshPlant,
      }}
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