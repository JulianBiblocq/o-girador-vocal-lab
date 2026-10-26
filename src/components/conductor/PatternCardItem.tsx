/**
 * PatternCardItem.tsx
 * Carte individuelle de pattern dans la bibliothèque (< 135 lignes).
 * Renommage, case de sélection [✓], métadonnées, suppression, miroir et variations.
 */
import React, { useState } from 'react';
import type { VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import type { TranslationKey } from '../../i18n/i18n.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { Trash2, ArrowLeftRight, X } from 'lucide-react';

interface PatternCardItemProps {
  pat: VocalPatternItem;
  isActive: boolean;
  isSelected?: boolean;
  sourcePatternName?: string | null;
  onSelect: () => void;
  onToggleSelect?: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onMirrorToRole: (targetRole: VocalRole) => void;
  onDuplicateVariation?: () => void;
  onUnlink: () => void;
  canDelete: boolean;
}

const getSolfegeNoteName = (pitch: string | undefined, t: (k: TranslationKey) => string): string => {
  const root = (pitch ?? 'C4').replace(/\d+$/, '').toUpperCase();
  const map: Record<string, TranslationKey> = {
    C: 'solfege_C', 'C#': 'solfege_Cs', D: 'solfege_D', 'D#': 'solfege_Ds', E: 'solfege_E', F: 'solfege_F',
    'F#': 'solfege_Fs', G: 'solfege_G', 'G#': 'solfege_Gs', A: 'solfege_A', 'A#': 'solfege_As', B: 'solfege_B',
  };
  return t(map[root] ?? 'solfege_C');
};

export const PatternCardItem: React.FC<PatternCardItemProps> = ({
  pat, isActive, isSelected, sourcePatternName, onSelect, onToggleSelect,
  onRename, onDelete, onMirrorToRole, onDuplicateVariation, onUnlink, canDelete,
}) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(pat.name);

  const hasAudio = pat.recordingResult !== null && pat.recordingResult.pcm.length > 0;
  const vList = Object.values(pat.variants ?? {});
  const recCount = vList.filter((v) => v.recordingResult !== null).length;
  const noteName = getSolfegeNoteName(pat.referencePitch, t);
  const infoLine = `${t('measureUnitShort', { n: pat.measuresCount })} • ${noteName} • ${pat.bpm ?? pat.baseBpm ?? 88} BPM`;
  const isLinked = !!pat.linkedSourcePatternId;
  const targetRole: VocalRole = pat.role === 'puxador' ? 'coro' : 'puxador';
  const activeBg = pat.role === 'puxador' ? '!bg-[#9a3412]' : '!bg-[#0f766e]';
  const handleSave = () => { if (editName.trim()) onRename(editName.trim()); setIsEditing(false); };

  return (
    <div
      onClick={onSelect}
      className={`px-2 py-1.5 cordel-card-sm flex flex-col justify-between gap-1 cursor-pointer transition-all select-none rounded ${
        isActive ? `${activeBg} !text-white border-2 border-amber-400 shadow-md font-bold`
          : isSelected ? 'bg-amber-950/40 text-[var(--cordel-text)] border-2 border-amber-500/80'
          : 'bg-[var(--cordel-subcard-bg)] text-[var(--cordel-text)] opacity-85 hover:opacity-100 border border-[var(--cordel-border-sub)]'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <input
          type="checkbox" checked={isSelected || false}
          onChange={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          onClick={(e) => e.stopPropagation()}
          className="accent-amber-500 cursor-pointer w-3.5 h-3.5 shrink-0 rounded"
          title={t('selectPatternCheckbox')}
        />
        {isEditing ? (
          <input
            type="text" value={editName} autoFocus onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
            onBlur={handleSave} onClick={(e) => e.stopPropagation()}
            className="w-full min-w-0 bg-[var(--cordel-surface)] border border-theme-accent text-xs font-mono text-[var(--cordel-text)] px-1 py-0.2 focus:outline-none rounded"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(pat.name); }}
            title={t('doubleClickRename')}
            className={`text-xs font-bold font-mono truncate flex-1 flex items-center gap-1 ${isActive ? '!text-white' : 'text-theme-ink hover:text-amber-500'}`}
          >
            {isActive && <span className="text-amber-300 font-black">▶</span>}
            <span className="truncate">{pat.name}</span>
          </span>
        )}
        <span className={`text-[10px] font-mono font-bold shrink-0 ${isActive ? '!text-[#f4ecd8]' : 'text-theme-ink/70'}`}>{infoLine}</span>
        {canDelete && (
          <button type="button" title={t('deletePatternTooltip')} onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`p-0.5 cursor-pointer shrink-0 ${isActive ? '!text-white hover:text-red-200' : 'text-theme-ink/40 hover:text-red-500'}`}>
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Rangée Miroir / Synchronisation & Variation */}
      <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono">
        <div className="flex items-center gap-1 min-w-0">
          {isLinked ? (
            <div className={`flex items-center gap-1 border px-1 py-0.2 truncate rounded ${isActive ? '!bg-white/20 !text-white border-white/40 font-bold' : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'}`}>
              <span className="truncate">{t('syncBadge', { source: sourcePatternName || '...' })}</span>
              <button type="button" title={t('unlinkTooltip')} onClick={(e) => { e.stopPropagation(); onUnlink(); }} className="hover:text-red-300 p-0.2 cursor-pointer shrink-0">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={(e) => { e.stopPropagation(); onMirrorToRole(targetRole); }}
              title={pat.role === 'puxador' ? t('mirrorToCoroTooltip') : t('mirrorToPuxadorTooltip')}
              className={`px-1.5 py-0.2 flex items-center gap-1 border font-bold cursor-pointer rounded ${isActive ? '!bg-white/20 hover:!bg-white/30 !text-white border-white/40' : 'bg-white/5 hover:bg-white/10 text-theme-ink/80 border-[var(--cordel-border-sub)]'}`}
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              <span>{pat.role === 'puxador' ? t('mirrorToCoro') : t('mirrorToPuxador')}</span>
            </button>
          )}
          {onDuplicateVariation && (
            <button
              type="button" onClick={(e) => { e.stopPropagation(); onDuplicateVariation(); }}
              title={t('duplicateVariationTooltip')}
              className={`px-1 py-0.2 font-mono font-bold border cursor-pointer rounded text-[9px] ${isActive ? '!bg-white/20 hover:!bg-white/30 !text-white border-white/40' : 'bg-white/5 hover:bg-white/10 text-theme-ink/80 border-[var(--cordel-border-sub)]'}`}
            >
              {t('duplicateVariation')}
            </button>
          )}
        </div>
        <span className={`text-[9px] font-mono font-bold shrink-0 ${isActive ? '!text-[#f4ecd8]' : 'text-[var(--cordel-secondary-text)]'}`}>{recCount}/{Math.max(vList.length, 4)} decl.</span>
      </div>

      <div className={`flex items-center justify-between text-[10px] font-mono pt-0.5 border-t ${isActive ? 'border-white/30 !text-white font-bold' : 'border-[var(--cordel-border-sub)]'}`}>
        <span className={`font-bold ${isActive ? '!text-white' : hasAudio ? 'text-[#15803d] dark:text-emerald-400' : 'text-[var(--cordel-secondary-text)]/60 italic'}`}>
          {hasAudio ? `✓ ${t('patternAudioRecorded')}` : `○ ${t('patternAudioMissing')}`}
        </span>
      </div>
    </div>
  );
};
