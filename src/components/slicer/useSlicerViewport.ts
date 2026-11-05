/**
 * useSlicerViewport.ts
 * Hook de gestion du Zoom horizontal (1x..12x), défilement panoramique, auto-centrage et conversions timeSec <-> canvasX (< 90 lignes).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type { SliceSegment } from '../../types/slicerSegments.types';

export const SLICER_ZOOM_PRESETS = [1, 2, 4, 8, 12] as const;

export interface UseSlicerViewportParams {
  durationSec: number; segments: SliceSegment[]; selectedSegmentId: string | null; playheadSec: number;
}

export function formatSlicerDragTooltip(mode: string, sec: number, bpm: number, gridOffsetSec: number): string {
  const beatDur = 60 / Math.max(30, bpm || 88);
  const totalBeats = Math.round((sec - gridOffsetSec) / beatDur);
  const mIdx = Math.floor(totalBeats / 4) + 1, bIdx = (((totalBeats % 4) + 4) % 4) + 1;
  const diff = sec - (gridOffsetSec + totalBeats * beatDur);
  const prefix = mode === 'joint' ? 'Coupe •' : mode === 'start' ? 'Début' : mode === 'end' ? 'Fin' : mode === 'grid' ? 'Grille T1' : 'Tranche';
  return `${prefix} : ${sec.toFixed(2)}s (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}s / M${mIdx}•T${bIdx})`;
}

export function useSlicerViewport({ durationSec, segments, selectedSegmentId, playheadSec }: UseSlicerViewportParams) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollStartSec, setScrollStartSec] = useState<number>(0);
  const isInteractingRef = useRef(false);

  const visibleDurationSec = durationSec > 0 ? durationSec / zoomLevel : 0;
  const maxScrollSec = Math.max(0, durationSec - visibleDurationSec);

  const clampScroll = useCallback((start: number, visDur = visibleDurationSec) => {
    return Math.max(0, Math.min(Math.max(0, durationSec - visDur), start));
  }, [durationSec, visibleDurationSec]);

  const setZoomWithAnchor = useCallback((nextZoomRaw: number, anchorRatio = 0.5, explicitAnchorSec?: number) => {
    if (durationSec <= 0) return;
    const nextZoom = Math.max(1, Math.min(12, Math.round(nextZoomRaw * 100) / 100));
    const curVis = durationSec / zoomLevel;
    const anchorSec = explicitAnchorSec ?? (scrollStartSec + anchorRatio * curVis);
    const nextVis = durationSec / nextZoom;
    const nextStart = Math.max(0, Math.min(Math.max(0, durationSec - nextVis), anchorSec - anchorRatio * nextVis));
    setZoomLevel(nextZoom);
    setScrollStartSec(nextStart);
  }, [durationSec, zoomLevel, scrollStartSec]);

  const panBySec = useCallback((deltaSec: number) => {
    setScrollStartSec((prev) => clampScroll(prev + deltaSec));
  }, [clampScroll]);

  const centerOnSec = useCallback((targetSec: number) => {
    if (zoomLevel <= 1 || durationSec <= 0) return;
    setScrollStartSec(clampScroll(targetSec - visibleDurationSec / 2));
  }, [zoomLevel, durationSec, visibleDurationSec, clampScroll]);

  // Auto-centrage sur la tranche sélectionnée depuis la liste
  useEffect(() => {
    if (!selectedSegmentId || zoomLevel <= 1 || isInteractingRef.current) return;
    const seg = segments.find((s) => s.id === selectedSegmentId);
    if (!seg) return;
    const focusSec = (seg.startSec + seg.endSec) / 2;
    if (focusSec < scrollStartSec + visibleDurationSec * 0.1 || focusSec > scrollStartSec + visibleDurationSec * 0.9) {
      setScrollStartSec(clampScroll(focusSec - visibleDurationSec / 2));
    }
  }, [selectedSegmentId, zoomLevel, segments, scrollStartSec, visibleDurationSec, clampScroll]);

  // Suivi automatique de la tête de lecture pendant l'écoute
  useEffect(() => {
    if (playheadSec < 0 || zoomLevel <= 1 || isInteractingRef.current) return;
    if (playheadSec > scrollStartSec + visibleDurationSec * 0.88 || playheadSec < scrollStartSec) {
      setScrollStartSec(clampScroll(playheadSec - visibleDurationSec * 0.15));
    }
  }, [playheadSec, zoomLevel, scrollStartSec, visibleDurationSec, clampScroll]);

  const secToX = useCallback((sec: number, width: number) => (visibleDurationSec > 0 ? ((sec - scrollStartSec) / visibleDurationSec) * width : 0), [scrollStartSec, visibleDurationSec]);
  const xToSec = useCallback((x: number, width: number) => scrollStartSec + (width > 0 ? (x / width) * visibleDurationSec : 0), [scrollStartSec, visibleDurationSec]);
  const getSecPerPixel = useCallback((width: number) => (width > 0 ? visibleDurationSec / width : 0), [visibleDurationSec]);

  return {
    zoomLevel, scrollStartSec, visibleDurationSec, maxScrollSec, isInteractingRef,
    setScrollStartSec: (s: number) => setScrollStartSec(clampScroll(s)),
    setZoomWithAnchor, panBySec, centerOnSec, secToX, xToSec, getSecPerPixel,
  };
}
