/**
 * unifiedPitchDialDrawer.ts
 * Rendu vectoriel Canvas 60 FPS du Cadran Cherche-Notes Unifié :
 * Double échelle (±12 demi-tons externe comprimé + loupe centrale ±45 cents), couleurs Autoroute Mélodique
 * (Émeraude <=35c, Ambre <=70c, Corail >70c), flèches vectorielles, anneau 0..100 % et chrono 00.0 s (< 120 lignes).
 */
export interface UnifiedPitchDialLiveState {
  isVoiced: boolean; isFrozen?: boolean; centsDelta: number;
  primaryNoteLabel: string; secondaryLabel?: string;
  holdProgress01: number; enduranceSec?: number | null; arrowPlanted?: boolean;
}

export interface DialStaticLabels {
  up: string; down: string; hold: string; sing: string;
}

export function mapCentsToDualScaleUnit(centsDelta: number): number {
  const absC = Math.abs(centsDelta), sign = centsDelta < 0 ? -1 : 1;
  if (absC <= 45) return (centsDelta / 45) * 0.52;
  return sign * (0.52 + 0.48 * Math.min(1, (absC - 45) / 1155));
}

export function resolvePitchZoneColor(absCents: number, isVoiced: boolean): string {
  if (!isVoiced) return '#94a3b8';
  if (absCents <= 35) return '#10b981';
  if (absCents <= 70) return '#f59e0b';
  return '#ef4444';
}

export function drawUnifiedPitchDial(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  state: UnifiedPitchDialLiveState, labels: DialStaticLabels, isLight: boolean
): void {
  ctx.clearRect(0, 0, w, h);
  if (w < 40 || h < 40) return;

  const cx = w / 2, cy = Math.round(h * 0.58), outerR = Math.max(36, Math.min(w * 0.43, h * 0.50));
  const innerHubR = Math.max(24, outerR * 0.50), startDeg = -132, sweepDeg = 264;
  const degToRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const ink = isLight ? '#2c1e16' : '#f4ecd8', muted = isLight ? 'rgba(44,30,22,0.42)' : 'rgba(244,236,216,0.42)';

  ctx.lineCap = 'round';
  ctx.strokeStyle = isLight ? 'rgba(44,30,22,0.10)' : 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, outerR, degToRad(startDeg), degToRad(startDeg + sweepDeg)); ctx.stroke();

  const greenU = (35 / 45) * 0.52;
  ctx.strokeStyle = isLight ? 'rgba(16,185,129,0.32)' : 'rgba(16,185,129,0.38)';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(cx, cy, outerR, degToRad(-greenU * 132), degToRad(greenU * 132)); ctx.stroke();

  const ticks = [
    { cents: -1200, text: '-12st' }, { cents: -600, text: '-6st' }, { cents: -45, text: '-45c', major: true },
    { cents: 0, text: '0', major: true }, { cents: 45, text: '+45c', major: true }, { cents: 600, text: '+6st' }, { cents: 1200, text: '+12st' },
  ];
  ctx.font = 'bold 9.5px monospace'; ctx.textAlign = 'center';
  for (const tk of ticks) {
    const a = degToRad(mapCentsToDualScaleUnit(tk.cents) * 132), r0 = outerR - (tk.major ? 9 : 6), r1 = outerR + (tk.major ? 7 : 4), rl = outerR + 16;
    ctx.strokeStyle = tk.cents === 0 ? '#10b981' : muted; ctx.lineWidth = tk.major ? 2 : 1.2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    ctx.fillStyle = tk.cents === 0 ? '#10b981' : muted; ctx.fillText(tk.text, cx + Math.cos(a) * rl, cy + Math.sin(a) * rl + 3);
  }

  const absC = Math.abs(state.centsDelta), zoneColor = resolvePitchZoneColor(absC, state.isVoiced);
  const needleRad = degToRad((state.isVoiced ? mapCentsToDualScaleUnit(state.centsDelta) : 0) * 132);
  if (state.isVoiced) {
    ctx.strokeStyle = zoneColor; ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(needleRad) * (innerHubR + 4), cy + Math.sin(needleRad) * (innerHubR + 4));
    ctx.lineTo(cx + Math.cos(needleRad) * (outerR + 2), cy + Math.sin(needleRad) * (outerR + 2));
    ctx.stroke();
    ctx.fillStyle = zoneColor;
    ctx.beginPath(); ctx.arc(cx + Math.cos(needleRad) * outerR, cy + Math.sin(needleRad) * outerR, 5.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = isLight ? '#fbf6ea' : '#1c1613'; ctx.strokeStyle = state.isVoiced ? zoneColor : muted; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, innerHubR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  const prog = Math.max(0, Math.min(1, state.holdProgress01));
  if (prog > 0.01) {
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(cx, cy, innerHubR + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = ink;
  if (state.enduranceSec != null) {
    ctx.font = `900 ${Math.round(innerHubR * 0.52)}px monospace`;
    ctx.fillText(`${state.enduranceSec.toFixed(1)} s`, cx, cy + 2);
    if (state.primaryNoteLabel) { ctx.font = 'bold 11px monospace'; ctx.fillStyle = zoneColor; ctx.fillText(state.primaryNoteLabel, cx, cy + innerHubR * 0.52); }
  } else {
    ctx.font = `900 ${Math.round(innerHubR * 0.62)}px monospace`;
    ctx.fillText(state.primaryNoteLabel || '—', cx, cy + (state.secondaryLabel ? 0 : 7));
    if (state.secondaryLabel) { ctx.font = 'bold 11px monospace'; ctx.fillStyle = muted; ctx.fillText(state.secondaryLabel, cx, cy + innerHubR * 0.46); }
  }

  const dirY = Math.min(h - 10, cy + innerHubR + 24);
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = state.isVoiced ? zoneColor : muted;
  const dirText = !state.isVoiced ? labels.sing
    : absC <= 35 ? `${labels.hold} (${state.centsDelta >= 0 ? '+' : ''}${Math.round(state.centsDelta)}c)`
    : state.centsDelta < 0 ? `▲ ${labels.up} (${Math.round(state.centsDelta)}c)` : `▼ ${labels.down} (+${Math.round(state.centsDelta)}c)`;
  ctx.fillText(dirText, cx, dirY);
}
