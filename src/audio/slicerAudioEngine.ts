/**
 * slicerAudioEngine.ts
 * Moteur de lecture audio haute précision avec métronome temps réel lookahead (< 145 lignes).
 */
import { getSharedAudioContext } from './sharedAudioContext';

export interface SlicerPlayOptions {
  pcm: Float32Array; sampleRate: number; loop: boolean; witnessClick: boolean;
  targetPegsRelativeSec: number[]; startOffsetSec?: number;
  metronomeClick?: boolean; bpm?: number; gridOffsetSec?: number; onEnded?: () => void;
}

export class SlicerAudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private clickTimer: number | null = null;
  private isPlaying = false;
  private startTime = 0;
  private startOffsetSec = 0;
  private durationSec = 0;
  private currentOpts: SlicerPlayOptions | null = null;
  private lastScheduledBeat = -1;

  public async play(opts: SlicerPlayOptions): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const { pcm, sampleRate, loop, startOffsetSec = 0 } = opts;
    if (!pcm || pcm.length === 0) return;

    this.currentOpts = opts;
    this.durationSec = pcm.length / sampleRate;
    this.startOffsetSec = Math.max(0, Math.min(this.durationSec, startOffsetSec));
    this.lastScheduledBeat = -1;

    const audioBuf = this.ctx.createBuffer(1, pcm.length, sampleRate);
    audioBuf.getChannelData(0).set(pcm);

    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.loop = loop;
    src.connect(this.ctx.destination);
    src.onended = () => { if (!src.loop) this.stop(); opts.onEnded?.(); };

    this.startTime = this.ctx.currentTime;
    src.start(0, this.startOffsetSec);
    this.sourceNode = src;
    this.isPlaying = true;

    if ((opts.witnessClick && opts.targetPegsRelativeSec.length > 0) || opts.metronomeClick) {
      this.startClickScheduler();
    }
  }

  public stop(): void {
    if (this.clickTimer) { clearInterval(this.clickTimer); this.clickTimer = null; }
    if (this.sourceNode) {
      try { this.sourceNode.stop(); this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx || this.durationSec <= 0) return -1;
    const elapsed = this.ctx.currentTime - this.startTime + this.startOffsetSec;
    return this.sourceNode?.loop ? (elapsed % this.durationSec) : Math.min(this.durationSec, elapsed);
  }

  public getIsPlaying(): boolean { return this.isPlaying; }

  public setMetronome(enabled: boolean, bpm?: number, gridOffsetSec?: number): void {
    if (!this.currentOpts) return;
    this.currentOpts.metronomeClick = enabled;
    if (bpm) this.currentOpts.bpm = bpm;
    if (gridOffsetSec !== undefined) this.currentOpts.gridOffsetSec = gridOffsetSec;
    if (enabled && this.isPlaying && !this.clickTimer) this.startClickScheduler();
  }

  public setWitnessClick(enabled: boolean): void {
    if (!this.currentOpts) return;
    this.currentOpts.witnessClick = enabled;
    if (enabled && this.isPlaying && !this.clickTimer) this.startClickScheduler();
  }

  public setLoop(loop: boolean): void {
    if (this.sourceNode) this.sourceNode.loop = loop;
    if (this.currentOpts) this.currentOpts.loop = loop;
  }

  private startClickScheduler(): void {
    if (this.clickTimer) clearInterval(this.clickTimer);
    const scheduleClicks = () => {
      if (!this.isPlaying || !this.ctx || !this.currentOpts) return;
      const cur = this.getCurrentPlayheadSec();
      const now = this.ctx.currentTime;

      if (this.currentOpts.metronomeClick && this.currentOpts.bpm) {
        const beatDur = 60 / this.currentOpts.bpm;
        const off = this.currentOpts.gridOffsetSec ?? 0;
        const startBeat = Math.floor((cur - off) / beatDur);
        for (let b = Math.max(0, startBeat); b <= startBeat + 3; b++) {
          const beatTimeInAudio = off + b * beatDur;
          const timeUntil = beatTimeInAudio - cur;
          if (timeUntil >= 0 && timeUntil < 0.25 && b > this.lastScheduledBeat) {
            this.lastScheduledBeat = b;
            this.playMetronomeClick(now + timeUntil, b % 4 === 0 ? 1400 : 850);
          }
        }
      }
    };
    scheduleClicks();
    this.clickTimer = window.setInterval(scheduleClicks, 40);
  }

  private playMetronomeClick(time: number, freq: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.40, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(time); osc.stop(time + 0.04);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}
