/**
 * vocalGameAnalyzers.ts
 * Analyseurs acoustiques des 4 Exercices Vocaux du Maracatu :
 * Flèche (150 ms attaque <= 35c sans scoop > 60c + tenue 1s), Souffle/Endurance & Projection Roda (< 138 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TranslationKey } from '../i18n/i18n.types';
import type { RodaProjectionStatus } from './rodaResonanceAnalyzer';

export type MaracatuGameId = 'tir_franc' | 'o_chamado' | 'voz_no_passo' | 'a_voz_na_roda';

export interface VocalGameSample {
  timeSec: number; pitchMidi: number; rms: number; brillianceRatio: number;
  projectionScorePct?: number; projectionStatus?: RodaProjectionStatus;
}

export interface VocalGameEvaluation {
  gameId: MaracatuGameId; isSuccess: boolean; feedbackKey: TranslationKey;
  centsDiff: number; avgRms: number; brillianceRatio: number;
  projectionScorePct?: number; projectionStatus?: RodaProjectionStatus;
  beatStatuses?: [boolean, boolean, boolean, boolean];
  arrowPlanted?: boolean; maxEnduranceSec?: number;
  pitchCurve: PitchCurvePoint[];
}

export function computeSpectralBrillianceRatio(freqDb: Float32Array, sampleRate: number, fftSize: number): number {
  const binHz = sampleRate / fftSize;
  const lowStart = Math.max(1, Math.floor(150 / binHz)), lowEnd = Math.min(freqDb.length - 1, Math.ceil(400 / binHz));
  const highStart = Math.max(1, Math.floor(2500 / binHz)), highEnd = Math.min(freqDb.length - 1, Math.ceil(4000 / binHz));
  let lowSum = 0, lowCount = 0, highSum = 0, highCount = 0;
  for (let i = lowStart; i <= lowEnd; i++) { lowSum += Math.pow(10, freqDb[i] / 10); lowCount++; }
  for (let i = highStart; i <= highEnd; i++) { highSum += Math.pow(10, freqDb[i] / 10); highCount++; }
  const lowAvg = lowCount > 0 ? lowSum / lowCount : 1e-9, highAvg = highCount > 0 ? highSum / highCount : 0;
  return Math.min(5, Math.round((highAvg / Math.max(1e-9, lowAvg)) * 30 * 100) / 100);
}

export function computeMaxHealthyEnduranceSec(targetMidi: number, samples: VocalGameSample[]): number {
  let curSec = 0, maxSec = 0, lastT: number | null = null;
  for (const s of samples) {
    const dt = lastT !== null ? Math.max(0, Math.min(0.12, s.timeSec - lastT)) : 0.02;
    lastT = s.timeSec;
    const inTune = s.pitchMidi > 0 && s.rms >= 0.02 && Math.abs(s.pitchMidi - targetMidi) * 100 <= 40;
    const healthyRoda = s.projectionStatus !== 'forcage' && ((s.projectionScorePct ?? 0) >= 35 || s.brillianceRatio >= 0.30);
    if (inTune && healthyRoda) { curSec += dt; if (curSec > maxSec) maxSec = curSec; }
    else curSec = 0;
  }
  return Math.round(maxSec * 10) / 10;
}

export function analyzeTirFranc(targetMidi: number, samples: VocalGameSample[]): VocalGameEvaluation {
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 2) {
    return { gameId: 'tir_franc', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, arrowPlanted: false, pitchCurve: [] };
  }
  const t0 = voiced[0].timeSec;
  const attackWin = voiced.filter((s) => s.timeSec - t0 <= 0.15);
  const bodyWin = voiced.filter((s) => s.timeSec - t0 > 0.15 && s.timeSec - t0 <= 1.25);
  const attackAvg = attackWin.reduce((a, s) => a + s.pitchMidi, 0) / attackWin.length;
  const minAttackMidi = Math.min(...attackWin.map((s) => s.pitchMidi));
  const bodyAvg = bodyWin.length > 0 ? bodyWin.reduce((a, s) => a + s.pitchMidi, 0) / bodyWin.length : attackAvg;

  const attackSignedCents = (attackAvg - targetMidi) * 100;
  const scoopClimbCents = Math.max((bodyAvg - attackAvg) * 100, (bodyAvg - minAttackMidi) * 100);
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(attackSignedCents));

  const inTuneHold = voiced.filter((s) => Math.abs(s.pitchMidi - targetMidi) * 100 <= 35);
  const holdSpanSec = inTuneHold.length >= 2 ? inTuneHold[inTuneHold.length - 1].timeSec - inTuneHold[0].timeSec : 0;
  const scooped = scoopClimbCents > 60 || attackSignedCents < -45;
  const arrowPlanted = !scooped && centsDiff <= 35 && (holdSpanSec >= 0.95 || voiced[voiced.length - 1].timeSec - t0 < 0.95 && inTuneHold.length === voiced.length);
  const feedbackKey: TranslationKey = arrowPlanted ? 'game1HitSuccess' : scooped ? 'game1ScoopWarn' : 'game1PitchWarn';
  return { gameId: 'tir_franc', isSuccess: arrowPlanted, feedbackKey, centsDiff, avgRms, brillianceRatio: 0, arrowPlanted, pitchCurve: [] };
}

export function analyzeOChamado(targetMidi: number, samples: VocalGameSample[]): VocalGameEvaluation {
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 3) {
    return { gameId: 'o_chamado', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, projectionScorePct: 0, maxEnduranceSec: 0, pitchCurve: [] };
  }
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const avgMidi = voiced.reduce((a, s) => a + s.pitchMidi, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(avgMidi - targetMidi) * 100);
  const brillianceRatio = Math.round((voiced.reduce((a, s) => a + s.brillianceRatio, 0) / voiced.length) * 100) / 100;
  const projectionScorePct = Math.round(voiced.reduce((a, s) => a + (s.projectionScorePct ?? 0), 0) / voiced.length);
  const maxEnduranceSec = computeMaxHealthyEnduranceSec(targetMidi, samples);

  const hasPower = avgRms >= 0.04, isInTune = centsDiff <= 40, hasMask = brillianceRatio >= 0.35 || projectionScorePct >= 40;
  const isSuccess = hasPower && isInTune && hasMask;
  const feedbackKey: TranslationKey = !hasPower ? 'game2NeedPower' : !isInTune ? 'game1PitchWarn' : !hasMask ? 'game2NeedBrilliance' : 'game2Success';
  return { gameId: 'o_chamado', isSuccess, feedbackKey, centsDiff, avgRms, brillianceRatio, projectionScorePct, maxEnduranceSec, pitchCurve: [] };
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
    if (win.length === 0) beatStatuses[b % 4] = false;
    else {
      const localCents = Math.max(...win.map((s) => Math.abs(s.pitchMidi - targetMidi) * 100));
      const localRmsBump = Math.max(...win.map((s) => Math.abs(s.rms - avgRms) / Math.max(0.01, avgRms)));
      if (localCents > 50 || localRmsBump > 0.55) beatStatuses[b % 4] = false;
    }
  }
  const isSuccess = beatStatuses.every(Boolean) && centsDiff <= 45;
  return { gameId: 'voz_no_passo', isSuccess, feedbackKey: isSuccess ? 'game3Success' : 'game3BumpWarn', centsDiff, avgRms, brillianceRatio: 0, beatStatuses, pitchCurve };
}

export function analyzeAVozNaRoda(targetMidi: number, samples: VocalGameSample[]): VocalGameEvaluation {
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= 0.02);
  if (voiced.length < 3) {
    return { gameId: 'a_voz_na_roda', isSuccess: false, feedbackKey: 'game2NeedPower', centsDiff: 99, avgRms: 0, brillianceRatio: 0, projectionScorePct: 0, projectionStatus: 'timide', maxEnduranceSec: 0, pitchCurve: [] };
  }
  const avgRms = voiced.reduce((a, s) => a + s.rms, 0) / voiced.length;
  const avgMidi = voiced.reduce((a, s) => a + s.pitchMidi, 0) / voiced.length;
  const centsDiff = Math.round(Math.abs(avgMidi - targetMidi) * 100);
  const projectionScorePct = Math.round(voiced.reduce((a, s) => a + (s.projectionScorePct ?? 0), 0) / voiced.length);
  const forcageFrames = voiced.filter((s) => s.projectionStatus === 'forcage').length;
  const isForcage = forcageFrames > voiced.length * 0.4;
  const isInTune = centsDiff <= 35;
  const hasRodaResonance = projectionScorePct >= 45 && !isForcage;
  const isSuccess = isInTune && hasRodaResonance && avgRms >= 0.03;
  const projectionStatus: RodaProjectionStatus = isForcage ? 'forcage' : hasRodaResonance ? 'roda_optimal' : 'timide';
  const feedbackKey: TranslationKey = isForcage ? 'game4ForcageWarn' : !isInTune ? 'game1PitchWarn' : !hasRodaResonance ? 'game2NeedBrilliance' : 'game4Success';
  const maxEnduranceSec = computeMaxHealthyEnduranceSec(targetMidi, samples);
  return { gameId: 'a_voz_na_roda', isSuccess, feedbackKey, centsDiff, avgRms, brillianceRatio: 0, projectionScorePct, projectionStatus, maxEnduranceSec, pitchCurve: [] };
}
