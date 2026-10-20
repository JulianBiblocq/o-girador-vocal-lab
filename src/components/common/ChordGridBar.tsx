/**
 * ChordGridBar.tsx
 * Bandeau d'accords compact et éditable par mesure et par temps (< 130 lignes).
 */
import React, { useState } from 'react';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { setChordAtBeat } from '../../utils/chordGridHelper';
import { ChordEditPopover } from './ChordEditPopover';

interface ChordGridBarProps {
  harmonyGrid?: PatternHarmonyGrid;
  measuresCount: number;
  beatsPerMeasure: number;
  hasAnacrusis?: boolean;
  onUpdateGrid: (newGrid: PatternHarmonyGrid) => void;
  readOnly?: boolean;
}

export const ChordGridBar: React.FC<ChordGridBarProps> = ({
  harmonyGrid,
  measuresCount,
  beatsPerMeasure,
  hasAnacrusis = true,
  onUpdateGrid,
  readOnly = false,
}) => {
  const [activeCell, setActiveCell] = useState<{ measureIndex: number; beatIndex: number } | null>(null);

  const handleApplyChord = (chord: string | null) => {
    if (!activeCell) return;
    const nextGrid = setChordAtBeat(harmonyGrid, activeCell.measureIndex, activeCell.beatIndex, chord, measuresCount);
    onUpdateGrid(nextGrid);
    setActiveCell(null);
  };

  const measuresArray = Array.from({ length: measuresCount }, (_, i) => i);

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto cordel-scrollbar select-none text-xs py-1">
      {/* 1. Colonne Élan M-1 si Anacrouse */}
      {hasAnacrusis && (
        <div className="flex flex-col border border-dashed border-amber-600/40 bg-amber-950/20 px-2 py-1 shrink-0">
          <span className="text-[9px] font-mono text-amber-500/70 tracking-wider">ÉLAN (M-1)</span>
          <span className="text-[10px] font-mono text-stone-500 italic">libre</span>
        </div>
      )}

      {/* 2. Mesures M1..MN */}
      {measuresArray.map((mIdx) => {
        const measureData = harmonyGrid?.measures?.find((m) => m.measureIndex === mIdx);
        return (
          <div key={mIdx} className="flex flex-col border border-stone-800 bg-black/40 px-2 py-1 shrink-0 min-w-[140px]">
            <span className="text-[9px] font-mono font-bold text-stone-400 tracking-wider">MESURE {mIdx + 1}</span>
            <div className="flex items-center gap-1 mt-0.5">
              {Array.from({ length: beatsPerMeasure }, (_, bIdx) => {
                const chord = measureData?.chordsByBeat?.[bIdx];
                const isSelected = activeCell?.measureIndex === mIdx && activeCell?.beatIndex === bIdx;

                return (
                  <div key={bIdx} className="relative">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && setActiveCell({ measureIndex: mIdx, beatIndex: bIdx })}
                      className={`px-1.5 py-0.5 min-w-[28px] font-mono text-[10.5px] border cursor-pointer transition-colors ${
                        chord
                          ? 'border-amber-500/80 bg-amber-500/20 text-amber-300 font-bold shadow-[1px_1px_0px_#000]'
                          : 'border-stone-800 text-stone-600 hover:border-stone-600 hover:text-stone-400'
                      } ${isSelected ? 'ring-1 ring-amber-400' : ''}`}
                      title={readOnly ? undefined : `Temps ${bIdx + 1} : cliquer pour modifier l'accord`}
                    >
                      {chord || `t${bIdx + 1}`}
                    </button>

                    {isSelected && (
                      <ChordEditPopover
                        currentChord={chord || ''}
                        onApply={handleApplyChord}
                        onClose={() => setActiveCell(null)}
                      />
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
