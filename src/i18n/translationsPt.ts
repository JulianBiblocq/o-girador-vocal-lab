/**
 * translationsPt.ts
 * Dicionário de tradução Português do Brasil para O Girador • Laboratório Vocal.
 */
import type { TranslationKey } from './translationsFr';

export const translationsPt: Record<TranslationKey, string> = {
  // Cabeçalho
  appTitle: 'O Girador • Laboratório Vocal',
  appSubtitle: 'Relógio 60 FPS • Metrônomo Afinado • Balancim Cinemático',
  themeToggle: 'Alternar tema (Claro / Escuro)',
  viewFullWidth: 'Tela Cheia',
  viewCompact: 'Compacto',
  tabLivret1: '🎙️ Livreto 1 : Gravação',
  tabLivret2: '🎵 Livreto 2 : Melodia e Letra',
  port: 'Porta 5177',

  // Livreto 1 - Métrica
  metricTitle: 'Métrica e Andamento',
  timeSignature: 'Fórmula de Compasso',
  tempoBpm: 'Andamento (BPM)',
  measuresCount: 'Compassos',
  subdivisions: 'Subdivisões',
  elanAnacrusis: 'Anacruse / Impulso (M-1)',
  measure1: 'C1 (★ T1)',

  // Livreto 1 - Escuta & Referência
  listeningModeTitle: 'Modo de Escuta e Referência',
  modeHeadphones: 'Modo Fone (Clique + Guia)',
  modeVisual: 'Modo Visual (Silencioso)',
  referencePitch: 'Nota de Referência',
  octave: 'Oitava',
  testPitch: 'Testar',

  // Livreto 1 - Dispositivos & Calibração
  audioDevices: 'Dispositivos de Áudio',
  microphone: 'Microfone',
  audioOutput: 'Saída de Áudio',
  calibrateBtn: 'Calibrar Aparelho (8 Palmas)',
  calibrationTitle: 'Calibração de Latência',
  calibratedOffset: 'Latência estimada',

  // Livreto 1 - Gravação & Onda
  recordBtnStart: 'Gravar',
  recordBtnStop: 'Parar',
  countdownText: 'Contagem (M-2)',
  singingText: 'Gravando tomada...',
  waveformTitle: 'Editor de Forma de Onda e Normalização',
  listenTake: 'Ouvir Tomada',
  highpassFilter: 'Corte de Graves (90 Hz)',
  extractMelody: 'Extrair Melodia',
  rerecord: 'Regravar',

  // Livreto 2 - Ferramentas Piano Roll
  toolPointer: 'Mover / Escrever',
  toolGlue: 'Colar',
  toolCut: 'Cortar',
  toolErase: 'Borracha',
  toolText: 'Texto',
  undo: 'Desfazer (Ctrl+Z)',
  redo: 'Refazer (Ctrl+Y)',
  scaleLabel: 'Escala',
  smoothingLabel: 'Suavização',
  rulerMeasures: 'COMPASSOS',
  rulerBeats: 'TEMPOS',
  pianoRollHint: 'Clique Direito = Paleta de Ferramentas • Régua = Seek',

  // Livreto 2 - Transporte & Modos de reprodução
  modeIsolatedVoice: 'Voz Isolada',
  modeSynthesizer: 'Sintetizador',
  modeDuo: 'Duo (Voz + Synth)',
  metronomeClick: 'Clique metrônomo',
  backToRecording: 'Voltar à Gravação',
  downloadPack: 'Baixar Pack JSON',

  // Livreto 2 - Letra da Toada
  letraTitle: 'Letra da Toada (Texto e Alinhamento)',
  alignBtn: 'Alinhar',
  syllableCount: 'sílabas detectadas',
  syntaxGuide: 'Sintaxe: hífen (-) ou (--) para melisma, apóstrofo (\') ou (_) para elisão.',
  footerSandbox: 'O Girador Vocal Lab • Ambiente isolado • Zero colisão com Sequenciador',
  footerPack: 'Padrão VocalPackExport v1.0 • Puxador / Coro',
};
