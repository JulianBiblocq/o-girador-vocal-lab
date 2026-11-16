/**
 * MaracatuVocalGames.tsx
 * Atelier Jeux de Voix Maracatu connectés à la Toada active (BPM, troupeKey, voyelles longues)
 * + UnifiedPitchDialCanvas 60 FPS (Flèche 150ms + 1s & Chrono Endurance Roda) (< 140 lignes).
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { MaracatuVocalGameEngine, registerTreinoKillSwitch, extractToadaVocalGameContext, loadEnduranceBestSec } from '../../audio/maracatuVocalGameEngine';
import type { MaracatuGameId, VocalGameEvaluation } from '../../audio/vocalGameAnalyzers';
import type { RodaProjectionStatus } from '../../audio/rodaResonanceAnalyzer';
import type { VocalStepData, PitchCurvePoint } from '../../types/vocalPack.types';
import { loadVocalProfile } from '../../utils/ambitusStorage';
import { noteNameToMidi, midiToNoteName } from '../../utils/noteUtils';
import { formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../../audio/forcedMelodyAligner';
import { UnifiedPitchDialCanvas, type UnifiedPitchDialLiveState } from '../common/UnifiedPitchDialCanvas';
import { MelodicHighwayCanvas } from './MelodicHighwayCanvas';
import { RodaProjectionGauge } from './RodaProjectionGauge';
import { MaracatuGameEvaluationCard } from './MaracatuGameEvaluationCard';
import { Play, Square, Volume2, Music, Trophy, CheckCircle2 } from 'lucide-react';

export const MaracatuVocalGames: React.FC = () => {
  const { t, language } = useLanguage(), { project, activePattern } = useToadaProject();
  const engine = useMemo(() => new MaracatuVocalGameEngine(), []);
  const profile = useMemo(() => loadVocalProfile(), []);
  const fallbackMidi = useMemo(() => (profile ? noteNameToMidi(profile.vocalProfile.comfortCenterNote) : undefined), [profile]);
  const ctx = useMemo(() => extractToadaVocalGameContext(project, activePattern, fallbackMidi), [project, activePattern, fallbackMidi]);

  const [gameId, setGameId] = useState<MaracatuGameId>('tir_franc'), [transposeSt, setTransposeSt] = useState(0);
  const [syllable, setSyllable] = useState<string>(() => ctx.attackSyl), [isRunning, setIsRunning] = useState(false);
  const [evaluation, setEvaluation] = useState<VocalGameEvaluation | null>(null), [curve, setCurve] = useState<PitchCurvePoint[]>([]);
  const [liveProjPct, setLiveProjPct] = useState<number>(0), [liveProjStatus, setLiveProjStatus] = useState<RodaProjectionStatus>('timide');
  const [bestEnduranceSec, setBestEnduranceSec] = useState<number>(() => loadEnduranceBestSec());

  const bpm = ctx.bpm, beatDur = 60 / bpm, isEnduranceGame = gameId === 'o_chamado' || gameId === 'a_voz_na_roda';
  const baseMidi = isEnduranceGame ? ctx.holdNote : ctx.attackNote;
  const targetMidi = Math.max(36, Math.min(84, baseMidi + transposeSt)), secondMidi = Math.max(36, Math.min(84, ctx.secondNote + transposeSt));
  const targetNoteName = `${formatPaperNoteCode(targetMidi)} (${formatSolfegeNoteWithOctave(targetMidi, language)})`;

  const playheadRef = useRef(0), statusBannerRef = useRef<HTMLDivElement | null>(null), progressBarRef = useRef<HTMLDivElement | null>(null);
  const liveCurveRef = useRef<PitchCurvePoint[]>([]), liveGaugeRef = useRef<((pct: number, st: RodaProjectionStatus) => void) | null>(null);
  const liveDialRef = useRef<UnifiedPitchDialLiveState>({
    isVoiced: false, centsDelta: 0, holdProgress01: 0,
    primaryNoteLabel: formatPaperNoteCode(targetMidi), secondaryLabel: formatSolfegeNoteWithOctave(targetMidi, language),
    enduranceSec: isEnduranceGame ? 0 : null,
  });

  useEffect(() => { setSyllable(isEnduranceGame ? ctx.holdSyl : ctx.attackSyl); }, [ctx.attackSyl, ctx.holdSyl, isEnduranceGame]);
  useEffect(() => {
    liveDialRef.current = { isVoiced: false, centsDelta: 0, holdProgress01: 0, primaryNoteLabel: formatPaperNoteCode(targetMidi), secondaryLabel: formatSolfegeNoteWithOctave(targetMidi, language), enduranceSec: isEnduranceGame ? 0 : null };
  }, [targetMidi, language, isEnduranceGame]);
  useEffect(() => { const unreg = registerTreinoKillSwitch(() => { engine.stop(); setIsRunning(false); }); return () => { unreg(); engine.stop(); }; }, [engine]);

  const stepBricks: VocalStepData[] = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const m = i >= 32 ? secondMidi : targetMidi, nName = midiToNoteName(m), isHead = i === 16 || i === 32;
    return { stepIndex: i, active: i >= 16, note: isHead ? nName : '───', midiNumber: i >= 16 ? m : 0, velocity: 100, decay: 1, syllable: i === 16 ? (ctx.holdSyl || 'Ô───') : i === 32 ? nName : '', syllableAttack: isHead };
  }), [targetMidi, secondMidi, ctx.holdSyl]);

  const handleToggleGame = useCallback(async () => {
    if (isRunning) { engine.stop(); setIsRunning(false); return; }
    setIsRunning(true); setEvaluation(null); setCurve([]); liveCurveRef.current = []; playheadRef.current = 0;
    await engine.startGame(gameId, targetMidi, bpm, (tick) => {
      playheadRef.current = 4 * beatDur + tick.elapsedSingSec;
      if (tick.liveCurvePoint) liveCurveRef.current.push(tick.liveCurvePoint);
      if (tick.phase === 'sing' && tick.rms >= 0.015) liveGaugeRef.current?.(tick.projectionScorePct, tick.projectionStatus);
      liveDialRef.current = {
        isVoiced: tick.phase === 'sing' && tick.pitchMidi > 0 && tick.rms >= 0.018,
        centsDelta: tick.centsDelta, holdProgress01: tick.holdProgress01,
        primaryNoteLabel: `${syllable} • ${formatPaperNoteCode(targetMidi)}`,
        secondaryLabel: formatSolfegeNoteWithOctave(targetMidi, language),
        enduranceSec: isEnduranceGame ? tick.enduranceSec : null,
      };
      if (statusBannerRef.current) statusBannerRef.current.textContent = tick.phase === 'precount' ? `${t('gamePrecountStatus')} (${tick.beatIndex + 1}/4)` : `${t('gameSingNowStatus')} — ${tick.pitchMidi > 0 ? midiToNoteName(Math.round(tick.pitchMidi)) : '...'}`;
      if (progressBarRef.current) progressBarRef.current.style.transform = `scaleX(${(tick.phase === 'sing' ? Math.min(1, tick.elapsedSingSec / tick.totalSingSec) : 0).toFixed(3)})`;
    }, (res) => {
      setIsRunning(false); setEvaluation(res); setCurve(res.pitchCurve.length ? res.pitchCurve : [...liveCurveRef.current]);
      setBestEnduranceSec(loadEnduranceBestSec());
      if (res.projectionScorePct !== undefined) setLiveProjPct(res.projectionScorePct);
      if (res.projectionStatus) setLiveProjStatus(res.projectionStatus);
    }, ctx.referencePitchHz);
  }, [isRunning, engine, gameId, targetMidi, bpm, beatDur, syllable, language, isEnduranceGame, ctx.referencePitchHz, t]);

  const goalText = gameId === 'tir_franc' ? t('game1Goal') : gameId === 'o_chamado' ? t('game2Goal') : gameId === 'voz_no_passo' ? t('game3Goal') : t('game4Goal');
  const instrText = gameId === 'tir_franc' ? t('game1Instruction') : gameId === 'o_chamado' ? t('game2Instruction') : gameId === 'voz_no_passo' ? t('game3Instruction') : t('game4Instruction');

  return (
    <div className="space-y-4">
      <div className="cordel-card p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--cordel-border-sub)] text-xs font-mono">
          <span className="flex items-center gap-1.5 font-bold text-theme-accent"><Music className="w-3.5 h-3.5" /><span>{project.title} • {activePattern.name} ({bpm} BPM • {ctx.troupeKeyRoot})</span></span>
          <div className="flex items-center gap-2">
            {isEnduranceGame && bestEnduranceSec > 0 && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-[11px] inline-flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500" /><span>{t('gameEnduranceRecordLabel', { sec: bestEnduranceSec.toFixed(1) })}</span></span>}
            {ctx.hasToadaNotes && <span className="px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">{t('gameToadaContextualizedBadge')}</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {([{ id: 'tir_franc', label: t('game1Tab') }, { id: 'o_chamado', label: t('game2Tab') }, { id: 'voz_no_passo', label: t('game3Tab') }, { id: 'a_voz_na_roda', label: t('game4Tab') }] as { id: MaracatuGameId; label: string }[]).map((g) => (
            <button key={g.id} type="button" onClick={() => { engine.stop(); setIsRunning(false); setEvaluation(null); setGameId(g.id); }} className={`p-2 text-xs font-bold border rounded text-left cursor-pointer transition-transform ${gameId === g.id ? 'bg-[#9a3412] text-[#f4ecd8] border-[#9a3412] shadow-sm -translate-y-0.5' : 'bg-[var(--cordel-subcard-bg)] text-[var(--cordel-text)] border-[var(--cordel-border-sub)] hover:border-[var(--cordel-accent)]'}`}>{g.label}</button>
          ))}
        </div>
        <div className="cordel-card-sm p-3 text-xs space-y-1.5 rounded">
          <p className="font-bold text-[#9a3412] dark:text-[#f4a261]">{goalText}</p>
          <p className="italic text-[var(--cordel-secondary-text)]">{instrText}</p>
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {ctx.longVowels.map((syl) => <button key={syl} type="button" onClick={() => setSyllable(syl)} className={`px-2.5 py-1 text-xs font-bold border rounded cursor-pointer ${syllable === syl ? 'bg-[var(--cordel-coro)] text-[#f4ecd8] border-[var(--cordel-coro)]' : 'cordel-btn'}`}>{syl}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cordel-border-sub)] pt-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--cordel-text)] flex-wrap">
            <span>{t('gameTargetNoteLabel')}</span>
            <button type="button" onClick={() => setTransposeSt((s) => s - 1)} className="cordel-btn px-2 py-1 rounded cursor-pointer">{t('gameTransposeDown')}</button>
            <span className="font-mono px-2.5 py-1 cordel-card-sm rounded border border-[var(--cordel-border-sub)]">{targetNoteName} ({transposeSt >= 0 ? `+${transposeSt}` : transposeSt} st)</span>
            <button type="button" onClick={() => setTransposeSt((s) => s + 1)} className="cordel-btn px-2 py-1 rounded cursor-pointer">{t('gameTransposeUp')}</button>
            <button type="button" onClick={() => void engine.playReference(targetMidi, ctx.referencePitchHz)} className="cordel-btn px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"><Volume2 className="w-3.5 h-3.5" /><span>{t('gameListenRefBtn')}</span></button>
          </div>
          <button type="button" onClick={handleToggleGame} className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border rounded cursor-pointer ${isRunning ? 'bg-[#c25e38] text-white border-[#c25e38]' : 'cordel-btn-primary'}`}>
            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}<span>{isRunning ? t('gameStopBtn') : t('gameStartBtn')}</span>
          </button>
        </div>
        <div className="space-y-1">
          <div ref={statusBannerRef} className="text-xs font-mono font-bold text-[var(--cordel-accent-text)] min-h-[18px]" />
          <div className="w-full h-2 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded overflow-hidden"><div ref={progressBarRef} className="h-full w-full origin-left bg-[var(--cordel-coro)]" style={{ transform: 'scaleX(0)' }} /></div>
        </div>
        {gameId !== 'voz_no_passo' && <UnifiedPitchDialCanvas liveStateRef={liveDialRef} heightPx={184} onCenterTap={() => void engine.playReference(targetMidi, ctx.referencePitchHz)} centerTapTitle={t('gameListenRefBtn')} />}
        {evaluation?.arrowPlanted && gameId === 'tir_franc' && <div className="px-3 py-1.5 rounded bg-emerald-600/20 border border-emerald-500 text-emerald-900 dark:text-emerald-200 text-xs font-mono font-bold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>{t('gameArrowPlantedBadge')}</span></div>}
        {isEnduranceGame && <RodaProjectionGauge projectionScorePct={liveProjPct} status={liveProjStatus} isActive={isRunning} liveUpdaterRef={liveGaugeRef} />}
        {gameId === 'voz_no_passo' && <MelodicHighwayCanvas allSteps={stepBricks} studentPitchCurve={curve} totalDurationSec={12 * beatDur} beatsPerMeasure={4} hasAnacrusis={true} isPlaying={isRunning} getPlayheadSec={() => playheadRef.current} />}
        {evaluation && <MaracatuGameEvaluationCard evaluation={evaluation} gameId={gameId} t={t} />}
      </div>
    </div>
  );
};
