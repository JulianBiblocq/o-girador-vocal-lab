/**
 * StudentTrainerEngine.ts
 * Moteur d entrainement vocal Web Audio (Zero Render Thrashing).
 * Gere le decompte M-2, le mute selectif en mode autonome, la capture micro eleve
 * et la reecoute comparative (Voix seule / Voix + Guide).
 */
import { getSharedAudioContext } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleWoodClick, scheduleReferencePitch } from './metronomeAudioNodes';
import type { VocalPatternItem } from '../types/toadaProject.types';
import type { HarmonyConfig } from '../types/harmony.types';
import type { TrainerGuideMode, StudentRole } from '../components/livret-treino/TrainerConfigBar';
import { HarmonyPlayerEngine } from './harmony/HarmonyPlayerEngine';

export interface StudentTrainingConfig {
  pattern: VocalPatternItem; bpm: number; beatsPerMeasure: number; measuresCount: number;
  studentRole: StudentRole; guideMode: TrainerGuideMode; deviceId?: string; outputDeviceId?: string;
  harmonyConfig?: HarmonyConfig; pitchShiftSemitones?: number;
}

export class StudentTrainerEngine {
  private ctx: AudioContext | null = null; private recorder = new VocalRecorderEngine();
  private isRunning = false; private animId: number | null = null;
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];
  private comparativeSource: AudioBufferSourceNode | null = null;
  private harmonyEngine = new HarmonyPlayerEngine();

  public async startTraining(
    config: StudentTrainingConfig,
    onPlayhead: (sec: number, stepIdx: number) => void,
    onComplete: (pcm: Float32Array, sampleRate: number) => void
  ): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    this.isRunning = true;

    const sampleRate = await this.recorder.prepare(this.ctx, config.deviceId);
    const beatDur = 60 / config.bpm;
    const countdownSec = config.beatsPerMeasure * beatDur;
    const hasAnac = config.pattern.hasAnacrusis !== false;
    const singingSec = (hasAnac ? 1 + config.measuresCount : config.measuresCount) * config.beatsPerMeasure * beatDur;
    const totalSec = countdownSec + singingSec;
    const startTime = this.ctx.currentTime + 0.08;

    // 1. Decompte M-2 avec Wood Clicks et Note repere
    for (let b = 0; b < config.beatsPerMeasure; b++) {
      scheduleWoodClick(this.ctx, startTime + b * beatDur, b === 0, this.activeNodes);
    }
    scheduleReferencePitch(this.ctx, startTime, 'C4', countdownSec, this.activeNodes);

    // 2. Voix originale / Guide (sauf si mode autonome pour le role de l eleve)
    const shouldMuteVoice = config.guideMode === 'autonomous' &&
      (config.studentRole === 'all' || config.studentRole === config.pattern.role);

    const voicePCM = (config.pattern.correctedAudioSamples && (config.pattern.pitchCorrectionAmount ?? 0) > 0)
      ? config.pattern.correctedAudioSamples
      : config.pattern.recordingResult?.pcm;

    if (!shouldMuteVoice && voicePCM) {
      const pcm = voicePCM;
      const sr = config.pattern.recordingResult?.sampleRate ?? 44100;
      const buffer = this.ctx.createBuffer(1, pcm.length, sr);
      buffer.getChannelData(0).set(pcm);

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.ctx.destination);
      src.start(startTime + countdownSec);
      this.activeNodes.push(src);
    }

    if (config.harmonyConfig?.enabled && config.pattern.harmonyGrid) {
      this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
        grid: config.pattern.harmonyGrid, bpm: config.bpm, beatsPerMeasure: config.beatsPerMeasure,
        measuresCount: config.measuresCount, startTime: startTime + countdownSec,
        totalDurationSec: singingSec, hasAnacrusis: hasAnac, pitchShiftSemitones: config.pitchShiftSemitones,
        profile: config.harmonyConfig.profile, volume: config.harmonyConfig.volume,
        muteBass: config.harmonyConfig.muteBass,
      });
    }

    // 3. Capture micro eleve
    this.recorder.start(startTime + countdownSec, singingSec);

    // 4. Boucle RAF Playhead 60 FPS
    const stepDurSec = beatDur / 4;
    const tick = () => {
      if (!this.isRunning || !this.ctx) return;
      const elapsed = this.ctx.currentTime - (startTime + countdownSec);
      if (elapsed >= 0 && elapsed <= singingSec) {
        const step = Math.floor(elapsed / stepDurSec);
        onPlayhead(elapsed, step);
      }
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);

    // 5. Fin de cycle
    const timeoutMs = (startTime - this.ctx.currentTime + totalSec) * 1000;
    setTimeout(() => {
      if (!this.isRunning) return;
      const pcm = this.recorder.stop();
      this.stop();
      onComplete(pcm, sampleRate);
    }, Math.max(10, timeoutMs));
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.recorder.cleanup();
    this.harmonyEngine.stop();
    for (const n of this.activeNodes) {
      try {
        if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') (n as AudioScheduledSourceNode).stop();
        n.disconnect();
      } catch {}
    }
    this.activeNodes = [];
    if (this.comparativeSource) {
      try { this.comparativeSource.stop(); this.comparativeSource.disconnect(); } catch {}
      this.comparativeSource = null;
    }
  }

  public async playComparative(pcm: Float32Array, sampleRate: number, onEnded?: () => void): Promise<void> {
    this.stop();
    this.ctx = await getSharedAudioContext();
    const buffer = this.ctx.createBuffer(1, pcm.length, sampleRate);
    buffer.getChannelData(0).set(pcm);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.onended = () => { if (onEnded) onEnded(); };
    src.start();
    this.comparativeSource = src;
  }
}
