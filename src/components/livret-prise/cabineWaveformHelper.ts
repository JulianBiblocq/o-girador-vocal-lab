/**
 * cabineWaveformHelper.ts
 * Extraction normalisée des formes d'onde (Ana, M1..Mn, +T1, Voix témoin) et rendu live 60 FPS (< 65 lignes).
 */
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';

export const CABINE_WAVE_BINS_PER_BEAT = 6;

export function patternHasAnyAudio(pat?: VocalPatternItem | null): boolean {
  if (!pat) return false;
  return Boolean(pat.rawAudioSamples?.length || pat.recordingResult?.pcm?.length || pat.variants?.[pat.activeVariantKey]?.recordingResult?.pcm?.length);
}

export function extractMeasureWaveform(pat: VocalPatternItem | null | undefined, m1: number, bpmCount: number, bins = 22, spanMeasures = 1): Float32Array | undefined {
  const rec = pat?.variants?.[pat.activeVariantKey]?.recordingResult ?? pat?.recordingResult;
  const pcm = rec?.pcm ?? pat?.rawAudioSamples;
  if (!pat || !pcm?.length) return undefined;
  const sr = rec?.sampleRate ?? pat.pack?.audio?.sampleRate ?? 48000;
  const mDur = bpmCount * (60 / (rec?.recordedBpm || pat.bpm || pat.baseBpm || 88));
  const t1 = getPatternT1OffsetSec(pat.hasAnacrusis !== false, mDur, rec?.t1OffsetSec ?? pat.t1OffsetSec);
  const s0 = Math.max(0, Math.floor((t1 + (m1 - 1) * mDur) * sr));
  const s1 = Math.min(pcm.length, Math.floor((t1 + (m1 - 1 + spanMeasures) * mDur) * sr));
  if (s1 <= s0 + bins) return undefined;
  let globalMax = 0.06;
  for (let k = 0; k < pcm.length; k += 32) { const a = Math.abs(pcm[k]); if (a > globalMax) globalMax = a; }
  const out = new Float32Array(bins), step = Math.max(1, Math.floor((s1 - s0) / bins));
  for (let i = 0; i < bins; i++) {
    let pk = 0, idx0 = s0 + i * step;
    for (let j = 0; j < step && idx0 + j < s1; j++) pk = Math.max(pk, Math.abs(pcm[idx0 + j]));
    out[i] = Math.min(1, pk / globalMax);
  }
  return out;
}

export function drawMeasureWaveformsOnBox(
  ctx: CanvasRenderingContext2D, xCursor: number, mw: number, midY: number, boxH: number,
  kind: 'preroll' | 'cue' | 'sung' | 'tail', beatsCount: number, startBeatGlobal: number,
  waveformBins?: Float32Array, anacrusisWaveformBins?: Float32Array, anacrusisStartBeat?: number,
  livePeakBins?: Float32Array | null, maxLiveBin = -1
): void {
  if (waveformBins?.length) {
    ctx.fillStyle = kind === 'cue' ? 'rgba(125,211,252,0.28)' : 'rgba(254,243,199,0.34)';
    const bw = (mw - 8) / waveformBins.length;
    waveformBins.forEach((v, i) => { const bh = Math.max(2.5, v * (boxH * 0.54)); ctx.fillRect(xCursor + 4 + i * bw, midY - bh / 2, Math.max(1.5, bw - 1), bh); });
  }
  if (anacrusisWaveformBins?.length && anacrusisStartBeat) {
    ctx.fillStyle = 'rgba(253,224,71,0.34)';
    const startFrac = (anacrusisStartBeat - 1) / beatsCount, bw = (mw - 8) / anacrusisWaveformBins.length;
    anacrusisWaveformBins.forEach((v, i) => { if (i / anacrusisWaveformBins.length >= startFrac) { const bh = Math.max(2.5, v * (boxH * 0.54)); ctx.fillRect(xCursor + 4 + i * bw, midY - bh / 2, Math.max(1.5, bw - 1), bh); } });
  }
  if (maxLiveBin >= 0 && livePeakBins?.length) {
    const mBins = beatsCount * CABINE_WAVE_BINS_PER_BEAT, bw = (mw - 6) / mBins, b0 = startBeatGlobal * CABINE_WAVE_BINS_PER_BEAT;
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < mBins; i++) {
      const gIdx = b0 + i;
      if (gIdx <= maxLiveBin && gIdx < livePeakBins.length && livePeakBins[gIdx] > 0.008) {
        const bh = Math.max(3, Math.min(1, livePeakBins[gIdx] * 1.35) * (boxH * 0.58));
        ctx.fillRect(xCursor + 3 + i * bw, midY - bh / 2, Math.max(1.8, bw - 0.8), bh);
      }
    }
  }
}
