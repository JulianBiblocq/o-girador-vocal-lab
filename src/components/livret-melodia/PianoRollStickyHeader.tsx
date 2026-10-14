/**
 * PianoRollStickyHeader.tsx
 * En-tête sticky top-0 combinant le coin 64 px (Mesures / Temps) et le Canvas de règle temporelle.
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
  getPlayheadSec?: () => number;
  onSeek: (sec: number) => void;
}

export const PianoRollStickyHeader: React.FC<PianoRollStickyHeaderProps> = (props) => {
  const { gridWidth, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, getPlayheadSec, onSeek } = props;
  const { t } = useLanguage();

  return (
    <div className="sticky top-0 z-20 flex bg-[#141210] border-b border-white/20" style={{ height: '42px', width: `${64 + gridWidth}px` }}>
      <div className="sticky left-0 z-30 shrink-0 w-[64px] h-[42px] bg-[#141210] border-r-2 border-black/80 flex flex-col justify-between">
        <div className="w-full h-[21px] border-b border-white/10 flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-bold text-amber-400/85 tracking-widest">{t('rulerMeasures')}</span>
        </div>
        <div className="w-full h-[21px] flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-semibold text-stone-400/80 tracking-widest">{t('rulerBeats')}</span>
        </div>
      </div>
      <div className="relative" style={{ width: `${gridWidth}px`, height: '42px' }}>
        <PianoRollRulerCanvas
          width={gridWidth} beatsPerMeasure={beatsPerMeasure} totalDurationSec={totalDurationSec}
          anacrusisDurationSec={anacrusisDurationSec} seekStartSec={seekStartSec} isPlaying={isPlaying}
          getPlayheadSec={getPlayheadSec} onSeek={onSeek}
        />
      </div>
    </div>
  );
};
