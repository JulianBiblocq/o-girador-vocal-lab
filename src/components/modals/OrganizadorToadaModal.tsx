/**
 * OrganizadorToadaModal.tsx
 * Modale de sélection directe des fiches de chant d'Organizador (< 135 lignes).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { fetchOrganizadorToadas, type ToadaDocument } from '../../services/firebaseClient';
import { parseToadaDocument, parseToadaJsonOrText } from '../../utils/toadaSheetParser';
import { generateToadaFromSheet } from '../../utils/toadaConductorGenerator';
import { Scroll, Search, X, Loader2, FileText, ArrowRight } from 'lucide-react';

interface OrganizadorToadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedSongId?: string | null;
}

export const OrganizadorToadaModal: React.FC<OrganizadorToadaModalProps> = ({ isOpen, onClose, preSelectedSongId }) => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const [docs, setDocs] = useState<ToadaDocument[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchOrganizadorToadas()
      .then((res) => {
        setDocs(res);
        if (preSelectedSongId) {
          const match = res.find((d) => d.id === preSelectedSongId);
          if (match) applyDoc(match);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, preSelectedSongId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => d.titre.toLowerCase().includes(q) || (d.nacao && d.nacao.toLowerCase().includes(q)));
  }, [docs, search]);

  const applyDoc = (doc: ToadaDocument) => {
    const parsed = parseToadaDocument(doc, 'coro');
    const updated = generateToadaFromSheet(project, parsed);
    loadProject(updated);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `${doc.titre} chargée !` } }));
    onClose();
  };

  const handleTxtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target?.result as string;
      const res = parseToadaJsonOrText(text, 'coro');
      loadProject(generateToadaFromSheet(project, res.parsed));
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `${f.name} importé !` } }));
      onClose();
    };
    r.readAsText(f);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-xl cordel-card bg-theme-bg border-2 border-stone-900 shadow-[6px_6px_0px_#1a1a1a] flex flex-col gap-3 p-4 text-theme-ink max-h-[88vh] rounded-none animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--cordel-border)] pb-2">
          <h2 className="text-sm font-black tracking-widest uppercase m-0 text-theme-wood flex items-center gap-2">
            <Scroll className="w-4 h-4 text-[var(--cordel-accent-text)]" />
            <span>{t('fichesOrganizador')}</span>
          </h2>
          <button type="button" onClick={onClose} className="p-1 cordel-card-sm hover:bg-stone-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('organizadorSearchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-[var(--cordel-border)] text-xs font-mono text-stone-200 focus:outline-none rounded-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-[200px] max-h-[400px] pr-1 cordel-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-theme-wood" />
              <span className="text-xs font-mono">Chargement des fiches...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs font-mono">{t('noOrganizadorToadas')}</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id} type="button" onClick={() => applyDoc(item)}
                className="w-full text-left p-2.5 border border-stone-800 bg-stone-900/40 hover:bg-theme-wood/20 hover:border-theme-wood transition-all flex items-center justify-between gap-3 cursor-pointer group rounded-none"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-bold text-xs truncate group-hover:text-amber-400 text-stone-200">{item.titre}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
                    {item.nacao && <span className="text-amber-300/80">{item.nacao}</span>}
                    {item.rythme && <span>• {item.rythme}</span>}
                    {item.bpmDefaut && <span>• {item.bpmDefaut} BPM</span>}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--cordel-border)] pt-2.5">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-mono text-stone-400 hover:text-stone-200 flex items-center gap-1.5 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /><span>{t('toadaImportTxt')}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.html" onChange={handleTxtFile} className="hidden" />
          <button type="button" onClick={onClose} className="px-3 py-1.5 cordel-card-sm text-xs font-mono hover:bg-stone-800 cursor-pointer">
            {t('dialogCancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
