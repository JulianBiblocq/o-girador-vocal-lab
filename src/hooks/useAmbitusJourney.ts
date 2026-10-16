/**
 * useAmbitusJourney.ts
 * Hook d'orchestration audio et gestion d'état du parcours d'ambitus en 4 étapes.
 * Strictement < 120 lignes.
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AmbitusAudioEngine } from '../audio/ambitusAudioEngine';
import { validateAmbitusNote, AMBITUS_HOLD_SEC, MIN_PROJECTION_RMS, type ValidationSample } from '../audio/ambitusValidator';
import { analyzeAmbitusSweep, buildAmbitusStaircase, type StaircasePlan } from '../audio/ambitusSweepAndStairs';
import { registerTreinoKillSwitch } from '../audio/maracatuVocalGameEngine';
import { midiToNoteName, noteNameToMidi } from '../utils/noteUtils';
import { createVocalProfilePayload, loadVocalProfile } from '../utils/ambitusStorage';
import { syncVocalProfileToOrganizador } from '../services/vocalProfileSyncService';
import type { AmbitusStage } from '../components/livret-treino/AmbitusStageBar';

export function useAmbitusJourney(t: (k: any, p?: any) => string) {
  const engine = useMemo(() => new AmbitusAudioEngine(), []);
  const saved = useMemo(() => loadVocalProfile(), []);

  const [stage, setStage] = useState<AmbitusStage>(() => (saved ? 'completed' : 'sweep'));
  const [lowestMidi, setLowestMidi] = useState(() => (saved ? noteNameToMidi(saved.vocalProfile.lowestSolidNote) : 55));
  const [highestMidi, setHighestMidi] = useState(() => (saved ? noteNameToMidi(saved.vocalProfile.highestSolidNote) : 67));
  const [currentMidi, setCurrentMidi] = useState(55);
  const [keepGuideInEar, setKeepGuideInEar] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isGood: boolean } | null>(null);
  const [samples, setSamples] = useState<ValidationSample[]>([]);
  const [staircasePlan, setStaircasePlan] = useState<StaircasePlan | null>(null);
  const [completedStages, setCompletedStages] = useState<AmbitusStage[]>(() =>
    saved ? ['sweep', 'low_test', 'high_test', 'staircase'] : []
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const kill = () => {
      if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      engine.stopListening();
      setIsTesting(false);
    };
    const unregister = registerTreinoKillSwitch(kill);
    return () => { unregister(); kill(); };
  }, [engine]);

  const profilePayload = useMemo(() => createVocalProfilePayload(lowestMidi, highestMidi), [lowestMidi, highestMidi]);

  const runSweep = useCallback(async () => {
    if (isTesting) return;
    setIsTesting(true); setFeedback(null); setSamples([]);
    const stopFn = await engine.startListening(() => {}, 5.0);
    timerRef.current = window.setTimeout(async () => {
      const recorded = await stopFn();
      setIsTesting(false); setSamples(recorded);
      const res = analyzeAmbitusSweep(recorded, MIN_PROJECTION_RMS);
      setLowestMidi(res.candidateLowMidi); setHighestMidi(res.candidateHighMidi); setCurrentMidi(res.candidateLowMidi);
      setCompletedStages((prev) => (prev.includes('sweep') ? prev : [...prev, 'sweep']));
      setFeedback({ text: t('ambitusSweepDonePrompt', { low: midiToNoteName(res.candidateLowMidi), high: midiToNoteName(res.candidateHighMidi) }), isGood: true });
      setStage('low_test');
    }, 5100);
  }, [isTesting, engine, t]);

  const runSingleNoteTest = useCallback(async (target: number, isHigh: boolean) => {
    if (isTesting) return;
    setIsTesting(true); setFeedback(null); setSamples([]);
    if (keepGuideInEar) await engine.startContinuousTone(target, 0.16);
    else await engine.playReferenceNote(target, 1.0);

    const stopFn = await engine.startListening(() => {}, AMBITUS_HOLD_SEC);
    timerRef.current = window.setTimeout(async () => {
      const recorded = await stopFn();
      engine.stopContinuousTone(); setIsTesting(false); setSamples(recorded);
      const res = validateAmbitusNote(target, recorded, AMBITUS_HOLD_SEC, MIN_PROJECTION_RMS);
      const ok = res.status === 'solid';
      setFeedback({ text: t(res.messageKey || 'ambitusCoachingNeedPower'), isGood: ok });
      if (ok) {
        if (isHigh) { setHighestMidi(target); setCompletedStages((p) => (p.includes('high_test') ? p : [...p, 'high_test'])); }
        else { setLowestMidi(target); setCompletedStages((p) => (p.includes('low_test') ? p : [...p, 'low_test'])); }
      }
    }, AMBITUS_HOLD_SEC * 1000 + 100);
  }, [isTesting, keepGuideInEar, engine, t]);

  const runStaircase = useCallback(async () => {
    if (isTesting) return;
    const plan = buildAmbitusStaircase(lowestMidi, highestMidi, 5);
    setStaircasePlan(plan); setIsTesting(true); setFeedback(null); setSamples([]);
    if (keepGuideInEar && plan.steps.length > 0) await engine.startContinuousTone(plan.steps[0].midi, 0.16);

    const stopFn = await engine.startListening(() => {}, plan.totalDurationSec);
    plan.steps.forEach((st, idx) => {
      window.setTimeout(() => { if (keepGuideInEar) engine.updateContinuousTonePitch(st.midi); }, idx * plan.stepDurationSec * 1000);
    });

    timerRef.current = window.setTimeout(async () => {
      const recorded = await stopFn();
      engine.stopContinuousTone(); setIsTesting(false); setSamples(recorded);
      setCompletedStages((p) => (p.includes('staircase') ? p : [...p, 'staircase']));
      setFeedback({ text: t('ambitusStaircaseSuccess'), isGood: true });
      const payload = createVocalProfilePayload(lowestMidi, highestMidi);
      await syncVocalProfileToOrganizador(payload, recorded, plan.steps);
      setStage('completed');
    }, plan.totalDurationSec * 1000 + 150);
  }, [isTesting, lowestMidi, highestMidi, keepGuideInEar, engine, t]);

  return {
    stage, setStage, lowestMidi, highestMidi, currentMidi, setCurrentMidi,
    keepGuideInEar, setKeepGuideInEar, isTesting, feedback, setFeedback,
    samples, staircasePlan, completedStages, profilePayload,
    runSweep, runSingleNoteTest, runStaircase,
  };
}
