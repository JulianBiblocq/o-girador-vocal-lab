/**
 * scaleTranspositionHelper.ts
 * Gestion du modèle à Double Tonalité (Prise chantée sungScaleRoot vs Tonalité Troupe troupeScaleRoot
 * avec décalage transpositionSemitones -6..+6 st) et transposition des pas MIDI (< 125 lignes).
 */
import type { ToadaProject } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { getTonicSemitone, type ScaleType } from '../audio/scaleQuantizer';
import {
  SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR,
  formatProjectScaleLabel, parseStoredScaleString, applyDetectedScaleToProject,
} from '../audio/projectScaleAnalyzer';
import { NOTE_NAMES, midiToNoteName } from './noteUtils';
import { transposePitchNote } from './musicalMath';

export interface DualScaleResolution {
  sungScaleRoot: string; sungScaleMode: ScaleType; sungScaleLabel: string; sungSolfegeRoot: string;
  transpositionSemitones: number; troupeScaleRoot: string; troupeScaleMode: ScaleType;
  troupeScaleLabel: string; troupeSolfegeRoot: string;
  sungReferencePitch: string; troupeReferencePitch: string; isLocked: boolean;
}

export function clampTranspositionSemitones(st: number): number {
  return Number.isFinite(st) ? Math.max(-6, Math.min(6, Math.round(st))) : 0;
}

export function transposePitchClass(tonic: string, semitones: number): string {
  const pc = getTonicSemitone(tonic);
  return NOTE_NAMES[(((pc + Math.round(semitones)) % 12) + 12) % 12] || 'C';
}

export function computeSemitoneDistance(fromTonic: string, toTonic: string): number {
  let diff = (getTonicSemitone(toTonic) - getTonicSemitone(fromTonic) + 12) % 12;
  if (diff > 6) diff -= 12;
  return diff;
}

export function transposeVocalSteps(steps: VocalStepData[], semitones: number): VocalStepData[] {
  const st = Math.round(semitones || 0);
  return (steps || []).map((s, idx) => {
    const isTie = s.note === '───' || Boolean((s as any).isTie);
    if (!s.active || isTie || s.midiNumber <= 0 || st === 0) {
      return { ...s, stepIndex: idx, ...(isTie ? { isTie: true } : {}) };
    }
    const nextMidi = Math.max(24, Math.min(108, s.midiNumber + st));
    return { ...s, stepIndex: idx, midiNumber: nextMidi, note: midiToNoteName(nextMidi) };
  });
}

export function resolveProjectDualScale(
  project: ToadaProject,
  lang: 'fr' | 'br' = 'fr',
  fallbackAnalysis?: { tonic: string; scaleType: ScaleType; analyzedPatternsCount: number; referencePitch: string }
): DualScaleResolution {
  const solfege = lang === 'br' ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES;
  const transpositionSemitones = clampTranspositionSemitones(
    project.transpositionSemitones ?? project.toadaMeta?.transpositionSemitones ?? 0
  );
  const parsedOrig = parseStoredScaleString(project.toadaMeta?.tonaliteChanteeOrigine);
  const parsedDefaut = parseStoredScaleString(project.toadaMeta?.tonaliteDefaut);
  const hasAnalysis = Boolean(fallbackAnalysis && fallbackAnalysis.analyzedPatternsCount > 0);

  let sungScaleRoot = project.sungScaleRoot || project.toadaMeta?.sungScaleRoot || '';
  let sungScaleMode = (project.sungScaleMode || project.toadaMeta?.sungScaleMode || '') as ScaleType;

  if (!sungScaleRoot && parsedOrig) {
    sungScaleRoot = parsedOrig.tonic;
    if (!sungScaleMode) sungScaleMode = parsedOrig.scaleType;
  }
  if (!sungScaleRoot && parsedDefaut) {
    sungScaleRoot = transpositionSemitones !== 0 ? transposePitchClass(parsedDefaut.tonic, -transpositionSemitones) : parsedDefaut.tonic;
    if (!sungScaleMode) sungScaleMode = parsedDefaut.scaleType;
  }
  if (!sungScaleRoot) sungScaleRoot = hasAnalysis ? fallbackAnalysis!.tonic : 'A';
  if (!sungScaleMode) sungScaleMode = hasAnalysis ? fallbackAnalysis!.scaleType : 'natural_minor';

  const cleanSungRoot = NOTE_NAMES[getTonicSemitone(sungScaleRoot)] || 'A';
  const troupeScaleRoot = transposePitchClass(cleanSungRoot, transpositionSemitones);
  const troupeScaleMode: ScaleType = sungScaleMode;
  const sungScaleLabel = formatProjectScaleLabel(cleanSungRoot, sungScaleMode, lang);
  const troupeScaleLabel = formatProjectScaleLabel(troupeScaleRoot, troupeScaleMode, lang);
  const sungSolfegeRoot = solfege[getTonicSemitone(cleanSungRoot)] || cleanSungRoot;
  const troupeSolfegeRoot = solfege[getTonicSemitone(troupeScaleRoot)] || troupeScaleRoot;

  const patRef = project.patterns.find((p) => p.referencePitch && p.referencePitch !== 'C4')?.referencePitch
    || (hasAnalysis ? fallbackAnalysis!.referencePitch : `${cleanSungRoot}3`);
  const octMatch = patRef.match(/(\d+)$/);
  const sungReferencePitch = `${cleanSungRoot}${octMatch ? octMatch[1] : '3'}`;
  const troupeReferencePitch = transposePitchNote(sungReferencePitch, transpositionSemitones);
  const isLocked = sungScaleMode !== 'chromatic' && Boolean(project.toadaMeta?.tonaliteDefaut || project.sungScaleRoot || hasAnalysis);

  return {
    sungScaleRoot: cleanSungRoot, sungScaleMode, sungScaleLabel, sungSolfegeRoot,
    transpositionSemitones, troupeScaleRoot, troupeScaleMode, troupeScaleLabel, troupeSolfegeRoot,
    sungReferencePitch, troupeReferencePitch, isLocked,
  };
}

export function applyDualScaleToProject(
  project: ToadaProject, sungRoot: string, sungMode: ScaleType,
  transpositionSemitones: number, referencePitch?: string, lang: 'fr' | 'br' = 'fr'
): ToadaProject {
  const clampedSt = clampTranspositionSemitones(transpositionSemitones);
  const cleanSungRoot = NOTE_NAMES[getTonicSemitone(sungRoot)] || 'A';
  const troupeRoot = transposePitchClass(cleanSungRoot, clampedSt);
  const sungLabelFr = formatProjectScaleLabel(cleanSungRoot, sungMode, 'fr');
  const troupeLabelFr = formatProjectScaleLabel(troupeRoot, sungMode, 'fr');

  const baseUpdated = applyDetectedScaleToProject(project, cleanSungRoot, sungMode, referencePitch, lang);
  return {
    ...baseUpdated,
    sungScaleRoot: cleanSungRoot, sungScaleMode: sungMode, transpositionSemitones: clampedSt, troupeScaleRoot: troupeRoot,
    previewListenTarget: clampedSt !== 0 ? 'troupe' : (project.previewListenTarget ?? 'sung'),
    toadaMeta: {
      ...(baseUpdated.toadaMeta || {}),
      tonaliteDefaut: troupeLabelFr, tonaliteChanteeOrigine: sungLabelFr, transpositionSemitones: clampedSt,
      sungScaleRoot: cleanSungRoot, sungScaleMode: sungMode, troupeScaleRoot: troupeRoot,
    },
  };
}
