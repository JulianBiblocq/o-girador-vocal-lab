/**
 * punchInMerger.ts
 * Reprise partielle par mesure (Punch-in / Punch-out) (< 115 lignes) :
 * - Lecture de la mesure K-1 existante comme élancement vocal dans le casque
 * - Fusion sample-accurate de la nouvelle Mesure K dans le buffer existant avec fondu croisé cosinus de 15 ms (zéro clic).
 */

export interface PunchInMergeParams {
  existingPCM: Float32Array;
  punchPCM: Float32Array;
  sampleRate: number;
  targetMeasureIndex: number; // 1..measuresCount (base 1)
  measuresCount: number;
  measureDurationSec: number;
  t1OffsetSec: number;
  punchWindowOffsetSec?: number; // offset de Mesure K dans punchPCM (défaut: 0)
  crossfadeMs?: number; // défaut: 15 ms
}

/**
 * Fusionne la nouvelle prise de la Mesure K (`punchPCM`) dans `existingPCM`
 * avec un fondu croisé cosinus (raised-cosine 15 ms) aux deux frontières [mStart, mEnd].
 */
export function mergePunchInMeasure(params: PunchInMergeParams): Float32Array {
  const {
    existingPCM, punchPCM, sampleRate, targetMeasureIndex, measuresCount,
    measureDurationSec, t1OffsetSec, punchWindowOffsetSec = 0, crossfadeMs = 15,
  } = params;

  if (!existingPCM || existingPCM.length === 0) return punchPCM;
  if (!punchPCM || punchPCM.length === 0) return existingPCM;

  const k = Math.max(1, Math.min(measuresCount, targetMeasureIndex));
  const measureStartSec = Math.max(0, t1OffsetSec + (k - 1) * measureDurationSec);
  const tailSec = k === measuresCount ? measureDurationSec * 0.25 : 0;
  const measureEndSec = measureStartSec + measureDurationSec + tailSec;

  const startSample = Math.max(0, Math.min(existingPCM.length - 1, Math.round(measureStartSec * sampleRate)));
  const endSample = Math.max(startSample, Math.min(existingPCM.length, Math.round(measureEndSec * sampleRate)));
  const punchStartSample = Math.max(0, Math.round(punchWindowOffsetSec * sampleRate));

  const fadeSamples = Math.max(1, Math.round((crossfadeMs / 1000) * sampleRate));
  const merged = new Float32Array(existingPCM.length);
  merged.set(existingPCM);

  for (let dstIdx = startSample; dstIdx < endSample; dstIdx++) {
    const relIdx = dstIdx - startSample;
    const srcIdx = punchStartSample + relIdx;
    const newVal = srcIdx >= 0 && srcIdx < punchPCM.length ? punchPCM[srcIdx] : 0;
    const oldVal = existingPCM[dstIdx];

    let weightNew = 1.0;
    if (relIdx < fadeSamples && startSample > 0) {
      const u = relIdx / fadeSamples;
      weightNew = 0.5 * (1 - Math.cos(Math.PI * u));
    } else if (endSample - dstIdx <= fadeSamples && endSample < existingPCM.length) {
      const u = (endSample - dstIdx) / fadeSamples;
      weightNew = 0.5 * (1 - Math.cos(Math.PI * u));
    }

    merged[dstIdx] = oldVal * (1 - weightNew) + newVal * weightNew;
  }

  return merged;
}

/**
 * Planifie la lecture dans le casque de la mesure K-1 existante juste avant le Punch-in sur la mesure K.
 */
export function schedulePunchInLeadInAudio(
  ctx: AudioContext,
  existingPCM: Float32Array,
  sampleRate: number,
  targetMeasureIndex: number,
  measureDurationSec: number,
  t1OffsetSec: number,
  leadInStartTime: number
): { stop: () => void } | null {
  if (targetMeasureIndex <= 1 || !existingPCM || existingPCM.length === 0) return null;
  const prevMeasureStartSec = Math.max(0, t1OffsetSec + (targetMeasureIndex - 2) * measureDurationSec);
  const startSample = Math.floor(prevMeasureStartSec * sampleRate);
  const lenSamples = Math.min(existingPCM.length - startSample, Math.floor(measureDurationSec * sampleRate));
  if (lenSamples <= 128) return null;

  const buf = ctx.createBuffer(1, lenSamples, sampleRate);
  buf.getChannelData(0).set(existingPCM.subarray(startSample, startSample + lenSamples));

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  try {
    src.start(Math.max(ctx.currentTime, leadInStartTime));
  } catch {
    return null;
  }
  return {
    stop: () => {
      try { src.stop(); src.disconnect(); } catch {}
    },
  };
}
