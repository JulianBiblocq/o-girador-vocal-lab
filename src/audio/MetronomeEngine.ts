/**
 * MetronomeEngine.ts
 * Moteur d'horloge Web Audio temps réel haute précision (60 FPS sync).
 * Respect strict de la Règle 6.C (nettoyage des nœuds, pas de fuite mémoire).
 */
import type { TimeSignatureString } from '../types/vocalPack.types';

export type ListeningMode = 'headphones' | 'speakers';

export interface MetronomeConfig {
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  referencePitch: string;
  listeningMode: ListeningMode;
  outputDeviceId?: string;
}

export interface CycleStatus {
  phase: 'idle' | 'anacrusis' | 'singing' | 'completed';
  currentMeasure: number;
  currentBeat: number;
  beatsPerMeasure: number;
  beatIndexInCycle: number;
  beatProgress: number;
  elapsedSec: number;
  totalDurationSec: number;
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

export function noteToFrequency(note: string): number {
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 440;
  const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_TO_SEMITONE[noteName] ?? 9;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getBeatsPerMeasure(timeSignature: TimeSignatureString): number {
  switch (timeSignature) {
    case '2/4': return 2;
    case '3/4': return 3;
    case '6/8': return 2;
    case '12/8': return 4;
    case '4/4':
    default:
      return 4;
  }
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private startTime = 0;
  private totalDurationSec = 0;
  private beatDurationSec = 0;
  private totalBeats = 0;
  private beatsPerMeasure = 4;
  private measuresCount = 1;
  private activeNodes: AudioNode[] = [];
  private completionTimerId: number | null = null;
  private onCompleteCallback: (() => void) | null = null;

  public async initContext(outputDeviceId?: string): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    if (outputDeviceId && 'setSinkId' in this.ctx && typeof (this.ctx as any).setSinkId === 'function') {
      try {
        await (this.ctx as any).setSinkId(outputDeviceId);
      } catch (err) {
        console.warn('setSinkId non supporté ou refusé :', err);
      }
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public async startCycle(
    config: MetronomeConfig,
    onComplete?: () => void,
    externalStartTime?: number
  ): Promise<number> {
    this.stop();

    const ctx = await this.initContext(config.outputDeviceId);
    this.onCompleteCallback = onComplete ?? null;
    this.isRunning = true;
    this.measuresCount = Math.max(1, Math.min(4, config.measuresCount));
    this.beatsPerMeasure = getBeatsPerMeasure(config.timeSignature);
    this.beatDurationSec = 60 / config.bpm;

    const anacrusisBeats = this.beatsPerMeasure;
    const singingBeats = this.measuresCount * this.beatsPerMeasure;
    this.totalBeats = anacrusisBeats + singingBeats;
    this.totalDurationSec = this.totalBeats * this.beatDurationSec;

    this.startTime = externalStartTime ?? (ctx.currentTime + 0.05);

    if (config.listeningMode === 'headphones') {
      this.scheduleHeadphoneAudio(ctx, this.startTime, config);
    }

    const delayMs = Math.max(10, (this.startTime - ctx.currentTime + this.totalDurationSec) * 1000);
    this.completionTimerId = window.setTimeout(() => {
      this.handleCycleCompletion();
    }, delayMs);

    return this.startTime;
  }

  public stop(): void {
    if (this.completionTimerId !== null) {
      window.clearTimeout(this.completionTimerId);
      this.completionTimerId = null;
    }

    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignorer
      }
    }
    this.activeNodes = [];
    this.isRunning = false;
  }

  public async playReferencePitchPreview(noteName: string, durationSec = 1.5, outputDeviceId?: string): Promise<void> {
    this.stop();
    const ctx = await this.initContext(outputDeviceId);
    const freq = noteToFrequency(noteName);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
    gain.gain.setValueAtTime(0.35, now + durationSec - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.activeNodes.push(osc, filter, gain);

    osc.start(now);
    osc.stop(now + durationSec);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(osc);
      if (idx !== -1) this.activeNodes.splice(idx, 3);
    };
  }

  public getCycleStatus(): CycleStatus {
    if (!this.isRunning || !this.ctx) {
      return {
        phase: 'idle', currentMeasure: -1, currentBeat: 0,
        beatsPerMeasure: this.beatsPerMeasure, beatIndexInCycle: 0,
        beatProgress: 0, elapsedSec: 0, totalDurationSec: this.totalDurationSec
      };
    }

    const elapsed = this.ctx.currentTime - this.startTime;

    if (elapsed < 0) {
      return {
        phase: 'anacrusis', currentMeasure: -1, currentBeat: 0,
        beatsPerMeasure: this.beatsPerMeasure, beatIndexInCycle: 0,
        beatProgress: 0, elapsedSec: 0, totalDurationSec: this.totalDurationSec
      };
    }

    if (elapsed >= this.totalDurationSec) {
      return {
        phase: 'completed', currentMeasure: this.measuresCount - 1,
        currentBeat: this.beatsPerMeasure - 1, beatsPerMeasure: this.beatsPerMeasure,
        beatIndexInCycle: this.totalBeats - 1, beatProgress: 1,
        elapsedSec: this.totalDurationSec, totalDurationSec: this.totalDurationSec
      };
    }

    const totalBeatFraction = elapsed / this.beatDurationSec;
    const beatIndexInCycle = Math.floor(totalBeatFraction);
    const beatProgress = totalBeatFraction - beatIndexInCycle;

    const isAnacrusis = beatIndexInCycle < this.beatsPerMeasure;
    const phase = isAnacrusis ? 'anacrusis' : 'singing';
    const currentMeasure = isAnacrusis ? -1 : Math.floor((beatIndexInCycle - this.beatsPerMeasure) / this.beatsPerMeasure);
    const currentBeat = isAnacrusis ? beatIndexInCycle : (beatIndexInCycle - this.beatsPerMeasure) % this.beatsPerMeasure;

    return {
      phase, currentMeasure, currentBeat, beatsPerMeasure: this.beatsPerMeasure,
      beatIndexInCycle, beatProgress, elapsedSec: elapsed, totalDurationSec: this.totalDurationSec
    };
  }

  public getIsRunning(): boolean { return this.isRunning; }
  public getBeatDurationSec(): number { return this.beatDurationSec; }

  private scheduleHeadphoneAudio(ctx: AudioContext, start: number, config: MetronomeConfig): void {
    for (let b = 0; b < this.totalBeats; b++) {
      const beatTime = start + b * this.beatDurationSec;
      const isMajorBeat = b % this.beatsPerMeasure === 0;
      this.scheduleWoodClick(ctx, beatTime, isMajorBeat);
    }
    const pitchDurationSec = this.beatsPerMeasure * this.beatDurationSec;
    this.scheduleReferencePitch(ctx, start, config.referencePitch, pitchDurationSec);
  }

  private scheduleWoodClick(ctx: AudioContext, time: number, isMajor: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startFreq = isMajor ? 1400 : 900;
    const endFreq = isMajor ? 260 : 180;
    const duration = 0.025;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(isMajor ? 0.6 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    this.activeNodes.push(osc, gain);

    osc.start(time);
    osc.stop(time + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const i1 = this.activeNodes.indexOf(osc);
      if (i1 !== -1) this.activeNodes.splice(i1, 1);
      const i2 = this.activeNodes.indexOf(gain);
      if (i2 !== -1) this.activeNodes.splice(i2, 1);
    };
  }

  private scheduleReferencePitch(ctx: AudioContext, startTime: number, noteName: string, durationSec: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const freq = noteToFrequency(noteName);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.04);
    gain.gain.setValueAtTime(0.28, startTime + durationSec - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.activeNodes.push(osc, filter, gain);

    osc.start(startTime);
    osc.stop(startTime + durationSec);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(osc);
      if (idx !== -1) this.activeNodes.splice(idx, 3);
    };
  }

  private handleCycleCompletion(): void {
    this.stop();
    if (this.onCompleteCallback) this.onCompleteCallback();
  }
}
