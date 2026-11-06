/**
 * AmbitusPitchGraph.tsx
 * Canvas Cordel réactif (240px) avec Auto-Scale vertical dynamique, lissage médian 120 ms
 * anti-saut d'octave (H1/H2), repères latéraux et mode Escalier (< 138 lignes).
 */
import React, { useEffect, useRef } from 'react';
import { smoothAmbitusSamples, type ValidationSample } from '../../audio/ambitusValidator';
import type { StaircaseStep } from '../../audio/ambitusSweepAndStairs';
import { midiToNoteName } from '../../utils/noteUtils';

interface Props {
  mode: 'single' | 'staircase' | 'sweep'; targetMidi: number; samples: ValidationSample[];
  staircaseSteps?: StaircaseStep[]; targetHoldSec?: number;
}

export const AmbitusPitchGraph: React.FC<Props> = ({
  mode, targetMidi, samples, staircaseSteps = [], targetHoldSec = 2.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null), [themeTick, setThemeTick] = React.useState(0);
  const [canvasWidth, setCanvasWidth] = React.useState(640);

  React.useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const el = canvasRef.current;
    const ro = el ? new ResizeObserver(([e]) => { if (e && e.contentRect.width > 0) setCanvasWidth(Math.max(300, Math.floor(e.contentRect.width))); }) : null;
    if (el && ro) ro.observe(el);
    return () => { obs.disconnect(); ro?.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1, w = Math.max(300, canvasWidth), h = 240;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) { canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); }
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bgFill = isLight ? '#fbf8f0' : '#1e1813', textFill = isLight ? '#2a211b' : '#efe6d2';
    const gridStroke = isLight ? 'rgba(42, 33, 27, 0.12)' : 'rgba(239, 230, 210, 0.12)';
    const borderStroke = isLight ? 'rgba(26, 26, 26, 0.22)' : 'rgba(239, 230, 210, 0.16)';

    ctx.fillStyle = bgFill; ctx.fillRect(0, 0, w, h);
    const cleanSamples = smoothAmbitusSamples(samples, mode === 'single' ? targetMidi : undefined, 0.12);

    if (mode === 'single' || mode === 'sweep') {
      const voicedMidiPoints = cleanSamples.filter((s) => s.pitchMidi >= 30 && s.pitchMidi <= 96).map((s) => s.pitchMidi);
      const sorted = [...voicedMidiPoints].sort((a, b) => a - b);
      const medianMidi = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : targetMidi;
      const refPoints = voicedMidiPoints.length > 0 ? (mode === 'single' ? [...voicedMidiPoints, targetMidi] : voicedMidiPoints) : [targetMidi];

      let minPlotMidi = Math.floor(Math.min(...refPoints) - 3), maxPlotMidi = Math.ceil(Math.max(...refPoints) + 3);
      if (maxPlotMidi - minPlotMidi < 18) {
        const deficit = 18 - (maxPlotMidi - minPlotMidi);
        minPlotMidi = Math.min(minPlotMidi, Math.floor(medianMidi - 9), minPlotMidi - Math.floor(deficit / 2));
        maxPlotMidi = Math.max(maxPlotMidi, Math.ceil(medianMidi + 9), minPlotMidi + 18);
      }

      const padY = 20, leftPad = 46, plotW = w - leftPad - 12, plotH = h - padY * 2;
      const spanMidi = Math.max(1, maxPlotMidi - minPlotMidi);
      const midiToY = (m: number) => Math.max(padY - 4, Math.min(h - padY + 4, padY + ((maxPlotMidi - m) / spanMidi) * plotH));

      for (let m = minPlotMidi; m <= maxPlotMidi; m++) {
        const pc = ((m % 12) + 12) % 12;
        if (pc === 0 || pc === 4 || pc === 7 || pc === 9) {
          const y = midiToY(m);
          ctx.strokeStyle = pc === 0 ? (isLight ? 'rgba(42,33,27,0.22)' : 'rgba(239,230,210,0.22)') : gridStroke;
          ctx.lineWidth = pc === 0 ? 1.2 : 0.8;
          ctx.beginPath(); ctx.moveTo(leftPad, y); ctx.lineTo(w - 8, y); ctx.stroke();
          ctx.fillStyle = isLight ? 'rgba(42,33,27,0.75)' : 'rgba(239,230,210,0.75)';
          ctx.font = pc === 0 ? 'bold 10px monospace' : '9px monospace';
          ctx.fillText(midiToNoteName(m), 6, y + 3);
        }
      }

      const focusMidi = mode === 'sweep' ? Math.round(medianMidi) : targetMidi;
      const targetY = midiToY(focusMidi);
      const tolPx = Math.max(6, (0.45 / spanMidi) * plotH);
      ctx.fillStyle = isLight ? 'rgba(15, 118, 110, 0.14)' : 'rgba(42, 157, 143, 0.22)';
      ctx.fillRect(leftPad, targetY - tolPx, plotW, tolPx * 2);

      ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(leftPad, targetY); ctx.lineTo(w - 8, targetY); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = textFill; ctx.font = 'bold 11px monospace';
      const headerLabel = mode === 'sweep'
        ? (voicedMidiPoints.length > 0 ? `Balayage : ${midiToNoteName(Math.round(sorted[0]))} ➔ Médiane ${midiToNoteName(Math.round(medianMidi))} ➔ ${midiToNoteName(Math.round(sorted[sorted.length - 1]))}` : 'Sirène vocale Grave ➔ Aigu')
        : `${midiToNoteName(targetMidi)} (Cible ±45 cents)`;
      ctx.fillText(headerLabel, leftPad + 4, 15);

      const maxSampleSec = cleanSamples.length > 0 ? Math.max(...cleanSamples.map((s) => s.timeSec)) : 0;
      const totalSec = Math.max(targetHoldSec, maxSampleSec, 0.5);
      if (cleanSamples.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < cleanSamples.length; i++) {
          const s1 = cleanSamples[i - 1], s2 = cleanSamples[i];
          if (s1.pitchMidi < 30 || s2.pitchMidi < 30) continue;
          const x1 = leftPad + Math.min(1, s1.timeSec / totalSec) * plotW;
          const x2 = leftPad + Math.min(1, s2.timeSec / totalSec) * plotW;
          const y1 = midiToY(s1.pitchMidi), y2 = midiToY(s2.pitchMidi);
          const isGood = mode === 'sweep' || Math.abs(s2.pitchMidi - targetMidi) <= 0.65;
          ctx.strokeStyle = isGood ? '#0f766e' : '#d97706';
          ctx.lineWidth = 2.8;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
    } else {
      const n = staircaseSteps.length;
      if (n > 0) {
        const stepW = w / n, minM = staircaseSteps[0].midi - 2, maxM = staircaseSteps[n - 1].midi + 2;
        const span = Math.max(6, maxM - minM);
        staircaseSteps.forEach((st, idx) => {
          const x = idx * stepW, normY = (st.midi - minM) / span, y = h - 30 - normY * (h - 60);
          ctx.fillStyle = isLight ? 'rgba(15, 118, 110, 0.15)' : 'rgba(42, 157, 143, 0.22)';
          ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 1.5;
          ctx.fillRect(x + 4, y - 9, stepW - 8, 18); ctx.strokeRect(x + 4, y - 9, stepW - 8, 18);
          ctx.fillStyle = textFill; ctx.font = 'bold 10px monospace'; ctx.fillText(st.noteName, x + 8, y + 4);
          const stepSamples = cleanSamples.filter((s) => s.timeSec >= idx * 1.8 && s.timeSec < (idx + 1) * 1.8);
          if (stepSamples.length > 2) {
            const avgP = stepSamples.reduce((a, s) => a + s.pitchMidi, 0) / stepSamples.length;
            const diff = avgP - st.midi, ok = Math.abs(diff) <= 0.55;
            ctx.fillStyle = ok ? '#0f766e' : '#c25e38'; ctx.font = 'bold 12px monospace';
            ctx.fillText(ok ? '✓' : (diff > 0 ? '↓' : '↑'), x + stepW - 20, y + 4);
          }
        });
      }
    }

    ctx.strokeStyle = borderStroke; ctx.lineWidth = 1; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }, [mode, targetMidi, samples, staircaseSteps, targetHoldSec, themeTick, canvasWidth]);

  return (
    <div className="w-full cordel-card-sm overflow-hidden rounded">
      <canvas ref={canvasRef} className="w-full h-[240px] block" />
    </div>
  );
};
