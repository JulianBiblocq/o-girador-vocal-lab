/**
 * toadaProject.types.ts
 * Modèle de données de la Toada complète :
 * Bibliothèque de Patterns nommables (Puxador / Coro) & Frise Conducteur.
 */
import type { TimeSignatureString, VocalStepData, PitchCurvePoint, VocalPackExport } from './vocalPack.types';

export type VocalRole = 'puxador' | 'coro';

export interface VocalPatternItem {
  id: string;
  name: string;
  role: VocalRole;
  measuresCount: 1 | 2 | 3 | 4;
  recordingResult: {
    pcm: Float32Array;
    sampleRate: number;
  } | null;
  trimStartSec: number;
  trimEndSec: number;
  lowCutEnabled: boolean;
  anacrusisSteps: VocalStepData[];
  mainSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  pack?: VocalPackExport | null;
}

export interface ToadaArrangementSlot {
  slotId: string;
  puxadorPatternId: string | null;
  coroPatternId: string | null;
}

export interface ToadaProject {
  id: string;
  title: string;
  bpm: number;
  timeSignature: TimeSignatureString;
  patterns: VocalPatternItem[];
  slots: ToadaArrangementSlot[];
  activePatternId: string;
}

export function createDefaultVocalPattern(
  role: VocalRole = 'puxador',
  name = 'Appel 1',
  measuresCount: 1 | 2 | 3 | 4 = 2
): VocalPatternItem {
  return {
    id: `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    role,
    measuresCount,
    recordingResult: null,
    trimStartSec: 0,
    trimEndSec: 0,
    lowCutEnabled: true,
    anacrusisSteps: [],
    mainSteps: [],
    pitchCurve: [],
    pack: null,
  };
}

export function createDefaultToadaProject(): ToadaProject {
  const p1 = createDefaultVocalPattern('puxador', 'Appel 1', 2);
  const p2 = createDefaultVocalPattern('coro', 'Réponse Chœur', 2);
  return {
    id: 'toada-default',
    title: 'Toada Sem Título',
    bpm: 100,
    timeSignature: '4/4',
    patterns: [p1, p2],
    slots: [
      { slotId: 'slot-1', puxadorPatternId: p1.id, coroPatternId: null },
      { slotId: 'slot-2', puxadorPatternId: null, coroPatternId: p2.id },
    ],
    activePatternId: p1.id,
  };
}
