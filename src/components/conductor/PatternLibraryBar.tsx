/**
 * PatternLibraryBar.tsx
 * Ligne 1 : Bibliotheque de Patterns nommables (Puxador / Coro) style Cordel.
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Plus, Trash2, Edit2, Check, Music } from 'lucide-react';

export const PatternLibraryBar: React.FC = () => {
  const { project, activePattern, setActivePatternId, addPattern, updatePattern, removePattern } = useToadaProject();
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const handleStartEdit = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingId(id); setEditName(currentName);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) updatePattern(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="cordel-card p-2 w-full flex flex-col gap-1.5 bg-black/50 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-theme-ink/80 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
          <Music className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('patternLibraryTitle')}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button" onClick={() => addPattern('puxador')}
            className="px-2 py-0.5 text-[11px] font-bold font-mono bg-role-puxador bg-role-puxador-hover rounded-none flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /><span>{t('addPuxadorPattern')}</span>
          </button>
          <button
            type="button" onClick={() => addPattern('coro')}
            className="px-2 py-0.5 text-[11px] font-bold font-mono bg-role-coro bg-role-coro-hover rounded-none flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /><span>{t('addCoroPattern')}</span>
          </button>
        </div>
      </div>

      {/* Cartes horizontales defilantes */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 cordel-scrollbar">
        {project.patterns.map((pat) => {
          const isActive = pat.id === activePattern.id;
          const isPux = pat.role === 'puxador';
          const hasAudio = pat.recordingResult !== null && pat.recordingResult.pcm.length > 0;
          const vList = Object.values(pat.variants ?? {});
          const recCount = vList.filter((v) => v.recordingResult !== null).length;
          const totCount = Math.max(vList.length, 4);

          return (
            <div
              key={pat.id} onClick={() => setActivePatternId(pat.id)}
              className={`px-2 py-1.5 min-w-[170px] max-w-[210px] shrink-0 cordel-card-sm flex flex-col gap-1 cursor-pointer transition-all ${
                isActive ? 'border-theme-accent ring-1 ring-theme-accent/60 bg-black/60 shadow-md' : 'opacity-75 hover:opacity-100 bg-black/30'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`px-1.5 py-0.2 text-[9.5px] font-black tracking-wider uppercase ${isPux ? 'bg-role-puxador' : 'bg-role-coro'}`}>
                  {isPux ? t('rolePuxador') : t('roleCoro')}
                </span>
                <span className="text-[10px] font-mono text-theme-ink/70 font-bold">
                  {t('measureUnitShort', { n: pat.measuresCount })}
                </span>
                {project.patterns.length > 1 && (
                  <button
                    type="button" title={t('deletePatternTooltip')}
                    onClick={(e) => { e.stopPropagation(); removePattern(pat.id); }}
                    className="p-0.5 text-theme-ink/40 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Nom & Edition */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                {editingId === pat.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text" value={editName} autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(pat.id); if (e.key === 'Escape') setEditingId(null); }}
                      onBlur={() => handleSaveEdit(pat.id)}
                      className="w-full bg-black border border-theme-accent text-xs font-mono text-white px-1 py-0.5 focus:outline-none"
                    />
                    <button type="button" onClick={() => handleSaveEdit(pat.id)} className="text-emerald-400 p-0.5">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold font-mono text-theme-ink truncate" title={pat.name}>
                      {pat.name}
                    </span>
                    <button
                      type="button" title={t('editPatternNameTooltip')}
                      onClick={(e) => handleStartEdit(pat.id, pat.name, e)}
                      className="p-0.5 text-theme-ink/40 hover:text-theme-ink cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Etat audio & declinaisons */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-theme-border/20">
                <span className={hasAudio ? 'text-emerald-400 font-bold' : 'text-theme-ink/40 italic'}>
                  {hasAudio ? `✓ ${t('patternAudioRecorded')}` : `○ ${t('patternAudioMissing')}`}
                </span>
                <span className="text-[9px] text-stone-400 font-mono">
                  {recCount}/{totCount} decl.
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
