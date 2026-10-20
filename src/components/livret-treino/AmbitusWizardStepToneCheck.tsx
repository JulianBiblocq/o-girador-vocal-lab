/**
 * AmbitusWizardStepToneCheck.tsx
 * Étapes 2 (Grave) et 3 (Aigu) de l'Ambitus : écoute libre, ajustement +/- 1/2 ton
 * et cycle guidé Phase A (Écoute 1.5s) ➔ Phase B (Chant 2.5s). Strictement < 145 lignes.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { midiToNoteName } from '../../utils/noteUtils';
import { validateAmbitusNote, type ValidationSample } from '../../audio/ambitusValidator';
import type { AmbitusAudioEngine } from '../../audio/ambitusAudioEngine';
import { AmbitusPitchGraph } from './AmbitusPitchGraph';

interface AmbitusWizardStepToneCheckProps {
  stage: 'low_test' | 'high_test';
  currentMidi: number;
  onSetCurrentMidi: (fn: (prev: number) => number) => void;
  engine: AmbitusAudioEngine;
  isTesting: boolean;
  setIsTesting: (v: boolean) => void;
  samples: ValidationSample[];
  setSamples: (s: ValidationSample[]) => void;
  setFeedback: (f: { text: string; isGood: boolean } | null) => void;
  onValidateAndNext: () => void;
  t: (k: any, p?: any) => string;
}

export const AmbitusWizardStepToneCheck: React.FC<AmbitusWizardStepToneCheckProps> = ({
  stage, currentMidi, onSetCurrentMidi, engine, isTesting, setIsTesting,
  samples, setSamples, setFeedback, onValidateAndNext, t,
}) => {
  const [phase, setPhase] = useState<'idle' | 'listen' | 'sing'>('idle');
  const [liveHint, setLiveHint] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const phaseRef = useRef<'idle' | 'listen' | 'sing'>('idle');
  phaseRef.current = phase;

  const noteName = midiToNoteName(currentMidi);
  const label = stage === 'low_test' ? t('ambitusLowestLabel') : t('ambitusHighestLabel');

  useEffect(() => () => { engine.stopListening(true); }, [engine]);

  const handleListenFree = async () => {
    if (isTesting) return;
    await engine.playReferenceNote(currentMidi, 1.8, 0.45);
  };

  const handleRunGuidedTest = async () => {
    if (isTesting) return;
    setIsTesting(true); setFeedback(null); setSamples([]); setProgress(0); setLiveHint('');
    setPhase('listen');

    const stopFn = await engine.startListening((tick) => {
      if (phaseRef.current === 'sing') {
        setProgress(Math.round(tick.progressRatio * 100));
        if (tick.pitchMidi > 0) {
          let d = tick.pitchMidi - currentMidi;
          while (d > 6) d -= 12;
          while (d < -6) d += 12;
          if (Math.abs(d) <= 1.2) setLiveHint(t('ambitusPitchPerfect'));
          else if (d < -1.2) setLiveHint(t('ambitusPitchTooLow'));
          else setLiveHint(t('ambitusPitchTooHigh'));
        }
      }
    }, 4.0);

    await engine.startContinuousTone(currentMidi, 0.45);

    setTimeout(() => {
      setPhase('sing');
      engine.setContinuousToneGain(0.22);
    }, 1500);

    setTimeout(async () => {
      const recorded = await stopFn();
      engine.stopListening(true);
      setPhase('idle');
      setIsTesting(false);
      setSamples(recorded);
      const res = validateAmbitusNote(currentMidi, recorded, 2.0, 0.012);
      setFeedback({ text: t(res.messageKey || 'ambitusCoachingNeedPower'), isGood: res.isSolid });
    }, 4000);
  };

  return (
    <div className="space-y-3">
      {/* 1. Note cible + Ajustement manuel 1/2 ton + Bouton d'écoute libre */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[var(--cordel-text)]">{label} :</span>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => m - 1)} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer flex items-center gap-0.5 rounded" title="- 1 demi-ton"><ChevronLeft className="w-3 h-3" /><span>½</span></button>
          <span className="font-mono font-bold text-base px-2.5 py-0.5 cordel-card-sm rounded border border-[var(--cordel-border-panel)] text-[var(--cordel-text)]">{noteName}</span>
          <button type="button" disabled={isTesting} onClick={() => onSetCurrentMidi((m) => m + 1)} className="cordel-btn px-2 py-1 font-mono font-bold cursor-pointer flex items-center gap-0.5 rounded" title="+ 1 demi-ton"><span>½</span><ChevronRight className="w-3 h-3" /></button>
        </div>
        <button type="button" disabled={isTesting} onClick={handleListenFree} className="cordel-btn px-2.5 py-1 text-[11px] flex items-center gap-1.5 cursor-pointer rounded text-[var(--cordel-accent-text)]">
          <Volume2 className="w-3.5 h-3.5" /><span>{t('ambitusListenTargetBtn', { note: noteName })}</span>
        </button>
      </div>

      {/* 2. Bannière de statut de phase guidée (Écoute ➔ Chante) */}
      {isTesting && (
        <div className={`p-2 border rounded text-center text-xs font-bold transition-all shadow-[var(--cordel-shadow-sm)] ${phase === 'listen' ? 'bg-[#c88a2b]/15 text-[#9a3412] dark:text-[#f4a261] border-[#c88a2b]/40' : 'bg-[#0f766e]/15 text-[#0f766e] dark:text-[#2dd4bf] border-[#0f766e]/40'}`}>
          {phase === 'listen' ? (
            <div className="flex items-center justify-center gap-2 animate-pulse"><Volume2 className="w-4 h-4" /><span>{t('ambitusListenPhasePrompt', { note: noteName })}</span></div>
          ) : (
            <div className="flex items-center justify-between px-2">
              <span className="animate-bounce">🎙️ {t('ambitusSingPhasePrompt', { note: noteName })}</span>
              {liveHint && <span className="px-2 py-0.5 bg-[var(--cordel-subcard-bg)] text-[var(--cordel-accent-text)] font-mono text-[11px] border border-[var(--cordel-border-sub)] rounded">{liveHint}</span>}
              <span className="font-mono text-[11px]">{progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Graphe de hauteur */}
      <AmbitusPitchGraph mode="single" targetMidi={currentMidi} samples={samples} />

      {/* 4. Actions : Tester la note & Valider */}
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
