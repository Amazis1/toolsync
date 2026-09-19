// API-Funktionen für den Bereich „Lager/Ersatz“
import { http } from './client'
import type { StorageItem, StorageItemInput } from '../types/storage-item'

export async function getStorageItems(search?: string): Promise<StorageItem[]> {
  const params = new URLSearchParams()
  if (search && search.trim()) params.set('search', search.trim())
  params.set('limit', '500')
  const query = params.toString()
  return http.get<StorageItem[]>(`/storage/${query ? `?${query}` : ''}`)
}

export async function createStorageItem(input: StorageItemInput): Promise<StorageItem> {
  return http.post<StorageItem>('/storage/', input)
}

export async function updateStorageItem(id: number, input: StorageItemInput): Promise<StorageItem> {
  return http.put<StorageItem>(`/storage/${id}`, input)
}

export async function deleteStorageItem(id: number): Promise<void> {
  return http.delete<void>(`/storage/${id}`)
}