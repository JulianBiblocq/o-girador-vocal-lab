/**
 * StudentToadaQuizCard.tsx
 * Carte QCM d'auto-évaluation culturelle & lexicale PT-FR pour l'espace Élève (< 95 lignes).
 */
import React, { useMemo, useState } from 'react';
import { HelpCircle, RotateCcw, Check } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { generateQuizFromLexicon } from '../../utils/toadaQuizGenerator';

export const StudentToadaQuizCard: React.FC = () => {
  const { project } = useToadaProject();
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const questions = useMemo(() => {
    const stored = project.toadaMeta?.questionsQcm;
    if (stored && stored.length > 0) return stored;
    const lex = project.toadaMeta?.notesLexique;
    if (lex && lex.length > 0) return generateQuizFromLexicon(lex);
    return [];
  }, [project.toadaMeta?.questionsQcm, project.toadaMeta?.notesLexique]);

  if (questions.length === 0) return null;

  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce((acc, q, idx) => (answers[idx] === q.correctIndex ? acc + 1 : acc), 0);

  return (
    <div className="cordel-card p-4 flex flex-col gap-3 text-xs font-mono rounded">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--cordel-border-sub)]">
        <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-theme-ink">
          <HelpCircle className="w-4 h-4 text-theme-accent" />
          <span>{t('studentQuizTitle')}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-600/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold">
            {t('studentQuizScoreBadge', { score, total: questions.length })}
          </span>
          {answeredCount > 0 && (
            <button type="button" onClick={() => setAnswers({})} className="px-2 py-0.5 cordel-card-sm rounded font-bold inline-flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3 h-3" /><span>{t('studentQuizResetBtn')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {questions.map((q, qIdx) => {
          const picked = answers[qIdx];
          const hasPicked = picked !== undefined;
          return (
            <div key={q.id || qIdx} className="cordel-card-sm p-2.5 rounded flex flex-col gap-2">
              <p className="font-bold text-theme-ink leading-snug">{qIdx + 1}. {q.question}</p>
              <div className="flex flex-col gap-1">
                {q.options.map((opt, oIdx) => {
                  const isCorrect = oIdx === q.correctIndex;
                  const isChosen = picked === oIdx;
                  const cls = !hasPicked
                    ? 'cordel-btn hover:border-amber-500/70 text-theme-ink'
                    : isCorrect
                      ? 'bg-emerald-700 text-white border-emerald-500 font-bold'
                      : isChosen
                        ? 'bg-red-700 text-white border-red-500'
                        : 'opacity-55 border-transparent';
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={hasPicked}
                      onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                      className={`w-full px-2.5 py-1.5 rounded border text-left text-[11px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${cls}`}
                    >
                      <span>{opt}</span>
                      {hasPicked && isCorrect && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
