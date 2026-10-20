/**
 * OrganizadorToadaModal.tsx
 * Modale de sélection directe des fiches de chant d'Organizador avec pré-configuration (< 140 lignes).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { fetchOrganizadorToadas, type ToadaDocument } from '../../services/firebaseClient';
import { parseToadaDocument, parseToadaJsonOrText } from '../../utils/toadaSheetParser';
import { generateToadaFromSheet } from '../../utils/toadaConductorGenerator';
import { OrganizadorDocRow } from './OrganizadorDocRow';
import { ImportPreconfigBar } from './ImportPreconfigBar';
import { Scroll, Search, X, Loader2, FileText, LogIn } from 'lucide-react';

interface OrganizadorToadaModalProps {
  isOpen: boolean; onClose: () => void; groupId?: string | null;
  isUserLoggedIn?: boolean; onLogin?: () => void; preSelectedSongId?: string | null;
}

export const OrganizadorToadaModal: React.FC<OrganizadorToadaModalProps> = ({
  isOpen, onClose, groupId, isUserLoggedIn, onLogin, preSelectedSongId,
}) => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const [docs, setDocs] = useState<ToadaDocument[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importBpm, setImportBpm] = useState<number>(project.bpm ?? 55);
  const [importMeasures, setImportMeasures] = useState<1 | 2 | 4>(2);
  const [importHasAnacrusis, setImportHasAnacrusis] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchOrganizadorToadas(groupId)
      .then((res) => {
        setDocs(res);
        if (preSelectedSongId) {
          const m = res.find((d) => d.id === preSelectedSongId);
          if (m) applyDoc(m);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, groupId, preSelectedSongId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => d.titre.toLowerCase().includes(q) || (d.nacao && d.nacao.toLowerCase().includes(q)));
  }, [docs, search]);

  const loadWithConfig = (parsed: any, bpmVal?: number, toastMsg?: string) => {
    const opts = { bpm: bpmVal ?? importBpm, defaultMeasuresCount: importMeasures, defaultHasAnacrusis: importHasAnacrusis };
    loadProject(generateToadaFromSheet(project, parsed, opts));
    if (toastMsg) window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: toastMsg } }));
    onClose();
  };

  const applyDoc = (doc: ToadaDocument) => loadWithConfig(parseToadaDocument(doc, 'puxador'), doc.bpmDefaut, `${doc.titre} chargée !`);

  const handleTxtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const res = parseToadaJsonOrText(ev.target?.result as string, 'puxador');
      loadWithConfig(res.parsed, res.parsed.docMeta?.bpmDefaut, `${f.name} importé !`);
    };
    r.readAsText(f);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-xl cordel-card flex flex-col gap-2.5 p-4 text-[var(--cordel-text)] max-h-[90vh] rounded shadow-xl animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--cordel-border-sub)] pb-2">
          <h2 className="text-sm font-black tracking-widest uppercase m-0 text-theme-wood flex items-center gap-2">
            <Scroll className="w-4 h-4 text-[var(--cordel-accent-text)]" /><span>{t('fichesOrganizador')}</span>
          </h2>
          <button type="button" onClick={onClose} className="cordel-btn p-1 rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {!isUserLoggedIn && (
          <div className="p-2 border border-amber-500/50 bg-amber-500/10 text-amber-200 text-xs font-mono flex items-center justify-between gap-2 rounded">
            <span>{t('authLoginRequiredNotice') || 'Connexion requise pour accéder aux fiches.'}</span>
            {onLogin && (
              <button type="button" onClick={onLogin} className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold flex items-center gap-1 shrink-0 rounded cursor-pointer">
                <LogIn className="w-3.5 h-3.5" /><span>{t('authLogin') || 'Connexion'}</span>
              </button>
            )}
          </div>
        )}

        {/* Bandeau de pré-configuration (Micro-sécurité 3) */}
        <ImportPreconfigBar
          bpm={importBpm} onBpmChange={setImportBpm} measuresCount={importMeasures}
          onMeasuresCountChange={setImportMeasures} hasAnacrusis={importHasAnacrusis} onHasAnacrusisChange={setImportHasAnacrusis}
        />

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cordel-secondary-text)]" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('organizadorSearchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 cordel-card-sm text-xs font-mono text-[var(--cordel-text)] focus:outline-none rounded"
          />
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-[160px] max-h-[300px] pr-1 cordel-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[var(--cordel-secondary-text)]">
              <Loader2 className="w-6 h-6 animate-spin text-theme-wood" /><span className="text-xs font-mono">Chargement...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-[var(--cordel-secondary-text)] text-xs font-mono">{t('noOrganizadorToadas')}</div>
          ) : (
            filtered.map((item) => <OrganizadorDocRow key={item.id} item={item} onSelect={applyDoc} />)
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--cordel-border-sub)] pt-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-mono text-[var(--cordel-secondary-text)] hover:text-[var(--cordel-text)] flex items-center gap-1.5 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /><span>{t('toadaImportTxt')}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.html" onChange={handleTxtFile} className="hidden" />
          <button type="button" onClick={onClose} className="cordel-btn px-3 py-1.5 text-xs font-mono rounded cursor-pointer">{t('dialogCancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
