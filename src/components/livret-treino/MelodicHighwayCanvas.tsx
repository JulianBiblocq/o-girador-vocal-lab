/**
 * MelodicHighwayCanvas.tsx
 * Autoroute Mélodique 60 FPS pour le Studio Élève 2.0 (Briques + Syllabes + Silences 𝄽 + Courbe Mestre + Trace Élève) (< 135 lignes).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';
import { foldStudentPitchToTargetOctave } from '../../audio/studentPitchAnalyzer';

export interface MelodicHighwayCanvasProps {
  allSteps: VocalStepData[]; mestrePitchCurve?: PitchCurvePoint[]; studentPitchCurve: PitchCurvePoint[];
  totalDurationSec: number; beatsPerMeasure: number; hasAnacrusis: boolean; isPlaying: boolean; getPlayheadSec: () => number;
}

export const MelodicHighwayCanvas: React.FC<MelodicHighwayCanvasProps> = ({
  allSteps, mestrePitchCurve = [], studentPitchCurve, totalDurationSec, beatsPerMeasure, hasAnacrusis, isPlaying, getPlayheadSec,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null), rafRef = useRef<number | null>(null);
  const activeMidis = allSteps.filter((s) => s.active && s.midiNumber > 0).map((s) => s.midiNumber);
  const minTarget = activeMidis.length > 0 ? Math.min(...activeMidis) : 55, maxTarget = activeMidis.length > 0 ? Math.max(...activeMidis) : 67;
  const minMidi = Math.max(36, minTarget - 3), maxMidi = Math.min(84, maxTarget + 3), medianMidi = Math.round((minTarget + maxTarget) / 2);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const width = canvas.clientWidth || 720, height = canvas.clientHeight || 220, dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const leftPad = 36, plotW = Math.max(100, width - leftPad), numRows = Math.max(7, maxMidi - minMidi + 1), rowH = height / numRows;
    const totalSteps = Math.max(1, allSteps.length), stepW = plotW / totalSteps, subdivPerBeat = 4;

    for (let m = maxMidi; m >= minMidi; m--) {
      const y = (maxMidi - m) * rowH, isBlack = [1, 3, 6, 8, 10].includes(m % 12);
      ctx.fillStyle = isBlack ? (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.18)') : 'transparent';
      ctx.fillRect(leftPad, y, plotW, rowH);
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(leftPad, y + rowH); ctx.lineTo(width, y + rowH); ctx.stroke();
      if (m % 2 === 0 || m === minTarget || m === maxTarget) {
        ctx.fillStyle = isLight ? '#57534e' : '#a8a29e'; ctx.font = 'bold 9px monospace';
        ctx.fillText(midiToNoteName(m), 4, y + rowH * 0.72);
      }
    }

    const m1StartBeat = hasAnacrusis ? beatsPerMeasure : 0;
    const firstActiveStep = allSteps.findIndex((st, idx) => idx >= m1StartBeat * subdivPerBeat && st.active && st.midiNumber > 0);
    for (let i = 0; i < totalSteps; i += subdivPerBeat) {
      const x = leftPad + i * stepW, b = Math.floor(i / subdivPerBeat), isT1 = hasAnacrusis ? b === beatsPerMeasure : b === 0;
      ctx.strokeStyle = isT1 ? '#d4af37' : b % beatsPerMeasure === 0 ? (isLight ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.28)') : (isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)');
      ctx.lineWidth = isT1 ? 2.2 : 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      if (b >= m1StartBeat && b < m1StartBeat + beatsPerMeasure && firstActiveStep > (b + 1) * subdivPerBeat - 1) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.16)'; ctx.fillRect(x + 2, 4, Math.min(38, subdivPerBeat * stepW - 4), 15);
        ctx.fillStyle = isLight ? '#92400e' : '#fcd34d'; ctx.font = 'bold 9px monospace';
        ctx.fillText(`𝄽 T${(b - m1StartBeat) + 1}`, x + 5, 14);
      }
    }

    // 3. Briques cibles du Mestre avec syllabes
    for (let i = 0; i < allSteps.length; i++) {
      const s = allSteps[i];
      if (!s.active || s.note === '───' || s.midiNumber < minMidi || s.midiNumber > maxMidi) continue;
      let ties = 0;
      while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
      const x = leftPad + i * stepW, w = Math.max(6, (1 + ties) * stepW - 2);
      const y = (maxMidi - s.midiNumber) * rowH + 2, h = Math.max(10, rowH - 4);
      ctx.fillStyle = isLight ? 'rgba(180, 83, 9, 0.25)' : 'rgba(217, 119, 6, 0.28)';
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isLight ? '#1c1917' : '#fef3c7';
      ctx.font = 'bold 10px sans-serif';
      const label = s.syllable?.trim() ? s.syllable.trim() : s.note;
      ctx.fillText(label, x + 5, y + h * 0.68);
      i += ties;
    }

    // 4. Courbe de référence f0(t) du Mestre (pointillés dorés)
    if (mestrePitchCurve.length > 1 && totalDurationSec > 0) {
      ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.5)' : 'rgba(253, 224, 71, 0.45)';
      ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      for (let k = 0; k < mestrePitchCurve.length - 1; k++) {
        const p1 = mestrePitchCurve[k], p2 = mestrePitchCurve[k + 1];
        if (Math.abs(p2.timeSec - p1.timeSec) > 0.05) continue;
        const x1 = leftPad + (p1.timeSec / totalDurationSec) * plotW, y1 = (maxMidi - p1.midiFloat) * rowH + rowH / 2;
        const x2 = leftPad + (p2.timeSec / totalDurationSec) * plotW, y2 = (maxMidi - p2.midiFloat) * rowH + rowH / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 5. Trace vocale de l'élève (temps réel ou post-prise, repliée mod 12)
    if (studentPitchCurve.length > 1 && totalDurationSec > 0) {
      ctx.lineWidth = 3;
      for (let k = 0; k < studentPitchCurve.length - 1; k++) {
        const p1 = studentPitchCurve[k], p2 = studentPitchCurve[k + 1];
        if (Math.abs(p2.timeSec - p1.timeSec) > 0.08) continue;
        const stepIdx = Math.min(allSteps.length - 1, Math.max(0, Math.floor((p1.timeSec / totalDurationSec) * totalSteps)));
        const targetM = allSteps[stepIdx]?.active && allSteps[stepIdx].midiNumber > 0 ? allSteps[stepIdx].midiNumber : medianMidi;
        const m1 = foldStudentPitchToTargetOctave(p1.midiFloat, targetM);
        const m2 = foldStudentPitchToTargetOctave(p2.midiFloat, targetM);
        const errCents = Math.abs(m1 - targetM) * 100;
        ctx.strokeStyle = errCents <= 35 ? '#10b981' : errCents <= 70 ? '#f59e0b' : '#fb7185';
        const x1 = leftPad + (p1.timeSec / totalDurationSec) * plotW, y1 = (maxMidi - m1) * rowH + rowH / 2;
        const x2 = leftPad + (p2.timeSec / totalDurationSec) * plotW, y2 = (maxMidi - m2) * rowH + rowH / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }

    // 6. Curseur de lecture
    const playSec = getPlayheadSec();
    if (playSec > 0 && totalDurationSec > 0) {
      const xp = leftPad + Math.min(1, playSec / totalDurationSec) * plotW;
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, height); ctx.stroke();
    }
    ctx.restore();
  }, [allSteps, mestrePitchCurve, studentPitchCurve, totalDurationSec, beatsPerMeasure, hasAnacrusis, minMidi, maxMidi, minTarget, maxTarget, medianMidi, getPlayheadSec]);

  useEffect(() => {
    drawFrame();
    if (!isPlaying) return;
    const loop = () => { drawFrame(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, drawFrame]);

  return (
    <div className="w-full h-56 cordel-card rounded overflow-hidden relative select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
