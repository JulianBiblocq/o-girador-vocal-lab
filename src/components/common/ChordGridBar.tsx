/**
 * ChordGridBar.tsx
 * Bandeau d'accords compact et éditable par mesure et par temps, synchronisable avec le Piano Roll (< 125 lignes).
 */
import React, { useState } from 'react';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { setChordAtBeat } from '../../utils/chordGridHelper';
import { ChordEditPopover } from './ChordEditPopover';
import { useLanguage } from '../../i18n/LanguageContext';

interface ChordGridBarProps {
  harmonyGrid?: PatternHarmonyGrid;
  measuresCount: number;
  beatsPerMeasure: number;
  hasAnacrusis?: boolean;
  onUpdateGrid: (newGrid: PatternHarmonyGrid) => void;
  readOnly?: boolean;
  alignedGridWidth?: number;
  keyboardOffsetPx?: number;
}

export const ChordGridBar: React.FC<ChordGridBarProps> = ({
  harmonyGrid,
  measuresCount,
  beatsPerMeasure,
  hasAnacrusis = true,
  onUpdateGrid,
  readOnly = false,
  alignedGridWidth,
  keyboardOffsetPx = 0,
}) => {
  const { t } = useLanguage();
  const [activeCell, setActiveCell] = useState<{ measureIndex: number; beatIndex: number } | null>(null);

  const handleApplyChord = (chord: string | null) => {
    if (!activeCell) return;
    const nextGrid = setChordAtBeat(harmonyGrid, activeCell.measureIndex, activeCell.beatIndex, chord, measuresCount);
    onUpdateGrid(nextGrid);
    setActiveCell(null);
  };

  const measuresArray = Array.from({ length: measuresCount }, (_, i) => i);
  const totalBeats = (hasAnacrusis ? beatsPerMeasure : 0) + measuresCount * beatsPerMeasure + 1;
  const measureWidthPx = alignedGridWidth ? (beatsPerMeasure / totalBeats) * alignedGridWidth : undefined;

  return (
    <div
      className={`flex items-stretch select-none text-xs ${alignedGridWidth ? 'border-b border-[var(--cordel-border-panel)] bg-[var(--cordel-surface)]' : 'gap-1 w-full overflow-x-auto cordel-scrollbar py-1'}`}
      style={alignedGridWidth ? { width: `${keyboardOffsetPx + alignedGridWidth}px` } : undefined}
    >
      {alignedGridWidth && keyboardOffsetPx > 0 && (
        <div
          className="sticky left-0 z-30 shrink-0 bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex items-center justify-center"
          style={{ width: `${keyboardOffsetPx}px` }}
        >
          <span className="text-[7.5px] font-mono font-bold text-amber-800 dark:text-amber-400 tracking-widest uppercase">
            {t('harmonyTitle')}
          </span>
        </div>
      )}

      {hasAnacrusis && (
        <div
          className={`flex flex-col justify-center border border-dashed border-amber-600/40 bg-amber-500/10 px-2 py-1 shrink-0 ${alignedGridWidth ? 'rounded-none' : 'rounded'}`}
          style={measureWidthPx ? { width: `${measureWidthPx}px` } : undefined}
        >
          <span className="text-[9px] font-mono text-amber-700 dark:text-amber-400 font-bold tracking-wider truncate">{t('chordGridElanLabel')}</span>
          <span className="text-[10px] font-mono text-[var(--cordel-secondary-text)] italic truncate">{t('chordGridFreeLabel')}</span>
        </div>
      )}

      {measuresArray.map((mIdx) => {
        const measureData = harmonyGrid?.measures?.find((m) => m.measureIndex === mIdx);
        return (
          <div
            key={mIdx}
            className={`flex flex-col cordel-card-sm px-1.5 py-1 shrink-0 ${alignedGridWidth ? 'rounded-none border-y-0' : 'min-w-[140px] rounded'}`}
            style={measureWidthPx ? { width: `${measureWidthPx}px` } : undefined}
          >
            <span className="text-[9px] font-mono font-bold text-[var(--cordel-secondary-text)] tracking-wider truncate">
              {t('chordGridMeasureLabel', { n: mIdx + 1 })}
            </span>
            <div className={`grid gap-1 mt-0.5`} style={{ gridTemplateColumns: `repeat(${beatsPerMeasure}, minmax(0, 1fr))` }}>
              {Array.from({ length: beatsPerMeasure }, (_, bIdx) => {
                const chord = measureData?.chordsByBeat?.[bIdx];
                const isSelected = activeCell?.measureIndex === mIdx && activeCell?.beatIndex === bIdx;

                return (
                  <div key={bIdx} className="relative">
                    <button
                      type="button" disabled={readOnly}
                      onClick={() => !readOnly && setActiveCell({ measureIndex: mIdx, beatIndex: bIdx })}
                      className={`w-full px-1 py-0.5 min-w-[26px] font-mono text-[10.5px] border rounded cursor-pointer transition-colors truncate ${
                        chord
                          ? 'border-amber-500/80 bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold'
                          : 'border-[var(--cordel-border-sub)] text-[var(--cordel-secondary-text)] hover:border-[var(--cordel-border-panel)]'
                      } ${isSelected ? 'ring-1 ring-amber-400' : ''}`}
                      title={readOnly ? undefined : t('chordGridBeatClickTitle', { n: bIdx + 1 })}
                    >
                      {chord || `t${bIdx + 1}`}
                    </button>
                    {isSelected && (
                      <ChordEditPopover currentChord={chord || ''} onApply={handleApplyChord} onClose={() => setActiveCell(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
