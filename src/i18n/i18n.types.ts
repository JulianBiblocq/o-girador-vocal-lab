/**
 * i18n.types.ts
 * Typage strict du moteur i18n pour O Girador • Vocal Lab.
 * Supporte le binôme [ Langue de l'utilisateur (FR) | Portugais Brésilien (BR) ].
 */

export type Locale = 'fr' | 'br';

export type TranslationParams = Record<string, string | number>;

export interface VocalLabTranslations {
  // En-tête
  appTitle: string;
  appSubtitle: string;
  themeToggle: string;
  tabLivret1: string;
  tabLivret2: string;

  // Balancier & Cycle de Prise
  pendulumIdleTitle: string;
  pendulumStatusIdle: string;
  pendulumStatusPrecount: string;
  pendulumStatusRec: string;
  pendulumSyncImpact: string;
  phasePrecount: string;
  phaseAnacrusis: string;
  phaseSinging: string;
  phaseCompletedTitle: string;

  // Livret 1 - Métrique & Enregistrement
  metricTitle: string;
  timeSignature: string;
  tempoBpm: string;
  measuresCount: string;
  subdivisions: string;
  elanAnacrusis: string;
  measure1: string;
  measureAbbr: string;
  btnStartRecording: string;
  btnStopRecording: string;
  recordBtnStop: string;
  measureUnitShort: string;

  // Livret 1 - Écoute & Repère
  listeningModeTitle: string;
  modeHeadphones: string;
  modeVisual: string;
  referencePitch: string;
  octave: string;
  octaveShort: string;
  testPitch: string;
  clickVolumeLabel: string;
  note_C: string; note_Cs: string; note_D: string; note_Ds: string;
  note_E: string; note_F: string; note_Fs: string; note_G: string;
  note_Gs: string; note_A: string; note_As: string; note_B: string;

  // Livret 1 - Matériel & Calibration
  audioDevices: string;
  soundCardDevices: string;
  devicePanelTitle: string;
  connected: string;
  deviceConnectedBadge: string;
  refresh: string;
  deviceRefreshBtn: string;
  authorizeAudio: string;
  micInputPureDirect: string;
  deviceMicInputLabel: string;
  headphonesOutputDirect: string;
  deviceOutputLabel: string;
  clickAuthorizeAudio: string;
  defaultMicLabel: string;
  defaultOutputLabel: string;
  calibReadyBadge: string;
  calibRecalibrateBtn: string;
  calibNewDeviceWarn: string;
  calibNewDeviceWarnBtn: string;
  calibStepListen: string;
  calibStepClap: string;
  calibStepCompute: string;
  calibClapBadge: string;
  calibAutoTestBadge: string;

  // Livret 1 - Onde & Trim
  waveformTitle: string;
  trimStartFlag: string;
  trimEndFlag: string;
  trimHelpNotice: string;
  zoomSeeStart: string;
  zoomSeeEnd: string;
  zoomComplete: string;
  zoomInTitle: string;
  zoomOutTitle: string;
  zoomSeeStartTitle: string;
  zoomSeeEndTitle: string;
  lowCutStudio: string;
  clickWitness: string;
  listenTakeAgain: string;
  extractMelodyAndLyrics: string;
  offsetMeasure1: string;
  anacrusisLabel: string;
  anacrusisBeats: string;
  cleanDurationLabel: string;
  stopTake: string;
  rerecordTake: string;
  normalizedVolume: string;

  // Livret 2 - Outils Piano Roll & Gammes
  toolPointer: string; toolGlue: string; toolCut: string; toolErase: string; toolText: string;
  undo: string; redo: string; scaleLabel: string; smoothingLabel: string;
  smoothingFine: string; smoothingWide: string;
  scaleChromatic: string; scaleMajor: string; scaleNaturalMinor: string;
  scaleMixolydian: string; scaleDorian: string; scalePentatonicMinor: string; scalePentatonicMajor: string;
  rulerMeasures: string; rulerBeats: string; rulerElan: string; rulerMeasure1: string;
  pianoRollHint: string;

  // Livret 2 - Transport & Letra
  modeIsolatedVoice: string; modeSynthesizer: string; modeDuo: string;
  metronomeClick: string; backToRecording: string; downloadPack: string;
  letraTitle: string; alignBtn: string; syllableCount: string; syntaxGuide: string;
  letraNoActiveNotes: string; letraSpaceBadge: string; letraTiedBadge: string;
  letraSpaceTooltip: string; letraTiedTooltip: string;
  letraWordsLabel: string; letraEmptyWords: string;
  footerSandbox: string; footerPack: string;
}

export type TranslationKey = keyof VocalLabTranslations;
