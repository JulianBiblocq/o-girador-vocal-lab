/**
 * PreviewPlayer.ts
 * Lecteur de pre-ecoute synchrone avec clickGainNode temps reel et normalisation RMS.
 */
import { extractCompensatedSlice } from '../utils/wavEncoder';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { getSavedClickVolume } from '../utils/clickVolumeStorage';

export interface PreviewOptions {
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs: number;
  bpm: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  clickEnabled: boolean;
  highPassFilterEnabled?: boolean;
  normalizeRMS?: boolean;
  outputDeviceId?: string;
  onEnded?: () => void;
}

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private clickGainNode: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private isPlaying = false;
  private playheadStartCycleTime = 0;
  private playbackContextStartTime = 0;
  private playDuration = 0;
  private stopTimerId: number | null = null;

  public async play(rawPCM: Float32Array, sampleRate: number, options: PreviewOptions): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    if (options.outputDeviceId) await setSharedSinkId(options.outputDeviceId);

    const { trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, clickEnabled, highPassFilterEnabled, normalizeRMS, onEnded } = options;
    const cleanPCM = extractCompensatedSlice(rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, highPassFilterEnabled !== false, normalizeRMS !== false);

    this.playDuration = Math.max(0.05, trimEndSec - trimStartSec);
    this.playheadStartCycleTime = trimStartSec;

    const audioBuffer = this.ctx.createBuffer(1, cleanPCM.length, sampleRate);
    audioBuffer.getChannelData(0).set(cleanPCM);

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = audioBuffer;

    if (highPassFilterEnabled !== false) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(90, this.ctx.currentTime);
      hp.Q.setValueAtTime(0.707, this.ctx.currentTime);
      this.sourceNode.connect(hp);
      hp.connect(this.ctx.destination);
      this.activeNodes.push(hp);
    } else {
      this.sourceNode.connect(this.ctx.destination);
    }
    this.activeNodes.push(this.sourceNode);

    // Routage du clic tmoin via un gain commutable en direct
    this.clickGainNode = this.ctx.createGain();
    this.clickGainNode.gain.setValueAtTime(clickEnabled ? 1 : 0, this.ctx.currentTime);
    this.clickGainNode.connect(this.ctx.destination);
    this.activeNodes.push(this.clickGainNode);

    const now = this.ctx.currentTime + 0.03;
    this.playbackContextStartTime = now;
    this.isPlaying = true;
    this.sourceNode.start(now);

    const beatDuration = 60 / bpm;
    const totalBeats = Math.ceil(options.totalDurationSec / beatDuration);
    for (let b = 0; b < totalBeats; b++) {
      const beatGridTime = b * beatDuration;
      if (beatGridTime >= trimStartSec - 0.001 && beatGridTime <= trimEndSec + 0.001) {
        this.scheduleClick(this.ctx, now + (beatGridTime - trimStartSec), b % beatsPerMeasure === 0);
      }
    }

    this.stopTimerId = window.setTimeout(() => {
      this.stop();
      if (onEnded) onEnded();
    }, (this.playDuration + 0.05) * 1000);
  }

  public setClickEnabled(enabled: boolean): void {
    if (this.clickGainNode && this.ctx) {
      this.clickGainNode.gain.setValueAtTime(enabled ? 1 : 0, this.ctx.currentTime);
    }
  }

  public stop(): void {
    if (this.stopTimerId !== null) { window.clearTimeout(this.stopTimerId); this.stopTimerId = null; }
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch { /* Ignorer */ }
    }
    this.activeNodes = [];
    this.sourceNode = null;
    this.clickGainNode = null;
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return this.playheadStartCycleTime;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    return elapsed < 0 ? this.playheadStartCycleTime : Math.min(this.playheadStartCycleTime + this.playDuration, this.playheadStartCycleTime + elapsed);
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

    const baseGain = isMajor ? 0.65 : 0.4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.min(1.5, baseGain * vol), time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

    osc.connect(gain);
    if (this.clickGainNode) gain.connect(this.clickGainNode);
    else gain.connect(ctx.destination);
    this.activeNodes.push(osc, gain);
    osc.start(time);
    osc.stop(time + 0.02);
  }
}
