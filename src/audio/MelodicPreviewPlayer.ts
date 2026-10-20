/**
 * MelodicPreviewPlayer.ts
 * Lecteur d'écoute comparative 3-états ('voice', 'synth', 'duo')
 * avec support du Seek, playhead synchrone 60 FPS et transposition de déclinaison.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { PatternHarmonyGrid, HarmonyConfig } from '../types/harmony.types';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { playSingleSynthNote, scheduleMelodySteps, type SynthScheduledNode } from './synthVoiceHelper';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { schedulePreviewClick } from './previewClickHelper';
import { HarmonyPlayerEngine } from './harmony/HarmonyPlayerEngine';

export type MelodicPlayMode = 'voice' | 'synth' | 'duo';

export interface MelodicPlayOptions {
  cleanPCM: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  allSteps: VocalStepData[];
  bpm: number;
  beatsPerMeasure: number;
  playMode: MelodicPlayMode;
  clickEnabled: boolean;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  pitchShiftSemitones?: number;
  seekStartSec?: number;
  outputDeviceId?: string;
  harmonyGrid?: PatternHarmonyGrid;
  harmonyConfig?: HarmonyConfig;
  measuresCount?: number;
  onEnded?: () => void;
}

export class MelodicPreviewPlayer {
  private ctx: AudioContext | null = null;
  private voiceGainNode: GainNode | null = null;
  private synthGainNode: GainNode | null = null;
  private clickGainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private synthNodes: SynthScheduledNode[] = [];
  private activeClickNodes: AudioNode[] = [];
  private harmonyEngine = new HarmonyPlayerEngine();
  private isPlaying = false;
  private playbackContextStartTime = 0;
  private totalDuration = 0;
  private seekStartSec = 0;
  private playRemainingDuration = 0;
  private stopTimerId: number | null = null;

  public async play(options: MelodicPlayOptions): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    if (options.outputDeviceId) await setSharedSinkId(options.outputDeviceId);

    const { cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure, playMode, clickEnabled, pitchShiftSemitones, onEnded } = options;
    this.totalDuration = totalDurationSec;
    this.seekStartSec = Math.max(0, Math.min(totalDurationSec - 0.05, options.seekStartSec || 0));
    this.playRemainingDuration = totalDurationSec - this.seekStartSec;

    this.voiceGainNode = this.ctx.createGain();
    this.synthGainNode = this.ctx.createGain();
    this.clickGainNode = this.ctx.createGain();
    this.applyGains(playMode, clickEnabled);

    this.voiceGainNode.connect(this.ctx.destination);
    this.synthGainNode.connect(this.ctx.destination);
    this.clickGainNode.connect(this.ctx.destination);

    const audioBuffer = this.ctx.createBuffer(1, cleanPCM.length, sampleRate);
    audioBuffer.getChannelData(0).set(cleanPCM);
    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.voiceGainNode);

    const now = this.ctx.currentTime + 0.03;
    this.playbackContextStartTime = now;
    this.isPlaying = true;
    this.sourceNode.start(now, this.seekStartSec, this.playRemainingDuration);

    const beatDuration = 60 / bpm, stepDuration = beatDuration / 4;
    const t1 = options.t1OffsetSec ?? getPatternT1OffsetSec(options.hasAnacrusis, beatsPerMeasure * beatDuration);
    const startOffsetSec = options.hasAnacrusis === false ? t1 : 0;
    const effectiveSteps = (pitchShiftSemitones && pitchShiftSemitones !== 0)
      ? allSteps.map((s) => (s.active && s.midiNumber > 0 && s.note !== '───') ? { ...s, midiNumber: s.midiNumber + pitchShiftSemitones } : s)
      : allSteps;
    this.synthNodes = scheduleMelodySteps(this.ctx, this.synthGainNode, effectiveSteps, stepDuration, now, this.seekStartSec, startOffsetSec);

    if (options.harmonyConfig?.enabled && options.harmonyGrid) {
      this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
        grid: options.harmonyGrid, bpm, beatsPerMeasure, measuresCount: options.measuresCount || 2,
        startTime: now, totalDurationSec, hasAnacrusis: options.hasAnacrusis, pitchShiftSemitones,
        profile: options.harmonyConfig.profile, volume: options.harmonyConfig.volume,
        muteBass: options.harmonyConfig.muteBass, seekStartSec: this.seekStartSec,
      });
    }

    for (let t = t1 - beatDuration; t >= 0; t -= beatDuration) {
      if (t >= this.seekStartSec && this.clickGainNode) schedulePreviewClick(this.ctx, now + (t - this.seekStartSec), t < 0.01, this.clickGainNode, this.activeClickNodes);
    }
    for (let k = 0; ; k++) {
      const beatGridTime = t1 + k * beatDuration;
      if (beatGridTime >= totalDurationSec - 0.01) break;
      if (beatGridTime >= this.seekStartSec && this.clickGainNode) schedulePreviewClick(this.ctx, now + (beatGridTime - this.seekStartSec), k % beatsPerMeasure === 0, this.clickGainNode, this.activeClickNodes);
    }

    this.stopTimerId = window.setTimeout(() => { this.stop(); onEnded?.(); }, (this.playRemainingDuration + 0.05) * 1000);
  }

  public setPlayMode(mode: MelodicPlayMode, clickEnabled = true): void { this.applyGains(mode, clickEnabled); }

  public async playNotePreview(midi: number): Promise<void> {
    const ctx = await getSharedAudioContext();
    playSingleSynthNote(ctx, ctx.destination, midi, ctx.currentTime, 0.18);
  }

  private applyGains(mode: MelodicPlayMode, clickEnabled: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.voiceGainNode) this.voiceGainNode.gain.setValueAtTime(mode === 'voice' || mode === 'duo' ? 1 : 0, t);
    if (this.synthGainNode) this.synthGainNode.gain.setValueAtTime(mode === 'synth' || mode === 'duo' ? 0.9 : 0, t);
    if (this.clickGainNode) this.clickGainNode.gain.setValueAtTime(clickEnabled ? 1 : 0, t);
  }

  public stop(): void {
    if (this.stopTimerId !== null) { window.clearTimeout(this.stopTimerId); this.stopTimerId = null; }
    if (this.sourceNode) { try { this.sourceNode.stop(); this.sourceNode.disconnect(); } catch {} this.sourceNode = null; }
    for (const node of this.synthNodes) { node.stop(); node.disconnect(); }
    this.synthNodes = [];
    for (const node of this.activeClickNodes) { try { (node as any).stop?.(); node.disconnect(); } catch {} }
    this.activeClickNodes = [];
    this.harmonyEngine.stop();
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return this.seekStartSec;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    return elapsed < 0 ? this.seekStartSec : Math.min(this.totalDuration, this.seekStartSec + elapsed);
  }

  public getIsPlaying(): boolean { return this.isPlaying; }
}
