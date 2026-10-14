/**
 * metronomeAudioNodes.ts
 * Nœuds audio Web Audio pour le métronome et la note repère.
 */
import { noteToFrequency } from '../utils/musicalMath';

export function scheduleWoodClick(
  ctx: AudioContext,
  time: number,
  isMajor: boolean,
  activeNodes: (AudioNode | AudioScheduledSourceNode)[]
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const duration = 0.025;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isMajor ? 1400 : 900, time);
  osc.frequency.exponentialRampToValueAtTime(isMajor ? 260 : 180, time + duration);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(isMajor ? 0.6 : 0.35, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  activeNodes.push(osc, gain);
  osc.start(time);
  osc.stop(time + duration);

  osc.onended = () => {
    osc.disconnect(); gain.disconnect();
    const i1 = activeNodes.indexOf(osc);
    if (i1 !== -1) activeNodes.splice(i1, 1);
    const i2 = activeNodes.indexOf(gain);
    if (i2 !== -1) activeNodes.splice(i2, 1);
  };
}

export function scheduleReferencePitch(
  ctx: AudioContext,
  startTime: number,
  noteName: string,
  durationSec: number,
  activeNodes: (AudioNode | AudioScheduledSourceNode)[]
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const freq = noteToFrequency(noteName);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.15, startTime + 0.03);
  gain.gain.setValueAtTime(0.15, startTime + durationSec - 0.03);
  gain.gain.linearRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  activeNodes.push(osc, filter, gain);
  osc.start(startTime);
  osc.stop(startTime + durationSec);

  osc.onended = () => {
    osc.disconnect(); filter.disconnect(); gain.disconnect();
    const idx = activeNodes.indexOf(osc);
    if (idx !== -1) activeNodes.splice(idx, 3);
  };
}
