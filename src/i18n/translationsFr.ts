/**
 * translationsFr.ts
 * Dictionnaire de traduction Francais pour O Girador - Atelier Vocal (sans emojis systeme).
 */
import type { VocalLabTranslations } from './i18n.types';

export const translationsFr: VocalLabTranslations = {
  // En-tete
  appTitle: 'O Girador - Atelier Vocal',
  appSubtitle: 'Horloge 60 FPS - Metronome Accorde - Balancier Cinematique',
  themeToggle: 'Changer de theme (Clair / Sombre)',
  tabLivret1: 'Livret 1 : Prise', tabLivret2: 'Livret 2 : Melodia & Letra', tabLivret3: 'Livret 3 : Entrainement',

  // Jalon 4.A : Bibliotheque & Conducteur de Toada
  patternLibraryTitle: 'BIBLIOTHEQUE DES PATTERNS (TOADA)',
  addPuxadorPattern: 'Pattern Puxador', addCoroPattern: 'Pattern Coro',
  rolePuxador: 'PUXADOR', roleCoro: 'CORO',
  patternAudioRecorded: 'Audio', patternAudioMissing: 'Vide',
  editPatternNameTooltip: 'Renommer le pattern', deletePatternTooltip: 'Supprimer le pattern',
  conductorTitle: 'FRISE CONDUCTEUR DE LA TOADA', addConductorBlock: 'Bloc',
  playFullToada: 'Ecouter la Toada complete', stopFullToada: 'Arreter la Toada',
  railPuxador: 'Rail Puxador', railCoro: 'Rail Coro', emptySlot: '- Vide -', blockLabel: 'Bloc {n}',
  cueSelectorLabel: 'Appel avant la prise (M-2 & M-1) :', cueNone: 'Aucun (Clic seul)',
  cueAutoPrevious: 'Pattern precedent du Conducteur', cueCustomPrefix: 'Pattern :', cueReadyBadge: 'Pret ({measures} M)',

  // Jalon 4.B : Matrice de Declinaisons Audio
  pattern_variants_title: 'DECLINAISONS AUDIO DU PATTERN (ANTI-DISTORSION)',
  variant_speed_nominal: '100 % Nominal (87-115 %)', variant_speed_slow: '74 % Ralenti (60-87 %)',
  variant_speed_extra: '55 % Ultra-lent (45-60 %)', variant_add_speed_3: '+ 3e vitesse (55 %)',
  variant_pitch_nominal: 'Ton 0 (-2 a +2 tons)', variant_pitch_low: '-4 tons (-8 dt)',
  variant_pitch_high: '+4 tons (+8 dt)', variant_add_pitch_3: '+ 3e hauteur',
  variant_status_recorded: '✓ Prise cale', variant_status_pending: '○ A enregistrer',
  variant_tempo_banner: 'Tempo nominal : {nominal} BPM -> Prise asservie a {effective} BPM ({ratio} %)',
  variant_pitch_banner: 'Hauteur nominale : {nominal} -> Guide transpose a {effective} ({semitones} dt)',
  export_toada_pack: 'Telecharger Pack Toada JSON',
  export_toada_pack_success: 'Pack Toada multi-declinaisons pret pour Sequenciad\'Or !',

  // Jalon 4.C : Livret 3 - Entrainement Vocal & Karaoke
  trainer_scope_pattern: 'Motif actif', trainer_scope_toada: 'Toada complete (Regie)',
  trainer_role_coro: 'Je chante : CORO', trainer_role_puxador: 'Je chante : PUXADOR', trainer_role_all: 'Je chante : TOUT',
  trainer_guide_accompanied: 'Accompagne (Voix + Synthe)', trainer_guide_voice_only: 'Voix originale seule',
  trainer_guide_autonomous: 'Autonome (Appel-Reponse pur)',
  trainer_speed_nominal: '100 % (Nominal)', trainer_speed_slow: '74 % (Ralenti)',
  karaoke_your_turn: 'A VOUS DE CHANTER !', karaoke_listen_guide: 'ECOUTEZ LE GUIDE',
  karaoke_no_lyrics: '(Pas de paroles sur cette mesure)',
  btn_start_training: "Lancer l'entrainement", btn_stop_training: 'Arreter',
  btn_listen_student_duo: 'Ma voix + Guide', btn_listen_student_solo: 'Ma voix seule',
  trainer_accuracy_badge: 'Justesse : {score} % ({ok}/{total} notes dans la cible)',
  export_student_report: 'Exporter Bilan Eleve (.json)',
  student_report_filename: 'bilan_entrainement_vocal',

  // Balancier & Cycle de Prise
  pendulumIdleTitle: 'EN ATTENTE DU CYCLE DE PRISE', pendulumStatusIdle: 'VEILLE',
  pendulumStatusPrecount: 'PRECOMPTE : ECOUTEZ LE TEMPO (MICRO EN ATTENTE)',
  pendulumStatusRec: 'REC ACTIF - CHANTEZ !', pendulumSyncImpact: 'Impact synchrone',
  phasePrecount: 'DECOMPTE & TONALITE (Ecoutez : {beat} / {beats})',
  phaseAnacrusis: 'ANACROUSE / ELAN (Chantez si depart en levee : {beat} / {beats})',
  phaseSinging: 'CHANT : MESURE {current} / {total} (TEMPS {beat} / {beats})',
  phaseCompletedTitle: 'CYCLE TERMINE (PUNCH-OUT)',

  // Livret 1 - Metrique & Enregistrement
  metricTitle: 'Metrique & Tempo', timeSignature: 'Signature Rythmique', tempoBpm: 'Tempo (BPM)',
  measuresCount: 'Mesures Chant', subdivisions: 'Subdivisions', elanAnacrusis: 'Elan (M-1)',
  measure1: 'M1 (T1)', measureAbbr: 'M',
  btnStartRecording: 'ENREGISTRER LA VOIX (1 M ELAN + {measures} M CHANT)',
  btnStopRecording: "ARRETER L'ENREGISTREMENT", recordBtnStop: "ARRETER L'ENREGISTREMENT",
  measureUnitShort: '{n} M',

  // Livret 1 - Ecoute & Repere
  listeningModeTitle: "Mode d'ecoute & Repere", modeHeadphones: 'Avec Casque (Clic + Guide)',
  modeVisual: 'Sans Casque (Silencieux)', referencePitch: 'Note de repere (Diapason)',
  octave: 'Octave', octaveShort: 'Oct {oct}', testPitch: 'Tester', clickVolumeLabel: 'VOLUME (CLIC)',
  note_C: 'Do (C)', note_Cs: 'Do# (C#)', note_D: 'Re (D)', note_Ds: 'Re# (D#)',
  note_E: 'Mi (E)', note_F: 'Fa (F)', note_Fs: 'Fa# (F#)', note_G: 'Sol (G)',
  note_Gs: 'Sol# (G#)', note_A: 'La (A)', note_As: 'La# (A#)', note_B: 'Si (B)',

  // Livret 1 - Materiel & Calibration
  audioDevices: 'Peripheriques Audio', soundCardDevices: 'CARTE SON & PERIPHERIQUES',
  devicePanelTitle: 'CARTE SON & PERIPHERIQUES', connected: 'CONNECTE', deviceConnectedBadge: 'CONNECTE',
  refresh: 'Actualiser', deviceRefreshBtn: 'Actualiser', authorizeAudio: 'Autoriser Audio',
  micInputPureDirect: 'Entree Micro (Pure Direct)', deviceMicInputLabel: 'Entree Micro (Pure Direct)',
  headphonesOutputDirect: 'Sortie Casque / Ecoute (Routing direct)', deviceOutputLabel: 'Sortie Casque / Ecoute (Routing direct)',
  clickAuthorizeAudio: 'Cliquez sur « Autoriser Audio »', defaultMicLabel: 'Microphone {n}', defaultOutputLabel: 'Sortie audio {n}',
  calibReadyBadge: 'Appareil calibre ({ms} ms)', calibRecalibrateBtn: 'Recalibrer',
  calibNewDeviceWarn: 'Nouvel appareil audio detecte - CALIBRATION REQUISE', calibNewDeviceWarnBtn: 'Calibrer',
  calibBtnFirstTime: 'Calibrer', calibBtnRecalibrate: 'Recalibrer',
  calibMethodAutoPing: 'Auto-Ping (2 s)', calibMethodHumanSync: 'Synchro Humaine (8 claps)',
  calibAutoPingTooltip: 'Emet 3 impulsions pour mesurer automatiquement la latence aller-retour',
  calibHumanSyncTooltip: 'Tapez 8 fois dans vos mains en rythme avec le metronome',
  calibPingInstruction: 'Silence... Emission de 3 pings acoustiques',
  calibPingFailed: 'Signal trop faible ou non detecte. Reessayez ou utilisez la Synchro Humaine.',
  calibRetryPing: 'Reessayer Auto-Ping', calibCancelTooltip: 'Annuler',
  calibStepListen: 'Ecoutez le tempo (4 bips)...', calibStepClap: 'Tapez dans vos mains sur chaque bip ({n}/8)!',
  calibStepCompute: 'Calcul de la latence...', calibClapBadge: 'CLAP {n}/8', calibAutoTestBadge: 'AUTO-TEST',

  // Livret 1 - Onde & Trim
  waveformTitle: "Editeur de Forme d'Onde & Normalisation", trimStartFlag: 'DEBUT', trimEndFlag: 'FIN',
  trimHelpNotice: 'Glissez les poignees Debut (bleue) et Fin (rouge) pour couper les respirations : calage rythmique 100 % verrouille.',
  zoomSeeStart: 'Voir Debut', zoomSeeEnd: 'Voir Fin', zoomComplete: '1x (Complet)',
  zoomInTitle: 'Zoomer (Ctrl + Molette avant)', zoomOutTitle: 'Dezoomer (Ctrl + Molette arriere)',
  zoomSeeStartTitle: 'Centrer la vue sur la poignee Debut', zoomSeeEndTitle: 'Centrer la vue sur la poignee Fin',
  lowCutStudio: 'Coupe-bas Studio (90 Hz)', clickWitness: 'Clic temoin', listenTakeAgain: 'Reecouter',
  extractMelodyAndLyrics: 'Extraire Melodia & Letra', offsetMeasure1: 'Decalage M1 :',
  anacrusisLabel: 'Anacrouse', anacrusisBeats: '{beats} tps', cleanDurationLabel: 'Duree utile :',
  stopTake: 'Stop', rerecordTake: 'Refaire', normalizedVolume: 'Volume normalise (-16 LUFS)',

  // Livret 2 - Outils Piano Roll & Gammes
  toolPointer: 'Deplacer / Ecrire', toolGlue: 'Coller', toolCut: 'Couper', toolErase: 'Gomme', toolText: 'Texte',
  undo: 'Annuler (Ctrl+Z)', redo: 'Retablir (Ctrl+Y)', scaleLabel: 'Gamme', smoothingLabel: 'Lissage',
  smoothingFine: 'Fin', smoothingWide: 'Large',
  scaleChromatic: 'Chromatique (Libre)', scaleMajor: 'Majeur', scaleNaturalMinor: 'Mineur Naturel',
  scaleMixolydian: 'Mixolidien / Nordeste (7e min)', scaleDorian: 'Dorien',
  scalePentatonicMinor: 'Pentatonique Mineure', scalePentatonicMajor: 'Pentatonique Majeure',
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
};
