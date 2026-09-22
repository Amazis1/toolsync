import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { createSerialArticle } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import type { SerialArticle } from '../../types/serial-article';

interface SerialArticleUploadProps {
  onCreated: (article: SerialArticle) => void;
  onClose: () => void;
}

/**
 * Formular zum Anlegen eines Serienartikels mit optionalem PDF-Upload
 * (Drag & Drop oder Klick zum Auswählen).
 */
const SerialArticleUpload: React.FC<SerialArticleUploadProps> = ({ onCreated, onClose }) => {
  const [articleNumber, setArticleNumber] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (!selected) return;
    if (!selected.type.includes('pdf') && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Bitte eine PDF-Datei auswählen.');
      return;
    }
    setFile(selected);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = articleNumber.trim();
    if (!trimmed) {
      setError('Bitte eine Artikelnummer angeben.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSerialArticle(
        { article_number: trimmed, description: description.trim() || undefined },
        file,
      );
      onCreated(created);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Der Serienartikel konnte nicht gespeichert werden. Prüfe deine Eingaben.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'input-bordered text-base sm:text-sm';

  // Escape schließt das Formular (Tastaturbedienung), außer während gespeichert wird.
  useEscapeKey(onClose, !submitting);

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="serial-upload-title"
    >
      <div className="modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="serial-upload-title" className="text-lg font-semibold text-slate-900">Serienartikel anlegen</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-700 hover:bg-white/60 hover:text-slate-900"
            aria-label="Schließen"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="serial-article-number" className="mb-1 block text-sm font-medium text-slate-700">
              Artikelnummer <span aria-hidden="true" className="text-rose-700">*</span>
            </label>
            <input
              id="serial-article-number"
              type="text"
              value={articleNumber}
              onChange={(e) => setArticleNumber(e.target.value)}
              placeholder="z. B. 01075000"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="serial-description" className="mb-1 block text-sm font-medium text-slate-700">Beschreibung</label>
            <input
              id="serial-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionaler Zusatztext"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              PDF-Einrichteplan <span className="text-slate-600">(optional)</span>
            </label>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
                isDragActive
                  ? 'border-teal-700 bg-teal-700/10'
                  : 'border-white/80 bg-white/40 hover:border-teal-700/50 hover:bg-white/60'
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <p className="text-slate-900">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-slate-600"> ({(file.size / 1024).toFixed(1)} KB)</span>
                  <span className="mt-1 block text-xs text-slate-600">Klicken, um zu ersetzen</span>
                </p>
              ) : (
                <p className="text-slate-600">
                  {isDragActive ? 'Datei hier ablegen …' : 'PDF hierher ziehen oder klicken zum Auswählen'}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="ui-alert ui-alert-error">
              <span>×</span>
              <div>{error}</div>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-white/70 bg-white/95 px-6 pb-6 pt-4 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-secondary"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="ui-btn ui-btn-primary"
            >
              {submitting ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SerialArticleUpload;
