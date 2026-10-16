/**
 * AmbitusFinderPanel.tsx
 * Parcours d'Ambitus Intelligent en 4 Étapes (Balayage, Grave, Aigu, Escalier).
 * Support du synthé continu dans l'oreille et retour visuel Cordel. Strictement < 120 lignes.
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { midiToNoteName } from '../../utils/noteUtils';
import { buildAmbitusStaircase } from '../../audio/ambitusSweepAndStairs';
import { useAmbitusJourney } from '../../hooks/useAmbitusJourney';
import { AmbitusStageBar } from './AmbitusStageBar';
import { AmbitusPitchGraph } from './AmbitusPitchGraph';
import { AmbitusSummaryCard } from './AmbitusSummaryCard';
import { Volume2, Play, Check } from 'lucide-react';

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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{j.stage === 'low_test' ? t('ambitusLowestLabel') : t('ambitusHighestLabel')} :</span>
                <button type="button" onClick={() => j.setCurrentMidi((m) => m - 1)} className="px-1.5 py-0.5 border border-[#1a1a1a] bg-[#f4ecd8] dark:bg-[#2b2722] font-mono font-bold cursor-pointer">-1</button>
                <span className="font-mono font-bold text-base px-2 py-0.5 bg-[#f5edd6] dark:bg-[#2b2722] border border-[#1a1a1a]/30">{midiToNoteName(j.currentMidi)}</span>
                <button type="button" onClick={() => j.setCurrentMidi((m) => m + 1)} className="px-1.5 py-0.5 border border-[#1a1a1a] bg-[#f4ecd8] dark:bg-[#2b2722] font-mono font-bold cursor-pointer">+1</button>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer font-semibold select-none">
                <input type="checkbox" checked={j.keepGuideInEar} onChange={(e) => j.setKeepGuideInEar(e.target.checked)} className="accent-[#2a9d8f]" />
                <span>{t('ambitusKeepGuideInEar')}</span>
              </label>
            </div>
            <AmbitusPitchGraph mode="single" targetMidi={j.currentMidi} samples={j.samples} />
            <div className="flex gap-2">
              <button type="button" disabled={j.isTesting} onClick={() => j.runSingleNoteTest(j.currentMidi, j.stage === 'high_test')} className="flex-1 py-2 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                <Volume2 className="w-4 h-4" /><span>{j.isTesting ? t('ambitusHoldProgress', { percent: 60 }) : t('ambitusTestNoteBtn')}</span>
              </button>
              <button type="button" onClick={() => { if (j.stage === 'low_test') { j.setCurrentMidi(j.highestMidi); j.setStage('high_test'); } else { j.setStage('staircase'); } }} className="py-2 px-3 border-2 border-[#1a1a1a] bg-[#2a9d8f] text-[#f4ecd8] font-bold text-xs flex items-center gap-1 cursor-pointer">
                <Check className="w-4 h-4" /><span>{t('ambitusValidateAndNext')}</span>
              </button>
            </div>
          </div>
        )}

        {j.stage === 'staircase' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--cordel-text)]">{t('ambitusStaircaseDesc')}</p>
            <AmbitusPitchGraph mode="staircase" targetMidi={j.lowestMidi} samples={j.samples} staircaseSteps={j.staircasePlan?.steps ?? buildAmbitusStaircase(j.lowestMidi, j.highestMidi, 5).steps} />
            <button type="button" disabled={j.isTesting} onClick={j.runStaircase} className="w-full py-2.5 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md">
              <Play className="w-4 h-4 fill-current" /><span>{j.isTesting ? t('ambitusHoldProgress', { percent: 75 }) : t('ambitusStaircaseBtn')}</span>
            </button>
          </div>
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
