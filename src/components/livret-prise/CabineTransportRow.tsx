/**
 * CabineTransportRow.tsx
 * Ligne d'action de 1er plan de la Cabine : Témoin d'activité micro (DOM ref 0 re-render) +
 * Bouton [ENREGISTRER LA VOIX] + Bouton compact [▶ Réécouter] dès qu'un audio existe (< 75 lignes).
 */
import React from 'react';
import { Mic, Play, Square, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { RecordActionButton } from './RecordActionButton';

interface Props {
  isCycleActive: boolean;
  measuresCount: number;
  hasExistingAudio: boolean;
  isReplaying: boolean;
  isMicProbeActive: boolean;
  micBarFillRef: React.RefObject<HTMLDivElement | null>;
  micClipDotRef: React.RefObject<HTMLSpanElement | null>;
  onToggleMicProbe: () => void;
  onStartRecord: () => void;
  onToggleReplay: () => void;
}

export const CabineTransportRow: React.FC<Props> = ({
  isCycleActive, measuresCount, hasExistingAudio, isReplaying, isMicProbeActive,
  micBarFillRef, micClipDotRef, onToggleMicProbe, onStartRecord, onToggleReplay,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
      <button
        type="button"
        onClick={onToggleMicProbe}
        title={isMicProbeActive || isCycleActive ? t('cabineMicReady') : t('cabineMicTestHint')}
        className="h-10 px-3 cordel-card-sm rounded-lg inline-flex items-center gap-2 text-xs font-mono font-bold cursor-pointer select-none hover:border-amber-500/70"
      >
        <Mic className={`w-3.5 h-3.5 shrink-0 ${isMicProbeActive || isCycleActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-accent'}`} />
        <div className="w-16 h-2 rounded-full bg-stone-800/80 overflow-hidden border border-[var(--cordel-border-sub)]">
          <div ref={micBarFillRef} className="h-full w-full origin-left bg-emerald-500 transition-none" style={{ transform: 'scaleX(0)' }} />
        </div>
        <span ref={micClipDotRef} style={{ display: 'none' }} className="px-1.5 py-0.5 rounded bg-red-700 text-white text-[10px] font-black items-center gap-1">
          <AlertTriangle className="w-3 h-3" /><span>{t('cabineMicClip')}</span>
        </span>
      </button>

      <div className="flex-shrink-0">
        <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={onStartRecord} />
      </div>

      {hasExistingAudio && (
        <button
          type="button"
          onClick={onToggleReplay}
          disabled={isCycleActive}
          className={`h-10 px-3.5 rounded-lg font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-45 ${
            isReplaying ? 'bg-red-800 text-white' : 'cordel-btn hover:border-amber-500/70'
          }`}
        >
          {isReplaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current text-theme-accent" />}
          <span>{isReplaying ? t('studentStopAudioBtn') : t('cabineReplayBtn')}</span>
        </button>
      )}
    </div>
  );
};
