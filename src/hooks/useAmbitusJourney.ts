/**
 * useAmbitusJourney.ts
 * Hook d'orchestration audio et gestion d'état du parcours d'ambitus en 4 étapes.
 * Strictement < 120 lignes.
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AmbitusAudioEngine } from '../audio/ambitusAudioEngine';
import { MIN_PROJECTION_RMS, type ValidationSample } from '../audio/ambitusValidator';
import { analyzeAmbitusSweep, buildAmbitusStaircase } from '../audio/ambitusSweepAndStairs';
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
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isGood: boolean } | null>(null);
  const [samples, setSamples] = useState<ValidationSample[]>([]);
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

  const onCompleteStaircase = useCallback(async (recorded: ValidationSample[]) => {
    setCompletedStages((p) => (p.includes('staircase') ? p : [...p, 'staircase']));
    setFeedback({ text: t('ambitusStaircaseSuccess'), isGood: true });
    const payload = createVocalProfilePayload(lowestMidi, highestMidi);
    const plan = buildAmbitusStaircase(lowestMidi, highestMidi, 5);
    await syncVocalProfileToOrganizador(payload, recorded, plan.steps);
    setStage('completed');
  }, [lowestMidi, highestMidi, t]);

  return {
    engine, stage, setStage, lowestMidi, setLowestMidi, highestMidi, setHighestMidi,
    currentMidi, setCurrentMidi, isTesting, setIsTesting, feedback, setFeedback,
    samples, setSamples, completedStages, setCompletedStages, profilePayload,
    runSweep, onCompleteStaircase,
  };
}

