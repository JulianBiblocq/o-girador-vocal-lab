/**
 * ToadaPlayerEngine.ts
 * Moteur Web Audio temps réel avec Ordonnanceur Lookahead et Varispeed live BPM (< 135 lignes).
 */
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../../types/toadaProject.types';
import { getSharedAudioContext, setSharedSinkId, registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { HarmonyPlayerEngine } from '../../audio/harmony/HarmonyPlayerEngine';
import { ToadaTimelineClock, computeSlotsMeasureLayout, type SlotMeasureLayout } from './toadaTimingScheduler';
import { schedulePatternVoice, type ScheduledVoiceResult } from './toadaVoiceScheduler';
import { getActiveBackingTrack } from '../../utils/backingTrackStorage';
import { scheduleBackingTrackOnContext, type BackingTrackPlaybackHandle } from '../../audio/BackingTrackEngine';
import type { ConductorLoopRange } from './ConductorBackingAndLoopBar';

export function hasSlot0AnacrusisLeadIn(project: ToadaProject): boolean {
  const slot0 = project.slots[0]; if (!slot0) return false;
  const pux0 = project.patterns.find((p) => p.id === slot0.puxadorPatternId);
  const coro0 = project.patterns.find((p) => p.id === slot0.coroPatternId);
  return [pux0, coro0].some((p) => {
    if (!p) return false;
    const v = p.variants?.[p.activeVariantKey], rec = v?.recordingResult ?? p.recordingResult;
    const tStart = v?.trimStartSec || p.trimStartSec || 0, t1 = v?.t1OffsetSec ?? p.t1OffsetSec ?? rec?.t1OffsetSec;
    return typeof t1 === 'number' ? tStart < t1 - 0.01 : p.hasAnacrusis !== false;
  });
}

export class ToadaPlayerEngine {
  private isRunning = false; private ctx: AudioContext | null = null; private clock = new ToadaTimelineClock();
  private activeVoices: ScheduledVoiceResult[] = []; private backingHandle: BackingTrackPlaybackHandle | null = null;
  private schedulerTimer: number | null = null; private harmonyEngine = new HarmonyPlayerEngine();
  private layouts: SlotMeasureLayout[] = []; private loopRange: ConductorLoopRange | null = null;
  private scheduledSlots = new Set<number>(); private reportedSlotIdx = -1;
  private onCompleteCb: (() => void) | null = null; private unregisterKillSwitch: (() => void) | null = null;

  public getIsPlaying(): boolean { return this.isRunning; }
  public getLiveBpm(): number { return this.clock.getLiveBpm(); }
  public getCurrentMeasure(): number { return this.isRunning && this.ctx ? this.clock.getMeasureAtTime(this.ctx.currentTime) : 1; }
  public setBackingVolume(vol: number): void { this.backingHandle?.setVolume(vol); }

  public setLiveBpm(newBpm: number): void {
    if (!this.isRunning || !this.ctx) return;
    this.clock.setLiveBpm(newBpm, this.ctx.currentTime);
    const now = this.ctx.currentTime;
    this.activeVoices.forEach((v) => { try { v.source.playbackRate.setValueAtTime(this.clock.getSpeedRatio(v.recordedBpm), now); } catch {} });
    this.backingHandle?.setLiveBpm(newBpm);
  }

  public async play(
    project: ToadaProject, outputDeviceId?: string,
    onProgress?: (slotIndex: number) => void, onComplete?: () => void,
    loopRange?: ConductorLoopRange
  ): Promise<void> {
    this.stop();
    stopAllActiveAudioEngines('conductor-player');
    this.onCompleteCb = onComplete ?? null;
    this.unregisterKillSwitch = registerAudioKillSwitch('conductor-player', () => { const cb = this.onCompleteCb; this.stop(); cb?.(); });

    const ctx = await getSharedAudioContext();
    this.ctx = ctx;
    if (outputDeviceId && outputDeviceId !== 'default') await setSharedSinkId(outputDeviceId);

    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const allLayouts = computeSlotsMeasureLayout(project.slots, project.patterns);
    const useLoop = Boolean(loopRange?.enabled && allLayouts.length > 0);
    this.loopRange = useLoop && loopRange ? loopRange : null;
    this.layouts = useLoop && loopRange
      ? allLayouts.filter((l) => l.slotIndex >= loopRange.startSlot && l.slotIndex <= loopRange.endSlot)
      : allLayouts;
    if (this.layouts.length === 0) this.layouts = allLayouts;

    const firstStartMeasure = this.layouts[0]?.startMeasure ?? 1;
    const initMeasure = firstStartMeasure === 1 && hasSlot0AnacrusisLeadIn(project) ? 0 : firstStartMeasure;
    this.clock.init(ctx.currentTime + 0.08, project.bpm || DEFAULT_TOADA_BPM, beatsPerMeasure, initMeasure);
    const m1Time = this.clock.getTimeAtMeasure(firstStartMeasure);
    this.backingHandle = scheduleBackingTrackOnContext(ctx, getActiveBackingTrack(project.id), m1Time, this.clock.getLiveBpm());

    this.scheduledSlots.clear();
    this.reportedSlotIdx = -1;
    this.isRunning = true;

    this.tickScheduler(project, beatsPerMeasure, onProgress, onComplete);
    this.schedulerTimer = window.setInterval(() => {
      if (this.isRunning) this.tickScheduler(project, beatsPerMeasure, onProgress, onComplete);
    }, 35);
  }

  private tickScheduler(project: ToadaProject, beatsPerMeasure: number, onProgress?: (idx: number) => void, onComplete?: () => void): void {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime, scheduleHorizonSec = this.clock.getMeasureDurationSec() + 0.16;

    for (const layout of this.layouts) {
      const slotT1Time = this.clock.getTimeAtMeasure(layout.startMeasure);
      if ((now >= slotT1Time - 0.05 || (layout.slotIndex === 0 && this.reportedSlotIdx === -1)) && this.reportedSlotIdx !== layout.slotIndex) {
        this.reportedSlotIdx = layout.slotIndex;
        onProgress?.(layout.slotIndex);
      }
      if (!this.scheduledSlots.has(layout.slotIndex) && slotT1Time <= now + scheduleHorizonSec) {
        this.scheduledSlots.add(layout.slotIndex);
        const slot = project.slots[layout.slotIndex];
        const pux = project.patterns.find((p) => p.id === slot.puxadorPatternId);
        const coro = project.patterns.find((p) => p.id === slot.coroPatternId);
        const shiftSt = project.previewListenTarget === 'sung' ? 0 : (project.transpositionSemitones ?? project.toadaMeta?.transpositionSemitones ?? 0);
        if (pux) { const v = schedulePatternVoice(this.ctx, pux, slotT1Time, this.clock, shiftSt); if (v) this.activeVoices.push(v); }
        if (coro) { const v = schedulePatternVoice(this.ctx, coro, slotT1Time, this.clock, shiftSt); if (v) this.activeVoices.push(v); }

        const patHarmony = pux?.harmonyGrid || coro?.harmonyGrid || project.globalHarmonyGrid;
        if (project.harmonyConfig?.enabled && patHarmony) {
          const bpm = this.clock.getLiveBpm();
          this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
            grid: patHarmony, bpm, beatsPerMeasure, measuresCount: layout.measuresInSlot,
            startTime: slotT1Time, totalDurationSec: layout.measuresInSlot * beatsPerMeasure * (60 / bpm),
            hasAnacrusis: false, t1OffsetSec: 0, append: true, pitchShiftSemitones: shiftSt,
            profile: project.harmonyConfig.profile, volume: project.harmonyConfig.volume, muteBass: project.harmonyConfig.muteBass,
          });
        }
      }
    }

    const last = this.layouts[this.layouts.length - 1];
    if (last && this.scheduledSlots.has(last.slotIndex) && this.clock.getMeasureAtTime(now) >= last.startMeasure + last.advanceMeasures + (this.loopRange?.enabled ? 0.0 : 0.3)) {
      if (this.loopRange?.enabled && this.layouts.length > 0) {
        const firstM = this.layouts[0].startMeasure;
        this.clock.init(now, this.clock.getLiveBpm(), beatsPerMeasure, firstM);
        this.scheduledSlots.clear();
        this.reportedSlotIdx = -1;
        return;
      }
      this.stop();
      onComplete?.();
    }
  }

  public stop(): void {
    this.isRunning = false; this.onCompleteCb = null;
    this.unregisterKillSwitch?.(); this.unregisterKillSwitch = null;
    if (this.schedulerTimer) { window.clearInterval(this.schedulerTimer); this.schedulerTimer = null; }
    this.harmonyEngine.stop(); this.backingHandle?.stop(); this.backingHandle = null;
    this.activeVoices.forEach((v) => { try { v.source.stop(); v.source.disconnect(); } catch {} });
    this.activeVoices = []; this.scheduledSlots.clear();
  }
}
