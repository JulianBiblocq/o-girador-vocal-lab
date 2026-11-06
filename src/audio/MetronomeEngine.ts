/**
 * MetronomeEngine.ts
 * Moteur d'horloge Web Audio temps réel haute précision (60 FPS sync) :
 * Clic doux d'attente, double clic clave d'appel à 1400 Hz sur les 2 temps avant l'entrée, et clic chant (< 138 lignes).
 */
import type { TimeSignatureString } from '../types/vocalPack.types';
import type { PatternHarmonyGrid, HarmonyConfig } from '../types/harmony.types';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { scheduleWoodClick, scheduleCallDoubleClick, scheduleReferencePitch } from './metronomeAudioNodes';
import { computeCycleStatus, type CycleStatus } from './cycleStatusHelper';
import { HarmonyPlayerEngine } from './harmony/HarmonyPlayerEngine';

export { getBeatsPerMeasure };
export type { CycleStatus };
export type ListeningMode = 'headphones' | 'speakers';

export interface MetronomeConfig {
  bpm: number; timeSignature: TimeSignatureString; measuresCount: number; referencePitch: string;
  listeningMode: ListeningMode; outputDeviceId?: string; preRollMeasures?: number;
  harmonyGrid?: PatternHarmonyGrid; harmonyConfig?: HarmonyConfig;
  hasAnacrusis?: boolean; anacrusisBeats?: number; pitchShiftSemitones?: number;
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null; private isRunning = false;
  private harmonyEngine = new HarmonyPlayerEngine();
  private startTime = 0; private totalDurationSec = 0; private beatDurationSec = 0;
  private beatsPerMeasure = 4; private measuresCount = 2; private preRollMeasures = 2; private hasAnacrusis = true;
  private totalBeats = 16; private completionTimerId: number | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];

  public async setOutputDevice(deviceId: string): Promise<void> { await setSharedSinkId(deviceId); }
  public async initContext(outputDeviceId?: string): Promise<AudioContext> {
    this.ctx = await getSharedAudioContext();
    if (outputDeviceId && outputDeviceId !== 'default') await this.setOutputDevice(outputDeviceId);
    return this.ctx;
  }
  public getContext(): AudioContext | null { return this.ctx; }

  public async startCycle(
    config: MetronomeConfig, onComplete?: () => void, externalStartTime?: number
  ): Promise<number> {
    this.stop();
    const ctx = await this.initContext(config.outputDeviceId);
    this.onCompleteCallback = onComplete ?? null;
    this.isRunning = true;
    this.measuresCount = Math.max(1, Math.min(4, config.measuresCount));
    this.beatsPerMeasure = getBeatsPerMeasure(config.timeSignature);
    this.beatDurationSec = 60 / config.bpm;
    this.preRollMeasures = config.preRollMeasures ?? 2;
    this.hasAnacrusis = config.hasAnacrusis !== false;

    this.totalBeats = (this.preRollMeasures + this.measuresCount) * this.beatsPerMeasure + 1;
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
    if (this.completionTimerId !== null) { window.clearTimeout(this.completionTimerId); this.completionTimerId = null; }
    for (const node of this.activeNodes) {
      try { if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') (node as AudioScheduledSourceNode).stop(); node.disconnect(); } catch {}
    }
    this.activeNodes = [];
    this.harmonyEngine.stop();
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
      totalBeats: this.totalBeats, preRollMeasures: this.preRollMeasures, hasAnacrusis: this.hasAnacrusis,
    });
  }

  public getIsRunning(): boolean { return this.isRunning; }
  public getBeatDurationSec(): number { return this.beatDurationSec; }

  private scheduleHeadphoneAudio(ctx: AudioContext, start: number, config: MetronomeConfig): void {
    const t1BeatIdx = this.preRollMeasures * this.beatsPerMeasure;
    const anacBeats = this.hasAnacrusis ? Math.max(1, Math.min(this.beatsPerMeasure, config.anacrusisBeats ?? 2)) : 0;
    const entryBeatIdx = Math.max(2, t1BeatIdx - anacBeats);

    for (let b = 0; b < this.totalBeats; b++) {
      const beatTime = start + b * this.beatDurationSec;
      const isMajorBeat = b % this.beatsPerMeasure === 0;
      if (b === entryBeatIdx - 2 || b === entryBeatIdx - 1) {
        scheduleCallDoubleClick(ctx, beatTime, this.beatDurationSec, this.activeNodes);
      } else {
        scheduleWoodClick(ctx, beatTime, isMajorBeat, this.activeNodes, undefined, b < entryBeatIdx - 2);
      }
    }

    scheduleReferencePitch(ctx, start, config.referencePitch, this.beatsPerMeasure * this.beatDurationSec, this.activeNodes);

    if (config.harmonyConfig?.enabled && config.harmonyGrid) {
      this.harmonyEngine.schedule(ctx, ctx.destination, {
        grid: config.harmonyGrid, bpm: config.bpm, beatsPerMeasure: this.beatsPerMeasure,
        measuresCount: this.measuresCount, startTime: start + t1BeatIdx * this.beatDurationSec,
        totalDurationSec: this.measuresCount * this.beatsPerMeasure * this.beatDurationSec,
        hasAnacrusis: config.hasAnacrusis, pitchShiftSemitones: config.pitchShiftSemitones,
        profile: config.harmonyConfig.profile, volume: config.harmonyConfig.volume, muteBass: config.harmonyConfig.muteBass,
      });
    }
  }

  private handleCycleCompletion(): void {
    this.stop();
    if (this.onCompleteCallback) this.onCompleteCallback();
  }
}
