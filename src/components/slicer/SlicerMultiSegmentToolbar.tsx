/**
 * SlicerMultiSegmentToolbar.tsx
 * Barre d'outils Slicer : Métronome ON/OFF, Décalage T1 Maître, Commutateur [ 🕳️ Avec les trous | 🔗 Phrases à la suite ], Calquage Organizador (< 138 lignes).
 */
import React from 'react';
import { Volume2, VolumeX, Sparkles, Plus, Trash2, FolderOpen, RefreshCw, Magnet, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { SlicerGapMode } from '../../utils/slicerAlignmentHelper';

interface SlicerMultiSegmentToolbarProps {
  segmentCount: number; durationSec: number; bpm: number; gridOffsetSec: number;
  metronomeActive: boolean; cascadeMove: boolean; isSyncing?: boolean;
  gapMode?: SlicerGapMode; onGapModeChange?: (mode: SlicerGapMode) => void;
  onToggleMetronome: () => void; onBpmChange?: (newBpm: number) => void;
  onNudgeOffset: (deltaSec: number) => void;
  onToggleCascade: () => void; onAlignOrganizador: () => void; onSyncOrganizador: () => void;
  onDetectSilences: () => void; onAddSegment: () => void; onAddPauseSegment?: () => void; onClearSegments: () => void; onChangeFile: () => void;
}

export const SlicerMultiSegmentToolbar: React.FC<SlicerMultiSegmentToolbarProps> = ({
  durationSec, bpm, gridOffsetSec, metronomeActive, cascadeMove, isSyncing,
  gapMode = 'with_gaps', onGapModeChange,
  onToggleMetronome, onBpmChange, onNudgeOffset, onToggleCascade, onAlignOrganizador, onSyncOrganizador,
  onDetectSilences, onAddSegment, onAddPauseSegment, onClearSegments, onChangeFile,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-theme-bg/60 border border-theme-border/60 rounded text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--cordel-border-sub)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button" onClick={onToggleMetronome}
            className={`h-7 px-2.5 rounded font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              metronomeActive ? 'bg-amber-500 text-stone-950 font-black shadow-xs' : 'cordel-card-sm text-theme-ink/80 hover:text-theme-ink'
            }`}
            title={t('slicerMetronomeTitle')}
          >
            {metronomeActive ? <Volume2 className="w-3.5 h-3.5 fill-current" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{t('slicerMetronomeBtn')}</span>
          </button>

          <div className="flex items-center gap-1 cordel-card-sm px-1.5 py-0.5 rounded text-[11px]">
            <span className="text-[var(--cordel-secondary-text)]">BPM:</span>
            <button type="button" onClick={() => onBpmChange?.(Math.max(30, bpm - 1))} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">-1</button>
            <strong className="text-amber-500 font-black px-0.5">{bpm}</strong>
            <button type="button" onClick={() => onBpmChange?.(Math.min(220, bpm + 1))} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">+1</button>
          </div>

          <div className="flex items-center gap-0.5 cordel-card-sm px-1.5 py-0.5 rounded text-[11px]">
            <span className="text-[var(--cordel-secondary-text)] mr-1">{t('slicerMasterT1Label')} <strong>{gridOffsetSec.toFixed(2)}s</strong></span>
            <button type="button" onClick={() => onNudgeOffset(-0.05)} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">-50ms</button>
            <button type="button" onClick={() => onNudgeOffset(-0.01)} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">-10ms</button>
            <button type="button" onClick={() => onNudgeOffset(0.01)} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">+10ms</button>
            <button type="button" onClick={() => onNudgeOffset(0.05)} className="px-1 py-0.2 hover:bg-theme-accent/20 rounded cursor-pointer font-bold">+50ms</button>
          </div>

          {onGapModeChange && (
            <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden text-[11px]">
              <button
                type="button" onClick={() => onGapModeChange('with_gaps')}
                className={`h-7 px-2 font-bold cursor-pointer transition-colors ${
                  gapMode === 'with_gaps' ? 'bg-amber-600 text-white' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/75 hover:opacity-100'
                }`}
                title="Garde les trous exacts de l'autre rôle (Chœur / Puxador) selon le Conducteur"
              >
                🕳️ Avec les trous
              </button>
              <button
                type="button" onClick={() => onGapModeChange('chained')}
                className={`h-7 px-2 font-bold cursor-pointer transition-colors border-l border-[var(--cordel-border-sub)] ${
                  gapMode === 'chained' ? 'bg-emerald-700 text-white' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/75 hover:opacity-100'
                }`}
                title="Phrases chantées à la suite sans attendre le Chœur / Puxador"
              >
                🔗 Phrases à la suite
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button" onClick={onToggleCascade}
            className={`h-7 px-2 cordel-card-sm text-[11px] rounded flex items-center gap-1 cursor-pointer transition-colors ${
              cascadeMove ? 'bg-amber-600/30 text-amber-700 dark:text-amber-400 border-amber-500/50 font-bold' : 'opacity-70 hover:opacity-100'
            }`}
            title={t('slicerCascadeTitle')}
          >
            <Magnet className="w-3 h-3" /><span className="hidden sm:inline">{t('slicerCascadeBtn')}</span>
          </button>

          <button
            type="button" onClick={onAlignOrganizador}
            className="h-7 px-2.5 cordel-btn-primary font-bold flex items-center gap-1.5 cursor-pointer bg-theme-wood text-[#f4ecd8]"
            title={t('slicerAlignOrganizadorTitle')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /><span>{t('slicerAlignOrganizadorBtn')}</span>
          </button>

          <button
            type="button" onClick={onSyncOrganizador} disabled={isSyncing}
            className="h-7 px-2 cordel-card-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded"
            title={t('slicerSyncFirestoreTitle')}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /><span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onDetectSilences} className="h-7 px-2.5 cordel-card-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-amber-600/20 text-theme-ink" title={t('slicerDetectRmsTitle')}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /><span>{t('slicerAutoDetectPhrasesBtn')}</span>
          </button>
          <button type="button" onClick={onAddSegment} className="h-7 px-2 cordel-card-sm flex items-center gap-1 cursor-pointer hover:bg-theme-accent/20">
            <Plus className="w-3 h-3 text-theme-accent" /><span>{t('slicerAddSegmentBtn')}</span>
          </button>
          {onAddPauseSegment && (
            <button type="button" onClick={onAddPauseSegment} className="h-7 px-2 cordel-card-sm font-bold flex items-center gap-1 cursor-pointer hover:bg-stone-500/20 text-theme-ink" title={t('slicerAddPauseTitle')}>
              <span>{t('slicerAddPauseBtn')}</span>
            </button>
          )}
          <button type="button" onClick={onClearSegments} className="h-7 px-2 cordel-card-sm text-red-500 dark:text-red-400 hover:text-red-400 border border-red-500/40 hover:bg-red-950/30 flex items-center gap-1 cursor-pointer">
            <Trash2 className="w-3 h-3" /><span className="hidden sm:inline">{t('slicerClearSegmentsBtn')}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--cordel-secondary-text)]">Total : <strong>{durationSec.toFixed(1)}s</strong></span>
          <button type="button" onClick={onChangeFile} className="h-7 px-2 cordel-card-sm flex items-center gap-1 cursor-pointer text-theme-accent text-xs">
            <FolderOpen className="w-3 h-3" /><span>{t('slicerChangeFileBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
