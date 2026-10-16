/**
 * AmbitusFinderPanel.tsx
 * Parcours d'Ambitus Intelligent en 4 Étapes (Balayage, Grave, Aigu, Escalier).
 * Orchestration modulaire via composants spécialisés (< 95 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAmbitusJourney } from '../../hooks/useAmbitusJourney';
import { AmbitusStageBar } from './AmbitusStageBar';
import { AmbitusWizardStepToneCheck } from './AmbitusWizardStepToneCheck';
import { AmbitusWizardStepStaircase } from './AmbitusWizardStepStaircase';
import { AmbitusSummaryCard } from './AmbitusSummaryCard';
import { Play } from 'lucide-react';

export const AmbitusFinderPanel: React.FC = () => {
  const { t } = useLanguage();
  const j = useAmbitusJourney(t);

  return (
    <div className="space-y-4">
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a]/20 pb-1">
          <h3 className="font-bold text-sm tracking-wider uppercase">{t('ambitusTitle')}</h3>
          <button type="button" onClick={() => { j.setStage('sweep'); j.setFeedback(null); }} className="text-[11px] font-mono text-[var(--cordel-accent-text)] hover:underline cursor-pointer">
            {t('ambitusRestartJourney')}
          </button>
        </div>
        <AmbitusStageBar currentStage={j.stage} isStageDone={(s) => j.completedStages.includes(s)} onSelectStage={j.setStage} t={t} />

        {j.stage === 'sweep' && (
          <div className="space-y-3 py-1">
            <p className="text-xs text-[var(--cordel-text)]">{t('ambitusSweepInstruction')}</p>
            <button type="button" disabled={j.isTesting} onClick={j.runSweep} className="w-full py-3 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md">
              <Play className="w-4 h-4 fill-current" /><span>{j.isTesting ? t('ambitusHoldProgress', { percent: 50 }) : t('ambitusSweepBtn')}</span>
            </button>
          </div>
        )}

        {(j.stage === 'low_test' || j.stage === 'high_test') && (
          <AmbitusWizardStepToneCheck
            stage={j.stage}
            currentMidi={j.currentMidi}
            onSetCurrentMidi={j.setCurrentMidi}
            engine={j.engine}
            isTesting={j.isTesting}
            setIsTesting={j.setIsTesting}
            samples={j.samples}
            setSamples={j.setSamples}
            setFeedback={j.setFeedback}
            onValidateAndNext={() => {
              if (j.stage === 'low_test') {
                j.setLowestMidi(j.currentMidi);
                j.setCurrentMidi(j.highestMidi);
                j.setCompletedStages((p) => (p.includes('low_test') ? p : [...p, 'low_test']));
                j.setStage('high_test');
              } else {
                j.setHighestMidi(j.currentMidi);
                j.setCompletedStages((p) => (p.includes('high_test') ? p : [...p, 'high_test']));
                j.setStage('staircase');
              }
            }}
            t={t}
          />
        )}

        {j.stage === 'staircase' && (
          <AmbitusWizardStepStaircase
            lowestMidi={j.lowestMidi}
            highestMidi={j.highestMidi}
            engine={j.engine}
            isTesting={j.isTesting}
            setIsTesting={j.setIsTesting}
            samples={j.samples}
            setSamples={j.setSamples}
            setFeedback={j.setFeedback}
            onCompleteStaircase={j.onCompleteStaircase}
            t={t}
          />
        )}

        {j.feedback && (
          <div className={`p-2.5 text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${j.feedback.isGood ? 'bg-[#2a9d8f]/15 text-[#2a9d8f]' : 'bg-[#d97706]/15 text-[#d97706]'}`}>
            {j.feedback.text}
          </div>
        )}
      </div>
      <AmbitusSummaryCard profile={j.profilePayload} isCompleted={j.completedStages.includes('staircase')} />
    </div>
  );
};
