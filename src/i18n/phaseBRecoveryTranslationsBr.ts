/**
 * phaseBRecoveryTranslationsBr.ts
 * Dicionário PT-BR da Fase B : Linha de Regência, Recuperação de gravações (.wav) e VU-metro do Microfone (< 55 linhas).
 */
import type { PhaseBRecoveryTranslations } from './phaseBRecoveryTranslations.types';

export const phaseBRecoveryTranslationsBr: PhaseBRecoveryTranslations = {
  conductorAddBlockFull: '+ Adicionar um bloco',
  conductorAddBlockTitle: 'Adicionar um bloco vocal ao fim da Linha de Regência (vínculo estrito por patternId)',
  conductorInsertHere: 'Inserir um bloco aqui',
  conductorInsertAtEnd: 'Adicionar um bloco ao fim da linha',
  conductorRemoveBlockTitle: 'Remover esta coluna da linha (as gravações de áudio são preservadas)',
  structureEditConfirmTitle: 'Ativar edição manual da estrutura?',
  structureEditConfirmMsg: 'A Linha de Regência passará ao modo « Editar estrutura » para inserir ou remover colunas sem deslocar suas gravações de áudio.',
  structureEditConfirmOk: 'Editar estrutura',
  micMeterOff: 'Microfone parado',
  micMeterLow: 'Sinal fraco',
  micMeterOk: 'OK',
  micMeterClip: 'Saturação!',
  micMeterTitle: 'Nível do microfone em tempo real: fraco < -42 dBFS, ideal -42 a -3 dBFS, saturação >= -0,5 dBFS',
  recoveryOpenBtn: 'Recuperar gravações (.wav)',
  recoveryModalTitle: 'RECUPERAÇÃO E REALINHAMENTO DAS GRAVAÇÕES (.WAV)',
  recoveryModalSub: 'Leitura Cloud (/toada_packs & vocalRecordings/) — hidratação 100% local sem escrita remota',
  recoveryTabMatched: 'Pareamento da toada',
  recoveryTabOrphans: 'Arquivos órfãos no Storage',
  recoveryApplyAllHighBtn: 'Recuperar em 1 clique ({count})',
  recoveryBackupJsonBtn: 'Backup .json',
  recoveryRefreshBtn: 'Reler Cloud',
  recoveryLoading: 'Inspecionando faixas na nuvem...',
  recoveryApplying: 'Decodificando e alinhando localmente...',
  recoveryTitleMismatchWarn: 'Atenção: o pacote Cloud « {packTitle} » não corresponde à toada aberta « {projectTitle} ». Nenhuma gravação será aplicada automaticamente: ouça antes de associar.',
  recoveryBadgeHigh: 'Seguro',
  recoveryBadgeSuggest: 'Verificar',
  recoveryApplyOneBtn: 'Associar',
  recoveryAppliedToast: '{count} gravação(ões) recuperada(s) e realinhada(s) localmente!',
  recoveryBatchAll: 'Todos os lotes ({count})',
  recoveryAssignTargetLabel: 'Destino:',
  recoveryEmptyMatched: 'Nenhuma correspondência em /toada_packs. Consulte a aba de arquivos órfãos no Storage.',
  recoveryEmptyOrphans: 'Nenhum arquivo órfão encontrado em vocalRecordings/.',
  recoveryListenTitle: 'Ouvir este trecho .wav',
  recoveryStopTitle: 'Parar reprodução',
};
