/**
 * ambitusAudioEngine.ts
 * Moteur Web Audio de test d'ambitus : écoute micro stabilisée (150ms)
 * et pilotage du synthétiseur harmonique riche sans coupure matérielle.
 * Strictement < 125 lignes (Anti-Monolithe Rule 6.A).
 */
import { getSharedAudioContext } from './sharedAudioContext';
import { playSustainedReferenceMidi, type SustainedSynthController } from './ambitusSynthPlayer';
import { detectRealtimePitch } from './realtimePitchDetector';
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
  private synthCtrl: SustainedSynthController | null = null;
  private rafId: number | null = null;
  private isTesting = false;

  async playReferenceNote(targetMidi: number, durationSec = 1.8, gainLevel = 0.45): Promise<void> {
    this.stopReferenceNote();
    this.synthCtrl = await playSustainedReferenceMidi(targetMidi, durationSec, gainLevel);
  }

  stopReferenceNote(): void {
    if (this.synthCtrl) {
      this.synthCtrl.stop();
      this.synthCtrl = null;
    }
  }

  async startContinuousTone(targetMidi: number, volume = 0.22): Promise<void> {
    this.stopContinuousTone();
    this.synthCtrl = await playSustainedReferenceMidi(targetMidi, 120, volume);
  }

  updateContinuousTonePitch(newMidi: number): void {
    if (this.synthCtrl) {
      this.synthCtrl.updatePitch(newMidi);
    }
  }

  setContinuousToneGain(volume: number): void {
    if (this.synthCtrl) {
      this.synthCtrl.setGain(volume);
    }
  }

  stopContinuousTone(): void {
    this.stopReferenceNote();
  }

  async startListening(
    onTick: (tick: AmbitusLiveTick) => void,
    targetDurationSec = 2.0
  ): Promise<() => Promise<ValidationSample[]>> {
    const ctx = await getSharedAudioContext();
    this.stopListening(false);

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.micSource.connect(this.analyser);

    // Stabilisation matérielle du pilote audio (150 ms)
    await new Promise((r) => setTimeout(r, 150));

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
      this.stopListening(true);
      return samples;
    };
  }

  stopListening(stopSynth = true): void {
    this.isTesting = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.micSource) { try { this.micSource.disconnect(); } catch {} this.micSource = null; }
    if (this.analyser) { try { this.analyser.disconnect(); } catch {} this.analyser = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
    if (stopSynth) {
      this.stopReferenceNote();
    }
  }
}
