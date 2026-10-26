/**
 * toadaVoiceScheduler.ts
 * Préparation et déclenchement d'une voix vocale avec varispeed et ancrage T1 (< 65 lignes).
 */
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { selectBestAudioVariant } from '../../utils/variantMatcher';
import type { ToadaTimelineClock } from './toadaTimingScheduler';

export interface ScheduledVoiceResult {
  source: AudioBufferSourceNode;
  recordedBpm?: number;
}

export function schedulePatternVoice(
  ctx: AudioContext,
  pat: VocalPatternItem,
  slotT1Time: number,
  clock: ToadaTimelineClock
): ScheduledVoiceResult | null {
  const match = selectBestAudioVariant(pat.variants, 1.0, 0, pat.baseBpm ?? 100);
  const variant = match?.variant ?? pat.variants?.[pat.activeVariantKey];
  const rec = variant?.recordingResult ?? pat.recordingResult;
  if (!rec?.pcm?.length) return null;

  const { pcm, sampleRate } = rec;
  const trimStartSec = variant?.trimStartSec || pat.trimStartSec || 0;
  const trimEndSec = (variant?.trimEndSec || pat.trimEndSec || 0) > 0 ? (variant?.trimEndSec || pat.trimEndSec || 0) : pcm.length / sampleRate;
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

  const explicitT1 = variant?.t1OffsetSec ?? pat.t1OffsetSec ?? rec.t1OffsetSec;
  const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis, clock.getMeasureDurationSec(), explicitT1);
  const recordedBpm = rec.recordedBpm || pat.bpm || pat.baseBpm;
  const speedRatio = clock.getSpeedRatio(recordedBpm);
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
