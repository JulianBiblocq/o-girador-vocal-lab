/**
 * LivretStructure.tsx
 * Livret 1 : Structure & Chant (Bibliothèque, Conducteur, Grille d'accords, Paroles & Réglages Métriques) (< 115 lignes).
 */
import React, { useState, useEffect } from 'react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { PatternLibraryBar } from '../conductor/PatternLibraryBar';
import { ToadaConductorStrip } from '../conductor/ToadaConductorStrip';
import { ChordGridBar } from '../common/ChordGridBar';
import { PatternLyricsBanner } from '../livret-prise/PatternLyricsBanner';
import { StructureMusicConfigPanel } from './StructureMusicConfigPanel';
import { LatencyReminderBanner } from '../common/LatencyReminderBanner';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { getBeatsPerMeasure } from '../../utils/musicalMath';

export const LivretStructure: React.FC = () => {
  const {
    project, activePattern, updatePattern,
    updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis,
    updateScopedReferencePitch, updateScopedTimeSignature,
  } = useToadaProject();
  const { engine, selectedOutputDeviceId } = useAudioHardware();

  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>(project.timeSignature);
  const [bpm, setBpm] = useState(activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88);
  const [referencePitch, setReferencePitch] = useState(activePattern.referencePitch ?? 'C4');
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions(project.timeSignature));

  useEffect(() => {
    setBpm(activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88);
    setReferencePitch(activePattern.referencePitch ?? 'C4');
  }, [activePattern.id, activePattern.bpm, activePattern.baseBpm, activePattern.referencePitch, project.bpm]);

  const measuresCount = activePattern.measuresCount;
  const hasAnacrusis = activePattern.hasAnacrusis !== false;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);

  return (
    <div className="flex flex-col gap-4 w-full">
      <LatencyReminderBanner />

      {/* 1. Bibliothèque de Patterns et Conducteur 2 rails */}
      <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-5 h-full">
          <PatternLibraryBar />
        </div>
        <div className="xl:col-span-7 h-full">
          <ToadaConductorStrip outputDeviceId={selectedOutputDeviceId} />
        </div>
      </div>

      {/* 2. Paroles & Grille Harmonique d'accords du pattern actif */}
      <div className="flex flex-col gap-2">
        <PatternLyricsBanner />
        <div className="cordel-card p-2 rounded">
          <ChordGridBar
            harmonyGrid={activePattern.harmonyGrid}
            measuresCount={measuresCount}
            beatsPerMeasure={beatsPerMeasure}
            hasAnacrusis={hasAnacrusis}
            onUpdateGrid={(newGrid) => updatePattern(activePattern.id, { harmonyGrid: newGrid })}
          />
        </div>
      </div>

      {/* 3. Réglages musicaux (BPM, Signature, Mesures, Portée, Anacrouse, Tonalité) */}
      <StructureMusicConfigPanel
        timeSignature={timeSignature}
        onTimeSignatureChange={(sig) => { setTimeSignature(sig); updateScopedTimeSignature(sig); }}
        bpm={bpm}
        onBpmChange={(v) => { setBpm(v); updateScopedBpm(v); }}
        measuresCount={measuresCount}
        onMeasuresCountChange={(c) => updateScopedMeasuresCount(c as 1 | 2 | 3 | 4)}
        hasAnacrusis={hasAnacrusis}
        onHasAnacrusisChange={(has) => updateScopedHasAnacrusis(has)}
        referencePitch={referencePitch}
        onReferencePitchChange={(p) => { setReferencePitch(p); updateScopedReferencePitch(p); }}
        onPlayPitchPreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
        beatResolutions={beatResolutions}
        onBeatResolutionsChange={setBeatResolutions}
      />
    </div>
  );
};
