/**
 * harmonySynthVoice.ts
 * Synthèse élémentaire Web Audio pour l'accompagnement harmonique multi-univers (< 130 lignes).
 * Utilise l'horloge native AudioContext, enveloppes douces sans clic et déconnexion propre.
 */

export interface ScheduledVoiceNode {
  stop: () => void;
  disconnect: () => void;
}

export function playPolyphonicChordNote(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  startTime: number,
  durationSec: number,
  volume = 0.5,
  nodesList?: ScheduledVoiceNode[]
): void {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, startTime);
  filter.frequency.exponentialRampToValueAtTime(750, startTime + durationSec);
  filter.Q.setValueAtTime(1.5, startTime);

  const peakGain = Math.max(0.0001, volume * 0.18);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain * 0.6), startTime + Math.min(0.15, durationSec * 0.5));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(filter); filter.connect(gain); gain.connect(dest);
  osc.start(startTime); osc.stop(startTime + durationSec + 0.05);

  nodesList?.push({
    stop: () => { try { osc.stop(); } catch {} },
    disconnect: () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} },
  });
}

export function playBassNote(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  startTime: number,
  durationSec: number,
  volume = 0.5,
  nodesList?: ScheduledVoiceNode[]
): void {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(320, startTime);

  const peakGain = Math.max(0.0001, volume * 0.35);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain * 0.7), startTime + Math.min(0.2, durationSec * 0.6));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(filter); filter.connect(gain); gain.connect(dest);
  osc.start(startTime); osc.stop(startTime + durationSec + 0.05);

  nodesList?.push({
    stop: () => { try { osc.stop(); } catch {} },
    disconnect: () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} },
  });
}

export function playBerimbauHit(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  isOpen: boolean,
  startTime: number,
  durationSec: number,
  volume = 0.5,
  nodesList?: ScheduledVoiceNode[]
): void {
  const noteMidi = isOpen ? midi : midi + 2; // Tom Aberto / Tom Preso (+2 ST)
  const freq = 440 * Math.pow(2, (noteMidi - 69) / 12);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(freq, startTime);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2, startTime);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(isOpen ? 650 : 850, startTime);
  filter.Q.setValueAtTime(isOpen ? 3.5 : 5.0, startTime);

  const peakGain = Math.max(0.0001, volume * 0.28);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + (isOpen ? durationSec : durationSec * 0.6));

  osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(dest);
  osc1.start(startTime); osc2.start(startTime);
  osc1.stop(startTime + durationSec + 0.05); osc2.stop(startTime + durationSec + 0.05);

  nodesList?.push({
    stop: () => { try { osc1.stop(); osc2.stop(); } catch {} },
    disconnect: () => { try { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} },
  });
}
