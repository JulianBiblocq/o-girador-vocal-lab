/**
 * continuousTakeRecorder.ts
 * Enregistrement continu d'un rôle vocal entier sur la Frise Conducteur avec gestion des Trous de Rôle et Cue Vocal (< 138 lignes).
 */
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from './MetronomeEngine';
import type { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleContinuousCounterRole, CONTINUOUS_LEAD_IN_MEASURES, type ContinuousCueHandle } from './continuousCueHelper';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { buildDeviceSignature } from '../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../utils/latencyStorage';
import { scheduleWoodClick } from './metronomeAudioNodes';
import { buildConductorRoleTimeline, type RoleTimelineItem } from '../utils/conductorRoleTimelineBuilder';

export interface ContinuousPrompterSlotInfo {
  slotIndex: number; totalSlots: number; conductorMeasure: number; role: VocalRole; lyrics: string;
  isRoleGap?: boolean; gapMeasures?: number; counterRoleLyrics?: string; remainingBeatsToNextEntry?: number;
  hasAnacrusis?: boolean; anacrusisBeats?: number; nextSlotIndex?: number; nextMeasure?: number; nextLyrics?: string;
}

export interface ContinuousRecordParams {
  project: ToadaProject; targetRole: VocalRole; engine: MetronomeEngine; recorder: VocalRecorderEngine;
  listeningMode: ListeningMode; selectedDeviceId: string; selectedOutputDeviceId: string;
  onPrompterUpdate: (info: ContinuousPrompterSlotInfo) => void;
  onComplete: (pcm: Float32Array, sampleRate: number, marginBeforeM0Sec: number) => void;
}

export class ContinuousTakeSession {
  private isRunning = false;
  private cueHandle: ContinuousCueHandle | null = null;
  private timers: number[] = [];
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];

  public async start(params: ContinuousRecordParams): Promise<void> {
    const { project, targetRole, engine, recorder, listeningMode, selectedDeviceId, selectedOutputDeviceId, onPrompterUpdate, onComplete } = params;
    this.stop(recorder, engine);
    this.isRunning = true;

    const ctx = await engine.initContext();
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const beatDuration = 60 / (project.bpm || 88);
    const measureDurationSec = beatsPerMeasure * beatDuration;

    const marginBeforeM0Sec = 0.6;
    const timeline = buildConductorRoleTimeline(project, targetRole, 0, CONTINUOUS_LEAD_IN_MEASURES);
    const lastItem = timeline[timeline.length - 1];
    const songMeasuresCount = lastItem ? (lastItem.startMeasure - 1) + lastItem.measuresCount : 0;
    const totalGridMeasures = CONTINUOUS_LEAD_IN_MEASURES + songMeasuresCount;

    const totalTakeSec = totalGridMeasures * measureDurationSec + beatDuration + 0.8;
    const audioCtxStart = ctx.currentTime + 0.1;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const latencySec = getSavedLatencyOffsetMs(sig) / 1000;
    const captureStartTime = audioCtxStart + marginBeforeM0Sec + latencySec;

    recorder.start(captureStartTime, totalTakeSec);
    if (listeningMode === 'headphones' || targetRole === 'coro') {
      this.cueHandle = scheduleContinuousCounterRole(ctx, project, targetRole, audioCtxStart, marginBeforeM0Sec);
    }

    const totalBeats = totalGridMeasures * beatsPerMeasure;
    for (let b = 0; b < totalBeats; b++) {
      scheduleWoodClick(ctx, audioCtxStart + marginBeforeM0Sec + b * beatDuration, b % beatsPerMeasure === 0, this.activeNodes);
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
      const slotT1Time = audioCtxStart + marginBeforeM0Sec + item.metricT1Sec;
      const leadSec = !item.isRoleGap && item.hasAnacrusis ? measureDurationSec : (item.isRoleGap ? 0 : beatDuration * 0.5);
      const delayMs = Math.max(0, (slotT1Time - leadSec - ctx.currentTime) * 1000);
      this.timers.push(window.setTimeout(() => {
        if (this.isRunning) onPrompterUpdate(toPrompterInfo(item, item.gapMeasures * beatsPerMeasure));
      }, delayMs));

      if (item.isRoleGap && item.gapMeasures > 0) {
        const totalGapBeats = item.measuresCount * beatsPerMeasure;
        for (let b = 1; b < totalGapBeats; b++) {
          const bMs = Math.max(0, (slotT1Time + b * beatDuration - ctx.currentTime) * 1000);
          const rem = Math.max(1, item.gapMeasures * beatsPerMeasure - b);
          this.timers.push(window.setTimeout(() => { if (this.isRunning) onPrompterUpdate(toPrompterInfo(item, rem)); }, bMs));
        }
      }
    });

    const finishMs = Math.max(10, (audioCtxStart + marginBeforeM0Sec + totalTakeSec - ctx.currentTime) * 1000);
    this.timers.push(window.setTimeout(() => {
      if (!this.isRunning) return;
      const pcm = recorder.stop();
      this.stop(recorder, engine);
      onComplete(pcm, sampleRate, 0);
    }, finishMs));
  }

  public stop(recorder?: VocalRecorderEngine, engine?: MetronomeEngine): Float32Array | null {
    this.isRunning = false;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.cueHandle?.stop(); this.cueHandle = null;
    this.activeNodes.forEach((n) => {
      try { if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch {}
    });
    this.activeNodes = [];
    engine?.stop();
    return recorder ? recorder.stop() : null;
  }
}
