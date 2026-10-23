/**
 * livretNavTranslationsBr.ts
 * Traduções em português brasileiro para navegação de 5 livretos + Ajustes (< 60 lignes).
 */
import type { LivretNavTranslations } from './livretNavTranslations.types';

export const livretNavTranslationsBr: LivretNavTranslations = {
  tabLivret1: '1. Estrutura e Canto',
  tabLivret2: '2. Cabine de Gravação',
  tabLivret3: '3. Ajuste e Corte',
  tabLivret4: '4. Melodia e Letra',
  tabLivret5: '5. Treino Vocal',
  tabReglages: '⚙️ Ajustes',
  compassPatternPrefix: 'Frase',
  compassEmptyAudio: 'Sem áudio',
  compassRecordedAudio: 'Gravado',
  compassPrevTooltip: 'Frase anterior',
  compassNextTooltip: 'Próxima frase',
  compassTotalCount: '{current} / {total}',
  goToCalageBtn: '✂️ Ajustar onda (Livreto 3) →',
  goToMelodiaBtn: '🎹 Notas e Letra (Livreto 4) →',
  goToCabineBtn: '🎙️ Ir para a Cabine (Livreto 2)',
  calageEmptyTitle: 'Nenhuma gravação vocal nesta frase',
  calageEmptyDesc: 'Grave sua voz na cabine (Livreto 2) ou importe diretamente um arquivo de áudio.',
  calageDirectImportBtn: '📂 Importar Áudio (Pattern)',
  calageOpenSlicerBtn: '✂️ Fatiar Toada Completa (Slicer)',
  melodiaEmptyTitle: 'Nenhuma melodia extraída para esta frase',
  melodiaEmptyDesc: 'Faça uma tomada no Livreto 2 ou confirme o ajuste no Livreto 3 para exibir o Piano Roll e a letra.',
  melodiaReExtractRawBtn: '↺ Reiniciar da Tomada bruta',
  statusMicDefault: 'Mic: Padrão',
  statusHeadphonesOn: 'Com fones',
  statusVisualMode: 'Sem fones (Visual)',
  statusTessituraLabel: 'Tessitura',
  statusQuickEditBtn: '⚙️ Alterar',
  grainPlayerAccordionTitle: '🎛️ Variações de Velocidade e Tom (GrainPlayer)',
  grainPlayerAccordionSummary: '{recorded}/4 gravadas • Ativa: {active}',
  reglagesTitle: 'AJUSTES DE ÁUDIO E DISPOSITIVOS',
  reglagesAudioSection: 'Placa de Áudio e Microfone',
  reglagesListeningSection: 'Modo de Escuta e Volume do Guia',
  reglagesCalibrationSection: 'Calibração e Latência',
  reglagesTessituraSection: 'Limites de Tessitura e Viterbi',
};
