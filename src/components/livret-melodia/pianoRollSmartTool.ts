/**
 * pianoRollSmartTool.ts
 * Logique pure du « Smart Tool » façon Cubase VariAudio au Livret 4 (< 138 lignes) :
 * Sous-zones intelligentes (Cœur MIDI, Haut ◆ VariAudio, Bas ✂ Scission >= 44px, Droite ↔ Tenue >= 44px,
 * Interstice [Lier] ─── ou Mélisme `_` legato, Double-clic médiane verte / création note vide).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';
import { getStepHorizontalBoundsPx, getStepTimeWindowSec } from '../../utils/tripletBeatHelper';
import { midiToRowY } from './PianoRollKeyboard';
import { isOnBrickVariAudioHandle } from './pianoRollBricksDrawer';
import { findBrickRange, moveBrick } from './pianoRollInteractions';

export const SMART_TOOL_MIN_BRICK_WIDTH_PX = 44;
export type SmartToolZoneType = 'empty' | 'move_body' | 'variaudio_top' | 'split_bottom' | 'resize_right' | 'link_gap';

export interface BrickLinkCandidate {
  leftRootIndex: number; leftEndIndex: number; rightRootIndex: number;
  x: number; y: number; isMelisma: boolean;
}

export interface SmartToolHoverState {
  zone: SmartToolZoneType; cursor: string;
  rootIndex: number | null; endIndex: number | null; splitStepIndex: number | null;
  linkCandidate: BrickLinkCandidate | null;
}

export function findAdjacentBrickLinkCandidates(allSteps: VocalStepData[], width: number, maxMidi: number, rowHeight: number): BrickLinkCandidate[] {
  const out: BrickLinkCandidate[] = [];
  if (!allSteps.length || width <= 0) return out;
  for (let i = 0; i < allSteps.length; ) {
    const s = allSteps[i];
    if (!s.active || s.note === '───' || s.tripletSlot === 'unused') { i++; continue; }
    const r1 = findBrickRange(allSteps, i);
    if (!r1) { i++; continue; }
    let nextIdx = r1.endIndex + 1, gap = 0;
    while (nextIdx < allSteps.length && !allSteps[nextIdx].active) { if (allSteps[nextIdx].tripletSlot !== 'unused') gap++; nextIdx++; }
    if (nextIdx < allSteps.length && gap <= 1) {
      const r2 = findBrickRange(allSteps, nextIdx);
      if (r2) {
        const b1 = getStepHorizontalBoundsPx(allSteps, r1.rootIndex, width), b2 = getStepHorizontalBoundsPx(allSteps, r2.rootIndex, width);
        const m1 = allSteps[r1.rootIndex].midiNumber ?? 60, m2 = allSteps[r2.rootIndex].midiNumber ?? 60;
        const y1 = midiToRowY(m1, maxMidi, rowHeight) + rowHeight / 2, y2 = midiToRowY(m2, maxMidi, rowHeight) + rowHeight / 2;
        out.push({ leftRootIndex: r1.rootIndex, leftEndIndex: r1.endIndex, rightRootIndex: r2.rootIndex, x: (b1.xPx + b1.widthPx + b2.xPx) / 2, y: m1 !== m2 ? (y1 + y2) / 2 : y1 - rowHeight * 0.44, isMelisma: m1 !== m2 });
      }
    }
    i = r1.endIndex + 1;
  }
  return out;
}

export function resolveSmartToolHoverZone(params: {
  x: number; y: number; stepIdx: number; allSteps: VocalStepData[]; width: number; maxMidi: number; rowHeight: number;
  selectedStepIdx?: number | null; foldNotesView?: boolean;
}): SmartToolHoverState {
  const { x, y, stepIdx, allSteps, width, maxMidi, rowHeight, selectedStepIdx, foldNotesView = false } = params;
  const stepW = width / Math.max(1, allSteps.length);
  if (!foldNotesView) {
    for (const c of findAdjacentBrickLinkCandidates(allSteps, width, maxMidi, rowHeight)) {
      if (Math.abs(x - c.x) <= 10 && Math.abs(y - c.y) <= 9) {
        return { zone: 'link_gap', cursor: 'pointer', rootIndex: c.leftRootIndex, endIndex: c.leftEndIndex, splitStepIndex: null, linkCandidate: c };
      }
    }
  }
  const range = findBrickRange(allSteps, stepIdx);
  if (!range) return { zone: 'empty', cursor: 'default', rootIndex: null, endIndex: null, splitStepIndex: null, linkCandidate: null };

  const bounds = getStepHorizontalBoundsPx(allSteps, range.rootIndex, width), bx = bounds.xPx, bw = Math.max(4, bounds.widthPx - 2);
  const rootMidi = allSteps[range.rootIndex].midiNumber ?? 60, by = midiToRowY(rootMidi, maxMidi, rowHeight) + 1.5, bh = Math.max(4, rowHeight - 3);
  const isSelected = selectedStepIdx !== null && selectedStepIdx !== undefined && selectedStepIdx >= range.rootIndex && selectedStepIdx <= range.endIndex;
  const canUseEdgeSubzones = bounds.widthPx >= SMART_TOOL_MIN_BRICK_WIDTH_PX || isSelected;

  if (!foldNotesView && isOnBrickVariAudioHandle(x, y, range.rootIndex, range.endIndex, rootMidi, stepW, maxMidi, rowHeight, allSteps)) {
    return { zone: 'variaudio_top', cursor: 'ns-resize', rootIndex: range.rootIndex, endIndex: range.endIndex, splitStepIndex: null, linkCandidate: null };
  }
  if (canUseEdgeSubzones && (foldNotesView || (y >= by - 3 && y <= by + bh + 4)) && x >= bx + bw - 8 && x <= bx + bw + 3) {
    return { zone: 'resize_right', cursor: 'ew-resize', rootIndex: range.rootIndex, endIndex: range.endIndex, splitStepIndex: null, linkCandidate: null };
  }
  if (!foldNotesView && canUseEdgeSubzones && range.endIndex > range.rootIndex && y >= by + bh * 0.54 && y <= by + bh + 4) {
    let bestSplit: number | null = stepIdx > range.rootIndex && stepIdx <= range.endIndex ? stepIdx : null;
    for (let k = range.rootIndex + 1; k <= range.endIndex; k++) {
      if (allSteps[k].tripletSlot !== 'unused' && Math.abs(x - getStepHorizontalBoundsPx(allSteps, k, width, false).xPx) <= 7) { bestSplit = k; break; }
    }
    if (bestSplit !== null) return { zone: 'split_bottom', cursor: 'pointer', rootIndex: range.rootIndex, endIndex: range.endIndex, splitStepIndex: bestSplit, linkCandidate: null };
  }
  return { zone: 'move_body', cursor: foldNotesView ? 'pointer' : 'grab', rootIndex: range.rootIndex, endIndex: range.endIndex, splitStepIndex: null, linkCandidate: null };
}

export function linkAdjacentBricksSmart(steps: VocalStepData[], leftRootIndex: number, rightRootIndex: number): VocalStepData[] {
  const r1 = findBrickRange(steps, leftRootIndex), r2 = findBrickRange(steps, rightRootIndex);
  if (!r1 || !r2 || r2.rootIndex <= r1.rootIndex) return steps;
  const next = steps.map((s) => ({ ...s })), midi1 = next[r1.rootIndex].midiNumber ?? 60, midi2 = next[r2.rootIndex].midiNumber ?? 60;
  for (let g = r1.endIndex + 1; g < r2.rootIndex; g++) {
    if (next[g].tripletSlot !== 'unused') next[g] = { ...next[g], active: true, midiNumber: midi1, note: '───', isTie: true, isMelisma: false, syllable: '', syllableAttack: false, velocity: 90 };
  }
  if (midi1 === midi2) {
    const s1 = next[r1.rootIndex].syllable ?? '', s2 = (next[r2.rootIndex].syllable ?? '').trim();
    const mergedSyl = s2 && s2 !== '_' ? (s1.endsWith(' ') ? `${s1}${s2}` : `${s1.trim()}${s2}`) : s1;
    next[r1.rootIndex] = { ...next[r1.rootIndex], syllable: mergedSyl };
    for (let i = r2.rootIndex; i <= r2.endIndex; i++) {
      if (next[i].tripletSlot !== 'unused') next[i] = { ...next[i], active: true, midiNumber: midi1, note: '───', isTie: true, isMelisma: false, syllable: '', syllableAttack: false, velocity: 90 };
    }
  } else {
    next[r2.rootIndex] = { ...next[r2.rootIndex], active: true, midiNumber: midi2, note: midiToNoteName(midi2), isTie: false, syllable: '_', isMelisma: true, syllableAttack: false };
  }
  return next;
}

export function snapSingleBrickToGreenMedian(
  steps: VocalStepData[], rootIndex: number, rawPitchCurve: PitchCurvePoint[],
  tGridStart: number, beatDurSec: number, allowedPitchClasses?: Set<number> | null
): VocalStepData[] {
  const range = findBrickRange(steps, rootIndex);
  if (!range || !rawPitchCurve.length) return steps;
  const { startSec, endSec } = getStepTimeWindowSec(steps, range.rootIndex, tGridStart, beatDurSec);
  const vals = rawPitchCurve.filter((p) => p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat > 24).map((p) => p.midiFloat).sort((a, b) => a - b);
  if (!vals.length) return steps;
  const trim = Math.floor(vals.length * 0.2), slice = vals.slice(trim, Math.max(trim + 1, vals.length - trim));
  let targetMidi = Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  if (allowedPitchClasses && allowedPitchClasses.size > 0 && !allowedPitchClasses.has(((targetMidi % 12) + 12) % 12)) {
    let best = targetMidi, bestDist = 99;
    for (let d = -6; d <= 6; d++) { const cand = targetMidi + d; if (allowedPitchClasses.has(((cand % 12) + 12) % 12) && Math.abs(d) < bestDist) { best = cand; bestDist = Math.abs(d); } }
    targetMidi = best;
  }
  return moveBrick(steps, range.rootIndex, targetMidi);
}
