/**
 * MetricScopeSelector.tsx
 * Commutateur de portée métrique [🌍 Tout le chant | 🎯 Ce bloc | ☑ Blocs cochés] (< 60 lignes).
 */
import React from 'react';
import type { MetricApplyScope } from '../../utils/projectBatchOps';
import { useLanguage } from '../../i18n/LanguageContext';
import { Globe, Crosshair, CheckSquare } from 'lucide-react';

interface MetricScopeSelectorProps {
  applyScope: MetricApplyScope;
  onApplyScopeChange: (scope: MetricApplyScope) => void;
  selectedCount: number;
  disabled?: boolean;
}

export const MetricScopeSelector: React.FC<MetricScopeSelectorProps> = ({
  applyScope, onApplyScopeChange, selectedCount, disabled = false,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between gap-1 p-1 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded text-[10.5px] font-mono">
      <button
        type="button" disabled={disabled} onClick={() => onApplyScopeChange('all')}
        className={`flex-1 py-1 px-1.5 flex items-center justify-center gap-1 font-bold transition-all cursor-pointer rounded ${
          applyScope === 'all' ? 'cordel-btn-primary !text-[var(--cordel-on-primary)]' : 'hover:bg-white/5 text-[var(--cordel-text)]/70'
        }`}
        title={t('scopeAll')}
      >
        <Globe className="w-3 h-3 text-current" />
        <span className="truncate">{t('scopeAll')}</span>
      </button>

      <button
        type="button" disabled={disabled} onClick={() => onApplyScopeChange('active')}
        className={`flex-1 py-1 px-1.5 flex items-center justify-center gap-1 font-bold transition-all cursor-pointer rounded ${
          applyScope === 'active' ? 'cordel-btn-primary !text-[var(--cordel-on-primary)]' : 'hover:bg-white/5 text-[var(--cordel-text)]/70'
        }`}
        title={t('scopeActive')}
      >
        <Crosshair className="w-3 h-3 text-current" />
        <span className="truncate">{t('scopeActive')}</span>
      </button>

      <button
        type="button" disabled={disabled} onClick={() => onApplyScopeChange('selected')}
        className={`flex-1 py-1 px-1.5 flex items-center justify-center gap-1 font-bold transition-all cursor-pointer rounded ${
          applyScope === 'selected' ? 'cordel-btn-primary !text-[var(--cordel-on-primary)]' : 'hover:bg-white/5 text-[var(--cordel-text)]/70'
        }`}
        title={t('scopeSelected', { n: selectedCount })}
      >
        <CheckSquare className="w-3 h-3 text-current" />
        <span className="truncate">{t('scopeSelected', { n: selectedCount })}</span>
      </button>
    </div>
  );
};
