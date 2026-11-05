/**
 * ComfortMonitoringNode.ts
 * Retour Casque Confort non-destructif (< 110 lignes) :
 * Réseau algorithmique court Web Audio (filtres peigne + passe-bas + passe-tout) routé UNIQUEMENT vers ctx.destination.
 * Prélevé en parallèle de la source micro pour que le flux PCM enregistré reste 100 % brut et sec.
 */

export type ComfortMonitoringPreset = 'off' | 'studio_doux' | 'roda_chaude';

export interface ComfortMonitoringHandle {
  updatePreset: (preset: ComfortMonitoringPreset, mixAmount: number) => void;
  disconnect: () => void;
}

export function createComfortMonitoringGraph(
  ctx: AudioContext,
  sourceNode: AudioNode,
  initialPreset: ComfortMonitoringPreset = 'off',
  initialMix = 0.35
): ComfortMonitoringHandle {
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.setValueAtTime(3800, ctx.currentTime);

  // 2 lignes à retard en peigne + 1 passe-tout pour une réverbe courte sans fichier IR externe
  const delay1 = ctx.createDelay(0.15);
  const delay2 = ctx.createDelay(0.15);
  const fb1 = ctx.createGain();
  const fb2 = ctx.createGain();
  const allpass = ctx.createBiquadFilter();
  allpass.type = 'allpass';
  allpass.frequency.setValueAtTime(1100, ctx.currentTime);

  sourceNode.connect(dryGain);
  dryGain.connect(ctx.destination);

  sourceNode.connect(toneFilter);
  toneFilter.connect(delay1);
  toneFilter.connect(delay2);

  delay1.connect(fb1);
  fb1.connect(delay1);
  delay2.connect(fb2);
  fb2.connect(delay2);

  delay1.connect(allpass);
  delay2.connect(allpass);
  allpass.connect(wetGain);
  wetGain.connect(ctx.destination);

  const applyConfig = (preset: ComfortMonitoringPreset, mixAmount: number) => {
    const now = ctx.currentTime;
    const clampedMix = Math.max(0, Math.min(1, mixAmount));
    if (preset === 'off') {
      dryGain.gain.setTargetAtTime(0, now, 0.015);
      wetGain.gain.setTargetAtTime(0, now, 0.015);
      return;
    }
    if (preset === 'studio_doux') {
      delay1.delayTime.setValueAtTime(0.023, now);
      delay2.delayTime.setValueAtTime(0.037, now);
      fb1.gain.setValueAtTime(0.28, now);
      fb2.gain.setValueAtTime(0.24, now);
      toneFilter.frequency.setValueAtTime(4200, now);
      dryGain.gain.setTargetAtTime(0.55 * clampedMix, now, 0.015);
      wetGain.gain.setTargetAtTime(0.35 * clampedMix, now, 0.015);
    } else {
      // roda_chaude : espace chaleureux de Roda Maracatu
      delay1.delayTime.setValueAtTime(0.039, now);
      delay2.delayTime.setValueAtTime(0.061, now);
      fb1.gain.setValueAtTime(0.42, now);
      fb2.gain.setValueAtTime(0.38, now);
      toneFilter.frequency.setValueAtTime(2900, now);
      dryGain.gain.setTargetAtTime(0.60 * clampedMix, now, 0.015);
      wetGain.gain.setTargetAtTime(0.55 * clampedMix, now, 0.015);
    }
  };

  applyConfig(initialPreset, initialMix);

  return {
    updatePreset: (preset, mixAmount) => applyConfig(preset, mixAmount),
    disconnect: () => {
      try {
        dryGain.disconnect();
        wetGain.disconnect();
        toneFilter.disconnect();
        delay1.disconnect();
        delay2.disconnect();
        fb1.disconnect();
        fb2.disconnect();
        allpass.disconnect();
      } catch {}
    },
  };
}

