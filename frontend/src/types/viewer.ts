/**
 * Gemeinsame Typen für das Datei-Fenster (Split-Screen).
 *
 * Das Fenster wurde ursprünglich nur für Serienartikel gebaut (DEC-059, DEC-062).
 * Seit dem Datenblatt (DEC-065) bedient **eine** Komponente zwei Bereiche – die
 * Serienartikel-Logik bleibt dabei unverändert, das Fenster bekommt seine Daten
 * nur von außen:
 *
 * - `ViewerDocument`: **was** angezeigt wird (Kennung, Zuordnung, Dateilisten).
 * - `FileSource`: **wie** eine Datei geladen und entfernt wird (je Bereich ein
 *   anderer Endpunkt).
 *
 * Damit hängt die Komponente nicht mehr an `getSerialArticleFile()` – ohne
 * diesen Schnitt hätte das Datenblatt den Serienartikel-Code nachbauen müssen.
 */

/** Eine Datei im Fenster – Plan bzw. Datenblatt oder Bild. */
export interface ViewerFile {
  name: string
  size: number
  /** Nur bei Bildern belegt (die Dateiliste der Serienartikel liefert es mit). */
  kind?: string
}

/**
 * Das Dokument, dessen Dateien gezeigt werden.
 *
 * `code` ist die Kennung im Kopf: beim Serienartikel die **Artikelnummer**, beim
 * Datenblatt die **Werkzeug-ID**. Ein Dokument ohne Kennung (Datenblatt ohne
 * Werkzeug-ID) liefert einen leeren String – dann steht dort nur der Name.
 */
export interface ViewerDocument {
  id: number
  code: string
  name?: string | null
  description?: string | null
  plantName?: string | null
  customerName?: string | null
  machineName?: string | null
  plans: ViewerFile[]
  images: ViewerFile[]
}

/** Woher die Dateien kommen – pro Bereich ein eigener Endpunkt. */
export interface FileSource {
  /** Lädt eine Datei als Blob (nötig für den `Authorization`-Header). */
  load(id: number, name: string, variant?: 'thumb'): Promise<Blob>
  /** Entfernt eine Datei (nur Admin – der Server prüft es zusätzlich). */
  remove(id: number, name: string): Promise<void>
}

/**
 * Ein kompletter Auftrag an das Datei-Fenster: Dokument, Quelle und die
 * Beschriftungen des Bereichs. So muss der Aufrufer (die App) nur noch ein
 * Objekt halten – und ein zweiter Bereich ist eine zweite Fabrikfunktion.
 */
export interface ViewerRequest {
  document: ViewerDocument
  source: FileSource
  /** „Einrichteplan" (Serienartikel) bzw. „Datenblatt" (DEC-065). */
  planLabel: string
  filesAriaLabel: string
  tab: 'plan' | 'bilder'
}
