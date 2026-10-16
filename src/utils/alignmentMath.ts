/**
 * alignmentMath.ts
 * Calcul déterministe de l'anacrouse et des offsets d'alignement pour Sequenciador.
 */
import type { TimeSignatureString, VocalAnacrusisData } from '../types/vocalPack.types';

export interface AlignmentResult {
  startOffsetSec: number;
  anacrusis: VocalAnacrusisData;
  cleanDurationSec: number;
}

export function getDefaultBeatResolutions(sig: TimeSignatureString): number[] {
  switch (sig) {
    case '2/4': return [4, 4];
    case '3/4': return [4, 4, 4];
    case '6/8': return [3, 3];
    case '12/8': return [3, 3, 3, 3];
    case '4/4':
    default:
      return [4, 4, 4, 4];
  }
}

/**
 * Calcule l'anacrouse et le décalage signé par rapport à la Ligne Rouge du Temps 1.
 */
export function computeAlignmentMeta(
  temps1Sec: number,
  trimStartSec: number,
  trimEndSec: number,
  bpm: number,
  hasAnacrusis = true
): AlignmentResult {
  const cleanDurationSec = Math.max(0, trimEndSec - trimStartSec);
  const startOffsetSec = trimStartSec - temps1Sec;
  const beatDuration = 60 / bpm;

  if (hasAnacrusis && trimStartSec < temps1Sec) {
    const durationSec = temps1Sec - trimStartSec;
    const beats = durationSec / beatDuration;
    const preRollSteps = Math.round(beats * 4);

    return {
      startOffsetSec,
      cleanDurationSec,
      anacrusis: {
        hasAnacrusis: true,
        durationSec,
        beats,
        startOffsetSec,
        preRollSteps,
      },
    };
  }

  return {
    startOffsetSec: hasAnacrusis ? startOffsetSec : 0,
    cleanDurationSec,
    anacrusis: {
      hasAnacrusis: false,
      durationSec: 0,
      beats: 0,
      startOffsetSec: 0,
      preRollSteps: 0,
    },
  };
}
