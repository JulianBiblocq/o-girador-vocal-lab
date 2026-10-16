/**
 * SlicerExtractionPanel.tsx
 * Panneau de configuration du pattern cible et declenchement de l'extraction (< 120 lignes).
 */
import React from 'react';
import type { VocalRole } from '../../types/toadaProject.types';
import { Scissors, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerExtractionPanelProps {
  role: VocalRole; patternName: string; isExtracting: boolean;
  pegsCount: number; lastExtractedName: string | null;
  onRoleChange: (r: VocalRole) => void;
  onNameChange: (n: string) => void;
  onExtract: () => void;
}

export const SlicerExtractionPanel: React.FC<SlicerExtractionPanelProps> = ({
  role, patternName, isExtracting, pegsCount, lastExtractedName,
  onRoleChange, onNameChange, onExtract
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2.5 p-3 cordel-card bg-theme-bg/80 border border-theme-border/70 text-xs font-mono">
      {/* 1. Choix du Role (Puxador / Coro) & Nom */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center p-0.5 cordel-card-sm select-none">
          <button
            type="button" onClick={() => onRoleChange('puxador')}
            className={`h-7 px-2.5 text-xs font-bold cursor-pointer transition-colors ${
              role === 'puxador' ? 'bg-role-puxador text-[#f4ecd8] font-black' : 'opacity-60 hover:opacity-100'
            }`}
          >
            PUXADOR
          </button>
          <button
            type="button" onClick={() => onRoleChange('coro')}
            className={`h-7 px-2.5 text-xs font-bold cursor-pointer transition-colors ${
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
          className="flex-1 min-w-[160px] h-7 px-2.5 cordel-card-sm bg-black/30 border border-theme-border/60 text-xs font-mono text-theme-ink outline-none"
        />
      </div>

      {/* 2. Bouton d'Extraction */}
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
            <span>{t('slicerCreatePatternBtn')}</span>
          </>
        )}
      </button>

      {/* 3. Feedback d'extraction reussie */}
      {lastExtractedName && (
        <div className="flex items-center gap-1.5 p-1.5 bg-emerald-950/40 border border-emerald-500/50 text-[11px] text-emerald-300">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Pattern « <strong>{lastExtractedName}</strong> » créé avec succès ! Prêt pour le Piano Roll.</span>
        </div>
      )}
    </div>
  );
};
