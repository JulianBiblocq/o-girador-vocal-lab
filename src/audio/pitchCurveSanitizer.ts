/**
 * pitchCurveSanitizer.ts
 * Post-traitement acoustique avec élimination des stalactites d'octave
 * dues aux chocs de marche (fenêtre glissante 700 ms, repliement et lissage) (< 135 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface RawPitchPoint extends PitchCurvePoint {
  aperiodicity?: number;
  rms?: number;
  zcr?: number;
}

export function sanitizePitchCurve(raw: RawPitchPoint[]): PitchCurvePoint[] {
  if (raw.length === 0) return [];

  // 1. Porte Voiced / Unvoiced stricte
  const gated = raw.filter((p) => {
    if (p.aperiodicity !== undefined && p.aperiodicity > 0.14) return false;
    if (p.rms !== undefined && p.rms < 0.010) return false;
    if (p.zcr !== undefined && p.zcr > 0.35) return false;
    return p.midiFloat >= 36 && p.midiFloat <= 88;
  });
  if (gated.length < 5) return gated.map(({ timeSec, midiFloat }) => ({ timeSec, midiFloat }));

  // 2. Centre vocal global robuste (Percentile 70)
  const sortedMidis = [...gated.map((p) => p.midiFloat)].sort((a, b) => a - b);
  const globalRefPitch = sortedMidis[Math.floor(sortedMidis.length * 0.70)];

  // 3. Élimination des « Stalactites » d'Octave (fenêtre 700 ms avec filtrage des aberrances)
  const halfWinSec = 0.35;
  const foldbacked = gated.map((pt, i, arr) => {
    const tMin = pt.timeSec - halfWinSec, tMax = pt.timeSec + halfWinSec;
    const stableNeighbors: number[] = [];
    for (let j = Math.max(0, i - 35); j <= Math.min(arr.length - 1, i + 35); j++) {
      const neighbor = arr[j];
      if (neighbor.timeSec >= tMin && neighbor.timeSec <= tMax) {
        if (Math.abs(neighbor.midiFloat - globalRefPitch) <= 8.0) stableNeighbors.push(neighbor.midiFloat);
      }
    }

    if (stableNeighbors.length < 3) return pt;
    stableNeighbors.sort((a, b) => a - b);
    const localMed = stableNeighbors[Math.floor(stableNeighbors.length / 2)];
    const diff = localMed - pt.midiFloat;
    let newMidi = pt.midiFloat;

    // Décrochage de sous-harmonique (puits de -1 octave dû à un pas de marche)
    if (diff >= 8.5 && diff <= 15.5) {
      newMidi = pt.midiFloat + 12.0;
      if (Math.abs(newMidi - localMed) > 1.5) {
        let prevStable = localMed, nextStable = localMed;
        for (let b = i - 1; b >= Math.max(0, i - 10); b--) {
          if (Math.abs(arr[b].midiFloat - localMed) <= 2.5) { prevStable = arr[b].midiFloat; break; }
        }
        for (let a = i + 1; a <= Math.min(arr.length - 1, i + 10); a++) {
          if (Math.abs(arr[a].midiFloat - localMed) <= 2.5) { nextStable = arr[a].midiFloat; break; }
        }
        newMidi = (prevStable + nextStable) / 2;
      }
    }
    // Décrochage d'harmonique haute (+1 octave)
    else if (diff <= -8.5 && diff >= -15.5) {
      newMidi = pt.midiFloat - 12.0;
      if (Math.abs(newMidi - localMed) > 1.5) newMidi = localMed;
    }

    return { ...pt, midiFloat: newMidi };
  });

  // 4. Suppression des pics isolés (< 60 ms et écart > 3.0 demi-tons)
  const despiked = foldbacked.map((pt, i, arr) => {
    if (i === 0 || i === arr.length - 1) return pt;
    const prev = arr[i - 1], next = arr[i + 1];
    if (Math.abs(pt.timeSec - prev.timeSec) <= 0.06 && Math.abs(next.timeSec - pt.timeSec) <= 0.06) {
      if (Math.abs(pt.midiFloat - prev.midiFloat) > 3.0 && Math.abs(pt.midiFloat - next.midiFloat) > 3.0 && Math.abs(prev.midiFloat - next.midiFloat) < 2.0) {
        return { ...pt, midiFloat: (prev.midiFloat + next.midiFloat) / 2 };
      }
    }
    return pt;
  });

  // 5. Filtre médian sur 5 points
  const med = despiked.map((pt, i, arr) => {
    if (i < 2 || i >= arr.length - 2) return pt;
    if (Math.abs(arr[i + 2].timeSec - arr[i - 2].timeSec) > 0.08) return pt;
    const sorted = [arr[i - 2].midiFloat, arr[i - 1].midiFloat, pt.midiFloat, arr[i + 1].midiFloat, arr[i + 2].midiFloat].sort((a, b) => a - b);
    return { ...pt, midiFloat: sorted[2] };
  });

  // 6. Lissage Gaussien doux (5 points)
  const weights = [0.06, 0.24, 0.40, 0.24, 0.06];
  return med.map((pt, i, arr) => {
    if (i < 2 || i >= arr.length - 2 || Math.abs(arr[i + 2].timeSec - arr[i - 2].timeSec) > 0.08) {
      return { timeSec: pt.timeSec, midiFloat: Math.round(pt.midiFloat * 100) / 100 };
    }
    let sum = 0;
    for (let k = -2; k <= 2; k++) sum += arr[i + k].midiFloat * weights[k + 2];
    return { timeSec: pt.timeSec, midiFloat: Math.round(sum * 100) / 100 };
  });
}
