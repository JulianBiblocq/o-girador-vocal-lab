/**
 * RepertoireTargetSongPicker.tsx
 * Sélecteur de morceau cible Sequenciador ou création d'un nouveau morceau (< 65 lignes).
 */
import React from 'react';
import { Drum, Search, Plus, Loader2 } from 'lucide-react';
import type { SamambaiaMorceauSummary } from '../../utils/sequenciadorPresetBuilder';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  repLabel: string;
  loadingList: boolean;
  filtered: SamambaiaMorceauSummary[];
  selectedId: string;
  onSelectId: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  isCreatingNew: boolean;
  onToggleCreatingNew: () => void;
  newTitle: string;
  onNewTitleChange: (val: string) => void;
  newBpm: number;
  onNewBpmChange: (val: number) => void;
}

export const RepertoireTargetSongPicker: React.FC<Props> = ({
  repLabel, loadingList, filtered, selectedId, onSelectId, search, onSearchChange,
  isCreatingNew, onToggleCreatingNew, newTitle, onNewTitleChange, newBpm, onNewBpmChange,
}) => {
  const { t } = useLanguage();

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-60" />
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={t('exportSearchPlaceholder', { repLabel })} className="w-full pl-8 pr-2.5 py-1.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] outline-none" />
        </div>
        <button type="button" onClick={onToggleCreatingNew} className={`px-2.5 py-1.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer border ${isCreatingNew ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}>
          <Plus className="w-3.5 h-3.5" /><span>{t('exportCreateNewBtn', { repLabel })}</span>
        </button>
      </div>

      {isCreatingNew ? (
        <div className="p-2 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] flex flex-wrap items-center gap-2">
          <label className="flex-1 min-w-[180px] flex flex-col gap-1"><span className="font-bold opacity-80">{t('exportNewSongTitleLabel')}</span><input type="text" value={newTitle} onChange={(e) => onNewTitleChange(e.target.value)} className="px-2 py-1 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] font-bold" /></label>
          <label className="w-28 flex flex-col gap-1"><span className="font-bold opacity-80">BPM Sequenciador :</span><input type="number" min={30} max={240} value={newBpm} onChange={(e) => onNewBpmChange(Number(e.target.value) || 96)} className="px-2 py-1 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] font-bold text-center" /></label>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-44 flex flex-col gap-1.5 pr-1 cordel-scrollbar">
          {loadingList ? (
            <div className="py-6 flex items-center justify-center gap-2 opacity-75"><Loader2 className="w-4 h-4 animate-spin text-theme-accent" /><span>{repLabel}...</span></div>
          ) : filtered.map((m) => (
            <button key={m.id} type="button" onClick={() => onSelectId(m.id)} className={`w-full text-left p-2 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${m.id === selectedId ? 'bg-amber-500/15 border-amber-500 font-bold' : 'bg-[var(--cordel-subcard-bg)] border-[var(--cordel-border-sub)] hover:border-amber-500/50'}`}>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 truncate"><Drum className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="truncate">{m.name}</span>{m.hasVocalToada && <span className="px-1.5 py-0.2 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-[10px]">{t('exportLinkedToadaBadge')}</span>}</div>
                <span className="text-[10.5px] opacity-75">{m.ritmo || 'Baque Virado'}{m.nacao ? ` • ${m.nacao}` : ''}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-theme-wood text-[#f4ecd8] font-bold shrink-0">{m.bpm} BPM</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
