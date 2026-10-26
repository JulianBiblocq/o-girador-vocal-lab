/**
 * ToadaPlayerEngine.ts
 * Moteur Web Audio temps réel avec Ordonnanceur Lookahead et Varispeed live BPM (< 125 lignes).
 */
import type { ToadaProject } from '../../types/toadaProject.types';
import { getSharedAudioContext, setSharedSinkId } from '../../audio/sharedAudioContext';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { HarmonyPlayerEngine } from '../../audio/harmony/HarmonyPlayerEngine';
import { ToadaTimelineClock, computeSlotsMeasureLayout, type SlotMeasureLayout } from './toadaTimingScheduler';
import { schedulePatternVoice, type ScheduledVoiceResult } from './toadaVoiceScheduler';

export class ToadaPlayerEngine {
  private isRunning = false;
  private ctx: AudioContext | null = null;
  private clock = new ToadaTimelineClock();
  private activeVoices: ScheduledVoiceResult[] = [];
  private schedulerTimer: number | null = null;
  private harmonyEngine = new HarmonyPlayerEngine();
  private layouts: SlotMeasureLayout[] = [];
  private scheduledSlots = new Set<number>();
  private reportedSlotIdx = -1;

  public getIsPlaying(): boolean { return this.isRunning; }
  public getLiveBpm(): number { return this.clock.getLiveBpm(); }
  public getCurrentMeasure(): number {
    return this.isRunning && this.ctx ? this.clock.getMeasureAtTime(this.ctx.currentTime) : 1;
  }

  public setLiveBpm(newBpm: number): void {
    if (!this.isRunning || !this.ctx) return;
    this.clock.setLiveBpm(newBpm, this.ctx.currentTime);
    const now = this.ctx.currentTime;
    this.activeVoices.forEach((v) => {
      try {
        const ratio = this.clock.getSpeedRatio(v.recordedBpm);
        v.source.playbackRate.setValueAtTime(ratio, now);
      } catch {}
    });
  }

  public async play(
    project: ToadaProject,
    outputDeviceId?: string,
    onProgress?: (slotIndex: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    this.stop();
    const ctx = await getSharedAudioContext();
    this.ctx = ctx;
    if (outputDeviceId && outputDeviceId !== 'default') await setSharedSinkId(outputDeviceId);

    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const audioCtxStart = ctx.currentTime + 0.08;
    this.clock.init(audioCtxStart, project.bpm || 88, beatsPerMeasure, 1);
    this.layouts = computeSlotsMeasureLayout(project.slots, project.patterns);
    this.scheduledSlots.clear();
    this.reportedSlotIdx = -1;
    this.isRunning = true;

    this.schedulerTimer = window.setInterval(() => {
      if (!this.isRunning) return;
      this.tickScheduler(project, onProgress, onComplete);
    }, 35);
  }

  private tickScheduler(project: ToadaProject, onProgress?: (idx: number) => void, onComplete?: () => void): void {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    const lookaheadSec = 0.16;

    for (const layout of this.layouts) {
      const slotT1Time = this.clock.getTimeAtMeasure(layout.startMeasure);
      if (now >= slotT1Time - 0.05 && this.reportedSlotIdx !== layout.slotIndex) {
        this.reportedSlotIdx = layout.slotIndex;
        onProgress?.(layout.slotIndex);
      }
      if (!this.scheduledSlots.has(layout.slotIndex) && slotT1Time <= now + lookaheadSec) {
        this.scheduledSlots.add(layout.slotIndex);
        const slot = project.slots[layout.slotIndex];
        const pux = project.patterns.find((p) => p.id === slot.puxadorPatternId);
        const coro = project.patterns.find((p) => p.id === slot.coroPatternId);
        if (pux) { const v = schedulePatternVoice(this.ctx, pux, slotT1Time, this.clock); if (v) this.activeVoices.push(v); }
        if (coro) { const v = schedulePatternVoice(this.ctx, coro, slotT1Time, this.clock); if (v) this.activeVoices.push(v); }

        const patHarmony = pux?.harmonyGrid || coro?.harmonyGrid || project.globalHarmonyGrid;
        if (project.harmonyConfig?.enabled && patHarmony) {
          const bpm = this.clock.getLiveBpm();
          this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
            grid: patHarmony, bpm, beatsPerMeasure: 4, measuresCount: layout.measuresInSlot,
            startTime: slotT1Time, totalDurationSec: layout.measuresInSlot * 4 * (60 / bpm),
            profile: project.harmonyConfig.profile, volume: project.harmonyConfig.volume, muteBass: project.harmonyConfig.muteBass,
          });
        }
      }
    }

    const last = this.layouts[this.layouts.length - 1];
    if (last && this.scheduledSlots.has(last.slotIndex)) {
      const endMeasure = last.startMeasure + last.advanceMeasures + 0.3;
      if (this.clock.getMeasureAtTime(now) >= endMeasure) {
        this.stop();
        onComplete?.();
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.schedulerTimer) { window.clearInterval(this.schedulerTimer); this.schedulerTimer = null; }
    this.harmonyEngine.stop();
    this.activeVoices.forEach((v) => { try { v.source.stop(); v.source.disconnect(); } catch {} });
    this.activeVoices = [];
    this.scheduledSlots.clear();
  }
}
