/**
 * tonicDroneSynth.ts
 * Synthétiseur de Bourdon Tonique continu non fatigant (fondamentale filtrée + quinte -14 dB + octave légère)
 * et ping de note repère unique accordés sur referencePitchHz (< 120 lignes).
 */
import { getSharedAudioContext, registerAudioKillSwitch } from './sharedAudioContext';
import { getTonicSemitone } from './scaleQuantizer';
import { sanitizePitchHz } from '../utils/pitchHzContract';

export function midiToHzWithDiapason(midiNote: number, referencePitchHz?: number): number {
  const a4 = sanitizePitchHz(referencePitchHz);
  return a4 * Math.pow(2, (midiNote - 69) / 12);
}

export function resolveTonicDroneMidi(tonicRoot: string, octave = 3): number {
  const semi = getTonicSemitone(tonicRoot || 'C');
  return (octave + 1) * 12 + semi;
}

class TonicDroneController {
  private oscs: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private active = false;
  private currentTonic = 'C';
  private currentHz = 440;
  private unregisterKill: (() => void) | null = null;

  public isPlaying(): boolean {
    return this.active;
  }

  public async start(tonicRoot: string, referencePitchHz = 440, volume = 0.18): Promise<void> {
    this.stopImmediate();
    const ctx = await getSharedAudioContext();
    if (ctx.state !== 'running') await ctx.resume();

    this.currentTonic = tonicRoot || 'C';
    this.currentHz = sanitizePitchHz(referencePitchHz);
    const rootMidi = resolveTonicDroneMidi(this.currentTonic, 3);
    const f0 = midiToHzWithDiapason(rootMidi, this.currentHz);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(1400, f0 * 3.4), ctx.currentTime);
    filter.Q.setValueAtTime(0.65, ctx.currentTime);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(Math.max(0.02, Math.min(0.45, volume)), ctx.currentTime + 0.06);
    filter.connect(master);
    master.connect(ctx.destination);

    // Fondamentale chaude + Quinte douce (-14 dB ≈ x0.20) + Octave légère (-12 dB ≈ x0.25 pour HP téléphone)
    const voices: Array<{ semiOffset: number; type: OscillatorType; relGain: number }> = [
      { semiOffset: 0, type: 'sawtooth', relGain: 0.55 },
      { semiOffset: 0, type: 'triangle', relGain: 0.45 },
      { semiOffset: 7, type: 'triangle', relGain: 0.20 },
      { semiOffset: 12, type: 'sine', relGain: 0.25 },
    ];

    this.oscs = [];
    this.gains = [];
    for (const v of voices) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(midiToHzWithDiapason(rootMidi + v.semiOffset, this.currentHz), ctx.currentTime);
      g.gain.setValueAtTime(v.relGain, ctx.currentTime);
      osc.connect(g);
      g.connect(filter);
      osc.start(ctx.currentTime);
      this.oscs.push(osc);
      this.gains.push(g);
    }

    this.filter = filter;
    this.masterGain = master;
    this.active = true;
    this.unregisterKill = registerAudioKillSwitch('tonic-drone-synth', () => this.stopImmediate());
  }

  public updatePitch(tonicRoot: string, referencePitchHz = 440): void {
    if (!this.active || !this.oscs.length || !this.filter) return;
    this.currentTonic = tonicRoot || 'C';
    this.currentHz = sanitizePitchHz(referencePitchHz);
    const rootMidi = resolveTonicDroneMidi(this.currentTonic, 3);
    const now = this.filter.context.currentTime;
    const offsets = [0, 0, 7, 12];
    this.oscs.forEach((osc, idx) => {
      osc.frequency.setTargetAtTime(midiToHzWithDiapason(rootMidi + (offsets[idx] ?? 0), this.currentHz), now, 0.03);
    });
    this.filter.frequency.setTargetAtTime(Math.min(1400, midiToHzWithDiapason(rootMidi, this.currentHz) * 3.4), now, 0.03);
  }

  public stopImmediate(): void {
    this.active = false;
    if (this.unregisterKill) { this.unregisterKill(); this.unregisterKill = null; }
    for (const o of this.oscs) { try { o.stop(); o.disconnect(); } catch {} }
    for (const g of this.gains) { try { g.disconnect(); } catch {} }
    try { this.filter?.disconnect(); } catch {}
    try { this.masterGain?.disconnect(); } catch {}
    this.oscs = []; this.gains = []; this.filter = null; this.masterGain = null;
  }
}

export const sharedTonicDrone = new TonicDroneController();

export async function playReferenceNotePing(midiNote: number, referencePitchHz = 440, durationMs = 620): Promise<number> {
  const ctx = await getSharedAudioContext();
  if (ctx.state !== 'running') await ctx.resume();
  const durSec = Math.max(0.15, durationMs / 1000), now = ctx.currentTime, freq = midiToHzWithDiapason(midiNote, referencePitchHz);
  const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator(), flt = ctx.createBiquadFilter(), gain = ctx.createGain();
  osc1.type = 'triangle'; osc1.frequency.setValueAtTime(freq, now);
  osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 2, now);
  flt.type = 'lowpass'; flt.frequency.setValueAtTime(2100, now);
  gain.gain.setValueAtTime(0.001, now); gain.gain.linearRampToValueAtTime(0.26, now + 0.018); gain.gain.exponentialRampToValueAtTime(0.0008, now + durSec);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.22, now);
  osc1.connect(flt); osc2.connect(g2); g2.connect(flt); flt.connect(gain); gain.connect(ctx.destination);
  osc1.start(now); osc2.start(now); osc1.stop(now + durSec + 0.02); osc2.stop(now + durSec + 0.02);
  osc1.onended = () => { try { osc1.disconnect(); osc2.disconnect(); g2.disconnect(); flt.disconnect(); gain.disconnect(); } catch {} };
  return durationMs + 120;
}
