/**
 * i18n.types.ts
 * Typage strict du moteur i18n pour O Girador - Atelier Vocal (Oficina Vocal).
 * Supporte le binome [ Langue de l utilisateur (FR) | Portugais Bresilien (BR) ].
 */

export type Locale = 'fr' | 'br';
export type TranslationParams = Record<string, string | number>;

export interface VocalLabTranslations {
  // En-tete
  appTitle: string; appSubtitle: string; themeToggle: string;
  tabLivret1: string; tabLivret2: string; tabLivret3: string;

  // Jalon 4.A : Bibliotheque & Conducteur de Toada
  patternLibraryTitle: string; addPuxadorPattern: string; addCoroPattern: string;
  rolePuxador: string; roleCoro: string; patternAudioRecorded: string; patternAudioMissing: string;
  editPatternNameTooltip: string; deletePatternTooltip: string;
  conductorTitle: string; addConductorBlock: string; playFullToada: string; stopFullToada: string;
  railPuxador: string; railCoro: string; emptySlot: string; blockLabel: string;
  cueSelectorLabel: string; cueNone: string; cueAutoPrevious: string; cueCustomPrefix: string; cueReadyBadge: string;

  // Jalon 4.B : Matrice de Declinaisons Audio
  pattern_variants_title: string; variant_speed_nominal: string; variant_speed_slow: string;
  variant_speed_extra: string; variant_add_speed_3: string; variant_pitch_nominal: string;
  variant_pitch_low: string; variant_pitch_high: string; variant_add_pitch_3: string;
  variant_status_recorded: string; variant_status_pending: string;
  variant_tempo_banner: string; variant_pitch_banner: string;
  export_toada_pack: string; export_toada_pack_success: string;

  // Jalon 4.C : Livret 3 - Entrainement Vocal & Karaoke
  trainer_scope_pattern: string; trainer_scope_toada: string;
  trainer_role_coro: string; trainer_role_puxador: string; trainer_role_all: string;
  trainer_guide_accompanied: string; trainer_guide_voice_only: string; trainer_guide_autonomous: string;
  trainer_speed_nominal: string; trainer_speed_slow: string;
  karaoke_your_turn: string; karaoke_listen_guide: string; karaoke_no_lyrics: string;
  btn_start_training: string; btn_stop_training: string;
  btn_listen_student_duo: string; btn_listen_student_solo: string;
  trainer_accuracy_badge: string; export_student_report: string; student_report_filename: string;

  // Balancier & Cycle de Prise
  pendulumIdleTitle: string; pendulumStatusIdle: string;
  pendulumStatusPrecount: string; pendulumStatusRec: string; pendulumSyncImpact: string;
  phasePrecount: string; phaseAnacrusis: string; phaseSinging: string; phaseCompletedTitle: string;

  // Livret 1 - Metrique & Enregistrement
  metricTitle: string; timeSignature: string; tempoBpm: string; measuresCount: string;
  subdivisions: string; elanAnacrusis: string; measure1: string; measureAbbr: string;
  btnStartRecording: string; btnStopRecording: string; recordBtnStop: string; measureUnitShort: string;

  // Livret 1 - Ecoute & Repere
  listeningModeTitle: string; modeHeadphones: string; modeVisual: string;
  referencePitch: string; octave: string; octaveShort: string; testPitch: string; clickVolumeLabel: string;
  note_C: string; note_Cs: string; note_D: string; note_Ds: string;
  note_E: string; note_F: string; note_Fs: string; note_G: string;
  note_Gs: string; note_A: string; note_As: string; note_B: string;

  // Livret 1 - Materiel & Calibration
  audioDevices: string; soundCardDevices: string; devicePanelTitle: string;
  connected: string; deviceConnectedBadge: string; refresh: string; deviceRefreshBtn: string;
  authorizeAudio: string; micInputPureDirect: string; deviceMicInputLabel: string;
  headphonesOutputDirect: string; deviceOutputLabel: string; clickAuthorizeAudio: string;
  defaultMicLabel: string; defaultOutputLabel: string;
  calibReadyBadge: string; calibRecalibrateBtn: string;
  calibNewDeviceWarn: string; calibNewDeviceWarnBtn: string;
  calibBtnFirstTime: string; calibBtnRecalibrate: string;
  calibMethodAutoPing: string; calibMethodHumanSync: string;
  calibAutoPingTooltip: string; calibHumanSyncTooltip: string;
  calibPingInstruction: string; calibPingFailed: string;
  calibRetryPing: string; calibCancelTooltip: string;
  calibStepListen: string; calibStepClap: string;
  calibStepCompute: string; calibClapBadge: string; calibAutoTestBadge: string;

  // Livret 1 - Onde & Trim
  waveformTitle: string; trimStartFlag: string; trimEndFlag: string; trimHelpNotice: string;
  zoomSeeStart: string; zoomSeeEnd: string; zoomComplete: string;
  zoomInTitle: string; zoomOutTitle: string; zoomSeeStartTitle: string; zoomSeeEndTitle: string;
  lowCutStudio: string; clickWitness: string; listenTakeAgain: string; extractMelodyAndLyrics: string;
  offsetMeasure1: string; anacrusisLabel: string; anacrusisBeats: string;
  cleanDurationLabel: string; stopTake: string; rerecordTake: string; normalizedVolume: string;

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
