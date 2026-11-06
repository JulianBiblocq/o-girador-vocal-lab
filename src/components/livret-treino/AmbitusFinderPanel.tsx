/**
 * AmbitusFinderPanel.tsx
 * Parcours d'Ambitus Intelligent : Étape 1 (Balayage avec décompte 3-2-1 + barre 0..100% + graphe Auto-Scale),
 * Étape 2/3 (Aiguille centrée sur la médiane) et Étape 4 (Escalier) (< 140 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAmbitusJourney } from '../../hooks/useAmbitusJourney';
import { AmbitusStageBar, type AmbitusStage } from './AmbitusStageBar';
import { AmbitusPitchGraph } from './AmbitusPitchGraph';
import { AmbitusWizardStepToneCheck } from './AmbitusWizardStepToneCheck';
import { AmbitusWizardStepStaircase } from './AmbitusWizardStepStaircase';
import { AmbitusSummaryCard } from './AmbitusSummaryCard';
import { midiToNoteName } from '../../utils/noteUtils';
import { Play, Check } from 'lucide-react';

export const AmbitusFinderPanel: React.FC = () => {
  const { t } = useLanguage();
  const j = useAmbitusJourney(t);

  const handleSelectStage = (next: AmbitusStage) => {
    if (j.isTesting) {
      j.engine.stopListening();
      j.setIsTesting(false);
    }
    j.setSamples([]); j.setFeedback(null);
    if (next === 'low_test') j.setCurrentMidi(j.medianMidi);
    if (next === 'high_test') j.setCurrentMidi(Math.max(j.highestMidi, j.lowestMidi + 5));
    j.setStage(next);
  };

  const liveNoteStr = j.sweepLiveMidi >= 30
    ? `${midiToNoteName(Math.round(j.sweepLiveMidi))} (${Math.round(440 * Math.pow(2, (j.sweepLiveMidi - 69) / 12))} Hz)`
    : 'Chantez la sirène...';

  return (
    <div className="space-y-4">
      <div className="cordel-card p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-1.5">
          <h3 className="font-bold text-sm tracking-wider uppercase text-[var(--cordel-text)]">{t('ambitusTitle')}</h3>
          <button type="button" onClick={() => handleSelectStage('sweep')} className="text-[11px] font-mono text-[var(--cordel-accent-text)] hover:underline cursor-pointer">
            {t('ambitusRestartJourney')}
          </button>
        </div>
        <AmbitusStageBar currentStage={j.stage} isStageDone={(s) => j.completedStages.includes(s)} onSelectStage={handleSelectStage} t={t} />

        {j.stage === 'sweep' && (
          <div className="flex flex-col space-y-3 py-1">
            <p className="text-xs text-[var(--cordel-text)]">{t('ambitusSweepInstruction')}</p>

            {/* Décompte 3-2-1 puis Barre de progression 0 -> 100 % avec trajectoire Grave -> Médium -> Aigu */}
            {j.isTesting && j.sweepCountdown !== null && j.sweepCountdown > 0 && (
              <div className="p-3 rounded border border-amber-500/50 bg-amber-500/15 text-center animate-pulse">
                <div className="text-2xl font-black font-mono text-amber-500">{j.sweepCountdown}...</div>
                <div className="text-xs font-bold text-[var(--cordel-text)]">Préparez votre souffle en partant de votre note la plus grave !</div>
              </div>
            )}

            {j.isTesting && j.sweepCountdown === 0 && (
              <div className="p-3 rounded border border-[#0f766e]/40 bg-[#0f766e]/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-bold">
                  <span className="text-[#0f766e] dark:text-[#2dd4bf]">CHANTEZ ! Sirène Grave ➔ Aigu</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)]">Note : {liveNoteStr}</span>
                  <span>{j.sweepRemainingSec.toFixed(1)}s ({j.sweepProgress}%)</span>
                </div>
                <div className="w-full h-3 bg-[var(--cordel-surface)] rounded-full overflow-hidden border border-[var(--cordel-border-panel)]">
                  <div className="h-full bg-gradient-to-r from-amber-600 via-teal-600 to-emerald-500 transition-all duration-100" style={{ width: `${j.sweepProgress}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center">
                  <span className={`py-0.5 rounded border ${j.sweepProgress < 30 ? 'bg-amber-600 text-white border-amber-500 font-bold' : 'opacity-55 border-transparent'}`}>0–30% : Grave</span>
                  <span className={`py-0.5 rounded border ${j.sweepProgress >= 30 && j.sweepProgress < 70 ? 'bg-teal-700 text-white border-teal-500 font-bold' : 'opacity-55 border-transparent'}`}>30–70% : Médium</span>
                  <span className={`py-0.5 rounded border ${j.sweepProgress >= 70 ? 'bg-emerald-600 text-white border-emerald-400 font-bold' : 'opacity-55 border-transparent'}`}>70–100% : Aigu</span>
                </div>
              </div>
            )}

            <AmbitusPitchGraph mode="sweep" targetMidi={j.medianMidi} samples={j.samples} targetHoldSec={6.0} />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button" disabled={j.isTesting} onClick={j.runSweep}
                className="flex-1 sm:flex-none sm:min-w-[240px] px-5 py-2.5 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md rounded"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{j.isTesting ? (j.sweepCountdown && j.sweepCountdown > 0 ? `Départ dans ${j.sweepCountdown}...` : `${t('ambitusHoldProgress', { percent: j.sweepProgress })} (${j.sweepRemainingSec.toFixed(1)}s)`) : t('ambitusSweepBtn')}</span>
              </button>
              {j.completedStages.includes('sweep') && !j.isTesting && (
                <button
                  type="button" onClick={() => handleSelectStage('low_test')}
                  className="px-5 py-2.5 border border-[var(--cordel-coro)] bg-[var(--cordel-coro)] text-[#f4ecd8] font-bold text-xs flex items-center gap-1.5 cursor-pointer rounded shadow-md"
                >
                  <Check className="w-4 h-4" /><span>Étape 2 : L'Aiguille ({midiToNoteName(j.medianMidi)}) ➔</span>
                </button>
              )}
            </div>
          </div>
        )}

        {(j.stage === 'low_test' || j.stage === 'high_test') && (
          <AmbitusWizardStepToneCheck
            stage={j.stage} currentMidi={j.currentMidi} medianMidi={j.medianMidi} onSetCurrentMidi={j.setCurrentMidi}
            engine={j.engine} isTesting={j.isTesting} setIsTesting={j.setIsTesting}
            samples={j.samples} setSamples={j.setSamples} setFeedback={j.setFeedback}
            onValidateAndNext={() => {
              j.setSamples([]);
              if (j.stage === 'low_test') {
                const nextHigh = Math.max(j.highestMidi, j.currentMidi + 5);
                j.setLowestMidi(j.currentMidi); j.setMedianMidi(j.currentMidi); j.setHighestMidi(nextHigh); j.setCurrentMidi(nextHigh);
                j.setCompletedStages((p) => (p.includes('low_test') ? p : [...p, 'low_test']));
                j.setStage('high_test');
              } else {
                j.setHighestMidi(Math.max(j.lowestMidi + 4, j.currentMidi));
                j.setCompletedStages((p) => (p.includes('high_test') ? p : [...p, 'high_test']));
                j.setStage('staircase');
              }
            }}
            t={t}
          />
        )}

        {(j.stage === 'staircase' || j.stage === 'completed') && (
          <AmbitusWizardStepStaircase
            lowestMidi={j.lowestMidi} highestMidi={j.highestMidi} engine={j.engine}
            isTesting={j.isTesting} setIsTesting={j.setIsTesting}
            samples={j.samples} setSamples={j.setSamples} setFeedback={j.setFeedback}
            onCompleteStaircase={j.onCompleteStaircase} t={t}
          />
        )}

        {j.feedback && (
          <div className={`p-2.5 text-xs font-bold border rounded ${j.feedback.isGood ? 'bg-[#0f766e]/10 text-[#0f766e] dark:text-[#2dd4bf] border-[#0f766e]/30' : 'bg-[#c25e38]/10 text-[#9a3412] dark:text-[#e69d35] border-[#c25e38]/30'}`}>
            {j.feedback.text}
          </div>
        )}
      </div>
      <AmbitusSummaryCard profile={j.profilePayload} isCompleted={j.completedStages.includes('staircase')} />
    </div>
  );
};
