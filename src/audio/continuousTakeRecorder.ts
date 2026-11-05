/**
 * continuousTakeRecorder.ts
 * Enregistrement continu d'un rôle vocal entier sur la Frise Conducteur (< 140 lignes).
 */
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from './MetronomeEngine';
import type { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleContinuousCounterRole, CONTINUOUS_LEAD_IN_MEASURES, type ContinuousCueHandle } from './continuousCueHelper';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { buildDeviceSignature } from '../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../utils/latencyStorage';
import { scheduleWoodClick } from './metronomeAudioNodes';
import { computeSlotsMeasureLayout } from '../components/conductor/toadaTimingScheduler';

export interface ContinuousPrompterSlotInfo {
  slotIndex: number; totalSlots: number; conductorMeasure: number; role: VocalRole; lyrics: string;
  hasAnacrusis?: boolean; anacrusisBeats?: number;
  nextSlotIndex?: number; nextMeasure?: number; nextLyrics?: string;
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

    const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);
    const lastLayout = layouts[layouts.length - 1];
    const songMeasuresCount = lastLayout ? (lastLayout.startMeasure - 1) + lastLayout.advanceMeasures : 0;
    const totalGridMeasures = CONTINUOUS_LEAD_IN_MEASURES + songMeasuresCount;

    const marginBeforeM0Sec = 0.6;
    const totalTakeSec = totalGridMeasures * measureDurationSec + beatDuration + 0.8;
    const audioCtxStart = ctx.currentTime + 0.1;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const latencySec = getSavedLatencyOffsetMs(sig) / 1000;
    const captureStartTime = audioCtxStart + marginBeforeM0Sec + latencySec;

    recorder.start(captureStartTime, totalTakeSec);

    if (listeningMode === 'headphones') {
      this.cueHandle = scheduleContinuousCounterRole(ctx, project, targetRole, audioCtxStart, marginBeforeM0Sec);
    }

    const totalBeats = totalGridMeasures * beatsPerMeasure;
    for (let b = 0; b < totalBeats; b++) {
      const clickTime = audioCtxStart + marginBeforeM0Sec + b * beatDuration;
      scheduleWoodClick(ctx, clickTime, b % beatsPerMeasure === 0, this.activeNodes);
    }

    const buildPrompterInfo = (idx: number): ContinuousPrompterSlotInfo => {
      const layout = layouts[idx];
      const slot = project.slots[layout.slotIndex];
      const patId = targetRole === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId;
      const pat = project.patterns.find((p) => p.id === patId);
      const nextLayout = layouts.slice(idx + 1).find((l) => {
        const s = project.slots[l.slotIndex];
        return targetRole === 'puxador' ? s.puxadorPatternId : s.coroPatternId;
      });
      const nextSlot = nextLayout ? project.slots[nextLayout.slotIndex] : undefined;
      const nextPatId = nextSlot ? (targetRole === 'puxador' ? nextSlot.puxadorPatternId : nextSlot.coroPatternId) : null;
      const nextPat = nextPatId ? project.patterns.find((p) => p.id === nextPatId) : null;

      return {
        slotIndex: layout.slotIndex + 1,
        totalSlots: project.slots.length,
        conductorMeasure: layout.startMeasure,
        role: targetRole,
        lyrics: pat?.assignedLyricsText || pat?.name || '',
        hasAnacrusis: pat ? pat.hasAnacrusis !== false : false,
        anacrusisBeats: pat?.anacrusisBeats,
        nextSlotIndex: nextLayout ? nextLayout.slotIndex + 1 : undefined,
        nextMeasure: nextLayout?.startMeasure,
        nextLyrics: nextPat?.assignedLyricsText || nextPat?.name,
      };
    };

    if (layouts.length > 0) onPrompterUpdate(buildPrompterInfo(0));

    layouts.forEach((layout, i) => {
      const slot = project.slots[layout.slotIndex];
      const patId = targetRole === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId;
      const pat = project.patterns.find((p) => p.id === patId);
      const slotMeasureFromM0 = (CONTINUOUS_LEAD_IN_MEASURES - 1) + layout.startMeasure;
      const slotT1Time = audioCtxStart + marginBeforeM0Sec + slotMeasureFromM0 * measureDurationSec;
      const leadSec = pat?.hasAnacrusis !== false ? measureDurationSec : beatDuration;
      const delayMs = Math.max(0, (slotT1Time - leadSec - ctx.currentTime) * 1000);

      this.timers.push(window.setTimeout(() => {
        if (this.isRunning) onPrompterUpdate(buildPrompterInfo(i));
      }, delayMs));
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
    this.cueHandle?.stop();
    this.cueHandle = null;
    this.activeNodes.forEach((n) => {
      try {
        if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') (n as AudioScheduledSourceNode).stop();
        n.disconnect();
      } catch {}
    });
    this.activeNodes = [];
    engine?.stop();
    return recorder ? recorder.stop() : null;
  }
}
