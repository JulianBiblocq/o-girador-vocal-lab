/**
 * piecewiseTimeWarper.ts
 * Moteur de Time-Warp elastique WSOLA par morceaux (phase-locked, fenetre Hann 40ms) (< 130 lignes).
 * Permet d'egaliser les temps sans modifier la hauteur vocale (pitch invariant).
 */
export interface TimeWarpAnalysis {
  averageBeatSec: number;
  phraseBpm: number;
  targetPegs: number[];
}

export function analyzeBeatPegs(pegs: number[], customBpm?: number): TimeWarpAnalysis {
  if (pegs.length < 2) return { averageBeatSec: 0.6, phraseBpm: customBpm || 100, targetPegs: [...pegs] };
  const avgBeat = customBpm && customBpm > 20 ? 60 / customBpm : (pegs[pegs.length - 1] - pegs[0]) / (pegs.length - 1);
  const phraseBpm = Math.round((60 / avgBeat) * 10) / 10;
  const targetPegs = pegs.map((_, i) => pegs[0] + i * avgBeat);
  return { averageBeatSec: avgBeat, phraseBpm, targetPegs };
}

export function wsolaStretchSegment(src: Float32Array, sampleRate: number, targetLen: number): Float32Array {
  if (src.length <= 64 || targetLen <= 64 || Math.abs(src.length - targetLen) < 8) return new Float32Array(src);
  const win = Math.max(64, 2 * Math.round((0.040 * sampleRate) / 2));
  const hop = Math.max(16, Math.round(win / 4));
  const maxDelta = Math.max(8, Math.round(0.008 * sampleRate));
  const ratio = targetLen / src.length;
  const out = new Float32Array(targetLen);
  const weight = new Float32Array(targetLen);
  const hann = new Float32Array(win);
  for (let i = 0; i < win; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (win - 1)));

  for (let outPos = 0; outPos + win <= targetLen; outPos += hop) {
    const idealIn = Math.min(src.length - win, Math.max(0, Math.round(outPos / ratio)));
    let bestDelta = 0;
    if (outPos > 0) {
      let maxCorr = -Infinity;
      for (let d = -maxDelta; d <= maxDelta; d += 2) {
        const cand = idealIn + d;
        if (cand < 0 || cand + hop >= src.length) continue;
        let dot = 0;
        for (let k = 0; k < hop; k += 2) dot += src[cand + k] * out[outPos + k];
        if (dot > maxCorr) { maxCorr = dot; bestDelta = d; }
      }
    }
    const actualIn = Math.min(src.length - win, Math.max(0, idealIn + bestDelta));
    for (let j = 0; j < win; j++) {
      out[outPos + j] += src[actualIn + j] * hann[j];
      weight[outPos + j] += hann[j];
    }
  }
  for (let i = 0; i < targetLen; i++) { if (weight[i] > 0.001) out[i] /= weight[i]; }
  return out;
}

export function piecewiseTimeWarp(
  rawAudio: Float32Array, sampleRate: number,
  trimInSec: number, trimOutSec: number,
  pegs: number[], warpPct: number, customBpm?: number
): Float32Array {
  const s0 = Math.max(0, Math.floor(trimInSec * sampleRate));
  const s1 = Math.min(rawAudio.length, Math.ceil(trimOutSec * sampleRate));
  if (s1 <= s0 || pegs.length < 2 || warpPct <= 0) return rawAudio.slice(s0, s1);

  const { averageBeatSec } = analyzeBeatPegs(pegs, customBpm);
  const alpha = Math.max(0, Math.min(1, warpPct / 100));
  const allPoints = [trimInSec, ...pegs, trimOutSec];
  const warpedSegments: Float32Array[] = [];

  for (let p = 0; p < allPoints.length - 1; p++) {
    const tStart = allPoints[p], tEnd = allPoints[p + 1];
    const segStart = Math.max(0, Math.floor(tStart * sampleRate));
    const segEnd = Math.min(rawAudio.length, Math.ceil(tEnd * sampleRate));
    const segPcm = rawAudio.slice(segStart, segEnd);
    const origSec = tEnd - tStart;
    const isBeatInterval = p >= 1 && p <= pegs.length - 1;
    const targetSec = isBeatInterval ? (1 - alpha) * origSec + alpha * averageBeatSec : origSec;
    const clampedRatio = Math.max(0.65, Math.min(1.45, targetSec / Math.max(0.001, origSec)));
    const targetSamples = Math.max(32, Math.round(segPcm.length * clampedRatio));
    warpedSegments.push(wsolaStretchSegment(segPcm, sampleRate, targetSamples));
  }

  const totalLen = warpedSegments.reduce((sum, seg) => sum + seg.length, 0);
  const out = new Float32Array(totalLen);
  let offset = 0;
  for (const seg of warpedSegments) {
    out.set(seg, offset);
    offset += seg.length;
  }
  return out;
}
