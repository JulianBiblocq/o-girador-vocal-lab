/**
 * Types & Contrat de données VocalPackExport v1.0
 * Standard d'échange étanche entre O Girador Vocal Lab et Sequenciador.
 */

/** Pupitres vocaux stricts de Sequenciador (Puxador et Coro) */
export type VocalRoleTarget = 'puxador' | 'coro';

/** Chiffrages de mesure supportés */
export type TimeSignatureString = '4/4' | '2/4' | '3/4' | '6/8' | '12/8';

export type DoubtReason = 'between_notes' | 'short_or_noisy' | 'out_of_scale';
export type TripletSlot = 1 | 2 | 3 | 'unused';

/** Données d'un pas de quantification vocale sur la grille */
export interface VocalStepData {
  stepIndex: number;
  active: boolean;
  note: string; // Ex: 'C4', 'A3', '───' pour une note tenue
  midiNumber: number | null; // Ex: 60 pour C4, null sur un silence explicite (0 / 𝄽)
  syllable?: string; // Syllabe de la Letra chantée ou '_' sur un mélisme legato
  syllableAttack?: boolean; // Attaque franche ou plosive détectée
  isTie?: boolean; // Note tenue liée au pas précédent (même hauteur)
  isMelisma?: boolean; // Transition de hauteur legato sans ré-attaque syllabique ('_')
  tripletSlot?: TripletSlot; // 1 | 2 | 3 | 'unused' lorsque le temps est en triolet
  velocity: number; // 0..127 ou 0..1
  decay: number; // Durée relative ou millisecondes
  microtiming?: number; // Décalage fin (nudge en ms ou fraction de pas)
  melodyneStartRatio?: number; // 0.0 à 0.95 (défaut 0.25) découpe interne d'attaque naturelle
  consonantHeadRatio?: number; // Ratio tête consonantique / sibilante détectée par sibilantBreathMasker (0..0.65)
  waveEnvelopeBins?: number[]; // Silhouette fine d'amplitude vocale interne à la brique (0..1)
  melodynePullPct?: number; // 0 à 100 % (défaut 0 = voix brute) correction Melodyne par brique (VariAudio)
  originalVoiceMidi?: number; // Hauteur médiane réelle de la courbe verte sous la brique
  manualPitchMoved?: boolean; // Indique que l'utilisateur a déplacé manuellement la brique MIDI
  isUncertain?: boolean;
  pitchConfidence?: number; // 0..1
  alternativeNote?: string; // Ex: 'A3', 2e meilleure note candidate
  doubtReason?: DoubtReason;
}

export type MelodicStep = VocalStepData;

/** Données de calibration de l'anacrouse / mesure d'élan (M-1) */
export interface VocalAnacrusisData {
  hasAnacrusis: boolean;
  durationSec: number;
  beats: number;
  startOffsetSec: number;
  preRollSteps: number;
  steps?: VocalStepData[]; // Pas chantés dans l'anacrouse M-1
}

/** Point de la courbe de justesse vocale continue */
export interface PitchCurvePoint {
  timeSec: number;
  midiFloat: number; // Numéro MIDI fractionnaire continu
  confidence?: number;
  rms?: number;
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
  suggestedRole?: VocalRoleTarget; // Optionnel : universel par défaut
  referencePitch: string; // Ex: 'C4', 'A3'
  referencePitchHz?: number; // Diapason acoustique en Hz (415..466, défaut 440)
  recordedAtPitchHz?: number; // Diapason lors de la prise vocale (traçabilité Afinador)
  grammarVersion?: number; // Version de grammaire vocale (2 = unifiée)
  createdAt: string; // ISO 8601
}

export interface CloudToadaPackContract {
  id: string;
  title: string;
  groupId?: string;
  bpm: number;
  timeSignature: TimeSignatureString;
  grammarVersion?: number;
  referencePitchHz?: number;
  recordedAtPitchHz?: number;
  sungKey?: string;
  troupeKey?: string;
  transpositionSemitones?: number;
  patterns: Record<string, any>[];
  slots?: Record<string, any>[];
  updatedAt?: number;
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
  pitchCurve?: PitchCurvePoint[]; // Courbe continue pour affichage Piano Roll
  audio: VocalAudioPayload;
}

/** Zone de retouche continue Melodyne libre [ In ── Out ] */
export interface MelodyneRegion {
  id: string;
  startSec: number;             // Point IN (en secondes sur la timeline du pattern)
  endSec: number;               // Point OUT (en secondes sur la timeline du pattern)
  pitchCenterPct: number;       // 0 à 100 % : force de calage de la hauteur moyenne vers la note MIDI
  driftCorrectionPct?: number;  // 0 à 100 % : force de tenue / anti-dérive lente (< 2.5 Hz), défaut 80
  flattenPct: number;           // 0 à 100 % : force d'aplatissement/calme du vibrato rapide (4..8 Hz)
  targetMidiOverride?: number;  // Optionnel : note MIDI cible forcée
}

