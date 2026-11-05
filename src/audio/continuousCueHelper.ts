/**
 * continuousCueHelper.ts
 * Planification audio en écouteur (Cue) du contre-rôle pendant la prise continue (< 90 lignes).
 */
import type { ToadaProject, VocalRole, VocalPatternItem } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { selectBestAudioVariant } from '../utils/variantMatcher';
import { computeSlotsMeasureLayout } from '../components/conductor/toadaTimingScheduler';

export const CONTINUOUS_LEAD_IN_MEASURES = 2;

export interface ContinuousCueHandle {
  stop: () => void;
}

export function scheduleContinuousCounterRole(
  ctx: AudioContext,
  project: ToadaProject,
  targetRole: VocalRole,
  audioCtxStart: number,
  marginBeforeM0Sec: number
): ContinuousCueHandle {
  const counterRole: VocalRole = targetRole === 'puxador' ? 'coro' : 'puxador';
  const projectBpm = project.bpm || 88;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / projectBpm;
  const measureDurationSec = beatsPerMeasure * beatDuration;
  const sources: AudioBufferSourceNode[] = [];
  const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);

  layouts.forEach((layout) => {
    const slot = project.slots[layout.slotIndex];
    const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
    const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);

    const patToPlay: VocalPatternItem | undefined = counterRole === 'puxador' ? puxPat : coroPat;
    if (!patToPlay) return;

    const match = selectBestAudioVariant(patToPlay.variants, 1.0, 0, patToPlay.baseBpm ?? patToPlay.bpm ?? projectBpm);
    const variant = match?.variant ?? patToPlay.variants?.[patToPlay.activeVariantKey];
    const rec = variant?.recordingResult ?? patToPlay.recordingResult;

    if (rec && rec.pcm && rec.pcm.length > 0) {
      const { pcm, sampleRate } = rec;
      const trimStartSec = variant?.trimStartSec || patToPlay.trimStartSec || 0;
      const rawTrimEnd = variant?.trimEndSec || patToPlay.trimEndSec || 0;
      const trimEndSec = rawTrimEnd > trimStartSec ? rawTrimEnd : pcm.length / sampleRate;

      const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
      const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
      const len = Math.max(0, sEnd - sStart);

      if (len > 0) {
        const buffer = ctx.createBuffer(1, len, sampleRate);
        buffer.getChannelData(0).set(pcm.subarray(sStart, sEnd));

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const explicitT1 = variant?.t1OffsetSec ?? patToPlay.t1OffsetSec ?? rec.t1OffsetSec;
        const t1OffsetSec = getPatternT1OffsetSec(patToPlay.hasAnacrusis, measureDurationSec, explicitT1);
        const recordedBpm = rec.recordedBpm || patToPlay.bpm || patToPlay.baseBpm || projectBpm;
        const speedRatio = Math.max(0.25, Math.min(4.0, projectBpm / recordedBpm));
        source.playbackRate.value = speedRatio;

        const slotMeasureFromM0 = (CONTINUOUS_LEAD_IN_MEASURES - 1) + layout.startMeasure;
        const blockT1Sec = marginBeforeM0Sec + slotMeasureFromM0 * measureDurationSec;
        const startTime = audioCtxStart + blockT1Sec + (trimStartSec - t1OffsetSec) / speedRatio;

        if (match && match.residualSemitones !== 0) {
          try { source.detune.setValueAtTime(match.residualSemitones * 100, Math.max(ctx.currentTime, startTime)); } catch {}
        }
        try {
          source.start(Math.max(ctx.currentTime, startTime));
          sources.push(source);
        } catch {}
      }
    }
  });

  return {
    stop: () => {
      sources.forEach((s) => {
        try { s.stop(); s.disconnect(); } catch {}
      });
    },
  };
}
