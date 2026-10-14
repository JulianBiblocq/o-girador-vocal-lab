import React, { useEffect, useRef } from 'react';
import type { MetronomeEngine } from '../audio/MetronomeEngine';
import { BeatImpactBar } from './pendulum/BeatImpactBar';
import { applyPhaseStyles } from './pendulum/pendulumStyleHelper';
import { useLanguage } from '../i18n/LanguageContext';

interface PendulumVisualizerProps {
  engine: MetronomeEngine;
  isActive: boolean;
  measuresCount: number;
  beatsPerMeasure?: number;
}

export const PendulumVisualizer: React.FC<PendulumVisualizerProps> = ({
  engine, isActive, measuresCount, beatsPerMeasure = 4,
}) => {
  const { t } = useLanguage();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shuttleRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLSpanElement>(null);
  const leftBumperRef = useRef<HTMLSpanElement>(null);
  const rightBumperRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const recBadgeRef = useRef<HTMLSpanElement>(null);
  const padRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const railWidthRef = useRef<number>(500);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      railWidthRef.current = Math.max(100, entry.contentRect.width - 44);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const resetIdle = (label: HTMLSpanElement | null, badge: HTMLSpanElement | null) => {
    if (label) label.textContent = tRef.current('pendulumIdleTitle');
    if (badge) {
      badge.textContent = tRef.current('pendulumStatusIdle');
      badge.style.color = 'var(--cordel-secondary-text, #57534e)';
    }
  };

  useEffect(() => {
    if (leftBumperRef.current) leftBumperRef.current.textContent = beatsPerMeasure === 4 ? '◄ T1/T3' : '◄ T1';
    if (rightBumperRef.current) rightBumperRef.current.textContent = beatsPerMeasure === 4 ? 'T2/T4 ►' : 'T2 ►';
    if (!isActive) resetIdle(phaseLabelRef.current, recBadgeRef.current);
  }, [beatsPerMeasure, isActive, t]);

  useEffect(() => {
    let animId: number;
    let lastBeatIndex = -1;

    const updateFrame = () => {
      const shuttle = shuttleRef.current;
      const phaseLabel = phaseLabelRef.current;
      const leftBumper = leftBumperRef.current;
      const rightBumper = rightBumperRef.current;
      const progressBar = progressBarRef.current;
      const recBadge = recBadgeRef.current;
      const card = cardRef.current;

      if (!shuttle || !phaseLabel) { animId = requestAnimationFrame(updateFrame); return; }

      const status = engine.getCycleStatus();

      if (!isActive || status.phase === 'idle') {
        shuttle.style.transform = 'translate3d(0px, 0, 0)';
        resetIdle(phaseLabel, recBadge);
        if (card) { card.style.borderColor = ''; card.style.backgroundColor = ''; card.style.boxShadow = ''; }
        if (progressBar) progressBar.style.transform = 'scaleX(0)';
        if (leftBumper) { leftBumper.style.opacity = '0.4'; leftBumper.style.transform = 'scale(1)'; }
        if (rightBumper) rightBumper.style.opacity = '0.4';
        padRefs.current.forEach((p) => { if (p) { p.style.backgroundColor = 'transparent'; p.style.color = ''; } });
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      if (progressBar) {
        progressBar.style.transformOrigin = (status.currentBeat % 2 === 0) ? 'left center' : 'right center';
        progressBar.style.transform = `scaleX(${status.beatProgress.toFixed(3)})`;
      }

      const h = 0.5 * (1 - Math.cos(Math.PI * status.beatProgress));
      const currentX = (status.currentBeat % 2 === 0) ? h * railWidthRef.current : (1 - h) * railWidthRef.current;
      shuttle.style.transform = `translate3d(${currentX.toFixed(2)}px, 0, 0)`;

      applyPhaseStyles(card, recBadge, phaseLabel, status, measuresCount, tRef.current);

      const isImpact = status.beatProgress < 0.18;
      const isRec = status.phase === 'anacrusis' || status.phase === 'singing';
      padRefs.current.forEach((pad, idx) => {
        if (!pad) return;
        const isActivePad = idx === status.currentBeat;
        if (isActivePad && isImpact) {
          pad.style.backgroundColor = idx === 0 ? 'var(--cordel-accent-text, #f59e0b)' : (isRec ? '#ef4444' : '#22c55e');
          pad.style.color = '#000';
        } else {
          pad.style.backgroundColor = isActivePad ? 'rgba(255,255,255,0.18)' : 'transparent';
          pad.style.color = '';
        }
      });

      if (status.beatIndexInCycle !== lastBeatIndex) {
        lastBeatIndex = status.beatIndexInCycle;
        const isT1 = status.currentBeat === 0;
        if (leftBumper) {
          leftBumper.style.opacity = isT1 ? '1' : status.currentBeat === 2 ? '0.75' : '0.3';
          leftBumper.style.transform = isT1 ? 'scale(1.15)' : 'scale(1)';
        }
        if (rightBumper) rightBumper.style.opacity = (status.currentBeat === 1 || status.currentBeat === 3) ? '0.85' : '0.3';
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [engine, isActive, measuresCount]);

  return (
    <div ref={cardRef} className="w-full cordel-card p-3 flex flex-col gap-2.5 select-none transition-colors duration-150">
      <div className="flex items-center justify-between text-xs font-mono tracking-wider opacity-80">
        <span ref={leftBumperRef} className="px-2 py-0.5 cordel-card-sm text-theme-accent font-bold transition-all duration-75" />
        <span ref={phaseLabelRef} className="font-bold text-center text-sm tracking-wide text-theme-ink uppercase min-h-[20px]" />
        <span ref={rightBumperRef} className="px-2 py-0.5 cordel-card-sm font-bold transition-all duration-75" />
      </div>

      <div ref={containerRef} className="w-full h-11 bg-black/40 border-2 border-theme-border relative flex items-center px-1 overflow-hidden rounded-sm">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-theme-border/20 -translate-x-1/2 pointer-events-none" />
        <div ref={shuttleRef} style={{ willChange: 'transform' }} className="w-9 h-8 cordel-card-sm flex items-center justify-center font-bold text-xs bg-theme-wood text-theme-ink shadow-md cursor-default pointer-events-none">
          ▲
        </div>
      </div>

      <BeatImpactBar beatsPerMeasure={beatsPerMeasure} progressBarRef={progressBarRef} padRefs={padRefs} recBadgeRef={recBadgeRef} />
    </div>
  );
};
