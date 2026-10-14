/**
 * translationsFr.ts
 * Dictionnaire de traduction Français pour O Girador • Vocal Lab (sans emojis système).
 */
export const translationsFr = {
  // En-tête
  appTitle: 'O Girador • Vocal Lab',
  appSubtitle: 'Horloge 60 FPS • Métronome Accordé • Balancier Cinématique',
  themeToggle: 'Changer de thème (Clair / Sombre)',
  tabLivret1: 'Livret 1 : Prise',
  tabLivret2: 'Livret 2 : Melodia & Letra',

  // Livret 1 - Métrique
  metricTitle: 'Métrique & Tempo',
  timeSignature: 'Signature Rythmique',
  tempoBpm: 'Tempo (BPM)',
  measuresCount: 'Mesures Chant',
  subdivisions: 'Subdivisions',
  elanAnacrusis: 'Élan (M-1)',
  measure1: 'M1 (★ T1)',

  // Livret 1 - Écoute & Repère
  listeningModeTitle: "Mode d'écoute & Repère",
  modeHeadphones: 'Avec Casque (Clic + Guide)',
  modeVisual: 'Sans Casque (Silencieux)',
  referencePitch: 'Note de repère (Diapason)',
  octave: 'Octave',
  testPitch: 'Tester',

  // Livret 1 - Matériel & Calibration
  audioDevices: 'Périphériques Audio',
  microphone: 'Microphone',
  audioOutput: 'Sortie Audio',
  calibrateBtn: 'Calibrer Appareil (8 Palmas)',
  calibrationTitle: 'Calibration Latence',
  calibratedOffset: 'Latence estimée',

  // Livret 1 - Enregistrement & Onde
  recordBtnStart: 'Enregistrer',
  recordBtnStop: 'Arrêter',
  countdownText: 'Compte à rebours',
  singingText: 'Enregistrement en cours...',
  waveformTitle: "Éditeur de Forme d'Onde & Normalisation",
  listenTake: 'Écouter Tomada',
  highpassFilter: 'Coupure des graves (90 Hz)',
  extractMelody: 'Extraire Melodia',
  rerecord: 'Réenregistrer',

  // Livret 2 - Outils Piano Roll
  toolPointer: 'Déplacer / Écrire',
  toolGlue: 'Coller',
  toolCut: 'Couper',
  toolErase: 'Gomme',
  toolText: 'Texte',
  undo: 'Annuler (Ctrl+Z)',
  redo: 'Rétablir (Ctrl+Y)',
  scaleLabel: 'Gamme',
  smoothingLabel: 'Lissage',
  rulerMeasures: 'MESURES',
  rulerBeats: 'TEMPS',
  pianoRollHint: "Clic Droit = Palette d'outils • Règle cliquable = Seek",

  // Livret 2 - Transport & Modes de lecture
  modeIsolatedVoice: 'Voix seule',
  modeSynthesizer: 'Synthé seul',
  modeDuo: 'Duo (Voix + Synth)',
  metronomeClick: 'Clic métronome',
  backToRecording: 'Retour à la Prise',
  downloadPack: 'Pack JSON',

  // Livret 2 - Letra da Toada
  letraTitle: 'LETRA DA TOADA (Paroles & Alignement)',
  alignBtn: 'Aligner',
  syllableCount: 'syllabes détectées',
  syntaxGuide: 'Syntaxe : tiret (-) ou (--) pour mélisme, apostrophe (\') ou (_) pour élision.',
  footerSandbox: 'O Girador Vocal Lab • Bac à sable étanche • Zéro collision avec Sequenciador',
  footerPack: 'Standard VocalPackExport v1.0 • Puxador / Coro',
};

export type TranslationKey = keyof typeof translationsFr;
