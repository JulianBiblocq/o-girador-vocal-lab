/**
 * LivretMelodia.tsx
 * Livret 4 : Melodia & Letra (Piano Roll, Letra, Melodyne & Boussole de pattern) (< 120 lignes).
 * Auto-extraction à la volée dès la sélection d'un pattern disposant d'un audio enregistré.
 */
import React, { useEffect, useState, useCallback } from 'react';
import type { VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { PatternCompassBar, resolvePatternAudioSource, checkPatternHasMidi } from '../common/PatternCompassBar';
import { MelodiaEmptyNotice } from './MelodiaEmptyNotice';
import { LivretMelodiaWorkspace } from './LivretMelodiaWorkspace';
import { ScaleProposalBanner } from '../common/ScaleProposalBanner';
import { analyzeFullProjectScale, applyDetectedScaleToProject, type ProjectScaleAnalysisResult } from '../../audio/projectScaleAnalyzer';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { extractPatternMelodicData } from '../../audio/melodicExtractionHelper';
import { extractProjectRawLyricsSource } from '../../audio/livretResetHelper';
import { resolveFreshTimeAnchors } from '../../utils/timeAnchorParser';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';

export interface LivretMelodiaProps {
  initialPack?: VocalPackExport | null; cleanPCM?: Float32Array; sampleRate?: number;
  totalDurationSec?: number; anacrusisDurationSec?: number; beatsPerMeasure?: number;
  measuresCount?: number; pitchCurve?: PitchCurvePoint[]; initialSteps?: VocalStepData[];
  outputDeviceId?: string; pitchShiftSemitones?: number;
  onBackToPrise?: () => void; onPackUpdated?: (pack: VocalPackExport) => void;
}

export const LivretMelodia: React.FC<LivretMelodiaProps> = (props) => {
  const { project, activePattern, activeVariant, updatePattern, loadProject } = useToadaProject();
  const { selectedOutputDeviceId, recordedSampleRate } = useAudioHardware();
  const [scaleProposal, setScaleProposal] = useState<ProjectScaleAnalysisResult | null>(null);

  const handleAnalyzeFullProjectScale = useCallback(() => {
    const res = analyzeFullProjectScale(project.patterns);
    setScaleProposal(res);
    loadProject({ ...project, patterns: res.updatedPatterns.map((p) => ({ ...p, referencePitch: res.referencePitch })) });
  }, [project, loadProject]);

  const handleApplyScale = useCallback((tonic: string, scaleType: ScaleType, refPitch?: string) => {
    loadProject(applyDetectedScaleToProject(project, tonic, scaleType, refPitch));
    setScaleProposal(null);
  }, [project, loadProject]);

  const { pcm: resolvedPCM, sampleRate } = resolvePatternAudioSource(activePattern, recordedSampleRate);
  const hasAudio = Boolean(resolvedPCM && resolvedPCM.length > 0);
  const isMelodiaReady = Boolean(activePattern.rawAudioSamples?.length && checkPatternHasMidi(activePattern));

  useEffect(() => {
    if (!hasAudio || !resolvedPCM || isMelodiaReady) return;
    const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88;
    const effectiveBpm = Math.max(30, Math.round(bpm * (activeVariant?.speedRatio ?? 1)));
    const effectivePitch = transposePitchNote(activePattern.referencePitch ?? 'C4', activeVariant?.pitchShiftSemitones ?? 0);
    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const beatResolutions = getDefaultBeatResolutions(project.timeSignature);
    const hasAnacrusis = activePattern.hasAnacrusis !== false;
    const rawT1 = activeVariant?.t1OffsetSec ?? activePattern.t1OffsetSec ?? activePattern.recordingResult?.t1OffsetSec;
    const freshAnchors = resolveFreshTimeAnchors(activePattern.rawLineCode, activePattern.timeAnchors, beatsPerMeasure, !hasAnacrusis, activePattern.assignedLyricsText, extractProjectRawLyricsSource(project, activePattern));

    const res = extractPatternMelodicData({
      rawPCM: resolvedPCM, sampleRate, bpm: effectiveBpm, timeSignature: project.timeSignature,
      measuresCount: activePattern.measuresCount, beatsPerMeasure, beatResolutions,
      hasAnacrusis, trimStartSec: activeVariant?.trimStartSec ?? activePattern.trimStartSec ?? 0,
      trimEndSec: activeVariant?.trimEndSec ?? activePattern.trimEndSec ?? (resolvedPCM.length / sampleRate),
      t1OffsetSec: rawT1, referencePitch: effectivePitch, pitchShiftSemitones: activeVariant?.pitchShiftSemitones ?? 0,
      tessitura: activePattern.tessitura, assignedLyricsText: activePattern.assignedLyricsText,
      timeAnchors: freshAnchors, lowCutEnabled: activeVariant?.lowCutEnabled ?? activePattern.lowCutEnabled ?? true,
      enableTonePolish: (activeVariant?.enableTonePolish ?? activePattern.enableTonePolish) !== false,
    });

    const preserveMidi = Boolean(activePattern.midiLocked && checkPatternHasMidi(activePattern));
    updatePattern(activePattern.id, {
      pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve,
      pitchCurve: res.pitchCurve, timeAnchors: freshAnchors,
      anacrusisSteps: preserveMidi ? (activePattern.anacrusisSteps || []) : res.anacrusisSteps,
      mainSteps: preserveMidi ? (activePattern.mainSteps || []) : res.mainSteps,
      isMidiInitialized: true, midiLocked: preserveMidi, correctedAudioSamples: null,
    });
  }, [hasAudio, resolvedPCM, isMelodiaReady, activePattern, activeVariant, project, sampleRate, updatePattern]);

  const pack = props.initialPack ?? activePattern.pack;
  if (!hasAudio && !pack) {
    return <div className="flex flex-col gap-3 w-full"><PatternCompassBar /><MelodiaEmptyNotice /></div>;
  }
  if (!pack || !activePattern.rawAudioSamples) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <PatternCompassBar />
        <div className="cordel-card p-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-theme-accent border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-[var(--cordel-secondary-text)]">Extraction du pitch et des briques MIDI en cours...</p>
        </div>
      </div>
    );
  }

  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / (activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88);
  const measureDuration = beatsPerMeasure * beatDuration;
  const totalDurationSec = getPatternTotalDurationSec(activePattern.hasAnacrusis !== false, activePattern.measuresCount, measureDuration, 0.25, beatDuration);

  return (
    <div className="flex flex-col gap-3 w-full">
      <PatternCompassBar />
      <ScaleProposalBanner
        proposal={scaleProposal}
        onApplyScale={handleApplyScale}
        onKeepUncertain={handleApplyScale}
        onDisengageFreeMode={() => { loadProject(applyDetectedScaleToProject(project, scaleProposal?.tonic || 'A', 'chromatic', scaleProposal?.referencePitch)); setScaleProposal(null); }}
        onDismiss={() => setScaleProposal(null)}
      />
      <LivretMelodiaWorkspace
        key={`${project.id}-${activePattern.id}`}
        {...props}
        initialPack={pack}
        cleanPCM={activePattern.rawAudioSamples}
        sampleRate={sampleRate}
        totalDurationSec={totalDurationSec}
        beatsPerMeasure={beatsPerMeasure}
        measuresCount={activePattern.measuresCount}
        pitchCurve={activePattern.pitchCurve}
        outputDeviceId={selectedOutputDeviceId}
        pitchShiftSemitones={activeVariant?.pitchShiftSemitones ?? 0}
        onAnalyzeFullProjectScale={handleAnalyzeFullProjectScale}
      />
    </div>
  );
};
