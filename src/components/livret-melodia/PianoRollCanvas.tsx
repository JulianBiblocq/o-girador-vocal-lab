/**
 * PianoRollCanvas.tsx — Canvas interactif du Piano Roll avec « Smart Tool » façon Cubase VariAudio
 * (Cœur MIDI, ◆ VariAudio, ✂ Scission >= 44px, ↔ Tenue >= 44px, [Lier] ─── / Mélisme `_`, Ctrl+Z atomique) (< 138 lignes).
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { drawPianoRollGrid } from './pianoRollDrawer';
import { findBrickRange, moveBrick, glueBrickToNext, splitTieAtStep, eraseBrick, createSingleNote, setBrickMelodynePullPct, type PianoRollTool } from './pianoRollInteractions';
import { resizeBrickRightEdge } from './pianoRollBrickInteractions';
import { resolveSmartToolHoverZone, linkAdjacentBricksSmart, snapSingleBrickToGreenMedian, type SmartToolHoverState } from './pianoRollSmartTool';
import { getStepHorizontalBoundsPx, resolveStepIndexAtXPx } from '../../utils/tripletBeatHelper';
import { getToolCursorStyle } from '../../utils/toolCursors';

export interface PianoRollCanvasProps {
  width: number; height: number; minMidi: number; maxMidi: number; rowHeight: number; beatsPerMeasure: number; beatResolutions: number[];
  allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[]; rawPitchCurve?: PitchCurvePoint[]; totalDurationSec: number; anacrusisDurationSec: number;
  seekStartSec: number; isPlaying: boolean; activeTool: PianoRollTool; hasAnacrusis?: boolean; t1OffsetSec?: number; bpm?: number; selectedStepIdx?: number | null;
  getPlayheadSec?: () => number; onOpenContextMenu: (x: number, y: number) => void; onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  onPlayNotePreview: (midi: number) => void; onOpenTextInput: (stepIndex: number, rect: { x: number; y: number; w: number; h: number }) => void;
  onSelectStep?: (idx: number | null) => void; onBrickMoved?: (rootIdx: number, newSteps: VocalStepData[]) => void;
  harmonyGrid?: PatternHarmonyGrid; pitchShiftSemitones?: number; allowedPitchClasses?: Set<number> | null; tonic?: string; rootPitchClass?: number | null; readOnly?: boolean; foldNotesView?: boolean;
}
export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (p) => {
  const canvasRef = useRef<HTMLCanvasElement>(null), dragRef = useRef<any>(null), smartHoverRef = useRef<SmartToolHoverState | null>(null);
  const [themeTick, setThemeTick] = useState(0), [hoveredBrickRootIdx, setHoveredBrickRootIdx] = useState<number | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => obs.disconnect();
  }, []);
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || p.width <= 0 || p.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== p.width * dpr || canvas.height !== p.height * dpr) { canvas.width = p.width * dpr; canvas.height = p.height * dpr; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const smartHover = p.activeTool === 'pointer' && !p.readOnly ? smartHoverRef.current : null;
    drawPianoRollGrid(ctx, { ...p, dpr, hoveredBrickRootIdx, smartHover, playheadSec: p.isPlaying && p.getPlayheadSec ? p.getPlayheadSec() : -1 });
  }, [p, themeTick, hoveredBrickRootIdx]);
  useEffect(() => {
    draw(); if (!p.isPlaying) return;
    let animId = requestAnimationFrame(function tick() { draw(); animId = requestAnimationFrame(tick); }); return () => cancelAnimationFrame(animId);
  }, [p.isPlaying, draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(p.width - 1, e.clientX - rect.left)), y = Math.max(0, Math.min(p.height - 1, e.clientY - rect.top));
    const stepIdx = resolveStepIndexAtXPx(p.allSteps, x, p.width, p.beatResolutions?.[0] || 4);
    return { stepIdx, midi: p.maxMidi - Math.min(p.maxMidi - p.minMidi, Math.max(0, Math.floor(y / p.rowHeight))), x, y };
  };
  const resolveHover = (x: number, y: number, stepIdx: number) => resolveSmartToolHoverZone({ x, y, stepIdx, allSteps: p.allSteps, width: p.width, maxMidi: p.maxMidi, rowHeight: p.rowHeight, selectedStepIdx: p.selectedStepIdx, foldNotesView: p.foldNotesView });
  const triggerTextInput = (stepIdx: number) => {
    const range = findBrickRange(p.allSteps, stepIdx), targetIdx = range ? range.rootIndex : stepIdx;
    const bounds = getStepHorizontalBoundsPx(p.allSteps, targetIdx, p.width), step = p.allSteps[targetIdx];
    p.onOpenTextInput(targetIdx, { x: bounds.xPx, y: (p.maxMidi - (step?.midiNumber ?? p.minMidi)) * p.rowHeight, w: Math.max(24, bounds.widthPx), h: p.rowHeight });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x, y } = getCoords(e);
    if (e.button === 2) { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); return; }
    if (p.readOnly) { const s = p.allSteps[stepIdx]; if (s?.active && (s.midiNumber ?? 0) > 0) p.onPlayNotePreview(s.midiNumber ?? 60); return; }
    if (p.activeTool === 'erase') { p.onSelectStep?.(null); return p.onUpdateSteps(eraseBrick(p.allSteps, stepIdx), true); }
    if (p.activeTool === 'glue' || p.activeTool === 'paste') return p.onUpdateSteps(glueBrickToNext(p.allSteps, stepIdx), true);
    if (p.activeTool === 'cut' || p.activeTool === 'split') return p.onUpdateSteps(splitTieAtStep(p.allSteps, stepIdx), true);
    if (p.activeTool === 'text' || p.activeTool === 'lyric') return triggerTextInput(stepIdx);
    if (e.shiftKey && p.allSteps[stepIdx]?.active) { p.onUpdateSteps(glueBrickToNext(p.allSteps, stepIdx), true); return; }
    if (p.activeTool === 'draw_move' && !p.allSteps[stepIdx]?.active) {
      const targetMidi = p.foldNotesView ? 60 : midi;
      p.onSelectStep?.(stepIdx); p.onUpdateSteps(createSingleNote(p.allSteps, stepIdx, targetMidi), true);
      if (!p.foldNotesView) p.onPlayNotePreview(targetMidi);
      e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'resize', rootIdx: stepIdx, committed: true, changed: true }; return;
    }
    const hz = resolveHover(x, y, stepIdx);
    if (p.activeTool === 'pointer' && hz.zone === 'link_gap' && hz.linkCandidate) {
      const linked = linkAdjacentBricksSmart(p.allSteps, hz.linkCandidate.leftRootIndex, hz.linkCandidate.rightRootIndex);
      p.onUpdateSteps(linked, true); p.onBrickMoved?.(hz.linkCandidate.leftRootIndex, linked); return;
    }
    if (p.activeTool === 'pointer' && hz.zone === 'split_bottom' && hz.splitStepIndex !== null) {
      const split = splitTieAtStep(p.allSteps, hz.splitStepIndex);
      p.onSelectStep?.(hz.splitStepIndex); p.onUpdateSteps(split, true); p.onBrickMoved?.(hz.splitStepIndex, split); return;
    }
    if (hz.rootIndex === null) { p.onSelectStep?.(null); return; }
    p.onSelectStep?.(hz.rootIndex);
    const rootStep = p.allSteps[hz.rootIndex], rootMidi = rootStep.midiNumber ?? 60;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (hz.zone === 'variaudio_top') dragRef.current = { mode: 'variaudio_pull', rootIdx: hz.rootIndex, startY: e.clientY, startPull: rootStep.melodynePullPct ?? 0, committed: false, changed: false };
    else if (hz.zone === 'resize_right') dragRef.current = { mode: 'resize', rootIdx: hz.rootIndex, lastEnd: hz.endIndex, committed: false, changed: false };
    else if (!p.foldNotesView) { dragRef.current = { mode: 'move', rootIdx: hz.rootIndex, lastMidi: rootMidi, committed: false, changed: false }; p.onPlayNotePreview(rootMidi); }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x, y } = getCoords(e);
    if (!dragRef.current) {
      const hz = resolveHover(x, y, stepIdx);
      smartHoverRef.current = hz; setHoveredBrickRootIdx(hz.rootIndex);
      setHoverCursor(p.activeTool === 'pointer' && hz.zone !== 'empty' ? hz.cursor : null); draw(); return;
    }
    const d = dragRef.current;
    if (d.mode === 'variaudio_pull' && Math.abs(d.startY - e.clientY) >= 2) {
      const dy = d.startY - e.clientY, commitNow = !d.committed; d.committed = true; d.changed = true;
      p.onUpdateSteps(setBrickMelodynePullPct(p.allSteps, d.rootIdx, d.startPull + (d.startPull === 0 && dy < 0 ? Math.abs(dy) * 1.8 : dy * 1.8)), commitNow);
    } else if (d.mode === 'move' && midi !== d.lastMidi) {
      const commitNow = !d.committed; d.committed = true; d.lastMidi = midi; d.changed = true;
      p.onUpdateSteps(moveBrick(p.allSteps, d.rootIdx, midi), commitNow); p.onPlayNotePreview(midi);
    } else if (d.mode === 'resize' && stepIdx !== d.lastEnd) {
      const commitNow = !d.committed; d.committed = true; d.lastEnd = stepIdx; d.changed = true;
      p.onUpdateSteps(resizeBrickRightEdge(p.allSteps, d.rootIdx, stepIdx), commitNow);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const d = dragRef.current;
    if (d.mode === 'variaudio_pull' && !d.changed) {
      const nextSteps = setBrickMelodynePullPct(p.allSteps, d.rootIdx, d.startPull === 0 ? 80 : d.startPull < 100 ? 100 : 0);
      p.onUpdateSteps(nextSteps, true); p.onBrickMoved?.(d.rootIdx, nextSteps);
    } else if (d.changed) { p.onBrickMoved?.(d.rootIdx, p.allSteps); }
    dragRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
      onPointerLeave={() => { smartHoverRef.current = null; setHoveredBrickRootIdx(null); setHoverCursor(null); draw(); }}
      onDoubleClick={(e) => {
        if (p.readOnly) return;
        const { stepIdx, midi, x, y } = getCoords(e), hz = resolveHover(x, y, stepIdx);
        if (p.activeTool === 'pointer' && hz.zone === 'empty') { const m = p.foldNotesView ? 60 : midi; p.onSelectStep?.(stepIdx); p.onUpdateSteps(createSingleNote(p.allSteps, stepIdx, m), true); if (!p.foldNotesView) p.onPlayNotePreview(m); return; }
        if (p.activeTool === 'pointer' && hz.rootIndex !== null && !p.foldNotesView) { const s = snapSingleBrickToGreenMedian(p.allSteps, hz.rootIndex, p.rawPitchCurve?.length ? p.rawPitchCurve : p.pitchCurve, p.hasAnacrusis !== false ? 0 : (p.t1OffsetSec ?? 0.15), p.bpm ? 60 / p.bpm : 0.6, p.allowedPitchClasses); p.onUpdateSteps(s, true); p.onBrickMoved?.(hz.rootIndex, s); return; }
        triggerTextInput(stepIdx);
      }}
      style={{ width: `${p.width}px`, height: `${p.height}px`, cursor: p.readOnly ? 'default' : (hoverCursor ?? getToolCursorStyle(p.activeTool)) }}
      className="block select-none"
    />
  );
};
