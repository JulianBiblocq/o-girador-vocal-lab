/**
 * syllableAligner.ts
 * Alignement des syllabes découpées sur les briques de notes mélodiques actives (< 145 lignes).
 * Modes : A (grille théorique sans audio), B (briques MIDI audio guidées par timeAnchors), C (linéaire).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { midiToNoteName } from './noteUtils';

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => (!st.active || st.note === '───') ? { ...st, syllable: '' } : { ...st, syllable: syllables[syllIdx++] ?? '' });
}

export function alignSyllablesWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  if (!timeAnchors || timeAnchors.length === 0) return steps;
  const maxStepNeeded = timeAnchors.reduce((max, a) => {
    const s = (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat;
    return Math.max(max, s + (a.syllables?.length || 1) + stepsPerBeat);
  }, steps.length);

  const result: VocalStepData[] = Array.from({ length: maxStepNeeded }, (_, i) =>
    steps[i] ? { ...steps[i] } : { stepIndex: i, active: false, note: 'C4', midiNumber: 60, velocity: 100, decay: 200, syllable: '' }
  );

  for (const anchor of timeAnchors) {
    const stepStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    if (anchor.isRest || anchor.isInitialRest) {
      for (let s = stepStart; s < stepStart + stepsPerBeat && s < result.length; s++) { result[s].active = false; result[s].syllable = ''; }
    } else {
      if (anchor.hasLeadingRest && stepStart < result.length) {
        const tiePrev = stepStart > 0 && result[stepStart - 1].active;
        result[stepStart] = { ...result[stepStart], active: tiePrev, note: tiePrev ? '───' : '', isTie: tiePrev, syllable: '' };
      }
      const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
      const startSub = anchor.hasLeadingRest ? 1 : 0, avail = anchor.hasLeadingRest ? Math.max(1, stepsPerBeat - 1) : stepsPerBeat;
      for (let sIdx = 0; sIdx < syls.length; sIdx++) {
        const targetStep = stepStart + Math.min(stepsPerBeat - 1, startSub + Math.floor((sIdx * avail) / Math.max(1, syls.length)));
        if (targetStep < result.length) { result[targetStep].active = true; result[targetStep].isTie = false; result[targetStep].syllable = syls[sIdx]; }
      }
    }
  }
  return result;
}

function unTieStep(step: VocalStepData): void {
  if (step.note === '───' || !step.note) {
    step.note = midiToNoteName(step.midiNumber || 60); step.isTie = false; step.syllableAttack = true;
  }
}

function alignAudioStepsWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  const result = steps.map((s) => ({ ...s, syllable: '' }));
  for (const anchor of timeAnchors) {
    const beatStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    const beatEnd = Math.min(result.length, beatStart + stepsPerBeat);
    if (beatStart >= result.length) continue;
    if (anchor.isRest || anchor.isInitialRest) {
      for (let i = beatStart; i < beatEnd; i++) result[i] = { ...result[i], active: false, note: '', midiNumber: 0, isTie: false, syllable: '' };
      continue;
    }
    if (anchor.isSustainedHold) {
      for (let i = beatStart; i < beatEnd; i++) if (result[i].active && result[i].note !== '───') result[i].syllable = '-';
      continue;
    }
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;

    if (anchor.hasLeadingRest) {
      const prevAct = beatStart > 0 && result[beatStart - 1].active && result[beatStart - 1].midiNumber > 0 && result[beatStart].active;
      result[beatStart] = prevAct
        ? { ...result[beatStart], active: true, note: '───', midiNumber: result[beatStart - 1].midiNumber, isTie: true, syllable: '', syllableAttack: false }
        : { ...result[beatStart], active: false, note: '', midiNumber: 0, isTie: false, syllable: '', syllableAttack: false };
    }

    const zoneStart = anchor.hasLeadingRest ? Math.min(beatEnd - 1, beatStart + 1) : beatStart;
    const availSpan = Math.max(1, beatEnd - zoneStart), targetHeads = Math.min(syls.length, availSpan);
    const activeInBeat: number[] = [];
    for (let i = zoneStart; i < beatEnd; i++) if (result[i].active && result[i].midiNumber > 0) activeInBeat.push(i);

    if (activeInBeat.length < targetHeads) {
      const nextAct = result.find((s, idx) => idx >= beatStart && s.active && s.midiNumber > 0);
      const prevAct = result.slice(0, beatStart).reverse().find((s) => s.active && s.midiNumber > 0);
      const fbMidi = nextAct?.midiNumber ?? prevAct?.midiNumber ?? 60;
      activeInBeat.length = 0;
      for (let i = zoneStart; i < beatEnd; i++) {
        result[i] = { ...result[i], active: true, midiNumber: result[i].midiNumber > 0 ? result[i].midiNumber : fbMidi, note: '───', isTie: true };
        activeInBeat.push(i);
      }
    } else {
      for (let c = 0; c < activeInBeat.length; c++) {
        const idx = activeInBeat[c], prevIdx = c > 0 ? activeInBeat[c - 1] : idx - 1;
        const isMelisma = prevIdx >= 0 && result[prevIdx]?.active && Math.abs(result[idx].midiNumber - result[prevIdx].midiNumber) >= 2;
        if (!isMelisma) result[idx] = { ...result[idx], note: '───', isTie: true, syllableAttack: false };
      }
    }

    for (let k = 0; k < targetHeads; k++) {
      unTieStep(result[activeInBeat[Math.min(activeInBeat.length - 1, Math.floor((k * activeInBeat.length) / targetHeads))]]);
    }
    const heads = activeInBeat.filter((idx) => result[idx].note !== '───');
    if (heads.length < targetHeads) {
      for (const idx of activeInBeat) {
        if (heads.length >= targetHeads) break;
        if (result[idx].note === '───') { unTieStep(result[idx]); heads.push(idx); }
      }
      heads.sort((a, b) => a - b);
    }
    if (syls.length <= heads.length) {
      for (let k = 0; k < heads.length; k++) result[heads[k]].syllable = k < syls.length ? syls[k] : '-';
    } else {
      for (let k = 0; k < heads.length - 1; k++) result[heads[k]].syllable = syls[k];
      result[heads[heads.length - 1]].syllable = syls.slice(heads.length - 1).join('');
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
  const syllables = splitTextIntoLetraSyllables(lyricsText);
  let syllIdx = 0;
  return steps.map((st) => !st.active ? { ...st, syllable: '' } : st.note === '───' ? { ...st, syllable: st.syllable || '-' } : { ...st, syllable: syllables[syllIdx++] ?? '' });
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps.filter((st) => st.active && st.note !== '───' && st.syllable).map((st) => (st.syllable === '~' || st.syllable === '-' ? '' : st.syllable)).join('');
}
