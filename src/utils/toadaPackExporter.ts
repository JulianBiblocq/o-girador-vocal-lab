/**
 * toadaPackExporter.ts
 * Export JSON de la Toada complète :
 * Fichier audio .wav maître unique par pattern (PCM 16-bit Mono à recordedBpm et en troupeKey, zéro speedVariants 75%/88%) (< 130 lignes).
 */
import type { ToadaProject, ToadaArrangementSlot, VocalRole, VocalAudioVariantCoverage, SequenciadorExportMode, VocalPatternItem } from '../types/toadaProject.types';
import { DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import type { VocalPackExport, VocalStepData, PitchCurvePoint, MelodyneRegion } from '../types/vocalPack.types';
import type { ToadaDocument } from '../types/toadaDocument.types';
import { audioBufferToWavBase64 } from './wavEncoder';
import { getBeatsPerMeasure } from './musicalMath';
import { getPatternT1OffsetSec } from './anacrusisTimingHelper';
import { resolveProjectDualScale, transposeVocalSteps } from './scaleTranspositionHelper';
import { getOrComputeTroupeTransposedPCM } from '../audio/formantPreservingPitchShifter';
import { slicePatternPcm } from '../services/toadaPublishHelpers';

export function isPatternReadyForSequenciador(p: VocalPatternItem): boolean {
  const hasRec = Boolean(
    p.rawAudioSamples?.length || p.recordingResult?.pcm?.length || (p as any).audioUrl ||
    Object.values(p.variants || {}).some((v) => Boolean(v?.recordingResult?.pcm?.length || (v as any)?.audioUrl))
  );
  return hasRec || Boolean(p.anacrusisSteps?.some((s) => s.active) || p.mainSteps?.some((s) => s.active));
}

export interface ExportedVariantData {
  variantKey: string; speedRatio: number; pitchShiftSemitones: number; coverage: VocalAudioVariantCoverage;
  audioBase64?: string; durationSec: number; sampleRate: number;
  trimStartSec?: number; trimEndSec?: number; t1OffsetSec?: number; recordedBpm?: number;
  lowCutEnabled?: boolean; enableTonePolish?: boolean;
}

export interface ExportedPatternData {
  id: string; cardIndex?: number; rawLineCode?: string; name: string; role: VocalRole;
  isReady: boolean; ignoreMelodyPitch?: boolean;
  measuresCount: number; hasAnacrusis?: boolean; hasTailBeat?: boolean; anacrusisBeats?: number;
  baseBpm?: number; recordedBpm: number; sungKey: string; troupeKey: string; transpositionSemitones: number;
  t1OffsetSec: number; trimStartSec: number; trimEndSec: number;
  audioBase64?: string; audioUrl?: string; sampleRate?: number;
  referencePitch?: string; pitchCorrectionAmount?: number; linkedSourcePatternId?: string | null;
  activeVariantKey?: string; anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[];
  pitchCurve?: PitchCurvePoint[]; melodyneRegions?: MelodyneRegion[]; assignedLyricsText?: string;
  assignedPhoneticText?: string; timeAnchors?: import('../types/toadaDocument.types').TimeAnchor[];
  harmonyGrid?: import('../types/harmony.types').PatternHarmonyGrid;
  variants: Record<string, ExportedVariantData>;
}

export interface ToadaPackExport {
  schemaVersion: '2.0';
  sequenciadorExportMode: SequenciadorExportMode; ignoreMelodyPitch: boolean;
  sungKey: string; troupeKey: string; transpositionSemitones: number;
  project: {
    id: string; title: string; bpm: number; timeSignature: string; createdAt: string;
    sequenciadorExportMode: SequenciadorExportMode; ignoreMelodyPitch: boolean;
    sungKey: string; troupeKey: string; transpositionSemitones: number; toadaMeta?: Partial<ToadaDocument>;
  };
  arrangementSlots: ToadaArrangementSlot[]; patterns: ExportedPatternData[];
  harmonyConfig?: import('../types/harmony.types').HarmonyConfig;
  globalHarmonyGrid?: import('../types/harmony.types').PatternHarmonyGrid;
  currentPatternPack?: VocalPackExport | null;
}

export function buildToadaPack(project: ToadaProject, currentPack?: VocalPackExport | null): ToadaPackExport {
  const sequenciadorExportMode: SequenciadorExportMode = project.sequenciadorExportMode ?? 'rhythm_only';
  const ignoreMelodyPitch = sequenciadorExportMode === 'rhythm_only';
  const projectBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const dualScale = resolveProjectDualScale(project, 'fr'), shiftSt = dualScale.transpositionSemitones;

  const patterns: ExportedPatternData[] = project.patterns.map((p) => {
    const isReady = isPatternReadyForSequenciador(p);
    const masterVar = p.variants?.norm_norm || p.variants?.[p.activeVariantKey];
    const rec = p.recordingResult ?? masterVar?.recordingResult;
    const recordedBpm = Number(rec?.recordedBpm || p.baseBpm || p.bpm || projectBpm);
    const measureDurationSec = beatsPerMeasure * (60 / recordedBpm);
    const sr = rec?.sampleRate || p.pack?.audio?.sampleRate || 44100;
    const useCorr = Boolean(p.correctedAudioSamples && p.correctedAudioSamples.length > 0);
    const fullPcm = useCorr ? p.correctedAudioSamples : (rec?.pcm ?? p.rawAudioSamples);
    const explicitT1 = p.t1OffsetSec ?? masterVar?.t1OffsetSec ?? rec?.t1OffsetSec;
    const rawT1 = useCorr ? getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec) : getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec, explicitT1);
    const rawTrimStart = useCorr ? (p.pack?.audio?.trim?.startSec ?? 0) : (p.trimStartSec ?? masterVar?.trimStartSec ?? 0);
    const rawEnd = useCorr ? (p.pack?.audio?.trim?.endSec ?? 0) : (p.trimEndSec || masterVar?.trimEndSec || 0);
    const rawTrimEnd = rawEnd > 0 ? rawEnd : (fullPcm ? fullPcm.length / sr : 0);

    let b64: string | undefined, trimStartSec = p.trimStartSec ?? 0, trimEndSec = p.trimEndSec ?? 0, t1OffsetSec = p.t1OffsetSec ?? rawT1;
    if (fullPcm && fullPcm.length > 0) {
      const sliced = slicePatternPcm(fullPcm, sr, rawT1, rawTrimStart, rawTrimEnd);
      const troupePcm = shiftSt !== 0 ? getOrComputeTroupeTransposedPCM(sliced.slicedPcm, sr, shiftSt) : sliced.slicedPcm;
      b64 = audioBufferToWavBase64(troupePcm, sr);
      trimStartSec = 0; trimEndSec = sliced.slicedDurationSec; t1OffsetSec = sliced.exportedT1OffsetSec;
    }

    const hasAnac = p.hasAnacrusis !== false, hasTailBeat = Boolean(p.hasTailBeat || p.exitBeat === 1);
    const anacCount = 16, expectedMain = (p.measuresCount || 2) * 16;
    let anacSteps = hasAnac ? (p.anacrusisSteps || []) : [], mainSteps = p.mainSteps || [];
    if (hasAnac && mainSteps.length === anacCount + expectedMain && anacSteps.length === 0) {
      anacSteps = mainSteps.slice(0, anacCount); mainSteps = mainSteps.slice(anacCount);
    }
    const mapStep = (s: VocalStepData, idx: number): VocalStepData => ({
      ...s, stepIndex: idx, ...(s.note === '───' || Boolean((s as any).isTie) ? { isTie: true } : {}),
    });
    const coverage = masterVar?.coverage || { minSpeedRatio: 0.5, maxSpeedRatio: 1.5, minPitchSemitones: -12, maxPitchSemitones: 12 };

    return {
      id: p.id, cardIndex: p.cardIndex, rawLineCode: p.rawLineCode, name: p.name, role: p.role, isReady, ignoreMelodyPitch,
      measuresCount: p.measuresCount, hasAnacrusis: hasAnac, hasTailBeat, anacrusisBeats: p.anacrusisBeats,
      baseBpm: recordedBpm, recordedBpm, sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt,
      t1OffsetSec, trimStartSec, trimEndSec, audioBase64: b64, audioUrl: (p as any).audioUrl, sampleRate: sr,
      referencePitch: p.referencePitch, pitchCorrectionAmount: p.pitchCorrectionAmount,
      linkedSourcePatternId: p.linkedSourcePatternId, activeVariantKey: 'norm_norm',
      anacrusisSteps: transposeVocalSteps(anacSteps.map(mapStep), shiftSt), mainSteps: transposeVocalSteps(mainSteps.map(mapStep), shiftSt),
      pitchCurve: p.pitchCurve, melodyneRegions: p.melodyneRegions || [],
      assignedLyricsText: p.assignedLyricsText, assignedPhoneticText: p.assignedPhoneticText,
      timeAnchors: p.timeAnchors, harmonyGrid: p.harmonyGrid,
      variants: {
        norm_norm: {
          variantKey: 'norm_norm', speedRatio: 1.0, pitchShiftSemitones: 0, coverage,
          audioBase64: b64, durationSec: trimEndSec, sampleRate: sr, trimStartSec, trimEndSec, t1OffsetSec, recordedBpm,
          lowCutEnabled: masterVar?.lowCutEnabled, enableTonePolish: masterVar?.enableTonePolish ?? true,
        },
      },
    };
  });

  return {
    schemaVersion: '2.0', sequenciadorExportMode, ignoreMelodyPitch,
    sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt,
    project: {
      id: project.id, title: project.title, bpm: projectBpm, timeSignature: project.timeSignature, createdAt: new Date().toISOString(),
      sequenciadorExportMode, ignoreMelodyPitch, sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt, toadaMeta: project.toadaMeta,
    },
    arrangementSlots: project.slots, patterns, harmonyConfig: project.harmonyConfig, globalHarmonyGrid: project.globalHarmonyGrid, currentPatternPack: currentPack ?? null,
  };
}

export function downloadToadaPackJson(project: ToadaProject, currentPack?: VocalPackExport | null): void {
  const pack = buildToadaPack(project, currentPack);
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `toadaPack_${project.title.toLowerCase().replace(/\s+/g, '_')}_${project.bpm}bpm.json`;
  a.click(); URL.revokeObjectURL(url);
}
