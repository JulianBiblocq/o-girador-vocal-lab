/**
 * ToadaLibraryDropdown.tsx
 * Menu déroulant "Mes Toadas" et bouton "+ Nouvelle Toada" avec modales Cordel (< 120 lignes).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { listSavedToadas, loadToadaFromLibrary, deleteToadaFromLibrary, type SavedToadaSummary } from '../../utils/toadaLibraryStorage';
import { createDefaultToadaProject } from '../../types/toadaProject.types';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { FolderKanban, Plus, Trash2, ChevronDown } from 'lucide-react';

export const ToadaLibraryDropdown: React.FC = () => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const [isOpen, setIsOpen] = useState(false);
  const [toadas, setToadas] = useState<SavedToadaSummary[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshList = async () => {
    const list = await listSavedToadas();
    setToadas(list);
  };

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewToada = async () => {
    const ok = await confirmAsync({
      title: t('newToadaTitle'),
      message: t('newToadaConfirm'),
      confirmLabel: t('dialogConfirm'),
      cancelLabel: t('dialogCancel'),
    });
    if (ok) {
      const fresh = createDefaultToadaProject();
      fresh.title = `Toada ${toadas.length + 1}`;
      loadProject(fresh);
      setIsOpen(false);
    }
  };

  const handleSelectToada = async (id: string) => {
    if (id === project.id) { setIsOpen(false); return; }
    const loaded = await loadToadaFromLibrary(id);
    if (loaded) {
      loadProject(loaded);
      setIsOpen(false);
    }
  };

  const handleDeleteToada = async (e: React.MouseEvent, item: SavedToadaSummary) => {
    e.stopPropagation();
    const ok = await confirmAsync({
      title: t('deleteToadaTitle'),
      message: `${t('deleteToadaConfirm')} "${item.title}" ?`,
      confirmLabel: t('dialogConfirm'),
      cancelLabel: t('dialogCancel'),
      variant: 'danger',
    });
    if (ok) {
      await deleteToadaFromLibrary(item.id);
      await refreshList();
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={dropdownRef}>
      {viewRoleMode !== 'eleve' && (
        <button
          type="button"
          onClick={handleNewToada}
          title={t('newToadaTitle')}
          className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1 bg-black/40 hover:bg-black/60 text-theme-ink transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-theme-accent" />
          <span className="hidden md:inline">{t('newToada')}</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-theme-ink transition-colors cursor-pointer"
      >
        <FolderKanban className="w-3.5 h-3.5 text-[var(--cordel-accent-text)]" />
        <span className="hidden sm:inline">{t('myToadas')}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 sm:left-auto sm:right-0 z-50 w-64 cordel-card p-2 bg-[#f4ecd8] text-[#1a1a1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex flex-col gap-1 text-xs font-mono max-h-72 overflow-y-auto cordel-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b2a1a] pb-1 border-b border-[#1a1a1a]/20">
            {t('myToadas')} ({toadas.length})
          </div>
          {toadas.length === 0 ? (
            <div className="py-2 text-center text-xs opacity-60 italic">{t('noSavedToadas')}</div>
          ) : (
            toadas.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectToada(item.id)}
                className={`p-1.5 flex items-center justify-between gap-1.5 border border-[#1a1a1a]/20 hover:bg-[#e2d5b8] cursor-pointer transition-colors ${
                  item.id === project.id ? 'bg-[#e2d5b8] font-bold border-[#8b2a1a]' : ''
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-xs">{item.title}</span>
                  <span className="text-[9px] opacity-70">{item.bpm} BPM • {item.patternsCount} pats</span>
                </div>
                {item.id !== project.id && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteToada(e, item)}
                    className="p-1 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-red-700/80" />
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
