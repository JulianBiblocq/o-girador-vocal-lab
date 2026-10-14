/**
 * pingCalibration.ts
 * Moteur de calibration acoustique automatique ultra-rapide par Auto-Ping (3 impulsions a 2200 Hz).
 * Capture en mode Pure Direct et calcul de la médiane des délais haut-parleur -> microphone.
 */
import { getSharedAudioContext, setSharedSinkId } from './sharedAudioContext';
import { VocalRecorderEngine } from './VocalRecorderEngine';
import { saveCalibratedLatency } from '../utils/deviceSignature';

export async function runAcousticPingCalibration(
  inputDeviceId: string,
  outputDeviceId: string,
  sig: string
): Promise<number | null> {
  const ctx = await getSharedAudioContext();
  if (outputDeviceId && outputDeviceId !== 'default') {
    await setSharedSinkId(outputDeviceId);
  }

  const recorder = new VocalRecorderEngine();
  const sampleRate = await recorder.prepare(ctx, inputDeviceId);

  // Stabilisation micro Pure Direct
  await new Promise((r) => setTimeout(r, 300));

  const pingCount = 3;
  const pingSpacingSec = 0.45;
  const pingFreq = 2200;
  const totalDurationSec = pingCount * pingSpacingSec + 0.4;

  const t0 = ctx.currentTime + 0.08;
  recorder.start(t0, totalDurationSec);

  // Émission des 3 impulsions percutantes (pings 15 ms)
  for (let k = 0; k < pingCount; k++) {
    const tk = t0 + k * pingSpacingSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(pingFreq, tk);
    gain.gain.setValueAtTime(0.0001, tk);
    gain.gain.linearRampToValueAtTime(0.75, tk + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, tk + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(tk);
    osc.stop(tk + 0.02);
  }

  // Attente de l'enregistrement complet
  await new Promise((r) => setTimeout(r, (totalDurationSec + 0.15) * 1000));
  const pcm = recorder.stop();
  recorder.cleanup();

  // Analyse du bruit ambiant pour seuil SNR (+10 dB = ~3.16x l'amplitude de bruit)
  const noiseWindowSamples = Math.min(pcm.length, Math.floor(0.06 * sampleRate));
  let noiseFloor = 0.005;
  for (let i = 0; i < noiseWindowSamples; i++) {
    const a = Math.abs(pcm[i]);
    if (a > noiseFloor) noiseFloor = a;
  }
  const minThreshold = Math.max(0.025, noiseFloor * 3.16);

  // Détection des pics d'impulsion dans chaque fenêtre [tk, tk + 380 ms]
  const deltasMs: number[] = [];
  for (let k = 0; k < pingCount; k++) {
    const tExpected = k * pingSpacingSec;
    const wStart = Math.max(0, Math.floor(tExpected * sampleRate));
    const wEnd = Math.min(pcm.length, Math.floor((tExpected + 0.38) * sampleRate));

    let maxAmp = 0;
    let peakIdx = -1;
    for (let i = wStart; i < wEnd; i++) {
      const amp = Math.abs(pcm[i]);
      if (amp > maxAmp) {
        maxAmp = amp;
        peakIdx = i;
      }
    }

    if (maxAmp >= minThreshold && peakIdx !== -1) {
      const tPeak = peakIdx / sampleRate;
      const deltaMs = (tPeak - tExpected) * 1000;
      if (deltaMs >= 5 && deltaMs <= 380) {
        deltasMs.push(deltaMs);
      }
    }
  }

  // Au moins 2 pings nets requis pour valider la mesure
  if (deltasMs.length < 2) {
    return null;
  }

  deltasMs.sort((a, b) => a - b);
  const mid = Math.floor(deltasMs.length / 2);
  const medianDelta = deltasMs.length % 2 !== 0 ? deltasMs[mid] : (deltasMs[mid - 1] + deltasMs[mid]) / 2;
  const calibratedOffsetMs = -Math.round(medianDelta);

  saveCalibratedLatency(sig, calibratedOffsetMs);
  return calibratedOffsetMs;
}
