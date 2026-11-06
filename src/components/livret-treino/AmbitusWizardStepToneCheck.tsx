/**
 * AmbitusWizardStepToneCheck.tsx
 * Étapes 2 et 3 (L'Aiguille / Tone Check) : centrage sur la médiane du Balayage, boutons Octave (-1/+1 Oct),
 * jauge Aiguille temps réel toujours visible et graphique Auto-Scale (< 140 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { midiToNoteName } from '../../utils/noteUtils';
import { validateAmbitusNote, type ValidationSample } from '../../audio/ambitusValidator';
import type { AmbitusAudioEngine } from '../../audio/ambitusAudioEngine';
import { AmbitusPitchGraph } from './AmbitusPitchGraph';
import { AmbitusNeedleGauge } from './AmbitusNeedleGauge';

interface AmbitusWizardStepToneCheckProps {
  stage: 'low_test' | 'high_test'; currentMidi: number; medianMidi?: number;
  onSetCurrentMidi: (fn: (prev: number) => number) => void; engine: AmbitusAudioEngine;
  isTesting: boolean; setIsTesting: (v: boolean) => void; samples: ValidationSample[];
  setSamples: (s: ValidationSample[]) => void; setFeedback: (f: { text: string; isGood: boolean } | null) => void;
  onValidateAndNext: () => void; t: (k: any, p?: any) => string;
}

export const AmbitusWizardStepToneCheck: React.FC<AmbitusWizardStepToneCheckProps> = ({
  stage, currentMidi, medianMidi, onSetCurrentMidi, engine, isTesting, setIsTesting,
  samples, setSamples, setFeedback, onValidateAndNext, t,
}) => {
  const [phase, setPhase] = useState<'idle' | 'listen' | 'sing'>('idle');
  const [livePitchMidi, setLivePitchMidi] = useState<number>(0), [progress, setProgress] = useState(0);
  const phaseRef = useRef<'idle' | 'listen' | 'sing'>('idle'), liveSamplesRef = useRef<ValidationSample[]>([]);
  phaseRef.current = phase;

  const noteName = midiToNoteName(currentMidi);
  const label = stage === 'low_test' ? t('ambitusLowestLabel') : t('ambitusHighestLabel');

  // Moniteur micro passif hors test pour que l'aiguille réponde dès que l'élève chante
  useEffect(() => {
    if (isTesting) return;
    let active = true;
    engine.startListening((tick) => {
      if (active && phaseRef.current === 'idle') setLivePitchMidi(tick.pitchMidi);
    }, 300).catch(() => {});
    return () => { active = false; if (phaseRef.current === 'idle') engine.stopListening(true); };
  }, [engine, isTesting]);

  const handleListenFree = async () => {
    if (isTesting) return;
    await engine.playReferenceNote(currentMidi, 1.6, 0.45);
  };

  const handleRunGuidedTest = async () => {
    if (isTesting) return;
    setIsTesting(true); setFeedback(null); setSamples([]); setProgress(0);
    liveSamplesRef.current = [];
    setPhase('listen');
    const singStartMs = performance.now() + 1200;

    await engine.startListening((tick) => {
      setLivePitchMidi(tick.pitchMidi);
      if (phaseRef.current === 'sing') {
        const elapsedSing = Math.max(0, (performance.now() - singStartMs) / 1000);
        const pct = Math.min(100, Math.round((elapsedSing / 2.4) * 100));
        setProgress(pct);
        if (tick.pitchMidi > 0) {
          liveSamplesRef.current = [...liveSamplesRef.current, { timeSec: elapsedSing, pitchMidi: tick.pitchMidi, rms: tick.rms }];
          setSamples(liveSamplesRef.current);
        }
      }
    }, 3.8);

    await engine.startContinuousTone(currentMidi, 0.42);
    setTimeout(() => { setPhase('sing'); engine.setContinuousToneGain(0.18); }, 1200);

    setTimeout(() => {
      const recorded = liveSamplesRef.current;
      engine.stopListening(true);
      setPhase('idle'); setIsTesting(false); setSamples(recorded);
      const res = validateAmbitusNote(currentMidi, recorded, 1.6, 0.01);
      setFeedback({ text: t(res.messageKey || 'ambitusCoachingNeedPower'), isGood: res.isSolid });
    }, 3650);
  };

  return (
    <div className="space-y-3">
      {/* 1. Note cible + Boutons Octave (-1/+1 Oct) & Demi-ton (-½/+½) + Écoute libre */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-bold text-[var(--cordel-text)] mr-1">{label} :</span>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => Math.max(36, m - 12))} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer rounded text-[11px]" title="-1 Octave">◀ -1 Oct</button>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => Math.max(36, m - 1))} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer flex items-center gap-0.5 rounded" title="-1 demi-ton"><ChevronLeft className="w-3 h-3" /><span>½</span></button>
          <span className="font-mono font-bold text-base px-2.5 py-0.5 cordel-card-sm rounded border border-[var(--cordel-border-panel)] text-[var(--cordel-text)]">{noteName}</span>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => Math.min(84, m + 1))} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer flex items-center gap-0.5 rounded" title="+1 demi-ton"><span>½</span><ChevronRight className="w-3 h-3" /></button>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => Math.min(84, m + 12))} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer rounded text-[11px]" title="+1 Octave">+1 Oct ▶</button>
          {typeof medianMidi === 'number' && medianMidi !== currentMidi && (
            <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi(() => medianMidi)} className="px-2 py-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/40 font-mono font-bold text-[10px] cursor-pointer">
              Médiane ({midiToNoteName(medianMidi)})
            </button>
          )}
        </div>
        <button type="button" disabled={isTesting} onClick={handleListenFree} className="cordel-btn px-2.5 py-1 text-[11px] flex items-center gap-1.5 cursor-pointer rounded text-[var(--cordel-accent-text)]">
          <Volume2 className="w-3.5 h-3.5" /><span>{t('ambitusListenTargetBtn', { note: noteName })}</span>
        </button>
      </div>

      {/* 2. Aiguille / Jauge à double échelle toujours visible */}
      <AmbitusNeedleGauge targetMidi={currentMidi} livePitchMidi={livePitchMidi} samples={samples} />

      {/* 3. Bannière de statut de phase guidée (Écoute ➔ Chante) */}
      {isTesting && (
        <div className={`p-2 border rounded text-center text-xs font-bold transition-all ${phase === 'listen' ? 'bg-[#c88a2b]/15 text-[#9a3412] dark:text-[#f4a261] border-[#c88a2b]/40' : 'bg-[#0f766e]/15 text-[#0f766e] dark:text-[#2dd4bf] border-[#0f766e]/40'}`}>
          {phase === 'listen' ? (
            <div className="flex items-center justify-center gap-2 animate-pulse"><Volume2 className="w-4 h-4" /><span>{t('ambitusListenPhasePrompt', { note: noteName })}</span></div>
          ) : (
            <div className="flex items-center justify-between px-2">
              <span>{t('ambitusSingPhasePrompt', { note: noteName })}</span>
              <span className="font-mono text-[11px]">{progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Graphe de hauteur Auto-Scale */}
      <AmbitusPitchGraph mode="single" targetMidi={currentMidi} samples={samples} targetHoldSec={2.4} />

      {/* 5. Actions : Tester la note & Valider */}
      <div className="flex gap-2">
        <button type="button" disabled={isTesting} onClick={handleRunGuidedTest} className="flex-1 py-2.5 cordel-btn-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded shadow-sm">
          <Play className="w-4 h-4 fill-current" /><span>{isTesting ? t('ambitusHoldProgress', { percent: progress }) : t('ambitusTestNoteBtn')}</span>
        </button>
        <button type="button" disabled={isTesting} onClick={onValidateAndNext} className="py-2.5 px-4 border border-[var(--cordel-coro)] bg-[var(--cordel-coro)] text-[#f4ecd8] font-bold text-xs flex items-center gap-1.5 cursor-pointer rounded shadow-sm hover:opacity-95 active:translate-y-0.5">
          <Check className="w-4 h-4" /><span>{t('ambitusValidateAndNext')}</span>
        </button>
      </div>
    </div>
  );
};
