/**
 * UnifiedPitchDialCanvas.tsx
 * Composant visuel Cordel unifié (5 usages) dessiné en <canvas> 60 FPS hors cycle React :
 * Piloté exclusivement par useRef / getter mutable (0 setState en RAF, ResizeObserver) (< 120 lignes).
 */
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  drawUnifiedPitchDial,
  type UnifiedPitchDialLiveState,
} from './unifiedPitchDialDrawer';

export type { UnifiedPitchDialLiveState };

export interface UnifiedPitchDialCanvasProps {
  /** Source temps réel lue à 60 FPS sans re-render React */
  liveStateRef: React.RefObject<UnifiedPitchDialLiveState>;
  /** Hauteur CSS du cadran (défaut 188 px, lisible de loin sur téléphone posé sur table) */
  heightPx?: number;
  /** Clic tactile sur le moyeu central (ex. écouter la note repère sans clavier) */
  onCenterTap?: () => void;
  centerTapTitle?: string;
}

export const UnifiedPitchDialCanvas: React.FC<UnifiedPitchDialCanvasProps> = ({
  liveStateRef,
  heightPx = 188,
  onCenterTap,
  centerTapTitle,
}) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef<{ w: number; h: number; dpr: number }>({ w: 300, h: heightPx, dpr: 1 });
  const labelsRef = useRef({
    up: t('dialHintUp'),
    down: t('dialHintDown'),
    hold: t('dialHintHold'),
    sing: t('dialHintSing'),
  });

  labelsRef.current = {
    up: t('dialHintUp'),
    down: t('dialHintDown'),
    hold: t('dialHintHold'),
    sing: t('dialHintSing'),
  };

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(160, Math.round(rect.width));
      const h = Math.max(120, Math.round(heightPx));
      geomRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);

    let rafId = 0;
    const renderLoop = () => {
      const ctx = canvas.getContext('2d');
      if (ctx && liveStateRef.current) {
        const { w, h, dpr } = geomRef.current;
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.save();
        ctx.scale(dpr, dpr);
        drawUnifiedPitchDial(ctx, w, h, liveStateRef.current, labelsRef.current, isLight);
        ctx.restore();
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [heightPx, liveStateRef]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${heightPx}px` }}
      onClick={onCenterTap}
      title={centerTapTitle}
      className={`w-full relative select-none rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] ${
        onCenterTap ? 'cursor-pointer hover:border-amber-500/60' : ''
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
