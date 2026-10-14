import React, { useEffect, useRef } from 'react';
import type { MetronomeEngine } from '../audio/MetronomeEngine';

interface PendulumVisualizerProps {
  engine: MetronomeEngine;
  isActive: boolean;
  measuresCount: number;
  beatsPerMeasure?: number;
}

export const PendulumVisualizer: React.FC<PendulumVisualizerProps> = ({
  engine,
  isActive,
  measuresCount,
  beatsPerMeasure = 4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shuttleRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLSpanElement>(null);
  const leftBumperRef = useRef<HTMLSpanElement>(null);
  const rightBumperRef = useRef<HTMLSpanElement>(null);
  const railWidthRef = useRef<number>(500); // Mis à jour uniquement via ResizeObserver (Zero Layout Thrashing)

  // Mesure de la largeur hors boucle 60 FPS via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.max(100, entry.contentRect.width - 44);
        railWidthRef.current = width;
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialisation du texte au repos (hors réconciliation React Fiber pour éviter removeChild)
  useEffect(() => {
    if (phaseLabelRef.current && !isActive) {
      phaseLabelRef.current.textContent = 'EN ATTENTE DU CYCLE DE TEST';
    }
  }, [isActive]);

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
        if (leftBumper) {
          leftBumper.style.opacity = '0.4';
          leftBumper.style.transform = 'scale(1)';
        }
        if (rightBumper) rightBumper.style.opacity = '0.4';
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      // Interpolation harmonique cinématique : 0.5 * (1 - cos(pi * progress))
      const h = 0.5 * (1 - Math.cos(Math.PI * status.beatProgress));
      const travel = railWidthRef.current;

      // Temps pairs (0, 2...) vont de Gauche à Droite
      // Temps impairs (1, 3...) vont de Droite à Gauche
      const goesLeftToRight = status.currentBeat % 2 === 0;
      const currentX = goesLeftToRight ? h * travel : (1 - h) * travel;

      shuttle.style.transform = `translate3d(${currentX.toFixed(2)}px, 0, 0)`;

      // Détection de transition de temps
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

        // Formatage textuel direct DOM (l'élément n'a pas d'enfants React gérés par le Fiber)
        const bpmTotal = status.beatsPerMeasure;
        if (status.phase === 'anacrusis') {
          phaseLabel.textContent = `ÉLAN / ANACROUSE — TEMPS ${status.currentBeat + 1} / ${bpmTotal}`;
        } else if (status.phase === 'singing') {
          phaseLabel.textContent = `CHANT : MESURE ${status.currentMeasure + 1} / ${measuresCount} (TEMPS ${status.currentBeat + 1} / ${bpmTotal})`;
        } else if (status.phase === 'completed') {
          phaseLabel.textContent = 'CYCLE TERMINÉ (PUNCH-OUT)';
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [engine, isActive, measuresCount]);

  // Libellés dynamiques selon le nombre de temps
  const leftLabel = beatsPerMeasure === 4
    ? '◀ T1 / T3 (IMPACT)'
    : beatsPerMeasure === 2
    ? '◀ T1 (IMPACT)'
    : '◀ T1 / T3 (IMPACT)';

  const rightLabel = beatsPerMeasure === 4
    ? 'T2 / T4 ▶'
    : beatsPerMeasure === 2
    ? 'T2 ▶'
    : 'T2 ▶';

  return (
    <div className="w-full cordel-card p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono tracking-wider opacity-80">
        <span
          ref={leftBumperRef}
          className="px-2 py-0.5 cordel-card-sm text-theme-accent font-bold transition-all duration-75"
        >
          {leftLabel}
        </span>

        {/* Conteneur de phase délibérément vide en JSX pour éviter toute collision React Fiber */}
        <span
          ref={phaseLabelRef}
          className="font-bold text-center text-sm tracking-wide text-theme-ink uppercase min-h-[20px]"
        />

        <span
          ref={rightBumperRef}
          className="px-2 py-0.5 cordel-card-sm font-bold transition-all duration-75"
        >
          {rightLabel}
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
