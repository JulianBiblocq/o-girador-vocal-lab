/**
 * MetronomeEngine.ts
 * Moteur d horloge Web Audio temps reel haute precision (60 FPS sync).
 * Cycle a 3 etages : Decompte (M-2) -> Anacrouse (M-1) -> Chant (M1..MN).
 */
import type { TimeSignatureString } from '../types/vocalPack.types';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { scheduleWoodClick, scheduleReferencePitch } from './metronomeAudioNodes';
import { computeCycleStatus, type CycleStatus } from './cycleStatusHelper';

export { getBeatsPerMeasure };
export type { CycleStatus };
export type ListeningMode = 'headphones' | 'speakers';

export interface MetronomeConfig {
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  referencePitch: string;
  listeningMode: ListeningMode;
  outputDeviceId?: string;
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private startTime = 0;
  private totalDurationSec = 0;
  private beatDurationSec = 0;
  private beatsPerMeasure = 4;
  private measuresCount = 2;
  private totalBeats = 16;
  private completionTimerId: number | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];

  public async setOutputDevice(deviceId: string): Promise<void> {
    await setSharedSinkId(deviceId);
  }

  public async initContext(outputDeviceId?: string): Promise<AudioContext> {
    this.ctx = await getSharedAudioContext();
    if (outputDeviceId && outputDeviceId !== 'default') {
      await this.setOutputDevice(outputDeviceId);
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

    // 1 mesure de decompte (M-2) + 1 mesure d anacrouse (M-1) + N mesures de chant
    this.totalBeats = (2 + this.measuresCount) * this.beatsPerMeasure;
    this.totalDurationSec = this.totalBeats * this.beatDurationSec;
    this.startTime = externalStartTime ?? (ctx.currentTime + 0.08);

    if (config.listeningMode === 'headphones') {
      this.scheduleHeadphoneAudio(ctx, this.startTime, config);
    }

    const delayMs = Math.max(10, (this.startTime - ctx.currentTime + this.totalDurationSec) * 1000);
    this.completionTimerId = window.setTimeout(() => this.handleCycleCompletion(), delayMs);
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
      } catch { /* Ignorer */ }
    }
    this.activeNodes = [];
    this.isRunning = false;
  }

  public async playReferencePitchPreview(noteName: string, durationSec = 1.5, outputDeviceId?: string): Promise<void> {
    this.stop();
    const ctx = await this.initContext(outputDeviceId);
    scheduleReferencePitch(ctx, ctx.currentTime, noteName, durationSec, this.activeNodes);
  }

  public getCycleStatus(): CycleStatus {
    return computeCycleStatus({
      isRunning: this.isRunning, ctx: this.ctx, startTime: this.startTime,
      totalDurationSec: this.totalDurationSec, beatDurationSec: this.beatDurationSec,
      beatsPerMeasure: this.beatsPerMeasure, measuresCount: this.measuresCount,
      totalBeats: this.totalBeats,
    });
  }

  public getIsRunning(): boolean { return this.isRunning; }
  public getBeatDurationSec(): number { return this.beatDurationSec; }

  private scheduleHeadphoneAudio(ctx: AudioContext, start: number, config: MetronomeConfig): void {
    for (let b = 0; b < this.totalBeats; b++) {
      const beatTime = start + b * this.beatDurationSec;
      const isMajorBeat = b % this.beatsPerMeasure === 0;
      scheduleWoodClick(ctx, beatTime, isMajorBeat, this.activeNodes);
    }
    // La note repère ne joue STRICTEMENT que pendant le décompte M-2
    const pitchDurationSec = this.beatsPerMeasure * this.beatDurationSec;
    scheduleReferencePitch(ctx, start, config.referencePitch, pitchDurationSec, this.activeNodes);
  }

  private handleCycleCompletion(): void {
    this.stop();
    if (this.onCompleteCallback) this.onCompleteCallback();
  }
}
