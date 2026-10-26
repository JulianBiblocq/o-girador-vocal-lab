/**
 * translationsBr.ts
 * Dicionario de traducao Portugues do Brasil para O Girador - Oficina Vocal (sem emojis).
 */
import type { VocalLabTranslations } from './i18n.types';
import { slicerTranslationsBr } from './slicerTranslationsBr';
import { toadaSheetTranslationsBr } from './toadaSheetTranslationsBr'; import { treinoSubTranslationsBr } from './treinoSubTranslationsBr'; import { variantTranslationsBr } from './variantTranslationsBr';
import { tessituraTranslationsBr } from './tessituraTranslationsBr'; import { harmonyTranslationsBr } from './harmonyTranslationsBr';
import { cloudToadaTranslationsBr } from './cloudToadaTranslationsBr';
import { lexiconTranslationsBr } from './lexiconTranslationsBr';
import { livretNavTranslationsBr } from './livretNavTranslationsBr';

export const translationsBr: VocalLabTranslations = {
  // Cabecalho
  appTitle: 'O Girador — Cantador', appSubtitle: 'Oficina Vocal - Prosódia e Canto de Maracatu',
  themeToggle: 'Alternar tema (Claro / Escuro)',

  // Jalon 4.A : Biblioteca & Regencia de Toada
  patternLibraryTitle: 'BIBLIOTECA DE PADROES (TOADA)',
  addPuxadorPattern: 'Padrao Puxador', addCoroPattern: 'Padrao Coro', rolePuxador: 'PUXADOR', roleCoro: 'CORO', patternAudioRecorded: 'Audio', patternAudioMissing: 'Vazio',
  editPatternNameTooltip: 'Renomear padrao', deletePatternTooltip: 'Excluir padrao',
  conductorTitle: 'LINHA DE REGENCIA DA TOADA', addConductorBlock: 'Bloco', playFullToada: 'Ouvir Toada Completa', stopFullToada: 'Parar Toada',
  railPuxador: 'Puxador', railCoro: 'Coro', emptySlot: '- Vazio -', blockLabel: 'Bloco {n}',
  cueSelectorLabel: 'Chamada antes da tomada (C-2 e C-1) :', cueNone: 'Nenhuma (Apenas clique)',
  cueAutoPrevious: 'Padrao anterior da Regencia', cueCustomPrefix: 'Padrao :', cueReadyBadge: 'Pronto ({measures} C)',
  swapPuxadorCoroBtn: '⇄ Inverter Puxador ↔ Coro', swapRolesTooltip: 'Inverter globalmente os papéis Puxador e Coro (padrões, condutor e ficha)', duplicateVariation: '❐ (2)', duplicateVariationTooltip: 'Duplicar este padrão em uma variação independente (2)',
  scopeAll: '🌍 Toda a toada', scopeActive: '🎯 Apenas este bloco', scopeSelected: '☑ Blocos marcados ({n})', selectAll: 'Marcar todos', deselectAll: 'Desmarcar todos', selectPatternCheckbox: 'Selecionar este bloco',
  importPreconfigTitle: 'CONFIGURAÇÕES PADRÃO DO CANTO', importDefaultBpm: 'BPM :', importMeasuresPerLine: 'Compassos / linha :', importAnacrusisDefault: 'Anacruse :',
  btnSaveToada: 'Salvar', btnSavedSuccess: 'Salvo !', saveToadaTooltip: 'Salvar Toada (Ctrl+S)', toadaSavedToast: 'Toada salva com sucesso!', saveAndExportMenu: 'Salvar & Exportar', exportFullSongWav: 'Exportar áudio do canto (.wav)', wavExportSuccess: 'Canto completo exportado em .wav com sucesso!',

  export_toada_pack: 'Baixar Pack Toada JSON', export_toada_pack_success: 'Pack Toada multi-declinacoes pronto para Sequenciad\'Or !',

  // Jalon 4.C : Livret 3 - Entrainement Vocal & Karaoke
  trainer_scope_pattern: 'Padrao ativo', trainer_scope_toada: 'Toada completa (Regencia)',
  trainer_role_coro: 'Eu canto : CORO', trainer_role_puxador: 'Eu canto : PUXADOR', trainer_role_all: 'Eu canto : TUDO',
  trainer_guide_accompanied: 'Acompanhado (Voz + Synth)', trainer_guide_voice_only: 'Apenas voz original', trainer_guide_autonomous: 'Autonomo (Chamada-Resposta pura)',
  trainer_speed_nominal: '100 % (Nominal)', trainer_speed_slow: '74 % (Reduzido)',
  karaoke_your_turn: 'SUA VEZ DE CANTAR !', karaoke_listen_guide: 'ESCUTE O GUIA', karaoke_no_lyrics: '(Sem letra neste compasso)',
  btn_start_training: 'Iniciar treino', btn_stop_training: 'Parar',
  btn_listen_student_duo: 'Minha voz + Guia', btn_listen_student_solo: 'Minha voz apenas',
  trainer_accuracy_badge: 'Afinacao : {score} % ({ok}/{total} notas no alvo)',
  export_student_report: 'Exportar Relatorio do Aluno (.json)', student_report_filename: 'relatorio_treino_vocal',

  // Balancim & Ciclo de Gravacao
  pendulumIdleTitle: 'AGUARDANDO CICLO DE GRAVACAO', pendulumStatusIdle: 'EM ESPERA',
  pendulumStatusPrecount: 'CONTAGEM: ESCUTE O ANDAMENTO (MICROFONE EM ESPERA)', pendulumStatusRec: 'GRAVANDO - CANTE!', pendulumSyncImpact: 'Pulso sincronizado',
  phasePrecount: 'CONTAGEM E TOM (Escute: {beat} / {beats})', phaseAnacrusis: 'ANACRUSE / IMPULSO (Cante se iniciar em contratempo : {beat} / {beats})',
  phaseSinging: 'CANTO: COMPASSO {current} / {total} (TEMPO {beat} / {beats})', phaseCompletedTitle: 'CICLO CONCLUIDO (PUNCH-OUT)',

  // Livreto 1 - Metrica & Gravacao
  metricTitle: 'Metrica e Andamento', timeSignature: 'Formula de Compasso', tempoBpm: 'Andamento (BPM)', measuresCount: 'Compassos Canto', subdivisions: 'Subdivisoes',
  elanAnacrusis: 'Anacruse / Impulso (C-1)', measure1: 'C1 (T1)', measureAbbr: 'C', btnStartRecording: 'GRAVAR A VOZ (1 C ANACRUSE + {measures} C CANTO)',
  btnStopRecording: 'PARAR GRAVACAO', recordBtnStop: 'PARAR GRAVACAO', measureUnitShort: '{n} C',

  // Livreto 1 - Escuta & Referencia
  listeningModeTitle: 'Modo de Escuta e Referencia', modeHeadphones: 'Com Fone (Clique + Guia)', modeVisual: 'Sem Fone (Silencioso)',
  referencePitch: 'Nota de Referencia (Diapasao)', octave: 'Oitava', octaveShort: 'Oit {oct}', testPitch: 'Testar', clickVolumeLabel: 'VOLUME (CLIQUE)',
  note_C: 'Do (C)', note_Cs: 'Do# (C#)', note_D: 'Re (D)', note_Ds: 'Re# (D#)', note_E: 'Mi (E)', note_F: 'Fa (F)', note_Fs: 'Fa# (Fs)', note_G: 'Sol (G)', note_Gs: 'Sol# (Gs)', note_A: 'La (A)', note_As: 'La# (As)', note_B: 'Si (B)',
  solfege_C: 'Dó', solfege_Cs: 'Dó#', solfege_D: 'Ré', solfege_Ds: 'Ré#', solfege_E: 'Mi', solfege_F: 'Fá', solfege_Fs: 'Fá#', solfege_G: 'Sol', solfege_Gs: 'Sol#', solfege_A: 'Lá', solfege_As: 'Lá#', solfege_B: 'Si',

  // Livreto 1 - Dispositivos & Calibracao
  audioDevices: 'Dispositivos de Audio', soundCardDevices: 'PLACA DE SOM E DISPOSITIVOS', devicePanelTitle: 'PLACA DE SOM E DISPOSITIVOS',
  connected: 'CONECTADO', deviceConnectedBadge: 'CONECTADO', refresh: 'Atualizar', deviceRefreshBtn: 'Atualizar', authorizeAudio: 'Autorizar Audio',
  micInputPureDirect: 'Entrada de Microfone (Sinal Puro)', deviceMicInputLabel: 'Entrada de Microfone (Sinal Puro)', headphonesOutputDirect: 'Saida de Fone / Escuta (Roteamento direto)', deviceOutputLabel: 'Saida de Fone / Escuta (Roteamento direto)',
  clickAuthorizeAudio: 'Clique em « Autorizar Audio »', defaultMicLabel: 'Microphone {n}', defaultOutputLabel: 'Saida de audio {n}',
  calibReadyBadge: 'Aparelho calibrado ({ms} ms)', calibRecalibrateBtn: 'Recalibrar', calibNewDeviceWarn: 'Novo aparelho de audio detectado - CALIBRACAO NECESSARIA', calibNewDeviceWarnBtn: 'Calibrar',
  calibBtnFirstTime: 'Calibrar', calibBtnRecalibrate: 'Recalibrar', calibMethodAutoPing: 'Auto-Ping (2 s)', calibMethodHumanSync: 'Sincronia Humana (8 palmas)',
  calibAutoPingTooltip: 'Emite 3 pulsos para medir automaticamente a latencia de ida e volta', calibHumanSyncTooltip: 'Bata 8 palmas no ritmo do metronomo',
  calibPingInstruction: 'Silencio... Emitindo 3 pings acusticos', calibPingFailed: 'Sinal fraco ou nao detectado. Tente novamente ou use a Sincronia Humana.',
  calibRetryPing: 'Tentar novamente Auto-Ping', calibCancelTooltip: 'Cancelar', calibStepListen: 'Escute o andamento (4 pulsos)...',
  calibStepClap: 'Bata palmas em cada pulso ({n}/8)!', calibStepCompute: 'Calculando latencia...', calibClapBadge: 'PALMA {n}/8', calibAutoTestBadge: 'AUTO-TEST',

  // Livreto 1 - Onda & Trim
  waveformTitle: 'Editor de Forma de Onda e Normalizacao', trimStartFlag: 'INICIO', trimEndFlag: 'FIM',
  trimHelpNotice: 'Arraste as alças Início e Fim para cortar as respirações: alinhamento rítmico 100% travado.',
  zoomSeeStart: 'Ver Inicio', zoomSeeEnd: 'Ver Fim', zoomComplete: '1x (Completo)',
  zoomInTitle: 'Aumentar zoom (Ctrl + Roda para frente)', zoomOutTitle: 'Diminuir zoom (Ctrl + Roda para tras)',
  zoomSeeStartTitle: 'Centralizar visualizacao na alca de Inicio', zoomSeeEndTitle: 'Centralizar visualizacao na alca de Fim',
  lowCutStudio: 'Corte de Graves (90 Hz)', clarityDeEsser: 'Clareza & De-Esser', clarityDeEsserTooltip: 'Equalizador Anti-Caixa (320 Hz), Presença (3,2 kHz) e Suavizador de sibilantes (6,5 kHz)', clickWitness: 'Clique guia', listenTakeAgain: 'Ouvir tomada',
  extractMelodyAndLyrics: 'Extrair Melodia e Letra', offsetMeasure1: 'Deslocamento C1 :',
  anacrusisLabel: 'Anacruse', anacrusisBeats: '{beats} pulsos', cleanDurationLabel: 'Duracao util :',
  stopTake: 'Parar', rerecordTake: 'Regravar', normalizedVolume: 'Volume normalizado (-16 LUFS)',

  // Livreto 2 - Ferramentas Piano Roll & Escalas
  toolPointer: 'Mover / Escrever', toolGlue: 'Colar', toolCut: 'Cortar', toolErase: 'Borracha', toolText: 'Texto',
  undo: 'Desfazer (Ctrl+Z)', redo: 'Refazer (Ctrl+Y)', scaleLabel: 'Escala', smoothingLabel: 'Suavizacao',
  smoothingFine: 'Fina', smoothingWide: 'Ampla',
  scaleChromatic: 'Cromatica (Livre)', scaleMajor: 'Maior', scaleNaturalMinor: 'Menor Natural', scaleMixolydian: 'Mixolidio / Nordeste (7ª menor)', scaleDorian: 'Dorico', scalePentatonicMinor: 'Pentatonica Menor', scalePentatonicMajor: 'Pentatonica Maior',
  rulerMeasures: 'COMPASSOS', rulerBeats: 'TEMPOS', rulerElan: 'ANACRUSE (C-1)', rulerMeasure1: 'C1',
  pianoRollHint: 'Clique Direito = Paleta de Ferramentas - Regua = Seek',

  // Livreto 2 - Transporte & Letra
  modeIsolatedVoice: 'Voz Isolada', modeSynthesizer: 'Sintetizador', modeDuo: 'Duo (Voz + Synth)',
  metronomeClick: 'Clique metronomo', backToRecording: 'Voltar a Gravacao', downloadPack: 'Pack JSON', stopPlayback: '■ PARAR A LEITURA',
  letraTitle: 'LETRA DA TOADA (Texto e Alinhamento)', alignBtn: 'Alinhar', syllableCount: 'silabas detectadas',
  syntaxGuide: 'Sintaxe: hifen (-) ou (--) para melisma, apostrofo (\') ou (_) para elisao.',
  letraNoActiveNotes: 'Nenhuma nota ativa detectada.', letraSpaceBadge: 'Espaco', letraTiedBadge: '- Ligado',
  letraSpaceTooltip: 'Palavra terminada (espaco)', letraTiedTooltip: 'Silaba ligada a proxima',
  letraWordsLabel: 'Palavras :', letraEmptyWords: '(vazio)',
  footerSandbox: 'O Girador - Oficina Vocal - Ambiente isolado - Zero colisao com Sequenciador',
  footerPack: 'Padrao VocalPackExport v1.0 - Puxador / Coro',
  listenPitch: "Ouvir", doubleClickRename: "Clique duplo para renomear", puxadorSectionTitle: "Puxador", coroSectionTitle: "Coro", midiLockedTake1Notice: "Notas MIDI travadas na Tomada 1",

  // Livret 2 - Correction Vocale (Melodyne)
  melodyneTitle: 'CORREÇÃO VOCAL (MELODYNE)', melodyneSliderLabel: 'Ajustar voz às notas MIDI : {percent} %',
  melodynePresetRaw: '0 % Bruta', melodynePresetNatural: '50 % Natural', melodynePresetLocked: '100 % Cravado', melodyneLinkedHint: 'Ligação ativa: mover uma nota ajusta a voz', melodyneProcessing: 'Recalculando áudio...',

  // Condutor - Espelho & Sincronizacao
  mirrorToCoro: '⇄ Coro', mirrorToPuxador: '⇄ Puxador', mirrorToCoroTooltip: 'Copiar e sincronizar este padrão para o Coro', mirrorToPuxadorTooltip: 'Copiar e sincronizar este padrão para o Puxador',
  syncBadge: '🔗 Sync : {source}', unlinkTooltip: 'Desvincular para editar separadamente',

  // Jalon 4.H - Découpe Melodyne & Gestion de Pack
  toolMelodyneCut: 'Corte Melodyne', toolMelodyneCutTooltip: 'Cortar o ataque (voz natural) sem dividir a nota MIDI',
  melodyneAttackSlider: 'Preservar ataque : {percent} %', reExtractNotes: '↺ Restaurar do Folheto 1 (Som e Notas)',
  reExtractNotesTooltip: 'Cancela as edições Melodyne e MIDI para recuperar o som original do Folheto 1 e re-extrair as notas do zero',
  reExtractNotesConfirm: 'Deseja restaurar do Folheto 1? As edições Melodyne serão canceladas e as notas MIDI re-extraídas do som bruto original (a letra digitada será mantida).',
  reExtractSuccessToast: 'Som e notas restaurados a partir do Folheto 1',
  openPack: 'Abrir Pack (.json)', openPackTooltip: 'Carregar e editar um projeto ou pack vocal JSON',
  exportPack: 'Exportar Pack (.json)', exportPackTooltip: 'Baixar a Toada completa e todas as variações de áudio',
  packLoadSuccess: 'Pack carregado com sucesso!', packLoadError: 'Erro ao carregar o arquivo JSON',

  // Dialogues Cordel Asynchrones
  dialogConfirm: 'Confirmar', dialogCancel: 'Cancelar', dialogOk: 'OK', dialogAlertTitle: 'Informação', dialogConfirmTitle: 'Confirmação',
  deletePatternConfirm: 'Deseja realmente excluir o padrão', deletePatternTitle: 'Excluir padrão',
  resetRecordingConfirm: 'Deseja regravar esta tomada? A gravação atual será perdida.', resetRecordingTitle: 'Regravar tomada',
  // Jalon 4.J - Zones Melodyne Libres [ In ── Out ]
  melodynePitchCenter: '🎯 Afinação (Centrar) : {percent} %', melodyneFlatten: '📏 Estabilidade (Aplanar) : {percent} %',
  melodyneCreateZoneBtn: 'Criar Zona In/Out', melodyneWholePhraseBtn: '+ Zona na frase inteira',
  melodyneDeleteZoneBtn: '✕ Excluir Zona', melodyneResetZoneBtn: '↺ Redefinir (0 %)',
  melodyneNoZoneSelected: 'Selecione ou crie uma zona [ In ── Out ] no Piano Roll',
  melodyneZoneActiveBadge: 'Zona [ IN: {start}s ── OUT: {end}s ]',
  melodyneZoneHelpHint: 'Arraste as alças [IN] e [OUT] sob a linha dos Tempos para ajustar a zona', melodyneRailLabel: 'ZONA',
  melodyneShiftDownOct: '🔽 -1 Oit', melodyneShiftUpOct: '🔼 +1 Oit', melodyneAlignToBricks: '🧲 Oitava ➔ Notas',
  melodynePurgeBtn: '✕ Limpar Melodyne (Som bruto)',
  melodynePurgeTooltip: 'Exclui todas as zonas Melodyne para ouvir o som 100% bruto do Folheto 1 mantendo as notas MIDI',
  melodynePurgeToast: 'Som bruto do Folheto 1 restaurado (zonas Melodyne limpas)',
  pwaInstallBtn: 'Instalar',

  ...cloudToadaTranslationsBr,
  ...lexiconTranslationsBr,
  ...livretNavTranslationsBr,
  ...slicerTranslationsBr, ...toadaSheetTranslationsBr, ...treinoSubTranslationsBr, ...variantTranslationsBr, ...tessituraTranslationsBr, ...harmonyTranslationsBr,
};
