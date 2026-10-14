/**
 * useWaveformZoom.ts
 * Hook de gestion du zoom horizontal (1x a 8x), centrage sur timestamp et support Ctrl+Molette.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

export function useWaveformZoom(initialZoom = 1.0) {
  const [zoomLevel, setZoomLevel] = useState<number>(initialZoom);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<number>(initialZoom);
  zoomRef.current = zoomLevel;

  const setZoom = useCallback((level: number) => {
    const clamped = Math.min(8.0, Math.max(1.0, Math.round(level * 10) / 10));
    setZoomLevel(clamped);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(8.0, prev < 2 ? 2 : prev < 4 ? 4 : Math.min(8, prev + 2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(1.0, prev > 4 ? 4 : prev > 2 ? 2 : 1));
  }, []);

  const scrollToSec = useCallback((timeSec: number, totalDurationSec: number, containerWidth: number) => {
    const container = scrollContainerRef.current;
    if (!container || totalDurationSec <= 0) return;
    const zoomedWidth = containerWidth * zoomRef.current;
    const targetX = (timeSec / totalDurationSec) * zoomedWidth;
    const scrollLeft = Math.max(0, targetX - container.clientWidth / 2);
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, []);

  // Support non-passif de Ctrl + Molette centre sur le curseur
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentZoom = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.min(8.0, Math.max(1.0, Math.round(currentZoom * factor * 10) / 10));
      if (newZoom === currentZoom) return;

      const contentX = container.scrollLeft + mouseX;
      const newContentX = contentX * (newZoom / currentZoom);
      const targetScroll = Math.max(0, newContentX - mouseX);

      setZoomLevel(newZoom);
      requestAnimationFrame(() => { container.scrollLeft = targetScroll; });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  return { zoomLevel, setZoom, zoomIn, zoomOut, scrollToSec, scrollContainerRef };
}
