/**
 * AmbitusPitchGraph.tsx
 * Canvas Cordel réactif traçant la brique de la note cible, le couloir de tolérance (+/- 45 cents)
 * et la courbe réelle de la voix (Vert #2a9d8f au centre, Ambre #d97706 en écart).
 * Support du mode note unique et mode escalier 5-6 notes. Strictement < 135 lignes.
 */
import React, { useEffect, useRef } from 'react';
import type { ValidationSample } from '../../audio/ambitusValidator';
import type { StaircaseStep } from '../../audio/ambitusSweepAndStairs';
import { midiToNoteName } from '../../utils/noteUtils';

interface Props {
  mode: 'single' | 'staircase';
  targetMidi: number;
  samples: ValidationSample[];
  staircaseSteps?: StaircaseStep[];
  targetHoldSec?: number;
}

export const AmbitusPitchGraph: React.FC<Props> = ({
  mode, targetMidi, samples, staircaseSteps = [], targetHoldSec = 2.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fond surface Cordel
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, w, h);

    if (mode === 'single') {
      const centerY = h / 2;
      const semitonePx = h / 5; // +/- 2.5 demi-tons de vue verticale
      const tolPx = 0.45 * semitonePx;

      // Couloir de tolérance (+/- 45 cents)
      ctx.fillStyle = 'rgba(42, 157, 143, 0.15)';
      ctx.fillRect(0, centerY - tolPx, w, tolPx * 2);

      // Ligne cible centrale
      ctx.strokeStyle = '#2a9d8f';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label note cible
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${midiToNoteName(targetMidi)} (Cible ±45 cents)`, 10, 16);

      // Tracé de la courbe vocale
      if (samples.length > 1) {
        for (let i = 1; i < samples.length; i++) {
          const s1 = samples[i - 1], s2 = samples[i];
          const x1 = (s1.timeSec / targetHoldSec) * w;
          const x2 = (s2.timeSec / targetHoldSec) * w;
          const y1 = centerY - (s1.pitchMidi - targetMidi) * semitonePx;
          const y2 = centerY - (s2.pitchMidi - targetMidi) * semitonePx;
          const isGood = Math.abs(s2.pitchMidi - targetMidi) <= 0.45;

          ctx.strokeStyle = isGood ? '#2a9d8f' : '#d97706';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    } else {
      // Mode Escalier multi-marches
      const n = staircaseSteps.length;
      if (n === 0) return;
      const stepW = w / n;
      const minM = staircaseSteps[0].midi;
      const maxM = staircaseSteps[n - 1].midi;
      const span = Math.max(1, maxM - minM);

      staircaseSteps.forEach((st, idx) => {
        const x = idx * stepW;
        const normY = (st.midi - minM) / span;
        const y = h - 35 - normY * (h - 70);

        // Brique marche
        ctx.fillStyle = 'rgba(42, 157, 143, 0.2)';
        ctx.strokeStyle = '#2a9d8f';
        ctx.lineWidth = 2;
        ctx.fillRect(x + 4, y - 8, stepW - 8, 16);
        ctx.strokeRect(x + 4, y - 8, stepW - 8, 16);

        // Label marche
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(st.noteName, x + 8, y + 4);

        // Analyse échantillons de cette marche
        const stepSamples = samples.filter((s) => s.timeSec >= idx * 1.8 && s.timeSec < (idx + 1) * 1.8);
        if (stepSamples.length > 2) {
          const avgP = stepSamples.reduce((a, s) => a + s.pitchMidi, 0) / stepSamples.length;
          const diff = avgP - st.midi;
          const ok = Math.abs(diff) <= 0.45;
          ctx.fillStyle = ok ? '#2a9d8f' : '#d97706';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(ok ? '✓' : (diff > 0 ? '↓' : '↑'), x + stepW - 20, y + 4);
        }
      });
    }

    // Bordure cadre Cordel
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, w, h);
  }, [mode, targetMidi, samples, staircaseSteps, targetHoldSec]);

  return (
    <div className="w-full bg-[#fdfbf7] border border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
      <canvas ref={canvasRef} width={560} height={150} className="w-full h-[150px] block" />
    </div>
  );
};
