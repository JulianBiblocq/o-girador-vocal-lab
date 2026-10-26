/**
 * continuousCueHelper.ts
 * Planification audio en écouteur (Cue) du contre-rôle pendant la prise continue (< 90 lignes).
 */
import type { ToadaProject, VocalRole, VocalPatternItem } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { selectBestAudioVariant } from '../utils/variantMatcher';

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
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / (project.bpm || 55);
  const measureDurationSec = beatsPerMeasure * beatDuration;
  const sources: AudioBufferSourceNode[] = [];

  let currentMeasure = 1;

  project.slots.forEach((slot) => {
    const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
    const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);
    const measuresInSlot = Math.max(puxPat?.measuresCount ?? 2, coroPat?.measuresCount ?? 2, 2);

    const patToPlay: VocalPatternItem | undefined = counterRole === 'puxador' ? puxPat : coroPat;
    if (patToPlay) {
      const match = selectBestAudioVariant(patToPlay.variants, 1.0, 0, patToPlay.baseBpm ?? 100);
      const variant = match?.variant ?? patToPlay.variants?.[patToPlay.activeVariantKey];
      const rec = variant?.recordingResult ?? patToPlay.recordingResult;

      if (rec && rec.pcm && rec.pcm.length > 0) {
        const { pcm, sampleRate } = rec;
        const trimStartSec = variant?.trimStartSec || patToPlay.trimStartSec || 0;
        const trimEndSec = (variant?.trimEndSec || patToPlay.trimEndSec || 0) > 0
          ? (variant?.trimEndSec || patToPlay.trimEndSec || 0)
          : pcm.length / sampleRate;

        const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
        const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
        const len = Math.max(0, sEnd - sStart);

        if (len > 0) {
          const buffer = ctx.createBuffer(1, len, sampleRate);
          buffer.getChannelData(0).set(pcm.subarray(sStart, sEnd));

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);

          const explicitT1 = match?.variant?.t1OffsetSec ?? patToPlay.t1OffsetSec ?? rec?.t1OffsetSec;
          const t1OffsetSec = getPatternT1OffsetSec(patToPlay.hasAnacrusis, measureDurationSec, explicitT1);
          const blockT1Sec = marginBeforeM0Sec + currentMeasure * measureDurationSec;
          const startTime = audioCtxStart + blockT1Sec + (trimStartSec - t1OffsetSec);

          if (match && match.residualSemitones !== 0) {
            try { source.detune.setValueAtTime(match.residualSemitones * 100, startTime); } catch {}
          }
          try {
            source.start(startTime);
            sources.push(source);
          } catch {}
        }
      }
    }
    currentMeasure += (slot.advanceMeasures ?? measuresInSlot);
  });

  return {
    stop: () => {
      sources.forEach((s) => {
        try { s.stop(); s.disconnect(); } catch {}
      });
    },
  };
}
