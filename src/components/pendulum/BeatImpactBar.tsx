import React from 'react';

interface BeatImpactBarProps {
  beatsPerMeasure: number;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  padRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
}

export const BeatImpactBar: React.FC<BeatImpactBarProps> = ({
  beatsPerMeasure,
  progressBarRef,
  padRefs,
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5 pt-1 select-none">
      {/* 1. Barre de progression verte (scaleX 0..1 vers l impact du temps) */}
      <div className="w-full h-1.5 bg-black/60 border border-theme-border/30 overflow-hidden relative">
        <div
          ref={progressBarRef}
          style={{ transform: 'scaleX(0)', transformOrigin: 'left', willChange: 'transform' }}
          className="h-full bg-emerald-500 w-full"
        />
      </div>

      {/* 2. Rangee de paves indicateurs des temps (T1, T2, T3, T4...) */}
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
