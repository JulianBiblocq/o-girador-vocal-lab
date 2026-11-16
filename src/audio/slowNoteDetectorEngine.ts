/**
 * slowNoteDetectorEngine.ts
 * Moteur temps réel « Cherche-Notes » (Voix lente Puxador & Pas-à-pas Élève) :
 * Fenêtre médiane tronquée ~300 ms, rejet sibilantes, hystérésis ±25 cents, gel anti-repisse (freezeForMs + 120 ms)
 * et support Mode Dictée Libre vs Mode Cible Guidée (octaveInvariant mod 12) (< 135 lignes).
 */
import { getSharedAudioContext, registerAudioKillSwitch } from './sharedAudioContext';
import { detectRealtimePitch } from './realtimePitchDetector';
import { analyzeFrameSibilantBreath } from './sibilantBreathMasker';
import { foldStudentPitchToTargetOctave } from './studentPitchAnalyzer';
import { getEffectiveVocalBounds } from '../utils/ambitusStorage';
import { sanitizePitchHz } from '../utils/pitchHzContract';

export interface SlowNoteDetectorOptions {
  targetMidi?: number | null; octaveInvariant?: boolean; referencePitchHz?: number;
  requiredHoldMs?: number; toleranceCents?: number; minMidi?: number; maxMidi?: number; deviceId?: string;
}

export interface SlowNoteTick {
  isVoiced: boolean; isFrozen: boolean; rawMidiFloat: number; stabilizedMidiFloat: number;
  displayedMidiNote: number; centsDelta: number; semitonesDelta: number;
  holdProgress01: number; holdDurationMs: number; justValidatedMidi: number | null; rms: number;
}

export class SlowNoteStabilizer {
  private windowSamples: Array<{ timeMs: number; midiFloat: number }> = [];
  private displayedNote = 0; private holdMs = 0; private lastTickMs = 0;
  private frozenUntilMs = 0; private emittedInCurrentHold = false; private silenceAccumMs = 0;

  public freezeForMs(durationMs: number, nowMs = performance.now()): void {
    this.frozenUntilMs = Math.max(this.frozenUntilMs, nowMs + Math.max(0, durationMs) + 120);
    this.windowSamples = [];
  }

  public resetHold(): void { this.holdMs = 0; this.emittedInCurrentHold = false; }

  public processFrame(frame: Float32Array, sampleRate: number, nowMs: number, opts: SlowNoteDetectorOptions = {}): SlowNoteTick {
    const dtMs = this.lastTickMs > 0 ? Math.max(0, Math.min(80, nowMs - this.lastTickMs)) : 16;
    this.lastTickMs = nowMs;

    if (nowMs < this.frozenUntilMs) {
      return { isVoiced: false, isFrozen: true, rawMidiFloat: 0, stabilizedMidiFloat: this.displayedNote, displayedMidiNote: this.displayedNote, centsDelta: 0, semitonesDelta: 0, holdProgress01: 0, holdDurationMs: 0, justValidatedMidi: null, rms: 0 };
    }

    const sib = analyzeFrameSibilantBreath(frame, sampleRate);
    const det = sib.isSibilantOrBreath ? { pitchMidi: 0, freq: 0, rms: sib.rms } : detectRealtimePitch(frame, sampleRate, 0.012);
    const rawMidi = det.freq > 0 ? 69 + 12 * Math.log2(det.freq / sanitizePitchHz(opts.referencePitchHz)) : 0;
    const bounds = getEffectiveVocalBounds();
    const minM = opts.minMidi ?? Math.max(34, bounds.minMidi - 5), maxM = opts.maxMidi ?? Math.min(86, bounds.maxMidi + 5);
    const validVoice = rawMidi >= minM && rawMidi <= maxM;

    if (validVoice) {
      this.silenceAccumMs = 0;
      this.windowSamples.push({ timeMs: nowMs, midiFloat: rawMidi });
    } else {
      this.silenceAccumMs += dtMs;
      if (this.silenceAccumMs >= 85) { this.holdMs = Math.max(0, this.holdMs - dtMs * 2.2); this.emittedInCurrentHold = false; }
    }
    this.windowSamples = this.windowSamples.filter((s) => nowMs - s.timeMs <= 300);

    const reqMs = Math.max(120, opts.requiredHoldMs ?? 420);
    if (this.windowSamples.length < 2) {
      return { isVoiced: false, isFrozen: false, rawMidiFloat: rawMidi, stabilizedMidiFloat: 0, displayedMidiNote: this.displayedNote, centsDelta: 0, semitonesDelta: 0, holdProgress01: Math.min(1, this.holdMs / reqMs), holdDurationMs: this.holdMs, justValidatedMidi: null, rms: det.rms };
    }

    const sorted = this.windowSamples.map((s) => s.midiFloat).sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * 0.2), slice = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
    let medFloat = slice.reduce((a, b) => a + b, 0) / slice.length;
    if (opts.targetMidi != null && opts.octaveInvariant) medFloat = foldStudentPitchToTargetOctave(medFloat, opts.targetMidi);

    const prevNote = this.displayedNote;
    if (this.displayedNote === 0 || Math.abs(medFloat - this.displayedNote) > 0.625) {
      this.displayedNote = Math.round(medFloat);
      if (opts.targetMidi == null && this.displayedNote !== prevNote) { this.holdMs = 0; this.emittedInCurrentHold = false; }
    }

    const refTarget = opts.targetMidi != null ? opts.targetMidi : this.displayedNote;
    const semitonesDelta = medFloat - refTarget, centsDelta = semitonesDelta * 100;
    let justValidatedMidi: number | null = null;
    if (validVoice && Math.abs(centsDelta) <= (opts.toleranceCents ?? 35) && refTarget > 0) {
      this.holdMs += dtMs;
      if (this.holdMs >= reqMs && !this.emittedInCurrentHold) { this.emittedInCurrentHold = true; justValidatedMidi = refTarget; }
    } else {
      this.holdMs = Math.max(0, this.holdMs - dtMs * 1.4);
    }

    return {
      isVoiced: validVoice, isFrozen: false, rawMidiFloat: rawMidi, stabilizedMidiFloat: medFloat,
      displayedMidiNote: this.displayedNote, centsDelta, semitonesDelta,
      holdProgress01: Math.min(1, this.holdMs / reqMs), holdDurationMs: this.holdMs, justValidatedMidi, rms: det.rms,
    };
  }
}

export class SlowNoteDetectorEngine {
  private stream: MediaStream | null = null; private src: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null; private rafId: number | null = null;
  private unregKill: (() => void) | null = null; public readonly stabilizer = new SlowNoteStabilizer();
  private opts: SlowNoteDetectorOptions = {};

  public updateOptions(next: Partial<SlowNoteDetectorOptions>): void { this.opts = { ...this.opts, ...next }; }
  public freezeForMs(ms: number): void { this.stabilizer.freezeForMs(ms); }
  public resetHold(): void { this.stabilizer.resetHold(); }

  public async start(initialOpts: SlowNoteDetectorOptions, onTick: (tick: SlowNoteTick) => void): Promise<void> {
    this.stop(); this.opts = { ...initialOpts }; this.stabilizer.resetHold();
    const ctx = await getSharedAudioContext(); if (ctx.state !== 'running') await ctx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: this.opts.deviceId && this.opts.deviceId !== 'default' ? { deviceId: { exact: this.opts.deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.src = ctx.createMediaStreamSource(this.stream); this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048;
    this.src.connect(this.analyser);
    const buf = new Float32Array(2048);
    this.unregKill = registerAudioKillSwitch('slow-note-detector', () => this.stop());
    const loop = () => { if (!this.analyser) return; this.analyser.getFloatTimeDomainData(buf); onTick(this.stabilizer.processFrame(buf, ctx.sampleRate, performance.now(), this.opts)); this.rafId = requestAnimationFrame(loop); };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.unregKill) { this.unregKill(); this.unregKill = null; }
    try { this.src?.disconnect(); } catch {} try { this.analyser?.disconnect(); } catch {}
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); }
    this.src = null; this.analyser = null; this.stream = null;
  }
}
