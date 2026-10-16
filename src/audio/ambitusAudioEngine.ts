/**
 * ambitusAudioEngine.ts
 * Moteur Web Audio de test d'ambitus : écoute micro, référence synthé et capture d'échantillons.
 * Support du synthétiseur continu dans l'oreille pendant le chant.
 * Strictement < 145 lignes.
 */
import { getSharedAudioContext } from './sharedAudioContext';
import { playSingleSynthNote, type SynthScheduledNode } from './synthVoiceHelper';
import { detectRealtimePitch } from './realtimePitchDetector';
import { midiToFrequency } from '../utils/noteUtils';
import type { ValidationSample } from './ambitusValidator';

export interface AmbitusLiveTick {
  pitchMidi: number;
  rms: number;
  progressRatio: number;
}

export class AmbitusAudioEngine {
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private synthRefNode: SynthScheduledNode | null = null;
  private continuousOsc: OscillatorNode | null = null;
  private continuousGain: GainNode | null = null;
  private continuousFilter: BiquadFilterNode | null = null;
  private rafId: number | null = null;
  private isTesting = false;

  async playReferenceNote(targetMidi: number, durationSec = 1.2): Promise<void> {
    const ctx = await getSharedAudioContext();
    this.stopReferenceNote();
    this.synthRefNode = playSingleSynthNote(ctx, ctx.destination, targetMidi, ctx.currentTime, durationSec);
  }

  stopReferenceNote(): void {
    if (this.synthRefNode) {
      try { this.synthRefNode.stop(); this.synthRefNode.disconnect(); } catch {}
      this.synthRefNode = null;
    }
  }

  async startContinuousTone(targetMidi: number, volume = 0.18): Promise<void> {
    const ctx = await getSharedAudioContext();
    this.stopContinuousTone();
    const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    const freq = midiToFrequency(targetMidi);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2800, freq * 3.5), ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc.start();
    this.continuousOsc = osc; this.continuousFilter = filter; this.continuousGain = gain;
  }

  updateContinuousTonePitch(newMidi: number): void {
    if (this.continuousOsc && this.continuousFilter) {
      const freq = midiToFrequency(newMidi), now = this.continuousOsc.context.currentTime;
      this.continuousOsc.frequency.setValueAtTime(freq, now);
      this.continuousFilter.frequency.setValueAtTime(Math.min(2800, freq * 3.5), now);
    }
  }

  stopContinuousTone(): void {
    if (this.continuousGain && this.continuousOsc) {
      try {
        const ctx = this.continuousGain.context;
        this.continuousGain.gain.setValueAtTime(this.continuousGain.gain.value, ctx.currentTime);
        this.continuousGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        this.continuousOsc.stop(ctx.currentTime + 0.05);
      } catch {}
      this.continuousOsc = null; this.continuousGain = null; this.continuousFilter = null;
    }
  }

  async startListening(
    onTick: (tick: AmbitusLiveTick) => void,
    targetDurationSec = 2.0
  ): Promise<() => Promise<ValidationSample[]>> {
    const ctx = await getSharedAudioContext();
    this.stopListening();
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.micSource.connect(this.analyser);

    const buffer = new Float32Array(this.analyser.fftSize);
    const samples: ValidationSample[] = [];
    const startTime = performance.now();
    this.isTesting = true;

    const loop = () => {
      if (!this.isTesting || !this.analyser) return;
      this.analyser.getFloatTimeDomainData(buffer);
      const { pitchMidi, rms } = detectRealtimePitch(buffer, ctx.sampleRate);
      const elapsedSec = (performance.now() - startTime) / 1000;
      if (pitchMidi > 0) samples.push({ timeSec: elapsedSec, pitchMidi, rms });
      const progressRatio = Math.min(1, elapsedSec / targetDurationSec);
      onTick({ pitchMidi, rms, progressRatio });
      if (elapsedSec < targetDurationSec + 0.1) this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
    return async (): Promise<ValidationSample[]> => {
      this.stopListening();
      return samples;
    };
  }

  stopListening(): void {
    this.isTesting = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.micSource) { try { this.micSource.disconnect(); } catch {} this.micSource = null; }
    if (this.analyser) { try { this.analyser.disconnect(); } catch {} this.analyser = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
    this.stopReferenceNote();
    this.stopContinuousTone();
  }
}
