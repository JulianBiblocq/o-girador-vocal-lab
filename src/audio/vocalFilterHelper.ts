/**
 * vocalFilterHelper.ts
 * Filtre coupe-bas studio (High-Pass 90 Hz, Q = 0.707) anti-rumble / anti-plosives.
 * Algorithme biquad IIR numérique in-place ultra-rapide (zero allocation).
 */

export function applyHighPass90Hz(pcm: Float32Array, sampleRate: number): Float32Array {
  const cutoff = 90;
  const q = 0.707;
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw0 = Math.cos(w0);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  const normB0 = b0 / a0;
  const normB1 = b1 / a0;
  const normB2 = b2 / a0;
  const normA1 = a1 / a0;
  const normA2 = a2 / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < pcm.length; i++) {
    const x0 = pcm[i];
    const y0 = normB0 * x0 + normB1 * x1 + normB2 * x2 - normA1 * y1 - normA2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    pcm[i] = y0;
  }

  return pcm;
}
