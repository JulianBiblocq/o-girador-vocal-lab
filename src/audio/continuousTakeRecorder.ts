/**
 * continuousTakeRecorder.ts
 * Enregistrement continu d'un rôle vocal entier sur la Frise Conducteur (< 140 lignes).
 */
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from './MetronomeEngine';
import type { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleContinuousCounterRole, type ContinuousCueHandle } from './continuousCueHelper';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { buildDeviceSignature } from '../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../utils/latencyStorage';
import { scheduleWoodClick } from './metronomeAudioNodes';

export interface ContinuousPrompterSlotInfo {
  slotIndex: number;
  totalSlots: number;
  conductorMeasure: number;
  role: VocalRole;
  lyrics: string;
  nextSlotIndex?: number;
  nextMeasure?: number;
  nextLyrics?: string;
}

export interface ContinuousRecordParams {
  project: ToadaProject;
  targetRole: VocalRole;
  engine: MetronomeEngine;
  recorder: VocalRecorderEngine;
  listeningMode: ListeningMode;
  selectedDeviceId: string;
  selectedOutputDeviceId: string;
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
    const beatDuration = 60 / (project.bpm || 55);
    const measureDurationSec = beatsPerMeasure * beatDuration;

    let totalSongMeasures = 1;
    const slotTimings: Array<{ idx: number; measure: number; measuresInSlot: number; puxId: string | null; coroId: string | null }> = [];

    project.slots.forEach((s, idx) => {
      const pux = project.patterns.find((p) => p.id === s.puxadorPatternId);
      const coro = project.patterns.find((p) => p.id === s.coroPatternId);
      const mInSlot = Math.max(pux?.measuresCount ?? 2, coro?.measuresCount ?? 2, 2);
      slotTimings.push({ idx, measure: totalSongMeasures, measuresInSlot: mInSlot, puxId: s.puxadorPatternId, coroId: s.coroPatternId });
      totalSongMeasures += (s.advanceMeasures ?? mInSlot);
    });

    const marginBeforeM0Sec = 0.6;
    const totalTakeSec = marginBeforeM0Sec + (1 + totalSongMeasures) * measureDurationSec + beatDuration + 1.0;
    const audioCtxStart = ctx.currentTime + 0.1;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const latencySec = getSavedLatencyOffsetMs(sig) / 1000;
    const captureStartTime = audioCtxStart - marginBeforeM0Sec - latencySec;

    recorder.start(captureStartTime, totalTakeSec);

    if (listeningMode === 'headphones') {
      this.cueHandle = scheduleContinuousCounterRole(ctx, project, targetRole, audioCtxStart, marginBeforeM0Sec);
    }

    // Planification des clics métronome
    const totalBeats = (1 + totalSongMeasures) * beatsPerMeasure;
    for (let b = 0; b < totalBeats; b++) {
      const clickTime = audioCtxStart + marginBeforeM0Sec + b * beatDuration;
      const isDownbeat = b % beatsPerMeasure === 0;
      scheduleWoodClick(ctx, clickTime, isDownbeat, this.activeNodes);
    }

    // Planification des jalons Prompteur
    slotTimings.forEach((slot, i) => {
      const slotStartTime = audioCtxStart + marginBeforeM0Sec + slot.measure * measureDurationSec;
      const delayMs = Math.max(0, (slotStartTime - ctx.currentTime) * 1000);

      const tId = window.setTimeout(() => {
        if (!this.isRunning) return;
        const currentPatId = targetRole === 'puxador' ? slot.puxId : slot.coroId;
        const currentPat = project.patterns.find((p) => p.id === currentPatId);
        const nextTargetSlot = slotTimings.slice(i + 1).find((s) => (targetRole === 'puxador' ? s.puxId : s.coroId));
        const nextPatId = nextTargetSlot ? (targetRole === 'puxador' ? nextTargetSlot.puxId : nextTargetSlot.coroId) : null;
        const nextPat = nextPatId ? project.patterns.find((p) => p.id === nextPatId) : null;

        onPrompterUpdate({
          slotIndex: slot.idx + 1,
          totalSlots: project.slots.length,
          conductorMeasure: slot.measure,
          role: targetRole,
          lyrics: currentPat?.assignedLyricsText || currentPat?.name || '',
          nextSlotIndex: nextTargetSlot ? nextTargetSlot.idx + 1 : undefined,
          nextMeasure: nextTargetSlot?.measure,
          nextLyrics: nextPat?.assignedLyricsText || nextPat?.name,
        });
      }, delayMs);
      this.timers.push(tId);
    });

    const finishMs = Math.max(10, (audioCtxStart + totalTakeSec - ctx.currentTime) * 1000);
    const finalTimer = window.setTimeout(() => {
      if (!this.isRunning) return;
      const pcm = recorder.stop();
      this.stop(recorder, engine);
      onComplete(pcm, sampleRate, marginBeforeM0Sec);
    }, finishMs);
    this.timers.push(finalTimer);
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
