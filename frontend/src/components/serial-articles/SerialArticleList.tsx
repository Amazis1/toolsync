import React, { useEffect, useState } from 'react';
import { deleteSerialArticle, getSerialArticles } from '../../lib/api';
import ConfirmDialog from '../ConfirmDialog';
import type { SerialArticle } from '../../types/serial-article';

interface SerialArticleListProps {
  refreshKey: number;
  onOpenPdf: (article: SerialArticle) => void;
  onRefreshDone?: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Liste der vorhandenen Serienartikel mit Suchleiste.
 * Suche läuft serverseitig (Backend-Suche) mit kurzem Debounce.
 */
const SerialArticleList: React.FC<SerialArticleListProps> = ({
  refreshKey,
  onOpenPdf,
  onRefreshDone,
}) => {
  const [articles, setArticles] = useState<SerialArticle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<SerialArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      getSerialArticles(search)
        .then((data) => {
          if (!cancelled) setArticles(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Serienartikel konnten nicht geladen werden. Lade die Seite neu.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
          onRefreshDone?.();
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, refreshKey]);

  async function confirmDelete() {
    if (!articleToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSerialArticle(articleToDelete.id);
      setArticles((prev) => prev.filter((a) => a.id !== articleToDelete.id));
      setArticleToDelete(null);
    } catch (err) {
      setArticleToDelete(null);
      setError(err instanceof Error ? err.message : 'Der Serienartikel konnte nicht gelöscht werden. Lade die Liste neu.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/40 shadow-sm backdrop-blur-xl">
      {/* Suchleiste */}
      <div className="border-b border-white/70 p-4">
        <input
          type="search"
          aria-label="Serienartikel durchsuchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Serienartikel suchen …"
          className="input-bordered text-base sm:text-sm w-full max-w-md"
        />
      </div>

      {error && (
        <div className="border-b border-white/70 px-4 py-2 ui-alert ui-alert-error">
          <span>×</span>
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 px-4 py-8 justify-center">
          <div className="ui-spinner" />
          <p className="text-sm text-slate-600">Wird geladen …</p>
        </div>
      ) : error && articles.length === 0 ? null : articles.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            {search.trim()
              ? 'Keine Serienartikel gefunden.'
              : 'Noch keine Serienartikel vorhanden. Lege den ersten an.'}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/70 text-left text-xs uppercase text-slate-600">
              <th className="px-4 py-2 font-medium">Artikelnummer</th>
              <th className="px-4 py-2 font-medium">Beschreibung</th>
              <th className="px-4 py-2 font-medium">PDF</th>
              <th className="px-4 py-2 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {articles.map((article) => (
              <tr key={article.id} className="last:border-0 hover:bg-white/40">
                <td className="px-4 py-2">
                  <span className="inline-flex rounded-lg border border-white/90 bg-white/70 px-2 py-0.5 font-mono font-bold text-slate-900">
                    {article.article_number}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{article.description || '–'}</td>
                <td className="px-4 py-2">
                  {article.pdf_path ? (
                    <span className="ui-badge ui-badge-success">PDF vorhanden</span>
                  ) : (
                    <span className="ui-badge ui-badge-neutral">Kein PDF</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    {article.pdf_path && (
                      <button
                        onClick={() => onOpenPdf(article)}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                      >
                        Vorschau
                      </button>
                    )}
                    <button
                      onClick={() => setArticleToDelete(article)}
                      className="ui-btn ui-btn-danger-soft ui-btn-sm"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {articleToDelete && (
        <ConfirmDialog
          title={`Serienartikel „${articleToDelete.article_number}“ löschen?`}
          description={
            articleToDelete.pdf_path
              ? 'Der Eintrag und das hinterlegte PDF werden entfernt. Das lässt sich nicht rückgängig machen.'
              : 'Der Eintrag wird endgültig entfernt. Das lässt sich nicht rückgängig machen.'
          }
          confirmLabel="Serienartikel löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => { void confirmDelete(); }}
          onCancel={() => setArticleToDelete(null)}
        />
      )}
    </div>
  );
};

export default SerialArticleList;
