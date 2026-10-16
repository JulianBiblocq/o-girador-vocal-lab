/**
 * ambitusSynthPlayer.ts
 * Synthétiseur de référence vocal riche en harmoniques (fondamentale + octave 2*f0).
 * Assure une parfaite audibilité des notes graves (B2, G2) sur petits haut-parleurs.
 * Enveloppe anti-cloc 50ms sans coupure matérielle. Strictement < 100 lignes.
 */
import { getSharedAudioContext } from './sharedAudioContext';
import { midiToFrequency } from '../utils/noteUtils';

export interface SustainedSynthController {
  stop: () => void;
  updatePitch: (midi: number) => void;
  setGain: (gain: number) => void;
}

export async function playSustainedReferenceMidi(
  midi: number,
  durationSec: number,
  gainLevel = 0.45
): Promise<SustainedSynthController> {
  const ctx = await getSharedAudioContext();
  const freq = midiToFrequency(midi);
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const masterGain = ctx.createGain();

  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, now);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(0.7, now);

  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.35, now);
  osc1.connect(g1);
  g1.connect(filter);

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15, now);
  osc2.connect(g2);
  g2.connect(filter);

  const attack = 0.05;
  const release = 0.08;
  const sustainTime = Math.max(now + attack, now + durationSec - release);

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.linearRampToValueAtTime(gainLevel, now + attack);
  masterGain.gain.setValueAtTime(gainLevel, sustainTime);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + durationSec + 0.1);
  osc2.stop(now + durationSec + 0.1);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      const stopNow = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(stopNow);
      masterGain.gain.setValueAtTime(masterGain.gain.value, stopNow);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, stopNow + 0.03);
      osc1.stop(stopNow + 0.035);
      osc2.stop(stopNow + 0.035);
      setTimeout(() => {
        try {
          osc1.disconnect(); osc2.disconnect();
          g1.disconnect(); g2.disconnect();
          filter.disconnect(); masterGain.disconnect();
        } catch {}
      }, 50);
    } catch {}
  };

  const updatePitch = (newMidi: number) => {
    const newFreq = midiToFrequency(newMidi);
    const updateNow = ctx.currentTime;
    osc1.frequency.setValueAtTime(newFreq, updateNow);
    osc2.frequency.setValueAtTime(newFreq * 2, updateNow);
  };

  const setGain = (newGain: number) => {
    const gainNow = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(gainNow);
    masterGain.gain.linearRampToValueAtTime(newGain, gainNow + 0.05);
  };

  return { stop, updatePitch, setGain };
}
