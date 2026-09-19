// API-Funktionen für Rollen und Berechtigungen
import { http } from './client'
import type { Permission, PermissionInput, Role, RoleInput } from './types'

// ------------------------------------------------------------
// Permissions (Berechtigungen)
// ------------------------------------------------------------
export async function getPermissions(): Promise<Permission[]> {
  return http.get<Permission[]>('/roles/permissions')
}

export async function createPermission(input: PermissionInput): Promise<Permission> {
  return http.post<Permission>('/roles/permissions', input)
}

export async function updatePermission(
  id: number,
  input: PermissionInput,
): Promise<Permission> {
  return http.put<Permission>(`/roles/permissions/${id}`, input)
}

export async function deletePermission(id: number): Promise<void> {
  return http.delete<void>(`/roles/permissions/${id}`)
}

// ------------------------------------------------------------
// Roles (Rollen)
// ------------------------------------------------------------
export async function getRoles(): Promise<Role[]> {
  return http.get<Role[]>('/roles/')
}

export async function getRole(id: number): Promise<Role> {
  return http.get<Role>(`/roles/${id}`)
}

export async function createRole(input: RoleInput): Promise<Role> {
  return http.post<Role>('/roles/', input)
}

export async function updateRole(id: number, input: RoleInput): Promise<Role> {
  return http.put<Role>(`/roles/${id}`, input)
}

export async function deleteRole(id: number): Promise<void> {
  return http.delete<void>(`/roles/${id}`)
}