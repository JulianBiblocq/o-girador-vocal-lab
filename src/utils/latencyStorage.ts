/**
 * latencyStorage.ts
 * Persistance unifiée de la latence matérielle dans localStorage (signature périphérique + clé globale) (< 85 lignes).
 */
import { getCalibratedLatency, saveCalibratedLatency } from './deviceSignature';

const STORAGE_KEY = 'ogirador_vocal_lab_latency_ms';
export const DEFAULT_LATENCY_OFFSET_MS = 0;
export const MIN_LATENCY_OFFSET_MS = -600;
export const MAX_LATENCY_OFFSET_MS = 300;

export function getSavedLatencyOffsetMs(sig?: string): number {
  if (sig) {
    const calibrated = getCalibratedLatency(sig);
    if (calibrated !== null) {
      return Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, calibrated));
    }
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
  const clamped = Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, Math.round(offsetMs)));
  if (sig) {
    saveCalibratedLatency(sig, clamped);
    const inMatch = sig.match(/^in:([^|]+)/);
    if (inMatch?.[1]) markLatencyCalibrated(inMatch[1]);
  }
  try {
    localStorage.setItem(STORAGE_KEY, clamped.toString());
  } catch {
    // Ignorer
  }
}

export function isLatencyCalibrated(deviceId?: string): boolean {
  try {
    const key = `ogirador_latency_calibrated_${deviceId || 'default'}`;
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function markLatencyCalibrated(deviceId?: string): void {
  try {
    const key = `ogirador_latency_calibrated_${deviceId || 'default'}`;
    localStorage.setItem(key, 'true');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ogirador-latency-calibrated', { detail: { deviceId } }));
    }
  } catch {
    // Ignorer
  }
}

export function isLatencyReminderDismissedSession(): boolean {
  try {
    return sessionStorage.getItem('ogirador_latency_dismissed_session') === 'true';
  } catch {
    return false;
  }
}

export function dismissLatencyReminderSession(): void {
  try {
    sessionStorage.setItem('ogirador_latency_dismissed_session', 'true');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ogirador-latency-dismissed'));
    }
  } catch {
    // Ignorer
  }
}
