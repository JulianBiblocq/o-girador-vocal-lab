/**
 * SyncAndExportDropdown.tsx
 * Menu unifié [Sync & Export ▾] : Sauvegarde (Ctrl+S), Sync/Push Organizador, Push Sequenciador,
 * Atelier Papier, Partitions & MuseScore (.musicxml), Lexique & WAV (< 138 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useManualSave } from '../../hooks/useManualSave';
import { syncProjectWithOrganizador } from '../../utils/toadaSyncService';
import { publishToadaToOrganizador } from '../../services/organizadorToadaPublisher';
import { exportFullSongWav } from '../../utils/fullSongWavExporter';
import { alertAsync } from '../../stores/useCordelDialogStore';
import { useActionFeedback, CORDEL_SUCCESS_BTN_CLASS } from '../common/useActionFeedback';
import { SamambaiaRepertoireTargetModal } from '../modals/SamambaiaRepertoireTargetModal';
import { VocalPaperWorkshopModal, type VocalPaperModalTabId } from '../modals/vocal-paper/VocalPaperWorkshopModal';
import { SyncAndExportMenuItems } from './SyncAndExportMenuItems';
import { useResetAllProjectTakes } from '../../hooks/useResetAllProjectTakes';
import { Save, ChevronDown, Check, Loader2 } from 'lucide-react';

interface Props {
  project: ToadaProject;
  groupId: string | null;
  isUserLoggedIn: boolean;
  onProjectUpdate: (next: ToadaProject) => void;
  onOpenLexicon: () => void;
}

export const SyncAndExportDropdown: React.FC<Props> = ({
  project, groupId, isUserLoggedIn, onProjectUpdate, onOpenLexicon,
}) => {
  const { t, language } = useLanguage(), isBr = language === 'br';
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSeqModalOpen, setIsSeqModalOpen] = useState(false);
  const [paperModalTab, setPaperModalTab] = useState<VocalPaperModalTabId | null>(null);
  const { isSaving, isSavedSuccess, handleSave } = useManualSave(project, isUserLoggedIn);
  const { hasAnyProjectTake, handleResetAllTakes } = useResetAllProjectTakes(project, onProjectUpdate);
  const feedback = useActionFeedback(isBr ? '✓ Salvo !' : '✓ Synchronisé !');

  useEffect(() => {
    const onOut = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); };
    const onClose = () => setIsOpen(false);
    document.addEventListener('mousedown', onOut); window.addEventListener('cordel-close-popovers', onClose);
    return () => { document.removeEventListener('mousedown', onOut); window.removeEventListener('cordel-close-popovers', onClose); };
  }, []);

  const handlePullOrganizador = async () => {
    setIsOpen(false);
    await feedback.trigger(async () => {
      const res = await syncProjectWithOrganizador(project, groupId);
      if (!res) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'info', message: t('projectNotFoundInOrganizador') } }));
        throw new Error('not_found');
      }
      onProjectUpdate(res.updatedProject);
      const label = isBr ? '✓ Sincronizado !' : '✓ Synchronisé !';
      await alertAsync({ title: label, message: res.toastMessage, variant: 'info' });
      return label;
    }).catch(() => {});
  };

  const handlePushOrganizador = async () => {
    setIsOpen(false);
    await feedback.trigger(async () => {
      const res = await publishToadaToOrganizador(project, project.toadaMeta?.groupId || groupId || undefined);
      onProjectUpdate({
        ...project,
        id: res.cantadorToadaId,
        toadaMeta: { ...(project.toadaMeta || {}), id: res.documentId, cantadorToadaId: res.cantadorToadaId, bpmDefaut: res.bpm, tonaliteDefaut: res.scaleLabel },
      });
      const label = isBr ? '✓ Organizador atualizado !' : '✓ Organizador mis à jour !';
      await alertAsync({
        title: label,
        message: isBr ? `Ficha sincronizada (${res.bpm} BPM • ${res.scaleLabel} • ${project.patterns.length} padrões).` : `Fiche synchronisée (${res.bpm} BPM • ${res.scaleLabel} • ${project.patterns.length} patterns).`,
        variant: 'info',
      });
      return label;
    }).catch((err: any) => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: t('publishOrganizadorErrorToast', { err: err?.message || 'err' }) } }));
    });
  };

  const handleWav = async () => {
    setIsOpen(false);
    await feedback.trigger(async () => {
      await exportFullSongWav(project);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('wavExportSuccess') } }));
      return isBr ? '✓ WAV Exportado !' : '✓ WAV Exporté !';
    }).catch((err: any) => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: t('wavExportErrorToast', { err: err?.message || 'err' }) } }));
    });
  };

  const isBusy = isSaving || feedback.isLoading, isOk = isSavedSuccess || feedback.isSuccess;
  const label = isBusy ? (isBr ? 'Em curso...' : 'En cours...') : feedback.isSuccess ? feedback.successLabel : isSavedSuccess ? (isBr ? '✓ Salvo !' : '✓ Sauvegardé !') : t('syncExportBtnLabel');
  const lexCount = project.toadaMeta?.notesLexique?.length || 0;

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button type="button" disabled={isBusy} onClick={() => setIsOpen((p) => !p)} className={`h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${isOk ? CORDEL_SUCCESS_BTN_CLASS : 'bg-theme-wood hover:bg-theme-wood/90 text-[var(--cordel-on-primary)]'}`}>
        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isOk ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        <span>{label}</span><ChevronDown className="w-3 h-3 opacity-80" />
      </button>

      {isOpen && (
        <SyncAndExportMenuItems
          lexCount={lexCount} hasAnyProjectTake={hasAnyProjectTake} onClose={() => setIsOpen(false)}
          onSave={handleSave} onPullOrganizador={handlePullOrganizador} onPushOrganizador={handlePushOrganizador}
          onOpenSeqModal={() => setIsSeqModalOpen(true)} onOpenPaperTab={(tab) => setPaperModalTab(tab)}
          onOpenLexicon={onOpenLexicon} onExportWav={handleWav} onResetAllTakes={handleResetAllTakes}
        />
      )}

      <SamambaiaRepertoireTargetModal isOpen={isSeqModalOpen} onClose={() => setIsSeqModalOpen(false)} />
      {paperModalTab && (
        <VocalPaperWorkshopModal
          isOpen={Boolean(paperModalTab)} initialTab={paperModalTab} onClose={() => setPaperModalTab(null)}
          project={project} groupId={groupId} isBr={isBr} onProjectUpdate={onProjectUpdate}
        />
      )}
    </div>
  );
};
