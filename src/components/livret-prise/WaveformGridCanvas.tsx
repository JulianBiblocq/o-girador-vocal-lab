import React, { useEffect, useRef } from 'react';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { useLanguage } from '../../i18n/LanguageContext';

interface WaveformGridCanvasProps {
  width: number; height: number; totalDurationSec: number; anacrusisDurationSec?: number;
  t1OffsetSec?: number; hasAnacrusis?: boolean; bpm?: number; measuresCount: number;
  beatsPerMeasure: number; beatResolutions: number[];
}

export const WaveformGridCanvas: React.FC<WaveformGridCanvasProps> = ({
  width, height, totalDurationSec, anacrusisDurationSec, t1OffsetSec,
  hasAnacrusis = true, bpm, measuresCount, beatsPerMeasure, beatResolutions,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeTick, setThemeTick] = React.useState(0);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const beatDuration = bpm ? 60 / bpm : (beatsPerMeasure > 0 ? (anacrusisDurationSec || 2) / beatsPerMeasure : 0.6);
    const measureDurationSec = beatsPerMeasure * beatDuration;
    const t1Offset = t1OffsetSec ?? getPatternT1OffsetSec(hasAnacrusis, measureDurationSec);
    const xTemps1 = (t1Offset / totalDurationSec) * width;
    const hasAnac = hasAnacrusis !== false;

    if (hasAnac && xTemps1 > 0) {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, xTemps1, height);
      ctx.strokeStyle = isLight ? 'rgba(26, 26, 26, 0.08)' : 'rgba(244, 236, 216, 0.05)';
      ctx.lineWidth = 1;
      for (let x = -height; x < xTemps1; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, height); ctx.lineTo(x + height, 0); ctx.stroke();
      }
    }

    const startM = hasAnac ? -1 : 0;
    for (let m = startM; m < measuresCount; m++) {
      const mBaseSec = m === -1 ? (t1Offset - measureDurationSec) : (t1Offset + m * measureDurationSec);
      for (let bm = 0; bm < beatsPerMeasure; bm++) {
        const tm = mBaseSec + bm * beatDuration;
        const x = (tm / totalDurationSec) * width;
        const isMeasureStart = bm === 0;

        ctx.strokeStyle = isMeasureStart
          ? (isLight ? 'rgba(26, 26, 26, 0.35)' : 'rgba(244, 236, 216, 0.35)')
          : (isLight ? 'rgba(26, 26, 26, 0.15)' : 'rgba(244, 236, 216, 0.15)');
        ctx.lineWidth = isMeasureStart ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, height); ctx.stroke();

        const resolution = beatResolutions[bm] || 4, subStepDuration = beatDuration / resolution;
        ctx.strokeStyle = isLight ? 'rgba(26, 26, 26, 0.08)' : 'rgba(244, 236, 216, 0.05)';
        ctx.lineWidth = 0.5;
        for (let s = 1; s < resolution; s++) {
          const subX = ((tm + s * subStepDuration) / totalDurationSec) * width;
          ctx.beginPath(); ctx.moveTo(subX, 22); ctx.lineTo(subX, height); ctx.stroke();
        }
      }
    }

    const tNextT1 = t1Offset + measuresCount * measureDurationSec;
    if (tNextT1 < totalDurationSec) {
      const xNext = (tNextT1 / totalDurationSec) * width;
      ctx.strokeStyle = isLight ? 'rgba(26, 26, 26, 0.35)' : 'rgba(244, 236, 216, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xNext, 16); ctx.lineTo(xNext, height); ctx.stroke();

      const res0 = beatResolutions[0] || 4, subStepDur = beatDuration / res0;
      ctx.strokeStyle = isLight ? 'rgba(26, 26, 26, 0.08)' : 'rgba(244, 236, 216, 0.05)';
      ctx.lineWidth = 0.5;
      for (let s = 1; s < res0; s++) {
        const subX = ((tNextT1 + s * subStepDur) / totalDurationSec) * width;
        if (subX < width) {
          ctx.beginPath(); ctx.moveTo(subX, 22); ctx.lineTo(subX, height); ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = isLight ? '#9a3412' : '#d4af37'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(xTemps1, 0); ctx.lineTo(xTemps1, height); ctx.stroke();

    ctx.font = 'bold 10px monospace';
    if (hasAnac) {
      ctx.fillStyle = isLight ? '#451a03' : 'rgba(244, 236, 216, 0.85)';
      ctx.fillText(t('chordGridElanLabel'), 6, 13);
    }
    const m1Txt = `${t('measure1')} ▶`;
    const m1W = ctx.measureText(m1Txt).width + 10;
    ctx.fillStyle = '#9a3412';
    ctx.beginPath(); ctx.roundRect(xTemps1 + 3, 2, m1W, 15, 3); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m1Txt, xTemps1 + 8, 13);

    for (let m = 1; m < measuresCount; m++) {
      const mStartSec = t1Offset + m * measureDurationSec;
      const mX = (mStartSec / totalDurationSec) * width;
      ctx.fillStyle = isLight ? '#1a1a1a' : 'rgba(244, 236, 216, 0.85)';
      ctx.fillText(`M${m + 1}`, mX + 4, 13);
    }

    if (tNextT1 < totalDurationSec) {
      const xNext = (tNextT1 / totalDurationSec) * width;
      ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
      ctx.fillText('+T1', xNext + 4, 12);
    }
  }, [width, height, totalDurationSec, anacrusisDurationSec, t1OffsetSec, hasAnacrusis, bpm, measuresCount, beatsPerMeasure, beatResolutions, themeTick, t]);

  return (
    <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} className="absolute inset-0 pointer-events-none" />
  );
};
