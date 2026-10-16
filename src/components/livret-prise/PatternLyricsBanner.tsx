/**
 * PatternLyricsBanner.tsx
 * Bandeau Cordel de sélection de phrase, guide phonétique & appel Fiche Toada (< 95 lignes).
 */
import React, { useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { applyLyricsSyllablesToSteps } from '../../utils/syllableAligner';
import { Sparkles } from 'lucide-react';

export const PatternLyricsBanner: React.FC = () => {
  const { activePattern, updatePattern, project } = useToadaProject();
  const { t } = useLanguage();

  const isPuxador = activePattern.role === 'puxador';

  // Extract unique available phrases from all patterns and toadaMeta
  const availablePhrases = useMemo(() => {
    const set = new Set<string>();
    project.patterns.forEach((p) => {
      if (p.assignedLyricsText?.trim()) set.add(p.assignedLyricsText.trim());
    });
    return Array.from(set);
  }, [project.patterns]);

  const handleSelectPhrase = (phrase: string) => {
    if (!phrase) return;
    const matching = project.patterns.find((p) => p.assignedLyricsText === phrase);
    const updates: { assignedLyricsText: string; assignedPhoneticText?: string } = {
      assignedLyricsText: phrase,
      assignedPhoneticText: matching?.assignedPhoneticText,
    };
    updatePattern(activePattern.id, updates);
  };

  const handleRealignSyllables = () => {
    if (!activePattern.assignedLyricsText) return;
    const hasAnac = activePattern.hasAnacrusis !== false;
    const all = hasAnac ? [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])] : (activePattern.mainSteps || []);
    const aligned = applyLyricsSyllablesToSteps(all, activePattern.assignedLyricsText);
    const anacLen = hasAnac ? (activePattern.anacrusisSteps?.length || 0) : 0;
    updatePattern(activePattern.id, {
      anacrusisSteps: hasAnac ? aligned.slice(0, anacLen) : [],
      mainSteps: aligned.slice(anacLen),
    });
  };

  return (
    <div className="cordel-card p-2 sm:p-2.5 bg-black/50 border border-[var(--cordel-border)] flex flex-col gap-1.5 rounded-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-none ${isPuxador ? 'bg-role-puxador text-[#f4ecd8]' : 'bg-role-coro text-[#f4ecd8]'}`}>
            {isPuxador ? t('rolePuxador') : t('roleCoro')}
          </span>
          <span className="text-[11px] font-mono font-bold text-stone-300 truncate">
            {activePattern.name}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {availablePhrases.length > 0 && (
          <select
            value={activePattern.assignedLyricsText || ''}
            onChange={(e) => handleSelectPhrase(e.target.value)}
            className="px-2 py-1 bg-black/60 border border-[var(--cordel-border)] text-xs font-mono text-stone-300 focus:outline-none rounded-none max-w-full sm:max-w-[200px]"
          >
            <option value="">{t('patternPhraseCustom')}</option>
            {availablePhrases.map((phrase, i) => (
              <option key={i} value={phrase}>{phrase}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={activePattern.assignedLyricsText || ''}
          onChange={(e) => updatePattern(activePattern.id, { assignedLyricsText: e.target.value })}
          placeholder="Ex: Opanijé, meu pai, Opanijé..."
          className="flex-1 px-2.5 py-1 bg-black/60 border border-[var(--cordel-border)] text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-400 rounded-none"
        />
        {activePattern.mainSteps?.length > 0 && activePattern.assignedLyricsText && (
          <button
            type="button"
            onClick={handleRealignSyllables}
            title={t('realignSyllablesBtn')}
            className="px-2 py-1 cordel-card-sm text-[10px] font-mono font-bold flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-amber-300 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">{t('realignSyllablesBtn')}</span>
          </button>
        )}
      </div>

      {activePattern.assignedPhoneticText && (
        <div className="text-[10px] font-mono text-stone-400 italic px-1 flex items-center gap-1">
          <span className="text-stone-500">🔤</span>
          <span>{activePattern.assignedPhoneticText}</span>
        </div>
      )}
    </div>
  );
};
