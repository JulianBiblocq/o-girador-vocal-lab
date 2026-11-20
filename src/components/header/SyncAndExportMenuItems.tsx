/**
 * SyncAndExportMenuItems.tsx
 * Liste d'actions du menu déroulant [Sync & Export ▾] incluant la remise à zéro locale des prises (< 85 lignes).
 */
import React from 'react';
import { Save, RefreshCw, CloudUpload, FileText, Printer, BookOpen, Music, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import type { VocalPaperModalTabId } from '../modals/vocal-paper/VocalPaperWorkshopModal';
import { RecoverTakeIcon, ResetAllTakesIcon } from '../icons/CordelActionIcons';

interface Props {
  lexCount: number;
  hasAnyProjectTake: boolean;
  onClose: () => void;
  onSave: () => void;
  onPullOrganizador: () => void;
  onPushOrganizador: () => void;
  onOpenSeqModal: () => void;
  onOpenPaperTab: (tab: VocalPaperModalTabId) => void;
  onOpenLexicon: () => void;
  onExportWav: () => void;
  onResetAllTakes: () => void;
}

export const SyncAndExportMenuItems: React.FC<Props> = ({
  lexCount, hasAnyProjectTake, onClose, onSave, onPullOrganizador, onPushOrganizador,
  onOpenSeqModal, onOpenPaperTab, onOpenLexicon, onExportWav, onResetAllTakes,
}) => {
  const { t } = useLanguage();

  return (
    <div className="absolute top-9 right-0 z-[100] w-72 cordel-card p-1.5 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-0.5 text-xs font-mono rounded">
      <button type="button" onClick={() => { onClose(); onSave(); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <Save className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('btnSaveToada')} (Ctrl+S)</span>
      </button>
      <button type="button" onClick={onPullOrganizador} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" /><span className="font-bold">{t('syncPullOrganizadorItem')}</span>
      </button>
      <button type="button" onClick={() => { onClose(); useVocalTransportStore.getState().setRecoveryModalOpen(true); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <RecoverTakeIcon className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300 shrink-0" /><span className="font-bold">{t('recoveryOpenBtn')}</span>
      </button>
      <button type="button" onClick={onPushOrganizador} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncPushOrganizadorItem')}</span>
      </button>
      <button type="button" onClick={() => { onClose(); onOpenSeqModal(); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <CloudUpload className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncPushSequenciadorItem')}</span>
      </button>
      <div className="my-0.5 border-t border-[var(--cordel-border-sub)]" />
      <button type="button" onClick={() => { onClose(); onOpenPaperTab('print'); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <Printer className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300 shrink-0" /><span className="font-bold">{t('syncPaperWorkshopItem')}</span>
      </button>
      <button type="button" onClick={() => { onClose(); onOpenPaperTab('scores'); }} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <FileSpreadsheet className="w-3.5 h-3.5 text-[#0f766e] dark:text-teal-300 shrink-0" /><span className="font-bold">{t('syncScoresMusicXmlItem')}</span>
      </button>
      <button type="button" onClick={() => { onClose(); onOpenLexicon(); }} className="w-full p-1.5 text-left flex items-center justify-between gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-theme-accent shrink-0" /><strong className="font-bold">{t('syncLexiconItem')}</strong></span>
        {lexCount > 0 && <span className="px-1.5 text-[10px] bg-theme-wood text-[var(--cordel-on-primary)] rounded font-bold">{lexCount}</span>}
      </button>
      <button type="button" onClick={onExportWav} className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-[var(--cordel-subcard-bg)] rounded cursor-pointer">
        <Music className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="font-bold">{t('syncExportWavItem')}</span>
      </button>
      <div className="my-0.5 border-t border-[var(--cordel-border-sub)]" />
      <button
        type="button"
        disabled={!hasAnyProjectTake}
        onClick={() => { onClose(); onResetAllTakes(); }}
        className="w-full p-1.5 text-left flex items-center gap-2 hover:bg-red-500/10 text-red-700 dark:text-red-400 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ResetAllTakesIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-bold">{t('resetAllProjectTakesBtn')}</span>
      </button>
    </div>
  );
};
