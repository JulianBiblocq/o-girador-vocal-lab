/**
 * synthVoiceHelper.ts
 * Synthétiseur Web Audio doux style Pífano / Flûte guide.
 * Déclenchement d'une enveloppe continue unifiée sur les notes tenues ('───')
 * avec support du décalage temporel (seekStartSec).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToFrequency } from '../utils/noteUtils';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';

export interface SynthScheduledNode {
  stop: () => void;
  disconnect: () => void;
}

export function playSingleSynthNote(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  startTime: number,
  durationSec: number
): SynthScheduledNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  const freq = midiToFrequency(midi);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(3000, freq * 3.5), startTime);
  filter.Q.setValueAtTime(0.8, startTime);

  // Enveloppe ADSR douce (zéro clic)
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
  let i = 0;

  const beatDurationSec = stepDurationSec * 4;
  while (i < steps.length) {
    const step = steps[i];
    if (step.tripletSlot !== 'unused' && step.active && step.note !== '───' && step.midiNumber > 0) {
      const endIdx = findLastTiedStepIndex(steps, i);
      const { startSec: noteStartTime, endSec: noteEndTime } = getStepTimeWindowSec(
        steps, i, startOffsetSec, beatDurationSec
      );

      if (noteEndTime > seekStartSec + 0.005) {
        let actualStart = startTime;
        let actualDuration = noteEndTime - noteStartTime;

        if (noteStartTime >= seekStartSec) {
          actualStart = startTime + (noteStartTime - seekStartSec);
        } else {
          actualDuration = noteEndTime - seekStartSec;
        }

        const node = playSingleSynthNote(ctx, dest, step.midiNumber, actualStart, actualDuration);
        nodes.push(node);
      }

      i = endIdx + 1;
    } else {
      i++;
    }
  }

  return nodes;
}
