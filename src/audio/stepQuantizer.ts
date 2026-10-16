/**
 * stepQuantizer.ts
 * Re-export pour compatibilité descendante avec LivretPrise et LivretMelodia (< 20 lignes).
 */
export type { QuantizerParams, QuantizedGridResult } from './pitchToStepsQuantizer';
export { quantizePitchToSteps } from './pitchToStepsQuantizer';
