/**
 * pronunciationMirrorEngine.ts
 * Moteur de lecture découpée (100% / 🐢 75% WSOLA) et Miroir Audio (Enregistrement Élève ➔ Écoute Mestre puis Élève) (< 115 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { extractTrimmedPhraseAudio, timeStretchConstantPitch } from './wsolaTimeStretcher';

export class PronunciationMirrorEngine {
  private recorder = new VocalRecorderEngine();
  private activeNodes: AudioScheduledSourceNode[] = [];
  private timerId: number | null = null;
  private isRecording = false;

  public async playPhrase(
    pattern: VocalPatternItem | undefined,
    fallbackText: string,
    speedPct: 100 | 75,
    onEnded?: () => void
  ): Promise<void> {
    this.stop();
    stopAllActiveAudioEngines('pronunciation-mirror');
    registerAudioKillSwitch('pronunciation-mirror', () => { this.stop(); onEnded?.(); });

    const extracted = pattern ? extractTrimmedPhraseAudio(pattern) : null;
    if (extracted && extracted.pcm.length > 0) {
      const ctx = await getSharedAudioContext();
      const ratio = speedPct === 75 ? 0.75 : 1.0;
      const pcm = ratio < 0.99 ? timeStretchConstantPitch(extracted.pcm, extracted.sampleRate, ratio) : extracted.pcm;
      const buf = ctx.createBuffer(1, pcm.length, extracted.sampleRate);
      buf.getChannelData(0).set(pcm);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { this.stop(); onEnded?.(); };
      this.activeNodes.push(src);
      src.start();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(fallbackText);
      utt.lang = 'pt-BR';
      utt.rate = speedPct === 75 ? 0.75 : 1.0;
      utt.onend = () => onEnded?.();
      utt.onerror = () => onEnded?.();
      window.speechSynthesis.speak(utt);
    } else {
      onEnded?.();
    }
  }

  public async recordAndMirror(
    pattern: VocalPatternItem | undefined,
    fallbackText: string,
    deviceId: string | undefined,
    onPhaseChange: (phase: 'recording' | 'mirroring' | 'idle') => void
  ): Promise<void> {
    this.stop();
    stopAllActiveAudioEngines('pronunciation-mirror');
    registerAudioKillSwitch('pronunciation-mirror', () => { this.stop(); onPhaseChange('idle'); });

    const ctx = await getSharedAudioContext();
    const extracted = pattern ? extractTrimmedPhraseAudio(pattern) : null;
    const mestreDur = extracted && extracted.pcm.length > 0
      ? extracted.pcm.length / extracted.sampleRate
      : Math.max(2.2, Math.min(4.2, fallbackText.split(/\s+/).length * 0.45));
    const recordDur = Math.max(2.4, Math.min(5.0, mestreDur + 0.4));

    const sr = await this.recorder.prepare(ctx, deviceId);
    this.isRecording = true;
    onPhaseChange('recording');
    const startAt = ctx.currentTime + 0.05;
    this.recorder.start(startAt, recordDur);

    this.timerId = window.setTimeout(async () => {
      if (!this.isRecording) return;
      this.isRecording = false;
      const studentPCM = this.recorder.stop();
      this.recorder.cleanup();
      onPhaseChange('mirroring');

      const now = ctx.currentTime + 0.05;
      let studentStartOffset = 0;

      if (extracted && extracted.pcm.length > 0) {
        const mBuf = ctx.createBuffer(1, extracted.pcm.length, extracted.sampleRate);
        mBuf.getChannelData(0).set(extracted.pcm);
        const mSrc = ctx.createBufferSource();
        mSrc.buffer = mBuf;
        mSrc.connect(ctx.destination);
        mSrc.start(now);
        this.activeNodes.push(mSrc);
        studentStartOffset = mBuf.duration + 0.25;
      }

      if (studentPCM.length > 0) {
        const sBuf = ctx.createBuffer(1, studentPCM.length, sr);
        sBuf.getChannelData(0).set(studentPCM);
        const sSrc = ctx.createBufferSource();
        sSrc.buffer = sBuf;
        sSrc.connect(ctx.destination);
        sSrc.onended = () => { this.stop(); onPhaseChange('idle'); };
        sSrc.start(now + studentStartOffset);
        this.activeNodes.push(sSrc);
      } else {
        onPhaseChange('idle');
      }
    }, Math.round((recordDur + 0.1) * 1000));
  }

  public stop(): void {
    this.isRecording = false;
    if (this.timerId !== null) { window.clearTimeout(this.timerId); this.timerId = null; }
    this.recorder.cleanup();
    for (const s of this.activeNodes) {
      try { s.stop(); s.disconnect(); } catch { /* ignore */ }
    }
    this.activeNodes = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }
}
