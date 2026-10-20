/**
 * MaracatuGameEvaluationCard.tsx
 * Carte d'évaluation des exercices de chant du Maracatu (< 50 lignes).
 */
import React from 'react';
import type { MaracatuGameId, VocalGameEvaluation } from '../../audio/vocalGameAnalyzers';

interface Props {
  evaluation: VocalGameEvaluation;
  gameId: MaracatuGameId;
  t: (k: any, p?: any) => string;
}

export const MaracatuGameEvaluationCard: React.FC<Props> = ({ evaluation, gameId, t }) => {
  return (
    <div className={`cordel-card-sm p-3 text-xs font-bold space-y-1.5 rounded border ${
      evaluation.isSuccess ? 'border-[#0f766e]/30 text-[#0f766e] dark:text-[#2dd4bf]' : 'border-[#c25e38]/30 text-[#9a3412] dark:text-[#e69d35]'
    }`}>
      <div>{t(evaluation.feedbackKey)}</div>
      {gameId === 'o_chamado' && (
        <div className="font-mono text-[11px]">
          {t('game2MetricsLabel', {
            rms: (evaluation.avgRms * 100).toFixed(1),
            cents: evaluation.centsDiff,
            brilliance: evaluation.brillianceRatio,
          })}
        </div>
      )}
      {gameId === 'voz_no_passo' && evaluation.beatStatuses && (
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span>{t('game3BeatsLabel')}</span>
          {evaluation.beatStatuses.map((ok, i) => (
            <span key={i} className={`px-2 py-0.5 border rounded text-white ${ok ? 'bg-[var(--cordel-coro)] border-[var(--cordel-coro)]' : 'bg-[#c25e38] border-[#c25e38]'}`}>
              T{i + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
