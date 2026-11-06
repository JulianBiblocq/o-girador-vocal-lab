/**
 * BlockMusicalSettingsCard.tsx
 * Carte inférieure du Livret 1 :
 * - En Mode Organizador Épuré (isManualStructureEdit === false) : simple affichage propre en lecture des Paroles de la phrase sélectionnée.
 * - En Mode Création / Édition Manuelle (isManualStructureEdit === true) : Signature 4/4..6/8, Durée 1M..4M, +Ana, +1T et éditeur de texte (< 120 lignes).
 */
import React from 'react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { resolveAnacrusisBadgeText } from '../conductor/PatternCardItem';

export interface BlockMusicalSettingsCardProps {
  activePattern: VocalPatternItem;
  timeSignature: TimeSignatureString;
  isManualStructureEdit: boolean;
  onTimeSignatureChange: (sig: TimeSignatureString) => void;
  onMeasuresCountChange: (count: 1 | 2 | 3 | 4) => void;
  onHasAnacrusisChange: (has: boolean) => void;
  onHasTailBeatChange: (has: boolean) => void;
  onLyricsChange: (lyrics: string) => void;
}

export const BlockMusicalSettingsCard: React.FC<BlockMusicalSettingsCardProps> = ({
  activePattern,
  timeSignature,
  isManualStructureEdit,
  onTimeSignatureChange,
  onMeasuresCountChange,
  onHasAnacrusisChange,
  onHasTailBeatChange,
  onLyricsChange,
}) => {
  const { t } = useLanguage();
  const isPuxador = activePattern.role === 'puxador';
  const hasAnacrusis = activePattern.hasAnacrusis !== false;
  const hasPlus1T = activePattern.hasTailBeat !== false || activePattern.exitBeat === 1;
  const anaBadge = resolveAnacrusisBadgeText(activePattern);

  return (
    <div className="cordel-card p-3 rounded flex flex-col gap-2 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded ${isPuxador ? 'bg-role-puxador text-white' : 'bg-role-coro text-white'}`}>
            {isPuxador ? t('rolePuxador') : t('roleCoro')}
          </span>
          <span className="font-bold text-theme-ink">{activePattern.name}</span>
          <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-stone-500/15 border border-[var(--cordel-border-sub)]">
            {activePattern.measuresCount}M
          </span>
          {anaBadge && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/50">
              {anaBadge}
            </span>
          )}
          {hasPlus1T && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/40">
              +1T
            </span>
          )}
        </div>

        {/* Contrôles métriques affichés UNIQUEMENT en Mode Création / Édition Manuelle */}
        {isManualStructureEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1">
              <span className="text-[10px] uppercase opacity-70 font-bold">Signature :</span>
              {(['4/4', '3/4', '2/4', '6/8'] as TimeSignatureString[]).map((sig) => (
                <button
                  key={sig} type="button" onClick={() => onTimeSignatureChange(sig)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${timeSignature === sig ? 'cordel-btn-primary' : 'cordel-btn'}`}
                >
                  {sig}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1">
              <span className="text-[10px] uppercase opacity-70 font-bold">Durée :</span>
              {([1, 2, 3, 4] as const).map((cnt) => (
                <button
                  key={cnt} type="button" onClick={() => onMeasuresCountChange(cnt)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${activePattern.measuresCount === cnt ? 'cordel-btn-primary' : 'cordel-btn'}`}
                >
                  {cnt}M
                </button>
              ))}
            </div>

            <button
              type="button" onClick={() => onHasAnacrusisChange(!hasAnacrusis)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer border ${
                hasAnacrusis ? 'bg-amber-600 text-white border-amber-500' : 'cordel-card-sm opacity-65'
              }`}
              title="Activer ou désactiver l'anacrouse (levée avant le Temps 1)"
            >
              +Ana
            </button>

            <button
              type="button" onClick={() => onHasTailBeatChange(!hasPlus1T)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer border ${
                hasPlus1T ? 'bg-emerald-700 text-white border-emerald-500' : 'cordel-card-sm opacity-65'
              }`}
              title="Inclure le Temps 1 de la mesure suivante (+1T) en fin de bloc"
            >
              +1T
            </button>
          </div>
        )}
      </div>

      {/* Paroles de la phrase sélectionnée : Lecture propre en Mode Organizador, Éditeur en Mode Création */}
      {isManualStructureEdit ? (
        <input
          type="text"
          value={activePattern.assignedLyricsText || ''}
          onChange={(e) => onLyricsChange(e.target.value)}
          placeholder="Saisissez les paroles de cette phrase..."
          className="w-full px-2.5 py-1.5 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-sm font-mono text-[var(--cordel-text)] focus:outline-none focus:border-amber-400 rounded"
        />
      ) : (
        <div className="px-3 py-2 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-sm font-serif italic text-theme-ink">
          {activePattern.assignedLyricsText?.trim() || '— Aucune parole renseignée pour cette phrase —'}
        </div>
      )}

      {activePattern.assignedPhoneticText && (
        <div className="text-[10.5px] font-mono text-[var(--cordel-secondary-text)] italic px-1 flex items-center gap-1">
          <span className="opacity-60">🔤</span>
          <span>{activePattern.assignedPhoneticText}</span>
        </div>
      )}
    </div>
  );
};
