/**
 * synthVoiceHelper.ts
 * Synthétiseur Web Audio doux style Pífano / Flûte guide (< 130 lignes).
 * Supporte une enveloppe ADSR continue unifiée sur les notes tenues ('───') ET le legato
 * sans ré-attaque (portamento fluide) sur les briques de mélisme ('_' / isMelisma: true).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToFrequency } from '../utils/noteUtils';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';

export interface SynthScheduledNode {
  stop: () => void;
  disconnect: () => void;
}

export interface LegatoSegment {
  midi: number;
  startSec: number;
  endSec: number;
}

export function playLegatoSynthPhrase(
  ctx: AudioContext,
  dest: AudioNode,
  segments: LegatoSegment[]
): SynthScheduledNode {
  const first = segments[0], last = segments[segments.length - 1];
  const startTime = first.startSec, durationSec = Math.max(0.015, last.endSec - startTime);
  const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();

  const f0 = midiToFrequency(first.midi);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f0, startTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(3200, f0 * 3.5), startTime);
  filter.Q.setValueAtTime(0.8, startTime);

  for (let k = 1; k < segments.length; k++) {
    const prevFreq = midiToFrequency(segments[k - 1].midi), nextFreq = midiToFrequency(segments[k].midi);
    const tGlideStart = Math.max(startTime, segments[k].startSec - 0.008);
    const tGlideEnd = Math.min(last.endSec, segments[k].startSec + 0.028);
    osc.frequency.setValueAtTime(prevFreq, tGlideStart);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, nextFreq), Math.max(tGlideStart + 0.004, tGlideEnd));
    filter.frequency.setValueAtTime(Math.min(3200, prevFreq * 3.5), tGlideStart);
    filter.frequency.exponentialRampToValueAtTime(Math.min(3200, Math.max(80, nextFreq * 3.5)), Math.max(tGlideStart + 0.004, tGlideEnd));
  }

  const attack = Math.min(0.020, durationSec * 0.15);
  const release = Math.min(0.035, durationSec * 0.20);
  const sustainTime = Math.max(startTime + attack, startTime + durationSec - release);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.35, startTime + attack);
  gain.gain.setValueAtTime(0.30, sustainTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);

  return {
    stop: () => { try { osc.stop(); } catch { /* ignore */ } },
    disconnect: () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch { /* ignore */ } },
  };
}

export function playSingleSynthNote(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  startTime: number,
  durationSec: number
): SynthScheduledNode {
  return playLegatoSynthPhrase(ctx, dest, [{ midi, startSec: startTime, endSec: startTime + durationSec }]);
}

export function scheduleMelodySteps(
  ctx: AudioContext,
  dest: AudioNode,
  steps: VocalStepData[],
  stepDurationSec: number,
  startTime: number,
  seekStartSec = 0,
  startOffsetSec = 0
): SynthScheduledNode[] {
  const nodes: SynthScheduledNode[] = [];
  const beatDurationSec = stepDurationSec * 4;
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];
    if (step.tripletSlot !== 'unused' && step.active && step.note !== '───' && (step.midiNumber ?? 0) > 0) {
      const chain: Array<{ midi: number; winStart: number; winEnd: number }> = [];
      let curIdx = i;
      while (curIdx < steps.length) {
        const curStep = steps[curIdx];
        if (curIdx > i) {
          const isMelisma = Boolean(curStep?.active && curStep.tripletSlot !== 'unused' && curStep.note !== '───' && (curStep.midiNumber ?? 0) > 0 && (curStep.isMelisma || curStep.syllable?.trim() === '_'));
          if (!isMelisma) break;
        }
        const endIdx = findLastTiedStepIndex(steps, curIdx);
        const { startSec: winStart, endSec: winEnd } = getStepTimeWindowSec(steps, curIdx, startOffsetSec, beatDurationSec);
        chain.push({ midi: curStep.midiNumber!, winStart, winEnd });
        curIdx = endIdx + 1;
      }

      const activeChain = chain
        .filter((seg) => seg.winEnd > seekStartSec + 0.005)
        .map((seg) => ({
          midi: seg.midi,
          startSec: startTime + Math.max(0, seg.winStart - seekStartSec),
          endSec: startTime + (seg.winEnd - seekStartSec),
        }));

      if (activeChain.length > 0) nodes.push(playLegatoSynthPhrase(ctx, dest, activeChain));
      i = curIdx;
    } else {
      i++;
    }
  }
  return nodes;
}
