/**
 * ChanterToadaWorkshop.tsx
 * Atelier 1 du Studio Élève 2.0 : Autoroute Mélodique 60 FPS, Boucle 🔁, WSOLA 75/85/100%, Appel-Réponse & Diagnostic 3 Piliers (< 138 lignes).
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TrainerConfigBar, type TrainerScope, type StudentRole, type TrainerGuideMode } from './TrainerConfigBar';
import { KaraokeLyricsBanner, type KaraokeSyllableItem } from './KaraokeLyricsBanner';
import { MelodicHighwayCanvas } from './MelodicHighwayCanvas';
import { StudentDiagnosticCard } from './StudentDiagnosticCard';
import { StudentTrainerEngine, type ComparativePlaybackMode } from '../../audio/StudentTrainerEngine';
import { analyzeStudentTake, type StudentAnalysisResult } from '../../audio/studentPitchAnalyzer';
import { exportStudentEvaluationJson } from '../../utils/studentEvaluationExporter';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { DEFAULT_HARMONY_CONFIG } from '../../types/harmony.types';
import type { PitchCurvePoint } from '../../types/vocalPack.types';
import { Play, Square } from 'lucide-react';

export const ChanterToadaWorkshop: React.FC = () => {
  const { project, activePattern, getPreviousConductorPattern, updateHarmonyConfig } = useToadaProject();
  const { selectedDeviceId, selectedOutputDeviceId } = useAudioHardware();
  const { t } = useLanguage();
  const engine = useMemo(() => new StudentTrainerEngine(), []);
  const playheadSecRef = useRef<number>(0);
  const loopEnabledRef = useRef<boolean>(false);

  const [scope, setScope] = useState<TrainerScope>('pattern'), [studentRole, setStudentRole] = useState<StudentRole>('coro');
  const [guideMode, setGuideMode] = useState<TrainerGuideMode>('accompanied'), [speedRatio, setSpeedRatio] = useState<number>(1.0);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false), [isTraining, setIsTraining] = useState<boolean>(false);
  const [isPlayingComparative, setIsPlayingComparative] = useState<boolean>(false), [comparativeMode, setComparativeMode] = useState<ComparativePlaybackMode>('mix');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0), [livePitchCurve, setLivePitchCurve] = useState<PitchCurvePoint[]>([]);
  const [studentPCM, setStudentPCM] = useState<Float32Array | null>(null), [studentSampleRate, setStudentSampleRate] = useState<number>(44100);
  const [analysisResult, setAnalysisResult] = useState<StudentAnalysisResult | null>(null);

  loopEnabledRef.current = loopEnabled;
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
    setIsTraining(true); setIsPlayingComparative(false); setAnalysisResult(null); setStudentPCM(null); setLivePitchCurve([]);
    const cuePat = scope === 'toada' ? getPreviousConductorPattern() : null;
    await engine.startTraining(
      {
        pattern: activePattern, cuePattern: cuePat, baseBpm, bpm, speedRatio,
        beatsPerMeasure, measuresCount, scope, studentRole, guideMode,
        deviceId: selectedDeviceId, outputDeviceId: selectedOutputDeviceId, harmonyConfig: project.harmonyConfig,
      },
      (elapsedSec, step, livePt) => {
        playheadSecRef.current = elapsedSec;
        setActiveStepIndex(step);
        if (livePt) setLivePitchCurve((prev) => [...prev, livePt]);
      },
      (pcm, sr) => {
        setStudentPCM(pcm); setStudentSampleRate(sr);
        const analysis = analyzeStudentTake({ rawPCM: pcm, sampleRate: sr, totalDurationSec, targetSteps: allSteps, bpm, shouldAnalyzeNotes: true });
        setAnalysisResult(analysis);
        if (loopEnabledRef.current) {
          setTimeout(() => { if (loopEnabledRef.current) handleStartTraining(); else setIsTraining(false); }, 450);
        } else {
          setIsTraining(false);
        }
      }
    );
  }, [engine, activePattern, scope, getPreviousConductorPattern, baseBpm, bpm, speedRatio, beatsPerMeasure, measuresCount, studentRole, guideMode, selectedDeviceId, selectedOutputDeviceId, project.harmonyConfig, totalDurationSec, allSteps]);

  const handleStop = useCallback(() => {
    loopEnabledRef.current = false; setLoopEnabled(false);
    engine.stop(); setIsTraining(false); setIsPlayingComparative(false);
  }, [engine]);

  const handlePlayComparative = useCallback(async (mode: ComparativePlaybackMode) => {
    if (!studentPCM) return;
    setComparativeMode(mode); setIsPlayingComparative(true);
    await engine.playComparative(studentPCM, studentSampleRate, activePattern, baseBpm, speedRatio, mode, () => setIsPlayingComparative(false));
  }, [engine, studentPCM, studentSampleRate, activePattern, baseBpm, speedRatio]);

  const handleExport = useCallback(() => {
    if (!analysisResult) return;
    exportStudentEvaluationJson({
      patternId: activePattern.id, patternName: activePattern.name, patternRole: activePattern.role,
      accuracyScore: analysisResult.accuracyScore, okNotes: analysisResult.okNotes, totalNotes: analysisResult.totalNotes,
      studentPitchCurve: analysisResult.studentPitchCurve, date: new Date().toISOString(),
    });
  }, [analysisResult, activePattern]);

  const displayedStudentCurve = isTraining ? livePitchCurve : (analysisResult?.studentPitchCurve ?? livePitchCurve);

  return (
    <div className="flex flex-col gap-3 w-full max-w-none">
      <TrainerConfigBar
        scope={scope} onScopeChange={setScope} studentRole={studentRole} onStudentRoleChange={setStudentRole}
        guideMode={guideMode} onGuideModeChange={setGuideMode} speedRatio={speedRatio} onSpeedRatioChange={setSpeedRatio}
        loopEnabled={loopEnabled} onToggleLoop={() => setLoopEnabled((v) => !v)} disabled={isTraining || isPlayingComparative}
      />
      <KaraokeLyricsBanner currentRole={activePattern.role} studentRole={studentRole} patternName={activePattern.name} syllables={syllables} activeStepIndex={activeStepIndex} />
      <MelodicHighwayCanvas
        allSteps={allSteps} mestrePitchCurve={activePattern.pitchCurve} studentPitchCurve={displayedStudentCurve}
        totalDurationSec={totalDurationSec} beatsPerMeasure={beatsPerMeasure} hasAnacrusis={hasAnac}
        isPlaying={isTraining || isPlayingComparative} getPlayheadSec={() => playheadSecRef.current}
      />
      <div className="cordel-card p-2.5 w-full flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2">
          {!isTraining ? (
            <button type="button" onClick={handleStartTraining} className="cordel-btn-primary py-1.5 px-4 flex items-center gap-1.5 text-xs font-bold rounded cursor-pointer">
              <Play className="w-4 h-4 fill-current text-[var(--cordel-on-primary)]" /><span>{t('btn_start_training')}</span>
            </button>
          ) : (
            <button type="button" onClick={handleStop} className="bg-[#c25e38] text-white border border-[#c25e38] animate-pulse py-1.5 px-4 flex items-center gap-1.5 text-xs font-bold rounded cursor-pointer">
              <Square className="w-4 h-4 fill-current" /><span>{t('btn_stop_training')}</span>
            </button>
          )}
          <HarmonyProfileSelector config={project.harmonyConfig ?? DEFAULT_HARMONY_CONFIG} onChange={updateHarmonyConfig} disabled={isTraining || isPlayingComparative} />
        </div>
      </div>
      {analysisResult && studentPCM && (
        <StudentDiagnosticCard
          result={analysisResult} isPlayingComparative={isPlayingComparative} activeComparativeMode={comparativeMode}
          onPlayComparative={handlePlayComparative} onStopComparative={handleStop} onExport={handleExport}
        />
      )}
    </div>
  );
};
