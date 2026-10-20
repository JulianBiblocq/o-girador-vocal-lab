/**
 * translationsFr.ts
 * Dictionnaire de traduction Francais pour O Girador - Atelier Vocal (sans emojis systeme).
 */
import type { VocalLabTranslations } from './i18n.types';
import { slicerTranslationsFr } from './slicerTranslationsFr';
import { toadaSheetTranslationsFr } from './toadaSheetTranslationsFr'; import { treinoSubTranslationsFr } from './treinoSubTranslationsFr'; import { variantTranslationsFr } from './variantTranslationsFr';
import { tessituraTranslationsFr } from './tessituraTranslationsFr'; import { harmonyTranslationsFr } from './harmonyTranslationsFr';

export const translationsFr: VocalLabTranslations = {
  // En-tete
  appTitle: 'O Girador — Cantador', appSubtitle: 'Atelier Vocal - Prosodie & Chant Maracatu',
  themeToggle: 'Changer de theme (Clair / Sombre)',
  tabLivret1: 'Livret 1 : Prise', tabLivret2: 'Livret 2 : Melodia & Letra', tabLivret3: 'Livret 3 : Entrainement',

  // Jalon 4.A : Bibliotheque & Conducteur de Toada
  patternLibraryTitle: 'BIBLIOTHEQUE DES PATTERNS (TOADA)',
  addPuxadorPattern: 'Pattern Puxador', addCoroPattern: 'Pattern Coro', rolePuxador: 'PUXADOR', roleCoro: 'CORO', patternAudioRecorded: 'Audio', patternAudioMissing: 'Vide',
  editPatternNameTooltip: 'Renommer le pattern', deletePatternTooltip: 'Supprimer le pattern',
  conductorTitle: 'FRISE CONDUCTEUR DE LA TOADA', addConductorBlock: 'Bloc', playFullToada: 'Ecouter la Toada complete', stopFullToada: 'Arreter la Toada',
  railPuxador: 'Rail Puxador', railCoro: 'Rail Coro', emptySlot: '- Vide -', blockLabel: 'Bloc {n}',
  cueSelectorLabel: 'Appel avant la prise (M-2 & M-1) :', cueNone: 'Aucun (Clic seul)',
  cueAutoPrevious: 'Pattern precedent du Conducteur', cueCustomPrefix: 'Pattern :', cueReadyBadge: 'Pret ({measures} M)',
  swapPuxadorCoroBtn: '⇄ Inverser Puxador ↔ Coro', swapRolesTooltip: 'Inverser globalement les rôles Puxador et Coro (patterns, conducteur et fiche)', duplicateVariation: '❐ (2)', duplicateVariationTooltip: 'Dupliquer ce pattern en une variation indépendante (2)',
  scopeAll: '🌍 Tout le chant', scopeActive: '🎯 Ce bloc seul', scopeSelected: '☑ Blocs cochés ({n})', selectAll: 'Tout cocher', deselectAll: 'Tout décocher', selectPatternCheckbox: 'Sélectionner ce bloc',
  importPreconfigTitle: 'RÉGLAGES PAR DÉFAUT DU CHANT', importDefaultBpm: 'BPM :', importMeasuresPerLine: 'Mesures / ligne :', importAnacrusisDefault: 'Anacrouse :',
  btnSaveToada: 'Sauvegarder', btnSavedSuccess: 'Sauvegardé !', saveToadaTooltip: 'Sauvegarder la Toada (Ctrl+S)', toadaSavedToast: 'Toada sauvegardée avec succès !', saveAndExportMenu: 'Sauvegarder & Exporter', exportFullSongWav: 'Exporter l\'audio du chant (.wav)', wavExportSuccess: 'Chant complet exporté en .wav avec succès !',

  export_toada_pack: 'Telecharger Pack Toada JSON', export_toada_pack_success: 'Pack Toada multi-declinaisons pret pour Sequenciad\'Or !',

  // Jalon 4.C : Livret 3 - Entrainement Vocal & Karaoke
  trainer_scope_pattern: 'Motif actif', trainer_scope_toada: 'Toada complete (Regie)',
  trainer_role_coro: 'Je chante : CORO', trainer_role_puxador: 'Je chante : PUXADOR', trainer_role_all: 'Je chante : TOUT',
  trainer_guide_accompanied: 'Accompagne (Voix + Synthe)', trainer_guide_voice_only: 'Voix originale seule', trainer_guide_autonomous: 'Autonome (Appel-Reponse pur)',
  trainer_speed_nominal: '100 % (Nominal)', trainer_speed_slow: '74 % (Ralenti)',
  karaoke_your_turn: 'A VOUS DE CHANTER !', karaoke_listen_guide: 'ECOUTEZ LE GUIDE', karaoke_no_lyrics: '(Pas de paroles sur cette mesure)',
  btn_start_training: "Lancer l'entrainement", btn_stop_training: 'Arreter',
  btn_listen_student_duo: 'Ma voix + Guide', btn_listen_student_solo: 'Ma voix seule',
  trainer_accuracy_badge: 'Justesse : {score} % ({ok}/{total} notes dans la cible)',
  export_student_report: 'Exporter Bilan Eleve (.json)', student_report_filename: 'bilan_entrainement_vocal',

  // Balancier & Cycle de Prise
  pendulumIdleTitle: 'EN ATTENTE DU CYCLE DE PRISE', pendulumStatusIdle: 'VEILLE',
  pendulumStatusPrecount: 'PRECOMPTE : ECOUTEZ LE TEMPO (MICRO EN ATTENTE)', pendulumStatusRec: 'REC ACTIF - CHANTEZ !', pendulumSyncImpact: 'Impact synchrone',
  phasePrecount: 'DECOMPTE & TONALITE (Ecoutez : {beat} / {beats})', phaseAnacrusis: 'ANACROUSE / ELAN (Chantez si depart en levee : {beat} / {beats})',
  phaseSinging: 'CHANT : MESURE {current} / {total} (TEMPS {beat} / {beats})', phaseCompletedTitle: 'CYCLE TERMINE (PUNCH-OUT)',

  // Livret 1 - Metrique & Enregistrement
  metricTitle: 'Metrique & Tempo', timeSignature: 'Signature Rythmique', tempoBpm: 'Tempo (BPM)', measuresCount: 'Mesures Chant', subdivisions: 'Subdivisions',
  elanAnacrusis: 'Elan (M-1)', measure1: 'M1 (T1)', measureAbbr: 'M', btnStartRecording: 'ENREGISTRER LA VOIX (1 M ELAN + {measures} M CHANT)',
  btnStopRecording: "ARRETER L'ENREGISTREMENT", recordBtnStop: "ARRETER L'ENREGISTREMENT", measureUnitShort: '{n} M',

  // Livret 1 - Ecoute & Repere
  listeningModeTitle: "Mode d'ecoute & Repere", modeHeadphones: 'Avec Casque (Clic + Guide)', modeVisual: 'Sans Casque (Silencieux)',
  referencePitch: 'Note de repere (Diapason)', octave: 'Octave', octaveShort: 'Oct {oct}', testPitch: 'Tester', clickVolumeLabel: 'VOLUME (CLIC)',
  note_C: 'Do (C)', note_Cs: 'Do# (C#)', note_D: 'Re (D)', note_Ds: 'Re# (D#)', note_E: 'Mi (E)', note_F: 'Fa (F)', note_Fs: 'Fa# (Fs)', note_G: 'Sol (G)', note_Gs: 'Sol# (Gs)', note_A: 'La (A)', note_As: 'La# (As)', note_B: 'Si (B)',
  solfege_C: 'Do', solfege_Cs: 'Do#', solfege_D: 'Ré', solfege_Ds: 'Ré#', solfege_E: 'Mi', solfege_F: 'Fa', solfege_Fs: 'Fa#', solfege_G: 'Sol', solfege_Gs: 'Sol#', solfege_A: 'La', solfege_As: 'La#', solfege_B: 'Si',

  // Livret 1 - Materiel & Calibration
  audioDevices: 'Peripheriques Audio', soundCardDevices: 'CARTE SON & PERIPHERIQUES', devicePanelTitle: 'CARTE SON & PERIPHERIQUES',
  connected: 'CONNECTE', deviceConnectedBadge: 'CONNECTE', refresh: 'Actualiser', deviceRefreshBtn: 'Actualiser', authorizeAudio: 'Autoriser Audio',
  micInputPureDirect: 'Entree Micro (Pure Direct)', deviceMicInputLabel: 'Entree Micro (Pure Direct)', headphonesOutputDirect: 'Sortie Casque / Ecoute (Routing direct)', deviceOutputLabel: 'Sortie Casque / Ecoute (Routing direct)',
  clickAuthorizeAudio: 'Cliquez sur « Autoriser Audio »', defaultMicLabel: 'Microphone {n}', defaultOutputLabel: 'Sortie audio {n}',
  calibReadyBadge: 'Appareil calibre ({ms} ms)', calibRecalibrateBtn: 'Recalibrer', calibNewDeviceWarn: 'Nouvel appareil audio detecte - CALIBRATION REQUISE', calibNewDeviceWarnBtn: 'Calibrer',
  calibBtnFirstTime: 'Calibrer', calibBtnRecalibrate: 'Recalibrer', calibMethodAutoPing: 'Auto-Ping (2 s)', calibMethodHumanSync: 'Synchro Humaine (8 claps)',
  calibAutoPingTooltip: 'Emet 3 impulsions pour mesurer automatiquement la latence aller-retour', calibHumanSyncTooltip: 'Tapez 8 fois dans vos mains en rythme avec le metronome',
  calibPingInstruction: 'Silence... Emission de 3 pings acoustiques', calibPingFailed: 'Signal trop faible ou non detecte. Reessayez ou utilisez la Synchro Humaine.',
  calibRetryPing: 'Reessayer Auto-Ping', calibCancelTooltip: 'Annuler', calibStepListen: 'Ecoutez le tempo (4 bips)...', calibStepClap: 'Tapez dans vos mains sur chaque bip ({n}/8)!',
  calibStepCompute: 'Calcul de la latence...', calibClapBadge: 'CLAP {n}/8', calibAutoTestBadge: 'AUTO-TEST',

  // Livret 1 - Onde & Trim
  waveformTitle: "Editeur de Forme d'Onde & Normalisation", trimStartFlag: 'DEBUT', trimEndFlag: 'FIN',
  trimHelpNotice: 'Glissez les poignées Début et Fin pour couper les respirations : calage rythmique 100 % verrouillé.',
  zoomSeeStart: 'Voir Debut', zoomSeeEnd: 'Voir Fin', zoomComplete: '1x (Complet)',
  zoomInTitle: 'Zoomer (Ctrl + Molette avant)', zoomOutTitle: 'Dezoomer (Ctrl + Molette arriere)',
  zoomSeeStartTitle: 'Centrer la vue sur la poignee Debut', zoomSeeEndTitle: 'Centrer la vue sur la poignee Fin',
  lowCutStudio: 'Coupe-bas Studio (90 Hz)', clarityDeEsser: 'Clarté & De-Esser', clarityDeEsserTooltip: 'Égaliseur Anti-Boîte (320 Hz), Présence (3,2 kHz) et Adoucisseur de sifflantes (6,5 kHz)', clickWitness: 'Clic temoin', listenTakeAgain: 'Reecouter',
  extractMelodyAndLyrics: 'Extraire Melodia & Letra', offsetMeasure1: 'Decalage M1 :',
  anacrusisLabel: 'Anacrouse', anacrusisBeats: '{beats} tps', cleanDurationLabel: 'Duree utile :',
  stopTake: 'Stop', rerecordTake: 'Refaire', normalizedVolume: 'Volume normalise (-16 LUFS)',

  // Livret 2 - Outils Piano Roll & Gammes
  toolPointer: 'Deplacer / Ecrire', toolGlue: 'Coller', toolCut: 'Couper', toolErase: 'Gomme', toolText: 'Texte',
  undo: 'Annuler (Ctrl+Z)', redo: 'Retablir (Ctrl+Y)', scaleLabel: 'Gamme', smoothingLabel: 'Lissage',
  smoothingFine: 'Fin', smoothingWide: 'Large',
  scaleChromatic: 'Chromatique (Libre)', scaleMajor: 'Majeur', scaleNaturalMinor: 'Mineur Naturel', scaleMixolydian: 'Mixolidien / Nordeste (7e min)', scaleDorian: 'Dorien', scalePentatonicMinor: 'Pentatonique Mineure', scalePentatonicMajor: 'Pentatonique Majeure',
  rulerMeasures: 'MESURES', rulerBeats: 'TEMPS', rulerElan: 'ELAN (M-1)', rulerMeasure1: 'M1',
  pianoRollHint: "Clic Droit = Palette d'outils - Regle cliquable = Seek",

  // Livret 2 - Transport & Letra
  modeIsolatedVoice: 'Voix seule', modeSynthesizer: 'Synthe seul', modeDuo: 'Duo (Voix + Synthe)',
  metronomeClick: 'Clic metronome', backToRecording: 'Retour a la Prise', downloadPack: 'Pack JSON',
  letraTitle: 'LETRA DA TOADA (Paroles & Alignement)', alignBtn: 'Aligner', syllableCount: 'syllabes detectees',
  syntaxGuide: 'Syntaxe : tiret (-) ou (--) pour melisme, apostrophe (\') ou (_) pour elision.',
  letraNoActiveNotes: 'Aucune note active detectee.', letraSpaceBadge: 'Espace', letraTiedBadge: '- Lie',
  letraSpaceTooltip: 'Mot termine (espace)', letraTiedTooltip: 'Syllabe liee au mot suivant',
  letraWordsLabel: 'Mots :', letraEmptyWords: '(vide)',
  footerSandbox: 'O Girador - Atelier Vocal - Bac a sable etanche - Zero collision avec Sequenciador',
  footerPack: 'Standard VocalPackExport v1.0 - Puxador / Coro',
  listenPitch: "Écouter", doubleClickRename: "Double-clic pour renommer", puxadorSectionTitle: "Puxador", coroSectionTitle: "Coro", midiLockedTake1Notice: "Notes MIDI verrouillées sur la Prise 1",

  // Livret 2 - Correction Vocale (Melodyne)
  melodyneTitle: 'CORRECTION VOCALE (MELODYNE)', melodyneSliderLabel: 'Ajuster la voix aux briques MIDI : {percent} %',
  melodynePresetRaw: '0 % Brute', melodynePresetNatural: '50 % Naturel', melodynePresetLocked: '100 % Calé', melodyneLinkedHint: 'Liaison active : déplacer une brique ajuste la voix', melodyneProcessing: 'Recalcul audio en cours...',

  // Conducteur - Miroir & Synchronisation
  mirrorToCoro: '⇄ Coro', mirrorToPuxador: '⇄ Puxador', mirrorToCoroTooltip: 'Copier et synchroniser ce pattern vers le Coro', mirrorToPuxadorTooltip: 'Copier et synchroniser ce pattern vers le Puxador',
  syncBadge: '🔗 Sync : {source}', unlinkTooltip: 'Dissocier pour éditer séparément',

  // Jalon 4.H - Découpe Melodyne & Gestion de Pack
  toolMelodyneCut: 'Découpe Melodyne', toolMelodyneCutTooltip: "Découper l'attaque (voix naturelle) sans scinder la note MIDI",
  melodyneAttackSlider: "Préserver l'attaque : {percent} %", reExtractNotes: '↺ Repartir du Livret 1 (Son & Notes)',
  reExtractNotesTooltip: "Annule les retouches Melodyne et MIDI pour retrouver le son d'origine du Livret 1 et ré-extraire les notes à neuf",
  reExtractNotesConfirm: "Voulez-vous repartir du Livret 1 ? Les retouches Melodyne seront annulées et les briques MIDI ré-extraites depuis le son brut d'origine (les paroles saisies seront conservées).",
  reExtractSuccessToast: "Son et notes réinitialisés d'après le Livret 1",
  openPack: 'Ouvrir Pack (.json)', openPackTooltip: 'Charger et modifier un projet ou pack vocal JSON',
  exportPack: 'Exporter Pack (.json)', exportPackTooltip: 'Télécharger la Toada complète et toutes les déclinaisons audio',
  packLoadSuccess: 'Pack chargé avec succès !', packLoadError: 'Erreur lors de la lecture du fichier JSON',

  // Dialogues Cordel Asynchrones
  dialogConfirm: 'Confirmer', dialogCancel: 'Annuler', dialogOk: 'OK', dialogAlertTitle: 'Information', dialogConfirmTitle: 'Confirmation',
  deletePatternConfirm: 'Voulez-vous vraiment supprimer le pattern', deletePatternTitle: 'Supprimer le pattern',
  resetRecordingConfirm: 'Voulez-vous ré-enregistrer cette prise ? L\'enregistrement actuel sera perdu.', resetRecordingTitle: 'Ré-enregistrer la prise',

  // Jalon 4.J - Zones Melodyne Libres [ In ── Out ]
  melodynePitchCenter: '🎯 Justesse (Centrer) : {percent} %', melodyneFlatten: '📏 Stabilité (Aplatir) : {percent} %',
  melodyneCreateZoneBtn: 'Créer Zone In/Out', melodyneWholePhraseBtn: '+ Zone sur toute la phrase',
  melodyneDeleteZoneBtn: '✕ Supprimer Zone', melodyneResetZoneBtn: '↺ Réinitialiser (0 %)',
  melodyneNoZoneSelected: 'Sélectionnez ou créez une zone [ In ── Out ] sur le Piano Roll',
  melodyneZoneActiveBadge: 'Zone [ IN: {start}s ── OUT: {end}s ]',
  melodyneZoneHelpHint: 'Glissez les poignées [IN] et [OUT] sous la ligne des Temps pour ajuster la zone', melodyneRailLabel: 'ZONE',
  melodyneShiftDownOct: '🔽 -1 Oct', melodyneShiftUpOct: '🔼 +1 Oct', melodyneAlignToBricks: '🧲 Octave ➔ Briques',
  melodynePurgeBtn: '✕ Purger Melodyne (Son brut)',
  melodynePurgeTooltip: 'Supprime toutes les zones Melodyne pour écouter le son 100% brut du Livret 1 tout en conservant les notes MIDI',
  melodynePurgeToast: 'Son brut du Livret 1 rétabli (zones Melodyne purgées)',

  // Jalon 4.K & L - Gestion Multi-Toadas & Passerelle Cloud
  anacrusisOption: 'Anacrouse', hasAnacrusisYes: 'Oui', hasAnacrusisNo: 'Non', noAnacrusisBadge: 'Départ Temps 1 (Sans anacrouse)',
  newToada: 'Nouvelle Toada', newToadaTitle: 'Nouvelle Toada', newToadaConfirm: 'Créer une nouvelle Toada ? La Toada actuelle reste conservée dans "Mes Toadas".',
  myToadas: 'Mes Toadas', noSavedToadas: 'Aucune Toada enregistrée', deleteToadaConfirm: 'Supprimer définitivement la Toada', deleteToadaTitle: 'Supprimer la Toada',
  midiBadge: 'MIDI', midiConnectedTitle: 'Contrôleur MIDI connecté : {device}', midiNotConnectedTitle: 'Aucun contrôleur MIDI détecté', roleStudio: 'Studio', roleEleve: 'Élève', rulerClickSeekHint: 'Règle cliquable = Départ lecture',
  fichesOrganizador: 'Fiches Organizador', sendToSequencer: 'Envoyer vers Sequenciador', sendToSequencerTooltip: 'Téléverser les enregistrements et publier la Toada pour Sequenciador',
  openInSequencer: 'Ouvrir dans Sequenciador', toadaPublishedSuccess: 'Toada publiée dans le Cloud avec succès !', toadaPublishing: 'Publication de la Toada...', toadaImportTxt: 'Importer un fichier .txt',
  organizadorSearchPlaceholder: 'Rechercher une fiche ou toada...', noOrganizadorToadas: 'Aucune fiche trouvée', authLogin: 'Connexion', authLoginTooltip: 'Se connecter avec Google / SSO Organizador', authLogout: 'Déconnexion', authLoginRequiredNotice: 'Connexion requise pour accéder aux fiches de votre troupe.',
  ...slicerTranslationsFr, ...toadaSheetTranslationsFr, ...treinoSubTranslationsFr, ...variantTranslationsFr, ...tessituraTranslationsFr, ...harmonyTranslationsFr,
};
