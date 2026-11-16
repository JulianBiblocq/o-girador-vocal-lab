/**
 * StudentTrainerEngine.ts — Moteur d'entraînement vocal Web Audio Studio Élève 2.0
 * (Trace pitch 60 FPS Bayésienne, Projection Roda, WSOLA et mode 'drone_click' Bourdon + Clic sans clavier) (< 130 lignes).
 */
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { scheduleWoodClick, scheduleReferencePitch } from './metronomeAudioNodes';
import { scheduleSecondaryTakeGuide, type TakeGuideHandle } from './takeGuideHelper';
import { scheduleCuePatternAudio, type CuePlaybackHandle } from './cueAudioHelper';
import { detectRealtimePitch } from './realtimePitchDetector';
import { CausalStudentPitchTracker } from './studentPerformanceMatcher';
import { extractCanonicalMestreBuffer, timeStretchConstantPitch } from './wsolaTimeStretcher';
import { analyzeVocalProjectionFrame, computeSessionProjectionSummary, type RodaProjectionFrameResult, type SessionProjectionSummary } from './rodaResonanceAnalyzer';
import { sharedTonicDrone } from './tonicDroneSynth';
import { scheduleComparativePlaybackNodes, type ComparativePlaybackMode } from './studentComparativePlayer';
import { midiToNoteName } from '../utils/noteUtils';
import type { VocalPatternItem } from '../types/toadaProject.types';
import type { HarmonyConfig } from '../types/harmony.types';
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TrainerGuideMode, StudentRole, TrainerScope } from '../components/livret-treino/TrainerConfigBar';
import { HarmonyPlayerEngine } from './harmony/HarmonyPlayerEngine';

export type { ComparativePlaybackMode };
export interface StudentTrainingConfig {
  pattern: VocalPatternItem; cuePattern?: VocalPatternItem | null; baseBpm: number; bpm: number; speedRatio?: number;
  beatsPerMeasure: number; measuresCount: number; scope?: TrainerScope; studentRole: StudentRole; guideMode: TrainerGuideMode;
  deviceId?: string; outputDeviceId?: string; harmonyConfig?: HarmonyConfig; pitchShiftSemitones?: number;
  troupeTonicRoot?: string; referencePitchHz?: number;
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
    const beatDur = 60 / config.bpm, measureDur = config.beatsPerMeasure * beatDur, hasCue = config.scope === 'toada' && !!config.cuePattern;
    const preRollMeasures = hasCue && config.cuePattern ? 1 + config.cuePattern.measuresCount : 1;
    const hasAnac = config.pattern.hasAnacrusis !== false, singingMeasures = (hasAnac ? 1 : 0) + config.measuresCount;
    const countdownSec = preRollMeasures * measureDur, singingSec = singingMeasures * measureDur;
    const startTime = this.ctx.currentTime + 0.08, singStartTime = startTime + countdownSec;
    const allTargetSteps = [...(hasAnac ? (config.pattern.anacrusisSteps || []) : []), ...(config.pattern.mainSteps || [])];
    const shiftSt = config.pitchShiftSemitones ?? 0;

    for (let b = 0; b < (preRollMeasures + singingMeasures) * config.beatsPerMeasure; b++) {
      scheduleWoodClick(this.ctx, startTime + b * beatDur, b % config.beatsPerMeasure === 0, this.activeNodes);
    }
    const firstActiveStep = allTargetSteps.find((s) => s.active && (s.midiNumber ?? 0) > 0 && s.note !== '───');
    const precountRefNote = firstActiveStep?.midiNumber ? midiToNoteName(firstActiveStep.midiNumber + shiftSt) : (config.pattern.referencePitch || 'C4');
    scheduleReferencePitch(this.ctx, startTime, precountRefNote, config.guideMode === 'drone_click' ? Math.min(0.65, measureDur * 0.5) : measureDur * 0.85, this.activeNodes);

    if (config.guideMode === 'drone_click') await sharedTonicDrone.start(config.troupeTonicRoot || 'C', config.referencePitchHz ?? 440, 0.15);
    if (hasCue && config.cuePattern) this.cueHandle = scheduleCuePatternAudio(this.ctx, config.cuePattern, startTime, config.beatsPerMeasure, beatDur, config.bpm);

    const shouldPlayMestreVoice = config.guideMode === 'accompanied' || ((config.guideMode === 'autonomous' || config.guideMode === 'drone_click') && config.studentRole !== 'all' && config.studentRole !== config.pattern.role);
    if (shouldPlayMestreVoice) {
      const mestre = extractCanonicalMestreBuffer(config.pattern, config.baseBpm, config.beatsPerMeasure, sampleRate);
      if (mestre?.pcm.length) {
        const stretched = timeStretchConstantPitch(mestre.pcm, mestre.sampleRate, config.speedRatio ?? 1.0);
        const buf = this.ctx.createBuffer(1, stretched.length, mestre.sampleRate); buf.getChannelData(0).set(stretched);
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.ctx.destination);
        src.start(singStartTime, hasAnac ? 0 : 0.15 / (config.speedRatio ?? 1.0)); this.activeNodes.push(src);
      }
    } else if (config.guideMode === 'voice_only') {
      this.guideHandle = scheduleSecondaryTakeGuide(this.ctx, this.ctx.destination, config.pattern.anacrusisSteps || [], config.pattern.mainSteps || [], singStartTime, hasAnac ? measureDur : 0, config.bpm, shiftSt);
    }
    if (config.guideMode !== 'drone_click' && config.harmonyConfig?.enabled && config.pattern.harmonyGrid) {
      this.harmonyEngine.schedule(this.ctx, this.ctx.destination, {
        grid: config.pattern.harmonyGrid, bpm: config.bpm, beatsPerMeasure: config.beatsPerMeasure, measuresCount: config.measuresCount,
        startTime: singStartTime, totalDurationSec: singingSec, hasAnacrusis: hasAnac, pitchShiftSemitones: shiftSt,
        profile: config.harmonyConfig.profile, volume: config.harmonyConfig.volume, muteBass: config.harmonyConfig.muteBass,
      });
    }
    this.recorder.start(singStartTime, singingSec);
    const stepDurSec = beatDur / 4, timeBuf = new Float32Array(2048), freqBuf = new Float32Array(1024);
    const tracker = new CausalStudentPitchTracker(), projectionFrames: RodaProjectionFrameResult[] = [];
    let prevMidi = 0;
    const tick = () => {
      if (!this.isRunning || !this.ctx) return;
      const elapsed = this.ctx.currentTime - singStartTime;
      if (elapsed >= 0 && elapsed <= singingSec) {
        const stepIdx = Math.floor(elapsed / stepDurSec);
        let livePt: PitchCurvePoint | undefined, liveProj: RodaProjectionFrameResult | undefined;
        if (this.liveAnalyser) {
          this.liveAnalyser.getFloatTimeDomainData(timeBuf); this.liveAnalyser.getFloatFrequencyData(freqBuf);
          const { pitchMidi, rms, clarity, zcr } = detectRealtimePitch(timeBuf, this.ctx.sampleRate);
          const tgtMidi = allTargetSteps[stepIdx]?.midiNumber ? allTargetSteps[stepIdx].midiNumber! + shiftSt : 0;
          livePt = tracker.update(elapsed, pitchMidi, rms, clarity ?? 0.85, zcr ?? 0.08, tgtMidi);
          const trk = livePt?.midiFloat ?? 0, jitterCents = prevMidi > 0 && trk > 0 ? Math.min(120, Math.abs(trk - prevMidi) * 100) : 12;
          if (trk > 0) prevMidi = trk;
          liveProj = analyzeVocalProjectionFrame(freqBuf, this.ctx.sampleRate, this.liveAnalyser.fftSize, rms, jitterCents);
          if (liveProj.isVoiced) projectionFrames.push(liveProj);
        }
        onPlayhead(elapsed, stepIdx, livePt, liveProj);
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
    const { nodes, maxDurSec } = scheduleComparativePlaybackNodes(this.ctx, studentPCM, studentSampleRate, pattern, baseBpm, speedRatio, mode);
    this.activeNodes.push(...nodes);
    this.stopTimerId = window.setTimeout(() => { this.stop(); onEnded?.(); }, Math.max(100, (maxDurSec + 0.05) * 1000));
  }

  public stop(): void {
    this.isRunning = false; sharedTonicDrone.stopImmediate();
    if (this.animId !== null) { cancelAnimationFrame(this.animId); this.animId = null; }
    if (this.stopTimerId !== null) { window.clearTimeout(this.stopTimerId); this.stopTimerId = null; }
    this.recorder.cleanup(); this.harmonyEngine.stop(); this.guideHandle?.stop(); this.cueHandle?.stop(); this.guideHandle = null; this.cueHandle = null;
    for (const n of this.activeNodes) { try { if ('stop' in n) (n as AudioScheduledSourceNode).stop(); n.disconnect(); } catch {} }
    this.activeNodes = [];
    if (this.liveAnalyser) { try { this.liveAnalyser.disconnect(); } catch {} this.liveAnalyser = null; }
    if (this.liveStream) { this.liveStream.getTracks().forEach((t) => t.stop()); this.liveStream = null; }
  }
}
