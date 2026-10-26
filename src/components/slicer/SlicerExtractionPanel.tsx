/**
 * SlicerExtractionPanel.tsx
 * Panneau de configuration du pattern cible (nouveau ou existant) et extraction (< 115 lignes).
 */
import React from 'react';
import type { VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import { Scissors, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerExtractionPanelProps {
  patterns: VocalPatternItem[];
  targetPatternId: string;
  role: VocalRole;
  patternName: string;
  isExtracting: boolean;
  pegsCount: number;
  lastExtractedName: string | null;
  onTargetPatternChange: (id: string) => void;
  onRoleChange: (r: VocalRole) => void;
  onNameChange: (n: string) => void;
  onExtract: () => void;
}

export const SlicerExtractionPanel: React.FC<SlicerExtractionPanelProps> = ({
  patterns, targetPatternId, role, patternName, isExtracting, pegsCount, lastExtractedName,
  onTargetPatternChange, onRoleChange, onNameChange, onExtract,
}) => {
  const { t } = useLanguage();
  const isNew = targetPatternId === 'new';

  return (
    <div className="flex flex-col gap-2.5 p-3 cordel-card rounded text-xs font-mono">
      {/* 1. Sélecteur de destination (Bloc existant vs Nouveau) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-[var(--cordel-secondary-text)] uppercase">
          {t('slicerTargetBlockLabel')} :
        </label>
        <select
          value={targetPatternId}
          onChange={(e) => onTargetPatternChange(e.target.value)}
          className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] text-xs font-mono font-bold text-theme-ink px-2 py-1 rounded cursor-pointer truncate outline-none"
        >
          <option value="new">{t('slicerOptionCreateNew')}</option>
          <optgroup label={t('slicerExistingPatternsGroup')}>
            {patterns.map((p, idx) => (
              <option key={p.id} value={p.id}>
                {idx + 1}. [{p.role === 'puxador' ? 'PUX' : 'COR'}] {p.name} ({p.measuresCount}M)
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* 2. Si nouveau pattern : Choix du Rôle & Nom */}
      {isNew && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 cordel-card-sm rounded select-none">
            <button
              type="button" onClick={() => onRoleChange('puxador')}
              className={`h-7 px-2.5 text-xs font-bold rounded cursor-pointer transition-colors ${
                role === 'puxador' ? 'bg-role-puxador text-[#f4ecd8] font-black' : 'opacity-60 hover:opacity-100'
              }`}
            >
              PUXADOR
            </button>
            <button
              type="button" onClick={() => onRoleChange('coro')}
              className={`h-7 px-2.5 text-xs font-bold rounded cursor-pointer transition-colors ${
                role === 'coro' ? 'bg-role-coro text-[#f4ecd8] font-black' : 'opacity-60 hover:opacity-100'
              }`}
            >
              CORO
            </button>
          </div>

          <input
            type="text" value={patternName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('slicerPatternNamePlaceholder')}
            className="flex-1 min-w-[140px] h-7 px-2 cordel-card-sm bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded text-xs font-mono text-theme-ink outline-none"
          />
        </div>
      )}

      {/* 3. Bouton d'Extraction */}
      <button
        type="button" onClick={onExtract}
        disabled={isExtracting || pegsCount < 2}
        className={`w-full py-2.5 px-4 cordel-btn-primary flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase cursor-pointer transition-colors ${
          pegsCount < 2 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isExtracting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-[#f4ecd8]" />
            <span>{t('slicerCreatingPattern')}</span>
          </>
        ) : (
          <>
            <Scissors className="w-4 h-4 text-[#f4ecd8]" />
            <span>{isNew ? t('slicerCreatePatternBtn') : t('slicerInjectIntoExistingBtn')}</span>
          </>
        )}
      </button>

      {/* 4. Feedback d'extraction réussie */}
      {lastExtractedName && (
        <div className="flex items-center gap-1.5 p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[11px] text-emerald-800 dark:text-emerald-300">
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Pattern « <strong>{lastExtractedName}</strong> » mis à jour avec succès !</span>
        </div>
      )}
    </div>
  );
};
