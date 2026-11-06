/**
 * toadaVoiceScheduler.ts
 * Préparation et déclenchement d'une voix vocale avec varispeed et ancrage T1 (< 65 lignes).
 */
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { selectBestAudioVariant } from '../../utils/variantMatcher';
import { getOrComputeTroupeTransposedPCM } from '../../audio/formantPreservingPitchShifter';
import type { ToadaTimelineClock } from './toadaTimingScheduler';

export interface ScheduledVoiceResult {
  source: AudioBufferSourceNode;
  recordedBpm?: number;
}

export function schedulePatternVoice(
  ctx: AudioContext,
  pat: VocalPatternItem,
  slotT1Time: number,
  clock: ToadaTimelineClock,
  transpositionSemitones = 0
): ScheduledVoiceResult | null {
  const match = selectBestAudioVariant(pat.variants, 1.0, 0, pat.baseBpm ?? pat.bpm ?? 88);
  const variant = match?.variant ?? pat.variants?.[pat.activeVariantKey];
  const rec = variant?.recordingResult ?? pat.recordingResult;
  const isMainVar = !variant || (variant.speedRatio === 1 && variant.pitchShiftSemitones === 0);
  const useCorrected = Boolean(isMainVar && pat.correctedAudioSamples && pat.correctedAudioSamples.length > 0);
  if (!useCorrected && !rec?.pcm?.length) return null;

  const basePcm = useCorrected ? pat.correctedAudioSamples! : rec!.pcm;
  const sampleRate = useCorrected ? (pat.pack?.audio?.sampleRate ?? rec?.sampleRate ?? 44100) : rec!.sampleRate;
  const pcm = transpositionSemitones !== 0
    ? getOrComputeTroupeTransposedPCM(basePcm, sampleRate, transpositionSemitones)
    : basePcm;
  const trimStartSec = useCorrected ? (pat.pack?.audio?.trim?.startSec ?? 0) : (variant?.trimStartSec || pat.trimStartSec || 0);
  const rawTrimEnd = useCorrected ? (pat.pack?.audio?.trim?.endSec ?? 0) : (variant?.trimEndSec || pat.trimEndSec || 0);
  const trimEndSec = rawTrimEnd > trimStartSec ? rawTrimEnd : pcm.length / sampleRate;
  const bufferDuration = Math.max(0.05, trimEndSec - trimStartSec);

  const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
  const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
  const len = sEnd - sStart;
  if (len <= 0) return null;

  const buffer = ctx.createBuffer(1, len, sampleRate);
  buffer.getChannelData(0).set(pcm.subarray(sStart, sEnd));

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  const recordedBpm = useCorrected ? (pat.pack?.metadata?.bpm || pat.bpm || pat.baseBpm) : (rec?.recordedBpm || pat.bpm || pat.baseBpm);
  const speedRatio = clock.getSpeedRatio(recordedBpm);
  const origMeasureDur = clock.getMeasureDurationSec() * speedRatio;
  const explicitT1 = useCorrected
    ? (pat.hasAnacrusis !== false ? origMeasureDur : 0.15)
    : (variant?.t1OffsetSec ?? pat.t1OffsetSec ?? rec?.t1OffsetSec);
  const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis !== false, origMeasureDur, explicitT1);
  source.playbackRate.value = speedRatio;

  const offsetSec = (trimStartSec - t1OffsetSec) / speedRatio;
  const when = slotT1Time + offsetSec;
  const now = ctx.currentTime;

  try {
    if (when >= now) {
      source.start(when, 0, bufferDuration);
    } else {
      const elapsedBuf = (now - when) * speedRatio;
      if (elapsedBuf < bufferDuration) source.start(now, elapsedBuf, bufferDuration - elapsedBuf);
      else return null;
    }
    return { source, recordedBpm };
  } catch {
    return null;
  }
}
