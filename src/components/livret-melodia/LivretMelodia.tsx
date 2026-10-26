/**
 * LivretMelodia.tsx
 * Livret 4 : Melodia & Letra (Piano Roll, Letra, Melodyne & Boussole de pattern) (< 110 lignes).
 * Auto-extraction a la volee si un enregistrement PCM est present sans pack melodic.
 */
import React, { useEffect } from 'react';
import type { VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { MelodiaEmptyNotice } from './MelodiaEmptyNotice';
import { LivretMelodiaWorkspace } from './LivretMelodiaWorkspace';
import { extractPatternMelodicData } from '../../audio/melodicExtractionHelper';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';

export interface LivretMelodiaProps {
  initialPack?: VocalPackExport | null;
  cleanPCM?: Float32Array;
  sampleRate?: number;
  totalDurationSec?: number;
  anacrusisDurationSec?: number;
  beatsPerMeasure?: number;
  measuresCount?: number;
  pitchCurve?: PitchCurvePoint[];
  initialSteps?: VocalStepData[];
  outputDeviceId?: string;
  pitchShiftSemitones?: number;
  onBackToPrise?: () => void;
  onPackUpdated?: (pack: VocalPackExport) => void;
}

export const LivretMelodia: React.FC<LivretMelodiaProps> = (props) => {
  const { project, activePattern, activeVariant, updatePattern } = useToadaProject();
  const { selectedOutputDeviceId, recordedSampleRate } = useAudioHardware();

  const rawPCM = activeVariant.recordingResult?.pcm ?? null;
  const sampleRate = activeVariant.recordingResult?.sampleRate ?? recordedSampleRate;
  const hasAudio = Boolean(rawPCM && rawPCM.length > 0);
  const isMelodiaReady = Boolean(activePattern.pack && activePattern.rawAudioSamples && (activePattern.mainSteps?.length ?? 0) > 0);

  useEffect(() => {
    if (!hasAudio || !rawPCM || isMelodiaReady) return;
    const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88;
    const effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
    const referencePitch = activePattern.referencePitch ?? 'C4';
    const effectivePitch = transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones);
    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const beatResolutions = getDefaultBeatResolutions(project.timeSignature);
    const hasAnacrusis = activePattern.hasAnacrusis !== false;

    const res = extractPatternMelodicData({
      rawPCM, sampleRate, bpm: effectiveBpm, timeSignature: project.timeSignature,
      measuresCount: activePattern.measuresCount, beatsPerMeasure, beatResolutions,
      hasAnacrusis, trimStartSec: activeVariant.trimStartSec, trimEndSec: activeVariant.trimEndSec,
      referencePitch: effectivePitch, pitchShiftSemitones: activeVariant.pitchShiftSemitones,
      tessitura: activePattern.tessitura, assignedLyricsText: activePattern.assignedLyricsText,
      lowCutEnabled: activeVariant.lowCutEnabled, enableTonePolish: activeVariant.enableTonePolish !== false,
    });

    updatePattern(activePattern.id, {
      pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve,
      pitchCurve: res.pitchCurve, anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps,
      isMidiInitialized: true, midiLocked: true,
    });
  }, [hasAudio, rawPCM, isMelodiaReady, activePattern, activeVariant, project, sampleRate, updatePattern]);

  const pack = props.initialPack ?? activePattern.pack;

  if (!hasAudio && !pack) {
    return (
      <div className="flex flex-col gap-3.5 w-full">
        <PatternCompassBar />
        <MelodiaEmptyNotice />
      </div>
    );
  }

  if (!pack || !activePattern.rawAudioSamples) {
    return (
      <div className="flex flex-col gap-3.5 w-full">
        <PatternCompassBar />
        <div className="cordel-card p-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-theme-accent border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-[var(--cordel-secondary-text)]">
            Extraction du pitch et des briques MIDI en cours...
          </p>
        </div>
      </div>
    );
  }

  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / (activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88);
  const measureDuration = beatsPerMeasure * beatDuration;
  const totalDurationSec = getPatternTotalDurationSec(activePattern.hasAnacrusis !== false, activePattern.measuresCount, measureDuration, 0.25, beatDuration);

  return (
    <LivretMelodiaWorkspace
      {...props}
      initialPack={pack}
      cleanPCM={activePattern.rawAudioSamples}
      sampleRate={sampleRate}
      totalDurationSec={totalDurationSec}
      beatsPerMeasure={beatsPerMeasure}
      measuresCount={activePattern.measuresCount}
      pitchCurve={activePattern.pitchCurve}
      outputDeviceId={selectedOutputDeviceId}
      pitchShiftSemitones={activeVariant.pitchShiftSemitones}
    />
  );
};
