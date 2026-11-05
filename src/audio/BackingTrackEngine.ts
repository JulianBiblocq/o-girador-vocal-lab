/**
 * BackingTrackEngine.ts
 * Moteur Web Audio de lecture synchrone du Bounce Rythmique (Baque Témoin de Sequenciador) (< 115 lignes).
 * Verrouille le 1er Temps fort (firstDownbeatOffsetSec) sur M1•T1 avec Varispeed temps réel (currentBpm / referenceBpm).
 */
import type { BackingTrackData } from '../utils/backingTrackStorage';

export interface BackingTrackPlaybackHandle {
  setLiveBpm: (newBpm: number) => void;
  setVolume: (vol: number) => void;
  stop: () => void;
}

export function computeBackingVarispeedRate(currentBpm: number, referenceBpm: number): number {
  const ref = referenceBpm > 20 ? referenceBpm : currentBpm || 88;
  const cur = currentBpm > 20 ? currentBpm : ref;
  return Math.max(0.25, Math.min(4.0, cur / ref));
}

export function scheduleBackingTrackOnContext(
  ctx: AudioContext,
  track: BackingTrackData | null | undefined,
  targetT1Time: number,
  currentBpm: number,
  totalDurationSec?: number
): BackingTrackPlaybackHandle | null {
  if (!track || !track.enabled || !track.pcm || track.pcm.length === 0) return null;

  const buffer = ctx.createBuffer(1, track.pcm.length, track.sampleRate);
  buffer.getChannelData(0).set(track.pcm);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = Boolean(track.loopTrack);

  const downbeatOffset = Math.max(0, Math.min(buffer.duration - 0.05, track.firstDownbeatOffsetSec || 0));
  if (source.loop) {
    source.loopStart = downbeatOffset;
    source.loopEnd = buffer.duration;
  }

  const rate = computeBackingVarispeedRate(currentBpm, track.referenceBpm);
  source.playbackRate.setValueAtTime(rate, ctx.currentTime);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(Math.max(0, Math.min(1.5, track.volume ?? 0.65)), ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  const now = ctx.currentTime;
  let startWhen = targetT1Time;
  let bufferOffset = downbeatOffset;

  // Si targetT1Time est dans le passé par rapport à now, avance dans le buffer avec prise en compte du varispeed
  if (targetT1Time < now) {
    const elapsedRealSec = now - targetT1Time;
    const elapsedBufferSec = elapsedRealSec * rate;
    startWhen = now;
    const effectiveLoopLen = Math.max(0.1, buffer.duration - downbeatOffset);
    bufferOffset = track.loopTrack
      ? downbeatOffset + (elapsedBufferSec % effectiveLoopLen)
      : Math.min(buffer.duration - 0.01, downbeatOffset + elapsedBufferSec);
  }

  try {
    if (typeof totalDurationSec === 'number' && totalDurationSec > 0 && !track.loopTrack) {
      source.start(startWhen, bufferOffset, totalDurationSec * rate);
    } else {
      source.start(startWhen, bufferOffset);
      if (typeof totalDurationSec === 'number' && totalDurationSec > 0) {
        const stopAt = Math.max(startWhen + 0.05, startWhen + totalDurationSec);
        source.stop(stopAt);
      }
    }
  } catch {
    return null;
  }

  return {
    setLiveBpm: (newBpm: number) => {
      try {
        const nextRate = computeBackingVarispeedRate(newBpm, track.referenceBpm);
        source.playbackRate.setValueAtTime(nextRate, ctx.currentTime);
      } catch {}
    },
    setVolume: (vol: number) => {
      try {
        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1.5, vol)), ctx.currentTime, 0.015);
      } catch {}
    },
    stop: () => {
      try { source.stop(); } catch {}
      try { source.disconnect(); gainNode.disconnect(); } catch {}
    },
  };
}
