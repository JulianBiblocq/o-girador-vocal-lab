/**
 * PatternLibraryBar.tsx
 * Bibliotheque de Patterns en 2 Blocs Verticaux (Puxador / Coro) scrollables.
 * Renommage instantane au double-clic (Enter/Blur valide, Escape annule).
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { Plus, Trash2 } from 'lucide-react';

export const PatternLibraryBar: React.FC = () => {
  const { project, activePattern, setActivePatternId, addPattern, updatePattern, removePattern } = useToadaProject();
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const handleStartEdit = (id: string, name: string) => { setEditingId(id); setEditName(name); };
  const handleSaveEdit = (id: string) => {
    if (editName.trim()) updatePattern(id, { name: editName.trim() });
    setEditingId(null);
  };

  const puxPatterns = project.patterns.filter((p) => p.role === 'puxador');
  const coroPatterns = project.patterns.filter((p) => p.role === 'coro');

  const renderPatternItem = (pat: VocalPatternItem) => {
    const isActive = pat.id === activePattern.id;
    const hasAudio = pat.recordingResult !== null && pat.recordingResult.pcm.length > 0;
    const vList = Object.values(pat.variants ?? {});
    const recCount = vList.filter((v) => v.recordingResult !== null).length;
    const totCount = Math.max(vList.length, 4);

    return (
      <div
        key={pat.id} onClick={() => setActivePatternId(pat.id)}
        className={`px-2 py-1.5 cordel-card-sm flex flex-col justify-between gap-1 cursor-pointer transition-all select-none ${
          isActive ? 'border-theme-accent ring-1 ring-theme-accent/60 bg-black/60 shadow-md' : 'opacity-75 hover:opacity-100 bg-black/30'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          {editingId === pat.id ? (
            <input
              type="text" value={editName} autoFocus
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(pat.id); if (e.key === 'Escape') setEditingId(null); }}
              onBlur={() => handleSaveEdit(pat.id)} onClick={(e) => e.stopPropagation()}
              className="w-full min-w-0 bg-black border border-theme-accent text-xs font-mono text-white px-1 py-0.2 focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(pat.id, pat.name); }}
              title={t('doubleClickRename')}
              className="text-xs font-bold font-mono text-theme-ink truncate flex-1 hover:text-amber-300"
            >
              {pat.name}
            </span>
          )}
          <span className="text-[10px] font-mono text-theme-ink/70 font-bold shrink-0">
            {t('measureUnitShort', { n: pat.measuresCount })}
          </span>
          {project.patterns.length > 1 && (
            <button
              type="button" title={t('deletePatternTooltip')}
              onClick={(e) => { e.stopPropagation(); removePattern(pat.id); }}
              className="p-0.5 text-theme-ink/40 hover:text-red-400 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 border-t border-theme-border/20">
          <span className={hasAudio ? 'text-emerald-400 font-bold' : 'text-theme-ink/40 italic'}>
            {hasAudio ? `✓ ${t('patternAudioRecorded')}` : `○ ${t('patternAudioMissing')}`}
          </span>
          <span className="text-[9px] text-stone-400 font-mono">{recCount}/{totCount} decl.</span>
        </div>
      </div>
    );
  };

  return (
    <div className="cordel-card p-2 w-full h-full flex flex-col justify-between bg-black/50 select-none">
      <div className="grid grid-cols-2 gap-3 h-full">
        {/* Colonne Gauche : Puxador */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-puxador text-white">
              {t('rolePuxador')}
            </span>
            <button
              type="button" onClick={() => addPattern('puxador')}
              className="px-2 py-0.5 text-[10px] font-bold font-mono bg-role-puxador bg-role-puxador-hover text-white rounded-none flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /><span>+ {t('rolePuxador')}</span>
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
            {puxPatterns.map(renderPatternItem)}
          </div>
        </div>

        {/* Colonne Droite : Coro */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border)]">
            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-role-coro text-white">
              {t('roleCoro')}
            </span>
            <button
              type="button" onClick={() => addPattern('coro')}
              className="px-2 py-0.5 text-[10px] font-bold font-mono bg-role-coro bg-role-coro-hover text-white rounded-none flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /><span>+ {t('roleCoro')}</span>
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
            {coroPatterns.map(renderPatternItem)}
          </div>
        </div>
      </div>
    </div>
  );
};
