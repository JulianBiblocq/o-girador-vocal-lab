/**
 * maracatuVocalGameEngine.ts
 * Moteur Web Audio temps réel pour les 3 Exercices Vocaux du Maracatu (Zero Render Thrashing).
 * Gère le décompte Gonguê (4 temps), la note repère synthé, la FFT (2,5-4 kHz) et le Kill-Switch.
 * Strictement < 135 lignes.
 */

import { getSharedAudioContext } from './sharedAudioContext';
import { playSingleSynthNote, type SynthScheduledNode } from './synthVoiceHelper';
import { scheduleWoodClick } from './metronomeAudioNodes';
import { detectRealtimePitch } from './realtimePitchDetector';
import {
  computeSpectralBrillianceRatio, analyzeTirFranc, analyzeOChamado, analyzeVozNoPasso,
  type MaracatuGameId, type VocalGameSample, type VocalGameEvaluation,
} from './vocalGameAnalyzers';
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface GameLiveTick {
  phase: 'precount' | 'sing';
  beatIndex: number;
  elapsedSingSec: number;
  totalSingSec: number;
  pitchMidi: number;
  rms: number;
  brillianceRatio: number;
  liveCurvePoint?: PitchCurvePoint;
}

const activeKillCallbacks = new Set<() => void>();

export function registerTreinoKillSwitch(fn: () => void): () => void {
  activeKillCallbacks.add(fn);
  return () => { activeKillCallbacks.delete(fn); };
}

export function triggerTreinoKillSwitch(): void {
  activeKillCallbacks.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
}

export class MaracatuVocalGameEngine {
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = [];
  private synthNodes: SynthScheduledNode[] = [];
  private rafId: number | null = null;
  private isRunning = false;

  async playReference(targetMidi: number, durationSec = 1.1): Promise<void> {
    const ctx = await getSharedAudioContext();
    this.stopSynthNodes();
    this.synthNodes.push(playSingleSynthNote(ctx, ctx.destination, targetMidi, ctx.currentTime, durationSec));
  }

  async startGame(
    gameId: MaracatuGameId, targetMidi: number, bpm: number,
    onTick: (tick: GameLiveTick) => void, onComplete: (res: VocalGameEvaluation) => void
  ): Promise<void> {
    this.stop();
    const ctx = await getSharedAudioContext();
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.micSource.connect(this.analyser);

    const beatDur = 60 / bpm;
    const precountSec = 4 * beatDur;
    const singBeats = gameId === 'voz_no_passo' ? 8 : 4;
    const singSec = singBeats * beatDur;
    const startTime = ctx.currentTime + 0.06;

    for (let b = 0; b < 4 + singBeats; b++) {
      scheduleWoodClick(ctx, startTime + b * beatDur, b % 4 === 0, this.activeNodes);
    }
    this.synthNodes.push(playSingleSynthNote(ctx, ctx.destination, targetMidi, startTime, precountSec * 0.85));

    const timeBuf = new Float32Array(this.analyser.fftSize);
    const freqBuf = new Float32Array(this.analyser.frequencyBinCount);
    const samples: VocalGameSample[] = [];
    this.isRunning = true;

    const loop = () => {
      if (!this.isRunning || !this.analyser) return;
      const elapsedTotal = ctx.currentTime - startTime;
      const elapsedSing = elapsedTotal - precountSec;
      const beatIdx = Math.max(0, Math.floor(elapsedTotal / beatDur));

      if (elapsedSing < 0) {
        onTick({ phase: 'precount', beatIndex: Math.min(3, beatIdx), elapsedSingSec: 0, totalSingSec: singSec, pitchMidi: 0, rms: 0, brillianceRatio: 0 });
      } else if (elapsedSing <= singSec) {
        this.analyser.getFloatTimeDomainData(timeBuf);
        this.analyser.getFloatFrequencyData(freqBuf);
        const { pitchMidi, rms } = detectRealtimePitch(timeBuf, ctx.sampleRate);
        const brillianceRatio = rms >= 0.015 ? computeSpectralBrillianceRatio(freqBuf, ctx.sampleRate, this.analyser.fftSize) : 0;
        samples.push({ timeSec: elapsedSing, pitchMidi, rms, brillianceRatio });
        const liveCurvePoint = pitchMidi > 0 ? { timeSec: precountSec + elapsedSing, midiFloat: pitchMidi } : undefined;
        onTick({ phase: 'sing', beatIndex: beatIdx - 4, elapsedSingSec: elapsedSing, totalSingSec: singSec, pitchMidi, rms, brillianceRatio, liveCurvePoint });
      }

      if (elapsedSing < singSec + 0.08) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.stop();
        const res = gameId === 'tir_franc' ? analyzeTirFranc(targetMidi, samples)
          : gameId === 'o_chamado' ? analyzeOChamado(targetMidi, samples)
          : analyzeVozNoPasso(targetMidi, samples, beatDur, precountSec);
        onComplete(res);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopSynthNodes(): void {
    for (const s of this.synthNodes) { try { s.stop(); s.disconnect(); } catch { /* ignore */ } }
    this.synthNodes = [];
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stopSynthNodes();
    for (const n of this.activeNodes) { try { if ('stop' in n) (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch { /* ignore */ } }
    this.activeNodes = [];
    if (this.micSource) { try { this.micSource.disconnect(); } catch { /* ignore */ } this.micSource = null; }
    if (this.analyser) { try { this.analyser.disconnect(); } catch { /* ignore */ } this.analyser = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
  }
}
