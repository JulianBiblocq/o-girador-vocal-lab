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
  const [themeTick, setThemeTick] = React.useState(0);

  React.useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bgFill = isLight ? '#fbf8f0' : '#1e1813';
    const textFill = isLight ? '#2a211b' : '#efe6d2';
    const borderStroke = isLight ? 'rgba(26, 26, 26, 0.2)' : 'rgba(239, 230, 210, 0.12)';

    // Fond surface Cordel
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, w, h);

    if (mode === 'single') {
      const centerY = h / 2;
      const semitonePx = h / 5;
      const tolPx = 0.45 * semitonePx;

      // Couloir de tolérance (+/- 45 cents)
      ctx.fillStyle = isLight ? 'rgba(15, 118, 110, 0.12)' : 'rgba(42, 157, 143, 0.20)';
      ctx.fillRect(0, centerY - tolPx, w, tolPx * 2);

      // Ligne cible centrale
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label note cible
      ctx.fillStyle = textFill;
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

          ctx.strokeStyle = isGood ? '#0f766e' : '#c25e38';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    } else {
      // Mode Escalier multi-marches
      const n = staircaseSteps.length;
      if (n > 0) {
        const stepW = w / n;
        const minM = staircaseSteps[0].midi;
        const maxM = staircaseSteps[n - 1].midi;
        const span = Math.max(1, maxM - minM);

        staircaseSteps.forEach((st, idx) => {
          const x = idx * stepW;
          const normY = (st.midi - minM) / span;
          const y = h - 35 - normY * (h - 70);

          ctx.fillStyle = isLight ? 'rgba(15, 118, 110, 0.15)' : 'rgba(42, 157, 143, 0.22)';
          ctx.strokeStyle = '#0f766e';
          ctx.lineWidth = 1.5;
          ctx.fillRect(x + 4, y - 8, stepW - 8, 16);
          ctx.strokeRect(x + 4, y - 8, stepW - 8, 16);

          ctx.fillStyle = textFill;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(st.noteName, x + 8, y + 4);

          const stepSamples = samples.filter((s) => s.timeSec >= idx * 1.8 && s.timeSec < (idx + 1) * 1.8);
          if (stepSamples.length > 2) {
            const avgP = stepSamples.reduce((a, s) => a + s.pitchMidi, 0) / stepSamples.length;
            const diff = avgP - st.midi;
            const ok = Math.abs(diff) <= 0.45;
            ctx.fillStyle = ok ? '#0f766e' : '#c25e38';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(ok ? '✓' : (diff > 0 ? '↓' : '↑'), x + stepW - 20, y + 4);
          }
        });
      }
    }

    // Bordure cadre Cordel
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }, [mode, targetMidi, samples, staircaseSteps, targetHoldSec, themeTick]);

  return (
    <div className="w-full cordel-card-sm overflow-hidden rounded">
      <canvas ref={canvasRef} width={560} height={150} className="w-full h-[150px] block" />
    </div>
  );
};
