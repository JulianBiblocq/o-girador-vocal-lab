/**
 * anacrusisTimingHelper.ts
 * Source de vérité unique pour le calcul des offsets et durées
 * avec ou sans anacrouse (hasAnacrusis) dans tout le lab vocal.
 */

/**
 * Marge de sécurité avant le Temps 1 en mode "Sans anacrouse" (0.15s = 150ms)
 * pour ne jamais couper la consonne d'attaque sur le Temps 1.
 */
export const NO_ANACRUSIS_PRE_MARGIN_SEC = 0.15;

/**
 * Retourne le décalage temporel du Temps 1 dans le buffer audio utile.
 * Si explicitT1OffsetSec est fourni (issu du Slicer ou du recordingResult),
 * il est utilisé directement comme source unique de vérité absolue.
 */
export function getPatternT1OffsetSec(
  hasAnacrusis: boolean | undefined,
  measureDurationSec: number,
  explicitT1OffsetSec?: number | null
): number {
  if (typeof explicitT1OffsetSec === 'number' && Number.isFinite(explicitT1OffsetSec)) {
    return explicitT1OffsetSec;
  }
  return hasAnacrusis === false ? NO_ANACRUSIS_PRE_MARGIN_SEC : measureDurationSec;
}

/**
 * Calcule la durée totale théorique d'un bloc de chant (T1 offset + N mesures + extraEndBeatsSec + post-roll).
 */
export function getPatternTotalDurationSec(
  hasAnacrusis: boolean | undefined,
  measuresCount: number,
  measureDurationSec: number,
  postRollSec = 0.25,
  extraEndBeatsSec = 0,
  explicitT1OffsetSec?: number | null
): number {
  const t1Offset = getPatternT1OffsetSec(hasAnacrusis, measureDurationSec, explicitT1OffsetSec);
  return t1Offset + measuresCount * measureDurationSec + extraEndBeatsSec + postRollSec;
}

/**
 * Calcule le nombre exact de temps d'anacrouse (levée avant M1•T1) d'un pattern.
 */
export function resolvePatternAnacrusisBeats(
  pattern: {
    hasAnacrusis?: boolean;
    anacrusisBeats?: number;
    timeAnchors?: Array<{ measureOffset: number; beat: number; isRest?: boolean; isInitialRest?: boolean }>;
  } | null | undefined,
  beatsPerMeasure = 4
): number {
  if (!pattern || pattern.hasAnacrusis === false) return 0;
  if (typeof pattern.anacrusisBeats === 'number' && pattern.anacrusisBeats > 0) {
    return Math.min(beatsPerMeasure, pattern.anacrusisBeats);
  }
  const anaAnchors = (pattern.timeAnchors || []).filter(
    (a) => a.measureOffset === 0 && !a.isRest && !a.isInitialRest && a.beat >= 1 && a.beat <= beatsPerMeasure
  );
  if (anaAnchors.length > 0) {
    const minBeat = Math.min(...anaAnchors.map((a) => a.beat));
    return Math.max(1, beatsPerMeasure + 1 - minBeat);
  }
  return Math.min(2, beatsPerMeasure);
}
