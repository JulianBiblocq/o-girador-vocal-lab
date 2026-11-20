/**
 * liveVocalTunerDetector.ts
 * Accordeur vocal temps réel : porte RMS adaptative + clarté périodique franche + coupure de fin de souffle
 * + médiane glissante 7 trames avec rejet des sauts isolés > 5 demi-tons (< 110 lignes).
 */
import { detectLiveVocalPitch } from './liveVocalPitchCore';

export interface LiveTunerResult { voiced: boolean; freq: number; midiFloat: number; rms: number; peak: number; clarity: number; }

const MIN_RMS_GATE = 0.008, MIN_CLARITY = 0.85, RELEASE_RATIO = 0.12, MEDIAN_FRAMES = 7;
const MIN_FRAMES_TO_SHOW = 1, MAX_ISOLATED_JUMP_ST = 5, MAX_OUTLIER_FRAMES = 2;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export class LiveVocalTunerDetector {
  private history: number[] = [];
  private noiseFloor = 0.004;
  private notePeakRms = 0;
  private silentFrames = 0;
  private outlierRun = 0;

  public reset(): void { this.history = []; this.notePeakRms = 0; this.silentFrames = 0; this.outlierRun = 0; }

  private silent(rms: number, peak: number, clarity: number): LiveTunerResult {
    this.silentFrames++;
    if (this.silentFrames >= 3) { this.history = []; this.notePeakRms = 0; this.outlierRun = 0; }
    return { voiced: false, freq: 0, midiFloat: 0, rms, peak, clarity };
  }

  public process(frame: Float32Array, sampleRate: number, referencePitchHz = 440): LiveTunerResult {
    const c = detectLiveVocalPitch(frame, sampleRate);
    const gate = Math.max(MIN_RMS_GATE, this.noiseFloor * 3);
    if (c.rms < gate) this.noiseFloor = Math.min(0.02, this.noiseFloor * 0.98 + c.rms * 0.02);

    const aboveGate = c.rms >= gate;
    const stillSounding = this.notePeakRms === 0 || c.rms >= this.notePeakRms * RELEASE_RATIO;
    if (c.freq <= 0 || !aboveGate || c.clarity < MIN_CLARITY || !stillSounding) return this.silent(c.rms, c.peak, c.clarity);

    this.silentFrames = 0;
    this.notePeakRms = Math.max(this.notePeakRms * 0.995, c.rms);
    const midi = 69 + 12 * Math.log2(c.freq / referencePitchHz);

    if (this.history.length >= MEDIAN_FRAMES - 4 && Math.abs(midi - median(this.history)) > MAX_ISOLATED_JUMP_ST) {
      this.outlierRun++;
      if (this.outlierRun <= MAX_OUTLIER_FRAMES) return this.output(c.rms, c.peak, c.clarity, referencePitchHz);
      this.history = [];
    }
    this.outlierRun = 0;
    this.history.push(midi);
    if (this.history.length > MEDIAN_FRAMES) this.history.shift();
    return this.output(c.rms, c.peak, c.clarity, referencePitchHz);
  }

  private output(rms: number, peak: number, clarity: number, refHz: number): LiveTunerResult {
    if (this.history.length < MIN_FRAMES_TO_SHOW) return { voiced: false, freq: 0, midiFloat: 0, rms, peak, clarity };
    const m = median(this.history);
    return { voiced: true, freq: refHz * Math.pow(2, (m - 69) / 12), midiFloat: m, rms, peak, clarity };
  }
}
