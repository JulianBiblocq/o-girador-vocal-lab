/**
 * LivretStructure.tsx
 * Livret 1 : Structure & Chant épuré (Mode Organizador par défaut vs Mode Création / Édition Manuelle,
 * Bandeau Tempo/Batuque/Gamme unifiée FR/BR, Bibliothèque avec badges [XM] [+Ana] [+1T], Conducteur et Paroles) (< 130 lignes).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { DEFAULT_TOADA_BPM } from '../../types/toadaProject.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PatternLibraryBar } from '../conductor/PatternLibraryBar';
import { ToadaConductorStrip } from '../conductor/ToadaConductorStrip';
import { StructureTopControls } from './StructureTopControls';
import { BlockMusicalSettingsCard } from './BlockMusicalSettingsCard';
import { ScaleProposalBanner } from '../common/ScaleProposalBanner';
import { AmbitusReminderBanner } from '../common/AmbitusReminderBanner';
import {
  analyzeFullProjectScale,
  type ProjectScaleAnalysisResult,
} from '../../audio/projectScaleAnalyzer';
import {
  resolveProjectDualScale,
  applyDualScaleToProject,
} from '../../utils/scaleTranspositionHelper';
import type { ScaleType } from '../../audio/scaleQuantizer';

export function resolveDefaultManualStructureEdit(project: ToadaProject): boolean {
  if (project.source === 'local') return true;
  if (project.source === 'organizador' || project.toadaMeta?.id || project.toadaMeta?.repertoireId || project.sheetLines?.length) {
    return false;
  }
  return false;
}

export const LivretStructure: React.FC = () => {
  const { language } = useLanguage();
  const {
    project, activePattern, loadProject, updatePattern,
    updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedTimeSignature,
  } = useToadaProject();
  const { engine, selectedOutputDeviceId } = useAudioHardware();

  const [isManualStructureEdit, setIsManualStructureEdit] = useState<boolean>(() =>
    resolveDefaultManualStructureEdit(project)
  );
  const [scaleProposal, setScaleProposal] = useState<ProjectScaleAnalysisResult | null>(null);

  useEffect(() => {
    setIsManualStructureEdit(resolveDefaultManualStructureEdit(project));
  }, [project.id, project.source]);

  useEffect(() => {
    if (project.toadaMeta?.tonaliteDefaut || scaleProposal) return;
    const hasAnyAudio = project.patterns.some((p) => Boolean(p.rawPitchCurve?.length || p.pitchCurve?.length || p.rawAudioSamples?.length || p.recordingResult?.pcm?.length));
    if (!hasAnyAudio) return;
    const res = analyzeFullProjectScale(project.patterns, language);
    if (res.analyzedPatternsCount > 0) setScaleProposal(res);
  }, [project.patterns, project.toadaMeta?.tonaliteDefaut, scaleProposal, language]);

  const timeSignature = project.timeSignature || '4/4';
  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? DEFAULT_TOADA_BPM;
  const dualScale = useMemo(
    () => resolveProjectDualScale(project, language, scaleProposal || undefined),
    [project, language, scaleProposal]
  );
  const referencePitch = dualScale.troupeReferencePitch;
  const activeScaleLabel =
    project.toadaMeta?.tonaliteDefaut || scaleProposal
      ? (dualScale.transpositionSemitones !== 0 ? `${dualScale.troupeScaleLabel} (${dualScale.transpositionSemitones > 0 ? '+' : ''}${dualScale.transpositionSemitones} st)` : dualScale.troupeScaleLabel)
      : (language === 'br' ? 'Auto (Não travada)' : 'Auto (Non verrouillée)');

  const handleAnalyzeProjectScale = useCallback(() => {
    const res = analyzeFullProjectScale(project.patterns, language);
    setScaleProposal(res);
    loadProject({
      ...project,
      patterns: res.updatedPatterns.map((p) => ({ ...p, referencePitch: res.referencePitch })),
    });
  }, [project, loadProject, language]);

  const handleApplyScale = useCallback((tonic: string, scaleType: ScaleType, refPitch?: string) => {
    const updated = applyDualScaleToProject(project, tonic, scaleType, dualScale.transpositionSemitones, refPitch, language);
    loadProject(updated);
    setScaleProposal(null);
  }, [project, loadProject, dualScale.transpositionSemitones, language]);

  const handleDisengageFreeMode = useCallback(() => {
    const tonic = scaleProposal?.tonic || dualScale.sungScaleRoot || 'A';
    const refPitch = scaleProposal?.referencePitch || dualScale.sungReferencePitch;
    const updated = applyDualScaleToProject(project, tonic, 'chromatic', dualScale.transpositionSemitones, refPitch, language);
    loadProject(updated);
    setScaleProposal(null);
  }, [project, loadProject, scaleProposal, dualScale, language]);

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <AmbitusReminderBanner />
      <StructureTopControls
        projectId={project.id}
        bpm={bpm}
        onBpmChange={(v) => updateScopedBpm(v)}
        activeScaleLabel={activeScaleLabel}
        referencePitch={referencePitch}
        onPlayTonicPreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
        onAnalyzeProjectScale={handleAnalyzeProjectScale}
        isManualStructureEdit={isManualStructureEdit}
        onToggleManualStructureEdit={() => setIsManualStructureEdit((prev) => !prev)}
      />

      <ScaleProposalBanner
        proposal={scaleProposal}
        onApplyScale={handleApplyScale}
        onKeepUncertain={handleApplyScale}
        onDisengageFreeMode={handleDisengageFreeMode}
        onDismiss={() => setScaleProposal(null)}
      />

      <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-5 h-full">
          <PatternLibraryBar isManualStructureEdit={isManualStructureEdit} />
        </div>
        <div className="xl:col-span-7 h-full">
          <ToadaConductorStrip outputDeviceId={selectedOutputDeviceId} isManualStructureEdit={isManualStructureEdit} />
        </div>
      </div>

      <BlockMusicalSettingsCard
        activePattern={activePattern}
        timeSignature={timeSignature}
        isManualStructureEdit={isManualStructureEdit}
        onTimeSignatureChange={(sig) => updateScopedTimeSignature(sig)}
        onMeasuresCountChange={(cnt) => updateScopedMeasuresCount(cnt)}
        onHasAnacrusisChange={(has) => updateScopedHasAnacrusis(has)}
        onHasTailBeatChange={(has) => updatePattern(activePattern.id, { hasTailBeat: has, exitBeat: has ? 1 : undefined })}
        onLyricsChange={(lyrics) => updatePattern(activePattern.id, { assignedLyricsText: lyrics })}
      />
    </div>
  );
};
