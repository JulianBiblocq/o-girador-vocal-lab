/**
 * pianoRollRulerDrawer.ts
 * Rendu Canvas 2D de la règle temporelle supérieure (42 px : Mesures / Temps + indicateurs).
 */
export const RULER_HEIGHT = 42;

export interface DrawRulerOptions {
  width: number;
  height: number;
  dpr: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  playheadSec: number;
  isPlaying: boolean;
  isPt?: boolean;
}

export function drawRulerBar(ctx: CanvasRenderingContext2D, opts: DrawRulerOptions): void {
  const { width, height, dpr, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, playheadSec, isPlaying, isPt } = opts;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const beatDur = beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6;
  const totalBeats = Math.round(totalDurationSec / beatDur);

  ctx.fillStyle = 'rgba(18, 16, 15, 0.96)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(245, 240, 230, 0.15)';
  ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(width, 21); ctx.stroke();
  ctx.strokeStyle = 'rgba(245, 240, 230, 0.25)';
  ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(width, height); ctx.stroke();

  for (let b = 0; b < totalBeats; b++) {
    const x = ((b * beatDur) / totalDurationSec) * width;
    const m = Math.floor(b / beatsPerMeasure);
    const bm = b % beatsPerMeasure;
    const isT1 = b === beatsPerMeasure;

    if (bm === 0) {
      ctx.lineWidth = isT1 ? 2.5 : 1.5;
      ctx.strokeStyle = isT1 ? '#d4af37' : 'rgba(245, 240, 230, 0.45)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();

      ctx.font = isT1 ? 'bold 10px monospace' : 'bold 9.5px monospace';
      ctx.fillStyle = isT1 ? '#d4af37' : m === 0 ? '#fbbf24' : 'rgba(245, 240, 230, 0.85)';
      const elanLabel = isPt ? 'IMPULSO (M-1)' : 'ÉLAN (M-1)';
      const m1Label = isPt ? '★ C1' : '★ M1';
      const mLabel = isPt ? `C${m}` : `M${m}`;
      ctx.fillText(m === 0 ? elanLabel : isT1 ? m1Label : mLabel, x + 6, 14.5);
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(245, 240, 230, 0.22)';
      ctx.beginPath(); ctx.moveTo(x, 21); ctx.lineTo(x, height); ctx.stroke();
    }

    ctx.font = isT1 ? 'bold 9.5px monospace' : '9px monospace';
    ctx.fillStyle = isT1 ? '#d4af37' : 'rgba(245, 240, 230, 0.65)';
    ctx.fillText(`T${bm + 1}`, x + 5, 34);
  }

  if (seekStartSec > 0 && (!isPlaying || playheadSec < 0)) {
    const xs = (seekStartSec / totalDurationSec) * width;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(xs - 5, 0); ctx.lineTo(xs + 5, 0); ctx.lineTo(xs, 9); ctx.fill();
  }
  if (isPlaying && playheadSec >= 0) {
    const xp = (playheadSec / totalDurationSec) * width;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(xp - 5, 0); ctx.lineTo(xp + 5, 0); ctx.lineTo(xp, 9); ctx.fill();
  }
  ctx.restore();
}
