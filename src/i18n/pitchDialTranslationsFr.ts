/**
 * pitchDialTranslationsFr.ts
 * Dictionnaire FR de la Phase E : Cadran Cherche-Notes, Dictée Lente & Pas-à-pas sur Bourdon (< 80 lignes).
 */
import type { PitchDialTranslations } from './pitchDialTranslations.types';

export const pitchDialTranslationsFr: PitchDialTranslations = {
  dialOpenDictationBtn: 'Cherche-Notes',
  dialOpenDictationTitle: 'Ouvrir le Cherche-Notes & Dictée lente (Code Papier + Bourdon)',
  dialModalTitle: 'CHERCHE-NOTES & DICTÉE LENTE (PUXADOR)',
  dialHintUp: 'Monte',
  dialHintDown: 'Descends',
  dialHintHold: 'Tenez !',
  dialHintSing: 'Chantez...',
  dialViewSungKey: 'Voix chantée',
  dialViewTroupeKey: 'Transposé troupe',
  dialDroneBtn: 'Bourdon',
  dialDroneActive: 'Bourdon ON',
  dialListenNoteTitle: 'Écouter cette note au synthétiseur (gel anti-repisse actif)',
  dialMicStartBtn: 'Écouter ma voix',
  dialMicStopBtn: 'Couper micro',
  dialRibbonTitle: 'Ruban de Dictée (tenue >= 0,42 s)',
  dialRibbonEmpty: 'Tenez une note chantée ou touchez [-½ / +½] pour construire la phrase...',
  dialPlaySequenceBtn: 'Lire la suite',
  dialCopyPaperBtn: 'Copier Code Papier',
  dialCopiedToast: 'Code Papier copié dans le presse-papiers !',
  dialClearRibbonBtn: 'Vider',
  dialAttachToPatternBtn: 'Associer ces notes à la phrase active',
  dialAttachedToast: '{count} notes de référence associées à « {name} » !',
  dialRefNotesBadge: 'Réf. {count} notes',
  stepModeRhythmBtn: 'En rythme (Autoroute)',
  stepModeStepByStepBtn: 'Pas-à-pas (Cherche-Notes)',
  stepListenFirstNoteBtn: 'Écouter la 1re note',
  stepListenCurrentNoteBtn: 'Note cible',
  stepAllValidatedBanner: 'Toutes les syllabes sont validées ! Prêt à enchaîner en rythme sans béquille :',
  stepStartDroneClickNowBtn: 'Chanter maintenant en rythme (Bourdon + Clic, sans clavier)',
  trainer_guide_drone_click: 'Bourdon + Clic (Sans clavier)',
  stepResetSyllablesBtn: 'Recommencer les syllabes',
  gameEnduranceRecordLabel: 'Record souffle juste : {sec} s',
  gameArrowPlantedBadge: 'Flèche plantée au centre (150 ms + tenue 1 s) !',
};
