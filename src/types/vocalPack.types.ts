/**
 * Types & Contrat de données VocalPackExport v1.0
 * Standard d'échange étanche entre O Girador Vocal Lab et Sequenciador.
 */

/** Pupitres vocaux stricts de Sequenciador (Puxador et Coro) */
export type VocalRoleTarget = 'puxador' | 'coro';

/** Chiffrages de mesure supportés */
export type TimeSignatureString = '4/4' | '2/4' | '3/4' | '6/8' | '12/8';

/** Données d'un pas de quantification vocale sur la grille */
export interface VocalStepData {
  stepIndex: number;
  active: boolean;
  note: string; // Ex: 'C4', 'A3', 'F#4'
  midiNumber: number; // Ex: 60 pour C4
  syllable?: string; // Phonème ou texte chanté
  velocity: number; // 0..127 ou 0..1
  decay: number; // Durée relative ou millisecondes
  microtiming?: number; // Décalage fin (nudge en ms ou fraction de pas)
}

/** Données de calibration de l'anacrouse / mesure d'élan (M-1) */
export interface VocalAnacrusisData {
  hasAnacrusis: boolean;
  durationSec: number;
  beats: number;
  startOffsetSec: number;
  preRollSteps: number;
}

/** Payload audio consolidé et métadonnées d'alignement */
export interface VocalAudioPayload {
  format: 'wav' | 'webm' | 'ogg';
  sampleRate: number;
  channels: number;
  durationSec: number;
  audioBase64: string;
  nudgeMs: number;
  trim: {
    startSec: number;
    endSec: number;
  };
}

/** Métadonnées d'export de prise vocale */
export interface VocalPackMetadata {
  title?: string;
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number; // Nombre de mesures de chant N (1..4)
  beatResolutions: number[]; // Ex: [4, 4, 4, 4] pour binaire 4/4, [3, 3] pour 6/8
  suggestedRole: VocalRoleTarget;
  referencePitch: string; // Ex: 'C4', 'A3'
  createdAt: string; // ISO 8601
}

/** Structure globale du pack d'export */
export interface VocalPackExport {
  schemaVersion: '1.0';
  metadata: VocalPackMetadata;
  alignment: {
    startOffsetSec: number;
    anacrusis: VocalAnacrusisData;
    nudgeMs: number;
  };
  grid: {
    steps: VocalStepData[];
    totalSteps: number;
  };
  audio: VocalAudioPayload;
}
