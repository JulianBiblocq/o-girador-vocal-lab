/**
 * PatternCardItem.tsx
 * Carte individuelle de pattern dans la bibliothèque avec badges [XM], [+Ana], [+1T] et durée de prise (< 135 lignes).
 */
import React, { useState } from 'react';
import type { VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { Trash2, ArrowLeftRight, X } from 'lucide-react';

interface PatternCardItemProps {
  pat: VocalPatternItem; isActive: boolean; isSelected?: boolean; sourcePatternName?: string | null;
  onSelect: () => void; onToggleSelect?: () => void; onRename: (newName: string) => void;
  onDelete: () => void; onMirrorToRole: (targetRole: VocalRole) => void;
  onDuplicateVariation?: () => void; onUnlink: () => void; canDelete: boolean; isManualStructureEdit?: boolean;
}

export function resolveAnacrusisBadgeText(pat: VocalPatternItem): string | null {
  if (pat.hasAnacrusis === false) return null;
  const anaAnchors = (pat.timeAnchors || []).filter(
    (a) => a.measureOffset === 0 && !a.isRest && !a.isInitialRest && a.beat >= 1 && a.beat <= 4
  );
  if (anaAnchors.length > 0) return `+Ana T${Math.min(...anaAnchors.map((a) => a.beat))}`;
  if (typeof pat.anacrusisBeats === 'number' && pat.anacrusisBeats > 0 && pat.anacrusisBeats < 4) {
    return `+Ana T${4 + 1 - pat.anacrusisBeats}`;
  }
  return '+Ana';
}

export function resolvePatternRecordedDurationSec(pat: VocalPatternItem): number {
  const varRec = pat.variants?.[pat.activeVariantKey]?.recordingResult;
  const rec = pat.recordingResult?.pcm?.length ? pat.recordingResult : varRec;
  const pcmLen = rec?.pcm?.length || pat.rawAudioSamples?.length || 0;
  const sr = rec?.sampleRate || 44100;
  if (pcmLen <= 0) return 0;
  if (pat.trimEndSec > pat.trimStartSec && pat.trimEndSec <= pcmLen / sr + 0.5) return Math.max(0.1, pat.trimEndSec - pat.trimStartSec);
  return Math.max(0.1, pcmLen / sr);
}

export const PatternCardItem: React.FC<PatternCardItemProps> = ({
  pat, isActive, isSelected, sourcePatternName, onSelect, onToggleSelect,
  onRename, onDelete, onMirrorToRole, onDuplicateVariation, onUnlink, canDelete, isManualStructureEdit = false,
}) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false), [editName, setEditName] = useState(pat.name);
  const durSec = resolvePatternRecordedDurationSec(pat), hasAudio = durSec > 0;
  const anaBadge = resolveAnacrusisBadgeText(pat), hasPlus1T = pat.hasTailBeat !== false || pat.exitBeat === 1;
  const isLinked = !!pat.linkedSourcePatternId, targetRole: VocalRole = pat.role === 'puxador' ? 'coro' : 'puxador';
  const activeBg = pat.role === 'puxador' ? '!bg-[#9a3412]' : '!bg-[#0f766e]';
  const handleSave = () => { if (editName.trim()) onRename(editName.trim()); setIsEditing(false); };

  return (
    <div
      onClick={onSelect}
      className={`px-2 py-1.5 cordel-card-sm flex flex-col justify-between gap-1 cursor-pointer transition-all select-none rounded ${
        isActive ? `${activeBg} !text-white border-2 border-amber-400 shadow-md font-bold`
          : isSelected ? 'bg-amber-500/15 dark:bg-amber-950/40 text-[var(--cordel-text)] border-2 border-amber-500/80'
          : 'bg-[var(--cordel-subcard-bg)] text-[var(--cordel-text)] opacity-90 hover:opacity-100 border border-[var(--cordel-border-sub)]'
      }`}
    >
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {isManualStructureEdit && (
            <input type="checkbox" checked={isSelected || false} onChange={(e) => { e.stopPropagation(); onToggleSelect?.(); }} onClick={(e) => e.stopPropagation()} className="accent-amber-500 cursor-pointer w-3.5 h-3.5 shrink-0 rounded" title={t('selectPatternCheckbox')} />
          )}
          {isEditing ? (
            <input type="text" value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }} onBlur={handleSave} onClick={(e) => e.stopPropagation()} className="w-full min-w-0 bg-[var(--cordel-surface)] border border-theme-accent text-xs font-mono text-[var(--cordel-text)] px-1 py-0.2 focus:outline-none rounded" />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(pat.name); }} title={t('doubleClickRename')} className={`text-xs font-bold font-mono truncate flex items-center gap-1 ${isActive ? '!text-white' : 'text-theme-ink hover:text-amber-600 dark:hover:text-amber-400'}`}>
              {isActive && <span className="text-[#f4ecd8] font-black">▶</span>}
              <span className="truncate">{pat.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 font-mono text-[9.5px] font-bold">
          <span className={`px-1 py-0.2 rounded border ${isActive ? 'bg-black/25 text-white border-white/30' : 'bg-stone-500/15 text-theme-ink border-[var(--cordel-border-sub)]'}`}>{pat.measuresCount}M</span>
          {anaBadge && (
            <span className={`px-1 py-0.2 rounded border ${isActive ? 'bg-amber-400 text-stone-950 border-amber-300 font-black' : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50'}`}>{anaBadge}</span>
          )}
          {hasPlus1T && (
            <span className={`px-1 py-0.2 rounded border ${isActive ? 'bg-emerald-950/60 text-emerald-200 border-emerald-400/50' : 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/40'}`} title="Inclut le Temps 1 de la mesure suivante">+1T</span>
          )}
          <span className={`px-1 py-0.2 rounded ${isActive ? 'text-white' : hasAudio ? 'text-emerald-700 dark:text-emerald-400' : 'text-theme-ink/45'}`} title={hasAudio ? t('patternAudioRecorded') : t('patternAudioMissing')}>
            {hasAudio ? `● ${durSec.toFixed(1)}s` : '○'}
          </span>
          {canDelete && isManualStructureEdit && (
            <button type="button" title={t('deletePatternTooltip')} onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`p-0.5 cursor-pointer shrink-0 ${isActive ? '!text-white hover:text-red-200' : 'text-theme-ink/40 hover:text-red-500'}`}><Trash2 className="w-3 h-3" /></button>
          )}
        </div>
      </div>

      {isManualStructureEdit && (
        <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono pt-0.5 border-t border-white/15">
          <div className="flex items-center gap-1 min-w-0">
            {isLinked ? (
              <div className="flex items-center gap-1 border px-1 py-0.2 truncate rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40">
                <span className="truncate">{t('syncBadge', { source: sourcePatternName || '...' })}</span>
                <button type="button" title={t('unlinkTooltip')} onClick={(e) => { e.stopPropagation(); onUnlink(); }} className="hover:text-red-500 p-0.2 cursor-pointer shrink-0"><X className="w-2.5 h-2.5" /></button>
              </div>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); onMirrorToRole(targetRole); }} className="px-1.5 py-0.2 flex items-center gap-1 border font-bold cursor-pointer rounded bg-white/5 hover:bg-white/10 border-[var(--cordel-border-sub)]">
                <ArrowLeftRight className="w-2.5 h-2.5" /><span>{pat.role === 'puxador' ? t('mirrorToCoro') : t('mirrorToPuxador')}</span>
              </button>
            )}
            {onDuplicateVariation && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateVariation(); }} className="px-1 py-0.2 font-mono font-bold border cursor-pointer rounded text-[9px] bg-white/5 hover:bg-white/10 border-[var(--cordel-border-sub)]">{t('duplicateVariation')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
