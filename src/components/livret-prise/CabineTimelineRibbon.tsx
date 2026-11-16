/**
 * CabineTimelineRibbon.tsx
 * Ruban Unique bilingue (FR / PT-BR) des Mesures à Bille Rebondissante & Onde Live 60 FPS (0 Layout/Render Thrashing) (< 135 lignes).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MetronomeEngine } from '../../audio/MetronomeEngine';
import type { ToadaProject, VocalPatternItem } from '../../types/toadaProject.types';
import { CABINE_WAVE_BINS_PER_BEAT, patternHasAnyAudio, buildCabineTimelineMeasures, drawCabineTimelineRibbon } from './cabineTimelineDrawer';
import { useLanguage } from '../../i18n/LanguageContext';
import { Headphones, Radio, Crosshair } from 'lucide-react';

export interface CabineTimelineRibbonProps {
  engine: MetronomeEngine; isActive: boolean; takeMode: 'pattern' | 'puxador' | 'coro';
  project: ToadaProject; activePattern: VocalPatternItem; cuePattern: VocalPatternItem | null;
  beatsPerMeasure: number; isPunchIn?: boolean; counterRoleCueEnabled: boolean;
  onToggleCounterRoleCue: () => void;
  getContinuousLiveStatus: () => { isRunning: boolean; currentBeatGlobal: number; beatProgress: number; totalBeats: number };
  livePeakBinsRef?: React.RefObject<Float32Array | null>;
  sampleLivePeak?: () => number;
  frameless?: boolean;
  children?: React.ReactNode;
}

export const CabineTimelineRibbon: React.FC<CabineTimelineRibbonProps> = ({
  engine, isActive, takeMode, project, activePattern, cuePattern, beatsPerMeasure,
  isPunchIn = false, counterRoleCueEnabled, onToggleCounterRoleCue, getContinuousLiveStatus,
  livePeakBinsRef, sampleLivePeak, frameless = false, children,
}) => {
  const { language } = useLanguage(), isBr = language === 'br';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const widthRef = useRef<number>(640);
  const [resizeTick, setResizeTick] = useState(0);
  const [livePhase, setLivePhase] = useState<'idle' | 'preroll' | 'call' | 'anacrusis' | 'recording'>('idle');

  const timelineData = useMemo(
    () => buildCabineTimelineMeasures({ takeMode, project, activePattern, cuePattern, beatsPerMeasure, isPunchIn, counterRoleCueEnabled, lang: language }),
    [takeMode, project, activePattern, cuePattern, beatsPerMeasure, isPunchIn, counterRoleCueEnabled, language]
  );

  const counterRoleRecordedCount = useMemo(() => {
    if (takeMode === 'pattern') return 0;
    const counterRole = takeMode === 'puxador' ? 'coro' : 'puxador';
    return project.patterns.filter((p) => p.role === counterRole && patternHasAnyAudio(p)).length;
  }, [takeMode, project.patterns]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (!entry) return;
      widthRef.current = Math.max(280, Math.floor(entry.contentRect.width));
      setResizeTick((v) => v + 1);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number | null = null, lastPhase: typeof livePhase = 'idle';

    const renderFrame = () => {
      const dpr = window.devicePixelRatio || 1, w = widthRef.current, h = 116;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save(); ctx.scale(dpr, dpr);
        let curBeat = 0, beatProg = 0, running = false;
        if (isActive) {
          if (takeMode === 'pattern') {
            const st = engine.getCycleStatus();
            running = st.phase !== 'idle' && st.phase !== 'completed'; curBeat = st.beatIndexInCycle; beatProg = st.beatProgress;
          } else {
            const st = getContinuousLiveStatus();
            running = st.isRunning; curBeat = st.currentBeatGlobal; beatProg = st.beatProgress;
          }
        }
        const nextPhase: typeof livePhase = !running ? 'idle' : timelineData.isCallInBeat(curBeat) ? 'call' : timelineData.isAnacrusisBeat(curBeat) ? 'anacrusis' : timelineData.isRecordingBeat(curBeat) ? 'recording' : 'preroll';
        if (nextPhase !== lastPhase) { lastPhase = nextPhase; setLivePhase(nextPhase); }
        if (running && sampleLivePeak) {
          const pk = sampleLivePeak();
          if ((nextPhase === 'anacrusis' || nextPhase === 'recording') && livePeakBinsRef?.current) {
            const bIdx = Math.floor((curBeat + beatProg) * CABINE_WAVE_BINS_PER_BEAT);
            if (bIdx >= 0 && bIdx < livePeakBinsRef.current.length && pk > livePeakBinsRef.current[bIdx]) livePeakBinsRef.current[bIdx] = pk;
          }
        }
        drawCabineTimelineRibbon(ctx, w, h, timelineData.measures, curBeat, beatProg, running, takeMode !== 'pattern', language, livePeakBinsRef?.current);
        ctx.restore();
      }
      if (isActive) rafId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
  }, [isActive, takeMode, engine, getContinuousLiveStatus, timelineData, language, resizeTick, livePeakBinsRef, sampleLivePeak]);

  return (
    <div className={frameless ? 'flex flex-col gap-2.5 w-full' : 'cordel-card p-3 flex flex-col gap-2.5 w-full'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {livePhase === 'recording' || livePhase === 'anacrusis' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-red-600 text-white flex items-center gap-1.5 animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>{livePhase === 'anacrusis' ? (isBr ? 'GRAVAÇÃO • ANACRUSE' : 'ENREGISTREMENT • ANACROUSE') : (isBr ? 'GRAVAÇÃO' : 'ENREGISTREMENT')}</span>
            </span>
          ) : livePhase === 'call' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-400 text-stone-950 flex items-center gap-1.5">
              <span>{isBr ? 'CHAMADA CLAVE (2 TEMPOS ANTES)' : 'APPEL CLAVE (2 TEMPS AVANT)'}</span>
            </span>
          ) : livePhase === 'preroll' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-stone-800 text-[#f4ecd8]">
              {isBr ? 'PRÉ-CONTAGEM / GUIA' : 'PRÉCOMPTE / TÉMOIN'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--cordel-subcard-bg)] text-theme-ink border border-[var(--cordel-border-sub)] inline-flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-theme-accent" />
              <span>{isBr ? `${beatsPerMeasure} TEMPOS / COMPASSO` : `${beatsPerMeasure} TEMPS / MESURE`}</span>
            </span>
          )}
        </div>

        {takeMode !== 'pattern' && (
          <button type="button" onClick={onToggleCounterRoleCue} disabled={isActive} className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${counterRoleCueEnabled ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/75 border-[var(--cordel-border-sub)]'} ${isActive ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <Headphones className="w-3.5 h-3.5" />
            <span>{isBr ? 'Voz guia :' : 'Voix témoin :'} {counterRoleCueEnabled ? 'ON' : 'OFF'}{counterRoleRecordedCount > 0 ? ` (${counterRoleRecordedCount})` : ''}</span>
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-[116px] rounded bg-[#18130f] border border-[var(--cordel-border-panel)] block" />
      {children}
    </div>
  );
};
