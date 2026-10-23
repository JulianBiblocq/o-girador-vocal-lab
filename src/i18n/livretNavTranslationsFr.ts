/**
 * livretNavTranslationsFr.ts
 * Traductions françaises pour la navigation à 5 livrets + Réglages et la boussole (< 60 lignes).
 */
import type { LivretNavTranslations } from './livretNavTranslations.types';

export const livretNavTranslationsFr: LivretNavTranslations = {
  tabLivret1: '1. Structure & Chant',
  tabLivret2: '2. Cabine / Prise',
  tabLivret3: '3. Calage & Découpe',
  tabLivret4: '4. Melodia & Letra',
  tabLivret5: '5. Entraînement',
  tabReglages: '⚙️ Réglages',
  compassPatternPrefix: 'Phrase',
  compassEmptyAudio: 'Pas d\'audio',
  compassRecordedAudio: 'Enregistré',
  compassPrevTooltip: 'Phrase précédente',
  compassNextTooltip: 'Phrase suivante',
  compassTotalCount: '{current} / {total}',
  goToCalageBtn: '✂️ Caler l\'onde (Livret 3) →',
  goToMelodiaBtn: '🎹 Notes & Paroles (Livret 4) →',
  goToCabineBtn: '🎙️ Aller en Cabine (Livret 2)',
  calageEmptyTitle: 'Aucune prise vocale sur cette phrase',
  calageEmptyDesc: 'Enregistrez votre voix en cabine (Livret 2) ou importez directement un fichier audio.',
  calageDirectImportBtn: '📂 Importer Audio (Pattern)',
  calageOpenSlicerBtn: '✂️ Découper une Toada (Slicer)',
  melodiaEmptyTitle: 'Aucune mélodie extraite pour cette phrase',
  melodiaEmptyDesc: 'Effectuez une prise au Livret 2 ou validez le calage au Livret 3 pour afficher le Piano Roll et les paroles.',
  melodiaReExtractRawBtn: '↺ Repartir de la Prise brute',
  statusMicDefault: 'Micro : Par défaut',
  statusHeadphonesOn: 'Avec casque',
  statusVisualMode: 'Sans casque (Visuel)',
  statusTessituraLabel: 'Tessiture',
  statusQuickEditBtn: '⚙️ Modifier',
  grainPlayerAccordionTitle: '🎛️ Déclinaisons Vitesse & Tonalité (GrainPlayer)',
  grainPlayerAccordionSummary: '{recorded}/4 enregistrées • Active : {active}',
  reglagesTitle: 'RÉGLAGES AUDIO & MATÉRIELS',
  reglagesAudioSection: 'Carte Son & Microphone',
  reglagesListeningSection: 'Mode d\'Écoute & Volume du Guide',
  reglagesCalibrationSection: 'Calibration & Latence Matérielle',
  reglagesTessituraSection: 'Bornage Tessiture & Viterbi',
};
