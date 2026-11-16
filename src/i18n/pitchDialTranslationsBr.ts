/**
 * pitchDialTranslationsBr.ts
 * Dicionário PT-BR da Fase E : Mostrador Busca-Notas, Ditado Lento e Passo a Passo com Bordão (< 80 linhas).
 */
import type { PitchDialTranslations } from './pitchDialTranslations.types';

export const pitchDialTranslationsBr: PitchDialTranslations = {
  dialOpenDictationBtn: 'Busca-Notas',
  dialOpenDictationTitle: 'Abrir o Busca-Notas e Ditado lento (Código Papel + Bordão)',
  dialModalTitle: 'BUSCA-NOTAS E DITADO LENTO (PUXADOR)',
  dialHintUp: 'Suba',
  dialHintDown: 'Desça',
  dialHintHold: 'Segure !',
  dialHintSing: 'Cante...',
  dialViewSungKey: 'Voz cantada',
  dialViewTroupeKey: 'Tom da tropa',
  dialDroneBtn: 'Bordão',
  dialDroneActive: 'Bordão ON',
  dialListenNoteTitle: 'Ouvir esta nota no sintetizador (bloqueio anti-vazamento ativo)',
  dialMicStartBtn: 'Ouvir minha voz',
  dialMicStopBtn: 'Parar microfone',
  dialRibbonTitle: 'Fita de Ditado (sustentação >= 0,42 s)',
  dialRibbonEmpty: 'Sustente uma nota cantada ou toque [-½ / +½] para montar a frase...',
  dialPlaySequenceBtn: 'Ouvir sequência',
  dialCopyPaperBtn: 'Copiar Código Papel',
  dialCopiedToast: 'Código Papel copiado para a área de transferência !',
  dialClearRibbonBtn: 'Limpar',
  dialAttachToPatternBtn: 'Associar estas notas à frase ativa',
  dialAttachedToast: '{count} notas de referência associadas a « {name} » !',
  dialRefNotesBadge: 'Ref. {count} notas',
  stepModeRhythmBtn: 'No ritmo (Estrada)',
  stepModeStepByStepBtn: 'Passo a passo (Busca-Notas)',
  stepListenFirstNoteBtn: 'Ouvir a 1ª nota',
  stepListenCurrentNoteBtn: 'Nota alvo',
  stepAllValidatedBanner: 'Todas as sílabas validadas ! Pronto para cantar no ritmo sem teclado guia :',
  stepStartDroneClickNowBtn: 'Cantar agora no ritmo (Bordão + Clique, sem teclado)',
  trainer_guide_drone_click: 'Bordão + Clique (Sem teclado)',
  stepResetSyllablesBtn: 'Recomeçar sílabas',
  gameEnduranceRecordLabel: 'Recorde de fôlego afinado : {sec} s',
  gameArrowPlantedBadge: 'Flecha cravada no centro (150 ms + 1 s firme) !',
};
