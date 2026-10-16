/**
 * SaveAndExportDropdown.tsx
 * Menu déroulant Cordel 'Sauvegarder & Exporter' (< 110 lignes).
 * 3 actions : Sauvegarde locale/Cloud (Ctrl+S), Publication Sequenciador, Export WAV chant complet.
 */
import React, { useState, useRef, useEffect } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useManualSave } from '../../hooks/useManualSave';
import { publishToadaToSequencer } from '../../services/cloudToadaPublisher';
import { exportFullSongWav } from '../../utils/fullSongWavExporter';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { Save, CloudUpload, Music, ChevronDown, Check, Loader2 } from 'lucide-react';

interface Props {
  project: ToadaProject;
  isUserLoggedIn: boolean;
}

export const SaveAndExportDropdown: React.FC<Props> = ({ project, isUserLoggedIn }) => {
  const { t } = useLanguage();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExportingWav, setIsExportingWav] = useState(false);

  const { isSaving, isSavedSuccess, handleSave } = useManualSave(project, isUserLoggedIn);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handlePublish = async () => {
    setIsOpen(false);
    setIsPublishing(true);
    try {
      const res = await publishToadaToSequencer(project);
      const openNow = await confirmAsync({
        title: t('toadaPublishedSuccess'),
        message: `${project.title} a été synchronisée. Ouvrir dans Sequenciador ?`,
        confirmLabel: t('openInSequencer'),
        cancelLabel: t('dialogCancel'),
      });
      if (openNow) window.open(res.sequenciadorUrl, '_blank');
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: `Échec : ${err?.message || 'erreur'}` } }));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleWav = async () => {
    setIsOpen(false);
    setIsExportingWav(true);
    try {
      await exportFullSongWav(project);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('wavExportSuccess') } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: `Échec export WAV : ${err?.message || 'erreur'}` } }));
    } finally {
      setIsExportingWav(false);
    }
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        type="button"
        disabled={isSaving || isPublishing || isExportingWav}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
          isSavedSuccess
            ? 'bg-emerald-700 text-[#f4ecd8] border-emerald-400 font-black'
            : 'bg-theme-wood hover:bg-theme-wood/90 text-[#f4ecd8]'
        }`}
      >
        {isSaving || isPublishing || isExportingWav ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSavedSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        <span>{isSavedSuccess ? t('btnSavedSuccess') : t('saveAndExportMenu')}</span>
        <ChevronDown className="w-3 h-3 opacity-80" />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 sm:left-auto sm:right-0 z-[100] w-60 cordel-card p-1.5 bg-[var(--cordel-bg)] text-[var(--cordel-text)] border-2 border-[var(--cordel-border)] shadow-[4px_4px_0px_#000] flex flex-col gap-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => { setIsOpen(false); handleSave(); }}
            className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-surface)] transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border)]/20"
          >
            <Save className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-bold">{t('btnSaveToada')} (Ctrl+S)</span>
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-surface)] transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border)]/20"
          >
            <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold">{t('sendToSequencer')}</span>
          </button>

          <button
            type="button"
            onClick={handleWav}
            className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-surface)] transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border)]/20"
          >
            <Music className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-bold">{t('exportFullSongWav')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
