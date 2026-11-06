/**
 * ContinuousPrompterBanner.tsx
 * Prompteur dynamique pendant la prise continue : indicateur 🎙️ CHANTEZ vs 🔇 TROU DU CHŒUR / PUXADOR (< 95 lignes).
 */
import React from 'react';
import type { ContinuousPrompterSlotInfo } from '../../audio/continuousTakeRecorder';
import { useLanguage } from '../../i18n/LanguageContext';
import { Sparkles, Mic, VolumeX } from 'lucide-react';

interface ContinuousPrompterBannerProps {
  info: ContinuousPrompterSlotInfo | null;
  isActive: boolean;
}

export const ContinuousPrompterBanner: React.FC<ContinuousPrompterBannerProps> = ({ info, isActive }) => {
  const { t } = useLanguage();
  if (!isActive || !info) return null;

  const isPuxador = info.role === 'puxador';
  const isGap = Boolean(info.isRoleGap);
  const gapRoleName = isPuxador ? 'CHŒUR' : 'PUXADOR';
  const activeRoleName = isPuxador ? 'PUXADOR' : 'CHŒUR';

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg border-2 text-white shadow-lg animate-fadeIn text-left ${
      isGap ? 'border-stone-500/80 bg-stone-950/95' : (isPuxador ? 'border-amber-500/80 bg-stone-900' : 'border-emerald-500/80 bg-stone-900')
    }`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1.5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isGap ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-stone-700 text-amber-200 flex items-center gap-1.5">
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              <span>🔇 TROU DU {gapRoleName} ({info.gapMeasures ?? 1} M) — Écoutez / Respirez</span>
            </span>
          ) : (
            <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isPuxador ? 'bg-amber-500 text-stone-950' : 'bg-emerald-500 text-stone-950'
            }`}>
              <Mic className="w-3.5 h-3.5" />
              <span>🎙️ CHANTEZ ({activeRoleName})</span>
            </span>
          )}
          <span className="text-xs font-mono font-bold text-amber-200">
            {t('prompterSlotMeasure', { slot: info.slotIndex, total: info.totalSlots, measure: info.conductorMeasure })}
          </span>
          {!isGap && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              info.hasAnacrusis ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50' : 'bg-stone-700 text-stone-300'
            }`}>
              {info.hasAnacrusis ? t('prompterAnacBadge', { beats: info.anacrusisBeats || 2 }) : t('prompterT1Badge')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isGap && typeof info.remainingBeatsToNextEntry === 'number' && (
            <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-amber-300 text-xs font-mono font-black">
              ⏳ Entrée dans {info.remainingBeatsToNextEntry} temps
            </span>
          )}
          <span className="text-[10px] font-mono text-red-400 font-bold flex items-center gap-1 animate-pulse">
            ● {t('continuousPrompterLive')}
          </span>
        </div>
      </div>

      <div className="text-base sm:text-lg font-serif font-black tracking-wide text-amber-100 min-h-[1.8rem] flex items-center">
        {isGap ? (
          <span className="text-stone-400 italic text-sm font-mono">
            {info.counterRoleLyrics
              ? `🔊 (${gapRoleName} chante : « ${info.counterRoleLyrics} » — Ne chantez pas, préparez votre prochaine entrée)`
              : `🔇 Pause Batuque (${info.gapMeasures ?? 1} M)`}
          </span>
        ) : (
          info.lyrics ? `« ${info.lyrics} »` : <em>({t('continuousPrompterRest')})</em>
        )}
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
