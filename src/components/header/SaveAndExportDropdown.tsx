/**
 * SaveAndExportDropdown.tsx
 * Menu déroulant Cordel 'Sauvegarder & Exporter' avec retour visuel ✓ et modale d'intégration Répertoire Samambaia (< 115 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useManualSave } from '../../hooks/useManualSave';
import { publishToadaToOrganizador } from '../../services/organizadorToadaPublisher';
import { exportFullSongWav } from '../../utils/fullSongWavExporter';
import { alertAsync } from '../../stores/useCordelDialogStore';
import { useActionFeedback, CORDEL_SUCCESS_BTN_CLASS } from '../common/useActionFeedback';
import { SamambaiaRepertoireTargetModal } from '../modals/SamambaiaRepertoireTargetModal';
import { Save, CloudUpload, FileText, Music, ChevronDown, Check, Loader2 } from 'lucide-react';

interface Props {
  project: ToadaProject;
  isUserLoggedIn: boolean;
  onProjectUpdate?: (next: ToadaProject) => void;
}

export const SaveAndExportDropdown: React.FC<Props> = ({ project, isUserLoggedIn, onProjectUpdate }) => {
  const { t, language } = useLanguage();
  const isBr = language === 'br';
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSamambaiaModalOpen, setIsSamambaiaModalOpen] = useState(false);
  const { isSaving, isSavedSuccess, handleSave } = useManualSave(project, isUserLoggedIn);
  const actionFeedback = useActionFeedback(isBr ? '✓ Salvo !' : '✓ Sauvegardé !');

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handlePublishSequencer = () => {
    setIsOpen(false);
    setIsSamambaiaModalOpen(true);
  };

  const handlePublishOrganizador = async () => {
    setIsOpen(false);
    try {
      await actionFeedback.trigger(async () => {
        const res = await publishToadaToOrganizador(project, project.toadaMeta?.groupId || 'samambaia');
        onProjectUpdate?.({ ...project, toadaMeta: { ...(project.toadaMeta || {}), id: res.documentId, bpmDefaut: res.bpm, tonaliteDefaut: res.scaleLabel } });
        const label = isBr ? '✓ Organizador atualizado !' : '✓ Organizador mis à jour !';
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: label } }));
        await alertAsync({
          title: label,
          message: isBr
            ? `Ficha Organizador sincronizada (${res.bpm} BPM • Escala: ${res.scaleLabel} • ${project.patterns.length} padrões).`
            : `Fiche Organizador synchronisée (${res.bpm} BPM • Gamme : ${res.scaleLabel} • ${project.patterns.length} patterns).`,
          variant: 'info',
        });
        return label;
      });
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: t('publishOrganizadorErrorToast', { err: err?.message || 'err' }) } }));
    }
  };

  const handleWav = async () => {
    setIsOpen(false);
    try {
      await actionFeedback.trigger(async () => {
        await exportFullSongWav(project);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('wavExportSuccess') } }));
        return isBr ? '✓ WAV Exportado !' : '✓ WAV Exporté !';
      });
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: t('wavExportErrorToast', { err: err?.message || 'err' }) } }));
    }
  };

  const isBusy = isSaving || actionFeedback.isLoading, isOk = isSavedSuccess || actionFeedback.isSuccess;
  const displayLabel = isBusy ? (isBr ? 'Em curso...' : 'En cours...') : actionFeedback.isSuccess ? actionFeedback.successLabel : isSavedSuccess ? (isBr ? '✓ Salvo !' : '✓ Sauvegardé !') : t('saveAndExportMenu');

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button type="button" disabled={isBusy} onClick={() => setIsOpen((prev) => !prev)} className={`h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${isOk ? CORDEL_SUCCESS_BTN_CLASS : 'bg-theme-wood hover:bg-theme-wood/90 text-[var(--cordel-on-primary)]'}`}>
        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isOk ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        <span>{displayLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-80" />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 sm:left-auto sm:right-0 z-[100] w-80 cordel-card p-1.5 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-1 text-xs font-mono rounded">
          <button type="button" onClick={() => { setIsOpen(false); handleSave(); }} className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border-sub)]">
            <Save className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('btnSaveToada')} (Ctrl+S)</span>
          </button>
          <button type="button" onClick={handlePublishSequencer} className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border-sub)]">
            <CloudUpload className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('sendToSequencer')}</span>
          </button>
          <button type="button" onClick={handlePublishOrganizador} className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border-sub)]">
            <FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">Renvoyer vers Organizador (Rythme, Syllabes _, Tonalité & Tempo)</span>
          </button>
          <button type="button" onClick={handleWav} className="w-full p-2 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--cordel-border-sub)]">
            <Music className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('exportFullSongWav')}</span>
          </button>
        </div>
      )}

      <SamambaiaRepertoireTargetModal isOpen={isSamambaiaModalOpen} onClose={() => setIsSamambaiaModalOpen(false)} />
    </div>
  );
};
