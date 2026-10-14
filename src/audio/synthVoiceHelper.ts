/**
 * synthVoiceHelper.ts
 * Synthétiseur Web Audio doux style Pífano / Flûte guide.
 * Déclenchement d'une enveloppe continue unifiée sur les notes tenues ('───')
 * avec support du décalage temporel (seekStartSec).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToFrequency } from '../utils/noteUtils';

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
  seekStartSec = 0
): SynthScheduledNode[] {
  const nodes: SynthScheduledNode[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];
    if (step.active && step.note !== '───' && step.midiNumber > 0) {
      let tieCount = 0;
      while (i + 1 + tieCount < steps.length && steps[i + 1 + tieCount].note === '───') {
        tieCount++;
      }
      const noteStartTime = i * stepDurationSec;
      const noteEndTime = (i + 1 + tieCount) * stepDurationSec;

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

      i += 1 + tieCount;
    } else {
      i++;
    }
  }

  return nodes;
}
