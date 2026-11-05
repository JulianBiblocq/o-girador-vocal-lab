/**
 * syllableAligner.ts
 * Alignement des syllabes sur les briques MIDI (assignSyllablesStrictlyToExistingBricks & alignAudioStepsWithTimeAnchors < 144 lignes).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
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
  const maxStepNeeded = timeAnchors.reduce((max, a) => Math.max(max, (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat + (a.syllables?.length || 1) + stepsPerBeat), steps.length);
  const result: VocalStepData[] = Array.from({ length: maxStepNeeded }, (_, i) => steps[i] ? { ...steps[i] } : { stepIndex: i, active: false, note: 'C4', midiNumber: 60, velocity: 100, decay: 200, syllable: '' });

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

function alignAudioStepsWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  const origAttacks = steps.map((s) => Boolean(s.syllableAttack));
  const result = steps.map((s) => ({ ...s, syllable: '', note: s.active ? '───' : '', isTie: s.active, syllableAttack: false }));

  for (let aIdx = 0; aIdx < timeAnchors.length; aIdx++) {
    const anchor = timeAnchors[aIdx], nextAnchor = timeAnchors[aIdx + 1];
    const beatStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    const beatEnd = Math.min(result.length, beatStart + stepsPerBeat);
    if (beatStart >= result.length) continue;
    if (anchor.isRest || anchor.isInitialRest) {
      for (let i = beatStart; i < beatEnd; i++) result[i] = { ...result[i], active: false, note: '', midiNumber: 0, isTie: false, syllable: '' };
      continue;
    }
    if (anchor.isSustainedHold) continue;
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;

    if (anchor.hasLeadingRest) {
      const prevAct = beatStart > 0 && result[beatStart - 1].active && result[beatStart - 1].midiNumber > 0 && result[beatStart].active;
      result[beatStart] = prevAct
        ? { ...result[beatStart], active: true, note: '───', midiNumber: result[beatStart - 1].midiNumber, isTie: true, syllable: '' }
        : { ...result[beatStart], active: false, note: '', midiNumber: 0, isTie: false, syllable: '' };
    }

    const canAnticipate = !anchor.hasLeadingRest && beatStart > 0 && result[beatStart - 1].active && !result[beatStart - 1].syllable
      && (origAttacks[beatStart - 1] || (beatStart >= 2 && result[beatStart - 2].active && Math.abs(result[beatStart - 1].midiNumber - result[beatStart - 2].midiNumber) >= 1 && Math.abs(result[beatStart - 1].midiNumber - (result[beatStart]?.midiNumber || result[beatStart - 1].midiNumber)) <= 1));

    const zoneStart = canAnticipate ? beatStart - 1 : (anchor.hasLeadingRest ? Math.min(beatEnd - 1, beatStart + 1) : beatStart);
    const nextAct = result.find((s, idx) => idx >= beatStart && s.active && s.midiNumber > 0);
    const prevAct = result.slice(0, beatStart).reverse().find((s) => s.active && s.midiNumber > 0);
    const fbMidi = nextAct?.midiNumber ?? prevAct?.midiNumber ?? 60;
    for (let i = zoneStart; i < beatEnd; i++) {
      if (!result[i].active || result[i].midiNumber <= 0) result[i] = { ...result[i], active: true, midiNumber: fbMidi, note: '───', isTie: true };
    }

    const availSpan = Math.max(1, beatEnd - zoneStart), targetHeads = Math.min(syls.length, availSpan);
    const heads: number[] = [zoneStart];
    if (targetHeads === 2) {
      let bestIdx = nextAnchor?.hasLeadingRest ? Math.max(zoneStart + 1, beatEnd - 1) : zoneStart + Math.max(1, Math.floor(availSpan / 2));
      let bestScore = -1;
      for (let i = zoneStart + 1; i < beatEnd; i++) {
        const jump = Math.abs(result[i].midiNumber - result[i - 1].midiNumber) + (origAttacks[i] ? 1.5 : 0) + (nextAnchor?.hasLeadingRest && i === beatEnd - 1 ? 0.8 : 0);
        if (jump > bestScore) { bestScore = jump; bestIdx = i; }
      }
      heads.push(bestIdx);
    } else if (targetHeads >= 3) {
      for (let k = 1; k < targetHeads; k++) heads.push(zoneStart + Math.min(availSpan - 1, Math.floor((k * availSpan) / targetHeads)));
    }

    for (let k = 0; k < heads.length - 1; k++) result[heads[k]].syllable = syls[k];
    result[heads[heads.length - 1]].syllable = syls.slice(heads.length - 1).join('');
  }

  // Passe finale 1:1 : seules les étapes porteuses d'une syllabe sont des têtes de brique (0 brique '-' parasite)
  let seenFirstBrick = false;
  for (let i = 0; i < result.length; i++) {
    const hasSyl = Boolean(result[i].syllable && result[i].syllable.trim() !== '');
    if (hasSyl) {
      seenFirstBrick = true;
      const m = result[i].midiNumber > 0 ? result[i].midiNumber : 60;
      result[i] = { ...result[i], active: true, midiNumber: m, note: midiToNoteName(m), isTie: false, syllableAttack: true };
    } else if (result[i].active) {
      if (seenFirstBrick && i > 0 && result[i - 1].active && result[i - 1].midiNumber > 0) {
        result[i] = { ...result[i], active: true, midiNumber: result[i - 1].midiNumber, note: '───', isTie: true, syllable: '', syllableAttack: false };
      } else {
        result[i] = { ...result[i], active: false, midiNumber: 0, note: '', isTie: false, syllable: '', syllableAttack: false };
      }
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
