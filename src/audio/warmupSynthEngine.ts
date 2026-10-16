/**
 * warmupSynthEngine.ts
 * Moteur de lecture synthé et analyse temps réel pour les jeux d'échauffement.
 * Strictement < 150 lignes.
 */

import { getSharedAudioContext } from './sharedAudioContext';
import { playSingleSynthNote, type SynthScheduledNode } from './synthVoiceHelper';
import { detectRealtimePitch } from './realtimePitchDetector';
import type { ExerciseStep } from '../utils/warmupExercisesData';

export interface WarmupLiveState {
  currentStepIndex: number;
  currentMidiTarget: number;
  sungMidi: number;
  centsDiff: number;
  isAccurate: boolean; // <= 45 cents
  rms: number;
}

export class WarmupSynthEngine {
  private scheduledNodes: SynthScheduledNode[] = [];
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private isRunning = false;

  async startExercise(
    steps: ExerciseStep[],
    bpm: number,
    onTick: (state: WarmupLiveState) => void,
    onComplete: () => void
  ): Promise<void> {
    this.stop();
    const ctx = await getSharedAudioContext();
    const beatDurationSec = 60 / bpm;

    // 1. Démarrage de la capture micro
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.micSource.connect(this.analyser);

    // 2. Programmation des notes du synthé guide
    const startTime = ctx.currentTime + 0.1;
    let accumulatedTime = 0;
    const stepTimeWindows: { startSec: number; endSec: number; step: ExerciseStep }[] = [];

    for (const step of steps) {
      const durSec = step.durationBeats * beatDurationSec;
      const tStart = accumulatedTime;
      const tEnd = accumulatedTime + durSec;
      stepTimeWindows.push({ startSec: tStart, endSec: tEnd, step });

      const node = playSingleSynthNote(ctx, ctx.destination, step.midiNumber, startTime + tStart, durSec * 0.95);
      this.scheduledNodes.push(node);
      accumulatedTime += durSec;
    }

    const totalDurationSec = accumulatedTime;
    const startPerfTime = performance.now();
    this.isRunning = true;
    const buffer = new Float32Array(this.analyser.fftSize);

    const loop = () => {
      if (!this.isRunning || !this.analyser) return;
      this.analyser.getFloatTimeDomainData(buffer);
      const { pitchMidi, rms } = detectRealtimePitch(buffer, ctx.sampleRate);
      const elapsedSec = (performance.now() - startPerfTime) / 1000;

      const currentWin = stepTimeWindows.find((w) => elapsedSec >= w.startSec && elapsedSec < w.endSec);
      const currentTarget = currentWin ? currentWin.step.midiNumber : 0;
      const currentIdx = currentWin ? currentWin.step.stepIndex : -1;

      let centsDiff = 999;
      let isAccurate = false;
      if (currentTarget > 0 && pitchMidi > 0) {
        centsDiff = Math.abs(pitchMidi - currentTarget) * 100;
        isAccurate = centsDiff <= 45;
      }

      onTick({
        currentStepIndex: currentIdx,
        currentMidiTarget: currentTarget,
        sungMidi: pitchMidi,
        centsDiff,
        isAccurate,
        rms,
      });

      if (elapsedSec < totalDurationSec + 0.3) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.stop();
        onComplete();
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const node of this.scheduledNodes) {
      try { node.stop(); node.disconnect(); } catch { /* ignore */ }
    }
    this.scheduledNodes = [];

    if (this.micSource) {
      try { this.micSource.disconnect(); } catch { /* ignore */ }
      this.micSource = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* ignore */ }
      this.analyser = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }
}
