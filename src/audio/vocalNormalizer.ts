/**
 * vocalNormalizer.ts
 * Normalisation vocale broadcast / DAW intelligente (Gated RMS -16 dBFS + Limiteur Soft-Knee -1 dBFS).
 * Calcule le RMS actif (fenêtres de 20 ms, seuil -45 dBFS) et applique un plafond doux tanh.
 */

export function normalizeActiveRMS(
  pcm: Float32Array,
  sampleRate: number,
  targetRms = 0.1585, // -16 dBFS
  maxGain = 8.0 // +18 dB max
): Float32Array {
  if (pcm.length === 0) return pcm;

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20 ms
  const gateThreshold = 0.0056; // -45 dBFS
  let sumActiveSquared = 0;
  let activeWindowCount = 0;

  for (let i = 0; i < pcm.length; i += windowSize) {
    const end = Math.min(pcm.length, i + windowSize);
    let winSumSquare = 0;
    for (let j = i; j < end; j++) {
      winSumSquare += pcm[j] * pcm[j];
    }
    const winRms = Math.sqrt(winSumSquare / (end - i));
    if (winRms > gateThreshold) {
      sumActiveSquared += winRms * winRms;
      activeWindowCount++;
    }
  }

  // Si aucune activité vocale détectée (silence pur), pas d amplification du bruit de fond
  if (activeWindowCount === 0) return pcm;

  const activeRms = Math.sqrt(sumActiveSquared / activeWindowCount);
  if (activeRms <= 0.0001) return pcm;

  const nominalGain = Math.min(maxGain, targetRms / activeRms);

  // Soft-Knee Limiter avec plafond absolu à -1.0 dBFS (0.891)
  const threshold = 0.75;
  const ceiling = 0.891;
  const range = ceiling - threshold;

  for (let i = 0; i < pcm.length; i++) {
    const amplified = pcm[i] * nominalGain;
    const absVal = Math.abs(amplified);
    if (absVal <= threshold) {
      pcm[i] = amplified;
    } else {
      const over = (absVal - threshold) / range;
      const limited = threshold + range * Math.tanh(over);
      pcm[i] = (amplified < 0 ? -1 : 1) * Math.min(ceiling, limited);
    }
  }

  return pcm;
}
