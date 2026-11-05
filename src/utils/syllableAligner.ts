/**
 * syllableAligner.ts
 * Alignement des syllabes et briques MIDI guidé par la micro-grille sub-temps (syllableSubdivs) d'Organizador (< 142 lignes).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { computeBeatSyllableSubdivs } from './subbeatAnchorHelper';
import { midiToNoteName } from './noteUtils';

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => (!st.active || st.note === '───') ? { ...st, syllable: '' } : { ...st, syllable: syllables[syllIdx++] ?? '' });
}

export function assignSyllablesStrictlyToExistingBricks(steps: VocalStepData[], lyricsText: string): VocalStepData[] {
  const syllables = splitTextIntoLetraSyllables(lyricsText || '');
  const attackIndices = steps.map((st, idx) => (st.active && st.note !== '───' && !st.isTie ? idx : -1)).filter((idx) => idx !== -1);
  if (attackIndices.length === 0) return steps;
  const result = steps.map((st) => ({ ...st, syllable: '' }));
  if (syllables.length <= attackIndices.length) {
    for (let k = 0; k < attackIndices.length; k++) result[attackIndices[k]].syllable = syllables[k] ?? '';
  } else {
    for (let k = 0; k < attackIndices.length - 1; k++) result[attackIndices[k]].syllable = syllables[k];
    result[attackIndices[attackIndices.length - 1]].syllable = syllables.slice(attackIndices.length - 1).join('');
  }
  return result;
}

export function alignSyllablesWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  if (!timeAnchors || timeAnchors.length === 0) return steps;
  const maxStepNeeded = timeAnchors.reduce((max, a) => Math.max(max, (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat + stepsPerBeat), steps.length);
  const result: VocalStepData[] = Array.from({ length: maxStepNeeded }, (_, i) => steps[i] ? { ...steps[i], syllable: '' } : { stepIndex: i, active: false, note: 'C4', midiNumber: 60, velocity: 100, decay: 200, syllable: '' });

  let seenSung = false;
  for (const anchor of timeAnchors) {
    const stepStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    const stepEnd = Math.min(result.length, stepStart + stepsPerBeat);
    if (anchor.isRest || anchor.isInitialRest) {
      for (let s = stepStart; s < stepEnd; s++) { result[s].active = false; result[s].isTie = false; result[s].note = ''; result[s].syllable = ''; }
      continue;
    }
    if (anchor.isSustainedHold) continue;
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;
    const subdivs = anchor.syllableSubdivs?.length === syls.length ? anchor.syllableSubdivs : computeBeatSyllableSubdivs(anchor.textSlice || '', syls, Boolean(anchor.hasLeadingRest), Boolean(anchor.hasTrailingPickup));
    const firstSub = Math.max(0, Math.min(stepsPerBeat - 1, subdivs[0] ?? (anchor.hasLeadingRest ? 1 : 0)));
    const tiePrev = seenSung && stepStart > 0 && result[stepStart - 1].active;
    for (let s = stepStart; s < stepStart + firstSub && s < stepEnd; s++) {
      result[s] = { ...result[s], active: tiePrev, note: tiePrev ? '───' : '', isTie: tiePrev, syllable: '' };
    }
    for (let s = stepStart + firstSub; s < stepEnd; s++) {
      result[s] = { ...result[s], active: true, note: '───', isTie: true, syllable: '' };
    }
    for (let sIdx = 0; sIdx < syls.length; sIdx++) {
      const targetStep = Math.min(stepEnd - 1, stepStart + (subdivs[sIdx] ?? Math.min(stepsPerBeat - 1, firstSub + sIdx)));
      result[targetStep] = { ...result[targetStep], active: true, isTie: false, note: result[targetStep].note && result[targetStep].note !== '───' ? result[targetStep].note : 'C4', syllable: syls[sIdx] };
    }
    seenSung = true;
  }
  return result;
}

export function alignAudioStepsWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  const origActive = steps.map((s) => Boolean(s.active && s.midiNumber > 0));
  const result = steps.map((s) => ({ ...s, syllable: '', note: s.active ? '───' : '', isTie: s.active, syllableAttack: false }));
  let seenSung = false, lastSungBeatEnd = 0;

  for (let aIdx = 0; aIdx < timeAnchors.length; aIdx++) {
    const anchor = timeAnchors[aIdx];
    const beatStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    const beatEnd = Math.min(result.length, beatStart + stepsPerBeat);
    if (beatStart >= result.length) continue;
    if (anchor.isRest || anchor.isInitialRest) {
      for (let i = beatStart; i < beatEnd; i++) result[i] = { ...result[i], active: false, note: '', midiNumber: 0, isTie: false, syllable: '' };
      continue;
    }
    if (anchor.isSustainedHold) { if (seenSung) lastSungBeatEnd = Math.max(lastSungBeatEnd, beatEnd); continue; }
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;

    const subdivs = anchor.syllableSubdivs?.length === syls.length ? anchor.syllableSubdivs : computeBeatSyllableSubdivs(anchor.textSlice || '', syls, Boolean(anchor.hasLeadingRest), Boolean(anchor.hasTrailingPickup));
    const firstSub = Math.max(0, Math.min(stepsPerBeat - 1, subdivs[0] ?? (anchor.hasLeadingRest ? 1 : 0)));
    const nextAct = result.find((s, idx) => idx >= beatStart && s.active && s.midiNumber > 0);
    const prevAct = result.slice(0, beatStart).reverse().find((s) => s.active && s.midiNumber > 0);
    const fbMidi = nextAct?.midiNumber ?? prevAct?.midiNumber ?? 60;
    const tiePrev = seenSung && beatStart > 0 && result[beatStart - 1].active;

    for (let i = beatStart; i < beatStart + firstSub && i < beatEnd; i++) {
      result[i] = tiePrev ? { ...result[i], active: true, note: '───', midiNumber: result[beatStart - 1].midiNumber || fbMidi, isTie: true, syllable: '' } : { ...result[i], active: false, note: '', midiNumber: 0, isTie: false, syllable: '' };
    }
    for (let i = beatStart + firstSub; i < beatEnd; i++) {
      if (!result[i].active || result[i].midiNumber <= 0) result[i] = { ...result[i], active: true, midiNumber: fbMidi, note: '───', isTie: true };
    }
    const maxHeads = Math.min(syls.length, stepsPerBeat - firstSub), heads: number[] = [];
    for (let k = 0; k < maxHeads; k++) {
      const prevHead = heads.length > 0 ? heads[heads.length - 1] - beatStart : firstSub - 1;
      heads.push(Math.min(beatEnd - 1, beatStart + Math.max(prevHead + 1, Math.min(stepsPerBeat - (maxHeads - k), subdivs[k] ?? (firstSub + k)))));
    }
    if (heads.length > 0) {
      for (let k = 0; k < heads.length - 1; k++) result[heads[k]].syllable = syls[k];
      result[heads[heads.length - 1]].syllable = syls.slice(heads.length - 1).join('');
    }
    seenSung = true; lastSungBeatEnd = Math.max(lastSungBeatEnd, beatEnd);
  }

  let seenFirstBrick = false;
  for (let i = 0; i < result.length; i++) {
    if (Boolean(result[i].syllable && result[i].syllable.trim() !== '')) {
      seenFirstBrick = true; const m = result[i].midiNumber > 0 ? result[i].midiNumber : 60;
      result[i] = { ...result[i], active: true, midiNumber: m, note: midiToNoteName(m), isTie: false, syllableAttack: true };
    } else if (result[i].active) {
      const keepTie = seenFirstBrick && i > 0 && result[i - 1].active && result[i - 1].midiNumber > 0 && (i < lastSungBeatEnd || origActive[i]);
      result[i] = keepTie ? { ...result[i], active: true, midiNumber: result[i - 1].midiNumber, note: '───', isTie: true, syllable: '', syllableAttack: false } : { ...result[i], active: false, midiNumber: 0, note: '', isTie: false, syllable: '', syllableAttack: false };
    }
  }
  return result;
}

export function applyLyricsSyllablesToSteps(
  steps: VocalStepData[], lyricsText?: string, timeAnchors?: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  if (timeAnchors && timeAnchors.length > 0) {
    const hasAudioBricks = steps.some((s) => s.active && s.midiNumber > 0 && s.decay < 10);
    return hasAudioBricks ? alignAudioStepsWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat) : alignSyllablesWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat);
  }
  if (!lyricsText || !lyricsText.trim()) return steps;
  return assignSyllablesStrictlyToExistingBricks(steps, lyricsText);
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps.filter((st) => st.active && st.note !== '───' && st.syllable).map((st) => (st.syllable === '~' || st.syllable === '-' ? '' : st.syllable)).join('');
}
