/**
 * PatternInjectionBar.tsx
 * Barre d'injection directe Puxador -> Coro existant (bilingue + toast + contraste Jour/Nuit) (< 90 lignes).
 */
import React, { useState, useEffect } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { ArrowLeftRight, Sparkles, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface PatternInjectionBarProps {
  sourcePattern: VocalPatternItem | null;
  coroPatterns: VocalPatternItem[];
  onInject: (sourceId: string, targetId: string) => void;
  onCreateMirror: (sourceId: string) => void;
}

export const PatternInjectionBar: React.FC<PatternInjectionBarProps> = ({
  sourcePattern, coroPatterns, onInject, onCreateMirror,
}) => {
  const { t } = useLanguage();
  const [selectedCoroId, setSelectedCoroId] = useState<string>('');

  useEffect(() => {
    if (!sourcePattern || coroPatterns.length === 0) { setSelectedCoroId(''); return; }
    const firstWord = (sourcePattern.name || '').trim().split(/\s+/)[0]?.toLowerCase();
    const match = coroPatterns.find((c) => (c.name || '').trim().split(/\s+/)[0]?.toLowerCase() === firstWord);
    setSelectedCoroId(match?.id ?? coroPatterns[0].id);
  }, [sourcePattern?.id, sourcePattern?.name, coroPatterns]);

  if (!sourcePattern) return null;
  const hasAudio = Boolean(
    sourcePattern.recordingResult?.pcm?.length ||
    sourcePattern.rawAudioSamples?.length ||
    sourcePattern.variants?.[sourcePattern.activeVariantKey]?.recordingResult?.pcm?.length
  );
  const targetCoro = coroPatterns.find((c) => c.id === selectedCoroId) ?? coroPatterns[0];

  const handleInjectClick = () => {
    if (!targetCoro) return;
    onInject(sourcePattern.id, targetCoro.id);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('injectSuccessToast'), type: 'success' } }));
  };

  const handleCreateMirrorClick = () => {
    onCreateMirror(sourcePattern.id);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('injectSuccessToast'), type: 'success' } }));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-amber-500/10 dark:bg-amber-950/25 border border-amber-600/30 rounded text-[10px] font-mono">
      <div className="flex items-center gap-1.5 min-w-0">
        <Sparkles className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
        <span className="text-[var(--cordel-secondary-text)] truncate">
          {t('injectSourceLabel')} <strong className="text-[#9a3412] dark:text-amber-400 font-bold">{sourcePattern.name}</strong>
        </span>
      </div>

      {coroPatterns.length > 0 && targetCoro ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--cordel-secondary-text)]">{t('injectTargetLabel')}</span>
          <select
            value={selectedCoroId}
            onChange={(e) => setSelectedCoroId(e.target.value)}
            className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] text-[var(--cordel-text)] px-1 py-0.5 rounded text-[10px] focus:outline-none"
          >
            {coroPatterns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button" disabled={!hasAudio} onClick={handleInjectClick}
            title={hasAudio ? t('injectToCoroTitleReady', { name: targetCoro.name }) : t('injectToCoroTitleEmpty')}
            className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer transition-all ${
              hasAudio
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                : 'bg-[var(--cordel-subcard-bg)] text-stone-500 border border-[var(--cordel-border-sub)] cursor-not-allowed opacity-60'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>{t('injectToCoroBtn')}</span>
          </button>
        </div>
      ) : (
        <button
          type="button" onClick={handleCreateMirrorClick}
          className="px-2 py-0.5 rounded font-bold bg-amber-700 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{t('injectCreateMirrorBtn')}</span>
        </button>
      )}
    </div>
  );
};
