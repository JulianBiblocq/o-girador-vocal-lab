/**
 * latencyStorage.ts
 * Persistance du micro-decalage utilisateur dans localStorage.
 * Par defaut a 0 ms ou issu de la calibration par claps.
 */
import { getCalibratedLatency, saveCalibratedLatency } from './deviceSignature';

const STORAGE_KEY = 'ogirador_vocal_lab_latency_ms';
export const DEFAULT_LATENCY_OFFSET_MS = 0;
export const MIN_LATENCY_OFFSET_MS = -600;
export const MAX_LATENCY_OFFSET_MS = 300;

export function getSavedLatencyOffsetMs(sig?: string): number {
  if (sig) {
    const calibrated = getCalibratedLatency(sig);
    if (calibrated !== null) return calibrated;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        if (parsed === -120) return DEFAULT_LATENCY_OFFSET_MS;
        return Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, parsed));
      }
    }
  } catch {
    // Fallback si localStorage est indisponible
  }
  return DEFAULT_LATENCY_OFFSET_MS;
}

export function saveLatencyOffsetMs(offsetMs: number, sig?: string): void {
  const clamped = Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, offsetMs));
  if (sig) {
    saveCalibratedLatency(sig, clamped);
  }
  try {
    localStorage.setItem(STORAGE_KEY, clamped.toString());
  } catch {
    // Ignorer
  }
}
