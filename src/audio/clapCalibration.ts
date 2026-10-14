/**
 * clapCalibration.ts
 * Moteur de calibration materielle precise par claps (8 temps a 100 BPM).
 * Analyse des transitoires, filtrage des outliers et calcul de la mediane.
 */
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { saveCalibratedLatency } from '../utils/deviceSignature';

export interface CalibrationProgress {
  step: 'idle' | 'countdown' | 'clapping' | 'analyzing' | 'done' | 'failed';
  currentBeat?: number;
  detectedOffsetMs?: number;
  errorMessage?: string;
}

export async function runClapCalibration(
  inputDeviceId: string,
  outputDeviceId: string,
  sig: string,
  onProgress: (p: CalibrationProgress) => void
): Promise<number | null> {
  const ctx = await getSharedAudioContext();
  if (outputDeviceId && outputDeviceId !== 'default') {
    await setSharedSinkId(outputDeviceId);
  }

  const recorder = new VocalRecorderEngine();
  const sampleRate = await recorder.prepare(ctx, inputDeviceId);

  const bpm = 100;
  const beatSec = 60 / bpm; // 0.6s
  const countdownBeats = 4;
  const clappingBeats = 8;
  const totalDurationSec = (countdownBeats + clappingBeats) * beatSec + 0.5;

  const startTime = ctx.currentTime + 0.15;
  recorder.start(startTime, totalDurationSec);

  // 1. Jouer les bips sonores
  for (let b = 0; b < countdownBeats + clappingBeats; b++) {
    const t = startTime + b * beatSec;
    const isCountdown = b < countdownBeats;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(isCountdown ? 800 : 1200, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);

    const delay = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (isCountdown) {
        onProgress({ step: 'countdown', currentBeat: b + 1 });
      } else {
        onProgress({ step: 'clapping', currentBeat: b - countdownBeats + 1 });
      }
    }, delay);
  }

  // 2. Attente de la fin de prise
  await new Promise((r) => setTimeout(r, (totalDurationSec + 0.2) * 1000));
  onProgress({ step: 'analyzing' });

  const pcm = recorder.stop();
  recorder.cleanup();

  // 3. Detection des transitoires de claps
  const deltasMs: number[] = [];
  for (let k = 0; k < clappingBeats; k++) {
    const tExpected = (countdownBeats + k) * beatSec;
    const windowStart = Math.max(0, Math.floor((tExpected - 0.05) * sampleRate));
    const windowEnd = Math.min(pcm.length, Math.floor((tExpected + 0.45) * sampleRate));

    let maxAmp = 0;
    let peakIdx = -1;
    for (let i = windowStart; i < windowEnd; i++) {
      const amp = Math.abs(pcm[i]);
      if (amp > maxAmp) {
        maxAmp = amp;
        peakIdx = i;
      }
    }

    if (maxAmp > 0.04 && peakIdx !== -1) {
      const tPeak = peakIdx / sampleRate;
      const deltaMs = (tPeak - tExpected) * 1000;
      if (deltaMs >= -20 && deltaMs <= 400) {
        deltasMs.push(deltaMs);
      }
    }
  }

  if (deltasMs.length < 3) {
    onProgress({
      step: 'failed',
      errorMessage: 'Claps insuffisants. Tapez distinctement dans les mains face au micro.',
    });
    return null;
  }

  // 4. Mediane des deltas et inversion pour la compensation (retard = offset negatif)
  deltasMs.sort((a, b) => a - b);
  const mid = Math.floor(deltasMs.length / 2);
  const medianDelta = deltasMs.length % 2 !== 0 ? deltasMs[mid] : (deltasMs[mid - 1] + deltasMs[mid]) / 2;
  const calibratedOffsetMs = -Math.round(medianDelta);

  saveCalibratedLatency(sig, calibratedOffsetMs);
  onProgress({ step: 'done', detectedOffsetMs: calibratedOffsetMs });
  return calibratedOffsetMs;
}
