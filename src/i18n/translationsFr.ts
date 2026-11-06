/**
 * translationsFr.ts
 * Dictionnaire de traduction Français pour O Girador — Cantador (< 130 lignes).
 */
import type { VocalLabTranslations } from './i18n.types';
import { slicerTranslationsFr } from './slicerTranslationsFr'; import { toadaSheetTranslationsFr } from './toadaSheetTranslationsFr';
import { treinoSubTranslationsFr } from './treinoSubTranslationsFr'; import { variantTranslationsFr } from './variantTranslationsFr';
import { tessituraTranslationsFr } from './tessituraTranslationsFr'; import { harmonyTranslationsFr } from './harmonyTranslationsFr';
import { cloudToadaTranslationsFr } from './cloudToadaTranslationsFr'; import { lexiconTranslationsFr } from './lexiconTranslationsFr';
import { livretNavTranslationsFr } from './livretNavTranslationsFr'; import { uiPolishTranslationsFr } from './uiPolishTranslationsFr';

export const translationsFr: VocalLabTranslations = {
  appTitle: 'O Girador — Cantador', appSubtitle: 'Atelier Vocal - Prosodie & Chant Maracatu', themeToggle: 'Changer de thème (Clair / Sombre)',
  patternLibraryTitle: 'BIBLIOTHÈQUE DES PATTERNS (TOADA)',
  addPuxadorPattern: 'Pattern Puxador', addCoroPattern: 'Pattern Coro', rolePuxador: 'PUXADOR', roleCoro: 'CORO', patternAudioRecorded: 'Audio', patternAudioMissing: 'Vide',
  editPatternNameTooltip: 'Renommer le pattern', deletePatternTooltip: 'Supprimer le pattern',
  conductorTitle: 'FRISE CONDUCTEUR DE LA TOADA', addConductorBlock: 'Bloc', playFullToada: 'Écouter la Toada complète', stopFullToada: 'Arrêter la Toada',
  railPuxador: 'Rail Puxador', railCoro: 'Rail Coro', emptySlot: '- Vide -', blockLabel: 'Bloc {n}',
  cueSelectorLabel: 'Appel avant la prise (M-2 & M-1) :', cueNone: 'Aucun (Clic seul)',
  cueAutoPrevious: 'Pattern précédent du Conducteur', cueCustomPrefix: 'Pattern :', cueReadyBadge: 'Prêt ({measures} M)',
  swapPuxadorCoroBtn: '⇄ Inverser Puxador ↔ Coro', swapRolesTooltip: 'Inverser globalement les rôles Puxador et Coro (patterns, conducteur et fiche)', duplicateVariation: '❐ (2)', duplicateVariationTooltip: 'Dupliquer ce pattern en une variation indépendante (2)',
  scopeAll: 'Tout le chant', scopeActive: 'Ce bloc seul', scopeSelected: '☑ Blocs cochés ({n})', selectAll: 'Tout cocher', deselectAll: 'Tout décocher', selectPatternCheckbox: 'Sélectionner ce bloc',
  importPreconfigTitle: 'RÉGLAGES PAR DÉFAUT DU CHANT', importDefaultBpm: 'BPM :', importMeasuresPerLine: 'Mesures / ligne :', importAnacrusisDefault: 'Anacrouse :',
  btnSaveToada: 'Sauvegarder', btnSavedSuccess: 'Sauvegardé !', saveToadaTooltip: 'Sauvegarder la Toada (Ctrl+S)', toadaSavedToast: 'Toada sauvegardée avec succès !', saveAndExportMenu: 'Sauvegarder & Exporter', exportFullSongWav: 'Exporter l\'audio du chant (.wav)', wavExportSuccess: 'Chant complet exporté en .wav avec succès !',
  export_toada_pack: 'Télécharger Pack Toada JSON', export_toada_pack_success: 'Pack Toada multi-déclinaisons prêt pour Sequenciador !',

  trainer_scope_pattern: 'Motif actif', trainer_scope_toada: 'Toada complète (Régie)',
  trainer_role_coro: 'Je chante : CORO', trainer_role_puxador: 'Je chante : PUXADOR', trainer_role_all: 'Je chante : TOUT',
  trainer_guide_accompanied: 'Accompagné (Voix + Synthé)', trainer_guide_voice_only: 'Voix originale seule', trainer_guide_autonomous: 'Autonome (Appel-Réponse pur)',
  trainer_speed_nominal: '100 % (Nominal)', trainer_speed_slow: '74 % (Ralenti)',
  karaoke_your_turn: 'À VOUS DE CHANTER !', karaoke_listen_guide: 'ÉCOUTEZ LE GUIDE', karaoke_no_lyrics: '(Pas de paroles sur cette mesure)',
  btn_start_training: "Lancer l'entraînement", btn_stop_training: 'Arrêter',
  btn_listen_student_duo: 'Ma voix + Guide', btn_listen_student_solo: 'Ma voix seule',
  trainer_accuracy_badge: 'Justesse : {score} % ({ok}/{total} notes dans la cible)',
  export_student_report: 'Exporter Bilan Élève (.json)', student_report_filename: 'bilan_entrainement_vocal',

  pendulumIdleTitle: 'EN ATTENTE DU CYCLE DE PRISE', pendulumStatusIdle: 'VEILLE',
  pendulumStatusPrecount: 'PRÉCOMPTE : ÉCOUTEZ LE TEMPO (MICRO EN ATTENTE)', pendulumStatusRec: 'REC ACTIF - CHANTEZ !', pendulumSyncImpact: 'Impact synchrone',
  phasePrecount: 'DÉCOMPTE & TONALITÉ (Écoutez : {beat} / {beats})', phaseAnacrusis: 'ANACROUSE / ÉLAN (Chantez si départ en levée : {beat} / {beats})',
  phaseSinging: 'CHANT : MESURE {current} / {total} (TEMPS {beat} / {beats})', phaseCompletedTitle: 'CYCLE TERMINÉ (PUNCH-OUT)',

  metricTitle: 'Métrique & Tempo', timeSignature: 'Signature Rythmique', tempoBpm: 'Tempo (BPM)', measuresCount: 'Mesures Chant', subdivisions: 'Subdivisions',
  elanAnacrusis: 'Élan (M-1)', measure1: 'M1 (T1)', measureAbbr: 'M', btnStartRecording: 'ENREGISTRER LA VOIX',
  btnStopRecording: "ARRÊTER L'ENREGISTREMENT", recordBtnStop: "ARRÊTER L'ENREGISTREMENT", measureUnitShort: '{n} M',

  listeningModeTitle: "Mode d'écoute & Repère", modeHeadphones: 'Avec Casque (Clic + Guide)', modeVisual: 'Sans Casque (Silencieux)',
  referencePitch: 'Note de repère (Diapason)', octave: 'Octave', octaveShort: 'Oct {oct}', testPitch: 'Tester', clickVolumeLabel: 'VOLUME (CLIC)',
  note_C: 'Do (C)', note_Cs: 'Do# (C#)', note_D: 'Ré (D)', note_Ds: 'Ré# (D#)', note_E: 'Mi (E)', note_F: 'Fa (F)', note_Fs: 'Fa# (Fs)', note_G: 'Sol (G)', note_Gs: 'Sol# (Gs)', note_A: 'La (A)', note_As: 'La# (As)', note_B: 'Si (B)',
  solfege_C: 'Do', solfege_Cs: 'Do#', solfege_D: 'Ré', solfege_Ds: 'Ré#', solfege_E: 'Mi', solfege_F: 'Fa', solfege_Fs: 'Fa#', solfege_G: 'Sol', solfege_Gs: 'Sol#', solfege_A: 'La', solfege_As: 'La#', solfege_B: 'Si',

  audioDevices: 'Périphériques Audio', soundCardDevices: 'CARTE SON & PÉRIPHÉRIQUES', devicePanelTitle: 'CARTE SON & PÉRIPHÉRIQUES',
  connected: 'CONNECTÉ', deviceConnectedBadge: 'CONNECTÉ', refresh: 'Actualiser', deviceRefreshBtn: 'Actualiser', authorizeAudio: 'Autoriser Audio',
  micInputPureDirect: 'Entrée Micro (Pure Direct)', deviceMicInputLabel: 'Entrée Micro (Pure Direct)', headphonesOutputDirect: 'Sortie Casque / Écoute (Routing direct)', deviceOutputLabel: 'Sortie Casque / Écoute (Routing direct)',
  clickAuthorizeAudio: 'Cliquez sur « Autoriser Audio »', defaultMicLabel: 'Microphone {n}', defaultOutputLabel: 'Sortie audio {n}',
  calibReadyBadge: 'Appareil calibré ({ms} ms)', calibRecalibrateBtn: 'Recalibrer', calibNewDeviceWarn: 'Nouvel appareil audio détecté — CALIBRATION REQUISE', calibNewDeviceWarnBtn: 'Calibrer',
  calibBtnFirstTime: 'Calibrer', calibBtnRecalibrate: 'Recalibrer', calibMethodAutoPing: 'Auto-Ping (2 s)', calibMethodHumanSync: 'Synchro Humaine (8 claps)',
  calibAutoPingTooltip: 'Émet 3 impulsions pour mesurer automatiquement la latence aller-retour', calibHumanSyncTooltip: 'Tapez 8 fois dans vos mains en rythme avec le métronome',
  calibPingInstruction: 'Silence... Émission de 3 pings acoustiques', calibPingFailed: 'Signal trop faible ou non détecté. Réessayez ou utilisez la Synchro Humaine.',
  calibRetryPing: 'Réessayer Auto-Ping', calibCancelTooltip: 'Annuler', calibStepListen: 'Écoutez le tempo (4 bips)...', calibStepClap: 'Tapez dans vos mains sur chaque bip ({n}/8)!',
  calibStepCompute: 'Calcul de la latence...', calibClapBadge: 'CLAP {n}/8', calibAutoTestBadge: 'AUTO-TEST',

  waveformTitle: "Éditeur de Forme d'Onde & Normalisation", trimStartFlag: 'DÉBUT', trimEndFlag: 'FIN',
  trimHelpNotice: 'Glissez les poignées Début et Fin pour couper les respirations : calage rythmique 100 % verrouillé.',
  calageAnchorT1Label: 'Ancre T1',
  zoomSeeStart: 'Voir Début', zoomSeeEnd: 'Voir Fin', zoomComplete: '1x (Complet)',
  zoomInTitle: 'Zoomer (Ctrl + Molette avant)', zoomOutTitle: 'Dézoomer (Ctrl + Molette arrière)',
  zoomSeeStartTitle: 'Centrer la vue sur la poignée Début', zoomSeeEndTitle: 'Centrer la vue sur la poignée Fin',
  lowCutStudio: 'Coupe-bas Studio (90 Hz)', clarityDeEsser: 'Clarté & De-Esser', clarityDeEsserTooltip: 'Égaliseur Anti-Boîte (320 Hz), Présence (3,2 kHz) et Adoucisseur de sifflantes (6,5 kHz)', clickWitness: 'Clic témoin', listenTakeAgain: 'Réécouter',
  extractMelodyAndLyrics: 'Extraire Melodia & Letra', offsetMeasure1: 'Décalage M1 :',
  anacrusisLabel: 'Anacrouse', anacrusisBeats: '{beats} tps', cleanDurationLabel: 'Durée utile :',
  stopTake: 'Stop', rerecordTake: 'Refaire', normalizedVolume: 'Volume normalisé (-16 LUFS)',

  toolPointer: 'Déplacer / Écrire', toolGlue: 'Coller', toolCut: 'Couper', toolErase: 'Gomme', toolText: 'Texte',
  undo: 'Annuler (Ctrl+Z)', redo: 'Rétablir (Ctrl+Y)', scaleLabel: 'Gamme', smoothingLabel: 'Lissage',
  smoothingFine: 'Fin', smoothingWide: 'Large',
  scaleChromatic: 'Chromatique (Libre)', scaleMajor: 'Majeur', scaleNaturalMinor: 'Mineur Naturel', scaleMixolydian: 'Mixolidien / Nordeste (7e min)', scaleDorian: 'Dorien', scalePentatonicMinor: 'Pentatonique Mineure', scalePentatonicMajor: 'Pentatonique Majeure',
  rulerMeasures: 'MESURES', rulerBeats: 'TEMPS', rulerElan: 'ÉLAN (M-1)', rulerMeasure1: 'M1',
  pianoRollHint: "Clic Droit = Palette d'outils — Règle cliquable = Seek",

  modeIsolatedVoice: 'Voix seule', modeSynthesizer: 'Synthé seul', modeDuo: 'Duo (Voix + Synthé)',
  metronomeClick: 'Clic métronome', backToRecording: 'Retour à la Prise', downloadPack: 'Pack JSON', stopPlayback: '■ ARRÊTER LA LECTURE',
  letraTitle: 'LETRA DA TOADA (Paroles & Alignement)', alignBtn: 'Aligner', syllableCount: 'syllabes détectées',
  syntaxGuide: 'Syntaxe : tiret (-) ou (--) pour mélisme, apostrophe (\') ou (_) pour élision.',
  letraNoActiveNotes: 'Aucune note active détectée.', letraSpaceBadge: 'Espace', letraTiedBadge: '- Lié',
  letraSpaceTooltip: 'Mot terminé (espace)', letraTiedTooltip: 'Syllabe liée au mot suivant',
  letraWordsLabel: 'Mots :', letraEmptyWords: '(vide)',
  footerSandbox: 'O Girador - Atelier Vocal - Bac à sable étanche - Zéro collision avec Sequenciador',
  footerPack: 'Standard VocalPackExport v1.0 - Puxador / Coro',
  listenPitch: "Écouter", doubleClickRename: "Double-clic pour renommer", puxadorSectionTitle: "Puxador", coroSectionTitle: "Coro", midiLockedTake1Notice: "Notes MIDI verrouillées sur la Prise 1",

  melodyneTitle: 'CORRECTION VOCALE (MELODYNE)', melodyneSliderLabel: 'Ajuster la voix aux briques MIDI : {percent} %',
  melodynePresetRaw: '0 % Brute', melodynePresetNatural: '50 % Naturel', melodynePresetLocked: '100 % Calé', melodyneLinkedHint: 'Liaison active : déplacer une brique ajuste la voix', melodyneProcessing: 'Recalcul audio en cours...',

  mirrorToCoro: '⇄ Coro', mirrorToPuxador: '⇄ Puxador', mirrorToCoroTooltip: 'Copier et synchroniser ce pattern vers le Coro', mirrorToPuxadorTooltip: 'Copier et synchroniser ce pattern vers le Puxador',
  syncBadge: 'Sync : {source}', unlinkTooltip: 'Dissocier pour éditer séparément',

  toolMelodyneCut: 'Découpe Melodyne', toolMelodyneCutTooltip: "Découper l'attaque (voix naturelle) sans scinder la note MIDI",
  melodyneAttackSlider: "Préserver l'attaque : {percent} %", reExtractNotes: "Recalquer Rythme & Tenues sur l'Onde",
  reExtractNotesTooltip: "Recalcule fidèlement les briques MIDI et les tenues de notes (isTie) calées sur la courbe verte pour Sequenciador",
  reExtractNotesConfirm: "Recalquer les briques MIDI et les tenues de notes fidèlement sur la courbe verte de l'onde ?",
  reExtractSuccessToast: "Son et notes réinitialisés d'après le Livret 1",
  openPack: 'Ouvrir Pack (.json)', openPackTooltip: 'Charger et modifier un projet ou pack vocal JSON',
  exportPack: 'Exporter Pack (.json)', exportPackTooltip: 'Télécharger la Toada complète et toutes les déclinaisons audio',
  packLoadSuccess: 'Pack chargé avec succès !', packLoadError: 'Erreur lors de la lecture du fichier JSON',

  dialogConfirm: 'Confirmer', dialogCancel: 'Annuler', dialogOk: 'OK', dialogAlertTitle: 'Information', dialogConfirmTitle: 'Confirmation',
  deletePatternConfirm: 'Voulez-vous vraiment supprimer le pattern', deletePatternTitle: 'Supprimer le pattern',
  resetRecordingConfirm: 'Voulez-vous ré-enregistrer cette prise ? L\'enregistrement actuel sera perdu.', resetRecordingTitle: 'Ré-enregistrer la prise',

  melodynePitchCenter: 'Justesse (Centrer) : {percent} %', melodyneFlatten: 'Stabilité (Aplatir) : {percent} %',
  melodyneCreateZoneBtn: 'Créer Zone In/Out', melodyneWholePhraseBtn: '+ Zone sur toute la phrase',
  melodyneDeleteZoneBtn: '✕ Supprimer Zone', melodyneResetZoneBtn: '↺ Réinitialiser (0 %)',
  melodyneNoZoneSelected: 'Sélectionnez ou créez une zone [ In ── Out ] sur le Piano Roll',
  melodyneZoneActiveBadge: 'Zone [ IN: {start}s ── OUT: {end}s ]',
  melodyneZoneHelpHint: 'Glissez les poignées [IN] et [OUT] sous la ligne des Temps pour ajuster la zone', melodyneRailLabel: 'ZONE',
  melodyneShiftDownOct: '-1 Oct', melodyneShiftUpOct: '+1 Oct', melodyneAlignToBricks: 'Octave ➔ Briques',
  melodynePurgeBtn: '✕ Purger Melodyne (Son brut)',
  melodynePurgeTooltip: 'Supprime toutes les zones Melodyne pour écouter le son 100% brut du Livret 1 tout en conservant les notes MIDI',
  melodynePurgeToast: 'Son brut du Livret 1 rétabli (zones Melodyne purgées)',
  pwaInstallBtn: 'Installer',

  ...cloudToadaTranslationsFr, ...lexiconTranslationsFr, ...livretNavTranslationsFr, ...uiPolishTranslationsFr,
  ...slicerTranslationsFr, ...toadaSheetTranslationsFr, ...treinoSubTranslationsFr, ...variantTranslationsFr, ...tessituraTranslationsFr, ...harmonyTranslationsFr,
};
