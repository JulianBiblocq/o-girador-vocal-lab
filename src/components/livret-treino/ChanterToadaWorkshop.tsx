/**
 * ChanterToadaWorkshop.tsx
 * Atelier d'entraînement au chant de la Toada (Karaoké, Appel-Réponse & Évaluation Zéro Rouge).
 * Strictement < 150 lignes.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TrainerConfigBar, type TrainerScope, type StudentRole, type TrainerGuideMode } from './TrainerConfigBar';
import { KaraokeLyricsBanner, type KaraokeSyllableItem } from './KaraokeLyricsBanner';
import { PianoRollEditor } from '../livret-melodia/PianoRollEditor';
import { StudentTrainerEngine } from '../../audio/StudentTrainerEngine';
import { analyzeStudentTake, type StudentAnalysisResult } from '../../audio/studentPitchAnalyzer';
import { exportStudentEvaluationJson } from '../../utils/studentEvaluationExporter';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { Play, Square, Download, Volume2 } from 'lucide-react';

export const ChanterToadaWorkshop: React.FC = () => {
  const { project, activePattern } = useToadaProject();
  const { t } = useLanguage();
  const engine = useMemo(() => new StudentTrainerEngine(), []);
  const playheadSecRef = useRef<number>(0);

  const [scope, setScope] = useState<TrainerScope>('pattern');
  const [studentRole, setStudentRole] = useState<StudentRole>('coro');
  const [guideMode, setGuideMode] = useState<TrainerGuideMode>('autonomous');
  const [speedRatio, setSpeedRatio] = useState<number>(1.0);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [isPlayingComparative, setIsPlayingComparative] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [studentPCM, setStudentPCM] = useState<Float32Array | null>(null);
  const [analysisResult, setAnalysisResult] = useState<StudentAnalysisResult | null>(null);

  const bpm = Math.max(30, Math.round(project.bpm * speedRatio));
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDur = 60 / bpm, measuresCount = activePattern.measuresCount;
  const hasAnac = activePattern.hasAnacrusis !== false;
  const anacrusisDurationSec = hasAnac ? beatsPerMeasure * beatDur : 0;
  const totalDurationSec = (hasAnac ? 1 + measuresCount : measuresCount) * beatsPerMeasure * beatDur;

  const allSteps = useMemo(() => activePattern.pack?.grid.steps ?? activePattern.mainSteps ?? [], [activePattern]);
  const syllables: KaraokeSyllableItem[] = useMemo(() => (
    allSteps.map((s, idx) => ({ text: s.syllable || '', stepIndex: idx })).filter((s) => s.text.length > 0)
  ), [allSteps]);

  useEffect(() => {
    const kill = () => { engine.stop(); setIsTraining(false); setIsPlayingComparative(false); };
    const unregister = registerTreinoKillSwitch(kill);
    return () => { unregister(); kill(); };
  }, [engine]);

  const handleStartTraining = useCallback(async () => {
    setIsTraining(true); setAnalysisResult(null); setStudentPCM(null);
    await engine.startTraining(
      { pattern: activePattern, bpm, beatsPerMeasure, measuresCount, studentRole, guideMode },
      (elapsedSec, step) => { playheadSecRef.current = elapsedSec; setActiveStepIndex(step); },
      (pcm, sampleRate) => {
        setIsTraining(false); setStudentPCM(pcm);
        const analysis = analyzeStudentTake({ rawPCM: pcm, sampleRate, totalDurationSec, targetSteps: allSteps, bpm, shouldAnalyzeNotes: true });
        setAnalysisResult(analysis);
      }
    );
  }, [engine, activePattern, bpm, beatsPerMeasure, measuresCount, studentRole, guideMode, totalDurationSec, allSteps]);

  const handleStop = useCallback(() => {
    engine.stop(); setIsTraining(false); setIsPlayingComparative(false);
  }, [engine]);

  const handlePlayComparative = useCallback(async () => {
    if (!studentPCM) return;
    setIsPlayingComparative(true);
    await engine.playComparative(studentPCM, 44100, () => setIsPlayingComparative(false));
  }, [engine, studentPCM]);

  const handleExport = useCallback(() => {
    if (!analysisResult) return;
    exportStudentEvaluationJson({
      patternId: activePattern.id, patternName: activePattern.name, patternRole: activePattern.role,
      accuracyScore: analysisResult.accuracyScore, okNotes: analysisResult.okNotes, totalNotes: analysisResult.totalNotes,
      studentPitchCurve: analysisResult.studentPitchCurve, date: new Date().toISOString(),
    });
  }, [analysisResult, activePattern]);

  return (
    <div className="flex flex-col gap-3 w-full max-w-none">
      <TrainerConfigBar
        scope={scope} onScopeChange={setScope} studentRole={studentRole} onStudentRoleChange={setStudentRole}
        guideMode={guideMode} onGuideModeChange={setGuideMode} speedRatio={speedRatio} onSpeedRatioChange={setSpeedRatio}
        disabled={isTraining || isPlayingComparative}
      />
      <KaraokeLyricsBanner currentRole={activePattern.role} studentRole={studentRole} patternName={activePattern.name} syllables={syllables} activeStepIndex={activeStepIndex} />
      <div className="w-full">
        <PianoRollEditor
          readOnly={true}
          allSteps={allSteps} pitchCurve={analysisResult?.studentPitchCurve ?? []}
          totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
          beatsPerMeasure={beatsPerMeasure} beatResolutions={[4, 4, 4, 4]} seekStartSec={0}
          hasAnacrusis={hasAnac} bpm={bpm}
          isPlaying={isTraining || isPlayingComparative} tonic="C" scaleType="chromatic" smoothingLevel={1}
          getPlayheadSec={() => playheadSecRef.current} onUpdateSteps={() => {}} onSeek={(sec) => { playheadSecRef.current = sec; }}
          onSetTonic={() => {}} onSetScaleType={() => {}} onSetSmoothingLevel={() => {}} onPlayNotePreview={() => {}}
        />
      </div>
      <div className="cordel-card p-2.5 w-full flex flex-wrap items-center justify-between gap-3 bg-black/60 select-none">
        <div className="flex items-center gap-2">
          {!isTraining ? (
            <button type="button" onClick={handleStartTraining} className="cordel-btn-primary py-1 px-3.5 flex items-center gap-1.5 text-xs font-bold rounded-none cursor-pointer">
              <Play className="w-4 h-4 fill-current text-emerald-400" /><span>{t('btn_start_training')}</span>
            </button>
          ) : (
            <button type="button" onClick={handleStop} className="bg-[#d97706] text-[#f4ecd8] animate-pulse py-1 px-3.5 flex items-center gap-1.5 text-xs font-bold rounded-none cursor-pointer">
              <Square className="w-4 h-4 fill-current" /><span>{t('btn_stop_training')}</span>
            </button>
          )}
          {studentPCM && (
            <button type="button" disabled={isTraining} onClick={isPlayingComparative ? handleStop : handlePlayComparative} className="cordel-btn-secondary py-1 px-3 flex items-center gap-1 text-xs font-mono font-bold rounded-none cursor-pointer">
              <Volume2 className="w-3.5 h-3.5" /><span>{isPlayingComparative ? t('btn_stop_training') : t('btn_listen_student_solo')}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {analysisResult && (
            <span className="px-3 py-1 font-mono font-bold text-xs bg-black/80 border border-emerald-500/50 text-emerald-400">
              {t('trainer_accuracy_badge', { score: analysisResult.accuracyScore, ok: analysisResult.okNotes, total: analysisResult.totalNotes })}
            </span>
          )}
          {analysisResult && (
            <button type="button" onClick={handleExport} className="cordel-btn py-1 px-2.5 flex items-center gap-1 text-xs font-mono rounded-none cursor-pointer text-stone-300">
              <Download className="w-3.5 h-3.5" /><span>{t('export_student_report')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
