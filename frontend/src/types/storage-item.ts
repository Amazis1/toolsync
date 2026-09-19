/**
 * Typen für „Lager/Ersatz“-Objekte.
 *
 * Fachlich sind das Lager- und Ersatzgegenstände (z. B. Ersatzstempel,
 * Abstreifer, Matrizen), die eine eigene fachliche ID besitzen.
 * Über allow_duplicate_id kann dieselbe ID mehrfach existieren (Mehrfachobjekte).
 */

export interface StorageItem {
  id: number;
  storage_id: string;
  name: string;
  type: string | null;
  article_number: string | null;
  machine_id: number | null;
  location_id: number | null;
  description: string | null;
  allow_duplicate_id: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageItemInput {
  storage_id: string;
  name: string;
  type?: string | null;
  article_number?: string | null;
  machine_id?: number | null;
  location_id?: number | null;
  description?: string | null;
  allow_duplicate_id: boolean;
}