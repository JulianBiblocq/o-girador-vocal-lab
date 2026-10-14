/**
 * metronomeAudioNodes.ts
 * Nœuds audio Web Audio pour le métronome et la note repère.
 * Attaque percussive boostée (1600 Hz / 1000 Hz) et contrôle de volume matériel.
 */
import { noteToFrequency } from '../utils/musicalMath';
import { getSavedClickVolume } from '../utils/clickVolumeStorage';

export function scheduleWoodClick(
  ctx: AudioContext,
  time: number,
  isMajor: boolean,
  activeNodes: (AudioNode | AudioScheduledSourceNode)[],
  volumeMultiplier?: number
): void {
  const vol = volumeMultiplier ?? getSavedClickVolume();
  if (vol <= 0.01) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const duration = 0.025;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isMajor ? 1600 : 1000, time);
  osc.frequency.exponentialRampToValueAtTime(isMajor ? 280 : 190, time + duration);

  const baseGain = isMajor ? 0.75 : 0.45;
  const targetGain = Math.min(1.5, baseGain * vol);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(targetGain, time + 0.002);
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
  gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
  gain.gain.setValueAtTime(0.18, startTime + durationSec - 0.03);
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
