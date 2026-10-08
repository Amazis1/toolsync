import React, { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';
import ConfirmDialog from '../ConfirmDialog';
import {
  ResetIcon,
  RotateLeftIcon,
  RotateRightIcon,
  SerialIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../icons';
import type { FileSource, ViewerDocument } from '../../types/viewer';

/**
 * Datei-Fenster im Split-Screen (DEC-059, DEC-062).
 *
 * **Gemeinsam genutzt:** Serienartikel (Artikelordner, DEC-057) und Datenblatt
 * (DEC-065). Die Komponente kennt deshalb **keine** Endpunkte mehr: sie bekommt
 * das Dokument (`document`) und die Datei-Quelle (`source`) von außen. Das war
 * der kleinste Schnitt, der beide Bereiche bedient – die Serienartikel-Logik
 * (Ordner, Service, Endpunkte) bleibt unangetastet.
 */
interface PDFViewerProps {
  /** Womit das Fenster öffnet: der erste Plan oder das erste Bild. */
  initialTab?: 'plan' | 'bilder';
  document: ViewerDocument;
  /** Woher die Dateien geladen und wie sie entfernt werden. */
  source: FileSource;
  /** Beschriftung der Plan-Dateien – „Einrichteplan" bzw. „Datenblatt". */
  planLabel?: string;
  /** Beschriftung der Liste für Screenreader. */
  filesAriaLabel?: string;
  /** Nur Admins dürfen Dateien entfernen (DEC-058, DEC-062). */
  canManage?: boolean;
  /** Nach dem Entfernen einer Datei: die Liste neu laden. */
  onFilesChanged?: () => void;
  onClose: () => void;
}

/** Welche Datei gerade gezeigt wird – Plan oder Bild, jeweils mit Dateinamen. */
type Auswahl = { kind: 'plan' | 'image'; name: string };

/** Zustand der großen Ansicht (Einrichteplan im iframe oder Bild). */
type DateiZustand =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; message: string };

/** Zoom-Stufen – 100 % heißt „eingepasst" (DEC-061). */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/**
 * Ein ausgewähltes **Bild** in voller Größe – mit Zoom, Drehen und Verschieben
 * (DEC-061).
 *
 * Als eigene Komponente, damit Ansicht (Zoom, Drehung, Versatz) und Ladezustand
 * beim Wechsel der Auswahl von selbst neu beginnen (`key=<Dateiname>`) und kein
 * Zustand in einem Effekt gesetzt werden muss.
 */
const BildBuehne: React.FC<{
  source: FileSource;
  fileId: number;
  name: string;
  size?: number;
}> = ({ source, fileId, name, size }) => {
  const [zustand, setZustand] = useState<DateiZustand>({ status: 'loading' });
  const [zoom, setZoom] = useState(1);
  const [drehung, setDrehung] = useState(0);
  const [versatz, setVersatz] = useState({ x: 0, y: 0 });
  const zug = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    source
      .load(fileId, name)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setZustand({ status: 'ready', url: objectUrl });
      })
      .catch((err) => {
        if (cancelled) return;
        setZustand({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Das Bild konnte nicht geladen werden. Versuche es erneut.',
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, fileId, name]);

  const verschiebbar = zoom > 1 || drehung % 360 !== 0;

  function stufeSchritt(richtung: 1 | -1) {
    const index = ZOOM_STEPS.findIndex((stufe) => stufe >= zoom - 0.001);
    const naechster = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + richtung))];
    setZoom(naechster);
    if (naechster === 1) setVersatz({ x: 0, y: 0 });
  }

  function zuruecksetzen() {
    setZoom(1);
    setDrehung(0);
    setVersatz({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!verschiebbar) return;
    zug.current = {
      x: event.clientX,
      y: event.clientY,
      startX: versatz.x,
      startY: versatz.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = zug.current;
    if (!start) return;
    setVersatz({
      x: start.startX + (event.clientX - start.x),
      y: start.startY + (event.clientY - start.y),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    zug.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (zustand.status === 'loading') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="ui-spinner" />
          <p className="text-sm text-slate-600">Bild wird geladen …</p>
        </div>
      </div>
    );
  }

  if (zustand.status === 'error') {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{zustand.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Werkzeugleiste: Zoom und Drehung */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => stufeSchritt(-1)}
            disabled={zoom <= ZOOM_STEPS[0]}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            aria-label="Verkleinern"
            title="Verkleinern"
          >
            <ZoomOutIcon className="h-3.5 w-3.5" />
          </button>
          <span
            className="min-w-[3.5rem] text-center text-xs font-semibold text-slate-700"
            aria-live="polite"
          >
            {Math.round(zoom * 100)} %
          </span>
          <button
            type="button"
            onClick={() => stufeSchritt(1)}
            disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            aria-label="Vergrößern"
            title="Vergrößern"
          >
            <ZoomInIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDrehung((wert) => wert - 90)}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            aria-label="Nach links drehen"
            title="Nach links drehen"
          >
            <RotateLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDrehung((wert) => wert + 90)}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            aria-label="Nach rechts drehen"
            title="Nach rechts drehen"
          >
            <RotateRightIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={zuruecksetzen}
            disabled={zoom === 1 && drehung % 360 === 0}
            className="ui-btn ui-btn-secondary ui-btn-sm"
            aria-label="Ansicht zurücksetzen"
            title="Ansicht zurücksetzen"
          >
            <ResetIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bildfläche: ziehen verschiebt (nur wenn gezoomt oder gedreht) */}
      <div
        className={`relative min-h-0 flex-1 overflow-hidden p-4 ${
          verschiebbar ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={zustand.url}
          alt={`Großansicht ${name}`}
          draggable={false}
          data-zoom={zoom}
          data-rotation={((drehung % 360) + 360) % 360}
          style={{
            transform: `translate(${versatz.x}px, ${versatz.y}px) scale(${zoom}) rotate(${drehung}deg)`,
          }}
          className="absolute inset-0 m-auto max-h-full max-w-full select-none rounded-xl border border-white/70 bg-white/50 object-contain"
        />
      </div>

      <p className="px-3 pb-2 text-xs text-slate-600">
        {name}
        {size != null ? ` · ${(size / 1024).toFixed(0)} KB` : ''}
        {verschiebbar ? ' · Ziehen verschiebt das Bild' : ''}
      </p>
    </div>
  );
};

/**
 * Ein ausgewählter **Einrichteplan** im iframe (Blob-URL).
 *
 * Auch hier eine eigene Komponente: beim Wechsel des Plans beginnt der
 * Ladezustand von selbst neu, ohne Zustand in einem Effekt.
 */
const PlanBuehne: React.FC<{
  source: FileSource;
  fileId: number;
  name: string;
  size?: number;
  errorLabel?: string;
}> = ({ source, fileId, name, size, errorLabel = 'Der Einrichteplan' }) => {
  const [zustand, setZustand] = useState<DateiZustand>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    source
      .load(fileId, name)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setZustand({ status: 'ready', url: objectUrl });
      })
      .catch((err) => {
        if (cancelled) return;
        setZustand({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : `${errorLabel} konnte nicht geladen werden. Versuche es erneut.`,
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, fileId, name, errorLabel]);

  if (zustand.status === 'loading') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="ui-spinner" />
          <p className="text-sm text-slate-600">PDF wird geladen …</p>
        </div>
      </div>
    );
  }

  if (zustand.status === 'error') {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{zustand.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <iframe
        src={zustand.url}
        title={`PDF ${name}`}
        className="min-h-0 flex-1 w-full"
      />
      <p className="px-3 pb-2 pt-1 text-xs text-slate-600">
        {name}
        {size != null ? ` · ${(size / 1024).toFixed(0)} KB` : ''}
      </p>
    </div>
  );
};

/**
 * Datei-Fenster im Split-Screen (DEC-059): links die Dateiliste mit
 * **Vorschaubildern in fester Größe**, rechts die große Ansicht. Mehrere
 * Einrichtepläne und mehrere Bilder sind möglich (DEC-062); jede Datei lässt
 * sich hier einzeln entfernen (nur Admin).
 *
 * Alle Dateien werden als **Blob** geladen – ein direkter Aufruf der API-URL im
 * iframe oder `<img>` wäre unauthentifiziert (der `Authorization`-Header käme
 * nicht mit). In der Liste wird die kleine Vorschau (`variant=thumb`) geladen,
 * die große Ansicht erst beim Auswählen (Original).
 */
const PDFViewer: React.FC<PDFViewerProps> = ({
  document: doc,
  source,
  initialTab = 'plan',
  planLabel = 'Einrichteplan',
  filesAriaLabel = 'Dateien des Serienartikels',
  canManage = false,
  onFilesChanged,
  onClose,
}) => {
  const [entfernteDateien, setEntfernteDateien] = useState<string[]>([]);
  const plaene = (doc.plans ?? []).filter((datei) => !entfernteDateien.includes(datei.name));
  const bilder = (doc.images ?? []).filter((datei) => !entfernteDateien.includes(datei.name));

  const ersteAuswahl: Auswahl | null =
    initialTab === 'bilder' && bilder.length > 0
      ? { kind: 'image', name: bilder[0].name }
      : plaene.length > 0
        ? { kind: 'plan', name: plaene[0].name }
        : bilder.length > 0
          ? { kind: 'image', name: bilder[0].name }
          : null;

  const [auswahl, setAuswahl] = useState<Auswahl | null>(ersteAuswahl);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [dateiToDelete, setDateiToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Escape schließt das Fenster (Tastaturbedienung).
  useEscapeKey(onClose);

  // ---- Vorschaubilder für die Dateiliste (feste Größe, DEC-059) ----
  useEffect(() => {
    if (bilder.length === 0) return;
    let cancelled = false;
    const erzeugteUrls: string[] = [];

    Promise.all(
      bilder.map(async (eintrag) => {
        const blob = await source.load(doc.id, eintrag.name, 'thumb');
        const url = URL.createObjectURL(blob);
        erzeugteUrls.push(url);
        return [eintrag.name, url] as const;
      }),
    )
      .then((eintraege) => {
        if (!cancelled) setThumbs(Object.fromEntries(eintraege));
      })
      .catch(() => {
        // Ohne Vorschau bleibt die Liste bedienbar (der Name steht daneben).
      });

    return () => {
      cancelled = true;
      erzeugteUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.images, entfernteDateien.length]);

  function handleDownload() {
    if (!auswahl || auswahl.kind !== 'plan') return;
    void source.load(doc.id, auswahl.name).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.code || planLabel}-${auswahl.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  async function confirmDelete() {
    if (!dateiToDelete) return;
    const name = dateiToDelete;
    setDeleting(true);
    try {
      await source.remove(doc.id, name);
      setEntfernteDateien((current) => [...current, name]);
      setDateiToDelete(null);

      // Auswahl auf die nächste Datei verschieben (Plan zuerst).
      if (auswahl?.name === name) {
        const restlichePlaene = plaene.filter((datei) => datei.name !== name);
        const restlicheBilder = bilder.filter((datei) => datei.name !== name);
        setAuswahl(
          restlichePlaene.length > 0
            ? { kind: 'plan', name: restlichePlaene[0].name }
            : restlicheBilder.length > 0
              ? { kind: 'image', name: restlicheBilder[0].name }
              : null,
        );
      }
      onFilesChanged?.();
    } catch (err) {
      setDateiToDelete(null);
      setFehler(
        err instanceof Error
          ? err.message
          : 'Die Datei konnte nicht entfernt werden. Versuche es erneut.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const zuordnung = [doc.plantName, doc.customerName, doc.machineName]
    .filter(Boolean)
    .join(' · ');

  const ausgewaehlteDatei =
    auswahl?.kind === 'plan'
      ? plaene.find((datei) => datei.name === auswahl.name)
      : auswahl
        ? bilder.find((datei) => datei.name === auswahl.name)
        : undefined;

  const eintragKlasse = (aktiv: boolean) =>
    `flex w-full shrink-0 items-center gap-2 rounded-xl border p-2 text-left text-sm ${
      aktiv
        ? 'border-teal-700/60 bg-white/80 font-semibold text-slate-900'
        : 'border-white/70 bg-white/40 text-slate-700 hover:bg-white/70'
    }`;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
    >
      <div className="modal-panel flex h-[94dvh] max-h-[calc(100dvh-1rem)] w-full max-w-[95vw] flex-col overflow-hidden xl:max-w-[1400px]">
        {/* Kopfzeile */}
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/70 px-4 py-3">
          <div className="min-w-0">
            <h3 id="pdf-viewer-title" className="text-base font-semibold text-slate-900">
              {doc.code}
              {doc.name && <span className="ml-2 text-slate-700">{doc.name}</span>}
            </h3>
            {zuordnung ? (
              <p className="truncate text-sm text-slate-600">{zuordnung}</p>
            ) : (
              doc.description && (
                <p className="truncate text-sm text-slate-600">{doc.description}</p>
              )
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {auswahl?.kind === 'plan' && (
              <button onClick={handleDownload} className="ui-btn ui-btn-primary">
                Herunterladen
              </button>
            )}
            {auswahl && canManage && (
              <button
                onClick={() => setDateiToDelete(auswahl.name)}
                className="ui-btn ui-btn-danger-soft"
              >
                {auswahl.kind === 'plan' ? `${planLabel} entfernen` : 'Bild entfernen'}
              </button>
            )}
            <button onClick={onClose} className="ui-btn ui-btn-secondary">
              Schließen
            </button>
          </div>
        </div>

        {fehler && (
          <div className="ui-alert ui-alert-error m-3">
            <span aria-hidden="true">×</span>
            <div>{fehler}</div>
          </div>
        )}

        {/* Split-Screen: Dateiliste | große Ansicht */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label={filesAriaLabel}
            className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/70 p-3 md:w-64 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r"
          >
            {plaene.map((plan) => (
              <button
                key={plan.name}
                type="button"
                onClick={() => setAuswahl({ kind: 'plan', name: plan.name })}
                aria-current={auswahl?.name === plan.name ? 'true' : undefined}
                className={eintragKlasse(auswahl?.name === plan.name)}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-600/10">
                  <SerialIcon className="h-5 w-5 text-rose-700" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{planLabel}</span>
                  <span className="block truncate text-xs text-slate-600">
                    {plan.name} · {(plan.size / 1024).toFixed(0)} KB
                  </span>
                </span>
              </button>
            ))}

            {bilder.map((eintrag) => (
              <button
                key={eintrag.name}
                type="button"
                onClick={() => setAuswahl({ kind: 'image', name: eintrag.name })}
                aria-current={auswahl?.name === eintrag.name ? 'true' : undefined}
                className={eintragKlasse(auswahl?.name === eintrag.name)}
              >
                {thumbs[eintrag.name] ? (
                  <img
                    src={thumbs[eintrag.name]}
                    alt={`Vorschau ${eintrag.name}`}
                    className="h-12 w-12 shrink-0 rounded-lg border border-white/80 object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/60">
                    <span className="ui-spinner" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate">{eintrag.name}</span>
                  <span className="block text-xs text-slate-600">
                    {(eintrag.size / 1024).toFixed(0)} KB
                  </span>
                </span>
              </button>
            ))}
          </nav>

          <section className="relative min-h-[50dvh] flex-1 bg-slate-900/5">
            {auswahl?.kind === 'plan' && (
              <PlanBuehne
                key={auswahl.name}
                source={source}
                fileId={doc.id}
                name={auswahl.name}
                size={ausgewaehlteDatei?.size}
                errorLabel={planLabel === 'Einrichteplan' ? 'Der Einrichteplan' : `Das ${planLabel}`}
              />
            )}

            {auswahl?.kind === 'image' && (
              <BildBuehne
                key={auswahl.name}
                source={source}
                fileId={doc.id}
                name={auswahl.name}
                size={ausgewaehlteDatei?.size}
              />
            )}

            {auswahl === null && (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-slate-600">Keine Dateien hinterlegt.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {dateiToDelete && (
        <ConfirmDialog
          title={`Datei „${dateiToDelete}“ entfernen?`}
          description={
            dateiToDelete.toLowerCase().endsWith('.pdf')
              ? plaene.length <= 1
                ? `Das ist das letzte ${planLabel} – danach zeigt der Eintrag „Kein PDF“. Die Bilder bleiben bestehen.`
                : `Nur dieses ${planLabel} wird gelöscht. Die übrigen Dateien bleiben bestehen.`
              : `Nur dieses Bild wird gelöscht. ${planLabel}-Dateien und der Eintrag bleiben bestehen.`
          }
          confirmLabel="Datei entfernen"
          busyLabel="Wird entfernt …"
          busy={deleting}
          onConfirm={() => {
            void confirmDelete();
          }}
          onCancel={() => setDateiToDelete(null)}
        />
      )}
    </div>
  );
};

export default PDFViewer;
