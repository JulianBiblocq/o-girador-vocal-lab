/**
 * ChanterToadaWorkshop.tsx — Atelier 1 du Studio Élève 2.0 : Autoroute 60 FPS, Paliers 75➔88➔100%, Jauge Projection Roda & Diagnostic 4 Piliers (< 138 lignes).
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TrainerConfigBar, type TrainerScope, type StudentRole, type TrainerGuideMode, type TrainerPatternOption } from './TrainerConfigBar';
import { KaraokeLyricsBanner, type KaraokeSyllableItem } from './KaraokeLyricsBanner';
import { MelodicHighwayCanvas } from './MelodicHighwayCanvas';
import { RodaProjectionGauge } from './RodaProjectionGauge';
import { StudentDiagnosticCard } from './StudentDiagnosticCard';
import { StudentTrainerEngine, type ComparativePlaybackMode } from '../../audio/StudentTrainerEngine';
import { analyzeStudentTake, type StudentAnalysisResult } from '../../audio/studentPitchAnalyzer';
import type { RodaProjectionStatus, SessionProjectionSummary } from '../../audio/rodaResonanceAnalyzer';
import {
  loadPatternSpeedMastery, savePatternSpeedMastery, evaluateSpeedTierProgression,
  computeWeightedStudentScore, countMasteredPatternsInToada, type PatternSpeedMastery,
} from '../../utils/progressiveSpeedMastery';
import { exportStudentEvaluationJson } from '../../utils/studentEvaluationExporter';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { DEFAULT_HARMONY_CONFIG } from '../../types/harmony.types';
import type { PitchCurvePoint } from '../../types/vocalPack.types';
import { Play, Square, Sparkles } from 'lucide-react';

export const ChanterToadaWorkshop: React.FC = () => {
  const { project, activePattern, setActivePatternId, getPreviousConductorPattern, updateHarmonyConfig } = useToadaProject();
  const { selectedDeviceId, selectedOutputDeviceId } = useAudioHardware();
  const { t } = useLanguage();
  const engine = useMemo(() => new StudentTrainerEngine(), []);
  const playheadSecRef = useRef<number>(0), loopEnabledRef = useRef<boolean>(false), speedRatioRef = useRef<number>(0.75);

  const [scope, setScope] = useState<TrainerScope>('pattern'), [studentRole, setStudentRole] = useState<StudentRole>('coro');
  const [guideMode, setGuideMode] = useState<TrainerGuideMode>('accompanied'), [speedRatio, setSpeedRatio] = useState<number>(0.75);
  const [autoProgression, setAutoProgression] = useState<boolean>(true), [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false), [isPlayingComparative, setIsPlayingComparative] = useState<boolean>(false);
  const [comparativeMode, setComparativeMode] = useState<ComparativePlaybackMode>('mix'), [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [livePitchCurve, setLivePitchCurve] = useState<PitchCurvePoint[]>([]), [studentPCM, setStudentPCM] = useState<Float32Array | null>(null);
  const [studentSampleRate, setStudentSampleRate] = useState<number>(44100), [analysisResult, setAnalysisResult] = useState<StudentAnalysisResult | null>(null);
  const [liveProjPct, setLiveProjPct] = useState<number>(0), [liveProjStatus, setLiveProjStatus] = useState<RodaProjectionStatus>('timide');
  const [projectionSummary, setProjectionSummary] = useState<SessionProjectionSummary | null>(null), [tierToast, setTierToast] = useState<string | null>(null);
  const [patternMastery, setPatternMastery] = useState<PatternSpeedMastery>(() => loadPatternSpeedMastery(project.id, activePattern.id));

  loopEnabledRef.current = loopEnabled; speedRatioRef.current = speedRatio;
  useEffect(() => {
    const m = loadPatternSpeedMastery(project.id, activePattern.id);
    setPatternMastery(m); setSpeedRatio(m.tier88 ? 1.0 : m.tier75 ? 0.88 : 0.75);
  }, [project.id, activePattern.id]);

  const toadaMasteryCounts = useMemo(() => countMasteredPatternsInToada(project.id, project.patterns.map((p) => p.id)), [project.id, project.patterns, patternMastery]);
  const patternOptions: TrainerPatternOption[] = useMemo(() => project.patterns.map((p) => {
    const m = loadPatternSpeedMastery(project.id, p.id);
    return { id: p.id, name: p.name, role: p.role, badge: m.tier100 ? '[100%]' : m.tier88 ? '[88%]' : m.tier75 ? '[75%]' : '' };
  }), [project.id, project.patterns, patternMastery]);

  const baseBpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88, bpm = Math.max(30, Math.round(baseBpm * speedRatio));
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature), beatDur = 60 / bpm, measuresCount = activePattern.measuresCount;
  const hasAnac = activePattern.hasAnacrusis !== false, totalDurationSec = (hasAnac ? 1 + measuresCount : measuresCount) * beatsPerMeasure * beatDur;
  const allSteps = useMemo(() => [...(hasAnac ? (activePattern.anacrusisSteps || []) : []), ...(activePattern.pack?.grid.steps ?? activePattern.mainSteps ?? [])], [activePattern, hasAnac]);
  const syllables: KaraokeSyllableItem[] = useMemo(() => allSteps.map((s, idx) => ({ text: s.syllable || '', stepIndex: idx })).filter((s) => s.text.length > 0 && s.text !== '───'), [allSteps]);

  useEffect(() => {
    const kill = () => { engine.stop(); setIsTraining(false); setIsPlayingComparative(false); };
    const unregister = registerTreinoKillSwitch(kill);
    return () => { unregister(); kill(); };
  }, [engine]);

  const handleStartTraining = useCallback(async () => {
    setIsTraining(true); setIsPlayingComparative(false); setAnalysisResult(null); setStudentPCM(null); setLivePitchCurve([]); setTierToast(null);
    const curRatio = speedRatioRef.current, curBpm = Math.max(30, Math.round(baseBpm * curRatio));
    const curTotalDur = (hasAnac ? 1 + measuresCount : measuresCount) * beatsPerMeasure * (60 / curBpm);
    await engine.startTraining(
      {
        pattern: activePattern, cuePattern: scope === 'toada' ? getPreviousConductorPattern() : null, baseBpm, bpm: curBpm, speedRatio: curRatio,
        beatsPerMeasure, measuresCount, scope, studentRole, guideMode, deviceId: selectedDeviceId, outputDeviceId: selectedOutputDeviceId, harmonyConfig: project.harmonyConfig,
      },
      (elapsedSec, step, livePt, liveProj) => {
        playheadSecRef.current = elapsedSec; setActiveStepIndex(step);
        if (livePt) setLivePitchCurve((prev) => [...prev, livePt]);
        if (liveProj?.isVoiced) { setLiveProjPct(liveProj.projectionScorePct); setLiveProjStatus(liveProj.status); }
      },
      (pcm, sr, projSum) => {
        setStudentPCM(pcm); setStudentSampleRate(sr); setProjectionSummary(projSum);
        setLiveProjPct(projSum.avgProjectionScorePct); setLiveProjStatus(projSum.dominantStatus);
        const analysis = analyzeStudentTake({ rawPCM: pcm, sampleRate: sr, totalDurationSec: curTotalDur, targetSteps: allSteps, bpm: curBpm, shouldAnalyzeNotes: true });
        setAnalysisResult(analysis);
        const weighted = computeWeightedStudentScore(analysis.pitchAccuracyPct, analysis.attackPrecisionPct, analysis.stabilityPct);
        const outcome = evaluateSpeedTierProgression({ currentSpeedRatio: curRatio, weightedScorePct: weighted, autoProgressionEnabled: autoProgression, previousMastery: loadPatternSpeedMastery(project.id, activePattern.id) });
        savePatternSpeedMastery(project.id, activePattern.id, outcome.updatedMastery);
        setPatternMastery(outcome.updatedMastery);
        if (outcome.unlockedTier === 75) setTierToast(t('tierUnlocked75Toast', { score: weighted }));
        else if (outcome.unlockedTier === 88) setTierToast(t('tierUnlocked88Toast', { score: weighted }));
        else if (outcome.unlockedTier === 100) setTierToast(t('tierUnlocked100Toast', { score: weighted }));
        if (outcome.advancedToNextTier) { speedRatioRef.current = outcome.nextSpeedRatio; setSpeedRatio(outcome.nextSpeedRatio); }
        if (loopEnabledRef.current) setTimeout(() => { if (loopEnabledRef.current) handleStartTraining(); else setIsTraining(false); }, 450);
        else setIsTraining(false);
      }
    );
  }, [engine, project.id, activePattern, scope, getPreviousConductorPattern, baseBpm, beatsPerMeasure, measuresCount, hasAnac, studentRole, guideMode, selectedDeviceId, selectedOutputDeviceId, project.harmonyConfig, allSteps, autoProgression, t]);

  const handleStop = useCallback(() => { loopEnabledRef.current = false; setLoopEnabled(false); engine.stop(); setIsTraining(false); setIsPlayingComparative(false); }, [engine]);
  const handlePlayComparative = useCallback(async (mode: ComparativePlaybackMode) => {
    if (!studentPCM) return;
    setComparativeMode(mode); setIsPlayingComparative(true);
    await engine.playComparative(studentPCM, studentSampleRate, activePattern, baseBpm, speedRatio, mode, () => setIsPlayingComparative(false));
  }, [engine, studentPCM, studentSampleRate, activePattern, baseBpm, speedRatio]);
  const handleExport = useCallback(() => {
    if (!analysisResult) return;
    exportStudentEvaluationJson({ patternId: activePattern.id, patternName: activePattern.name, patternRole: activePattern.role, accuracyScore: analysisResult.accuracyScore, okNotes: analysisResult.okNotes, totalNotes: analysisResult.totalNotes, studentPitchCurve: analysisResult.studentPitchCurve, date: new Date().toISOString() });
  }, [analysisResult, activePattern]);

  return (
    <div className="flex flex-col gap-3 w-full max-w-none">
      <TrainerConfigBar
        scope={scope} onScopeChange={setScope} studentRole={studentRole} onStudentRoleChange={setStudentRole}
        guideMode={guideMode} onGuideModeChange={setGuideMode} speedRatio={speedRatio} onSpeedRatioChange={setSpeedRatio}
        loopEnabled={loopEnabled} onToggleLoop={() => setLoopEnabled((v) => !v)} autoProgressionEnabled={autoProgression} onToggleAutoProgression={() => setAutoProgression((v) => !v)}
        patternMastery={patternMastery} masteredPatternsCount={toadaMasteryCounts.masteredCount} totalPatternsCount={toadaMasteryCounts.totalCount}
        patternOptions={patternOptions} activePatternId={activePattern.id} onSelectPattern={setActivePatternId} disabled={isTraining || isPlayingComparative}
      />
      {tierToast && <div className="cordel-card p-2.5 bg-amber-500/20 border-amber-500/60 text-amber-900 dark:text-amber-200 font-mono text-xs font-bold flex items-center gap-2 rounded"><Sparkles className="w-4 h-4 text-amber-500 shrink-0" /><span>{tierToast}</span></div>}
      <KaraokeLyricsBanner currentRole={activePattern.role} studentRole={studentRole} patternName={activePattern.name} syllables={syllables} activeStepIndex={activeStepIndex} />
      <MelodicHighwayCanvas allSteps={allSteps} mestrePitchCurve={activePattern.pitchCurve} studentPitchCurve={isTraining ? livePitchCurve : (analysisResult?.studentPitchCurve ?? livePitchCurve)} totalDurationSec={totalDurationSec} beatsPerMeasure={beatsPerMeasure} hasAnacrusis={hasAnac} isPlaying={isTraining || isPlayingComparative} getPlayheadSec={() => playheadSecRef.current} />
      <RodaProjectionGauge projectionScorePct={liveProjPct} status={liveProjStatus} isActive={isTraining} />
      <div className="cordel-card p-2.5 w-full flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2">
          {!isTraining ? <button type="button" onClick={handleStartTraining} className="cordel-btn-primary py-1.5 px-4 flex items-center gap-1.5 text-xs font-bold rounded cursor-pointer"><Play className="w-4 h-4 fill-current text-[var(--cordel-on-primary)]" /><span>{t('btn_start_training')}</span></button> : <button type="button" onClick={handleStop} className="bg-[#c25e38] text-white border border-[#c25e38] animate-pulse py-1.5 px-4 flex items-center gap-1.5 text-xs font-bold rounded cursor-pointer"><Square className="w-4 h-4 fill-current" /><span>{t('btn_stop_training')}</span></button>}
          <HarmonyProfileSelector config={project.harmonyConfig ?? DEFAULT_HARMONY_CONFIG} onChange={updateHarmonyConfig} disabled={isTraining || isPlayingComparative} />
        </div>
      </div>
      {analysisResult && studentPCM && <StudentDiagnosticCard result={analysisResult} projectionSummary={projectionSummary} isPlayingComparative={isPlayingComparative} activeComparativeMode={comparativeMode} onPlayComparative={handlePlayComparative} onStopComparative={handleStop} onExport={handleExport} />}
    </div>
  );
};
