/**
 * LivretStructure.tsx
 * Livret 1 : Structure & Chant autour de « A Fita — Conducteur », Bibliothèque, Paroles et tiroir d'options (< 120 lignes).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lock, Edit3, Mic } from 'lucide-react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useEnsureManualStructureEdit } from '../../hooks/useEnsureManualStructureEdit';
import { useLanguage } from '../../i18n/LanguageContext';
import { AFitaFrame } from '../fita/AFitaFrame';
import { PatternLibraryBar } from '../conductor/PatternLibraryBar';
import { PatternInjectionBar } from '../conductor/PatternInjectionBar';
import { ToadaConductorStrip } from '../conductor/ToadaConductorStrip';
import { BlockMusicalSettingsCard } from './BlockMusicalSettingsCard';
import { ScaleProposalBanner } from '../common/ScaleProposalBanner';
import { TwinPatternsManagerBar } from '../common/TwinPatternsManagerBar';
import { SequenciadorExportBar } from '../common/SequenciadorExportBar';
import { CordelAccordion } from '../common/CordelAccordion';
import { analyzeFullProjectScale, type ProjectScaleAnalysisResult } from '../../audio/projectScaleAnalyzer';
import { resolveProjectDualScale, applyDualScaleToProject } from '../../utils/scaleTranspositionHelper';
import type { ScaleType } from '../../audio/scaleQuantizer';

export function resolveDefaultManualStructureEdit(project: ToadaProject): boolean {
  if (project.source === 'local') return true;
  if (project.source === 'organizador' || project.toadaMeta?.id || project.toadaMeta?.repertoireId || project.sheetLines?.length) return false;
  return false;
}

export const LivretStructure: React.FC = () => {
  const { language, t } = useLanguage(), isBr = language === 'br';
  const {
    project, activePattern, loadProject, updatePattern,
    updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedTimeSignature,
    injectPatternIntoTarget, mirrorPatternToRole,
  } = useToadaProject();
  const { selectedOutputDeviceId } = useAudioHardware();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);

  const [isManualStructureEdit, setIsManualStructureEdit] = useState<boolean>(() => resolveDefaultManualStructureEdit(project));
  const [scaleProposal, setScaleProposal] = useState<ProjectScaleAnalysisResult | null>(null);

  useEffect(() => { setIsManualStructureEdit(resolveDefaultManualStructureEdit(project)); }, [project.id, project.source]);
  const ensureManualEdit = useEnsureManualStructureEdit(isManualStructureEdit, setIsManualStructureEdit);

  useEffect(() => {
    if (project.toadaMeta?.tonaliteDefaut || scaleProposal) return;
    const hasAnyAudio = project.patterns.some((p) => Boolean(p.rawPitchCurve?.length || p.pitchCurve?.length || p.rawAudioSamples?.length || p.recordingResult?.pcm?.length));
    if (!hasAnyAudio) return;
    const res = analyzeFullProjectScale(project.patterns, language);
    if (res.analyzedPatternsCount > 0) setScaleProposal(res);
  }, [project.patterns, project.toadaMeta?.tonaliteDefaut, scaleProposal, language]);

  const dualScale = useMemo(() => resolveProjectDualScale(project, language, scaleProposal || undefined), [project, language, scaleProposal]);
  const coroPatterns = useMemo(() => project.patterns.filter((p) => p.role === 'coro'), [project.patterns]);

  const handleApplyScale = useCallback((tonic: string, scaleType: ScaleType, refPitch?: string) => {
    loadProject(applyDualScaleToProject(project, tonic, scaleType, dualScale.transpositionSemitones, refPitch, language));
    setScaleProposal(null);
  }, [project, loadProject, dualScale.transpositionSemitones, language]);

  const handleDisengageFreeMode = useCallback(() => {
    const tonic = scaleProposal?.tonic || dualScale.sungScaleRoot || 'A';
    const refPitch = scaleProposal?.referencePitch || dualScale.sungReferencePitch;
    loadProject(applyDualScaleToProject(project, tonic, 'chromatic', dualScale.transpositionSemitones, refPitch, language));
    setScaleProposal(null);
  }, [project, loadProject, scaleProposal, dualScale, language]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto my-2">
      <ScaleProposalBanner proposal={scaleProposal} onApplyScale={handleApplyScale} onKeepUncertain={handleApplyScale} onDisengageFreeMode={handleDisengageFreeMode} onDismiss={() => setScaleProposal(null)} />
      <TwinPatternsManagerBar />

      <AFitaFrame
        title={t('fitaTitleConductor')}
        headerRight={
          <>
            <button type="button" onClick={() => setIsManualStructureEdit((p) => !p)} className={`px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer border ${isManualStructureEdit ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-card-sm text-theme-ink'}`}>
              {isManualStructureEdit ? <Edit3 className="w-3 h-3" /> : <Lock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />}
              <span>{isManualStructureEdit ? (isBr ? 'Editar estrutura' : 'Modifier la structure') : (isBr ? 'Estrutura Organizador' : 'Structure Organizador')}</span>
            </button>
            <button type="button" onClick={() => setActiveLivret('prise')} className="px-2.5 py-1 rounded cordel-btn-primary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Mic className="w-3 h-3" /><span>{t('fanion2Short')}</span>
            </button>
          </>
        }
      >
        <ToadaConductorStrip outputDeviceId={selectedOutputDeviceId} isManualStructureEdit={isManualStructureEdit} onRequestManualEdit={ensureManualEdit} frameless />
      </AFitaFrame>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-6 h-full"><PatternLibraryBar isManualStructureEdit={isManualStructureEdit} /></div>
        <div className="lg:col-span-6 h-full">
          <BlockMusicalSettingsCard
            activePattern={activePattern} timeSignature={project.timeSignature || '4/4'} isManualStructureEdit={isManualStructureEdit}
            onTimeSignatureChange={updateScopedTimeSignature} onMeasuresCountChange={updateScopedMeasuresCount}
            onHasAnacrusisChange={updateScopedHasAnacrusis}
            onHasTailBeatChange={(has) => updatePattern(activePattern.id, { hasTailBeat: has, exitBeat: has ? 1 : undefined })}
            onLyricsChange={(lyrics) => updatePattern(activePattern.id, { assignedLyricsText: lyrics })}
          />
        </div>
      </div>

      <CordelAccordion title={t('drawerStructureToolsTitle')} defaultOpen={false}>
        <div className="flex flex-col gap-3 pt-2">
          {project.patterns.length > 1 && <PatternInjectionBar sourcePattern={activePattern} coroPatterns={coroPatterns} onInject={injectPatternIntoTarget} onCreateMirror={(srcId) => mirrorPatternToRole(srcId, 'coro')} defaultAudioChecked={true} />}
          <SequenciadorExportBar />
        </div>
      </CordelAccordion>
    </div>
  );
};
