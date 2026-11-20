/**
 * TakeRecoveryRow.tsx
 * Lignes de la modale de récupération : ligne d'appariement `ProposalRow` (pack Cloud) et ligne d'explorateur
 * `OrphanTakeRow` (fichiers Storage orphelins filtrables par lot/date, écoute ▶ et sélecteur de pattern cible) (< 115 lignes).
 */
import React, { useState } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { MatcherContext, RecoveryProposal, RecoveryTake } from '../../utils/takeRecoveryTypes';
import { expectedTakeDurationSec } from '../../utils/takeRecoveryMatcher';
import { useLanguage } from '../../i18n/LanguageContext';
import { PlayTriangleIcon, StopSquareIcon } from '../icons/CordelActionIcons';

interface ProposalRowProps {
  proposal: RecoveryProposal;
  pattern: VocalPatternItem;
  isPlaying: boolean;
  busy: boolean;
  onTogglePlay: (url?: string, key?: string) => void;
  onApply: (patternId: string, take: RecoveryTake) => void;
}

export const ProposalTakeRow: React.FC<ProposalRowProps> = ({ proposal, pattern, isPlaying, busy, onTogglePlay, onApply }) => {
  const { t } = useLanguage();
  const { take, confidence, checks } = proposal;
  const isHigh = confidence === 'high';
  return (
    <div className="p-2 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button" disabled={!take.url} onClick={() => onTogglePlay(take.url, take.key)}
          title={isPlaying ? t('recoveryStopTitle') : t('recoveryListenTitle')}
          className={`w-7 h-7 rounded inline-flex items-center justify-center shrink-0 cursor-pointer border ${isPlaying ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}
        >
          {isPlaying ? <StopSquareIcon className="w-3 h-3" /> : <PlayTriangleIcon className="w-3 h-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${pattern.role === 'puxador' ? 'bg-role-puxador' : 'bg-role-coro'}`}>
              {pattern.role.toUpperCase()}
            </span>
            <span className="font-bold truncate">{pattern.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isHigh ? 'bg-emerald-700 text-white' : 'bg-amber-600/25 text-amber-900 dark:text-amber-200 border border-amber-600/50'}`}>
              {isHigh ? t('recoveryBadgeHigh') : t('recoveryBadgeSuggest')}
            </span>
          </div>
          <div className="text-[11px] opacity-75 truncate">{pattern.assignedLyricsText || take.lyrics || take.storagePath}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] opacity-80">
          {take.durationSec.toFixed(2)}s / {checks.expectedSec.toFixed(2)}s • {take.sizeKb} Ko • T1 {checks.normalizedT1.toFixed(2)}s
        </span>
        <button type="button" disabled={busy} onClick={() => onApply(pattern.id, take)} className="px-2.5 py-1 rounded cordel-btn font-bold cursor-pointer disabled:opacity-50">
          {t('recoveryApplyOneBtn')}
        </button>
      </div>
    </div>
  );
};

interface OrphanRowProps {
  take: RecoveryTake;
  patterns: VocalPatternItem[];
  matcherCtx: MatcherContext;
  defaultPatternId: string;
  isPlaying: boolean;
  busy: boolean;
  onTogglePlay: (url?: string, key?: string) => void;
  onAssign: (patternId: string, take: RecoveryTake) => void;
}

export const OrphanTakeRow: React.FC<OrphanRowProps> = ({ take, patterns, matcherCtx, defaultPatternId, isPlaying, busy, onTogglePlay, onAssign }) => {
  const { t } = useLanguage();
  const [targetId, setTargetId] = useState<string>(defaultPatternId || patterns[0]?.id || '');
  const shortName = take.storagePath.replace(/^vocalRecordings\//, '');
  const optCls = 'bg-[var(--cordel-surface)] text-[var(--cordel-text)]';

  return (
    <div className="p-2 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button" disabled={!take.url} onClick={() => onTogglePlay(take.url, take.key)}
          title={isPlaying ? t('recoveryStopTitle') : t('recoveryListenTitle')}
          className={`w-7 h-7 rounded inline-flex items-center justify-center shrink-0 cursor-pointer border ${isPlaying ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}
        >
          {isPlaying ? <StopSquareIcon className="w-3 h-3" /> : <PlayTriangleIcon className="w-3 h-3" />}
        </button>
        <div className="min-w-0">
          <div className="font-bold truncate">{shortName}</div>
          <div className="text-[11px] opacity-75">
            {take.batchLabel} • <strong>{take.durationSec.toFixed(2)} s</strong> • {take.sizeKb} Ko
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] opacity-75">{t('recoveryAssignTargetLabel')}</span>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-7 px-1.5 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] text-[var(--cordel-text)] text-[11px] font-bold max-w-[230px] cursor-pointer">
          {patterns.map((p, idx) => {
            const exp = expectedTakeDurationSec(p, matcherCtx).toFixed(1);
            return <option key={p.id} value={p.id} className={optCls}>#{idx + 1} [{p.role === 'puxador' ? 'PUX' : 'COR'}] {p.name} (~{exp}s)</option>;
          })}
        </select>
        <button type="button" disabled={busy || !targetId} onClick={() => onAssign(targetId, take)} className="px-2.5 py-1 rounded cordel-btn-primary font-bold cursor-pointer disabled:opacity-50">
          {t('recoveryApplyOneBtn')}
        </button>
      </div>
    </div>
  );
};
