// API-Funktionen für die Benutzerverwaltung (nur Admin)
import { http } from './client'
import type { User, UserInput } from './types'

// ------------------------------------------------------------
// Users (Benutzer)
// ------------------------------------------------------------
export async function getUsers(): Promise<User[]> {
  return http.get<User[]>('/users/?limit=500')
}

export async function getUser(id: number): Promise<User> {
  return http.get<User>(`/users/${id}`)
}

export async function createUser(input: UserInput): Promise<User> {
  return http.post<User>('/users/', input)
}

export async function updateUser(id: number, input: UserInput): Promise<User> {
  return http.put<User>(`/users/${id}`, input)
}

export async function deleteUser(id: number): Promise<void> {
  return http.delete<void>(`/users/${id}`)
}