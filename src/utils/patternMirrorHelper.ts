/**
 * patternMirrorHelper.ts
 * Helper de synchronisation miroir Puxador <-> Coro (< 90 lignes).
 * Partage automatique des prises (4 déclinaisons), du Trim, Melodyne, notes MIDI et paroles.
 */
import type { VocalPatternItem, VocalRole } from '../types/toadaProject.types';

export function createMirroredPattern(sourcePattern: VocalPatternItem, targetRole: VocalRole): VocalPatternItem {
  const newId = `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...sourcePattern,
    id: newId,
    role: targetRole,
    name: sourcePattern.name,
    linkedSourcePatternId: sourcePattern.id,
    variants: Object.fromEntries(
      Object.entries(sourcePattern.variants).map(([k, v]) => [
        k,
        {
          ...v,
          recordingResult: v.recordingResult
            ? { pcm: new Float32Array(v.recordingResult.pcm), sampleRate: v.recordingResult.sampleRate }
            : null,
        },
      ])
    ),
    recordingResult: sourcePattern.recordingResult
      ? { pcm: new Float32Array(sourcePattern.recordingResult.pcm), sampleRate: sourcePattern.recordingResult.sampleRate }
      : null,
    rawAudioSamples: sourcePattern.rawAudioSamples ? new Float32Array(sourcePattern.rawAudioSamples) : null,
    correctedAudioSamples: sourcePattern.correctedAudioSamples ? new Float32Array(sourcePattern.correctedAudioSamples) : null,
    rawPitchCurve: sourcePattern.rawPitchCurve ? [...sourcePattern.rawPitchCurve] : [],
    pitchCurve: sourcePattern.pitchCurve ? [...sourcePattern.pitchCurve] : [],
    anacrusisSteps: sourcePattern.anacrusisSteps ? [...sourcePattern.anacrusisSteps] : [],
    mainSteps: sourcePattern.mainSteps ? [...sourcePattern.mainSteps] : [],
  };
}

export function propagateSourceUpdatesToLinkedPatterns(
  patterns: VocalPatternItem[],
  updatedSourceId: string
): VocalPatternItem[] {
  const source = patterns.find((p) => p.id === updatedSourceId);
  if (!source) return patterns;

  return patterns.map((pat) => {
    if (pat.linkedSourcePatternId !== updatedSourceId) return pat;
    return {
      ...pat,
      variants: source.variants,
      recordingResult: source.recordingResult,
      rawAudioSamples: source.rawAudioSamples,
      correctedAudioSamples: source.correctedAudioSamples,
      rawPitchCurve: source.rawPitchCurve,
      pitchCurve: source.pitchCurve,
      anacrusisSteps: source.anacrusisSteps,
      mainSteps: source.mainSteps,
      measuresCount: source.measuresCount,
      baseBpm: source.baseBpm,
      referencePitch: source.referencePitch,
      pitchCorrectionAmount: source.pitchCorrectionAmount,
      trimStartSec: source.trimStartSec,
      trimEndSec: source.trimEndSec,
      lowCutEnabled: source.lowCutEnabled,
      pack: source.pack,
      midiLocked: source.midiLocked,
      activeVariantKey: source.activeVariantKey,
    };
  });
}

export function unlinkPattern(pattern: VocalPatternItem): VocalPatternItem {
  return { ...pattern, linkedSourcePatternId: null };
}
