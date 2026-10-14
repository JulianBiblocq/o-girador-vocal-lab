/**
 * clickVolumeStorage.ts
 * Persistance du volume du clic de métronome (0% à 200%, défaut 120%).
 */

const STORAGE_CLICK_VOLUME_KEY = 'ogirador_vocal_lab_click_volume';
export const DEFAULT_CLICK_VOLUME = 1.2; // 120%

export function getSavedClickVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_CLICK_VOLUME_KEY);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 2.0) {
        return parsed;
      }
    }
  } catch {
    // Ignorer
  }
  return DEFAULT_CLICK_VOLUME;
}

export function saveClickVolume(vol: number): void {
  try {
    const clamped = Math.max(0, Math.min(2.0, vol));
    localStorage.setItem(STORAGE_CLICK_VOLUME_KEY, clamped.toFixed(2));
  } catch {
    // Ignorer
  }
}
