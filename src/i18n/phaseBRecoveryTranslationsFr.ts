/**
 * phaseBRecoveryTranslationsFr.ts
 * Dictionnaire FR de la Phase B : Frise Conducteur, Récupération des prises (.wav) et VU-mètre Micro (< 55 lignes).
 */
import type { PhaseBRecoveryTranslations } from './phaseBRecoveryTranslations.types';

export const phaseBRecoveryTranslationsFr: PhaseBRecoveryTranslations = {
  conductorAddBlockFull: '+ Ajouter un bloc',
  conductorAddBlockTitle: 'Ajouter un bloc vocal en fin de Frise Conducteur (liaison stricte par patternId)',
  conductorInsertHere: 'Insérer un bloc ici',
  conductorInsertAtEnd: 'Ajouter un bloc en fin de frise',
  conductorRemoveBlockTitle: 'Retirer cette colonne de la frise (les prises audio sont conservées)',
  structureEditConfirmTitle: 'Passer en édition manuelle de la structure ?',
  structureEditConfirmMsg: 'La Frise Conducteur va passer en mode « Modifier la structure » pour insérer ou retirer des colonnes sans décaler vos prises audio.',
  structureEditConfirmOk: 'Modifier la structure',
  micMeterOff: 'Micro arrêté',
  micMeterLow: 'Signal faible',
  micMeterOk: 'OK',
  micMeterClip: 'Saturation !',
  micMeterTitle: 'Niveau micro temps réel : faible < -42 dBFS, idéal -42 à -3 dBFS, saturation >= -0,5 dBFS',
  recoveryOpenBtn: 'Récupérer des prises (.wav)',
  recoveryModalTitle: 'RÉCUPÉRATION & RÉ-ALIGNEMENT DES PRISES (.WAV)',
  recoveryModalSub: 'Lecture seule Cloud (/toada_packs & vocalRecordings/) — hydratation 100 % locale sans écriture distante',
  recoveryTabMatched: 'Appariement du chant',
  recoveryTabOrphans: 'Fichiers Storage orphelins',
  recoveryApplyAllHighBtn: 'Récupérer en 1 clic ({count})',
  recoveryBackupJsonBtn: 'Sauvegarde .json',
  recoveryRefreshBtn: 'Relire Cloud',
  recoveryLoading: 'Inspection des pistes Cloud en cours...',
  recoveryApplying: 'Décodage et alignement local en cours...',
  recoveryTitleMismatchWarn: 'Attention : le pack Cloud « {packTitle} » ne correspond pas au chant ouvert « {projectTitle} ». Aucune prise ne sera appliquée automatiquement : écoutez avant d’associer.',
  recoveryBadgeHigh: 'Sûr',
  recoveryBadgeSuggest: 'À vérifier',
  recoveryApplyOneBtn: 'Associer',
  recoveryAppliedToast: '{count} prise(s) récupérée(s) et ré-alignée(s) localement !',
  recoveryBatchAll: 'Tous les lots ({count})',
  recoveryAssignTargetLabel: 'Cible :',
  recoveryEmptyMatched: 'Aucune correspondance trouvée dans /toada_packs. Consultez l’onglet des fichiers Storage orphelins.',
  recoveryEmptyOrphans: 'Aucun fichier orphelin trouvé dans vocalRecordings/.',
  recoveryListenTitle: 'Écouter cet extrait .wav',
  recoveryStopTitle: 'Arrêter l’écoute',
};
