/**
 * PatternInjectionBar.tsx
 * Copieur modulaire à cases à cocher [ ] Audio [x] Midi [x] Rythme [x] Syllabes
 * d'un pattern vers n'importe quel autre pattern (Puxador ou Coro) ou vers tous les jumeaux (< 130 lignes).
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { Send, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { findTwinPatterns } from '../../utils/twinPatternsHelper';
import { copyPatternElementsInProject, type ModularCopyOptions } from '../../utils/patternModularCopier';
import { useActionFeedback } from '../common/useActionFeedback';

export interface PatternInjectionBarProps {
  sourcePattern?: VocalPatternItem | null;
  coroPatterns?: VocalPatternItem[];
  onInject?: (sourceId: string, targetId: string) => void;
  onCreateMirror?: (sourceId: string) => void;
  defaultAudioChecked?: boolean;
  compact?: boolean;
}

export const PatternInjectionBar: React.FC<PatternInjectionBarProps> = ({
  sourcePattern: propSourcePattern,
  defaultAudioChecked = true,
  compact = false,
}) => {
  const { language } = useLanguage();
  const isBr = language === 'br';
  const { project, activePattern, loadProject } = useToadaProject();
  const sourcePattern = propSourcePattern ?? activePattern;

  const otherPatterns = useMemo(
    () => project.patterns.filter((p) => p.id !== sourcePattern?.id),
    [project.patterns, sourcePattern?.id]
  );
  const twins = useMemo(
    () => (sourcePattern ? findTwinPatterns(project, sourcePattern.id).filter((p) => p.id !== sourcePattern.id) : []),
    [project, sourcePattern]
  );

  const [targetSelector, setTargetSelector] = useState<string>('ALL_TWINS');
  const [options, setOptions] = useState<ModularCopyOptions>({
    audio: defaultAudioChecked,
    midi: true,
    rhythm: true,
    syllables: true,
  });

  useEffect(() => {
    setOptions((prev) => ({ ...prev, audio: defaultAudioChecked }));
  }, [defaultAudioChecked]);

  useEffect(() => {
    if (!sourcePattern) return;
    if (twins.length > 0) {
      setTargetSelector('ALL_TWINS');
      return;
    }
    if (otherPatterns.length > 0) {
      const sameFirstWord = otherPatterns.find(
        (p) => (p.name || '').replace(/^#\d+\s*/, '').split(/\s+/)[0]?.toLowerCase() ===
          (sourcePattern.name || '').replace(/^#\d+\s*/, '').split(/\s+/)[0]?.toLowerCase()
      );
      setTargetSelector(sameFirstWord?.id ?? otherPatterns[0].id);
    }
  }, [sourcePattern?.id, twins.length, otherPatterns.length]);

  const feedback = useActionFeedback(isBr ? '✓ Copiado!' : '✓ Copié !');

  if (!sourcePattern || otherPatterns.length === 0) return null;

  const hasAnyOption = options.audio || options.midi || options.rhythm || options.syllables;
  const toggleOpt = (key: keyof ModularCopyOptions) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCopy = () => {
    if (!hasAnyOption) return;
    feedback.trigger(() => {
      const effectiveTarget = targetSelector === 'ALL_TWINS' && twins.length === 0
        ? otherPatterns[0].id
        : targetSelector;
      const res = copyPatternElementsInProject(project, sourcePattern.id, effectiveTarget, options);
      loadProject(res.updatedProject);
      const label = isBr ? `✓ Copiado para ${res.targetLabel} !` : `✓ Copié vers ${res.targetLabel} !`;
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: label } }));
      return label;
    });
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--cordel-panel)] border border-[var(--cordel-border)] rounded text-[10.5px] font-mono ${compact ? 'w-full' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <span className="font-bold text-[var(--cordel-secondary-text)] uppercase">
          {isBr ? 'Copiar de' : 'Copier de'} <strong className="text-theme-accent">{sourcePattern.name.match(/^#\d+/)?.[0] || sourcePattern.name}</strong> ➔
        </span>
        <select
          value={targetSelector === 'ALL_TWINS' && twins.length === 0 ? (otherPatterns[0]?.id || '') : targetSelector}
          onChange={(e) => setTargetSelector(e.target.value)}
          className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] text-[var(--cordel-text)] px-1.5 py-0.5 rounded text-[10.5px] font-bold focus:outline-none max-w-[230px]"
        >
          {twins.length > 0 && (
            <option value="ALL_TWINS">
              {isBr ? `[ Todos os padrões com a mesma letra (${twins.length}) ]` : `[ Tous les patterns ayant les mêmes paroles (${twins.length}) ]`}
            </option>
          )}
          {otherPatterns.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.role === 'puxador' ? 'PUX' : 'COR'}] {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['audio', isBr ? 'Áudio' : 'Audio'],
          ['midi', 'Midi'],
          ['rhythm', isBr ? 'Ritmo' : 'Rythme'],
          ['syllables', isBr ? 'Sílabas' : 'Syllabes'],
        ] as const).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-1 cursor-pointer select-none font-bold text-[var(--cordel-text)]">
            <input type="checkbox" checked={options[key]} onChange={() => toggleOpt(key)} className="accent-[#0f766e] cursor-pointer w-3.5 h-3.5 rounded" />
            <span>{label}</span>
          </label>
        ))}

        <button
          type="button"
          disabled={!hasAnyOption || feedback.isLoading}
          onClick={handleCopy}
          className={feedback.getButtonClass(
            'px-2.5 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer transition-all bg-theme-wood hover:opacity-95 text-[#f4ecd8] border border-[var(--cordel-border)] disabled:opacity-50'
          )}
        >
          {feedback.isSuccess ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          <span>{feedback.isSuccess ? feedback.successLabel : (isBr ? 'Enviar para o alvo' : 'Envoyer vers la cible')}</span>
        </button>
      </div>
    </div>
  );
};
