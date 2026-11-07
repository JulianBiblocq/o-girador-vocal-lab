/**
 * toadaPackExporter.ts
 * Export JSON de la Toada complete :
 * Multi-patterns, matrice de declinaisons WAV Base64 avec plages de couverture et frise conducteur.
 */
import type { ToadaProject, ToadaArrangementSlot, VocalRole, VocalAudioVariantCoverage, SequenciadorExportMode, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalPackExport, VocalStepData, PitchCurvePoint, MelodyneRegion } from '../types/vocalPack.types';
import type { ToadaDocument } from '../types/toadaDocument.types';
import { audioBufferToWavBase64 } from './wavEncoder';

export function isPatternReadyForSequenciador(p: VocalPatternItem): boolean {
  const hasRec = Boolean(
    p.rawAudioSamples?.length ||
    p.recordingResult?.pcm?.length ||
    (p as any).audioUrl ||
    Object.values(p.variants || {}).some((v) => Boolean(v?.recordingResult?.pcm?.length || (v as any)?.audioUrl))
  );
  const hasActiveSteps = Boolean(
    p.anacrusisSteps?.some((s) => s.active) || p.mainSteps?.some((s) => s.active)
  );
  return hasRec || hasActiveSteps;
}

export interface ExportedVariantData {
  variantKey: string;
  speedRatio: number;
  pitchShiftSemitones: number;
  coverage: VocalAudioVariantCoverage;
  audioBase64?: string;
  durationSec: number;
  sampleRate: number;
  trimStartSec?: number;
  trimEndSec?: number;
  t1OffsetSec?: number;
  recordedBpm?: number;
  lowCutEnabled?: boolean;
  enableTonePolish?: boolean;
}

export interface ExportedPatternData {
  id: string; cardIndex?: number; rawLineCode?: string; name: string; role: VocalRole;
  isReady: boolean; ignoreMelodyPitch?: boolean;
  measuresCount: number; hasAnacrusis?: boolean; anacrusisBeats?: number; baseBpm?: number;
  referencePitch?: string; pitchCorrectionAmount?: number; linkedSourcePatternId?: string | null;
  activeVariantKey?: string; anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[];
  pitchCurve?: PitchCurvePoint[]; melodyneRegions?: MelodyneRegion[]; assignedLyricsText?: string;
  assignedPhoneticText?: string; timeAnchors?: import('../types/toadaDocument.types').TimeAnchor[];
  harmonyGrid?: import('../types/harmony.types').PatternHarmonyGrid;
  variants: Record<string, ExportedVariantData>;
}

export interface ToadaPackExport {
  schemaVersion: '2.0';
  sequenciadorExportMode: SequenciadorExportMode;
  ignoreMelodyPitch: boolean;
  project: {
    id: string; title: string; bpm: number; timeSignature: string; createdAt: string;
    sequenciadorExportMode: SequenciadorExportMode; ignoreMelodyPitch: boolean;
    toadaMeta?: Partial<ToadaDocument>;
  };
  arrangementSlots: ToadaArrangementSlot[];
  patterns: ExportedPatternData[];
  harmonyConfig?: import('../types/harmony.types').HarmonyConfig;
  globalHarmonyGrid?: import('../types/harmony.types').PatternHarmonyGrid;
  currentPatternPack?: VocalPackExport | null;
}

export function buildToadaPack(project: ToadaProject, currentPack?: VocalPackExport | null): ToadaPackExport {
  const sequenciadorExportMode: SequenciadorExportMode = project.sequenciadorExportMode ?? 'rhythm_only';
  const ignoreMelodyPitch = sequenciadorExportMode === 'rhythm_only';

  const patterns: ExportedPatternData[] = project.patterns.map((p) => {
    const isReady = isPatternReadyForSequenciador(p);
    const exportedVariants: Record<string, ExportedVariantData> = {};
    for (const [key, v] of Object.entries(p.variants || {})) {
      let b64: string | undefined;
      let dur = 0;
      const sr = v.recordingResult?.sampleRate ?? 44100;
      const pcmToExport = (key === p.activeVariantKey && p.correctedAudioSamples && (p.pitchCorrectionAmount ?? 0) > 0)
        ? p.correctedAudioSamples
        : v.recordingResult?.pcm;
      if (pcmToExport && pcmToExport.length > 0) {
        b64 = audioBufferToWavBase64(pcmToExport, sr);
        dur = pcmToExport.length / sr;
      }
      exportedVariants[key] = {
        variantKey: v.variantKey, speedRatio: v.speedRatio, pitchShiftSemitones: v.pitchShiftSemitones,
        coverage: v.coverage, audioBase64: b64, durationSec: dur, sampleRate: sr,
        trimStartSec: v.trimStartSec, trimEndSec: v.trimEndSec, t1OffsetSec: v.t1OffsetSec ?? p.t1OffsetSec,
        recordedBpm: v.recordingResult?.recordedBpm || p.bpm || project.bpm, lowCutEnabled: v.lowCutEnabled, enableTonePolish: v.enableTonePolish ?? true,
      };
    }
    const hasAnac = p.hasAnacrusis ?? true;
    const anacCount = 16, expectedMain = (p.measuresCount || 2) * 16;
    let anacSteps = hasAnac ? (p.anacrusisSteps || []) : [];
    let mainSteps = p.mainSteps || [];
    if (hasAnac && mainSteps.length === anacCount + expectedMain && anacSteps.length === 0) {
      anacSteps = mainSteps.slice(0, anacCount); mainSteps = mainSteps.slice(anacCount);
    }
    const mapStep = (s: VocalStepData, idx: number): VocalStepData => ({
      ...s, stepIndex: idx, ...(s.note === '───' || Boolean((s as any).isTie) ? { isTie: true } : {}),
    });
    return {
      id: p.id, cardIndex: p.cardIndex, rawLineCode: p.rawLineCode,
      name: p.name, role: p.role, isReady, ignoreMelodyPitch, measuresCount: p.measuresCount,
      hasAnacrusis: hasAnac, anacrusisBeats: p.anacrusisBeats,
      baseBpm: p.baseBpm, referencePitch: p.referencePitch, pitchCorrectionAmount: p.pitchCorrectionAmount,
      linkedSourcePatternId: p.linkedSourcePatternId, activeVariantKey: p.activeVariantKey,
      anacrusisSteps: anacSteps.map(mapStep), mainSteps: mainSteps.map(mapStep), pitchCurve: p.pitchCurve,
      melodyneRegions: p.melodyneRegions || [], assignedLyricsText: p.assignedLyricsText,
      assignedPhoneticText: p.assignedPhoneticText, timeAnchors: p.timeAnchors,
      harmonyGrid: p.harmonyGrid, variants: exportedVariants,
    };
  });

  return {
    schemaVersion: '2.0',
    sequenciadorExportMode,
    ignoreMelodyPitch,
    project: {
      id: project.id, title: project.title, bpm: project.bpm, timeSignature: project.timeSignature,
      createdAt: new Date().toISOString(), sequenciadorExportMode, ignoreMelodyPitch, toadaMeta: project.toadaMeta,
    },
    arrangementSlots: project.slots,
    patterns,
    harmonyConfig: project.harmonyConfig,
    globalHarmonyGrid: project.globalHarmonyGrid,
    currentPatternPack: currentPack ?? null,
  };
}

export function downloadToadaPackJson(project: ToadaProject, currentPack?: VocalPackExport | null): void {
  const pack = buildToadaPack(project, currentPack);
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `toadaPack_${project.title.toLowerCase().replace(/\s+/g, '_')}_${project.bpm}bpm.json`;
  a.click();
  URL.revokeObjectURL(url);
}
