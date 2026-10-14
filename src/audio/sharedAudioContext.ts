/**
 * sharedAudioContext.ts
 * Instance unique globale d AudioContext pour l ensemble de Vocal Lab.
 * Empeche le decrochage du pilote WASAPI de la carte son externe.
 * Nettoyage automatique au Hot-Reload Vite (import.meta.hot).
 */

let sharedCtx: AudioContext | null = null;
let currentSinkId = '';

export async function getSharedAudioContext(): Promise<AudioContext> {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AudioContextClass();
    currentSinkId = '';
  }
  if (sharedCtx.state === 'suspended') {
    await sharedCtx.resume();
  }
  return sharedCtx;
}

export function getExistingAudioContext(): AudioContext | null {
  return sharedCtx && sharedCtx.state !== 'closed' ? sharedCtx : null;
}

export async function setSharedSinkId(deviceId: string): Promise<void> {
  // Neutralisation des appels agressifs : jamais si vide ou 'default'
  if (!deviceId || deviceId === 'default' || deviceId === currentSinkId) return;

  const ctx = await getSharedAudioContext();
  if ('setSinkId' in ctx && typeof (ctx as any).setSinkId === 'function') {
    try {
      await (ctx as any).setSinkId(deviceId);
      currentSinkId = deviceId;
    } catch (err) {
      console.warn('sharedAudioContext: setSinkId non supporte ou refuse :', err);
    }
  }
}

export async function closeSharedAudioContext(): Promise<void> {
  if (sharedCtx && sharedCtx.state !== 'closed') {
    try {
      await sharedCtx.close();
    } catch {
      // Ignorer
    }
    sharedCtx = null;
    currentSinkId = '';
  }
}

// Purge automatique au Hot-Reload Vite (import.meta.hot)
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    await closeSharedAudioContext();
  });
}
