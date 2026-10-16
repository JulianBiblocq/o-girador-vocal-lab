/**
 * slicerAudioEngine.ts
 * Moteur de pre-ecoute en boucle et Clic Temoine synchrone pour le Banc de Decoupe (< 130 lignes).
 */
import { getSharedAudioContext } from './sharedAudioContext';

export interface SlicerPlayOptions {
  pcm: Float32Array;
  sampleRate: number;
  loop: boolean;
  witnessClick: boolean;
  targetPegsRelativeSec: number[];
  startOffsetSec?: number;
  onEnded?: () => void;
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

  public async play(opts: SlicerPlayOptions): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const { pcm, sampleRate, loop, startOffsetSec = 0 } = opts;
    if (!pcm || pcm.length === 0) return;

    this.currentOpts = opts;
    this.durationSec = pcm.length / sampleRate;
    this.startOffsetSec = Math.max(0, Math.min(this.durationSec, startOffsetSec));

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

    if (opts.witnessClick && opts.targetPegsRelativeSec.length > 0) {
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

  public setWitnessClick(enabled: boolean): void {
    if (!this.currentOpts) return;
    this.currentOpts.witnessClick = enabled;
    if (enabled && this.isPlaying) this.startClickScheduler();
    else if (!enabled && this.clickTimer) { clearInterval(this.clickTimer); this.clickTimer = null; }
  }

  public setLoop(loop: boolean): void {
    if (this.sourceNode) this.sourceNode.loop = loop;
    if (this.currentOpts) this.currentOpts.loop = loop;
  }

  private startClickScheduler(): void {
    if (this.clickTimer) clearInterval(this.clickTimer);
    let lastScheduledCycle = -1;

    const scheduleClicks = () => {
      if (!this.isPlaying || !this.ctx || !this.currentOpts?.witnessClick) return;
      const cur = this.getCurrentPlayheadSec();
      const cycle = Math.floor((this.ctx.currentTime - this.startTime + this.startOffsetSec) / this.durationSec);
      if (cycle !== lastScheduledCycle) {
        lastScheduledCycle = cycle;
        const now = this.ctx.currentTime;
        this.currentOpts.targetPegsRelativeSec.forEach((pegSec, idx) => {
          const clickTime = now + (pegSec - cur);
          if (clickTime >= now && clickTime < now + 0.3) {
            this.playMetronomeClick(clickTime, idx === 0 ? 1200 : 800);
          }
        });
      }
    };
    scheduleClicks();
    this.clickTimer = window.setInterval(scheduleClicks, 60);
  }

  private playMetronomeClick(time: number, freq: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}
