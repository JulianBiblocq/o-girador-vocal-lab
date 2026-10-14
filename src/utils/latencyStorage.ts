/**
 * latencyStorage.ts
 * Persistance du calage matériel dans localStorage pour les cartes son externes.
 */

const STORAGE_KEY = 'ogirador_vocal_lab_latency_ms';
export const DEFAULT_LATENCY_OFFSET_MS = -120;
export const MIN_LATENCY_OFFSET_MS = -600;
export const MAX_LATENCY_OFFSET_MS = 300;

export function getSavedLatencyOffsetMs(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        return Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, parsed));
      }
    }
  } catch {
    // Fallback si localStorage est indisponible
  }
  return DEFAULT_LATENCY_OFFSET_MS;
}

export function saveLatencyOffsetMs(offsetMs: number): void {
  try {
    const clamped = Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, offsetMs));
    localStorage.setItem(STORAGE_KEY, clamped.toString());
  } catch {
    // Ignorer
  }
}
