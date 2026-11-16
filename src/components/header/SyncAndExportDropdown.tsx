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
import { Save, RefreshCw, CloudUpload, FileText, Printer, BookOpen, Music, FileSpreadsheet, ChevronDown, Check, Loader2 } from 'lucide-react';

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
        <div className="absolute top-9 right-0 z-[100] w-72 cordel-card p-1.5 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-0.5 text-xs font-mono rounded">
          <button type="button" onClick={() => { setIsOpen(false); handleSave(); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><Save className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('btnSaveToada')} (Ctrl+S)</span></button>
          <button type="button" onClick={handlePullOrganizador} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" /><span className="font-bold">{t('syncPullOrganizadorItem')}</span></button>
          <button type="button" onClick={handlePushOrganizador} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncPushOrganizadorItem')}</span></button>
          <button type="button" onClick={() => { setIsOpen(false); setIsSeqModalOpen(true); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><CloudUpload className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncPushSequenciadorItem')}</span></button>
          <div className="my-0.5 border-t border-[var(--cordel-border-sub)]" />
          <button type="button" onClick={() => { setIsOpen(false); setPaperModalTab('print'); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><Printer className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300 shrink-0" /><span className="font-bold">{t('syncPaperWorkshopItem')}</span></button>
          <button type="button" onClick={() => { setIsOpen(false); setPaperModalTab('scores'); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><FileSpreadsheet className="w-3.5 h-3.5 text-[#0f766e] dark:text-teal-300 shrink-0" /><span className="font-bold">{t('syncScoresMusicXmlItem')}</span></button>
          <button type="button" onClick={() => { setIsOpen(false); onOpenLexicon(); }} className="w-full p-1.5 text-left flex items-center justify-between gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-theme-accent shrink-0" /><strong className="font-bold">{t('syncLexiconItem')}</strong></span>{lexCount > 0 && <span className="px-1.5 text-[10px] bg-theme-wood text-[var(--cordel-on-primary)] rounded font-bold">{lexCount}</span>}</button>
          <button type="button" onClick={handleWav} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer"><Music className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncExportWavItem')}</span></button>
        </div>
      )}

      <SamambaiaRepertoireTargetModal isOpen={isSeqModalOpen} onClose={() => setIsSeqModalOpen(false)} />
      {paperModalTab && (
        <VocalPaperWorkshopModal
          isOpen={Boolean(paperModalTab)}
          initialTab={paperModalTab}
          onClose={() => setPaperModalTab(null)}
          project={project}
          groupId={groupId}
          isBr={isBr}
          onProjectUpdate={onProjectUpdate}
        />
      )}
    </div>
  );
};
