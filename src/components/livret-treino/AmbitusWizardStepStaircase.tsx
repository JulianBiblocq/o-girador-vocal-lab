/**
 * AmbitusWizardStepStaircase.tsx
 * Étape 4 de l'Ambitus : Visualisation 5 marches, écoute en cascade (0.6s/note)
 * et chant guidé note par note (1.8s/marche avec synthé continu). Strictement < 145 lignes.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Volume2, Play, Check } from 'lucide-react';
import { buildAmbitusStaircase } from '../../audio/ambitusSweepAndStairs';
import { midiToNoteName } from '../../utils/noteUtils';
import type { AmbitusAudioEngine } from '../../audio/ambitusAudioEngine';
import type { ValidationSample } from '../../audio/ambitusValidator';
import { AmbitusPitchGraph } from './AmbitusPitchGraph';

interface AmbitusWizardStepStaircaseProps {
  lowestMidi: number;
  highestMidi: number;
  engine: AmbitusAudioEngine;
  isTesting: boolean;
  setIsTesting: (v: boolean) => void;
  samples: ValidationSample[];
  setSamples: (s: ValidationSample[]) => void;
  setFeedback: (f: { text: string; isGood: boolean } | null) => void;
  onCompleteStaircase: (recorded: ValidationSample[]) => Promise<void>;
  t: (k: any, p?: any) => string;
}

export const AmbitusWizardStepStaircase: React.FC<AmbitusWizardStepStaircaseProps> = ({
  lowestMidi, highestMidi, engine, isTesting, setIsTesting,
  samples, setSamples, setFeedback, onCompleteStaircase, t,
}) => {
  const plan = useMemo(() => buildAmbitusStaircase(lowestMidi, highestMidi, 5), [lowestMidi, highestMidi]);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
  const [verifiedSteps, setVerifiedSteps] = useState<boolean[]>([false, false, false, false, false]);

  useEffect(() => () => { engine.stopListening(true); }, [engine]);

  const handleListenStaircase = async () => {
    if (isTesting) return;
    setIsTesting(true);
    for (let i = 0; i < plan.steps.length; i++) {
      setActiveStepIdx(i);
      await engine.playReferenceNote(plan.steps[i].midi, 0.6, 0.45);
      await new Promise((r) => setTimeout(r, 650));
    }
    setActiveStepIdx(null);
    setIsTesting(false);
  };

  const handleSingStaircase = async () => {
    if (isTesting) return;
    setIsTesting(true); setFeedback(null); setSamples([]);
    setVerifiedSteps([false, false, false, false, false]);

    let currentIdx = 0;
    const vSteps = [false, false, false, false, false];

    const stopFn = await engine.startListening((tick) => {
      if (tick.pitchMidi > 0 && currentIdx < plan.steps.length) {
        const target = plan.steps[currentIdx].midi;
        let d = tick.pitchMidi - target;
        while (d > 6) d -= 12;
        while (d < -6) d += 12;
        if (Math.abs(d) <= 1.3) {
          vSteps[currentIdx] = true;
          setVerifiedSteps([...vSteps]);
        }
      }
    }, plan.steps.length * 1.8);

    for (let i = 0; i < plan.steps.length; i++) {
      currentIdx = i;
      setActiveStepIdx(i);
      await engine.startContinuousTone(plan.steps[i].midi, 0.28);
      await new Promise((r) => setTimeout(r, 1800));
    }

    const recorded = await stopFn();
    engine.stopListening(true);
    setActiveStepIdx(null);
    setIsTesting(false);
    setSamples(recorded);
    await onCompleteStaircase(recorded);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[var(--cordel-text)]">{t('ambitusStaircaseDesc')}</p>
        <button
          type="button" disabled={isTesting} onClick={handleListenStaircase}
          className="cordel-btn px-2.5 py-1 text-[11px] flex items-center gap-1.5 cursor-pointer rounded text-[var(--cordel-accent-text)] select-none"
        >
          <Volume2 className="w-3.5 h-3.5" /><span>{t('ambitusListenStaircaseBtn')}</span>
        </button>
      </div>

      {/* 5 Marches d'escalier interactives */}
      <div className="grid grid-cols-5 gap-1.5 p-2 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded">
        {plan.steps.map((st, idx) => {
          const isActive = activeStepIdx === idx;
          const isDone = verifiedSteps[idx];
          return (
            <div
              key={st.midi}
              className={`p-2 text-center border transition-all flex flex-col items-center justify-center gap-0.5 rounded ${
                isActive
                  ? 'bg-[#c88a2b]/20 border-[#c88a2b] text-[#9a3412] dark:text-[#f4a261] scale-105 shadow-md animate-pulse'
                  : isDone
                  ? 'bg-[#0f766e]/15 border-[#0f766e]/40 text-[#0f766e] dark:text-[#2dd4bf] font-bold'
                  : 'bg-[var(--cordel-surface)] border-[var(--cordel-border-sub)] text-[var(--cordel-text)]/70'
              }`}
            >
              <span className="text-[10px] font-mono opacity-60">#{idx + 1}</span>
              <span className="text-sm font-bold font-mono">{st.noteName}</span>
              {isDone ? <Check className="w-3.5 h-3.5 text-[#0f766e] dark:text-[#2dd4bf]" /> : <span className="text-[9px] font-mono opacity-50">{midiToNoteName(st.midi)}</span>}
            </div>
          );
        })}
      </div>

      {/* Graphe de hauteur */}
      <AmbitusPitchGraph mode="staircase" targetMidi={lowestMidi} samples={samples} staircaseSteps={plan.steps} />

      {/* Bouton de lancement de l'escalier */}
      <button
        type="button" disabled={isTesting} onClick={handleSingStaircase}
        className="w-full py-2.5 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md select-none rounded"
      >
        <Play className="w-4 h-4 fill-current" />
        <span>
          {isTesting && activeStepIdx !== null
            ? t('ambitusStaircaseStepProgress', { current: activeStepIdx + 1, total: 5, note: plan.steps[activeStepIdx]?.noteName })
            : t('ambitusStaircaseBtn')}
        </span>
      </button>
    </div>
  );
};
