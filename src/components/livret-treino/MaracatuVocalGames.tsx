/**
 * MaracatuVocalGames.tsx
 * Atelier 2 : 4 Jeux de Voix Maracatu contextualisés sur la Toada active + Défi « A Voz na Roda » (< 140 lignes).
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { MaracatuVocalGameEngine, registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import type { MaracatuGameId, VocalGameEvaluation } from '../../audio/vocalGameAnalyzers';
import type { RodaProjectionStatus } from '../../audio/rodaResonanceAnalyzer';
import type { VocalStepData, PitchCurvePoint } from '../../types/vocalPack.types';
import { loadVocalProfile } from '../../utils/ambitusStorage';
import { noteNameToMidi, midiToNoteName } from '../../utils/noteUtils';
import { MelodicHighwayCanvas } from './MelodicHighwayCanvas';
import { RodaProjectionGauge } from './RodaProjectionGauge';
import { MaracatuGameEvaluationCard } from './MaracatuGameEvaluationCard';
import { Play, Square, Volume2, Music } from 'lucide-react';

const CALL_SYLLABLES = ['Ô !', 'Ê !', 'Nagô !'] as const;

export const MaracatuVocalGames: React.FC = () => {
  const { t } = useLanguage(), { project, activePattern } = useToadaProject();
  const engine = useMemo(() => new MaracatuVocalGameEngine(), []);
  const profile = useMemo(() => loadVocalProfile(), []);
  const fallbackMidi = useMemo(() => (profile ? noteNameToMidi(profile.vocalProfile.comfortCenterNote) : 60), [profile]);

  const [gameId, setGameId] = useState<MaracatuGameId>('tir_franc'), [transposeSt, setTransposeSt] = useState(0);
  const [syllable, setSyllable] = useState<string>(CALL_SYLLABLES[0]), [isRunning, setIsRunning] = useState(false);
  const [evaluation, setEvaluation] = useState<VocalGameEvaluation | null>(null), [curve, setCurve] = useState<PitchCurvePoint[]>([]);
  const [liveProjPct, setLiveProjPct] = useState<number>(0), [liveProjStatus, setLiveProjStatus] = useState<RodaProjectionStatus>('timide');

  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88, beatDur = 60 / bpm;

  const toadaContext = useMemo(() => {
    const raw = [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])];
    const groups: { midi: number; syllable: string; len: number }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i]; if (!s.active || s.midiNumber <= 0 || s.note === '───') continue;
      let ties = 0; while (i + 1 + ties < raw.length && raw[i + 1 + ties].note === '───') ties++;
      groups.push({ midi: s.midiNumber, syllable: s.syllable?.trim() || '', len: 1 + ties }); i += ties;
    }
    const attackNote = groups[0]?.midi ?? fallbackMidi, attackSyl = groups[0]?.syllable || CALL_SYLLABLES[0];
    const holdGroup = [...groups].sort((a, b) => b.len - a.len)[0];
    const holdNote = holdGroup?.midi ?? attackNote, holdSyl = holdGroup?.syllable || attackSyl;
    const secondNote = groups.find((g) => g.midi !== attackNote)?.midi ?? attackNote;
    return { attackNote, attackSyl, holdNote, holdSyl, secondNote, hasToadaNotes: groups.length > 0 };
  }, [activePattern, fallbackMidi]);

  const baseMidi = gameId === 'o_chamado' || gameId === 'a_voz_na_roda' ? toadaContext.holdNote : toadaContext.attackNote;
  const targetMidi = Math.max(36, Math.min(84, baseMidi + transposeSt)), secondMidi = Math.max(36, Math.min(84, toadaContext.secondNote + transposeSt));
  const targetNoteName = midiToNoteName(targetMidi);
  const playheadRef = useRef(0), statusBannerRef = useRef<HTMLDivElement | null>(null), progressBarRef = useRef<HTMLDivElement | null>(null), liveCurveRef = useRef<PitchCurvePoint[]>([]);

  useEffect(() => {
    const unregister = registerTreinoKillSwitch(() => { engine.stop(); setIsRunning(false); });
    return () => { unregister(); engine.stop(); };
  }, [engine]);

  const stepBricks: VocalStepData[] = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const m = i >= 32 ? secondMidi : targetMidi, nName = midiToNoteName(m), isHead = i === 16 || i === 32;
    return { stepIndex: i, active: i >= 16, note: isHead ? nName : '───', midiNumber: i >= 16 ? m : 0, velocity: 100, decay: 1, syllable: i === 16 ? (toadaContext.holdSyl || 'Ô───') : i === 32 ? nName : '', syllableAttack: isHead };
  }), [targetMidi, secondMidi, toadaContext.holdSyl]);

  const handleToggleGame = useCallback(async () => {
    if (isRunning) { engine.stop(); setIsRunning(false); return; }
    setIsRunning(true); setEvaluation(null); setCurve([]); liveCurveRef.current = []; playheadRef.current = 0;
    await engine.startGame(gameId, targetMidi, bpm, (tick) => {
      playheadRef.current = 4 * beatDur + tick.elapsedSingSec;
      if (tick.liveCurvePoint) liveCurveRef.current.push(tick.liveCurvePoint);
      if (tick.phase === 'sing' && tick.rms >= 0.015) { setLiveProjPct(tick.projectionScorePct); setLiveProjStatus(tick.projectionStatus); }
      if (statusBannerRef.current) statusBannerRef.current.textContent = tick.phase === 'precount' ? `${t('gamePrecountStatus')} (${tick.beatIndex + 1}/4)` : `${t('gameSingNowStatus')} — ${tick.pitchMidi > 0 ? midiToNoteName(Math.round(tick.pitchMidi)) : '...'}`;
      if (progressBarRef.current) progressBarRef.current.style.transform = `scaleX(${(tick.phase === 'sing' ? Math.min(1, tick.elapsedSingSec / tick.totalSingSec) : 0).toFixed(3)})`;
    }, (res) => {
      setIsRunning(false); setEvaluation(res); setCurve(res.pitchCurve.length ? res.pitchCurve : [...liveCurveRef.current]);
      if (res.projectionScorePct !== undefined) setLiveProjPct(res.projectionScorePct);
      if (res.projectionStatus) setLiveProjStatus(res.projectionStatus);
    });
  }, [isRunning, engine, gameId, targetMidi, bpm, beatDur, t]);

  const goalText = gameId === 'tir_franc' ? t('game1Goal') : gameId === 'o_chamado' ? t('game2Goal') : gameId === 'voz_no_passo' ? t('game3Goal') : t('game4Goal');
  const instrText = gameId === 'tir_franc' ? t('game1Instruction') : gameId === 'o_chamado' ? t('game2Instruction') : gameId === 'voz_no_passo' ? t('game3Instruction') : t('game4Instruction');

  return (
    <div className="space-y-4">
      <div className="cordel-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--cordel-border-sub)] text-xs font-mono">
          <span className="flex items-center gap-1.5 font-bold text-theme-accent"><Music className="w-3.5 h-3.5" /><span>{project.title} • {activePattern.name} ({bpm} BPM)</span></span>
          {toadaContext.hasToadaNotes && <span className="px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">{t('gameToadaContextualizedBadge')}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {([
            { id: 'tir_franc', label: t('game1Tab') }, { id: 'o_chamado', label: t('game2Tab') },
            { id: 'voz_no_passo', label: t('game3Tab') }, { id: 'a_voz_na_roda', label: t('game4Tab') },
          ] as { id: MaracatuGameId; label: string }[]).map((g) => (
            <button
              key={g.id} type="button" onClick={() => { engine.stop(); setIsRunning(false); setEvaluation(null); setGameId(g.id); }}
              className={`p-2 text-xs font-bold border rounded text-left cursor-pointer transition-transform ${
                gameId === g.id ? 'bg-[#9a3412] text-[#f4ecd8] border-[#9a3412] shadow-sm -translate-y-0.5' : 'bg-[var(--cordel-subcard-bg)] text-[var(--cordel-text)] border-[var(--cordel-border-sub)] hover:border-[var(--cordel-accent)]'
              }`}
            >{g.label}</button>
          ))}
        </div>
        <div className="cordel-card-sm p-3 text-xs space-y-1.5 rounded">
          <p className="font-bold text-[#9a3412] dark:text-[#f4a261]">{goalText}</p>
          <p className="italic text-[var(--cordel-secondary-text)]">{instrText}</p>
          {gameId === 'tir_franc' && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {Array.from(new Set([toadaContext.attackSyl, ...CALL_SYLLABLES])).filter(Boolean).map((syl) => (
                <button key={syl} type="button" onClick={() => setSyllable(syl)} className={`px-2.5 py-1 text-xs font-bold border rounded cursor-pointer ${syllable === syl ? 'bg-[var(--cordel-coro)] text-[#f4ecd8] border-[var(--cordel-coro)]' : 'cordel-btn'}`}>{syl}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cordel-border-sub)] pt-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--cordel-text)]">
            <span>{t('gameTargetNoteLabel')}</span>
            <button type="button" onClick={() => setTransposeSt((s) => s - 1)} className="cordel-btn px-2 py-1 rounded cursor-pointer">{t('gameTransposeDown')}</button>
            <span className="font-mono px-2.5 py-1 cordel-card-sm rounded border border-[var(--cordel-border-sub)]">{targetNoteName} ({transposeSt >= 0 ? `+${transposeSt}` : transposeSt} st)</span>
            <button type="button" onClick={() => setTransposeSt((s) => s + 1)} className="cordel-btn px-2 py-1 rounded cursor-pointer">{t('gameTransposeUp')}</button>
            <button type="button" onClick={() => engine.playReference(targetMidi)} className="cordel-btn px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"><Volume2 className="w-3.5 h-3.5" /><span>{t('gameListenRefBtn')}</span></button>
          </div>
          <button type="button" onClick={handleToggleGame} className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border rounded cursor-pointer ${isRunning ? 'bg-[#c25e38] text-white border-[#c25e38]' : 'cordel-btn-primary'}`}>
            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}<span>{isRunning ? t('gameStopBtn') : t('gameStartBtn')}</span>
          </button>
        </div>
        <div className="space-y-1">
          <div ref={statusBannerRef} className="text-xs font-mono font-bold text-[var(--cordel-accent-text)] min-h-[18px]" />
          <div className="w-full h-2 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded overflow-hidden"><div ref={progressBarRef} className="h-full w-full origin-left bg-[var(--cordel-coro)]" style={{ transform: 'scaleX(0)' }} /></div>
        </div>
        {(gameId === 'o_chamado' || gameId === 'a_voz_na_roda') && <RodaProjectionGauge projectionScorePct={liveProjPct} status={liveProjStatus} isActive={isRunning} />}
        {gameId === 'voz_no_passo' && <MelodicHighwayCanvas allSteps={stepBricks} studentPitchCurve={curve} totalDurationSec={12 * beatDur} beatsPerMeasure={4} hasAnacrusis={true} isPlaying={isRunning} getPlayheadSec={() => playheadRef.current} />}
        {evaluation && <MaracatuGameEvaluationCard evaluation={evaluation} gameId={gameId} t={t} />}
      </div>
    </div>
  );
};
