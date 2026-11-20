/**
 * liveVocalPitchCore.ts
 * Noyau YIN (CMNDF) pour voix tenues lentes : fenêtre >= 4096 échantillons, borné [65 Hz, 880 Hz],
 * passe-bas ~1000 Hz sur copie (calme les formants F2/F3) et verrouillage anti-harmoniques f/2, f/3, f/4 (< 120 lignes).
 */
export interface LivePitchCandidate { freq: number; clarity: number; rms: number; peak: number; }

export const LIVE_MIN_HZ = 65;
export const LIVE_MAX_HZ = 880;
export const LIVE_WINDOW_SAMPLES = 4096;
const YIN_THRESHOLD = 0.15, SUB_THRESHOLD = 0.22, SUB_LATTICE_RATIO = 0.03, SKIP_TRANSIENT = 256;

function biquadLowpass(x: Float32Array, sr: number, fc: number): Float32Array {
  const w0 = (2 * Math.PI * fc) / sr, cosw = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha, b0 = (1 - cosw) / 2 / a0, b1 = (1 - cosw) / a0, a1 = (-2 * cosw) / a0, a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function prepareAnalysis(frame: Float32Array, sr: number): { data: Float32Array; rate: number } {
  const lp = biquadLowpass(biquadLowpass(frame, sr, 1000), sr, 1000);
  const dec = Math.max(1, Math.floor(sr / 12000)), start = Math.min(SKIP_TRANSIENT, frame.length >> 2);
  const n = Math.floor((frame.length - start) / dec), data = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) { data[i] = lp[start + i * dec]; mean += data[i]; }
  mean /= Math.max(1, n);
  for (let i = 0; i < n; i++) data[i] -= mean;
  return { data, rate: sr / dec };
}

function goertzelPower(x: Float32Array, rate: number, f: number): number {
  const n = x.length, coeff = 2 * Math.cos((2 * Math.PI * f) / rate);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s0 = x[i] + coeff * s1 - s2; s2 = s1; s1 = s0; }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Puissance relative aux positions j·f/k (j non multiple de k) : n'existe que si la période réelle est k·τ. */
function subLatticeEvidence(win: Float32Array, rate: number, f: number, k: number): number {
  const ref = goertzelPower(win, rate, f);
  if (ref <= 1e-12) return 0;
  let sum = 0;
  for (let j = 1; (j * f) / k <= Math.min(1000, rate * 0.45); j++) if (j % k !== 0) sum += goertzelPower(win, rate, (j * f) / k);
  return sum / ref;
}

function computeCmndf(x: Float32Array, tauMax: number): Float32Array {
  const w = x.length - tauMax - 3, cm = new Float32Array(tauMax + 3).fill(1);
  let running = 0;
  for (let tau = 1; tau < cm.length; tau++) {
    let d = 0;
    for (let j = 0; j < w; j++) { const diff = x[j] - x[j + tau]; d += diff * diff; }
    running += d;
    cm[tau] = running > 1e-12 ? (d * tau) / running : 1;
  }
  return cm;
}

function argminNear(cm: Float32Array, center: number, tauMin: number, tauMax: number): number {
  let best = Math.max(tauMin, Math.round(center) - 2);
  for (let t = best; t <= Math.min(tauMax, Math.round(center) + 2); t++) if (cm[t] < cm[best]) best = t;
  return best;
}

function parabolicTau(cm: Float32Array, tau: number): number {
  if (tau <= 1 || tau >= cm.length - 1) return tau;
  const s0 = cm[tau - 1], s1 = cm[tau], s2 = cm[tau + 1], den = 2 * (s0 - 2 * s1 + s2);
  return Math.abs(den) < 1e-9 ? tau : tau + Math.max(-1, Math.min(1, (s0 - s2) / den));
}

export function detectLiveVocalPitch(frame: Float32Array, sampleRate: number): LivePitchCandidate {
  let sumSq = 0, peak = 0;
  for (let i = 0; i < frame.length; i++) { const a = Math.abs(frame[i]); sumSq += a * a; if (a > peak) peak = a; }
  const rms = Math.sqrt(sumSq / Math.max(1, frame.length)), none = { freq: 0, clarity: 0, rms, peak };
  if (frame.length < 2048 || rms < 1e-5) return none;

  const { data, rate } = prepareAnalysis(frame, sampleRate);
  const tauMin = Math.max(2, Math.floor(rate / LIVE_MAX_HZ));
  const tauMax = Math.min(Math.ceil(rate / LIVE_MIN_HZ), Math.floor(data.length * 0.5) - 4);
  if (tauMax <= tauMin + 4) return none;
  const cm = computeCmndf(data, tauMax);

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < YIN_THRESHOLD) { while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) { tau = tauMin; for (let t = tauMin; t <= tauMax; t++) if (cm[t] < cm[tau]) tau = t; }

  // Anti-harmoniques : creux périodique cohérent à kτ ET énergie réelle sur le réseau f/k => vraie fondamentale plus grave.
  const win = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) win[i] = data[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (data.length - 1)));
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const k of [2, 3, 4]) {
      if (tau * k > tauMax) continue;
      const tk = argminNear(cm, tau * k, tauMin, tauMax);
      if (cm[tk] >= SUB_THRESHOLD || cm[tk] > cm[tau] + 0.05) continue;
      if (subLatticeEvidence(win, rate, rate / tau, k) >= SUB_LATTICE_RATIO) { tau = tk; moved = true; break; }
    }
    if (!moved) break;
  }
  return { freq: rate / parabolicTau(cm, tau), clarity: Math.max(0, 1 - cm[tau]), rms, peak };
}
