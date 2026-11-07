/**
 * tripletBeatHelper.ts
 * Calculs géométriques, temporels et conversion intelligente Binaire ➔ Triolet ([ 3 ])
 * tout en préservant l'indexation canonique à 4 entrées par temps dans `steps` (< 130 lignes).
 */
import type { MelodicStep } from '../types/livret.types';
import { midiToNoteName } from './noteUtils';

const STEPS_PER_BEAT = 4;

export function isBeatTriplet(steps: MelodicStep[], beatStartStepIdx: number): boolean {
  if (!steps || beatStartStepIdx < 0 || beatStartStepIdx >= steps.length) return false;
  for (let i = beatStartStepIdx; i < Math.min(steps.length, beatStartStepIdx + STEPS_PER_BEAT); i++) {
    if (steps[i]?.tripletSlot !== undefined) return true;
  }
  return false;
}

export function getTripletBeatLabel(steps: MelodicStep[], beatStartIdx: number): string {
  if (!isBeatTriplet(steps, beatStartIdx)) return '3';
  const s0 = steps[beatStartIdx], s1 = steps[beatStartIdx + 1], s2 = steps[beatStartIdx + 2];
  const isOnset = (s?: MelodicStep) => Boolean(s?.active && !s.isTie && s.note !== '───');
  const isTie = (s?: MelodicStep) => Boolean(s?.active && (s.isTie || s.note === '───'));
  if (isOnset(s0) && isTie(s1) && isTie(s2)) return '³1───';
  return `³${[0, 1, 2].map((k) => (isOnset(steps[beatStartIdx + k]) ? String(k + 1) : '_')).join('-')}`;
}

export function applySmartTripletToBeat(steps: MelodicStep[], beatStartIdx: number): MelodicStep[] {
  if (!steps || beatStartIdx < 0 || beatStartIdx >= steps.length) return steps;
  const next = steps.map((s) => ({ ...s })), alreadyTriplet = isBeatTriplet(steps, beatStartIdx);
  const scanLen = Math.min(alreadyTriplet ? 3 : 4, steps.length - beatStartIdx);
  const fallbackMidi = steps.find((s) => s.active && s.midiNumber > 0)?.midiNumber ?? 60;
  const attackIndices: number[] = [], attacks: MelodicStep[] = [];
  for (let i = 0; i < scanLen; i++) {
    const st = steps[beatStartIdx + i];
    if (st && st.tripletSlot !== 'unused' && st.active && !st.isTie && st.note !== '───') { attackIndices.push(i); attacks.push(st); }
  }
  const isStepTie = (idx: number) => { const s = steps[beatStartIdx + idx]; return Boolean(s && s.tripletSlot !== 'unused' && s.active && (s.isTie || s.note === '───')); };

  let targetSlots: number[] = [0, 1, 2];
  if (attackIndices.length === 2) {
    const [i1, i2] = attackIndices;
    if (alreadyTriplet) targetSlots = i1 === 0 && i2 === 1 ? [0, 2] : i1 === 0 && i2 === 2 ? [1, 2] : [0, 1];
    else targetSlots = (i1 === 0 && i2 === 1) ? [0, 1] : (i1 === 0 && (i2 === 2 || i2 === 3)) ? [0, 2] : [1, 2];
  } else if (attackIndices.length === 1) {
    const i1 = attackIndices[0];
    targetSlots = alreadyTriplet ? [(i1 + 1) % 3] : i1 === 0 ? [0] : (i1 === 1 || i1 === 2) ? [1] : [2];
  }

  const assignedSyls: string[] = new Array(targetSlots.length).fill(''), rawSyls = attacks.map((a) => (a.syllable ?? '').trim());
  if (rawSyls.length <= targetSlots.length) {
    for (let k = 0; k < rawSyls.length; k++) assignedSyls[k] = rawSyls[k];
  } else {
    for (let k = 0; k < targetSlots.length - 1; k++) assignedSyls[k] = rawSyls[k];
    assignedSyls[targetSlots.length - 1] = rawSyls.slice(targetSlots.length - 1).join('');
  }

  const hadNonAttackTie = Array.from({ length: scanLen }, (_, i) => !attackIndices.includes(i) && isStepTie(i)).some(Boolean);
  const leadingTie = !attackIndices.includes(0) && isStepTie(0);
  const onsetMap = new Map<number, number>(targetSlots.map((slot, idx) => [slot, idx]));
  let curMidi = attacks[0]?.midiNumber || steps[beatStartIdx]?.midiNumber || fallbackMidi, seenOnset = false;

  for (let t = 0; t < 3 && beatStartIdx + t < next.length; t++) {
    const idx = beatStartIdx + t, base = next[idx], slot = (t + 1) as 1 | 2 | 3;
    if (onsetMap.has(t)) {
      const k = onsetMap.get(t)!, src = attacks[Math.min(k, Math.max(0, attacks.length - 1))];
      curMidi = src?.midiNumber > 0 ? src.midiNumber : curMidi; seenOnset = true;
      next[idx] = { ...base, tripletSlot: slot, active: true, isTie: false, midiNumber: curMidi, note: midiToNoteName(curMidi), syllable: assignedSyls[k] || '' };
    } else if ((!seenOnset && leadingTie) || (seenOnset && hadNonAttackTie)) {
      const tieMidi = !seenOnset ? (steps[beatStartIdx]?.midiNumber || curMidi) : curMidi;
      next[idx] = { ...base, tripletSlot: slot, active: true, isTie: true, midiNumber: tieMidi, note: '───', syllable: '' };
    } else {
      next[idx] = { ...base, tripletSlot: slot, active: false, isTie: false, midiNumber: 0, note: 'C4', syllable: '' };
    }
  }
  if (beatStartIdx + 3 < next.length) {
    next[beatStartIdx + 3] = { ...next[beatStartIdx + 3], tripletSlot: 'unused', active: false, isTie: false, midiNumber: 0, note: 'C4', syllable: '' };
  }
  return next;
}

function getSingleStepBeatSpan(steps: MelodicStep[], stepIdx: number) {
  const beatIndex = Math.floor(stepIdx / STEPS_PER_BEAT), beatStart = beatIndex * STEPS_PER_BEAT, subIdx = stepIdx - beatStart;
  if (isBeatTriplet(steps, beatStart)) {
    const slot = steps[stepIdx]?.tripletSlot ?? (subIdx === 0 ? 1 : subIdx === 1 ? 2 : subIdx === 2 ? 3 : 'unused');
    return (slot === 'unused' || subIdx >= 3) ? { beatIndex, startFrac: 1, endFrac: 1, hidden: true } : { beatIndex, startFrac: (slot - 1) / 3, endFrac: slot / 3, hidden: false };
  }
  return { beatIndex, startFrac: subIdx / STEPS_PER_BEAT, endFrac: (subIdx + 1) / STEPS_PER_BEAT, hidden: false };
}

export function findLastTiedStepIndex(steps: MelodicStep[], rootIdx: number): number {
  const root = steps[rootIdx];
  if (!root || !root.active || root.isTie || root.note === '───' || root.tripletSlot === 'unused') return rootIdx;
  let endIdx = rootIdx, k = rootIdx + 1;
  while (k < steps.length) {
    const st = steps[k];
    if (st.tripletSlot === 'unused') {
      if (k + 1 < steps.length && steps[k + 1].active && (steps[k + 1].isTie || steps[k + 1].note === '───')) { k++; continue; }
      break;
    }
    if (st.active && (st.isTie || st.note === '───')) { endIdx = k; k++; } else break;
  }
  return endIdx;
}

export function getStepTimeWindowSec(steps: MelodicStep[], stepIdx: number, tGridStartSec: number, beatDurationSec: number, includeTies = true) {
  if (!steps || stepIdx < 0 || stepIdx >= steps.length || beatDurationSec <= 0) return { startSec: tGridStartSec, endSec: tGridStartSec, durationSec: 0 };
  const first = getSingleStepBeatSpan(steps, stepIdx);
  if (first.hidden) { const u = tGridStartSec + (first.beatIndex + 1) * beatDurationSec; return { startSec: u, endSec: u, durationSec: 0 }; }
  const endStepIdx = includeTies ? findLastTiedStepIndex(steps, stepIdx) : stepIdx, last = endStepIdx > stepIdx ? getSingleStepBeatSpan(steps, endStepIdx) : first;
  const startSec = tGridStartSec + (first.beatIndex + first.startFrac) * beatDurationSec, endSec = tGridStartSec + (last.beatIndex + last.endFrac) * beatDurationSec;
  return { startSec, endSec, durationSec: Math.max(0, endSec - startSec) };
}

export function getStepHorizontalBoundsPx(steps: MelodicStep[], stepIdx: number, gridWidthPx: number, includeTies = true) {
  if (!steps || steps.length === 0 || stepIdx < 0 || stepIdx >= steps.length || gridWidthPx <= 0) return { xPx: 0, widthPx: 0, hidden: true };
  const beatWidthPx = gridWidthPx / Math.max(1, steps.length / STEPS_PER_BEAT), first = getSingleStepBeatSpan(steps, stepIdx);
  if (first.hidden) return { xPx: (first.beatIndex + 1) * beatWidthPx, widthPx: 0, hidden: true };
  const endStepIdx = includeTies ? findLastTiedStepIndex(steps, stepIdx) : stepIdx, last = endStepIdx > stepIdx ? getSingleStepBeatSpan(steps, endStepIdx) : first;
  const xPx = (first.beatIndex + first.startFrac) * beatWidthPx, rightPx = (last.beatIndex + last.endFrac) * beatWidthPx;
  return { xPx, widthPx: Math.max(0, rightPx - xPx), hidden: false };
}

export function resolveStepIndexAtXPx(steps: MelodicStep[], xPx: number, gridWidthPx: number, resPerBeat = STEPS_PER_BEAT): number {
  if (!steps || steps.length === 0 || gridWidthPx <= 0) return 0;
  const totalBeats = Math.max(1, Math.floor(steps.length / resPerBeat)), beatWidthPx = gridWidthPx / totalBeats;
  const clampedX = Math.max(0, Math.min(gridWidthPx - 0.001, xPx));
  const beatIdx = Math.min(totalBeats - 1, Math.floor(clampedX / beatWidthPx)), beatStart = beatIdx * resPerBeat;
  const relFrac = Math.max(0, Math.min(0.9999, (clampedX - beatIdx * beatWidthPx) / beatWidthPx));
  return Math.min(steps.length - 1, beatStart + (isBeatTriplet(steps, beatStart) ? Math.min(2, Math.floor(relFrac * 3)) : Math.min(resPerBeat - 1, Math.floor(relFrac * resPerBeat))));
}
