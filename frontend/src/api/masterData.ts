// API-Funktionen für Kunden und Maschinen (Stammdaten)
// Lesen ist für alle aktiven Benutzer freigegeben, Schreiben nur für Admins.
import { http } from './client'
import type { Customer, Machine } from './types'

// ------------------------------------------------------------
// Customers (Kunden)
// ------------------------------------------------------------
export async function getCustomers(): Promise<Customer[]> {
  return http.get<Customer[]>('/customers')
}

export async function createCustomer(
  name: string,
  color: string | null,
): Promise<Customer> {
  return http.post<Customer>('/customers', { name, color })
}

export async function updateCustomer(
  id: number,
  name: string,
  color: string | null,
): Promise<Customer> {
  return http.put<Customer>(`/customers/${id}`, { name, color })
}

export async function deleteCustomer(id: number): Promise<void> {
  return http.delete<void>(`/customers/${id}`)
}

// ------------------------------------------------------------
// Machines (Maschinen)
// ------------------------------------------------------------
export async function getMachines(plantId?: number): Promise<Machine[]> {
  const query = plantId !== undefined ? `?plant_id=${plantId}` : ''
  return http.get<Machine[]>(`/machines${query}`)
}

export async function createMachine(name: string, plantId: number | null): Promise<Machine> {
  return http.post<Machine>('/machines', { name, plant_id: plantId })
}

export async function updateMachine(
  id: number,
  name: string,
  plantId: number | null,
): Promise<Machine> {
  return http.put<Machine>(`/machines/${id}`, { name, plant_id: plantId })
}

export async function deleteMachine(id: number): Promise<void> {
  return http.delete<void>(`/machines/${id}`)
}