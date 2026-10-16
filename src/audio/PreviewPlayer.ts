/**
 * PreviewPlayer.ts
 * Lecteur de pre-ecoute synchrone double source (Poli / Brut) avec commutation A/B en direct (< 130 lignes).
 */
import { createPaddedPreviewBuffer } from '../utils/wavEncoder';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { schedulePreviewClick } from './previewClickHelper';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';

export interface PreviewOptions {
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs: number;
  bpm: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  clickEnabled: boolean;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  highPassFilterEnabled?: boolean;
  enableTonePolish?: boolean;
  normalizeRMS?: boolean;
  outputDeviceId?: string;
  onEnded?: () => void;
}

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private sourcePolished: AudioBufferSourceNode | null = null;
  private sourceDry: AudioBufferSourceNode | null = null;
  private polishGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private clickGainNode: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private isPlaying = false;
  private playbackContextStartTime = 0;
  private playDuration = 0;
  private stopTimerId: number | null = null;

  public async play(rawPCM: Float32Array, sampleRate: number, options: PreviewOptions): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    if (options.outputDeviceId) await setSharedSinkId(options.outputDeviceId);

    const { trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, totalDurationSec, clickEnabled, highPassFilterEnabled, enableTonePolish, normalizeRMS, onEnded } = options;
    const hp = highPassFilterEnabled !== false;
    const norm = normalizeRMS !== false;

    const pcmPolished = createPaddedPreviewBuffer(rawPCM, sampleRate, totalDurationSec, trimStartSec, trimEndSec, latencyOffsetMs, hp, norm, true);
    const pcmDry = createPaddedPreviewBuffer(rawPCM, sampleRate, totalDurationSec, trimStartSec, trimEndSec, latencyOffsetMs, hp, norm, false);
    this.playDuration = totalDurationSec;

    const bufPolished = this.ctx.createBuffer(1, pcmPolished.length, sampleRate);
    bufPolished.getChannelData(0).set(pcmPolished);
    const bufDry = this.ctx.createBuffer(1, pcmDry.length, sampleRate);
    bufDry.getChannelData(0).set(pcmDry);

    this.sourcePolished = this.ctx.createBufferSource();
    this.sourcePolished.buffer = bufPolished;
    this.sourceDry = this.ctx.createBufferSource();
    this.sourceDry.buffer = bufDry;

    this.polishGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    const isPolished = enableTonePolish !== false;
    this.polishGain.gain.setValueAtTime(isPolished ? 1 : 0, this.ctx.currentTime);
    this.dryGain.gain.setValueAtTime(isPolished ? 0 : 1, this.ctx.currentTime);

    this.sourcePolished.connect(this.polishGain);
    this.polishGain.connect(this.ctx.destination);
    this.sourceDry.connect(this.dryGain);
    this.dryGain.connect(this.ctx.destination);
    this.activeNodes.push(this.sourcePolished, this.sourceDry, this.polishGain, this.dryGain);

    this.clickGainNode = this.ctx.createGain();
    this.clickGainNode.gain.setValueAtTime(clickEnabled ? 1 : 0, this.ctx.currentTime);
    this.clickGainNode.connect(this.ctx.destination);
    this.activeNodes.push(this.clickGainNode);

    const now = this.ctx.currentTime + 0.03;
    this.playbackContextStartTime = now;
    this.isPlaying = true;
    this.sourcePolished.start(now);
    this.sourceDry.start(now);

    const beatDuration = 60 / bpm;
    const t1 = options.t1OffsetSec ?? getPatternT1OffsetSec(options.hasAnacrusis, beatsPerMeasure * beatDuration);
    for (let t = t1 - beatDuration; t >= 0; t -= beatDuration) {
      schedulePreviewClick(this.ctx, now + t, t < 0.01, this.clickGainNode, this.activeNodes);
    }
    for (let k = 0; ; k++) {
      const beatGridTime = t1 + k * beatDuration;
      if (beatGridTime >= totalDurationSec - 0.01) break;
      schedulePreviewClick(this.ctx, now + beatGridTime, k % beatsPerMeasure === 0, this.clickGainNode, this.activeNodes);
    }

    this.stopTimerId = window.setTimeout(() => {
      this.stop();
      if (onEnded) onEnded();
    }, (this.playDuration + 0.05) * 1000);
  }

  public setTonePolishEnabled(enabled: boolean): void {
    if (!this.ctx || !this.polishGain || !this.dryGain) return;
    const t = this.ctx.currentTime;
    this.polishGain.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.015);
    this.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, t, 0.015);
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
    this.sourcePolished = null;
    this.sourceDry = null;
    this.polishGain = null;
    this.dryGain = null;
    this.clickGainNode = null;
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return 0;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    return elapsed < 0 ? 0 : Math.min(this.playDuration, elapsed);
  }

  public getIsPlaying(): boolean { return this.isPlaying; }
}
