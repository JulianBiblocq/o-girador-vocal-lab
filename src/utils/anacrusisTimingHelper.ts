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
 */
export function getPatternT1OffsetSec(
  hasAnacrusis: boolean | undefined,
  measureDurationSec: number
): number {
  return hasAnacrusis === false ? NO_ANACRUSIS_PRE_MARGIN_SEC : measureDurationSec;
}

/**
 * Calcule la durée totale théorique d'un bloc de chant (T1 offset + N mesures + post-roll).
 */
export function getPatternTotalDurationSec(
  hasAnacrusis: boolean | undefined,
  measuresCount: number,
  measureDurationSec: number,
  postRollSec = 0.25
): number {
  const t1Offset = getPatternT1OffsetSec(hasAnacrusis, measureDurationSec);
  return t1Offset + measuresCount * measureDurationSec + postRollSec;
}
