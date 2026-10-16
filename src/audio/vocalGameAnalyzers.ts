/**
 * vocalGameAnalyzers.ts
 * Analyseurs acoustiques des 3 Exercices Vocaux du Maracatu (Tir Franc, O Chamado, Voz no Passo).
 * Strictement < 130 lignes.
 */

import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TranslationKey } from '../i18n/i18n.types';

export type MaracatuGameId = 'tir_franc' | 'o_chamado' | 'voz_no_passo';

export interface VocalGameSample {
  timeSec: number;
  pitchMidi: number;
  rms: number;
  brillianceRatio: number;
}

export interface VocalGameEvaluation {
  gameId: MaracatuGameId;
  isSuccess: boolean;
  feedbackKey: TranslationKey;
  centsDiff: number;
  avgRms: number;
  brillianceRatio: number;
  beatStatuses?: [boolean, boolean, boolean, boolean];
  pitchCurve: PitchCurvePoint[];
}

export function computeSpectralBrillianceRatio(freqDb: Float32Array, sampleRate: number, fftSize: number): number {
  const binHz = sampleRate / fftSize;
  const lowStart = Math.max(1, Math.floor(150 / binHz)), lowEnd = Math.min(freqDb.length - 1, Math.ceil(400 / binHz));
  const highStart = Math.max(1, Math.floor(2500 / binHz)), highEnd = Math.min(freqDb.length - 1, Math.ceil(4000 / binHz));

  let lowSum = 0, lowCount = 0;
  for (let i = lowStart; i <= lowEnd; i++) { lowSum += Math.pow(10, freqDb[i] / 10); lowCount++; }
  let highSum = 0, highCount = 0;
  for (let i = highStart; i <= highEnd; i++) { highSum += Math.pow(10, freqDb[i] / 10); highCount++; }

  const lowAvg = lowCount > 0 ? lowSum / lowCount : 1e-9;
  const highAvg = highCount > 0 ? highSum / highCount : 0;
  return Math.min(5, Math.round((highAvg / Math.max(1e-9, lowAvg)) * 30 * 100) / 100);
}

export function analyzeTirFranc(targetMidi: number, samples: VocalGameSample[]): VocalGameEvaluation {
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 2) {
    return { gameId: 'tir_franc', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, pitchCurve: [] };
  }
  const t0 = voiced[0].timeSec;
  const attackWin = voiced.filter((s) => s.timeSec - t0 <= 0.15);
  const bodyWin = voiced.filter((s) => s.timeSec - t0 > 0.15 && s.timeSec - t0 <= 0.55);
  const attackAvg = attackWin.reduce((a, s) => a + s.pitchMidi, 0) / attackWin.length;
  const bodyAvg = bodyWin.length > 0 ? bodyWin.reduce((a, s) => a + s.pitchMidi, 0) / bodyWin.length : attackAvg;

  const attackSignedCents = (attackAvg - targetMidi) * 100;
  const scoopClimbCents = (bodyAvg - attackAvg) * 100;
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(attackSignedCents));

  const scooped = attackSignedCents < -40 || scoopClimbCents > 38;
  const isDirectHit = !scooped && centsDiff <= 45;
  const feedbackKey: TranslationKey = isDirectHit ? 'game1HitSuccess' : scooped ? 'game1ScoopWarn' : 'game1PitchWarn';
  return { gameId: 'tir_franc', isSuccess: isDirectHit, feedbackKey, centsDiff, avgRms, brillianceRatio: 0, pitchCurve: [] };
}

export function analyzeOChamado(targetMidi: number, samples: VocalGameSample[]): VocalGameEvaluation {
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 3) {
    return { gameId: 'o_chamado', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, pitchCurve: [] };
  }
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const avgMidi = voiced.reduce((a, s) => a + s.pitchMidi, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(avgMidi - targetMidi) * 100);
  const brillianceRatio = Math.round((voiced.reduce((a, s) => a + s.brillianceRatio, 0) / voiced.length) * 100) / 100;

  const hasPower = avgRms >= 0.04, isInTune = centsDiff <= 45, hasMask = brillianceRatio >= 0.35;
  const isSuccess = hasPower && isInTune && hasMask;
  const feedbackKey: TranslationKey = !hasPower ? 'game2NeedPower' : !isInTune ? 'game1PitchWarn' : !hasMask ? 'game2NeedBrilliance' : 'game2Success';
  return { gameId: 'o_chamado', isSuccess, feedbackKey, centsDiff, avgRms, brillianceRatio, pitchCurve: [] };
}

export function analyzeVozNoPasso(
  targetMidi: number, samples: VocalGameSample[], beatDurationSec: number, anacrusisDurationSec: number
): VocalGameEvaluation {
  const pitchCurve: PitchCurvePoint[] = samples.filter((s) => s.pitchMidi > 0).map((s) => ({ timeSec: anacrusisDurationSec + s.timeSec, midiFloat: s.pitchMidi }));
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 6) {
    return { gameId: 'voz_no_passo', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, beatStatuses: [false, false, false, false], pitchCurve };
  }
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const avgMidi = voiced.reduce((a, s) => a + s.pitchMidi, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(avgMidi - targetMidi) * 100);

  const beatStatuses: [boolean, boolean, boolean, boolean] = [true, true, true, true];
  for (let b = 0; b < 8; b++) {
    const win = voiced.filter((s) => Math.abs(s.timeSec - b * beatDurationSec) <= 0.14);
    if (win.length === 0) { beatStatuses[b % 4] = false; }
    else {
      const localCents = Math.max(...win.map((s) => Math.abs(s.pitchMidi - targetMidi) * 100));
      const localRmsBump = Math.max(...win.map((s) => Math.abs(s.rms - avgRms) / Math.max(0.01, avgRms)));
      if (localCents > 50 || localRmsBump > 0.55) beatStatuses[b % 4] = false;
    }
  }
  const isSuccess = beatStatuses.every(Boolean) && centsDiff <= 45;
  return { gameId: 'voz_no_passo', isSuccess, feedbackKey: isSuccess ? 'game3Success' : 'game3BumpWarn', centsDiff, avgRms, brillianceRatio: 0, beatStatuses, pitchCurve };
}
