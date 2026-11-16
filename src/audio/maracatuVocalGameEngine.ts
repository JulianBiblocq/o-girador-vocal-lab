/**
 * maracatuVocalGameEngine.ts — Moteur Web Audio temps réel des 4 Jeux de Voix Maracatu
 * connecté dynamiquement à la Toada active (BPM, troupeKey, referencePitchHz), Cadran 60 FPS & Endurance (< 138 lignes).
 */
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from './sharedAudioContext';
import { playSingleSynthNote, type SynthScheduledNode } from './synthVoiceHelper';
import { scheduleWoodClick } from './metronomeAudioNodes';
import { detectRealtimePitch } from './realtimePitchDetector';
import { foldStudentPitchToTargetOctave } from './studentPitchAnalyzer';
import { playReferenceNotePing } from './tonicDroneSynth';
import {
  computeSpectralBrillianceRatio, analyzeTirFranc, analyzeOChamado, analyzeVozNoPasso, analyzeAVozNaRoda,
  type MaracatuGameId, type VocalGameSample, type VocalGameEvaluation,
} from './vocalGameAnalyzers';
import { analyzeVocalProjectionFrame, type RodaProjectionStatus } from './rodaResonanceAnalyzer';
import { extractToadaVocalGameContext, loadEnduranceBestSec, saveEnduranceBestSec } from './toadaGameContextExtractor';
import type { PitchCurvePoint } from '../types/vocalPack.types';

export { extractToadaVocalGameContext, loadEnduranceBestSec, saveEnduranceBestSec };

export interface GameLiveTick {
  phase: 'precount' | 'sing'; beatIndex: number; elapsedSingSec: number; totalSingSec: number;
  pitchMidi: number; centsDelta: number; holdProgress01: number; enduranceSec: number;
  rms: number; brillianceRatio: number; projectionScorePct: number;
  projectionStatus: RodaProjectionStatus; liveCurvePoint?: PitchCurvePoint;
}

const activeKillCallbacks = new Set<() => void>();
export function registerTreinoKillSwitch(fn: () => void): () => void {
  activeKillCallbacks.add(fn); return () => { activeKillCallbacks.delete(fn); };
}
export function triggerTreinoKillSwitch(): void {
  activeKillCallbacks.forEach((fn) => { try { fn(); } catch {} });
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch {} }
}

export class MaracatuVocalGameEngine {
  private micStream: MediaStream | null = null; private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null; private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];
  private synthNodes: SynthScheduledNode[] = []; private rafId: number | null = null; private isRunning = false;

  async playReference(targetMidi: number, referencePitchHz = 440, durationSec = 0.9): Promise<void> {
    this.stopSynthNodes();
    await playReferenceNotePing(targetMidi, referencePitchHz, Math.round(durationSec * 1000));
  }

  async startGame(
    gameId: MaracatuGameId, targetMidi: number, bpm: number,
    onTick: (tick: GameLiveTick) => void, onComplete: (res: VocalGameEvaluation) => void,
    referencePitchHz = 440
  ): Promise<void> {
    this.stop(); stopAllActiveAudioEngines('maracatu-game'); registerAudioKillSwitch('maracatu-game', () => this.stop());
    const ctx = await getSharedAudioContext();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048;
    this.micSource.connect(this.analyser);

    const effBpm = Math.max(30, bpm), beatDur = 60 / effBpm, precountSec = 4 * beatDur;
    const singBeats = gameId === 'o_chamado' || gameId === 'a_voz_na_roda' ? 12 : gameId === 'voz_no_passo' ? 8 : 6;
    const singSec = singBeats * beatDur, startTime = ctx.currentTime + 0.06;
    for (let b = 0; b < 4 + singBeats; b++) scheduleWoodClick(ctx, startTime + b * beatDur, b % 4 === 0, this.activeNodes);
    this.synthNodes.push(playSingleSynthNote(ctx, ctx.destination, targetMidi, startTime, precountSec * 0.78));

    const timeBuf = new Float32Array(this.analyser.fftSize), freqBuf = new Float32Array(this.analyser.frequencyBinCount);
    const samples: VocalGameSample[] = [];
    this.isRunning = true;
    let prevMidi = 0, lastElapsed = 0, holdSec = 0, enduranceSec = 0, maxEnduranceSec = 0;

    const loop = () => {
      if (!this.isRunning || !this.analyser) return;
      const elapsedTotal = ctx.currentTime - startTime, elapsedSing = elapsedTotal - precountSec;
      const beatIdx = Math.max(0, Math.floor(elapsedTotal / beatDur));

      if (elapsedSing < 0) {
        onTick({ phase: 'precount', beatIndex: Math.min(3, beatIdx), elapsedSingSec: 0, totalSingSec: singSec, pitchMidi: 0, centsDelta: 0, holdProgress01: 0, enduranceSec: 0, rms: 0, brillianceRatio: 0, projectionScorePct: 0, projectionStatus: 'timide' });
      } else if (elapsedSing <= singSec) {
        const dt = Math.max(0, Math.min(0.08, elapsedSing - lastElapsed));
        lastElapsed = elapsedSing;
        this.analyser.getFloatTimeDomainData(timeBuf); this.analyser.getFloatFrequencyData(freqBuf);
        const det = detectRealtimePitch(timeBuf, ctx.sampleRate);
        const rawMidi = det.freq > 0 ? 69 + 12 * Math.log2(det.freq / referencePitchHz) : 0;
        const foldedMidi = rawMidi > 0 ? foldStudentPitchToTargetOctave(rawMidi, targetMidi) : 0;
        const centsDelta = foldedMidi > 0 ? (foldedMidi - targetMidi) * 100 : 0;
        const jitterCents = prevMidi > 0 && foldedMidi > 0 ? Math.min(120, Math.abs(foldedMidi - prevMidi) * 100) : 12;
        if (foldedMidi > 0) prevMidi = foldedMidi;
        const brillianceRatio = det.rms >= 0.015 ? computeSpectralBrillianceRatio(freqBuf, ctx.sampleRate, this.analyser.fftSize) : 0;
        const proj = analyzeVocalProjectionFrame(freqBuf, ctx.sampleRate, this.analyser.fftSize, det.rms, jitterCents);

        const inTune35 = foldedMidi > 0 && det.rms >= 0.02 && Math.abs(centsDelta) <= 35;
        holdSec = inTune35 ? holdSec + dt : Math.max(0, holdSec - dt * 1.5);
        const healthyEndurance = foldedMidi > 0 && det.rms >= 0.02 && Math.abs(centsDelta) <= 40 && proj.status !== 'forcage' && (proj.projectionScorePct >= 35 || brillianceRatio >= 0.30);
        enduranceSec = healthyEndurance ? enduranceSec + dt : 0;
        if (enduranceSec > maxEnduranceSec) maxEnduranceSec = enduranceSec;

        samples.push({ timeSec: elapsedSing, pitchMidi: foldedMidi, rms: det.rms, brillianceRatio, projectionScorePct: proj.projectionScorePct, projectionStatus: proj.status });
        const liveCurvePoint = foldedMidi > 0 ? { timeSec: precountSec + elapsedSing, midiFloat: foldedMidi } : undefined;
        onTick({ phase: 'sing', beatIndex: beatIdx - 4, elapsedSingSec: elapsedSing, totalSingSec: singSec, pitchMidi: foldedMidi, centsDelta, holdProgress01: Math.min(1, holdSec / 1.0), enduranceSec, rms: det.rms, brillianceRatio, projectionScorePct: proj.projectionScorePct, projectionStatus: proj.status, liveCurvePoint });
      }

      if (elapsedSing < singSec + 0.08) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.stop();
        if (maxEnduranceSec > 0) saveEnduranceBestSec(maxEnduranceSec);
        const res = gameId === 'tir_franc' ? analyzeTirFranc(targetMidi, samples)
          : gameId === 'o_chamado' ? analyzeOChamado(targetMidi, samples)
          : gameId === 'a_voz_na_roda' ? analyzeAVozNaRoda(targetMidi, samples)
          : analyzeVozNoPasso(targetMidi, samples, beatDur, precountSec);
        onComplete(res);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopSynthNodes(): void {
    for (const s of this.synthNodes) { try { s.stop(); s.disconnect(); } catch {} }
    this.synthNodes = [];
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stopSynthNodes();
    for (const n of this.activeNodes) { try { if ('stop' in n) (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch {} }
    this.activeNodes = [];
    if (this.micSource) { try { this.micSource.disconnect(); } catch {} this.micSource = null; }
    if (this.analyser) { try { this.analyser.disconnect(); } catch {} this.analyser = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
  }
}
