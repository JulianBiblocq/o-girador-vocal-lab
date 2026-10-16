/**
 * PatternLibraryBar.tsx
 * Bibliothèque de Patterns en 2 Blocs Verticaux (Puxador / Coro) scrollables (< 115 lignes).
 * Bouton d'inversion globale [⇄ Puxador ↔ Coro] et duplication de variations [❐ (2)].
 */
import React from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PatternCardItem } from './PatternCardItem';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { ArrowLeftRight } from 'lucide-react';

export const PatternLibraryBar: React.FC = () => {
  const {
    project, activePattern, setActivePatternId, addPattern, updatePattern,
    removePattern, mirrorPatternToRole, unlinkPattern, swapAllRoles, duplicateVariation,
  } = useToadaProject();
  const { t } = useLanguage();

  const puxPatterns = project.patterns.filter((p) => p.role === 'puxador');
  const coroPatterns = project.patterns.filter((p) => p.role === 'coro');

  const handleDeletePattern = async (id: string, name: string) => {
    const ok = await confirmAsync({
      title: t('deletePatternTitle'),
      message: `${t('deletePatternConfirm')} "${name}" ?`,
      confirmLabel: t('dialogConfirm'),
      cancelLabel: t('dialogCancel'),
      variant: 'danger',
    });
    if (ok) removePattern(id);
  };

  const renderCard = (pat: typeof project.patterns[0]) => {
    const sourceName = pat.linkedSourcePatternId
      ? project.patterns.find((p) => p.id === pat.linkedSourcePatternId)?.name ?? null
      : null;

    return (
      <PatternCardItem
        key={pat.id}
        pat={pat}
        isActive={pat.id === activePattern.id}
        sourcePatternName={sourceName}
        onSelect={() => setActivePatternId(pat.id)}
        onRename={(name) => updatePattern(pat.id, { name })}
        onDelete={() => handleDeletePattern(pat.id, pat.name)}
        onMirrorToRole={(targetRole) => mirrorPatternToRole(pat.id, targetRole)}
        onDuplicateVariation={() => duplicateVariation(pat.id)}
        onUnlink={() => unlinkPattern(pat.id)}
        canDelete={project.patterns.length > 1}
      />
    );
  };

  return (
    <div className="cordel-card p-2 w-full h-full flex flex-col justify-between select-none">
      {/* Barre d'outils bibliothèque avec inversion globale 1-clic */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--cordel-border)]">
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[var(--cordel-text)]/80">
          {t('patternLibraryTitle')}
        </span>
        <button
          type="button"
          onClick={swapAllRoles}
          title={t('swapRolesTooltip')}
          className="cordel-btn-secondary px-2 py-0.5 text-[9.5px] font-bold font-mono flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeftRight className="w-3 h-3 text-amber-500" />
          <span>{t('swapPuxadorCoroBtn')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 h-full">
        {/* Colonne Gauche : Puxador */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-puxador text-[#f4ecd8]">
              {t('rolePuxador')}
            </span>
            <button
              type="button" onClick={() => addPattern('puxador')} title={`+ ${t('rolePuxador')}`}
              className="px-2 py-0.5 text-xs font-bold font-mono bg-[#9a3412] hover:bg-[#7c2d12] text-[#f4ecd8] rounded-none flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
            {puxPatterns.map(renderCard)}
          </div>
        </div>

        {/* Colonne Droite : Coro */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-coro text-[#f4ecd8]">
              {t('roleCoro')}
            </span>
            <button
              type="button" onClick={() => addPattern('coro')} title={`+ ${t('roleCoro')}`}
              className="px-2 py-0.5 text-xs font-bold font-mono bg-[#0f766e] hover:bg-[#115e59] text-[#f4ecd8] rounded-none flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
            {coroPatterns.map(renderCard)}
          </div>
        </div>
      </div>
    </div>
  );
};
