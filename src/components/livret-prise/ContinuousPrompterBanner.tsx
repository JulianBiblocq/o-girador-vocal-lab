/**
 * ContinuousPrompterBanner.tsx
 * Prompteur dynamique pendant la prise continue avec encart doré d'anticipation (< 65 lignes).
 */
import React from 'react';
import type { ContinuousPrompterSlotInfo } from '../../audio/continuousTakeRecorder';
import { useLanguage } from '../../i18n/LanguageContext';
import { Sparkles } from 'lucide-react';

interface ContinuousPrompterBannerProps {
  info: ContinuousPrompterSlotInfo | null;
  isActive: boolean;
}

export const ContinuousPrompterBanner: React.FC<ContinuousPrompterBannerProps> = ({ info, isActive }) => {
  const { t } = useLanguage();
  if (!isActive || !info) return null;

  const isPuxador = info.role === 'puxador';

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border-2 border-amber-500/70 bg-stone-900 text-white shadow-lg animate-fadeIn text-left">
      <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1.5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider ${
            isPuxador ? 'bg-amber-500 text-stone-950' : 'bg-emerald-500 text-stone-950'
          }`}>
            {isPuxador ? t('prompterRolePuxador') : t('prompterRoleCoro')}
          </span>
          <span className="text-xs font-mono font-bold text-amber-200">
            {t('prompterSlotMeasure', { slot: info.slotIndex, total: info.totalSlots, measure: info.conductorMeasure })}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            info.hasAnacrusis ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50' : 'bg-stone-700 text-stone-300'
          }`}>
            {info.hasAnacrusis ? t('prompterAnacBadge', { beats: info.anacrusisBeats || 2 }) : t('prompterT1Badge')}
          </span>
        </div>
        <span className="text-[10px] font-mono text-red-400 font-bold flex items-center gap-1 animate-pulse">
          ● {t('continuousPrompterLive')}
        </span>
      </div>

      <div className="text-base sm:text-lg font-serif font-black tracking-wide text-amber-100 min-h-[1.8rem] flex items-center">
        {info.lyrics ? `« ${info.lyrics} »` : <em>({t('continuousPrompterRest')})</em>}
      </div>

      {info.nextSlotIndex && (
        <div className="flex items-center gap-2 p-1.5 rounded bg-amber-500/20 border border-amber-400/40 text-xs font-mono text-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            <strong>{t('continuousPrompterNext')} {t('prompterNextBlock', { slot: info.nextSlotIndex, measure: info.nextMeasure ?? '' })}</strong>{' '}
            <span className="italic">{info.nextLyrics ? `« ${info.nextLyrics} »` : '...'}</span>
          </span>
        </div>
      )}
    </div>
  );
};
