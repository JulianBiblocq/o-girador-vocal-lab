/**
 * peaksExtractor.ts
 * Extraction et normalisation des pics d'amplitude pour affichage optimisé.
 */
export function extractNormalizedPeaks(rawPCM: Float32Array, bins = 600): Float32Array {
  if (!rawPCM || rawPCM.length === 0) return new Float32Array(0);

  const peaks = new Float32Array(bins);
  const step = Math.floor(rawPCM.length / bins);
  let maxGlobalPeak = 0.0001;

  for (let i = 0; i < bins; i++) {
    let maxVal = 0;
    const start = i * step;
    const end = Math.min(rawPCM.length, start + step);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(rawPCM[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks[i] = maxVal;
    if (maxVal > maxGlobalPeak) maxGlobalPeak = maxVal;
  }

  // Normalisation dynamique à ~75% de la hauteur du canvas
  const scaleFactor = 0.75 / maxGlobalPeak;
  for (let i = 0; i < bins; i++) {
    peaks[i] = Math.min(0.95, peaks[i] * scaleFactor);
  }

  return peaks;
}
