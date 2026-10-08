/**
 * Fabrikfunktionen für das Datei-Fenster (`PDFViewer`).
 *
 * Jeder Bereich liefert sein **Dokument** und seine **Datei-Quelle** selbst –
 * das Fenster kennt keine Endpunkte mehr (DEC-065). Hier stehen die beiden
 * Bereiche, die Dateien haben:
 *
 * - **Serienartikel**: Einrichtepläne und Bilder im Artikelordner (DEC-057/058).
 * - **Datenblatt**: Datenblätter (PDF) im Ordner des Datensatzes (DEC-065).
 *
 * Die Serienartikel-Anbindung ist unverändert – sie ruft dieselben Funktionen
 * wie vorher, nur über diese Schnittstelle.
 */

import {
  deleteSerialArticleFile,
  getSerialArticleFile,
} from '../api/serialArticles'
import {
  deleteDataSheetFile,
  getDataSheetFile,
} from '../api/dataSheets'
import type { SerialArticle } from '../types/serial-article'
import type { DataSheet } from '../types/data-sheet'
import type { FileSource, ViewerRequest } from '../types/viewer'

/** Serienartikel: Ordner je Artikelnummer, Pläne und Bilder (DEC-057/058/062). */
const SERIAL_ARTICLE_SOURCE: FileSource = {
  load: (id, name, variant) => getSerialArticleFile(id, name, variant),
  remove: (id, name) => deleteSerialArticleFile(id, name),
}

/** Datenblatt: Ordner je Datensatz-ID, nur Datenblätter (DEC-065). */
const DATA_SHEET_SOURCE: FileSource = {
  load: (id, name, variant) => getDataSheetFile(id, name, variant),
  remove: (id, name) => deleteDataSheetFile(id, name),
}

/** Auftrag für einen Serienartikel. */
export function serialArticleViewer(
  article: SerialArticle,
  tab: 'plan' | 'bilder',
): ViewerRequest {
  return {
    document: {
      id: article.id,
      code: article.article_number,
      name: article.name,
      description: article.description,
      plantName: article.plant?.name ?? null,
      customerName: article.customer?.name ?? null,
      machineName: article.machine?.name ?? null,
      plans: article.plans ?? [],
      images: article.images ?? [],
    },
    source: SERIAL_ARTICLE_SOURCE,
    planLabel: 'Einrichteplan',
    filesAriaLabel: 'Dateien des Serienartikels',
    tab,
  }
}

/**
 * Auftrag für ein Datenblatt.
 *
 * Kopfzeile: die **Werkzeug-ID** als Kennung; ist sie leer (DEC-055 erlaubt
 * Abstreifer und Matrize ohne ID), steht dort der Name – und die Zuordnung
 * darunter nennt weiterhin Werk und Maschine.
 */
export function dataSheetViewer(sheet: DataSheet): ViewerRequest {
  return {
    document: {
      id: sheet.id,
      code: sheet.tool_id ?? '',
      name: sheet.name,
      description: sheet.description,
      plantName: sheet.plant?.name ?? null,
      customerName: null,
      machineName: sheet.machine?.name ?? null,
      plans: sheet.plans ?? [],
      images: sheet.images ?? [],
    },
    source: DATA_SHEET_SOURCE,
    planLabel: 'Datenblatt',
    filesAriaLabel: 'Dateien des Datenblatts',
    tab: 'plan',
  }
}
