// Kennzahlen der rechten Spalte (DEC-089).
//
// Sie kommen aus **einer** Anfrage (`GET /api/stats/overview`) und gelten für das
// Arbeitswerk aus `X-Plant-Id` – dieselbe Regel wie in der Werkzeugliste und der
// Logistik. Die Zahlen werden dort gezählt, wo sie entstehen (Datenbank), nicht
// aus geladenen Listen abgeleitet: Die rechte Spalte steht auf jedem Bildschirm,
// und die Auftragsliste ist auf 200 Zeilen begrenzt.

import { http } from './client'

/** Kennzahlen des Arbeitswerks (Spiegel von `backend/app/schemas/stats.py`). */
export interface StatsOverview {
  tools_total: number
  tools_available: number
  tools_lent: number
  tools_in_transit: number
  tools_storage: number
  serial_articles: number
  data_sheets: number
  spare_parts: number
  orders_open: number
  orders_draft: number
  orders_sent: number
  orders_incoming_open: number
  orders_old: number
}

export async function getStatsOverview(): Promise<StatsOverview> {
  return http.get<StatsOverview>('/stats/overview')
}
