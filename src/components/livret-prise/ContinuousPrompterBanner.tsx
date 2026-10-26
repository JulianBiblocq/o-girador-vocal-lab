/**
 * ContinuousPrompterBanner.tsx
 * Prompteur dynamique pendant la prise continue avec encart doré d'anticipation (< 90 lignes).
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
            {isPuxador ? 'Puxador (Solo)' : 'Coro (Chœur)'}
          </span>
          <span className="text-xs font-mono font-bold text-amber-200">
            Bloc {info.slotIndex} / {info.totalSlots} — Mesure M{info.conductorMeasure}
          </span>
        </div>
        <span className="text-[10px] font-mono text-red-400 font-bold flex items-center gap-1 animate-pulse">
          ● {t('continuousPrompterLive') || 'PRISE CONTINUE EN COURS'}
        </span>
      </div>

      <div className="text-base sm:text-lg font-serif font-black tracking-wide text-amber-100 min-h-[1.8rem] flex items-center">
        {info.lyrics ? `« ${info.lyrics} »` : <em>({t('continuousPrompterRest') || 'Écoute / Attente'})</em>}
      </div>

      {info.nextSlotIndex && (
        <div className="flex items-center gap-2 p-1.5 rounded bg-amber-500/20 border border-amber-400/40 text-xs font-mono text-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            <strong>{t('continuousPrompterNext') || 'À suivre'} au Bloc {info.nextSlotIndex} (M{info.nextMeasure}) :</strong>{' '}
            <span className="italic">{info.nextLyrics ? `« ${info.nextLyrics} »` : '...'}</span>
          </span>
        </div>
      )}
    </div>
  );
};
