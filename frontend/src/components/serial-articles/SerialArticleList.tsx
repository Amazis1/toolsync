import React, { useEffect, useState } from 'react';
import { deleteSerialArticle, getSerialArticles } from '../../lib/api';
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
          if (!cancelled) setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.');
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

  async function handleDelete(article: SerialArticle) {
    if (!window.confirm(`Serienartikel "${article.article_number}" wirklich löschen?`)) return;
    setDeletingId(article.id);
    setError(null);
    try {
      await deleteSerialArticle(article.id);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/40 shadow-sm backdrop-blur-xl">
      {/* Suchleiste */}
      <div className="border-b border-white/70 p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Serienartikel suchen …"
          className="input-bordered text-sm w-full max-w-md"
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
          <p className="text-sm text-slate-500">Wird geladen …</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-500">
            {search.trim()
              ? 'Keine Serienartikel gefunden.'
              : 'Noch keine Serienartikel vorhanden. Lege den ersten an.'}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/70 text-left text-xs uppercase text-slate-500">
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
                      onClick={() => handleDelete(article)}
                      disabled={deletingId === article.id}
                      className="ui-btn ui-btn-danger-soft ui-btn-sm"
                    >
                      {deletingId === article.id ? '…' : 'Löschen'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SerialArticleList;
