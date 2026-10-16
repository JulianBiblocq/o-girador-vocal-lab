/**
 * ToadaLibraryDropdown.tsx
 * Menu déroulant unifié 'Toadas' : Nouvelle Toada, Fiches Organizador et Bibliothèque (< 125 lignes).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { listSavedToadas, loadToadaFromLibrary, deleteToadaFromLibrary, type SavedToadaSummary } from '../../utils/toadaLibraryStorage';
import { createDefaultToadaProject } from '../../types/toadaProject.types';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { FolderKanban, ChevronDown, Plus, Scroll, Trash2 } from 'lucide-react';

interface Props {
  onOpenOrganizador: () => void;
  groupName?: string;
}

export const ToadaLibraryDropdown: React.FC<Props> = ({ onOpenOrganizador, groupName }) => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const [isOpen, setIsOpen] = useState(false);
  const [toadas, setToadas] = useState<SavedToadaSummary[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshList = async () => {
    try { setToadas(await listSavedToadas()); } catch (err) { console.warn('[ToadaLibraryDropdown] err:', err); }
  };

  useEffect(() => {
    refreshList();
    const handleSaved = () => refreshList();
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('toada-saved', handleSaved);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('toada-saved', handleSaved);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const handleNewToada = async () => {
    setIsOpen(false);
    const ok = await confirmAsync({
      title: t('newToadaTitle'), message: t('newToadaConfirm'),
      confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'),
    });
    if (ok) {
      const fresh = createDefaultToadaProject();
      fresh.title = `Toada ${toadas.length + 1}`;
      loadProject(fresh);
    }
  };

  const handleSelectToada = async (id: string) => {
    if (id === project.id) { setIsOpen(false); return; }
    const loaded = await loadToadaFromLibrary(id);
    if (loaded) { loadProject(loaded); setIsOpen(false); }
  };

  const handleDeleteToada = async (e: React.MouseEvent, item: SavedToadaSummary) => {
    e.stopPropagation();
    const ok = await confirmAsync({
      title: t('deleteToadaTitle'), message: `${t('deleteToadaConfirm')} "${item.title}" ?`,
      confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'danger',
    });
    if (ok) { await deleteToadaFromLibrary(item.id); await refreshList(); }
  };

  const groupLabel = groupName ? groupName.charAt(0).toUpperCase() + groupName.slice(1).toLowerCase() : 'Organizador';

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => { setIsOpen((prev) => { if (!prev) refreshList(); return !prev; }); }}
        className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-theme-ink transition-colors cursor-pointer max-w-[200px]"
        title={project.title}
      >
        <FolderKanban className="w-3.5 h-3.5 text-[var(--cordel-accent-text)] shrink-0" />
        <span className="truncate">Toadas : {project.title || 'Sans titre'}</span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 sm:left-auto sm:right-0 z-[100] w-64 cordel-card p-1.5 bg-[var(--cordel-bg)] text-[var(--cordel-text)] border-2 border-[var(--cordel-border)] shadow-[4px_4px_0px_#000] flex flex-col gap-1 text-xs font-mono max-h-80 overflow-y-auto cordel-scrollbar">
          {viewRoleMode !== 'eleve' && (
            <div className="flex flex-col gap-1 pb-1.5 border-b border-[var(--cordel-border)]/20">
              <button
                type="button" onClick={handleNewToada}
                className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-surface)] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-theme-accent" />
                <span className="font-bold">{t('newToada')}</span>
              </button>
              <button
                type="button" onClick={() => { setIsOpen(false); onOpenOrganizador(); }}
                className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-surface)] transition-colors cursor-pointer"
              >
                <Scroll className="w-3.5 h-3.5 text-[var(--cordel-accent-text)]" />
                <span className="font-bold">Toadas {groupLabel}</span>
              </button>
            </div>
          )}

          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--cordel-accent-text)] px-1 pt-1">
            {t('myToadas')} ({toadas.length})
          </div>
          {toadas.length === 0 ? (
            <div className="py-2 text-center text-xs opacity-60 italic">{t('noSavedToadas')}</div>
          ) : (
            toadas.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectToada(item.id)}
                className={`p-1.5 flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                  item.id === project.id
                    ? 'bg-[var(--cordel-surface)] font-bold border-2 border-[var(--cordel-accent-text)] text-[var(--cordel-text)]'
                    : 'bg-[var(--cordel-bg)] hover:bg-[var(--cordel-surface)] border border-[var(--cordel-border)]/20 text-[var(--cordel-text)]'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-xs font-bold">{item.title}</span>
                  <span className="text-[9px] text-[var(--cordel-text)] opacity-80">{item.bpm} BPM • {item.patternsCount} pats</span>
                </div>
                {item.id !== project.id && (
                  <button type="button" onClick={(e) => handleDeleteToada(e, item)} className="p-1 hover:text-red-500 cursor-pointer">
                    <Trash2 className="w-3 h-3 text-red-500/80" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
