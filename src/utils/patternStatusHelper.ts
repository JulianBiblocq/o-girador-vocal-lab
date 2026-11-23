/**
 * patternStatusHelper.ts
 * Fonctions pures de résolution de source audio PCM et d'état Audio / MIDI / Calage d'un pattern (< 55 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';

export function resolvePatternAudioSource(
  pat: VocalPatternItem,
  fallbackSampleRate = 44100
): { pcm: Float32Array | null; sampleRate: number } {
  const activeV = pat.variants?.[pat.activeVariantKey];
  if (activeV?.recordingResult?.pcm?.length) {
    return { pcm: activeV.recordingResult.pcm, sampleRate: activeV.recordingResult.sampleRate || fallbackSampleRate };
  }
  if (pat.recordingResult?.pcm?.length) {
    return { pcm: pat.recordingResult.pcm, sampleRate: pat.recordingResult.sampleRate || fallbackSampleRate };
  }
  if (pat.rawAudioSamples?.length) {
    return { pcm: pat.rawAudioSamples, sampleRate: pat.pack?.audio?.sampleRate || fallbackSampleRate };
  }
  const anyVar = Object.values(pat.variants || {}).find((v) => v?.recordingResult?.pcm?.length);
  if (anyVar?.recordingResult?.pcm?.length) {
    return { pcm: anyVar.recordingResult.pcm, sampleRate: anyVar.recordingResult.sampleRate || fallbackSampleRate };
  }
  return { pcm: null, sampleRate: fallbackSampleRate };
}

export function checkPatternHasAudio(pat: VocalPatternItem): boolean {
  return Boolean(resolvePatternAudioSource(pat).pcm?.length || (pat as { audioUrl?: string }).audioUrl);
}

export function checkPatternHasMidi(pat: VocalPatternItem): boolean {
  return Boolean(
    pat.pack &&
    ((pat.mainSteps?.some((s) => s.active && (s.midiNumber ?? 0) > 0)) ||
      (pat.anacrusisSteps?.some((s) => s.active && (s.midiNumber ?? 0) > 0)))
  );
}

export function checkPatternIsAligned(pat: VocalPatternItem): boolean {
  return Boolean(
    checkPatternHasAudio(pat) ||
    checkPatternHasMidi(pat) ||
    pat.mainSteps?.some((s) => s.active) ||
    pat.anacrusisSteps?.some((s) => s.active)
  );
}
