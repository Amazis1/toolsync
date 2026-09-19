import React, { useEffect, useState } from 'react';
import { getSerialArticlePdf } from '../../lib/api';
import type { SerialArticle } from '../../types/serial-article';

interface PDFViewerProps {
  article: SerialArticle;
  onClose: () => void;
}

/**
 * Zeigt das PDF eines Serienartikels als Vorschau im Modal an.
 * Das PDF wird als Blob geladen und über eine Blob-URL im iframe angezeigt,
 * damit es direkt im Browser geöffnet werden kann (ohne die Seite zu verlassen).
 */
const PDFViewer: React.FC<PDFViewerProps> = ({ article, onClose }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(null);

    getSerialArticlePdf(article.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PDF konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [article.id]);

  function handleDownload() {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${article.article_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-panel flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden">
        {/* Kopfzeile */}
        <div className="flex items-center justify-between border-b border-white/70 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{article.article_number}</h3>
            {article.description && <p className="text-sm text-slate-500">{article.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!pdfUrl}
              className="ui-btn ui-btn-primary"
            >
              Herunterladen
            </button>
            <button
              onClick={onClose}
              className="ui-btn ui-btn-secondary"
            >
              Schließen
            </button>
          </div>
        </div>

        {/* Inhalt */}
        <div className="relative flex-1 bg-slate-900/5">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="ui-spinner" />
                <p className="text-sm text-slate-500">PDF wird geladen …</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="ui-alert ui-alert-error">
                <span>×</span>
                <div>{error}</div>
              </div>
            </div>
          )}
          {pdfUrl && !loading && (
            <iframe
              src={pdfUrl}
              title={`PDF ${article.article_number}`}
              className="h-full w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
