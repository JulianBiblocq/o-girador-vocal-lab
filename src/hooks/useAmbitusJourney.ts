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

  const [stage, setStage] = useState<AmbitusStage>('sweep');
  const [lowestMidi, setLowestMidi] = useState(() => (saved ? noteNameToMidi(saved.vocalProfile.lowestSolidNote) : 50));
  const [highestMidi, setHighestMidi] = useState(() => (saved ? noteNameToMidi(saved.vocalProfile.highestSolidNote) : 64));
  const [medianMidi, setMedianMidi] = useState(() => (saved ? Math.round((noteNameToMidi(saved.vocalProfile.lowestSolidNote) + noteNameToMidi(saved.vocalProfile.highestSolidNote)) / 2) : 55));
  const [currentMidi, setCurrentMidi] = useState(() => (saved ? Math.round((noteNameToMidi(saved.vocalProfile.lowestSolidNote) + noteNameToMidi(saved.vocalProfile.highestSolidNote)) / 2) : 55));
  const [isTesting, setIsTesting] = useState(false);
  const [sweepCountdown, setSweepCountdown] = useState<number | null>(null);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepRemainingSec, setSweepRemainingSec] = useState(6.0);
  const [sweepLiveMidi, setSweepLiveMidi] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; isGood: boolean } | null>(null);
  const [samples, setSamples] = useState<ValidationSample[]>([]);
  const [completedStages, setCompletedStages] = useState<AmbitusStage[]>(() =>
    saved ? ['sweep', 'low_test', 'high_test', 'staircase'] : []
  );
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const kill = () => {
      abortRef.current = true;
      if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      engine.stopListening();
      setSweepCountdown(null);
      setIsTesting(false);
    };
    const unregister = registerTreinoKillSwitch(kill);
    return () => { unregister(); kill(); };
  }, [engine]);

  const profilePayload = useMemo(() => createVocalProfilePayload(lowestMidi, highestMidi), [lowestMidi, highestMidi]);

  const runSweep = useCallback(async () => {
    if (isTesting) return;
    abortRef.current = false;
    setIsTesting(true); setFeedback(null); setSamples([]);
    setSweepProgress(0); setSweepRemainingSec(6.0); setSweepLiveMidi(0);

    for (const c of [3, 2, 1]) {
      if (abortRef.current) return;
      setSweepCountdown(c);
      engine.playReferenceNote(60, 0.12, 0.22).catch(() => { });
      await new Promise((r) => { timerRef.current = window.setTimeout(r, 650); });
    }
    if (abortRef.current) return;
    setSweepCountdown(0);
    engine.playReferenceNote(67, 0.14, 0.28).catch(() => { });
    await new Promise((r) => { timerRef.current = window.setTimeout(r, 250); });
    if (abortRef.current) return;

    const liveArr: ValidationSample[] = [];
    const sweepDur = 6.0;
    const stopFn = await engine.startListening((tick) => {
      setSweepProgress(Math.round(tick.progressRatio * 100));
      setSweepRemainingSec(Math.max(0, +(sweepDur * (1 - tick.progressRatio)).toFixed(1)));
      setSweepLiveMidi(tick.pitchMidi);
      if (tick.pitchMidi > 0) {
        liveArr.push({ timeSec: +(tick.progressRatio * sweepDur).toFixed(2), pitchMidi: tick.pitchMidi, rms: tick.rms });
        setSamples([...liveArr]);
      }
    }, sweepDur);

    timerRef.current = window.setTimeout(async () => {
      const recorded = await stopFn();
      setSweepCountdown(null); setIsTesting(false); setSamples(recorded);
      const res = analyzeAmbitusSweep(recorded, MIN_PROJECTION_RMS);
      setLowestMidi(res.candidateLowMidi);
      setMedianMidi(res.candidateMedianMidi);
      setHighestMidi(res.candidateHighMidi);
      setCurrentMidi(res.candidateMedianMidi);
      setCompletedStages((prev) => (prev.includes('sweep') ? prev : [...prev, 'sweep']));
      setFeedback({
        text: `${t('ambitusSweepDonePrompt', { low: midiToNoteName(res.candidateLowMidi), high: midiToNoteName(res.candidateHighMidi) })} • Médiane confort : ${midiToNoteName(res.candidateMedianMidi)}`,
        isGood: true,
      });
    }, sweepDur * 1000 + 100);
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
    medianMidi, setMedianMidi, currentMidi, setCurrentMidi, isTesting, setIsTesting,
    sweepCountdown, sweepProgress, sweepRemainingSec, sweepLiveMidi,
    feedback, setFeedback, samples, setSamples, completedStages, setCompletedStages,
    profilePayload, runSweep, onCompleteStaircase,
  };
}

