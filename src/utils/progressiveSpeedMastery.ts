/**
 * progressiveSpeedMastery.ts
 * Gestionnaire de progression par paliers de vitesse (75 % ➔ 88 % ➔ 100 %) et maîtrise élève (< 120 lignes).
 * Persistance localStorage : ogirador_cantador_student_mastery_v1 par (toadaId, patternId).
 */

export const PROGRESSIVE_SPEED_TIERS = [0.75, 0.88, 1.0] as const;
export type ProgressiveSpeedRatio = (typeof PROGRESSIVE_SPEED_TIERS)[number];
export const STUDENT_MASTERY_STORAGE_KEY = 'ogirador_cantador_student_mastery_v1';

export interface PatternSpeedMastery {
  tier75: boolean;
  tier88: boolean;
  tier100: boolean;
  bestScorePct: number;
  updatedAt?: string;
}

export interface SpeedProgressionOutcome {
  updatedMastery: PatternSpeedMastery;
  nextSpeedRatio: number;
  unlockedTier: 75 | 88 | 100 | null;
  advancedToNextTier: boolean;
}

export function createEmptyPatternMastery(): PatternSpeedMastery {
  return { tier75: false, tier88: false, tier100: false, bestScorePct: 0 };
}

export function computeWeightedStudentScore(
  pitchAccuracyPct: number,
  attackPrecisionPct: number,
  stabilityPct: number
): number {
  return Math.max(0, Math.min(100, Math.round(0.45 * pitchAccuracyPct + 0.30 * attackPrecisionPct + 0.25 * stabilityPct)));
}

export function evaluateSpeedTierProgression(params: {
  currentSpeedRatio: number;
  weightedScorePct: number;
  autoProgressionEnabled?: boolean;
  previousMastery?: PatternSpeedMastery;
}): SpeedProgressionOutcome {
  const {
    currentSpeedRatio,
    weightedScorePct,
    autoProgressionEnabled = true,
    previousMastery = createEmptyPatternMastery(),
  } = params;

  const updatedMastery: PatternSpeedMastery = {
    tier75: Boolean(previousMastery.tier75),
    tier88: Boolean(previousMastery.tier88),
    tier100: Boolean(previousMastery.tier100),
    bestScorePct: Math.max(previousMastery.bestScorePct || 0, Math.round(weightedScorePct)),
    updatedAt: new Date().toISOString(),
  };

  let nextSpeedRatio = currentSpeedRatio;
  let unlockedTier: 75 | 88 | 100 | null = null;
  let advancedToNextTier = false;

  const isTier75 = Math.abs(currentSpeedRatio - 0.75) <= 0.04;
  const isTier88 = Math.abs(currentSpeedRatio - 0.88) <= 0.04 || Math.abs(currentSpeedRatio - 0.85) <= 0.02;
  const isTier100 = Math.abs(currentSpeedRatio - 1.0) <= 0.04;

  if (isTier75 && weightedScorePct >= 75) {
    updatedMastery.tier75 = true;
    unlockedTier = 75;
    if (autoProgressionEnabled) { nextSpeedRatio = 0.88; advancedToNextTier = true; }
  } else if (isTier88 && weightedScorePct >= 78) {
    updatedMastery.tier75 = true;
    updatedMastery.tier88 = true;
    unlockedTier = 88;
    if (autoProgressionEnabled) { nextSpeedRatio = 1.0; advancedToNextTier = true; }
  } else if (isTier100 && weightedScorePct >= 80) {
    updatedMastery.tier75 = true;
    updatedMastery.tier88 = true;
    updatedMastery.tier100 = true;
    unlockedTier = 100;
  }

  return { updatedMastery, nextSpeedRatio, unlockedTier, advancedToNextTier };
}

type MasteryStoreMap = Record<string, PatternSpeedMastery>;
const buildMasteryKey = (toadaId: string, patternId: string) => `${(toadaId || 'default').trim()}::${(patternId || 'default').trim()}`;

function readAllMasteryFromStorage(): MasteryStoreMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STUDENT_MASTERY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MasteryStoreMap) : {};
  } catch { return {}; }
}

export function loadPatternSpeedMastery(toadaId: string, patternId: string): PatternSpeedMastery {
  return readAllMasteryFromStorage()[buildMasteryKey(toadaId, patternId)] ?? createEmptyPatternMastery();
}

export function savePatternSpeedMastery(toadaId: string, patternId: string, mastery: PatternSpeedMastery): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = readAllMasteryFromStorage();
    all[buildMasteryKey(toadaId, patternId)] = mastery;
    localStorage.setItem(STUDENT_MASTERY_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function countMasteredPatternsInToada(toadaId: string, patternIds: string[]): { masteredCount: number; totalCount: number } {
  const all = readAllMasteryFromStorage();
  const masteredCount = patternIds.filter((pid) => all[buildMasteryKey(toadaId, pid)]?.tier100).length;
  return { masteredCount, totalCount: patternIds.length };
}
