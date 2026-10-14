/**
 * PreviewPlayer.ts
 * Lecteur de pre-ecoute cale sur la grille absolue avec compensation de latence materielle.
 * Utilise le singleton sharedAudioContext (zero accumulation d AudioContext).
 */
import { extractCompensatedSlice } from '../utils/wavEncoder';
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';

export interface PreviewOptions {
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs: number;
  bpm: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  clickEnabled: boolean;
  outputDeviceId?: string;
  onEnded?: () => void;
}

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private activeNodes: AudioNode[] = [];
  private isPlaying = false;
  private playheadStartCycleTime = 0;
  private playbackContextStartTime = 0;
  private playDuration = 0;
  private stopTimerId: number | null = null;

  public async play(
    rawPCM: Float32Array,
    sampleRate: number,
    options: PreviewOptions
  ): Promise<void> {
    this.stop();

    this.ctx = await getSharedAudioContext();
    if (options.outputDeviceId) {
      await setSharedSinkId(options.outputDeviceId);
    }

    const { trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, clickEnabled, onEnded } = options;
    const cleanPCM = extractCompensatedSlice(rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs);

    this.playDuration = Math.max(0.05, trimEndSec - trimStartSec);
    this.playheadStartCycleTime = trimStartSec;

    const audioBuffer = this.ctx.createBuffer(1, cleanPCM.length, sampleRate);
    audioBuffer.getChannelData(0).set(cleanPCM);

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.ctx.destination);
    this.activeNodes.push(this.sourceNode);

    const now = this.ctx.currentTime + 0.03;
    this.playbackContextStartTime = now;
    this.isPlaying = true;

    this.sourceNode.start(now);

    if (clickEnabled) {
      const beatDuration = 60 / bpm;
      const totalBeats = Math.ceil(options.totalDurationSec / beatDuration);

      for (let b = 0; b < totalBeats; b++) {
        const beatGridTime = b * beatDuration;
        if (beatGridTime >= trimStartSec - 0.001 && beatGridTime <= trimEndSec + 0.001) {
          const delayFromStart = beatGridTime - trimStartSec;
          const clickTime = now + delayFromStart;
          const isMajor = b % beatsPerMeasure === 0;
          this.scheduleClick(this.ctx, clickTime, isMajor);
        }
      }
    }

    this.stopTimerId = window.setTimeout(() => {
      this.stop();
      if (onEnded) onEnded();
    }, (this.playDuration + 0.05) * 1000);
  }

  public stop(): void {
    if (this.stopTimerId !== null) {
      window.clearTimeout(this.stopTimerId);
      this.stopTimerId = null;
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
    this.sourceNode = null;
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return this.playheadStartCycleTime;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    if (elapsed < 0) return this.playheadStartCycleTime;
    return Math.min(this.playheadStartCycleTime + this.playDuration, this.playheadStartCycleTime + elapsed);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private scheduleClick(ctx: AudioContext, time: number, isMajor: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isMajor ? 1400 : 900, time);
    osc.frequency.exponentialRampToValueAtTime(isMajor ? 260 : 180, time + 0.02);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(isMajor ? 0.45 : 0.25, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    this.activeNodes.push(osc, gain);

    osc.start(time);
    osc.stop(time + 0.02);
  }
}
