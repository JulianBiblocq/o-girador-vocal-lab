/**
 * cueAudioHelper.ts
 * Pré-écoute contextuelle du pattern d'appel précédent (Mesure 0 = décompte, Mesures 1..M_cue = Cue).
 * Préserve 100 % de l'anacrouse du Cue et applique le varispeed (playbackRate = effectiveBpm / recordedBpm).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';

export interface CuePlaybackHandle {
  source: AudioBufferSourceNode;
  stop: () => void;
}

export function computeCueScheduleParams(
  cuePattern: VocalPatternItem,
  cycleStartTime: number,
  beatsPerMeasure = 4,
  beatDurationSec = 0.5,
  effectiveBpm?: number
): {
  trimStartSec: number;
  trimEndSec: number;
  cueT1OffsetSec: number;
  cueT1Time: number;
  speedRatio: number;
  whenToStartCue: number;
} | null {
  const variant = cuePattern.variants?.[cuePattern.activeVariantKey];
  const rec = variant?.recordingResult ?? cuePattern.recordingResult;
  const isMainVar = !variant || (variant.speedRatio === 1 && variant.pitchShiftSemitones === 0);
  const useCorrected = Boolean(isMainVar && cuePattern.correctedAudioSamples && cuePattern.correctedAudioSamples.length > 0);
  if (!useCorrected && (!rec || !rec.pcm || rec.pcm.length === 0)) return null;

  const pcm = useCorrected ? cuePattern.correctedAudioSamples! : rec!.pcm;
  const sampleRate = useCorrected ? (cuePattern.pack?.audio?.sampleRate ?? rec?.sampleRate ?? 44100) : rec!.sampleRate;
  const measureDurationSec = beatsPerMeasure * beatDurationSec;
  const currentBpm = effectiveBpm || Math.round(60 / beatDurationSec);
  const recordedBpm = useCorrected
    ? (cuePattern.pack?.metadata?.bpm || cuePattern.bpm || cuePattern.baseBpm || currentBpm)
    : (rec?.recordedBpm || cuePattern.bpm || cuePattern.baseBpm || currentBpm);
  const speedRatio = Math.max(0.25, Math.min(4.0, currentBpm / recordedBpm));

  const cueOriginalMeasureDur = beatsPerMeasure * (60 / recordedBpm);
  const explicitT1 = useCorrected
    ? (cuePattern.hasAnacrusis !== false ? cueOriginalMeasureDur : 0.15)
    : (variant?.t1OffsetSec ?? cuePattern.t1OffsetSec ?? rec?.t1OffsetSec);
  const cueT1OffsetSec = getPatternT1OffsetSec(cuePattern.hasAnacrusis !== false, cueOriginalMeasureDur, explicitT1);

  const trimStartSec = Math.max(0, useCorrected ? (cuePattern.pack?.audio?.trim?.startSec ?? 0) : (variant?.trimStartSec ?? cuePattern.trimStartSec ?? 0));
  const rawTrimEnd = useCorrected ? (cuePattern.pack?.audio?.trim?.endSec ?? 0) : (variant?.trimEndSec ?? cuePattern.trimEndSec ?? 0);
  const trimEndSec = rawTrimEnd > trimStartSec ? rawTrimEnd : pcm.length / sampleRate;

  // Le Temps 1 du Cue démarre après 1 mesure franche de décompte (Mesure 0)
  const cueT1Time = cycleStartTime + measureDurationSec;
  const whenToStartCue = cueT1Time + (trimStartSec - cueT1OffsetSec) / speedRatio;

  return { trimStartSec, trimEndSec, cueT1OffsetSec, cueT1Time, speedRatio, whenToStartCue };
}

export function scheduleCuePatternAudio(
  ctx: AudioContext,
  cuePattern: VocalPatternItem,
  cycleStartTime: number,
  beatsPerMeasure = 4,
  beatDurationSec = 0.5,
  effectiveBpm?: number
): CuePlaybackHandle | null {
  const variant = cuePattern.variants?.[cuePattern.activeVariantKey];
  const rec = variant?.recordingResult ?? cuePattern.recordingResult;
  const isMainVar = !variant || (variant.speedRatio === 1 && variant.pitchShiftSemitones === 0);
  const useCorrected = Boolean(isMainVar && cuePattern.correctedAudioSamples && cuePattern.correctedAudioSamples.length > 0);
  if (!useCorrected && (!rec || !rec.pcm || rec.pcm.length === 0)) return null;

  const sched = computeCueScheduleParams(cuePattern, cycleStartTime, beatsPerMeasure, beatDurationSec, effectiveBpm);
  if (!sched) return null;

  const pcm = useCorrected ? cuePattern.correctedAudioSamples! : rec!.pcm;
  const sampleRate = useCorrected ? (cuePattern.pack?.audio?.sampleRate ?? rec?.sampleRate ?? 44100) : rec!.sampleRate;
  const startOffset = Math.max(0, Math.floor(sched.trimStartSec * sampleRate));
  const endOffset = Math.min(pcm.length, Math.floor(sched.trimEndSec * sampleRate));
  const usefulLength = Math.max(0, endOffset - startOffset);
  if (usefulLength === 0) return null;

  const buffer = ctx.createBuffer(1, usefulLength, sampleRate);
  buffer.getChannelData(0).set(pcm.subarray(startOffset, endOffset));

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = sched.speedRatio;

  const gain = ctx.createGain();
  gain.gain.value = 0.85;

  source.connect(gain);
  gain.connect(ctx.destination);

  const bufferDurSec = usefulLength / sampleRate;
  const now = ctx.currentTime;
  try {
    if (sched.whenToStartCue >= now) {
      source.start(sched.whenToStartCue, 0, bufferDurSec);
    } else {
      const elapsedBuf = (now - sched.whenToStartCue) * sched.speedRatio;
      if (elapsedBuf < bufferDurSec) {
        source.start(now, elapsedBuf, bufferDurSec - elapsedBuf);
      } else {
        return null;
      }
    }
  } catch (err) {
    console.warn('Erreur au lancement du cue audio:', err);
    return null;
  }

  return {
    source,
    stop: () => {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
      } catch { /* ignore */ }
    },
  };
}
