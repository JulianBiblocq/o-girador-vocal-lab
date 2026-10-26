/**
 * ToadaPlayerEngine.ts
 * Moteur Web Audio de lecture continue de la Toada (enchaînement des blocs du Conducteur).
 */
import type { ToadaProject, VocalPatternItem } from '../../types/toadaProject.types';
import { getSharedAudioContext, setSharedSinkId } from '../../audio/sharedAudioContext';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { selectBestAudioVariant } from '../../utils/variantMatcher';
import { HarmonyPlayerEngine } from '../../audio/harmony/HarmonyPlayerEngine';

export class ToadaPlayerEngine {
  private isRunning = false;
  private activeSources: AudioBufferSourceNode[] = [];
  private timers: number[] = [];
  private harmonyEngine = new HarmonyPlayerEngine();

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
    const measureDurationSec = beatsPerMeasure * beatDuration;
    this.isRunning = true;

    const audioCtxStart = ctx.currentTime + 0.08;
    let currentMeasure = 1; // Mesure 0 d'élan initial réservée à l'anacrouse du Bloc 1

    project.slots.forEach((slot, idx) => {
      const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
      const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);
      const measuresInSlot = Math.max(puxPat?.measuresCount ?? 2, coroPat?.measuresCount ?? 2, 2);
      const blockT1Sec = currentMeasure * measureDurationSec;
      const blockTime = audioCtxStart + blockT1Sec;

      // Timer pour mise à jour visuelle du slot actif calé sur son Temps 1
      const delayMs = Math.max(0, (blockTime - ctx.currentTime) * 1000);
      const tId = window.setTimeout(() => {
        if (this.isRunning && onProgress) onProgress(idx);
      }, delayMs);
      this.timers.push(tId);

      // Planification Puxador et Coro avec tuilage musical
      if (puxPat) this.schedulePattern(ctx, puxPat, audioCtxStart, blockT1Sec, measureDurationSec);
      if (coroPat) this.schedulePattern(ctx, coroPat, audioCtxStart, blockT1Sec, measureDurationSec);

      const patHarmony = puxPat?.harmonyGrid || coroPat?.harmonyGrid || project.globalHarmonyGrid;
      if (project.harmonyConfig?.enabled && patHarmony) {
        this.harmonyEngine.schedule(ctx, ctx.destination, {
          grid: patHarmony, bpm: project.bpm, beatsPerMeasure,
          measuresCount: measuresInSlot, startTime: blockTime,
          totalDurationSec: measuresInSlot * measureDurationSec, hasAnacrusis: false,
          profile: project.harmonyConfig.profile, volume: project.harmonyConfig.volume,
          muteBass: project.harmonyConfig.muteBass,
        });
      }

      currentMeasure += (slot.advanceMeasures ?? measuresInSlot);
    });

    const totalDurationMs = Math.max(10, (audioCtxStart + (currentMeasure + 1) * measureDurationSec + 0.5 - ctx.currentTime) * 1000);
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
    this.harmonyEngine.stop();
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
  }

  private schedulePattern(ctx: AudioContext, pat: VocalPatternItem, audioCtxStart: number, blockT1Sec: number, measureDurationSec: number): void {
    const match = selectBestAudioVariant(pat.variants, 1.0, 0, pat.baseBpm ?? 100);
    const variant = match?.variant ?? pat.variants?.[pat.activeVariantKey];
    const rec = variant?.recordingResult ?? pat.recordingResult;
    if (!rec || !rec.pcm || rec.pcm.length === 0) return;
    const { pcm, sampleRate } = rec;
    const trimStartSec = variant?.trimStartSec || pat.trimStartSec || 0;
    const trimEndSec = (variant?.trimEndSec || pat.trimEndSec || 0) > 0 ? (variant?.trimEndSec || pat.trimEndSec || 0) : pcm.length / sampleRate;

    const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
    const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
    const len = Math.max(0, sEnd - sStart);
    if (len === 0) return;

    const buffer = ctx.createBuffer(1, len, sampleRate);
    buffer.getChannelData(0).set(pcm.subarray(sStart, sEnd));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Ancrage métrique absolu : when = blockT1Time + (trimStartSec - t1OffsetSec)
    const explicitT1 = variant?.t1OffsetSec ?? pat.t1OffsetSec ?? rec.t1OffsetSec;
    const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis, measureDurationSec, explicitT1);
    const startTime = audioCtxStart + blockT1Sec + (trimStartSec - t1OffsetSec);

    if (match && match.residualSemitones !== 0) {
      try { source.detune.setValueAtTime(match.residualSemitones * 100, Math.max(ctx.currentTime, startTime)); } catch {}
    }

    try {
      if (startTime >= ctx.currentTime) {
        source.start(startTime);
      } else {
        const elapsed = ctx.currentTime - startTime;
        if (elapsed < len / sampleRate) source.start(ctx.currentTime, elapsed);
        else return;
      }
      this.activeSources.push(source);
    } catch {}
  }
}
