/**
 * PatternLibraryBar.tsx
 * Bibliothèque de Patterns en 2 Blocs Verticaux (Puxador / Coro) scrollables (< 138 lignes).
 * Inclut le bouton [ Purger les inutilisés (X • Y.Y Mo) ] et le copieur modulaire PatternInjectionBar.
 */
import React, { useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PatternCardItem } from './PatternCardItem';
import { PatternInjectionBar } from './PatternInjectionBar';
import { confirmAsync, alertAsync } from '../../stores/useCordelDialogStore';
import { getPatternUsageCount, getUnusedPatternsSummary, purgeUnusedPatternsFromProject, deleteOrphanPatternWavsFromStorage } from '../../utils/unusedPatternsPurger';
import { saveProjectToIndexedDB } from '../../utils/projectAutoSave';
import { useActionFeedback } from '../common/useActionFeedback';
import { ArrowLeftRight, Trash2, Check } from 'lucide-react';

export const PatternLibraryBar: React.FC<{ isManualStructureEdit?: boolean }> = ({ isManualStructureEdit = false }) => {
  const {
    project, activePattern, setActivePatternId, loadProject, addPattern, updatePattern,
    removePattern, mirrorPatternToRole, injectPatternIntoTarget, unlinkPattern, swapAllRoles, duplicateVariation,
    selectedPatternIds, toggleSelectPattern, selectAllPatterns,
  } = useToadaProject();
  const { t, language } = useLanguage();
  const isBr = language === 'br';
  const purgeFeedback = useActionFeedback(isBr ? '✓ Limpo!' : '✓ Purgé !');

  const puxPatterns = project.patterns.filter((p) => p.role === 'puxador');
  const coroPatterns = project.patterns.filter((p) => p.role === 'coro');
  const allSelected = project.patterns.length > 0 && selectedPatternIds.length === project.patterns.length;
  const unusedSummary = useMemo(() => getUnusedPatternsSummary(project), [project]);

  const handlePurgeUnused = async () => {
    if (unusedSummary.count === 0) return;
    const listNames = unusedSummary.unusedPatterns.map((p) => `• ${p.name}`).join('\n');
    const ok = await confirmAsync({
      title: isBr ? 'Purgar padrões não utilizados na linha do tempo' : 'Purger les patterns inutilisés dans la Timeline',
      message: isBr
        ? `Estes ${unusedSummary.count} padrões (${unusedSummary.formattedMegabytes} Mo) não são usados na linha do tempo e seus arquivos .wav órfãos serão removidos:\n\n${listNames}`
        : `Ces ${unusedSummary.count} patterns (${unusedSummary.formattedMegabytes} Mo) ne sont plus utilisés dans la Frise Conducteur et leurs fichiers .wav orphelins seront nettoyés :\n\n${listNames}`,
      confirmLabel: isBr ? `Purgar (${unusedSummary.formattedMegabytes} Mo)` : `Purger (${unusedSummary.formattedMegabytes} Mo)`,
      cancelLabel: t('dialogCancel'),
      variant: 'warning',
    });
    if (!ok) return;

    await purgeFeedback.trigger(async () => {
      const res = purgeUnusedPatternsFromProject(project);
      loadProject(res.updatedProject);
      await saveProjectToIndexedDB(res.updatedProject);
      deleteOrphanPatternWavsFromStorage(project.id, res.purgedIds);
      const label = isBr ? `✓ ${res.formattedMegabytes} Mo liberados !` : `✓ ${res.formattedMegabytes} Mo libérés !`;
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: label } }));
      await alertAsync({
        title: label,
        message: isBr
          ? `${res.purgedIds.length} padrões não utilizados removidos da memória/IndexedDB e arquivos .wav órfãos limpos do Firebase Storage.`
          : `${res.purgedIds.length} patterns inutilisés supprimés de la mémoire/IndexedDB et fichiers .wav orphelins nettoyés de Firebase Storage.`,
        variant: 'info',
      });
      return label;
    });
  };

  const handleDeletePattern = async (id: string, name: string) => {
    const ok = await confirmAsync({ title: t('deletePatternTitle'), message: `${t('deletePatternConfirm')} "${name}" ?`, confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'danger' });
    if (ok) removePattern(id);
  };

  const handleCardMirror = (pat: typeof project.patterns[0], targetRole: typeof project.patterns[0]['role']) => {
    if (pat.role === 'puxador' && targetRole === 'coro' && coroPatterns.length > 0) {
      const firstWord = (pat.name || '').trim().split(/\s+/)[0]?.toLowerCase();
      const existingCoro = coroPatterns.find((c) => (c.name || '').trim().split(/\s+/)[0]?.toLowerCase() === firstWord) ?? coroPatterns[0];
      injectPatternIntoTarget(pat.id, existingCoro.id);
      return;
    }
    mirrorPatternToRole(pat.id, targetRole);
  };

  const renderCard = (pat: typeof project.patterns[0]) => (
    <PatternCardItem
      key={pat.id} pat={pat} isActive={pat.id === activePattern.id} isSelected={selectedPatternIds.includes(pat.id)}
      usageCount={getPatternUsageCount(project, pat.id)}
      sourcePatternName={pat.linkedSourcePatternId ? project.patterns.find((p) => p.id === pat.linkedSourcePatternId)?.name ?? null : null}
      onSelect={() => setActivePatternId(pat.id)} onToggleSelect={() => toggleSelectPattern(pat.id)}
      onRename={(name) => updatePattern(pat.id, { name })} onDelete={() => handleDeletePattern(pat.id, pat.name)}
      onMirrorToRole={(targetRole) => handleCardMirror(pat, targetRole)} onDuplicateVariation={() => duplicateVariation(pat.id)}
      onUnlink={() => unlinkPattern(pat.id)} canDelete={project.patterns.length > 1} isManualStructureEdit={isManualStructureEdit}
    />
  );

  return (
    <div className="cordel-card p-2 w-full h-full flex flex-col justify-between select-none">
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-[var(--cordel-border-sub)]">
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[var(--cordel-secondary-text)]">{t('patternLibraryTitle')}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {(unusedSummary.count > 0 || purgeFeedback.isSuccess) && (
            <button type="button" onClick={handlePurgeUnused} className={purgeFeedback.getButtonClass('px-2 py-0.5 text-[9.5px] font-bold font-mono border cursor-pointer rounded flex items-center gap-1 bg-amber-600/20 text-amber-900 dark:text-amber-300 border-amber-500/60 hover:bg-amber-600 hover:text-white')}>
              {purgeFeedback.isSuccess ? <Check className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
              <span>{purgeFeedback.isSuccess ? purgeFeedback.successLabel : isBr ? `Purgar não usados (${unusedSummary.count} • ${unusedSummary.formattedMegabytes} Mo)` : `Purger les inutilisés (${unusedSummary.count} • ${unusedSummary.formattedMegabytes} Mo)`}</span>
            </button>
          )}
          {isManualStructureEdit && (
            <>
              <button type="button" onClick={() => selectAllPatterns(!allSelected)} className={`px-1.5 py-0.5 text-[9px] font-bold font-mono border cursor-pointer rounded ${selectedPatternIds.length > 0 ? 'bg-[#b45309] text-[#f4ecd8] border-[#92400e]' : 'cordel-card-sm text-[var(--cordel-text)]/70'}`}>
                {allSelected ? t('deselectAll') : selectedPatternIds.length > 0 ? `${t('selectAll')} (${selectedPatternIds.length})` : t('selectAll')}
              </button>
              <button type="button" onClick={swapAllRoles} className="cordel-card-sm px-2 py-0.5 text-[9.5px] font-bold font-mono flex items-center gap-1 cursor-pointer rounded">
                <ArrowLeftRight className="w-3 h-3 text-amber-500" /><span>{t('swapPuxadorCoroBtn')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {project.patterns.length > 1 && (
        <div className="mb-1.5">
          <PatternInjectionBar sourcePattern={activePattern} coroPatterns={coroPatterns} onInject={injectPatternIntoTarget} onCreateMirror={(srcId) => mirrorPatternToRole(srcId, 'coro')} defaultAudioChecked={true} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 h-full">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border-sub)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-puxador text-white rounded">{t('rolePuxador')}</span>
            {isManualStructureEdit && <button type="button" onClick={() => addPattern('puxador')} className="px-2 py-0.5 text-xs font-bold font-mono bg-[#9a3412] hover:bg-[#7c2d12] text-white rounded flex items-center justify-center cursor-pointer">+</button>}
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">{puxPatterns.map(renderCard)}</div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border-sub)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-coro text-white rounded">{t('roleCoro')}</span>
            {isManualStructureEdit && <button type="button" onClick={() => addPattern('coro')} className="px-2 py-0.5 text-xs font-bold font-mono bg-[#0f766e] hover:bg-[#115e59] text-white rounded flex items-center justify-center cursor-pointer">+</button>}
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">{coroPatterns.map(renderCard)}</div>
        </div>
      </div>
    </div>
  );
};
