/**
 * MicLevelMeter.tsx
 * VU-mètre micro compact 60 FPS piloté par ref DOM (zéro useState par trame) : Signal faible < -42 dBFS,
 * niveau idéal -42..-3 dBFS (Ciano), saturation crête >= 0.97 ou >= -0.5 dBFS (Terracotta, maintien 1,5 s) (< 75 lignes).
 */
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface MicLevel { rms: number; peak: number; }

const FLOOR_DB = -42, SAT_DB = -0.5, PEAK_SAT = 0.97, HOLD_MS = 1500, MIN_DB = -60;
const COLORS = { low: '#78716c', ok: '#0f766e', clip: '#9a3412' } as const;
type MeterState = keyof typeof COLORS;

export const MicLevelMeter: React.FC<{ levelRef: React.MutableRefObject<MicLevel>; active: boolean; className?: string }> = ({ levelRef, active, className = '' }) => {
  const { t } = useLanguage();
  const barRef = useRef<HTMLDivElement>(null), ledRef = useRef<HTMLSpanElement>(null), labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = barRef.current, led = ledRef.current, label = labelRef.current;
    if (!bar || !led || !label) return;
    if (!active) { bar.style.transform = 'scaleX(0)'; led.style.opacity = '0.15'; label.textContent = t('micMeterOff'); label.style.color = COLORS.low; return; }
    const labels: Record<MeterState, string> = { low: t('micMeterLow'), ok: t('micMeterOk'), clip: t('micMeterClip') };
    let raf = 0, holdUntil = 0, state: MeterState | null = null;
    const tick = (now: number) => {
      const { rms, peak } = levelRef.current, db = rms > 1e-5 ? 20 * Math.log10(rms) : MIN_DB;
      if (peak >= PEAK_SAT || db >= SAT_DB) holdUntil = now + HOLD_MS;
      const next: MeterState = now < holdUntil ? 'clip' : db < FLOOR_DB ? 'low' : 'ok';
      bar.style.transform = `scaleX(${Math.max(0, Math.min(1, (db - MIN_DB) / -MIN_DB))})`;
      if (next !== state) {
        state = next; bar.style.backgroundColor = COLORS[next]; label.textContent = labels[next]; label.style.color = COLORS[next];
        led.style.opacity = next === 'clip' ? '1' : '0.15';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef, t]);

  return (
    <div className={`flex items-center gap-2 font-mono text-[11px] ${className}`} title={t('micMeterTitle')} role="meter" aria-label={t('micMeterTitle')}>
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 text-theme-ink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      <div className="relative flex-1 min-w-[90px] h-2.5 rounded-sm overflow-hidden bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)]">
        <div ref={barRef} className="absolute inset-0 origin-left will-change-transform" style={{ transform: 'scaleX(0)', backgroundColor: COLORS.low }} />
        <span className="absolute top-0 bottom-0 w-px bg-[var(--cordel-border)] opacity-60" style={{ left: '30%' }} />
        <span className="absolute top-0 bottom-0 w-px bg-[var(--cordel-border)] opacity-60" style={{ left: '95%' }} />
      </div>
      <span ref={ledRef} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS.clip, opacity: 0.15 }} aria-hidden="true" />
      <span ref={labelRef} className="w-24 truncate font-bold" style={{ color: COLORS.low }}>{t('micMeterOff')}</span>
    </div>
  );
};
