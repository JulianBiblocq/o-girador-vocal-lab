/**
 * patternTakeHydrator.ts
 * Décodage local d'un fichier `.wav` Cloud vers `recordingResult.pcm` + extraction syllabique/mélodique non destructive
 * (AudioContext temporaire fermé immédiatement après décodage) + export JSON de sauvegarde locale (< 110 lignes).
 */
import { type ToadaProject, type VocalPatternItem, createDefaultVariant } from '../types/toadaProject.types';
import type { RecoveryTake } from './takeRecoveryTypes';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { getPatternT1OffsetSec } from './anacrusisTimingHelper';
import { autoSnapT1ToVocalOnset } from '../audio/vocalOnsetDetector';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { propagateSourceUpdatesToLinkedPatterns } from './patternMirrorHelper';

export async function decodeRemoteWavToMonoPcm(url: string): Promise<{ pcm: Float32Array; sampleRate: number; durationSec: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const buf = await ctx.decodeAudioData(arrayBuffer);
    const len = buf.length, ch0 = buf.getChannelData(0);
    if (buf.numberOfChannels === 1) return { pcm: new Float32Array(ch0), sampleRate: buf.sampleRate, durationSec: buf.duration };
    const ch1 = buf.getChannelData(1), mono = new Float32Array(len);
    for (let i = 0; i < len; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
    return { pcm: mono, sampleRate: buf.sampleRate, durationSec: buf.duration };
  } finally {
    try { await ctx.close(); } catch { /* déjà fermé */ }
  }
}

export async function hydratePatternWithRecoveryTake(
  project: ToadaProject,
  pattern: VocalPatternItem,
  take: RecoveryTake
): Promise<VocalPatternItem> {
  if (!take.url) throw new Error('URL audio manquante');
  const { pcm, sampleRate, durationSec } = await decodeRemoteWavToMonoPcm(take.url);
  const bpm = Math.max(30, Number(take.recordedBpm || pattern.bpm || pattern.baseBpm || project.bpm || 88));
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const hasAnacrusis = pattern.hasAnacrusis !== false;
  const measureDuration = beatsPerMeasure * (60 / bpm);

  let t1OffsetSec: number;
  if (take.source === 'pack' && take.t1OffsetSec !== undefined) {
    t1OffsetSec = Math.abs(take.t1OffsetSec) < 0.01 ? 0 : take.t1OffsetSec;
  } else {
    t1OffsetSec = autoSnapT1ToVocalOnset({
      pcm, sampleRate, bpm, timeAnchors: pattern.timeAnchors, hasAnacrusis, beatsPerMeasure,
      expectedT1Sec: getPatternT1OffsetSec(hasAnacrusis, measureDuration),
    });
  }

  const trimStartSec = 0, trimEndSec = durationSec;
  const beatResolutions = pattern.pack?.metadata.beatResolutions || getDefaultBeatResolutions(project.timeSignature);
  const melodic = extractPatternMelodicData({
    rawPCM: pcm, sampleRate, bpm, timeSignature: project.timeSignature, measuresCount: pattern.measuresCount,
    beatsPerMeasure, beatResolutions, hasAnacrusis, trimStartSec, trimEndSec, t1OffsetSec,
    referencePitch: pattern.referencePitch || 'C4', tessitura: pattern.tessitura,
    assignedLyricsText: pattern.assignedLyricsText, timeAnchors: pattern.timeAnchors,
    lowCutEnabled: pattern.lowCutEnabled !== false, enableTonePolish: pattern.enableTonePolish !== false,
    referenceMidiNotes: pattern.referenceMidiNotes,
  });

  const rec = { pcm, sampleRate, recordedBpm: bpm, t1OffsetSec };
  const activeKey = pattern.activeVariantKey || 'norm_norm';
  const baseVar = pattern.variants?.[activeKey] ?? createDefaultVariant(1.0, 0);
  const nextVar = { ...baseVar, recordingResult: rec, trimStartSec, trimEndSec, t1OffsetSec };

  return {
    ...pattern,
    recordingResult: rec,
    variants: { ...(pattern.variants || {}), [activeKey]: nextVar },
    activeVariantKey: activeKey,
    trimStartSec, trimEndSec, t1OffsetSec,
    rawAudioSamples: melodic.cleanPCM,
    correctedAudioSamples: null,
    melodyneRegions: [],
    pack: melodic.pack,
    rawPitchCurve: melodic.pitchCurve,
    pitchCurve: melodic.pitchCurve,
    anacrusisSteps: melodic.anacrusisSteps,
    mainSteps: melodic.mainSteps,
    isMidiInitialized: true,
    hasCanonicalAlignment: true,
    stepStatus: { ...(pattern.stepStatus || {}), recorded: true, trimmed: true },
    audioUrl: take.url,
  } as VocalPatternItem;
}

export function applyHydratedPatternsToProject(project: ToadaProject, hydrated: Map<string, VocalPatternItem>): ToadaProject {
  let patterns = project.patterns.map((p) => hydrated.get(p.id) ?? p);
  for (const id of hydrated.keys()) patterns = propagateSourceUpdatesToLinkedPatterns(patterns, id);
  return { ...project, patterns };
}

export function exportProjectBackupJson(project: ToadaProject): void {
  const safe = {
    exportedAt: new Date().toISOString(),
    id: project.id, title: project.title, bpm: project.bpm, timeSignature: project.timeSignature,
    toadaMeta: project.toadaMeta, slots: project.slots,
    patterns: project.patterns.map(({ rawAudioSamples: _r, correctedAudioSamples: _c, troupeTransposedPCM: _t, recordingResult, variants: _v, ...rest }) => ({
      ...rest, pcmSamplesCount: recordingResult?.pcm?.length ?? 0, sampleRate: recordingResult?.sampleRate,
    })),
  };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cantador-backup-${(project.title || 'toada').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
