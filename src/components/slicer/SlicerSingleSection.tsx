/**
 * SlicerSingleSection.tsx
 * Section de calage fin piquet par piquet et Time-Warp unitaire (< 130 lignes).
 */
import React from 'react';
import type { DecodedAudioResult } from '../../utils/directAudioImporter';
import type { VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import { SlicerWaveformCanvas } from './SlicerWaveformCanvas';
import { SlicerTransportBar } from './SlicerTransportBar';
import { SlicerWarpControls } from './SlicerWarpControls';
import { SlicerExtractionPanel } from './SlicerExtractionPanel';

interface SlicerSingleSectionProps {
  audio: DecodedAudioResult;
  patterns: VocalPatternItem[];
  trimIn: number;
  trimOut: number;
  beatPegs: number[];
  targetPegs: number[];
  playheadSec: number;
  isPlaying: boolean;
  loop: boolean;
  witnessClick: boolean;
  phraseBpm: number;
  warpPct: number;
  measures: 1 | 2 | 3 | 4;
  hasAnacrusis: boolean;
  role: VocalRole;
  patternName: string;
  targetPatternId: string;
  isExtracting: boolean;
  lastExtracted: string | null;
  onTrimChange: (s: number, e: number) => void;
  onPegsChange: (pegs: number[]) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleWitnessClick: () => void;
  onPlantPeg: () => void;
  onClearPegs: () => void;
  onBpmNudge: (d: number) => void;
  onWarpPctChange: (pct: number) => void;
  onMeasuresChange: (m: 1 | 2 | 3 | 4) => void;
  onHasAnacrusisChange: (has: boolean) => void;
  onTargetPatternChange: (id: string) => void;
  onRoleChange: (r: VocalRole) => void;
  onNameChange: (n: string) => void;
  onExtract: () => void;
}

export const SlicerSingleSection: React.FC<SlicerSingleSectionProps> = (props) => {
  const {
    audio, patterns, trimIn, trimOut, beatPegs, targetPegs, playheadSec,
    isPlaying, loop, witnessClick, phraseBpm, warpPct, measures, hasAnacrusis,
    role, patternName, targetPatternId, isExtracting, lastExtracted,
    onTrimChange, onPegsChange, onTogglePlay, onToggleLoop, onToggleWitnessClick,
    onPlantPeg, onClearPegs, onBpmNudge, onWarpPctChange, onMeasuresChange,
    onHasAnacrusisChange, onTargetPatternChange, onRoleChange, onNameChange, onExtract,
  } = props;

  return (
    <div className="flex flex-col gap-3">
      <SlicerWaveformCanvas
        pcm={audio.pcm} sampleRate={audio.sampleRate} durationSec={audio.durationSec}
        trimInSec={trimIn} trimOutSec={trimOut} beatPegs={beatPegs} targetPegs={targetPegs}
        playheadSec={playheadSec} beatsPerMeasure={4}
        onTrimChange={onTrimChange} onPegsChange={onPegsChange}
      />
      <SlicerTransportBar
        isPlaying={isPlaying} loop={loop} witnessClick={witnessClick}
        pegsCount={beatPegs.length} measuresEstimate={measures}
        onTogglePlay={onTogglePlay} onToggleLoop={onToggleLoop}
        onToggleWitnessClick={onToggleWitnessClick}
        onPlantPeg={onPlantPeg} onClearPegs={onClearPegs}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SlicerWarpControls
          phraseBpm={phraseBpm} warpPct={warpPct} measuresCount={measures} hasAnacrusis={hasAnacrusis}
          onBpmNudge={onBpmNudge} onWarpPctChange={onWarpPctChange}
          onMeasuresCountChange={onMeasuresChange} onHasAnacrusisChange={onHasAnacrusisChange}
        />
        <SlicerExtractionPanel
          patterns={patterns} targetPatternId={targetPatternId} role={role}
          patternName={patternName} isExtracting={isExtracting} pegsCount={beatPegs.length}
          lastExtractedName={lastExtracted} onTargetPatternChange={onTargetPatternChange}
          onRoleChange={onRoleChange} onNameChange={onNameChange} onExtract={onExtract}
        />
      </div>
    </div>
  );
};
