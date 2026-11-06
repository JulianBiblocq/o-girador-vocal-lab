/**
 * maracatuSubBeatAligner.ts
 * Moteur DSP de placement sub-temps Maracatu (s ∈ {0, 1, 2, 3}), enveloppe d'attaque vocalique
 * (250 Hz – 3200 Hz), prieurs rythmiques Maracatu et fusion des syllabes élidées (< 125 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface SubBeatOnsetProfile {
  energies: Float32Array; onsets: Float32Array; hasImpulse: boolean[]; impulseCount: number;
}

function measureWindowVocalStats(pcm: Float32Array, sampleRate: number, startSec: number, endSec: number): { rms: number; zcr: number } {
  const i0 = Math.max(0, Math.floor(startSec * sampleRate)), i1 = Math.min(pcm.length, Math.ceil(endSec * sampleRate));
  if (i1 <= i0 + 1) return { rms: 0, zcr: 0 };
  const useBand = sampleRate >= 6000;
  const hpAlpha = useBand ? Math.exp((-2 * Math.PI * 250) / sampleRate) : 0, lpAlpha = useBand ? Math.exp((-2 * Math.PI * 3200) / sampleRate) : 0;
  let hpPrev = 0, xPrev = pcm[i0], lpState = 0, sumSq = 0, zc = 0;
  for (let i = i0; i < i1; i++) {
    const x = pcm[i];
    let y = x;
    if (useBand) { hpPrev = hpAlpha * (hpPrev + x - xPrev); xPrev = x; lpState = lpAlpha * lpState + (1 - lpAlpha) * hpPrev; y = lpState; }
    sumSq += y * y;
    if (i > i0 && ((x >= 0 && pcm[i - 1] < 0) || (x < 0 && pcm[i - 1] >= 0))) zc++;
  }
  const n = i1 - i0;
  return { rms: Math.sqrt(sumSq / n), zcr: zc / n };
}

function getSubBeatMeanMidi(curve: PitchCurvePoint[], startSec: number, endSec: number): number | null {
  if (!curve || curve.length === 0) return null;
  let sum = 0, cnt = 0;
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    if (p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat >= 36 && p.midiFloat <= 96) { sum += p.midiFloat; cnt++; }
  }
  return cnt > 0 ? sum / cnt : null;
}

export function computeVowelOnsetStrength(
  pcm: Float32Array | undefined, sampleRate: number | undefined, pitchCurve: PitchCurvePoint[],
  beatStartSec: number, beatDurationSec: number, resolution = 4
): SubBeatOnsetProfile {
  const energies = new Float32Array(resolution), onsets = new Float32Array(resolution);
  const hasImpulse = new Array<boolean>(resolution).fill(false);
  const stepDur = beatDurationSec / Math.max(1, resolution), hasAudio = Boolean(pcm && pcm.length > 0 && sampleRate && sampleRate > 0);
  const dipFactors = new Float32Array(resolution), pitchJumps = new Float32Array(resolution);

  let prevMidi: number | null = getSubBeatMeanMidi(pitchCurve, beatStartSec - stepDur, beatStartSec);
  for (let s = 0; s < resolution; s++) {
    const sStart = beatStartSec + s * stepDur, sEnd = sStart + stepDur;
    const curMidi = getSubBeatMeanMidi(pitchCurve, sStart, sEnd);
    if (curMidi !== null && prevMidi !== null) pitchJumps[s] = Math.abs(curMidi - prevMidi);
    if (curMidi !== null) prevMidi = curMidi;
    if (hasAudio && pcm && sampleRate) {
      const core = measureWindowVocalStats(pcm, sampleRate, sStart + stepDur * 0.12, sEnd - stepDur * 0.12);
      const full = measureWindowVocalStats(pcm, sampleRate, sStart, sEnd);
      energies[s] = Math.max(core.rms, full.rms);
      if (s > 0) {
        const boundary = measureWindowVocalStats(pcm, sampleRate, sStart - stepDur * 0.22, sStart + stepDur * 0.22);
        const refMin = Math.min(energies[s - 1], energies[s]);
        if (refMin > 1e-3 && boundary.rms < 0.76 * refMin) dipFactors[s] = (refMin - boundary.rms) / refMin;
        if (boundary.zcr > 0.25 && full.zcr < 0.20) dipFactors[s] = Math.max(dipFactors[s], 0.35);
      }
    } else if (curMidi !== null) energies[s] = 0.25;
  }

  const maxE = Math.max(0, ...energies);
  const prevBeatE = (hasAudio && pcm && sampleRate && beatStartSec >= stepDur) ? measureWindowVocalStats(pcm, sampleRate, beatStartSec - stepDur, beatStartSec).rms : 0;
  let seenFirstVoiced = false, impulseCount = 0;
  for (let s = 0; s < resolution; s++) {
    const ePrev = s === 0 ? prevBeatE : energies[s - 1];
    onsets[s] = Math.max(0, energies[s] - 0.7 * ePrev) + dipFactors[s] * Math.max(0.05, maxE * 0.65) + (pitchJumps[s] >= 0.55 ? Math.min(1.5, pitchJumps[s] * 0.35) * Math.max(0.08, maxE) : 0);
    const isVoiced = maxE > 1e-4 ? energies[s] >= 0.18 * maxE : false;
    if (!seenFirstVoiced && isVoiced) { seenFirstVoiced = true; hasImpulse[s] = true; impulseCount++; }
    else if (seenFirstVoiced && isVoiced && (energies[s] > 1.22 * energies[s - 1] || dipFactors[s] >= 0.18 || pitchJumps[s] >= 0.55)) { hasImpulse[s] = true; impulseCount++; }
  }
  return { energies, onsets, hasImpulse, impulseCount };
}

export function scoreMaracatuSubBeatPattern(params: {
  syllableCount: number; profile: SubBeatOnsetProfile; hasLeadingRest?: boolean;
  hasTrailingPickup?: boolean; isDownbeatLocked?: boolean; explicitSubdivs?: number[]; hasExplicitUnderscore?: boolean;
}): { subdivs: number[]; impulseCount: number } {
  const { syllableCount, profile, hasLeadingRest = false, hasTrailingPickup = false, isDownbeatLocked = false, explicitSubdivs, hasExplicitUnderscore = false } = params;
  if (syllableCount <= 0) return { subdivs: [], impulseCount: 0 };
  const maxE = Math.max(0, ...profile.energies), maxO = Math.max(1e-6, ...profile.onsets), hasAudio = maxE > 1e-4;
  if ((hasExplicitUnderscore || hasLeadingRest || isDownbeatLocked) && explicitSubdivs && explicitSubdivs.length === syllableCount && (hasLeadingRest || isDownbeatLocked || !hasAudio || profile.impulseCount >= syllableCount)) {
    return { subdivs: explicitSubdivs, impulseCount: syllableCount };
  }
  const effCount = hasAudio && profile.impulseCount >= 1 && profile.impulseCount < syllableCount ? profile.impulseCount : Math.min(4, syllableCount);
  const sScore = (s: number) => hasAudio ? 0.65 * (profile.onsets[s] / maxO) + 0.35 * (profile.energies[s] / Math.max(1e-6, maxE)) : 0;
  const pickBest = (cands: Array<{ pat: number[]; bonus: number }>) => {
    let best = cands[0].pat, bestVal = -Infinity;
    for (const c of cands) {
      const v = c.pat.reduce((acc, idx) => acc + sScore(idx), 0) + c.bonus + (isDownbeatLocked && c.pat[0] === 0 ? 0.25 : 0);
      if (v > bestVal) { bestVal = v; best = c.pat; }
    }
    return best;
  };
  if (effCount === 1) {
    if (!hasLeadingRest) return { subdivs: (!hasAudio || isDownbeatLocked || profile.energies[0] >= 0.22 * maxE) ? [0] : pickBest([{ pat: [0], bonus: 0.2 }, { pat: [1], bonus: 0 }, { pat: [2], bonus: 0.05 }, { pat: [3], bonus: 0 }]), impulseCount: 1 };
    return { subdivs: pickBest([{ pat: [1], bonus: 0.1 }, { pat: [2], bonus: hasTrailingPickup ? 0.05 : 0.22 }, { pat: [3], bonus: hasTrailingPickup ? 0.28 : 0.05 }]), impulseCount: 1 };
  }
  if (effCount === 2) {
    if (!hasLeadingRest) return { subdivs: pickBest([{ pat: [0, 2], bonus: 0.22 }, { pat: [0, 3], bonus: 0.16 + (hasTrailingPickup ? 0.20 : 0) }, { pat: [0, 1], bonus: 0.08 }]), impulseCount: 2 };
    return { subdivs: pickBest([{ pat: [1, 3], bonus: 0.24 + (hasTrailingPickup ? 0.15 : 0) }, { pat: [1, 2], bonus: 0.12 }, { pat: [2, 3], bonus: 0.10 }]), impulseCount: 2 };
  }
  if (effCount === 3) {
    if (hasLeadingRest) return { subdivs: [1, 2, 3], impulseCount: 3 };
    const cands: Array<{ pat: number[]; bonus: number }> = [{ pat: [0, 1, 3], bonus: 0.35 }, { pat: [0, 2, 3], bonus: 0.18 }];
    if (hasAudio && profile.energies[3] < 0.15 * maxE) cands.push({ pat: [0, 1, 2], bonus: 0.0 });
    return { subdivs: pickBest(cands), impulseCount: 3 };
  }
  return { subdivs: [0, 1, 2, 3], impulseCount: 4 };
}
