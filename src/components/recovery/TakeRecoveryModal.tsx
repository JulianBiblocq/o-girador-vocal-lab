/**
 * TakeRecoveryModal.tsx
 * Modale 100 % locale de récupération et ré-alignement en 1 clic des fichiers `.wav` existants dans Firebase
 * (`/toada_packs` + explorateur d'orphelins `vocalRecordings/` filtrables par lot/date) (< 95 lignes).
 */
import React, { useCallback } from 'react';
import { X, RefreshCw, Download, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { RecoverTakeIcon } from '../icons/CordelActionIcons';
import { ProposalTakeRow, OrphanTakeRow } from './TakeRecoveryRow';
import { useTakeRecoveryController } from './useTakeRecoveryController';

export const TakeRecoveryModal: React.FC = () => {
  const isOpen = useVocalTransportStore((s) => s.isRecoveryModalOpen);
  const close = useCallback(() => useVocalTransportStore.getState().setRecoveryModalOpen(false), []);
  const c = useTakeRecoveryController(isOpen);

  if (!isOpen) return null;
  const { t, project, inv, loading, applying, tab, setTab, batchFilter, setBatchFilter, playingKey, matcherCtx, proposals, highProposals, titleMismatch, batches, filteredOrphans, refresh, handleTogglePlay, applyItems, bestPatternIdFor, handleBackupJson } = c;
  const patMap = new Map(project.patterns.map((p) => [p.id, p]));

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-3">
      <div className="cordel-card w-full max-w-3xl max-h-[90vh] flex flex-col gap-3 p-4 rounded-lg shadow-2xl border-2 border-[var(--cordel-wood)] font-mono">
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--cordel-border-sub)]">
          <div className="flex items-center gap-2">
            <RecoverTakeIcon className="w-5 h-5 text-[#9a3412] dark:text-amber-300 shrink-0" />
            <div>
              <h2 className="text-sm font-black uppercase text-theme-ink">{t('recoveryModalTitle')}</h2>
              <p className="text-[11px] opacity-75">{t('recoveryModalSub')}</p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded cordel-btn cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex rounded border border-[var(--cordel-border-sub)] overflow-hidden">
            <button type="button" onClick={() => setTab('matched')} className={`px-2.5 py-1 font-bold cursor-pointer ${tab === 'matched' ? 'cordel-btn-primary' : 'cordel-btn opacity-75'}`}>{t('recoveryTabMatched')} ({proposals.length})</button>
            <button type="button" onClick={() => setTab('orphans')} className={`px-2.5 py-1 font-bold cursor-pointer ${tab === 'orphans' ? 'cordel-btn-primary' : 'cordel-btn opacity-75'}`}>{t('recoveryTabOrphans')} ({inv?.orphanTakes.length ?? 0})</button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={handleBackupJson} className="px-2.5 py-1 rounded cordel-btn font-bold inline-flex items-center gap-1 cursor-pointer"><Download className="w-3.5 h-3.5" /><span>{t('recoveryBackupJsonBtn')}</span></button>
            <button type="button" disabled={loading || applying} onClick={() => void refresh()} className="px-2.5 py-1 rounded cordel-btn font-bold inline-flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>{t('recoveryRefreshBtn')}</span></button>
            {highProposals.length > 0 && (
              <button type="button" disabled={applying || loading} onClick={() => void applyItems(highProposals.map((p) => ({ patternId: p.patternId, take: p.take })))} className="px-3 py-1 rounded cordel-btn-primary font-bold inline-flex items-center gap-1.5 cursor-pointer">
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{t('recoveryApplyAllHighBtn', { count: highProposals.length })}</span>
              </button>
            )}
          </div>
        </div>

        {titleMismatch && inv?.pack && (
          <div className="p-2 rounded border border-amber-600/60 bg-amber-500/15 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('recoveryTitleMismatchWarn', { packTitle: inv.pack.title, projectTitle: project.title })}</span>
          </div>
        )}

        {tab === 'orphans' && batches.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="h-8 px-2 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] text-[var(--cordel-text)] font-bold cursor-pointer">
              <option value="ALL">{t('recoveryBatchAll', { count: inv?.orphanTakes.length ?? 0 })}</option>
              {batches.map(([k, b]) => <option key={k} value={k}>{b.label} ({b.count})</option>)}
            </select>
          </div>
        )}

        <div className="flex-1 overflow-y-auto cordel-scrollbar flex flex-col gap-1.5 pr-1 min-h-[180px]">
          {loading || applying ? (
            <div className="py-10 text-center text-xs opacity-80 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span>{applying ? t('recoveryApplying') : t('recoveryLoading')}</span></div>
          ) : tab === 'matched' ? (
            proposals.length === 0 ? <div className="py-8 text-center text-xs opacity-75">{t('recoveryEmptyMatched')}</div>
            : proposals.map((pr) => { const pat = patMap.get(pr.patternId); return pat ? <ProposalTakeRow key={pr.patternId} proposal={pr} pattern={pat} isPlaying={playingKey === pr.take.key} busy={applying} onTogglePlay={handleTogglePlay} onApply={(pid, tk) => void applyItems([{ patternId: pid, take: tk }])} /> : null; })
          ) : filteredOrphans.length === 0 ? (
            <div className="py-8 text-center text-xs opacity-75">{t('recoveryEmptyOrphans')}</div>
          ) : (
            filteredOrphans.map((tk) => <OrphanTakeRow key={tk.key} take={tk} patterns={project.patterns} matcherCtx={matcherCtx} defaultPatternId={bestPatternIdFor(tk.durationSec)} isPlaying={playingKey === tk.key} busy={applying} onTogglePlay={handleTogglePlay} onAssign={(pid, take) => void applyItems([{ patternId: pid, take }])} />)
          )}
        </div>
      </div>
    </div>
  );
};
