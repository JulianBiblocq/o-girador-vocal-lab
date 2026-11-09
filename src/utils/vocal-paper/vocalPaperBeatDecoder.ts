/**
 * vocalPaperBeatDecoder.ts
 * Décodage universel des 8 colonnes de temps libres (32 subdivisions) des Feuilles 2 (CHANT-NOTES) et 3 (CHANT-RYTHME) (< 120 lignes).
 * Déduit les temps 1..4 par continuité modulo 4, découpe Anacrouse (1..3T) / Mesures (1M/2M) / Chute (+T1) et fusionne les lignes P__ identiques.
 */
import type { ScannedVocalPatternBlock, ScannedVocalStepCell } from '../../types/vocalPaperWorkshop.types';

function parseBeatDigit(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const m = String(val).trim().match(/[1-4]/);
  return m ? Number(m[0]) : null;
}

export function isCellActive(c?: ScannedVocalStepCell | null): boolean {
  if (!c) return false;
  const s = (c.syllable || '').trim();
  return Boolean(c.isTie || (c.pitchKey && String(c.pitchKey).trim()) || (c.durationSteps && c.durationSteps > 0) || (s && s !== '_'));
}

export function resolveEightBeatNumbers(beatNumbers?: Array<number | string | null>): number[] {
  const raw = Array.from({ length: 8 }, (_, i) => parseBeatDigit(beatNumbers?.[i]));
  const anchorIdx = raw.findIndex((v) => v !== null);
  if (anchorIdx < 0) return [1, 2, 3, 4, 1, 2, 3, 4];
  const anchorVal = raw[anchorIdx]!;
  return raw.map((explicit, c) => explicit ?? ((((anchorVal - 1) + (c - anchorIdx)) % 4 + 4) % 4 + 1));
}

export type CanonicalScannedPatternBlock = ScannedVocalPatternBlock & {
  anacrusisTotalSteps?: number;
  anacrusisBeatsCount?: number;
};

export function normalizeScannedBlockToCanonical(block: CanonicalScannedPatternBlock): CanonicalScannedPatternBlock {
  const hasFreeGrid = Array.isArray(block.beatNumbers) || Array.isArray(block.cells);
  if (!hasFreeGrid) {
    const hasAna = Array.isArray(block.anacrusisCells) && block.anacrusisCells.some(isCellActive);
    const hasTail = Array.isArray(block.tailCells) && block.tailCells.some(isCellActive);
    const maxAnaIdx = (block.anacrusisCells || []).reduce((m, c) => Math.max(m, c?.stepIndex ?? 0), 0);
    return {
      ...block,
      measuresCount: (block.measuresCount || 1) as 1 | 2 | 3 | 4,
      hasAnacrusis: hasAna,
      hasTailBeat: hasTail,
      anacrusisTotalSteps: block.anacrusisTotalSteps ?? (maxAnaIdx >= 8 ? 16 : 8),
      anacrusisBeatsCount: block.anacrusisBeatsCount ?? (hasAna ? 2 : 0),
    };
  }

  const rawBeats = Array.from({ length: 8 }, (_, i) => parseBeatDigit(block.beatNumbers?.[i]));
  const resolvedBeats = resolveEightBeatNumbers(block.beatNumbers);
  const srcCells = block.cells || block.mainCells || [];
  const stepMap = new Map<number, ScannedVocalStepCell>();
  for (const c of srcCells) if (c && typeof c.stepIndex === 'number') stepMap.set(c.stepIndex, { ...c });
  for (const c of srcCells) if (c && typeof c.stepIndex === 'number' && c.durationSteps && c.durationSteps > 1) {
    for (let k = 1; k < c.durationSteps; k++) if (c.stepIndex + k < 32 && !stepMap.has(c.stepIndex + k)) stepMap.set(c.stepIndex + k, { stepIndex: c.stepIndex + k, isTie: true, syllable: '───' });
  }
  const beatHasActive = (b: number) => [0, 1, 2, 3].some((s) => isCellActive(stepMap.get(b * 4 + s)));
  const firstT1 = resolvedBeats.indexOf(1), startB = firstT1 >= 0 ? firstT1 : 0, noCells = srcCells.length === 0;

  const anacrusisCells: ScannedVocalStepCell[] = [];
  const activeAnaCols = Array.from({ length: startB }, (_, b) => b).filter(beatHasActive);
  const hasAnacrusis = startB > 0 && (activeAnaCols.length > 0 || Boolean(block.hasAnacrusis) || noCells);
  if (hasAnacrusis) {
    for (let b = 0; b < startB; b++) {
      const beatNum = resolvedBeats[b];
      for (let s = 0; s < 4; s++) {
        const cell = stepMap.get(b * 4 + s);
        if (cell) anacrusisCells.push({ ...cell, stepIndex: (beatNum - 1) * 4 + s });
      }
    }
  }
  const firstAnaBeatNum = activeAnaCols.length > 0 ? resolvedBeats[activeAnaCols[0]] : resolvedBeats[0];
  const anacrusisBeatsCount = hasAnacrusis ? Math.max(1, 5 - firstAnaBeatNum) : 0;

  let measuresCount: 1 | 2 | 3 | 4 = 1, hasTailBeat = false, tailBeatCol = -1;
  if (startB === 0) {
    const secondHalfHas234 = [5, 6, 7].some((b) => beatHasActive(b) || (rawBeats[b] !== null && rawBeats[b]! >= 2));
    const tailOn4 = !secondHalfHas234 && (beatHasActive(4) || Boolean(block.hasTailBeat) || (noCells && rawBeats[4] === 1));
    if (tailOn4) { measuresCount = 1; hasTailBeat = true; tailBeatCol = 4; }
    else if (secondHalfHas234 || [4, 5, 6, 7].some(beatHasActive)) { measuresCount = 2; }
  } else {
    const cand = startB + 4;
    const laterHas234 = cand < 8 && Array.from({ length: 8 - (cand + 1) }, (_, k) => cand + 1 + k).some(beatHasActive);
    if (cand < 8 && resolvedBeats[cand] === 1 && !laterHas234 && (beatHasActive(cand) || Boolean(block.hasTailBeat) || noCells)) {
      hasTailBeat = true; tailBeatCol = cand;
    }
  }

  const mainCells: ScannedVocalStepCell[] = [], tailCells: ScannedVocalStepCell[] = [];
  for (let bOff = 0; bOff < measuresCount * 4 && startB + bOff < 8; bOff++) {
    for (let s = 0; s < 4; s++) {
      const cell = stepMap.get((startB + bOff) * 4 + s);
      if (cell) mainCells.push({ ...cell, stepIndex: bOff * 4 + s });
    }
  }
  if (hasTailBeat && tailBeatCol >= 0) {
    for (let s = 0; s < 4; s++) {
      const cell = stepMap.get(tailBeatCol * 4 + s);
      if (cell) tailCells.push({ ...cell, stepIndex: s });
    }
  }
  return {
    ...block, beatNumbers: undefined, cells: undefined,
    measuresCount, hasAnacrusis, hasTailBeat, anacrusisCells, mainCells, tailCells,
    anacrusisTotalSteps: 16, anacrusisBeatsCount,
  };
}

export function mergeMultiLineScannedBlocks(blocks: ScannedVocalPatternBlock[]): CanonicalScannedPatternBlock[] {
  const mergedMap = new Map<string, CanonicalScannedPatternBlock>();
  for (const rawBlock of blocks) {
    const norm = normalizeScannedBlockToCanonical(rawBlock), key = (norm.code || 'P1').trim().toUpperCase();
    if (!mergedMap.has(key)) mergedMap.set(key, { ...norm, code: key });
    else {
      const prev = mergedMap.get(key)!, offsetSteps = (prev.measuresCount || 1) * 16;
      prev.mainCells = [...(prev.mainCells || []), ...(norm.mainCells || []).map((c) => ({ ...c, stepIndex: c.stepIndex + offsetSteps }))];
      prev.measuresCount = Math.min(4, (prev.measuresCount || 1) + (norm.measuresCount || 1)) as 1 | 2 | 3 | 4;
      if (norm.hasTailBeat) { prev.hasTailBeat = true; prev.tailCells = norm.tailCells; }
    }
  }
  return Array.from(mergedMap.values());
}
