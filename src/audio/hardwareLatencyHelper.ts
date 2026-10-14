/**
 * hardwareLatencyHelper.ts
 * Calcul de la latence materielle aller-retour (DAC/ADC) pour l auto-calage a T0.
 */

export function computeHardwareLagSec(ctx: AudioContext | null, stream: MediaStream | null): number {
  if (!ctx) return 0.04;
  let outLag = 0;
  if (typeof (ctx as any).outputLatency === 'number') outLag += (ctx as any).outputLatency;
  if (typeof (ctx as any).baseLatency === 'number') outLag += (ctx as any).baseLatency;

  if (typeof ctx.getOutputTimestamp === 'function') {
    try {
      const ts = ctx.getOutputTimestamp();
      if (ts && typeof ts.contextTime === 'number' && ctx.currentTime > ts.contextTime) {
        const delta = ctx.currentTime - ts.contextTime;
        if (delta > 0 && delta < 0.2) outLag = Math.max(outLag, delta);
      }
    } catch {
      // Ignorer
    }
  }
  if (outLag === 0) outLag = 0.025;

  let inLag = 0.015;
  if (stream) {
    const track = stream.getAudioTracks()[0];
    if (track && typeof track.getSettings === 'function') {
      const s = track.getSettings();
      if (typeof (s as any).latency === 'number' && (s as any).latency > 0) {
        inLag = (s as any).latency;
      }
    }
  }
  return outLag + inLag;
}
