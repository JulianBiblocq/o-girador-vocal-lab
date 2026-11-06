/**
 * metronomeAudioNodes.ts
 * Nœuds audio Web Audio pour le métronome :
 * - Clic boisé doux pendant l'écoute témoin / attente
 * - Double clic clave d'appel à 1400 Hz sur les 2 derniers temps avant l'entrée
 * - Clic normal (Temps 1 à 1000 Hz, Temps 2-3-4 à 700 Hz, et +T1) (< 115 lignes).
 */
import { noteToFrequency } from '../utils/musicalMath';
import { getSavedClickVolume } from '../utils/clickVolumeStorage';

export function scheduleWoodClick(
  ctx: AudioContext,
  time: number,
  isMajor: boolean,
  activeNodes: (AudioNode | AudioScheduledSourceNode)[],
  volumeMultiplier?: number,
  isSoftBackground = false
): void {
  const baseVol = volumeMultiplier ?? getSavedClickVolume();
  const vol = isSoftBackground ? baseVol * 0.55 : baseVol;
  if (vol <= 0.01) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const duration = 0.025;
  osc.type = 'triangle';
  const startFreq = isMajor ? 1000 : 700;
  const endFreq = isMajor ? 240 : 170;
  osc.frequency.setValueAtTime(startFreq, time);
  osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

  const baseGain = isMajor ? 0.78 : 0.46;
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

export function scheduleCallDoubleClick(
  ctx: AudioContext,
  time: number,
  beatDurationSec: number,
  activeNodes: (AudioNode | AudioScheduledSourceNode)[],
  volumeMultiplier?: number
): void {
  const vol = volumeMultiplier ?? getSavedClickVolume();
  if (vol <= 0.01) return;
  const secondOffset = Math.min(0.11, Math.max(0.06, beatDurationSec * 0.22));
  const offsets = [0, secondOffset];

  for (const off of offsets) {
    const t = time + off;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dur = 0.022;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + dur);

    const targetGain = Math.min(1.5, 0.82 * vol);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(targetGain, t + 0.0018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    activeNodes.push(osc, gain);
    osc.start(t);
    osc.stop(t + dur);
    osc.onended = () => {
      osc.disconnect(); gain.disconnect();
      const i1 = activeNodes.indexOf(osc);
      if (i1 !== -1) activeNodes.splice(i1, 1);
      const i2 = activeNodes.indexOf(gain);
      if (i2 !== -1) activeNodes.splice(i2, 1);
    };
  }
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
