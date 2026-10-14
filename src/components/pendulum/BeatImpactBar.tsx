import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface BeatImpactBarProps {
  beatsPerMeasure: number;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  padRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  recBadgeRef: React.RefObject<HTMLSpanElement | null>;
}

export const BeatImpactBar: React.FC<BeatImpactBarProps> = ({
  beatsPerMeasure,
  progressBarRef,
  padRefs,
  recBadgeRef,
}) => {
  const { t } = useLanguage();

  return (
    <div className="w-full flex flex-col gap-1.5 pt-0.5 select-none">
      {/* 1. Statut REC & Tête de mesure */}
      <div className="flex items-center justify-between min-h-[18px]">
        <span
          ref={recBadgeRef}
          style={{ willChange: 'opacity, transform, color' }}
          className="text-[10px] font-bold font-mono tracking-wider"
        />
        <span className="text-[10px] font-mono opacity-60">
          {t('synchronousImpact')}
        </span>
      </div>

      {/* 2. Barre verte bidirectionnelle (suit le sens du balancier) */}
      <div className="w-full h-1.5 bg-black/60 border border-theme-border/30 overflow-hidden relative">
        <div
          ref={progressBarRef}
          style={{ transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }}
          className="h-full bg-emerald-500 w-full"
        />
      </div>

      {/* 3. Pavés indicateurs des temps (T1, T2, T3, T4...) */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        {Array.from({ length: beatsPerMeasure }).map((_, idx) => (
          <span
            key={idx}
            ref={(el) => { padRefs.current[idx] = el; }}
            style={{ willChange: 'background-color, transform, color' }}
            className="flex-1 py-0.5 text-center font-mono text-[11px] font-bold border border-theme-border/40 text-theme-ink/80 transition-none"
          >
            {idx === 0 ? 'T1 ★' : `T${idx + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
};
