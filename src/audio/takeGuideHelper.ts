/**
 * takeGuideHelper.ts
 * Guide mélodique automatique dans le casque pendant l'enregistrement des déclinaisons (Prises 2, 3, 4).
 * Rejoue les notes verrouillées de la Prise 1 transposées au tempo effectif.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { scheduleMelodySteps, type SynthScheduledNode } from './synthVoiceHelper';

export interface TakeGuideHandle {
  stop: () => void;
}

export function scheduleSecondaryTakeGuide(
  ctx: AudioContext,
  destination: AudioNode,
  anacrusisSteps: VocalStepData[],
  mainSteps: VocalStepData[],
  cycleStart: number,
  countdownSec: number,
  effectiveBpm: number,
  pitchShiftSemitones: number
): TakeGuideHandle {
  const stepDurationSec = (60 / effectiveBpm) / 4;
  const guideGain = ctx.createGain();
  guideGain.gain.setValueAtTime(0.45, cycleStart);
  guideGain.connect(destination);

  const transposeSteps = (steps: VocalStepData[]): VocalStepData[] =>
    steps.map((s) => (s.active && s.midiNumber > 0 && s.note !== '───')
      ? { ...s, midiNumber: s.midiNumber + pitchShiftSemitones }
      : s
    );

  const nodes: SynthScheduledNode[] = [];
  if (anacrusisSteps && anacrusisSteps.length > 0) {
    const anaNodes = scheduleMelodySteps(ctx, guideGain, transposeSteps(anacrusisSteps), stepDurationSec, cycleStart);
    nodes.push(...anaNodes);
  }

  if (mainSteps && mainSteps.length > 0) {
    const mainNodes = scheduleMelodySteps(ctx, guideGain, transposeSteps(mainSteps), stepDurationSec, cycleStart + countdownSec);
    nodes.push(...mainNodes);
  }

  return {
    stop: () => {
      nodes.forEach((n) => { n.stop(); n.disconnect(); });
      try { guideGain.disconnect(); } catch {}
    },
  };
}
