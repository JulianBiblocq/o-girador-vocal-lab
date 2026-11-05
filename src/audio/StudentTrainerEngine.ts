/**
 * StudentTrainerEngine.ts — Moteur d'entraînement vocal Web Audio Studio Élève 2.0 (Trace pitch 60 FPS, Projection Roda, WSOLA) (< 138 lignes).
 */
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleWoodClick, scheduleReferencePitch } from './metronomeAudioNodes';
import { scheduleSecondaryTakeGuide, type TakeGuideHandle } from './takeGuideHelper';
import { scheduleCuePatternAudio, type CuePlaybackHandle } from './cueAudioHelper';
import { detectRealtimePitch } from './realtimePitchDetector';
import { extractCanonicalMestreBuffer, timeStretchConstantPitch } from './wsolaTimeStretcher';
import { analyzeVocalProjectionFrame, computeSessionProjectionSummary, type RodaProjectionFrameResult, type SessionProjectionSummary } from './rodaResonanceAnalyzer';
import type { VocalPatternItem } from '../types/toadaProject.types';
import type { HarmonyConfig } from '../types/harmony.types';
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TrainerGuideMode, StudentRole, TrainerScope } from '../components/livret-treino/TrainerConfigBar';
import { HarmonyPlayerEngine } from './harmony/HarmonyPlayerEngine';

export type ComparativePlaybackMode = 'mix' | 'student' | 'mestre';
export interface StudentTrainingConfig {
  pattern: VocalPatternItem; cuePattern?: VocalPatternItem | null; baseBpm: number; bpm: number; speedRatio?: number;
  beatsPerMeasure: number; measuresCount: number; scope?: TrainerScope; studentRole: StudentRole; guideMode: TrainerGuideMode;
  deviceId?: string; outputDeviceId?: string; harmonyConfig?: HarmonyConfig; pitchShiftSemitones?: number;
}

export class StudentTrainerEngine {
  private ctx: AudioContext | null = null; private recorder = new VocalRecorderEngine();
  private isRunning = false; private animId: number | null = null; private stopTimerId: number | null = null;
  private activeNodes: (AudioNode | AudioScheduledSourceNode)[] = []; private harmonyEngine = new HarmonyPlayerEngine();
  private guideHandle: TakeGuideHandle | null = null; private cueHandle: CuePlaybackHandle | null = null;
  private liveStream: MediaStream | null = null; private liveAnalyser: AnalyserNode | null = null;

  public async startTraining(
    config: StudentTrainingConfig,
    onPlayhead: (sec: number, stepIdx: number, livePoint?: PitchCurvePoint, liveProjection?: RodaProjectionFrameResult) => void,
    onComplete: (pcm: Float32Array, sampleRate: number, projectionSummary: SessionProjectionSummary) => void
  ): Promise<void> {
    this.stop(); stopAllActiveAudioEngines('student-trainer'); registerAudioKillSwitch('student-trainer', () => this.stop());
    this.ctx = await getSharedAudioContext(); this.isRunning = true;
    const sampleRate = await this.recorder.prepare(this.ctx, config.deviceId);
    try {
      this.liveStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const micSrc = this.ctx.createMediaStreamSource(this.liveStream);
      this.liveAnalyser = this.ctx.createAnalyser(); this.liveAnalyser.fftSize = 2048;
      micSrc.connect(this.liveAnalyser); this.activeNodes.push(micSrc);
    } catch {}

    const beatDur = 60 / config.bpm, measureDur = config.beatsPerMeasure * beatDur;
    const hasCue = config.scope === 'toada' && !!config.cuePattern;
    const preRollMeasures = hasCue && config.cuePattern ? 1 + config.cuePattern.measuresCount : 1;
    const hasAnac = config.pattern.hasAnacrusis !== false, singingMeasures = (hasAnac ? 1 : 0) + config.measuresCount;
    const countdownSec = preRollMeasures * measureDur, singingSec = singingMeasures * measureDur;
    const startTime = this.ctx.currentTime + 0.08, singStartTime = startTime + countdownSec;
    for (let b = 0; b < (preRollMeasures + singingMeasures) * config.beatsPerMeasure; b++) {
      scheduleWoodClick(this.ctx, startTime + b * beatDur, b % config.beatsPerMeasure === 0, this.activeNodes);
    }
    scheduleReferencePitch(this.ctx, startTime, config.pattern.referencePitch || 'C4', measureDur * 0.85, this.activeNodes);
    if (hasCue && config.cuePattern) this.cueHandle = scheduleCuePatternAudio(this.ctx, config.cuePattern, startTime, config.beatsPerMeasure, beatDur, config.bpm);
    const shouldPlayMestreVoice = config.guideMode === 'accompanied' || (config.guideMode === 'autonomous' && config.studentRole !== 'all' && config.studentRole !== config.pattern.role);
    if (shouldPlayMestreVoice) {
      const mestre = extractCanonicalMestreBuffer(config.pattern, config.baseBpm, config.beatsPerMeasure, sampleRate);
      if (mestre?.pcm.length) {
        const stretched = timeStretchConstantPitch(mestre.pcm, mestre.sampleRate, config.speedRatio ?? 1.0);
        const buf = this.ctx.createBuffer(1, stretched.length, mestre.sampleRate); buf.getChannelData(0).set(stretched);
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.ctx.destination);
        src.start(singStartTime, hasAnac ? 0 : 0.15 / (config.speedRatio ?? 1.0)); this.activeNodes.push(src);
      }
    } else if (config.guideMode === 'voice_only') {
      this.guideHandle = scheduleSecondaryTakeGuide(this.ctx, this.ctx.destination, config.pattern.anacrusisSteps || [], config.pattern.mainSteps || [], singStartTime, hasAnac ? measureDur : 0, config.bpm, config.pitchShiftSemitones ?? 0);
    }
    if (config.harmonyConfig?.enabled && config.pattern.harmonyGrid) {
      this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
        grid: config.pattern.harmonyGrid, bpm: config.bpm, beatsPerMeasure: config.beatsPerMeasure, measuresCount: config.measuresCount,
        startTime: singStartTime, totalDurationSec: singingSec, hasAnacrusis: hasAnac, pitchShiftSemitones: config.pitchShiftSemitones,
        profile: config.harmonyConfig.profile, volume: config.harmonyConfig.volume, muteBass: config.harmonyConfig.muteBass,
      });
    }
    this.recorder.start(singStartTime, singingSec);
    const stepDurSec = beatDur / 4, timeBuf = new Float32Array(2048), freqBuf = new Float32Array(1024);
    const projectionFrames: RodaProjectionFrameResult[] = [];
    let prevMidi = 0;
    const tick = () => {
      if (!this.isRunning || !this.ctx) return;
      const elapsed = this.ctx.currentTime - singStartTime;
      if (elapsed >= 0 && elapsed <= singingSec) {
        let livePt: PitchCurvePoint | undefined, liveProj: RodaProjectionFrameResult | undefined;
        if (this.liveAnalyser) {
          this.liveAnalyser.getFloatTimeDomainData(timeBuf); this.liveAnalyser.getFloatFrequencyData(freqBuf);
          const { pitchMidi, rms } = detectRealtimePitch(timeBuf, this.ctx.sampleRate);
          const jitterCents = prevMidi > 0 && pitchMidi > 0 ? Math.min(120, Math.abs(pitchMidi - prevMidi) * 100) : 12;
          if (pitchMidi > 0) prevMidi = pitchMidi;
          if (pitchMidi > 0 && rms >= 0.01) livePt = { timeSec: elapsed, midiFloat: pitchMidi };
          liveProj = analyzeVocalProjectionFrame(freqBuf, this.ctx.sampleRate, this.liveAnalyser.fftSize, rms, jitterCents);
          if (liveProj.isVoiced) projectionFrames.push(liveProj);
        }
        onPlayhead(elapsed, Math.floor(elapsed / stepDurSec), livePt, liveProj);
      }
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
    this.stopTimerId = window.setTimeout(() => {
      if (!this.isRunning) return;
      const pcm = this.recorder.stop(); this.stop(); onComplete(pcm, sampleRate, computeSessionProjectionSummary(projectionFrames));
    }, Math.max(20, (singStartTime - this.ctx.currentTime + singingSec + 0.05) * 1000));
  }

  public async playComparative(
    studentPCM: Float32Array, studentSampleRate: number, pattern?: VocalPatternItem, baseBpm = 88, speedRatio = 1.0,
    mode: ComparativePlaybackMode = 'mix', onEnded?: () => void
  ): Promise<void> {
    this.stop(); stopAllActiveAudioEngines('student-trainer'); registerAudioKillSwitch('student-trainer', () => { this.stop(); onEnded?.(); });
    this.ctx = await getSharedAudioContext();
    const now = this.ctx.currentTime + 0.04; let maxDur = 0;
    if ((mode === 'mix' || mode === 'student') && studentPCM.length > 0) {
      const sBuf = this.ctx.createBuffer(1, studentPCM.length, studentSampleRate); sBuf.getChannelData(0).set(studentPCM);
      const sSrc = this.ctx.createBufferSource(); sSrc.buffer = sBuf; sSrc.connect(this.ctx.destination);
      sSrc.start(now); this.activeNodes.push(sSrc); maxDur = Math.max(maxDur, sBuf.duration);
    }
    if ((mode === 'mix' || mode === 'mestre') && pattern) {
      const mestre = extractCanonicalMestreBuffer(pattern, baseBpm, 4, studentSampleRate);
      if (mestre?.pcm.length) {
        const stretched = timeStretchConstantPitch(mestre.pcm, mestre.sampleRate, speedRatio);
        const mBuf = this.ctx.createBuffer(1, stretched.length, mestre.sampleRate); mBuf.getChannelData(0).set(stretched);
        const mGain = this.ctx.createGain(); mGain.gain.value = mode === 'mix' ? 0.75 : 1.0;
        const mSrc = this.ctx.createBufferSource(); mSrc.buffer = mBuf; mSrc.connect(mGain); mGain.connect(this.ctx.destination);
        const offset = pattern.hasAnacrusis !== false ? 0 : 0.15 / speedRatio;
        mSrc.start(now, offset); this.activeNodes.push(mSrc, mGain); maxDur = Math.max(maxDur, mBuf.duration - offset);
      }
    }
    this.stopTimerId = window.setTimeout(() => { this.stop(); onEnded?.(); }, Math.max(100, (maxDur + 0.05) * 1000));
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animId !== null) { cancelAnimationFrame(this.animId); this.animId = null; }
    if (this.stopTimerId !== null) { window.clearTimeout(this.stopTimerId); this.stopTimerId = null; }
    this.recorder.cleanup(); this.harmonyEngine.stop(); this.guideHandle?.stop(); this.cueHandle?.stop(); this.guideHandle = null; this.cueHandle = null;
    for (const n of this.activeNodes) { try { if ('stop' in n) (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch {} }
    this.activeNodes = [];
    if (this.liveAnalyser) { try { this.liveAnalyser.disconnect(); } catch {} this.liveAnalyser = null; }
    if (this.liveStream) { this.liveStream.getTracks().forEach((t) => t.stop()); this.liveStream = null; }
  }
}
