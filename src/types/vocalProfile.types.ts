/**
 * vocalProfile.types.ts
 * Contrat d'interface VocalProfilePayload pour organizador et types d'Ambitus (< 50 lignes).
 */
export type TessitureType = 'basse' | 'baryton' | 'tenor' | 'alto' | 'mezzo-soprano' | 'soprano';

export interface VocalProfilePayload {
  vocalProfile: {
    lowestSolidNote: string;
    lowestMidi: number;
    highestSolidNote: string;
    highestMidi: number;
    comfortCenterNote: string;
    comfortCenterMidi: number;
    stairsAccuracyPct?: number;
    tessiture: TessitureType;
    rangeSemitones: number;
    lastEvaluatedAt: string;
    sourceApp: 'o-girador-vocal-lab';
  };
}

export type AmbitusValidationStatus =
  | 'idle'
  | 'holding'
  | 'solid'
  | 'failed_low_power'
  | 'failed_sagging'
  | 'failed_pitch';

export interface AmbitusStepResult {
  note: string;
  midi: number;
  heldDurationSec: number;
  avgRms: number;
  isSolid: boolean;
  status: AmbitusValidationStatus;
  messageKey?: string;
}
