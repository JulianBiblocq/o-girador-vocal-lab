/**
 * ToadaPlayerEngine.ts
 * Moteur Web Audio de lecture continue de la Toada (enchaînement des blocs du Conducteur).
 */
import type { ToadaProject, VocalPatternItem } from '../../types/toadaProject.types';
import { getSharedAudioContext, setSharedSinkId } from '../../audio/sharedAudioContext';
import { getBeatsPerMeasure } from '../../utils/musicalMath';

export class ToadaPlayerEngine {
  private isRunning = false;
  private activeSources: AudioBufferSourceNode[] = [];
  private timers: number[] = [];

  public getIsPlaying(): boolean {
    return this.isRunning;
  }

  public async play(
    project: ToadaProject,
    outputDeviceId?: string,
    onProgress?: (slotIndex: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    this.stop();
    const ctx = await getSharedAudioContext();
    if (outputDeviceId && outputDeviceId !== 'default') {
      await setSharedSinkId(outputDeviceId);
    }

    const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
    const beatDuration = 60 / project.bpm;
    this.isRunning = true;

    let currentScheduleTime = ctx.currentTime + 0.05;

    project.slots.forEach((slot, idx) => {
      const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
      const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);
      const measuresInSlot = Math.max(puxPat?.measuresCount ?? 2, coroPat?.measuresCount ?? 2, 2);
      const slotDuration = measuresInSlot * beatsPerMeasure * beatDuration;

      // Timer pour mise à jour visuelle du slot actif
      const delayMs = Math.max(0, (currentScheduleTime - ctx.currentTime) * 1000);
      const tId = window.setTimeout(() => {
        if (this.isRunning && onProgress) onProgress(idx);
      }, delayMs);
      this.timers.push(tId);

      // Planification des deux pistes (Puxador et Coro peuvent se superposer !)
      if (puxPat) this.schedulePattern(ctx, puxPat, currentScheduleTime);
      if (coroPat) this.schedulePattern(ctx, coroPat, currentScheduleTime);

      currentScheduleTime += slotDuration;
    });

    const totalDurationMs = Math.max(10, (currentScheduleTime - ctx.currentTime) * 1000);
    const finalTimer = window.setTimeout(() => {
      this.stop();
      if (onComplete) onComplete();
    }, totalDurationMs);
    this.timers.push(finalTimer);
  }

  public stop(): void {
    this.isRunning = false;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
  }

  private schedulePattern(ctx: AudioContext, pat: VocalPatternItem, slotStartTime: number): void {
    if (!pat.recordingResult || !pat.recordingResult.pcm) return;
    const { pcm, sampleRate } = pat.recordingResult;
    const sStart = Math.max(0, Math.floor((pat.trimStartSec || 0) * sampleRate));
    const sEnd = pat.trimEndSec > 0 ? Math.min(pcm.length, Math.floor(pat.trimEndSec * sampleRate)) : pcm.length;
    const len = Math.max(0, sEnd - sStart);
    if (len === 0) return;

    const buffer = ctx.createBuffer(1, len, sampleRate);
    buffer.getChannelData(0).set(pcm.subarray(sStart, sEnd));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    try {
      source.start(slotStartTime);
      this.activeSources.push(source);
    } catch {}
  }
}
