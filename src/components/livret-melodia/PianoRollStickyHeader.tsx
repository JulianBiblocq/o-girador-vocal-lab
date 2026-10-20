/**
 * PianoRollStickyHeader.tsx
 * En-tête sticky top-0 combinant les Mesures, les Temps et le rail de locators [ In ── Out ].
 * Reste 100% visible quel que soit le défilement vertical (< 75 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PianoRollRulerCanvas } from './PianoRollRulerCanvas';
import { PianoRollLocatorRail } from './PianoRollLocatorRail';
import type { MelodyneRegion } from '../../types/vocalPack.types';

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
  regions?: MelodyneRegion[];
  selectedRegionId?: string | null;
  onSelectRegion?: (id: string | null) => void;
  onUpdateRegionBounds?: (id: string, startSec: number, endSec: number) => void;
  onAddRegion?: (startSec: number, endSec: number) => void;
}

export const PianoRollStickyHeader: React.FC<PianoRollStickyHeaderProps> = (props) => {
  const {
    gridWidth, beatsPerMeasure, totalDurationSec, anacrusisDurationSec,
    seekStartSec, isPlaying, hasAnacrusis = true, t1OffsetSec, bpm,
    getPlayheadSec, onSeek, regions = [], selectedRegionId = null,
    onSelectRegion, onUpdateRegionBounds, onAddRegion,
  } = props;
  const { t } = useLanguage();

  return (
    <div className="sticky top-0 z-20 flex bg-[var(--cordel-surface)] border-b border-[var(--cordel-border-panel)] select-none" style={{ height: '66px', width: `${64 + gridWidth}px` }}>
      {/* Colonne sticky gauche 64 px */}
      <div className="sticky left-0 z-30 shrink-0 w-[64px] h-[66px] bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex flex-col justify-between">
        <div className="w-full h-[21px] border-b border-[var(--cordel-border-sub)] flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-bold text-amber-700 dark:text-amber-400/85 tracking-widest">{t('rulerMeasures')}</span>
        </div>
        <div className="w-full h-[21px] border-b border-[var(--cordel-border-sub)] flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-semibold text-[var(--cordel-secondary-text)] tracking-widest">{t('rulerBeats')}</span>
        </div>
        <div className="w-full h-[24px] flex items-center justify-center bg-[var(--cordel-subcard-bg)]">
          <span className="text-[8px] font-mono font-bold text-[var(--cordel-accent-text)] tracking-wider">{t('melodyneRailLabel')}</span>
        </div>
      </div>

      {/* Pistes temporelles droites (Règle 42 px + Rail Locators 24 px) */}
      <div className="flex flex-col" style={{ width: `${gridWidth}px`, height: '66px' }}>
        <div className="relative" style={{ width: `${gridWidth}px`, height: '42px' }}>
          <PianoRollRulerCanvas
            width={gridWidth} beatsPerMeasure={beatsPerMeasure} totalDurationSec={totalDurationSec}
            anacrusisDurationSec={anacrusisDurationSec} seekStartSec={seekStartSec} isPlaying={isPlaying}
            hasAnacrusis={hasAnacrusis} t1OffsetSec={t1OffsetSec} bpm={bpm}
            getPlayheadSec={getPlayheadSec} onSeek={onSeek}
          />
        </div>
        <PianoRollLocatorRail
          gridWidth={gridWidth} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
          beatsPerMeasure={beatsPerMeasure} hasAnacrusis={hasAnacrusis} t1OffsetSec={t1OffsetSec} bpm={bpm}
          regions={regions} selectedRegionId={selectedRegionId}
          onSelectRegion={(id) => onSelectRegion?.(id)}
          onUpdateRegionBounds={(id, s, e) => onUpdateRegionBounds?.(id, s, e)}
          onAddRegion={(s, e) => onAddRegion?.(s, e)}
        />
      </div>
    </div>
  );
};
