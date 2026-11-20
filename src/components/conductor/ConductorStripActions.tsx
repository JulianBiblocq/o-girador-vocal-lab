/**
 * ConductorStripActions.tsx
 * Barre d'actions de la Frise Conducteur : Tempo live, [ + Ajouter un bloc ], [ + Pause Batuque ] et lecture complète.
 * Boutons toujours actifs : un clic bascule en « Modifier la structure » (confirmation légère la 1re fois) (< 70 lignes).
 */
import React from 'react';
import { Play, Square } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PlusBlockIcon, PauseBlockIcon } from '../icons/CordelActionIcons';
import { ConductorLiveTempoControl } from './ConductorLiveTempoControl';

interface Props {
  liveBpm: number; projectBpm: number; isPlaying: boolean;
  onBpmChange: (bpm: number) => void; onApplyBpm: (bpm: number) => void;
  onAddBlock: () => void; onAddPause: () => void; onTogglePlay: () => void;
}

export const ConductorStripActions: React.FC<Props> = ({ liveBpm, projectBpm, isPlaying, onBpmChange, onApplyBpm, onAddBlock, onAddPause, onTogglePlay }) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <ConductorLiveTempoControl liveBpm={liveBpm} projectBpm={projectBpm} onBpmChange={onBpmChange} onApplyBpmToProject={onApplyBpm} />
      <button type="button" onClick={onAddBlock} title={t('conductorAddBlockTitle')} className="px-3 py-1 text-[11px] font-bold font-mono rounded inline-flex items-center gap-1.5 cursor-pointer cordel-btn-primary">
        <PlusBlockIcon className="w-3.5 h-3.5" /><span>{t('conductorAddBlockFull')}</span>
      </button>
      <button type="button" onClick={onAddPause} title={t('conductorAddSilenceBtn')} className="px-3 py-1 text-[11px] font-bold font-mono rounded inline-flex items-center gap-1.5 cursor-pointer cordel-card-sm text-amber-800 dark:text-amber-300">
        <PauseBlockIcon className="w-3.5 h-3.5" /><span>{t('conductorAddSilenceBtn')}</span>
      </button>
      <button type="button" onClick={onTogglePlay} className={`px-2.5 py-1 text-[11px] font-bold font-mono rounded inline-flex items-center gap-1.5 cursor-pointer ${isPlaying ? 'bg-red-800 text-white animate-pulse' : 'cordel-btn-primary'}`}>
        {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        <span>{isPlaying ? t('stopFullToada') : t('playFullToada')}</span>
      </button>
    </div>
  );
};
