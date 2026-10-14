import React, { useEffect, useRef } from 'react';
import type { MetronomeEngine } from '../audio/MetronomeEngine';

interface PendulumVisualizerProps {
  engine: MetronomeEngine;
  isActive: boolean;
  measuresCount: number;
}

export const PendulumVisualizer: React.FC<PendulumVisualizerProps> = ({
  engine,
  isActive,
  measuresCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shuttleRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLDivElement>(null);
  const leftBumperRef = useRef<HTMLDivElement>(null);
  const rightBumperRef = useRef<HTMLDivElement>(null);
  const railWidthRef = useRef<number>(500); // Mis à jour uniquement via ResizeObserver (Zero Layout Thrashing)

  // Mesure de la largeur hors boucle 60 FPS via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Soustraire la taille de la navette (40px)
        const width = Math.max(100, entry.contentRect.width - 44);
        railWidthRef.current = width;
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Boucle 60 FPS pure GPU (Commandements 1, 2 et 3)
  useEffect(() => {
    let animId: number;
    let lastBeatIndex = -1;

    const updateFrame = () => {
      const shuttle = shuttleRef.current;
      const phaseLabel = phaseLabelRef.current;
      const leftBumper = leftBumperRef.current;
      const rightBumper = rightBumperRef.current;

      if (!shuttle || !phaseLabel) {
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      const status = engine.getCycleStatus();

      if (!isActive || status.phase === 'idle') {
        shuttle.style.transform = 'translate3d(0px, 0, 0)';
        phaseLabel.textContent = 'EN ATTENTE DU CYCLE DE TEST';
        if (leftBumper) leftBumper.style.opacity = '0.4';
        if (rightBumper) rightBumper.style.opacity = '0.4';
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      // Interpolation harmonique cinématique : 0.5 * (1 - cos(pi * progress))
      const h = 0.5 * (1 - Math.cos(Math.PI * status.beatProgress));
      const travel = railWidthRef.current;

      // T1 (0) et T3 (2) : vont de Gauche à Droite
      // T2 (1) et T4 (3) : vont de Droite à Gauche
      const goesLeftToRight = status.currentBeat % 2 === 0;
      const currentX = goesLeftToRight ? h * travel : (1 - h) * travel;

      shuttle.style.transform = `translate3d(${currentX.toFixed(2)}px, 0, 0)`;

      // Flash visuel et mise à jour textuelle lors du changement de temps
      if (status.beatIndexInCycle !== lastBeatIndex) {
        lastBeatIndex = status.beatIndexInCycle;
        const isT1 = status.currentBeat === 0;

        if (leftBumper) {
          leftBumper.style.opacity = isT1 ? '1' : status.currentBeat === 2 ? '0.75' : '0.3';
          leftBumper.style.transform = isT1 ? 'scale(1.15)' : 'scale(1)';
        }
        if (rightBumper) {
          rightBumper.style.opacity = (status.currentBeat === 1 || status.currentBeat === 3) ? '0.85' : '0.3';
        }

        // Formatage du texte de phase direct DOM
        if (status.phase === 'anacrusis') {
          phaseLabel.textContent = `ÉLAN / ANACROUSE — TEMPS ${status.currentBeat + 1} / 4`;
        } else if (status.phase === 'singing') {
          phaseLabel.textContent = `CHANT : MESURE ${status.currentMeasure + 1} / ${measuresCount} (TEMPS ${status.currentBeat + 1} / 4)`;
        } else if (status.phase === 'completed') {
          phaseLabel.textContent = 'CYCLE TERMINÉ (PUNCH-OUT)';
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [engine, isActive, measuresCount]);

  return (
    <div className="w-full cordel-card p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono tracking-wider opacity-80">
        <span ref={leftBumperRef} className="px-2 py-0.5 cordel-card-sm text-theme-accent font-bold transition-all duration-75">
          ◀ T1 / T3 (IMPACT MAJEUR)
        </span>
        <span ref={phaseLabelRef} className="font-bold text-center text-sm tracking-wide text-theme-ink uppercase">
          EN ATTENTE DU CYCLE DE TEST
        </span>
        <span ref={rightBumperRef} className="px-2 py-0.5 cordel-card-sm font-bold transition-all duration-75">
          T2 / T4 ▶
        </span>
      </div>

      {/* Rail du balancier */}
      <div
        ref={containerRef}
        className="w-full h-12 bg-black/40 border-2 border-theme-border relative flex items-center px-1 overflow-hidden rounded-sm"
      >
        {/* Repère central */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-theme-border/20 -translate-x-1/2 pointer-events-none" />

        {/* Navette pendulaire (animée en GPU translate3d) */}
        <div
          ref={shuttleRef}
          style={{ willChange: 'transform' }}
          className="w-10 h-9 cordel-card-sm flex items-center justify-center font-bold text-xs bg-theme-wood text-theme-ink shadow-md cursor-default pointer-events-none"
        >
          ●
        </div>
      </div>
    </div>
  );
};
