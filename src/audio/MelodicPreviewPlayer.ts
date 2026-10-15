/**
 * MelodicPreviewPlayer.ts
 * Lecteur d'écoute comparative 3-états ('voice', 'synth', 'duo')
 * avec support du Seek, playhead synchrone 60 FPS et transposition de déclinaison.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { getSavedClickVolume } from '../utils/clickVolumeStorage';
import { playSingleSynthNote, scheduleMelodySteps, type SynthScheduledNode } from './synthVoiceHelper';

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
  pitchShiftSemitones?: number;
  seekStartSec?: number;
  outputDeviceId?: string;
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

    const beatDuration = 60 / bpm;
    const stepDuration = beatDuration / 4;
    const effectiveSteps = (pitchShiftSemitones && pitchShiftSemitones !== 0)
      ? allSteps.map((s) => (s.active && s.midiNumber > 0 && s.note !== '───') ? { ...s, midiNumber: s.midiNumber + pitchShiftSemitones } : s)
      : allSteps;
    this.synthNodes = scheduleMelodySteps(this.ctx, this.synthGainNode, effectiveSteps, stepDuration, now, this.seekStartSec);

    const totalBeats = Math.ceil(totalDurationSec / beatDuration);
    for (let b = 0; b < totalBeats; b++) {
      const beatGridTime = b * beatDuration;
      if (beatGridTime >= this.seekStartSec && beatGridTime < totalDurationSec - 0.01) {
        this.scheduleClick(this.ctx, now + (beatGridTime - this.seekStartSec), b % beatsPerMeasure === 0);
      }
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
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return this.seekStartSec;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    return elapsed < 0 ? this.seekStartSec : Math.min(this.totalDuration, this.seekStartSec + elapsed);
  }

  public getIsPlaying(): boolean { return this.isPlaying; }

  private scheduleClick(ctx: AudioContext, time: number, isMajor: boolean): void {
    const vol = getSavedClickVolume();
    if (vol <= 0.01) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isMajor ? 1600 : 1000, time);
    osc.frequency.exponentialRampToValueAtTime(isMajor ? 280 : 190, time + 0.02);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.min(1.2, (isMajor ? 0.6 : 0.35) * vol), time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    osc.connect(gain);
    if (this.clickGainNode) gain.connect(this.clickGainNode);
    this.activeClickNodes.push(osc, gain);
    osc.start(time);
    osc.stop(time + 0.02);
  }
}
