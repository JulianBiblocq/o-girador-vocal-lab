/**
 * exportCleanupTranslationsBr.ts
 * Traduções PT-BR para o modal de exportação ao Sequenciador, unificação de tomadas e limpeza Cloud (< 45 linhas).
 */
import type { ExportCleanupTranslations } from './exportCleanupTranslations.types';

export const exportCleanupTranslationsBr: ExportCleanupTranslations = {
  exportTargetModalTitle: 'Integrar a Toada numa música — {repLabel}',
  exportTempoSyncBanner: 'Andamento alvo : o canto (gravado a {recBpm} BPM) será automaticamente ajustado ao andamento da música no Sequenciador ({seqBpm} BPM)',
  exportModeRhythmNoMidi: 'Ritmo & Voz (Sem MIDI)',
  exportModeFullWithMidi: 'Completo com MIDI',
  exportTroupeKeyLabel: 'Tonalidade Tropa :',
  exportSearchPlaceholder: 'Filtrar {repLabel}...',
  exportCreateNewBtn: 'Criar nova música ({repLabel})',
  exportNewSongTitleLabel: 'Título da música :',
  exportLinkedToadaBadge: 'Toada associada',
  exportIntegrateConfirmBtn: 'Integrar nesta música',
  exportStayInCantadorBtn: 'Ficar no Cantador',
  exportOpenInSequenciadorBtn: 'Ver a música no Sequenciador',
  exportDoneBannerTitle: 'Toada integrada em « {name} » (ajustada ao andamento do Sequenciador : {bpm} BPM) !',
  exportDoneStatsSummary: '{patterns} padrões ativos • {wavs} arquivo(s) .wav na nuvem • Áudio mestre {recBpm} ➔ {seqBpm} BPM',
  exportDoneCleanedBadge: '{count} .wav antigo(s) removido(s) da nuvem',
  exportMutualizeTitle: 'Frases repetidas com tomadas distintas detectadas',
  exportMutualizeSub: 'Unifique as tomadas repetidas antes do envio ao Sequenciador :',
  exportMutualizeOptSingle: 'Manter 1 única tomada (a melhor)',
  exportMutualizeOptPairAB: 'Manter um par A + B',
  exportMutualizeOptKeep: 'Manter separadas ({n})',
  exportMutualizeAdjacentBadge: 'Repetição seguida',
  exportMutualizeOccurrences: '{slots} blocos • {takes} tomadas',
  exportPreviewBestTakeTitle: 'Ouvir a melhor tomada selecionada',
  exportPurgeLocalUnusedLabel: 'Limpar também os padrões não utilizados localmente ({count} • {mb} Mo)',
  exportCloudAutoCleanHint: 'Limpeza Cloud automática : apenas os blocos ativos são enviados e os .wav antigos desta Toada são removidos.',
};
