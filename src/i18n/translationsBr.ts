/**
 * translationsBr.ts
 * Dicionario de traducao Portugues do Brasil para O Girador - Oficina Vocal (sem emojis).
 */
import type { VocalLabTranslations } from './i18n.types';

export const translationsBr: VocalLabTranslations = {
  // Cabecalho
  appTitle: 'O Girador - Oficina Vocal',
  appSubtitle: 'Relogio 60 FPS - Metronomo Afinado - Balancim Cinematico',
  themeToggle: 'Alternar tema (Claro / Escuro)',
  tabLivret1: 'Livreto 1 : Gravacao', tabLivret2: 'Livreto 2 : Melodia e Letra',

  // Jalon 4.A : Biblioteca & Regencia de Toada
  patternLibraryTitle: 'BIBLIOTECA DE PADROES (TOADA)',
  addPuxadorPattern: '+ Padrao Puxador', addCoroPattern: '+ Padrao Coro',
  rolePuxador: 'PUXADOR', roleCoro: 'CORO',
  patternAudioRecorded: 'Audio', patternAudioMissing: 'Vazio',
  editPatternNameTooltip: 'Renomear padrao', deletePatternTooltip: 'Excluir padrao',
  conductorTitle: 'LINHA DE REGENCIA DA TOADA', addConductorBlock: '+ Bloco',
  playFullToada: 'Ouvir Toada Completa', stopFullToada: 'Parar Toada',
  railPuxador: 'Puxador', railCoro: 'Coro', emptySlot: '- Vazio -', blockLabel: 'Bloco {n}',
  cueSelectorLabel: 'Chamada antes da tomada (C-2 e C-1) :', cueNone: 'Nenhuma (Apenas clique)',
  cueAutoPrevious: 'Padrao anterior da Regencia', cueCustomPrefix: 'Padrao :', cueReadyBadge: 'Pronto ({measures} C)',

  // Jalon 4.B : Matrice de Declinaisons Audio
  pattern_variants_title: 'DECLINACOES DE AUDIO DO PADRAO (ANTI-DISTORCAO)',
  variant_speed_nominal: '100 % Nominal (87-115 %)', variant_speed_slow: '74 % Reduzido (60-87 %)',
  variant_speed_extra: '55 % Ultra-lento (45-60 %)', variant_add_speed_3: '+ 3ª velocidade (55 %)',
  variant_pitch_nominal: 'Tom 0 (-2 a +2 tons)', variant_pitch_low: '-4 tons (-8 st)',
  variant_pitch_high: '+4 tons (+8 st)', variant_add_pitch_3: '+ 3º tom',
  variant_status_recorded: '✓ Tomada ajustada', variant_status_pending: '○ A gravar',
  variant_tempo_banner: 'Andamento nominal: {nominal} BPM -> Gravacao ajustada a {effective} BPM ({ratio} %)',
  variant_pitch_banner: 'Tom nominal: {nominal} -> Guia transposto para {effective} ({semitones} st)',
  export_toada_pack: 'Baixar Pack Toada JSON',
  export_toada_pack_success: 'Pack Toada multi-declinacoes pronto para Sequenciad\'Or !',

  // Balancim & Ciclo de Gravacao
  pendulumIdleTitle: 'AGUARDANDO CICLO DE GRAVACAO', pendulumStatusIdle: 'EM ESPERA',
  pendulumStatusPrecount: 'CONTAGEM: ESCUTE O ANDAMENTO (MICROFONE EM ESPERA)',
  pendulumStatusRec: 'GRAVANDO - CANTE!', pendulumSyncImpact: 'Pulso sincronizado',
  phasePrecount: 'CONTAGEM E TOM (Escute: {beat} / {beats})',
  phaseAnacrusis: 'ANACRUSE / IMPULSO (Cante se iniciar em contratempo : {beat} / {beats})',
  phaseSinging: 'CANTO: COMPASSO {current} / {total} (TEMPO {beat} / {beats})',
  phaseCompletedTitle: 'CICLO CONCLUIDO (PUNCH-OUT)',

  // Livreto 1 - Metrica & Gravacao
  metricTitle: 'Metrica e Andamento', timeSignature: 'Formula de Compasso', tempoBpm: 'Andamento (BPM)',
  measuresCount: 'Compassos Canto', subdivisions: 'Subdivisoes', elanAnacrusis: 'Anacruse / Impulso (C-1)',
  measure1: 'C1 (T1)', measureAbbr: 'C',
  btnStartRecording: 'GRAVAR A VOZ (1 C ANACRUSE + {measures} C CANTO)',
  btnStopRecording: 'PARAR GRAVACAO', recordBtnStop: 'PARAR GRAVACAO',
  measureUnitShort: '{n} C',

  // Livreto 1 - Escuta & Referencia
  listeningModeTitle: 'Modo de Escuta e Referencia', modeHeadphones: 'Com Fone (Clique + Guia)',
  modeVisual: 'Sem Fone (Silencioso)', referencePitch: 'Nota de Referencia (Diapasao)',
  octave: 'Oitava', octaveShort: 'Oit {oct}', testPitch: 'Testar', clickVolumeLabel: 'VOLUME (CLIQUE)',
  note_C: 'Do (C)', note_Cs: 'Do# (C#)', note_D: 'Re (D)', note_Ds: 'Re# (D#)',
  note_E: 'Mi (E)', note_F: 'Fa (F)', note_Fs: 'Fa# (F#)', note_G: 'Sol (G)',
  note_Gs: 'Sol# (G#)', note_A: 'La (A)', note_As: 'La# (A#)', note_B: 'Si (B)',

  // Livreto 1 - Dispositivos & Calibracao
  audioDevices: 'Dispositivos de Audio', soundCardDevices: 'PLACA DE SOM E DISPOSITIVOS',
  devicePanelTitle: 'PLACA DE SOM E DISPOSITIVOS', connected: 'CONECTADO', deviceConnectedBadge: 'CONECTADO',
  refresh: 'Atualizar', deviceRefreshBtn: 'Atualizar', authorizeAudio: 'Autorizar Audio',
  micInputPureDirect: 'Entrada de Microfone (Sinal Puro)', deviceMicInputLabel: 'Entrada de Microfone (Sinal Puro)',
  headphonesOutputDirect: 'Saida de Fone / Escuta (Roteamento direto)', deviceOutputLabel: 'Saida de Fone / Escuta (Roteamento direto)',
  clickAuthorizeAudio: 'Clique em « Autorizar Audio »', defaultMicLabel: 'Microphone {n}', defaultOutputLabel: 'Saida de audio {n}',
  calibReadyBadge: 'Aparelho calibrado ({ms} ms)', calibRecalibrateBtn: 'Recalibrar',
  calibNewDeviceWarn: 'Novo aparelho de audio detectado - CALIBRACAO NECESSARIA', calibNewDeviceWarnBtn: 'Calibrar',
  calibBtnFirstTime: 'Calibrar', calibBtnRecalibrate: 'Recalibrar',
  calibMethodAutoPing: 'Auto-Ping (2 s)', calibMethodHumanSync: 'Sincronia Humana (8 palmas)',
  calibAutoPingTooltip: 'Emite 3 pulsos para medir automaticamente a latencia de ida e volta',
  calibHumanSyncTooltip: 'Bata 8 palmas no ritmo do metronomo',
  calibPingInstruction: 'Silencio... Emitindo 3 pings acusticos',
  calibPingFailed: 'Sinal fraco ou nao detectado. Tente novamente ou use a Sincronia Humana.',
  calibRetryPing: 'Tentar novamente Auto-Ping', calibCancelTooltip: 'Cancelar',
  calibStepListen: 'Escute o andamento (4 pulsos)...', calibStepClap: 'Bata palmas em cada pulso ({n}/8)!',
  calibStepCompute: 'Calculando latencia...', calibClapBadge: 'PALMA {n}/8', calibAutoTestBadge: 'AUTO-TEST',

  // Livreto 1 - Onda & Trim
  waveformTitle: 'Editor de Forma de Onda e Normalizacao', trimStartFlag: 'INICIO', trimEndFlag: 'FIM',
  trimHelpNotice: 'Arraste as alcas Inicio (azul) e Fim (vermelha) para cortar as respiracoes: sincronismo ritmico 100% travado.',
  zoomSeeStart: 'Ver Inicio', zoomSeeEnd: 'Ver Fim', zoomComplete: '1x (Completo)',
  zoomInTitle: 'Aumentar zoom (Ctrl + Roda para frente)', zoomOutTitle: 'Diminuir zoom (Ctrl + Roda para tras)',
  zoomSeeStartTitle: 'Centralizar visualizacao na alca de Inicio', zoomSeeEndTitle: 'Centralizar visualizacao na alca de Fim',
  lowCutStudio: 'Corte de Graves (90 Hz)', clickWitness: 'Clique guia', listenTakeAgain: 'Ouvir tomada',
  extractMelodyAndLyrics: 'Extrair Melodia e Letra', offsetMeasure1: 'Deslocamento C1 :',
  anacrusisLabel: 'Anacruse', anacrusisBeats: '{beats} pulsos', cleanDurationLabel: 'Duracao util :',
  stopTake: 'Parar', rerecordTake: 'Regravar', normalizedVolume: 'Volume normalizado (-16 LUFS)',

  // Livreto 2 - Ferramentas Piano Roll & Escalas
  toolPointer: 'Mover / Escrever', toolGlue: 'Colar', toolCut: 'Cortar', toolErase: 'Borracha', toolText: 'Texto',
  undo: 'Desfazer (Ctrl+Z)', redo: 'Refazer (Ctrl+Y)', scaleLabel: 'Escala', smoothingLabel: 'Suavizacao',
  smoothingFine: 'Fina', smoothingWide: 'Ampla',
  scaleChromatic: 'Cromatica (Livre)', scaleMajor: 'Maior', scaleNaturalMinor: 'Menor Natural',
  scaleMixolydian: 'Mixolidio / Nordeste (7ª menor)', scaleDorian: 'Dorico',
  scalePentatonicMinor: 'Pentatonica Menor', scalePentatonicMajor: 'Pentatonica Maior',
  rulerMeasures: 'COMPASSOS', rulerBeats: 'TEMPOS', rulerElan: 'ANACRUSE (C-1)', rulerMeasure1: 'C1',
  pianoRollHint: 'Clique Direito = Paleta de Ferramentas - Regua = Seek',

  // Livreto 2 - Transporte & Letra
  modeIsolatedVoice: 'Voz Isolada', modeSynthesizer: 'Sintetizador', modeDuo: 'Duo (Voz + Synth)',
  metronomeClick: 'Clique metronomo', backToRecording: 'Voltar a Gravacao', downloadPack: 'Pack JSON',
  letraTitle: 'LETRA DA TOADA (Texto e Alinhamento)', alignBtn: 'Alinhar', syllableCount: 'silabas detectadas',
  syntaxGuide: 'Sintaxe: hifen (-) ou (--) para melisma, apostrofo (\') ou (_) para elisao.',
  letraNoActiveNotes: 'Nenhuma nota ativa detectada.', letraSpaceBadge: 'Espaco', letraTiedBadge: '- Ligado',
  letraSpaceTooltip: 'Palavra terminada (espaco)', letraTiedTooltip: 'Silaba ligada a proxima',
  letraWordsLabel: 'Palavras :', letraEmptyWords: '(vazio)',
  footerSandbox: 'O Girador - Oficina Vocal - Ambiente isolado - Zero colisao com Sequenciador',
  footerPack: 'Padrao VocalPackExport v1.0 - Puxador / Coro',
};
