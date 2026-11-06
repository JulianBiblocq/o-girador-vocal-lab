/**
 * PianoRollStickyHeader.tsx
 * En-tête sticky top-0 combinant les Mesures et les Temps (sans l'ancien rail [IN-OUT]) (< 55 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PianoRollRulerCanvas } from './PianoRollRulerCanvas';

interface PianoRollStickyHeaderProps {
  gridWidth: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  isPlaying: boolean;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  bpm?: number;
  getPlayheadSec?: () => number;
  onSeek: (sec: number) => void;
}

export const PianoRollStickyHeader: React.FC<PianoRollStickyHeaderProps> = (props) => {
  const {
    gridWidth, beatsPerMeasure, totalDurationSec, anacrusisDurationSec,
    seekStartSec, isPlaying, hasAnacrusis = true, t1OffsetSec, bpm,
    getPlayheadSec, onSeek,
  } = props;
  const { t } = useLanguage();

  return (
    <div className="sticky top-0 z-20 flex bg-[var(--cordel-surface)] border-b border-[var(--cordel-border-panel)] select-none" style={{ height: '42px', width: `${64 + gridWidth}px` }}>
      <div className="sticky left-0 z-30 shrink-0 w-[64px] h-[42px] bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex flex-col justify-between">
        <div className="w-full h-[21px] border-b border-[var(--cordel-border-sub)] flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-bold text-amber-700 dark:text-amber-400/85 tracking-widest">{t('rulerMeasures')}</span>
        </div>
        <div className="w-full h-[21px] flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-semibold text-[var(--cordel-secondary-text)] tracking-widest">{t('rulerBeats')}</span>
        </div>
      </div>

      <div className="relative" style={{ width: `${gridWidth}px`, height: '42px' }}>
        <PianoRollRulerCanvas
          width={gridWidth} beatsPerMeasure={beatsPerMeasure} totalDurationSec={totalDurationSec}
          anacrusisDurationSec={anacrusisDurationSec} seekStartSec={seekStartSec} isPlaying={isPlaying}
          hasAnacrusis={hasAnacrusis} t1OffsetSec={t1OffsetSec} bpm={bpm}
          getPlayheadSec={getPlayheadSec} onSeek={onSeek}
        />
      </div>
    </div>
  );
};
