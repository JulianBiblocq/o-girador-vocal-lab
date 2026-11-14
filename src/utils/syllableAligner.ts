/**
 * syllableAligner.ts — Alignement v2 des syllabes, silences (`0`), tenues (`───`) et mélismes legato (`_`) (< 138 lignes).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { computeBeatSyllableSubdivs } from './subbeatAnchorHelper';
import { mergeSyllablesToImpulseCount } from './syllableImpulseMerger';
import { midiToNoteName } from './noteUtils';
import { mapSyllablesToSteps, assignSyllablesStrictlyToExistingBricks, reconstructWordsFromSteps } from './syllableStepMapper';

export { mapSyllablesToSteps, assignSyllablesStrictlyToExistingBricks, reconstructWordsFromSteps };

export function alignSyllablesWithTimeAnchors(steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4): VocalStepData[] {
  if (!timeAnchors || timeAnchors.length === 0) return steps;
  const maxStepNeeded = timeAnchors.reduce((max, a) => Math.max(max, (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat + stepsPerBeat), steps.length);
  const result: VocalStepData[] = Array.from({ length: maxStepNeeded }, (_, i) => steps[i] ? { ...steps[i], syllable: '' } : { stepIndex: i, active: false, note: '', midiNumber: null, velocity: 100, decay: 200, syllable: '' });
  let seenSung = false, lastPitch = 'C4', lastMidi = 60;

  for (const anchor of timeAnchors) {
    const stepStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat, stepEnd = Math.min(result.length, stepStart + stepsPerBeat);
    if (anchor.isRest || anchor.isInitialRest) {
      for (let s = stepStart; s < stepEnd; s++) result[s] = { ...result[s], active: false, isTie: false, isMelisma: false, syllableAttack: false, note: '', midiNumber: null, syllable: '' };
      continue;
    }
    if (anchor.isSustainedHold) {
      if (!seenSung) continue;
      for (let s = stepStart; s < stepEnd; s++) {
        const orig = steps[s], hasPitchChange = Boolean(orig?.active && orig.note && orig.note !== '───' && orig.note !== lastPitch);
        if (hasPitchChange) {
          lastPitch = orig.note; lastMidi = orig.midiNumber ?? lastMidi;
          result[s] = { ...result[s], active: true, note: lastPitch, midiNumber: lastMidi, isTie: false, isMelisma: true, syllableAttack: false, syllable: '_' };
        } else result[s] = { ...result[s], active: true, note: '───', midiNumber: lastMidi, isTie: true, isMelisma: false, syllableAttack: false, syllable: '' };
      }
      continue;
    }
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;
    const subdivs = anchor.syllableSubdivs?.length === syls.length ? anchor.syllableSubdivs : computeBeatSyllableSubdivs(anchor.textSlice || '', syls, Boolean(anchor.hasLeadingRest), Boolean(anchor.hasTrailingPickup));
    const firstSub = anchor.isDownbeatLocked ? 0 : Math.max(0, Math.min(stepsPerBeat - 1, subdivs[0] ?? (anchor.hasLeadingRest ? 1 : 0)));
    const tiePrev = !anchor.hasLeadingRest && !anchor.isDownbeatLocked && seenSung && stepStart > 0 && result[stepStart - 1].active;
    for (let s = stepStart; s < stepStart + firstSub && s < stepEnd; s++) result[s] = { ...result[s], active: tiePrev, note: tiePrev ? '───' : '', midiNumber: tiePrev ? lastMidi : null, isTie: tiePrev, isMelisma: false, syllableAttack: false, syllable: '' };
    for (let s = stepStart + firstSub; s < stepEnd; s++) result[s] = { ...result[s], active: true, note: '───', midiNumber: lastMidi, isTie: true, isMelisma: false, syllableAttack: false, syllable: '' };
    for (let sIdx = 0; sIdx < syls.length; sIdx++) {
      const targetStep = Math.min(stepEnd - 1, stepStart + (subdivs[sIdx] ?? Math.min(stepsPerBeat - 1, firstSub + sIdx)));
      const orig = steps[targetStep], isMel = syls[sIdx].trim() === '_';
      const note = orig?.note && orig.note !== '───' ? orig.note : lastPitch, midi = orig?.midiNumber && orig.midiNumber > 0 ? orig.midiNumber : lastMidi;
      if (isMel && note === lastPitch && seenSung) result[targetStep] = { ...result[targetStep], active: true, note: '───', midiNumber: lastMidi, isTie: true, isMelisma: false, syllableAttack: false, syllable: '' };
      else { lastPitch = note; lastMidi = midi; result[targetStep] = { ...result[targetStep], active: true, isTie: false, isMelisma: isMel, syllableAttack: !isMel, note, midiNumber: midi, syllable: isMel ? '_' : syls[sIdx] }; }
    }
    seenSung = true;
  }
  return result;
}

export function alignAudioStepsWithTimeAnchors(steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4): VocalStepData[] {
  const origActive = steps.map((s) => Boolean(s.active && (s.midiNumber ?? 0) > 0));
  const origAttacks = steps.map((s) => Boolean(s.active && s.syllableAttack === true && !s.isTie && s.note !== '───'));
  const result = steps.map((s) => ({ ...s, syllable: '', note: s.active ? '───' : '', isTie: s.active, isMelisma: false, syllableAttack: false }));
  let seenSung = false, lastSungBeatEnd = 0;

  for (let aIdx = 0; aIdx < timeAnchors.length; aIdx++) {
    const anchor = timeAnchors[aIdx], beatStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat, beatEnd = Math.min(result.length, beatStart + stepsPerBeat);
    if (beatStart >= result.length) continue;
    if (anchor.isRest || anchor.isInitialRest) {
      for (let i = beatStart; i < beatEnd; i++) result[i] = { ...result[i], active: false, note: '', midiNumber: null, isTie: false, isMelisma: false, syllable: '' };
      continue;
    }
    if (anchor.isSustainedHold) { if (seenSung) lastSungBeatEnd = Math.max(lastSungBeatEnd, beatEnd); continue; }
    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;

    const detectedHeads: number[] = [];
    for (let i = beatStart + (anchor.hasLeadingRest ? 1 : 0); i < beatEnd; i++) if (origAttacks[i]) detectedHeads.push(i);
    const forceExplicit = Boolean((anchor.hasLeadingRest || anchor.isDownbeatLocked || anchor.textSlice?.includes('_')) && anchor.syllableSubdivs?.length === syls.length);
    const useDetected = !forceExplicit && detectedHeads.length >= 1 && detectedHeads.length <= syls.length;
    const subdivs = useDetected ? detectedHeads.map((h) => h - beatStart) : (anchor.syllableSubdivs?.length === syls.length ? anchor.syllableSubdivs : computeBeatSyllableSubdivs(anchor.textSlice || '', syls, Boolean(anchor.hasLeadingRest), Boolean(anchor.hasTrailingPickup)));
    const firstSub = anchor.isDownbeatLocked ? 0 : Math.max(0, Math.min(stepsPerBeat - 1, subdivs[0] ?? (anchor.hasLeadingRest ? 1 : 0)));
    const nextAct = result.find((s, idx) => idx >= beatStart && s.active && (s.midiNumber ?? 0) > 0);
    const prevAct = result.slice(0, beatStart).reverse().find((s) => s.active && (s.midiNumber ?? 0) > 0);
    const fbMidi = nextAct?.midiNumber ?? prevAct?.midiNumber ?? 60;
    const tiePrev = !anchor.hasLeadingRest && !anchor.isDownbeatLocked && seenSung && beatStart > 0 && result[beatStart - 1].active;

    for (let i = beatStart; i < beatStart + firstSub && i < beatEnd; i++) result[i] = tiePrev ? { ...result[i], active: true, note: '───', midiNumber: result[beatStart - 1].midiNumber || fbMidi, isTie: true, syllable: '' } : { ...result[i], active: false, note: '', midiNumber: null, isTie: false, syllable: '' };
    for (let i = beatStart + firstSub; i < beatEnd; i++) if (!result[i].active || (result[i].midiNumber ?? 0) <= 0) result[i] = { ...result[i], active: true, midiNumber: fbMidi, note: '───', isTie: true };
    const heads = useDetected ? detectedHeads : (() => {
      const maxH = Math.min(syls.length, stepsPerBeat - firstSub), h: number[] = [];
      for (let k = 0; k < maxH; k++) {
        const pH = h.length > 0 ? h[h.length - 1] - beatStart : firstSub - 1;
        h.push(Math.min(beatEnd - 1, beatStart + Math.max(pH + 1, Math.min(stepsPerBeat - (maxH - k), subdivs[k] ?? (firstSub + k)))));
      }
      return h;
    })();
    if (heads.length > 0) {
      const mergedSyls = syls.length > heads.length ? mergeSyllablesToImpulseCount(syls, heads.length) : syls;
      for (let k = 0; k < heads.length; k++) result[heads[k]].syllable = mergedSyls[k] ?? '';
    }
    seenSung = true; lastSungBeatEnd = Math.max(lastSungBeatEnd, beatEnd);
  }

  let seenFirstBrick = false;
  for (let i = 0; i < result.length; i++) {
    const trimmed = (result[i].syllable || '').trim();
    if (trimmed !== '') {
      seenFirstBrick = true; const m = (result[i].midiNumber ?? 0) > 0 ? result[i].midiNumber! : 60, isMel = trimmed === '_';
      result[i] = { ...result[i], active: true, midiNumber: m, note: midiToNoteName(m), isTie: false, isMelisma: isMel, syllableAttack: !isMel };
    } else if (result[i].active) {
      const keepTie = seenFirstBrick && i > 0 && result[i - 1].active && (result[i - 1].midiNumber ?? 0) > 0 && (i < lastSungBeatEnd || origActive[i]);
      result[i] = keepTie ? { ...result[i], active: true, midiNumber: result[i - 1].midiNumber, note: '───', isTie: true, isMelisma: false, syllable: '', syllableAttack: false } : { ...result[i], active: false, midiNumber: null, note: '', isTie: false, isMelisma: false, syllable: '', syllableAttack: false };
    }
  }
  return result;
}

export function applyLyricsSyllablesToSteps(steps: VocalStepData[], lyricsText?: string, timeAnchors?: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4): VocalStepData[] {
  if (timeAnchors && timeAnchors.length > 0) {
    return steps.some((s) => s.active && (s.midiNumber ?? 0) > 0 && s.decay < 10) ? alignAudioStepsWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat) : alignSyllablesWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat);
  }
  return (!lyricsText || !lyricsText.trim()) ? steps : assignSyllablesStrictlyToExistingBricks(steps, lyricsText);
}
