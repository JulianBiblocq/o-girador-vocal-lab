/**
 * rhythmQuantizerToFigures.ts
 * Conversion pure des pas 16e & triolets (`3` par temps) en figures solfégiques propres :
 * Ronde à double-croche, triolet ┌3┐, soupirs sur 0, ligatures par temps, ties (───) et slurs de mélisme (_) (< 132 lignes).
 */
import { spellMidiPitch, type ResolvedStaffClef, type SpelledPitch } from './scoreTheoryHelper';
import type { ScoreStepLike } from './stepsToTwoStaffMeasures';

export type NoteFigureType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th';
export type LyricSyllabic = 'single' | 'begin' | 'middle' | 'end';

export interface QuantizedNoteFigure {
  isRest: boolean; isWholeMeasureRest?: boolean; figureType: NoteFigureType; dotted: boolean; divisions12: number;
  beatIndex: number; beamGroupId: number | null; tuplet?: { actual: 3; normal: 2; start: boolean; stop: boolean };
  tieStart: boolean; tieStop: boolean; slurStart: boolean; slurStop: boolean;
  pitch?: SpelledPitch; isRhythmOnly?: boolean; lyricText?: string; displayLyric?: string; syllabic?: LyricSyllabic;
}

const BINARY_TABLE: Array<{ steps: number; type: NoteFigureType; dotted: boolean; div12: number; validStart: (s: number) => boolean }> = [
  { steps: 16, type: 'whole', dotted: false, div12: 48, validStart: (s) => s === 0 },
  { steps: 12, type: 'half', dotted: true, div12: 36, validStart: (s) => s === 0 || s === 4 },
  { steps: 8, type: 'half', dotted: false, div12: 24, validStart: (s) => s % 8 === 0 || s === 4 },
  { steps: 6, type: 'quarter', dotted: true, div12: 18, validStart: (s) => s % 4 === 0 || s % 4 === 2 },
  { steps: 4, type: 'quarter', dotted: false, div12: 12, validStart: (s) => s % 4 === 0 },
  { steps: 3, type: 'eighth', dotted: true, div12: 9, validStart: (s) => s % 4 === 0 || s % 4 === 1 },
  { steps: 2, type: 'eighth', dotted: false, div12: 6, validStart: (s) => s % 2 === 0 },
  { steps: 1, type: '16th', dotted: false, div12: 3, validStart: () => true },
];

function splitBinarySpan(startStep: number, lenSteps: number, isRest: boolean) {
  const parts: Array<{ step: number; len: number; type: NoteFigureType; dotted: boolean; div12: number }> = [];
  let cur = startStep, rem = lenSteps;
  while (rem > 0) {
    const beatRem = 4 - (cur % 4);
    const match = BINARY_TABLE.find((cand) => {
      if (cand.steps > rem) return false;
      if (isRest && cand.steps < 8 && cand.steps > beatRem) return false;
      if (!isRest && cur % 4 !== 0 && cand.steps > beatRem) return false;
      return cand.validStart(cur);
    }) || BINARY_TABLE[BINARY_TABLE.length - 1];
    parts.push({ step: cur, len: match.steps, type: match.type, dotted: match.dotted, div12: match.div12 });
    cur += match.steps; rem -= match.steps;
  }
  return parts;
}

export function quantizeMeasureStepsToFigures(
  steps: ScoreStepLike[], beatsCount: number, fifths = 0, clef: ResolvedStaffClef = 'treble', isRhythmOnly = false
): QuantizedNoteFigure[] {
  const totalSteps = Math.max(4, beatsCount * 4);
  const norm = Array.from({ length: totalSteps }, (_, i) => steps[i] || { stepIndex: i, active: false, midiNumber: 0 });
  if (!norm.some((s) => s.tripletSlot !== 'unused' && s.active && s.syllable !== '0' && s.syllable !== '𝄽')) {
    return [{ isRest: true, isWholeMeasureRest: true, figureType: beatsCount >= 4 ? 'whole' : beatsCount >= 2 ? 'half' : 'quarter', dotted: beatsCount === 3, divisions12: beatsCount * 12, beatIndex: 0, beamGroupId: null, tieStart: false, tieStop: false, slurStart: false, slurStop: false }];
  }

  const figures: QuantizedNoteFigure[] = [];
  let wordOpen = false, stepCursor = 0;

  const attachLyricAndSlur = (fig: QuantizedNoteFigure, rawSyl: string, isMelismaStep: boolean) => {
    const trimmed = String(rawSyl || '').trim().replace(/───/g, '');
    if (isMelismaStep || trimmed === '_') {
      for (let p = figures.length - 1; p >= 0; p--) if (!figures[p].isRest) { figures[p].slurStart = true; fig.slurStop = true; break; }
      fig.displayLyric = '_'; return;
    }
    if (!trimmed || trimmed === '0' || trimmed === '𝄽') return;
    const endsWithHyphen = trimmed.endsWith('-') && trimmed.length > 1, cleanText = endsWithHyphen ? trimmed.slice(0, -1) : trimmed;
    fig.syllabic = wordOpen ? (endsWithHyphen ? 'middle' : 'end') : (endsWithHyphen ? 'begin' : 'single');
    wordOpen = endsWithHyphen; fig.lyricText = cleanText; fig.displayLyric = endsWithHyphen ? `${cleanText} -` : cleanText;
  };

  while (stepCursor < totalSteps) {
    const beatIdx = Math.floor(stepCursor / 4), beatSlice = norm.slice(beatIdx * 4, beatIdx * 4 + 4);
    const isTripletBeat = stepCursor % 4 === 0 && beatSlice.some((s) => s.tripletSlot === 1 || s.tripletSlot === 2 || s.tripletSlot === 3 || s.tripletSlot === 'unused');
    if (isTripletBeat) {
      [1, 2, 3].map((sn, idx) => beatSlice.find((s) => s.tripletSlot === sn) || beatSlice[idx]).forEach((st, tIdx) => {
        const act = Boolean(st && st.active && st.syllable !== '0' && st.syllable !== '𝄽'), isTieCont = Boolean(act && (st.isTie || st.note === '───'));
        if (isTieCont && figures.length > 0 && !figures[figures.length - 1].isRest) figures[figures.length - 1].tieStart = true;
        const fig: QuantizedNoteFigure = { isRest: !act, figureType: 'eighth', dotted: false, divisions12: 4, beatIndex: beatIdx, beamGroupId: act ? beatIdx * 10 + 1 : null, tuplet: { actual: 3, normal: 2, start: tIdx === 0, stop: tIdx === 2 }, tieStart: false, tieStop: isTieCont, slurStart: false, slurStop: false, pitch: act ? spellMidiPitch(st.midiNumber || 60, fifths, clef) : undefined, isRhythmOnly };
        if (act && !isTieCont) attachLyricAndSlur(fig, st.syllable || '', Boolean(st.isMelisma));
        figures.push(fig);
      });
      stepCursor += 4; continue;
    }

    const head = norm[stepCursor], headAct = Boolean(head.active && head.syllable !== '0' && head.syllable !== '𝄽');
    let span = 1;
    if (!headAct) {
      while (stepCursor + span < totalSteps) {
        const nx = norm[stepCursor + span];
        if ((stepCursor + span) % 4 === 0 && norm.slice(stepCursor + span, stepCursor + span + 4).some((s) => s.tripletSlot !== undefined)) break;
        if (nx.active && nx.syllable !== '0' && nx.syllable !== '𝄽') break;
        span++;
      }
      for (const p of splitBinarySpan(stepCursor, span, true)) figures.push({ isRest: true, figureType: p.type, dotted: p.dotted, divisions12: p.div12, beatIndex: Math.floor(p.step / 4), beamGroupId: null, tieStart: false, tieStop: false, slurStart: false, slurStop: false });
    } else {
      while (stepCursor + span < totalSteps) {
        const nx = norm[stepCursor + span];
        if (!nx.active || !(nx.isTie || nx.note === '───') || nx.tripletSlot !== undefined) break;
        span++;
      }
      const parts = splitBinarySpan(stepCursor, span, false), sp = spellMidiPitch(head.midiNumber || 60, fifths, clef), incomingTie = Boolean(head.isTie || head.note === '───');
      if (incomingTie && figures.length > 0 && !figures[figures.length - 1].isRest) figures[figures.length - 1].tieStart = true;
      parts.forEach((p, pIdx) => {
        const bId = Math.floor(p.step / 4), fig: QuantizedNoteFigure = { isRest: false, figureType: p.type, dotted: p.dotted, divisions12: p.div12, beatIndex: bId, beamGroupId: p.type === 'eighth' || p.type === '16th' ? bId : null, tieStart: pIdx < parts.length - 1, tieStop: pIdx > 0 || incomingTie, slurStart: false, slurStop: false, pitch: sp, isRhythmOnly };
        if (pIdx === 0 && !incomingTie) attachLyricAndSlur(fig, head.syllable || '', Boolean(head.isMelisma));
        figures.push(fig);
      });
    }
    stepCursor += span;
  }
  return figures;
}
