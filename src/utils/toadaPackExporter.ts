/**
 * toadaPackExporter.ts
 * Export JSON de la Toada complete :
 * Multi-patterns, matrice de declinaisons WAV Base64 avec plages de couverture et frise conducteur.
 */
import type { ToadaProject, ToadaArrangementSlot, VocalRole, VocalAudioVariantCoverage } from '../types/toadaProject.types';
import type { VocalPackExport, VocalStepData } from '../types/vocalPack.types';
import { audioBufferToWavBase64 } from './wavEncoder';

export interface ExportedVariantData {
  variantKey: string;
  speedRatio: number;
  pitchShiftSemitones: number;
  coverage: VocalAudioVariantCoverage;
  audioBase64?: string;
  durationSec: number;
  sampleRate: number;
}

export interface ExportedPatternData {
  id: string;
  name: string;
  role: VocalRole;
  measuresCount: number;
  anacrusisSteps: VocalStepData[];
  mainSteps: VocalStepData[];
  variants: Record<string, ExportedVariantData>;
}

export interface ToadaPackExport {
  schemaVersion: '2.0';
  project: {
    id: string;
    title: string;
    bpm: number;
    timeSignature: string;
    createdAt: string;
  };
  arrangementSlots: ToadaArrangementSlot[];
  patterns: ExportedPatternData[];
  currentPatternPack?: VocalPackExport | null;
}

export function buildToadaPack(project: ToadaProject, currentPack?: VocalPackExport | null): ToadaPackExport {
  const patterns: ExportedPatternData[] = project.patterns.map((p) => {
    const exportedVariants: Record<string, ExportedVariantData> = {};
    for (const [key, v] of Object.entries(p.variants)) {
      let b64: string | undefined;
      let dur = 0;
      const sr = v.recordingResult?.sampleRate ?? 44100;
      if (v.recordingResult?.pcm && v.recordingResult.pcm.length > 0) {
        b64 = audioBufferToWavBase64(v.recordingResult.pcm, sr);
        dur = v.recordingResult.pcm.length / sr;
      }
      exportedVariants[key] = {
        variantKey: v.variantKey,
        speedRatio: v.speedRatio,
        pitchShiftSemitones: v.pitchShiftSemitones,
        coverage: v.coverage,
        audioBase64: b64,
        durationSec: dur,
        sampleRate: sr,
      };
    }
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      measuresCount: p.measuresCount,
      anacrusisSteps: p.anacrusisSteps,
      mainSteps: p.mainSteps,
      variants: exportedVariants,
    };
  });

  return {
    schemaVersion: '2.0',
    project: {
      id: project.id,
      title: project.title,
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      createdAt: new Date().toISOString(),
    },
    arrangementSlots: project.slots,
    patterns,
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
