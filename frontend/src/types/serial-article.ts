/**
 * Typen für Serienartikel (PDF-Einrichtepläne).
 *
 * Ein Serienartikel ist fachlich ein PDF-basierter Einrichteplan.
 * Der Kernumfang: suchen, auswählen, PDF öffnen/anzeigen.
 */

export interface SerialArticle {
  id: number;
  article_number: string;
  description: string | null;
  pdf_path: string | null;
  extra_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SerialArticleInput {
  article_number: string;
  description?: string;
}
