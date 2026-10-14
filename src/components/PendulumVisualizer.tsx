import React, { useEffect, useRef } from 'react';
import type { MetronomeEngine } from '../audio/MetronomeEngine';
import { BeatImpactBar } from './pendulum/BeatImpactBar';

interface PendulumVisualizerProps {
  engine: MetronomeEngine;
  isActive: boolean;
  measuresCount: number;
  beatsPerMeasure?: number;
}

export const PendulumVisualizer: React.FC<PendulumVisualizerProps> = ({
  engine, isActive, measuresCount, beatsPerMeasure = 4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shuttleRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLSpanElement>(null);
  const leftBumperRef = useRef<HTMLSpanElement>(null);
  const rightBumperRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (leftBumperRef.current) leftBumperRef.current.textContent = beatsPerMeasure === 4 ? '◄ T1/T3' : '◄ T1';
    if (rightBumperRef.current) rightBumperRef.current.textContent = beatsPerMeasure === 4 ? 'T2/T4 ►' : 'T2 ►';
    if (phaseLabelRef.current && !isActive) phaseLabelRef.current.textContent = 'EN ATTENTE DU CYCLE DE PRISE';
  }, [beatsPerMeasure, isActive]);

  useEffect(() => {
    let animId: number;
    let lastBeatIndex = -1;

    const updateFrame = () => {
      const shuttle = shuttleRef.current;
      const phaseLabel = phaseLabelRef.current;
      const leftBumper = leftBumperRef.current;
      const rightBumper = rightBumperRef.current;
      const progressBar = progressBarRef.current;

      if (!shuttle || !phaseLabel) {
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      const status = engine.getCycleStatus();

      if (!isActive || status.phase === 'idle') {
        shuttle.style.transform = 'translate3d(0px, 0, 0)';
        phaseLabel.textContent = 'EN ATTENTE DU CYCLE DE PRISE';
        if (progressBar) progressBar.style.transform = 'scaleX(0)';
        if (leftBumper) { leftBumper.style.opacity = '0.4'; leftBumper.style.transform = 'scale(1)'; }
        if (rightBumper) rightBumper.style.opacity = '0.4';
        padRefs.current.forEach((p) => { if (p) { p.style.backgroundColor = 'transparent'; p.style.color = ''; } });
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      if (progressBar) progressBar.style.transform = `scaleX(${status.beatProgress.toFixed(3)})`;

      const h = 0.5 * (1 - Math.cos(Math.PI * status.beatProgress));
      const currentX = (status.currentBeat % 2 === 0) ? h * railWidthRef.current : (1 - h) * railWidthRef.current;
      shuttle.style.transform = `translate3d(${currentX.toFixed(2)}px, 0, 0)`;

      const isImpact = status.beatProgress < 0.18;
      padRefs.current.forEach((pad, idx) => {
        if (!pad) return;
        const isActivePad = idx === status.currentBeat;
        if (isActivePad && isImpact) {
          pad.style.backgroundColor = idx === 0 ? 'var(--cordel-gold, #f59e0b)' : 'var(--cordel-accent, #22c55e)';
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

        const bpmTotal = status.beatsPerMeasure;
        if (status.phase === 'countdown') {
          phaseLabel.textContent = `DECOMPTE & TONALITE (Ecoutez : ${status.currentBeat + 1} / ${bpmTotal})`;
        } else if (status.phase === 'anacrusis') {
          phaseLabel.textContent = `ANACROUSE / ELAN (Chantez si depart en levee : ${status.currentBeat + 1} / ${bpmTotal})`;
        } else if (status.phase === 'singing') {
          phaseLabel.textContent = `CHANT : MESURE ${status.currentMeasure + 1} / ${measuresCount} (TEMPS ${status.currentBeat + 1} / ${bpmTotal})`;
        } else if (status.phase === 'completed') {
          phaseLabel.textContent = 'CYCLE TERMINE (PUNCH-OUT)';
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [engine, isActive, measuresCount]);

  return (
    <div className="w-full cordel-card p-3 flex flex-col gap-2.5 select-none">
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

      <BeatImpactBar beatsPerMeasure={beatsPerMeasure} progressBarRef={progressBarRef} padRefs={padRefs} />
    </div>
  );
};
