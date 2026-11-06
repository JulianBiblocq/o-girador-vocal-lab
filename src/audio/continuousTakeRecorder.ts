/**
 * continuousTakeRecorder.ts
 * Enregistrement continu d'un rôle vocal entier sur la Frise Conducteur avec Voix Témoin auto,
 * double clic clave 1400 Hz sur les 2 temps avant chaque entrée et statut 60 FPS (< 138 lignes).
 */
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from './MetronomeEngine';
import type { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleContinuousCounterRole, CONTINUOUS_LEAD_IN_MEASURES, type ContinuousCueHandle } from './continuousCueHelper';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { buildDeviceSignature } from '../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../utils/latencyStorage';
import { scheduleWoodClick, scheduleCallDoubleClick } from './metronomeAudioNodes';
import { buildConductorRoleTimeline, type RoleTimelineItem } from '../utils/conductorRoleTimelineBuilder';

export interface ContinuousPrompterSlotInfo {
  slotIndex: number; totalSlots: number; conductorMeasure: number; role: VocalRole; lyrics: string;
  isRoleGap?: boolean; gapMeasures?: number; counterRoleLyrics?: string; remainingBeatsToNextEntry?: number;
  hasAnacrusis?: boolean; anacrusisBeats?: number; nextSlotIndex?: number; nextMeasure?: number; nextLyrics?: string;
}

export interface ContinuousLiveStatus {
  isRunning: boolean; currentBeatGlobal: number; beatProgress: number; totalBeats: number;
}

export interface ContinuousRecordParams {
  project: ToadaProject; targetRole: VocalRole; engine: MetronomeEngine; recorder: VocalRecorderEngine;
  listeningMode: ListeningMode; selectedDeviceId: string; selectedOutputDeviceId: string;
  counterRoleCueEnabled?: boolean;
  onPrompterUpdate: (info: ContinuousPrompterSlotInfo) => void;
  onComplete: (pcm: Float32Array, sampleRate: number, marginBeforeM0Sec: number) => void;
}

export class ContinuousTakeSession {
  private isRunning = false;
  private cueHandle: ContinuousCueHandle | null = null;
  private timers: number[] = [];
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];
  private ctxRef: AudioContext | null = null;
  private m0StartTime = 0;
  private beatDurSec = 0.68;
  private totalBeatsCount = 16;

  public getLiveStatus(): ContinuousLiveStatus {
    if (!this.isRunning || !this.ctxRef) {
      return { isRunning: false, currentBeatGlobal: 0, beatProgress: 0, totalBeats: this.totalBeatsCount };
    }
    const elapsed = Math.max(0, this.ctxRef.currentTime - this.m0StartTime);
    const frac = elapsed / Math.max(0.1, this.beatDurSec);
    const currentBeatGlobal = Math.min(this.totalBeatsCount - 1, Math.floor(frac));
    const beatProgress = Math.max(0, Math.min(1, frac - Math.floor(frac)));
    return { isRunning: true, currentBeatGlobal, beatProgress, totalBeats: this.totalBeatsCount };
  }

  public async start(params: ContinuousRecordParams): Promise<void> {
    const { project, targetRole, engine, recorder, selectedDeviceId, selectedOutputDeviceId, counterRoleCueEnabled = true, onPrompterUpdate, onComplete } = params;
    this.stop(recorder, engine);
    this.isRunning = true;

    const ctx = await engine.initContext();
    this.ctxRef = ctx;
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const beatDuration = 60 / (project.bpm || 88), measureDurationSec = beatsPerMeasure * beatDuration;
    this.beatDurSec = beatDuration;

    const marginBeforeM0Sec = 0.6;
    const timeline = buildConductorRoleTimeline(project, targetRole, 0, CONTINUOUS_LEAD_IN_MEASURES);
    const lastItem = timeline[timeline.length - 1];
    const songMeasuresCount = lastItem ? (lastItem.startMeasure - 1) + lastItem.measuresCount : 0;
    const totalGridMeasures = CONTINUOUS_LEAD_IN_MEASURES + songMeasuresCount;
    const totalBeats = totalGridMeasures * beatsPerMeasure + 1;
    this.totalBeatsCount = totalBeats;

    const totalTakeSec = totalGridMeasures * measureDurationSec + beatDuration + 0.8;
    const audioCtxStart = ctx.currentTime + 0.1;
    this.m0StartTime = audioCtxStart + marginBeforeM0Sec;
    const latencySec = getSavedLatencyOffsetMs(buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate)) / 1000;
    recorder.start(this.m0StartTime + latencySec, totalTakeSec);
    if (counterRoleCueEnabled) this.cueHandle = scheduleContinuousCounterRole(ctx, project, targetRole, audioCtxStart, marginBeforeM0Sec);

    const callInBeats = new Set<number>(), sungBeats = new Set<number>();
    timeline.forEach((item, idx) => {
      if (item.isRoleGap) return;
      const t1Beat = ((CONTINUOUS_LEAD_IN_MEASURES - 1) + item.startMeasure) * beatsPerMeasure;
      const anacB = item.hasAnacrusis ? Math.max(1, Math.min(beatsPerMeasure, item.anacrusisBeats || 2)) : 0;
      const entryBeat = Math.max(0, t1Beat - anacB);
      if (idx === 0 || timeline[idx - 1].isRoleGap) {
        if (entryBeat - 2 >= 0) callInBeats.add(entryBeat - 2);
        if (entryBeat - 1 >= 0) callInBeats.add(entryBeat - 1);
      }
      for (let b = entryBeat; b <= t1Beat + item.measuresCount * beatsPerMeasure; b++) sungBeats.add(b);
    });

    for (let b = 0; b < totalBeats; b++) {
      const clickTime = this.m0StartTime + b * beatDuration;
      if (callInBeats.has(b)) scheduleCallDoubleClick(ctx, clickTime, beatDuration, this.activeNodes);
      else scheduleWoodClick(ctx, clickTime, b % beatsPerMeasure === 0, this.activeNodes, undefined, !sungBeats.has(b));
    }

    const toPrompterInfo = (item: RoleTimelineItem, remBeats?: number): ContinuousPrompterSlotInfo => ({
      slotIndex: item.slotIndex + 1, totalSlots: project.slots.length, conductorMeasure: item.startMeasure,
      role: targetRole, lyrics: item.lyrics || '', isRoleGap: item.isRoleGap, gapMeasures: item.gapMeasures,
      counterRoleLyrics: item.counterRoleLyrics, remainingBeatsToNextEntry: remBeats,
      hasAnacrusis: item.hasAnacrusis, anacrusisBeats: item.anacrusisBeats,
      nextSlotIndex: item.nextEntrySlotIndex, nextMeasure: item.nextEntryMeasure, nextLyrics: item.nextEntryLyrics,
    });

    if (timeline.length > 0) onPrompterUpdate(toPrompterInfo(timeline[0], timeline[0].gapMeasures * beatsPerMeasure));

    timeline.forEach((item) => {
      const slotT1Time = this.m0StartTime + item.metricT1Sec;
      const leadSec = !item.isRoleGap && item.hasAnacrusis ? measureDurationSec : (item.isRoleGap ? 0 : beatDuration * 0.5);
      this.timers.push(window.setTimeout(() => {
        if (this.isRunning) onPrompterUpdate(toPrompterInfo(item, item.gapMeasures * beatsPerMeasure));
      }, Math.max(0, (slotT1Time - leadSec - ctx.currentTime) * 1000)));
    });

    this.timers.push(window.setTimeout(() => {
      if (!this.isRunning) return;
      const pcm = recorder.stop(); this.stop(recorder, engine); onComplete(pcm, sampleRate, 0);
    }, Math.max(10, (this.m0StartTime + totalTakeSec - ctx.currentTime) * 1000)));
  }

  public stop(recorder?: VocalRecorderEngine, engine?: MetronomeEngine): Float32Array | null {
    this.isRunning = false;
    this.timers.forEach((t) => window.clearTimeout(t)); this.timers = [];
    this.cueHandle?.stop(); this.cueHandle = null;
    this.activeNodes.forEach((n) => { try { if ('stop' in n) (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch {} });
    this.activeNodes = []; engine?.stop();
    return recorder ? recorder.stop() : null;
  }
}
