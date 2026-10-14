/**
 * deviceSignature.ts
 * Empreinte materielle unique (Micro + Sortie + Frequence) et stockage des profils de latence.
 */

const STORAGE_PROFILES_KEY = 'ogirador_latency_profiles_v1';

export function buildDeviceSignature(
  inputDeviceId: string,
  outputDeviceId: string,
  sampleRate: number
): string {
  const inId = inputDeviceId.trim() || 'default';
  const outId = outputDeviceId.trim() || 'default';
  return `${inId}__${outId}__${sampleRate}`;
}

export function getAllLatencyProfiles(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, number>;
      }
    }
  } catch {
    // Ignorer si corrompu
  }
  return {};
}

export function getCalibratedLatency(sig: string): number | null {
  const profiles = getAllLatencyProfiles();
  const val = profiles[sig];
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function saveCalibratedLatency(sig: string, latencyMs: number): void {
  try {
    const profiles = getAllLatencyProfiles();
    profiles[sig] = Math.round(latencyMs);
    localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Ignorer
  }
}
