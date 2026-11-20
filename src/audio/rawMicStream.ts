/**
 * rawMicStream.ts
 * Ouverture du micro en flux BRUT (sans annulation d'écho, réduction de bruit ni contrôle automatique de gain)
 * sur le périphérique choisi dans AudioHardwareContext, avec repli propre sur le micro par défaut (< 50 lignes).
 */
export const RAW_AUDIO_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as const;

export async function openRawMicStream(deviceId?: string): Promise<MediaStream> {
  const wantsDevice = Boolean(deviceId && deviceId !== 'default');
  if (wantsDevice) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { ...RAW_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId! } } });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err;
      console.warn('[rawMicStream] Périphérique indisponible, repli sur le micro par défaut :', deviceId);
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: { ...RAW_AUDIO_CONSTRAINTS } });
}

export function stopMicStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* piste déjà arrêtée */ } });
}
