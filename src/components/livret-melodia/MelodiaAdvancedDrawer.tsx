/**
 * MelodiaAdvancedDrawer.tsx
 * Tiroir repliable d'options avancées du Livret 4 : Syllabes Letra, Capture Tap/MIDI, Harmonie & Copie Coro (< 60 lignes).
 */
import React, { useMemo } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { HarmonyConfig } from '../../types/harmony.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { CordelAccordion } from '../common/CordelAccordion';
import { LetraEditorPanel } from './LetraEditorPanel';
import { RhythmTapBar } from './RhythmTapBar';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { SequenciadorExportBar } from '../common/SequenciadorExportBar';
import { PatternInjectionBar } from '../conductor/PatternInjectionBar';

interface Props {
  allSteps: VocalStepData[]; rawPitchCurve: PitchCurvePoint[]; rawPCM: Float32Array; sampleRate: number;
  bpm: number; beatsPerMeasure: number; resPerBeat: number; hasAnac: boolean; totalDurationSec: number;
  allowedPitchClasses: Set<number> | null; isPlaying: boolean; getPlayheadSec: () => number;
  harmonyConfig: HarmonyConfig; onUpdateHarmonyConfig: (cfg: HarmonyConfig) => void;
  onStartVoicePlayback: () => void; onStopVoicePlayback: () => void;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void; onCommitHistory: () => void;
}

export const MelodiaAdvancedDrawer: React.FC<Props> = (p) => {
  const { project, activePattern, injectPatternIntoTarget, mirrorPatternToRole } = useToadaProject();
  const { t } = useLanguage();
  const coroPatterns = useMemo(() => project.patterns.filter((x) => x.role === 'coro'), [project.patterns]);

  return (
    <CordelAccordion title={t('drawerMelodiaAdvancedTitle')} defaultOpen={false}>
      <div className="flex flex-col gap-3 pt-2">
        <LetraEditorPanel allSteps={p.allSteps} onUpdateSteps={p.onUpdateSteps} onCommitHistory={p.onCommitHistory} />
        <RhythmTapBar
          allSteps={p.allSteps} pitchCurve={p.rawPitchCurve} pcm={p.rawPCM} sampleRate={p.sampleRate}
          bpm={p.bpm} beatsPerMeasure={p.beatsPerMeasure} stepsPerBeat={p.resPerBeat}
          gridStartSec={p.hasAnac ? 0 : 0.15} totalDurationSec={p.totalDurationSec}
          allowedPitchClasses={p.allowedPitchClasses ?? new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}
          lyricsText={activePattern.assignedLyricsText} isPlaying={p.isPlaying} getPlayheadSec={p.getPlayheadSec}
          onStartVoicePlayback={p.onStartVoicePlayback} onStopVoicePlayback={p.onStopVoicePlayback}
          onUpdateSteps={p.onUpdateSteps} onCommitHistory={p.onCommitHistory}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <HarmonyProfileSelector config={p.harmonyConfig} onChange={p.onUpdateHarmonyConfig} />
          <SequenciadorExportBar />
        </div>
        {project.patterns.length > 1 && (
          <PatternInjectionBar sourcePattern={activePattern} coroPatterns={coroPatterns} onInject={injectPatternIntoTarget} onCreateMirror={(srcId) => mirrorPatternToRole(srcId, 'coro')} defaultAudioChecked={true} />
        )}
      </div>
    </CordelAccordion>
  );
};
