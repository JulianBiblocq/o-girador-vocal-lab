/**
 * SamambaiaRepertoireTargetModal.tsx
 * Modale Cordel d'intégration d'une Toada Cantador dans un morceau du Répertoire Sequenciador (< 130 lignes).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drum, Loader2, X, Clock, Target, Piano } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { resolveProjectDualScale } from '../../utils/scaleTranspositionHelper';
import { type SamambaiaMorceauSummary, findBestMatchingSamambaiaMorceau } from '../../utils/sequenciadorPresetBuilder';
import { fetchSamambaiaSavedMorceaux, integrateToadaIntoSamambaiaMorceau, type IntegrateMorceauResult } from '../../services/samambaiaMorceauIntegrator';
import { resolveActiveTenantContext, formatRepertoireLabel } from '../../services/activeTenantResolver';
import { detectExportTwinGroups, applyExportTwinMutualization, type ExportTwinChoice } from '../../utils/exportTwinMutualizer';
import { getUnusedPatternsSummary } from '../../utils/unusedPatternsPurger';
import { saveProjectToIndexedDB } from '../../utils/projectAutoSave';
import { saveToadaToLibrary } from '../../utils/toadaLibraryStorage';
import { ExportTwinMutualizerSection } from './ExportTwinMutualizerSection';
import { RepertoireTargetSongPicker } from './RepertoireTargetSongPicker';
import { RepertoireTargetSuccessPanel } from './RepertoireTargetSuccessPanel';
import { CheckMarkIcon } from '../icons/CordelActionIcons';

export interface SamambaiaRepertoireTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SamambaiaRepertoireTargetModal: React.FC<SamambaiaRepertoireTargetModalProps> = ({ isOpen, onClose }) => {
  const { project, loadProject, setSequenciadorExportMode } = useToadaProject();
  const { t, language } = useLanguage(), isBr = language === 'br';
  const [morceaux, setMorceaux] = useState<SamambaiaMorceauSummary[]>([]), [groupName, setGroupName] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false), [search, setSearch] = useState(''), [selectedId, setSelectedId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState(project.title || ''), [newBpm, setNewBpm] = useState<number>(project.bpm || 96);
  const [twinChoices, setTwinChoices] = useState<Record<string, ExportTwinChoice>>({});
  const [purgeLocalUnused, setPurgeLocalUnused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false), [progressMsg, setProgressMsg] = useState(''), [doneResult, setDoneResult] = useState<IntegrateMorceauResult | null>(null);
  const repLabel = formatRepertoireLabel(groupName, isBr);

  const twinGroups = useMemo(() => (isOpen ? detectExportTwinGroups(project) : []), [isOpen, project]);
  const unusedSummary = useMemo(() => getUnusedPatternsSummary(project), [project]);

  useEffect(() => {
    if (!isOpen) return;
    setDoneResult(null); setIsSubmitting(false); setProgressMsg(''); setPurgeLocalUnused(false);
    const defaults: Record<string, ExportTwinChoice> = {};
    detectExportTwinGroups(project).forEach((g) => { defaults[g.groupKey] = g.recommendedChoice; });
    setTwinChoices(defaults);
    setNewTitle(project.title || 'Nouvelle Toada'); setNewBpm(project.bpm || 96); setLoadingList(true);
    resolveActiveTenantContext(project.toadaMeta?.groupId).then((ctx) => setGroupName(ctx.groupName));
    fetchSamambaiaSavedMorceaux(project.toadaMeta?.groupId).then((list) => {
      setMorceaux(list);
      const match = findBestMatchingSamambaiaMorceau(list, project);
      if (match) { setSelectedId(match.id); setIsCreatingNew(false); }
      else if (list.length > 0) { setSelectedId(list[0].id); setIsCreatingNew(false); }
      else setIsCreatingNew(true);
    }).finally(() => setLoadingList(false));
  }, [isOpen, project.id, project.toadaMeta?.groupId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? morceaux.filter((m) => m.name.toLowerCase().includes(q) || (m.ritmo || '').toLowerCase().includes(q) || (m.nacao || '').toLowerCase().includes(q)) : morceaux;
  }, [morceaux, search]);

  if (!isOpen) return null;

  const selectedMorceau = morceaux.find((m) => m.id === selectedId) || null, firstPat = project.patterns[0];
  const recordedBpm = Math.round(Number((firstPat as any)?.recordedBpm || firstPat?.recordingResult?.recordedBpm || firstPat?.baseBpm || project.bpm || 88));
  const sequenciadorBpm = isCreatingNew ? Math.max(30, Math.round(newBpm || 96)) : (selectedMorceau?.bpm || project.bpm || 96);
  const dualScale = resolveProjectDualScale(project, language), exportMode = project.sequenciadorExportMode ?? 'rhythm_only';

  const handleIntegrate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const preparedProject = applyExportTwinMutualization(project, twinChoices, { purgeLocalUnused });
      const res = await integrateToadaIntoSamambaiaMorceau(
        preparedProject,
        isCreatingNew ? { createNewMorceau: { name: newTitle, bpm: sequenciadorBpm } } : { targetMorceau: selectedMorceau },
        (msg) => setProgressMsg(msg)
      );
      loadProject(res.updatedProject);
      await Promise.all([saveProjectToIndexedDB(res.updatedProject), saveToadaToLibrary(res.updatedProject)]);
      setDoneResult(res);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('exportDoneBannerTitle', { name: res.morceauName, bpm: res.sequenciadorBpm }) } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err?.message || 'Erreur' } }));
    } finally { setIsSubmitting(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono text-xs" onClick={onClose}>
      <div className="w-full max-w-xl cordel-card bg-[var(--cordel-surface)] text-[var(--cordel-text)] border-2 border-[var(--cordel-border)] p-4 rounded flex flex-col gap-2.5 max-h-[90vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--cordel-border-sub)] pb-2">
          <div className="flex items-center gap-2 font-bold text-sm"><Drum className="w-4 h-4 text-theme-accent shrink-0" /><span>{t('exportTargetModalTitle', { repLabel })}</span></div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-black/10 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {doneResult ? (
          <RepertoireTargetSuccessPanel result={doneResult} onClose={onClose} />
        ) : (
          <>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/50 flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[#9a3412] dark:text-amber-300"><Clock className="w-3.5 h-3.5 shrink-0" /><span>{t('exportTempoSyncBanner', { recBpm: recordedBpm, seqBpm: sequenciadorBpm })}</span></div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/30">
                <div className="inline-flex items-center gap-1">
                  <button type="button" onClick={() => setSequenciadorExportMode('rhythm_only')} className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${exportMode === 'rhythm_only' ? 'bg-[#9a3412] text-white' : 'cordel-btn'}`}><Drum className="w-3 h-3" /><span>{t('exportModeRhythmNoMidi')}</span></button>
                  <button type="button" onClick={() => setSequenciadorExportMode('full_notes')} className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${exportMode === 'full_notes' ? 'bg-theme-wood text-[#f4ecd8]' : 'cordel-btn'}`}><Piano className="w-3 h-3" /><span>{t('exportModeFullWithMidi')}</span></button>
                </div>
                <span className="inline-flex items-center gap-1 font-bold text-[#9a3412] dark:text-amber-300"><Target className="w-3.5 h-3.5" />{t('exportTroupeKeyLabel')} {dualScale.troupeScaleLabel}</span>
              </div>
            </div>

            <ExportTwinMutualizerSection
              project={project} groups={twinGroups} choices={twinChoices}
              onChangeChoice={(k, c) => setTwinChoices((prev) => ({ ...prev, [k]: c }))}
              unusedSummary={unusedSummary} purgeLocalUnused={purgeLocalUnused} onTogglePurgeLocalUnused={setPurgeLocalUnused}
            />

            <RepertoireTargetSongPicker
              repLabel={repLabel} loadingList={loadingList} filtered={filtered} selectedId={selectedId} onSelectId={setSelectedId}
              search={search} onSearchChange={setSearch} isCreatingNew={isCreatingNew} onToggleCreatingNew={() => setIsCreatingNew((v) => !v)}
              newTitle={newTitle} onNewTitleChange={setNewTitle} newBpm={newBpm} onNewBpmChange={setNewBpm}
            />

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
              <span className="text-[11px] opacity-80 truncate">{progressMsg}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1.5 rounded cordel-btn font-bold cursor-pointer">{t('dialogCancel')}</button>
                <button type="button" disabled={isSubmitting || (!isCreatingNew && !selectedMorceau)} onClick={handleIntegrate} className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckMarkIcon className="w-3.5 h-3.5" />}<span>{t('exportIntegrateConfirmBtn')}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
