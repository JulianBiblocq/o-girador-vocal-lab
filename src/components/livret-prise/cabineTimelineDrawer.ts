/**
 * cabineTimelineDrawer.ts
 * Construction et rendu Canvas 60 FPS bilingue (FR / PT-BR) du Ruban des Mesures à Bille Rebondissante (< 120 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import { resolvePatternAnacrusisBeats } from '../../utils/anacrusisTimingHelper';
import { buildConductorRoleTimeline } from '../../utils/conductorRoleTimelineBuilder';
import { CONTINUOUS_LEAD_IN_MEASURES } from '../../audio/continuousCueHelper';
import { CABINE_WAVE_BINS_PER_BEAT, patternHasAnyAudio, extractMeasureWaveform, drawMeasureWaveformsOnBox } from './cabineWaveformHelper';

export { CABINE_WAVE_BINS_PER_BEAT, patternHasAnyAudio, extractMeasureWaveform };

export interface TimelineMeasureBox {
  measureIndex: number; label: string; subLabel?: string; kind: 'preroll' | 'cue' | 'sung' | 'tail';
  role?: VocalRole; beatsCount: number; startBeatGlobal: number;
  anacrusisStartBeatInMeasure?: number; callInBeatsInMeasure: number[]; measureLyrics?: string;
  waveformBins?: Float32Array; anacrusisWaveformBins?: Float32Array;
}

export function buildCabineTimelineMeasures(params: {
  takeMode: 'pattern' | 'puxador' | 'coro'; project: ToadaProject; activePattern: VocalPatternItem;
  cuePattern: VocalPatternItem | null; beatsPerMeasure: number; isPunchIn?: boolean; counterRoleCueEnabled?: boolean; lang?: 'fr' | 'br';
}) {
  const { takeMode, project, activePattern, cuePattern, beatsPerMeasure: B, isPunchIn = false, counterRoleCueEnabled = true, lang = 'fr' } = params;
  const isBr = lang === 'br', mPfx = isBr ? 'C' : 'M', preLbl = isBr ? 'PRÉ-CONTAGEM' : 'PRÉCOMPTE', cueLbl = isBr ? 'GUIA C' : 'TÉMOIN M';
  const measures: TimelineMeasureBox[] = [], callSet = new Set<number>(), anaSet = new Set<number>(), recSet = new Set<number>(), beatRange = Array.from({ length: B }, (_, i) => i + 1);
  if (takeMode === 'pattern') {
    const hasCue = !isPunchIn && patternHasAnyAudio(cuePattern);
    const hasAna = !isPunchIn && activePattern.hasAnacrusis !== false, preRoll = isPunchIn ? 1 : (hasCue && cuePattern ? 1 + cuePattern.measuresCount : (hasAna ? 2 : 1));
    const t1B = preRoll * B, anaB = hasAna ? resolvePatternAnacrusisBeats(activePattern, B) : 0, entryB = Math.max(0, t1B - anaB), endB = (preRoll + activePattern.measuresCount) * B;
    if (entryB - 2 >= 0) callSet.add(entryB - 2); if (entryB - 1 >= 0) callSet.add(entryB - 1);
    for (let b = entryB; b < t1B; b++) anaSet.add(b); for (let b = entryB; b <= endB; b++) recSet.add(b);
    for (let m = 0; m < preRoll; m++) {
      const sb = m * B, isCueM = Boolean(hasCue && cuePattern && m >= 1 && m <= cuePattern.measuresCount), isAnaM = m === preRoll - 1 && anaB > 0;
      measures.push({ measureIndex: m, label: isCueM ? `${cueLbl}${m}` : preLbl, subLabel: isCueM ? cuePattern?.name : undefined, kind: isCueM ? 'cue' : 'preroll', role: isCueM ? cuePattern?.role : undefined, beatsCount: B, startBeatGlobal: sb, anacrusisStartBeatInMeasure: isAnaM ? B - anaB + 1 : undefined, callInBeatsInMeasure: beatRange.filter((b) => callSet.has(sb + b - 1)), measureLyrics: isCueM ? (cuePattern?.assignedLyricsText || cuePattern?.rawLineCode || '').replace(/\[[^\]]+\]/g, '').trim() : undefined, waveformBins: isCueM ? extractMeasureWaveform(cuePattern, m, B) : undefined, anacrusisWaveformBins: isAnaM ? extractMeasureWaveform(activePattern, 0, B) : undefined });
    }
    const lyr = (activePattern.assignedLyricsText || activePattern.rawLineCode || '').replace(/\[[^\]]+\]/g, '').trim();
    for (let m = 1; m <= activePattern.measuresCount; m++) measures.push({ measureIndex: preRoll + m - 1, label: `${mPfx}${m}`, subLabel: activePattern.name, kind: 'sung', role: activePattern.role, beatsCount: B, startBeatGlobal: (preRoll + m - 1) * B, callInBeatsInMeasure: [], measureLyrics: m === 1 ? lyr : undefined, waveformBins: extractMeasureWaveform(activePattern, m, B) });
    measures.push({ measureIndex: measures.length, label: '+T1', kind: 'tail', role: activePattern.role, beatsCount: 1, startBeatGlobal: endB, callInBeatsInMeasure: [], waveformBins: extractMeasureWaveform(activePattern, activePattern.measuresCount + 1, B, 8, 1 / B) });
  } else {
    const timeline = buildConductorRoleTimeline(project, takeMode, 0, CONTINUOUS_LEAD_IN_MEASURES), counterRole: VocalRole = takeMode === 'puxador' ? 'coro' : 'puxador';
    timeline.forEach((it, idx) => {
      if (it.isRoleGap) return;
      const t1B = ((CONTINUOUS_LEAD_IN_MEASURES - 1) + it.startMeasure) * B, anaB = it.hasAnacrusis ? Math.max(1, Math.min(B, it.anacrusisBeats || 2)) : 0, entryB = Math.max(0, t1B - anaB), endB = t1B + it.measuresCount * B;
      if (idx === 0 || timeline[idx - 1].isRoleGap) { if (entryB - 2 >= 0) callSet.add(entryB - 2); if (entryB - 1 >= 0) callSet.add(entryB - 1); }
      for (let b = entryB; b < t1B; b++) anaSet.add(b); for (let b = entryB; b <= endB; b++) recSet.add(b);
    });
    for (let m = 0; m < CONTINUOUS_LEAD_IN_MEASURES; m++) {
      const sb = m * B;
      measures.push({ measureIndex: m, label: preLbl, kind: 'preroll', beatsCount: B, startBeatGlobal: sb, anacrusisStartBeatInMeasure: beatRange.find((b) => anaSet.has(sb + b - 1)), callInBeatsInMeasure: beatRange.filter((b) => callSet.has(sb + b - 1)) });
    }
    timeline.forEach((it) => {
      const slot = project.slots[it.slotIndex], patId = it.isRoleGap ? (counterRole === 'puxador' ? slot?.puxadorPatternId : slot?.coroPatternId) : it.patternId, pat = project.patterns.find((p) => p.id === patId);
      for (let k = 0; k < it.measuresCount; k++) {
        const mIdx = (CONTINUOUS_LEAD_IN_MEASURES - 1) + it.startMeasure + k, sb = mIdx * B;
        measures.push({ measureIndex: mIdx, label: it.isRoleGap ? `[${mPfx}${it.startMeasure + k}]` : `${mPfx}${it.startMeasure + k}`, subLabel: pat?.name || (it.isRoleGap ? counterRole.toUpperCase() : takeMode.toUpperCase()), kind: it.isRoleGap ? 'cue' : 'sung', role: it.isRoleGap ? counterRole : takeMode, beatsCount: B, startBeatGlobal: sb, anacrusisStartBeatInMeasure: beatRange.find((b) => anaSet.has(sb + b - 1)), callInBeatsInMeasure: beatRange.filter((b) => callSet.has(sb + b - 1)), measureLyrics: k === 0 ? (it.isRoleGap ? it.counterRoleLyrics : it.lyrics) : undefined, waveformBins: (!it.isRoleGap || counterRoleCueEnabled) ? extractMeasureWaveform(pat, k + 1, B) : undefined });
      }
    });
    measures.push({ measureIndex: measures.length, label: '+T1', kind: 'tail', role: takeMode, beatsCount: 1, startBeatGlobal: measures.length * B, callInBeatsInMeasure: [] });
  }
  return { measures, isRecordingBeat: (b: number) => recSet.has(b), isCallInBeat: (b: number) => callSet.has(b), isAnacrusisBeat: (b: number) => anaSet.has(b) };
}

export function drawCabineTimelineRibbon(
  ctx: CanvasRenderingContext2D, w: number, h: number, measures: TimelineMeasureBox[],
  curBeat: number, beatProg: number, isActive: boolean, isSliding4: boolean,
  lang: 'fr' | 'br' = 'fr', livePeakBins?: Float32Array | null
): void {
  ctx.clearRect(0, 0, w, h);
  const curMIdx = Math.max(0, measures.findIndex((m) => curBeat >= m.startBeatGlobal && curBeat < m.startBeatGlobal + m.beatsCount));
  const winStart = isSliding4 && measures.length > 4 ? Math.max(0, Math.min(measures.length - 4, curMIdx - 1)) : 0;
  const vis = isSliding4 && measures.length > 4 ? measures.slice(winStart, winStart + 4) : measures;
  const padX = 8, gap = 6, topY = 18, boxH = h - 26, floorY = topY + boxH - 22, midY = topY + boxH * 0.50;
  const totalWeight = vis.reduce((s, m) => s + Math.max(1.15, m.beatsCount), 0), availW = Math.max(100, w - padX * 2 - gap * (vis.length - 1));
  const beatCenters = new Map<number, { x: number; y: number }>(), maxLiveBin = isActive ? Math.floor((curBeat + beatProg) * CABINE_WAVE_BINS_PER_BEAT) : -1;
  let xCursor = padX;

  for (const m of vis) {
    const mw = (availW * Math.max(1.15, m.beatsCount)) / totalWeight, isRolePux = m.role === 'puxador', roleHex = isRolePux ? '#9a3412' : '#0f766e';
    ctx.fillStyle = m.kind === 'preroll' ? 'rgba(30,41,59,0.85)' : m.kind === 'cue' ? (isRolePux ? 'rgba(154,52,18,0.28)' : 'rgba(15,118,110,0.28)') : (isRolePux ? 'rgba(154,52,18,0.72)' : 'rgba(15,118,110,0.72)');
    ctx.strokeStyle = m.kind === 'preroll' ? '#475569' : roleHex; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(xCursor, topY, mw, boxH, 6); ctx.fill(); ctx.stroke();

    drawMeasureWaveformsOnBox(ctx, xCursor, mw, midY, boxH, m.kind, m.beatsCount, m.startBeatGlobal, m.waveformBins, m.anacrusisWaveformBins, m.anacrusisStartBeatInMeasure, livePeakBins, maxLiveBin);

    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 10px monospace';
    ctx.fillText(`${m.label}${m.subLabel ? ` • ${m.subLabel.slice(0, 12)}` : ''}`, xCursor + 5, topY + 12);

    const cellW = mw / m.beatsCount;
    for (let b = 1; b <= m.beatsCount; b++) {
      const gb = m.startBeatGlobal + b - 1, cx = xCursor + (b - 0.5) * cellW, isHit = isActive && curBeat === gb, isCall = m.callInBeatsInMeasure.includes(b);
      beatCenters.set(gb, { x: cx, y: floorY });
      if (b > 1) { ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(xCursor + (b - 1) * cellW, topY + 16); ctx.lineTo(xCursor + (b - 1) * cellW, topY + boxH - 16); ctx.stroke(); }
      if (isHit || isCall) { ctx.fillStyle = isCall ? (isHit ? 'rgba(250,204,21,0.55)' : 'rgba(250,204,21,0.22)') : 'rgba(251,146,60,0.42)'; ctx.fillRect(xCursor + (b - 1) * cellW + 2, topY + 17, cellW - 4, boxH - 34); }
      ctx.fillStyle = isCall ? '#fde047' : isHit ? '#ffffff' : 'rgba(248,250,252,0.75)'; ctx.font = isHit || isCall ? 'bold 12px monospace' : '11px monospace';
      const lbl = m.kind === 'tail' ? '+1' : `${isCall ? '•' : ''}${b}`;
      ctx.fillText(lbl, cx - ctx.measureText(lbl).width / 2, floorY + 4);
    }
    if (m.anacrusisStartBeatInMeasure) {
      const ax = xCursor + (m.anacrusisStartBeatInMeasure - 1) * cellW, aw = mw - (m.anacrusisStartBeatInMeasure - 1) * cellW;
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2.2; ctx.strokeRect(ax + 1, topY + 1, aw - 2, boxH - 2);
      ctx.fillStyle = '#facc15'; ctx.font = 'bold 9px monospace'; ctx.fillText(lang === 'br' ? 'ANACRUSE' : 'ANACROUSE', ax + 3, topY - 4);
    }
    if (m.measureLyrics) { ctx.fillStyle = '#fde68a'; ctx.font = '10px sans-serif'; ctx.fillText(m.measureLyrics.slice(0, Math.max(8, Math.floor(mw / 6.5))), xCursor + 5, topY + boxH - 5); }
    xCursor += mw + gap;
  }

  const p0 = beatCenters.get(curBeat), p1 = beatCenters.get(curBeat + 1) ?? p0;
  if (p0 && p1) {
    const prog = isActive ? beatProg : 0, bx = p0.x + (p1.x - p0.x) * prog, arcH = 34, by = p0.y - 12 - arcH * 4 * prog * (1 - prog);
    if (isActive && p1.x > p0.x) { ctx.strokeStyle = 'rgba(253,224,71,0.45)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(p0.x, p0.y - 12); ctx.quadraticCurveTo((p0.x + p1.x) / 2, p0.y - 12 - arcH * 1.35, p1.x, p1.y - 12); ctx.stroke(); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(bx, by, isActive && (prog < 0.16 || prog > 0.86) ? 9.5 : 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
  }
}
