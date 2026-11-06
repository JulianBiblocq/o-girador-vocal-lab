/**
 * CabineTimelineRibbon.tsx
 * Ruban Unique bilingue (FR / PT-BR) des Mesures à Bille Rebondissante (60 FPS) (< 135 lignes).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MetronomeEngine } from '../../audio/MetronomeEngine';
import type { ToadaProject, VocalPatternItem } from '../../types/toadaProject.types';
import { buildCabineTimelineMeasures, drawCabineTimelineRibbon } from './cabineTimelineDrawer';
import { useLanguage } from '../../i18n/LanguageContext';
import { Headphones, Radio } from 'lucide-react';

export interface CabineTimelineRibbonProps {
  engine: MetronomeEngine; isActive: boolean; takeMode: 'pattern' | 'puxador' | 'coro';
  project: ToadaProject; activePattern: VocalPatternItem; cuePattern: VocalPatternItem | null;
  beatsPerMeasure: number; isPunchIn?: boolean; counterRoleCueEnabled: boolean;
  onToggleCounterRoleCue: () => void;
  getContinuousLiveStatus: () => { isRunning: boolean; currentBeatGlobal: number; beatProgress: number; totalBeats: number };
  children?: React.ReactNode;
}

export const CabineTimelineRibbon: React.FC<CabineTimelineRibbonProps> = ({
  engine, isActive, takeMode, project, activePattern, cuePattern, beatsPerMeasure,
  isPunchIn = false, counterRoleCueEnabled, onToggleCounterRoleCue, getContinuousLiveStatus, children,
}) => {
  const { language } = useLanguage(), isBr = language === 'br';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [livePhase, setLivePhase] = useState<'idle' | 'preroll' | 'call' | 'anacrusis' | 'recording'>('idle');

  const timelineData = useMemo(
    () => buildCabineTimelineMeasures({ takeMode, project, activePattern, cuePattern, beatsPerMeasure, isPunchIn, counterRoleCueEnabled, lang: language }),
    [takeMode, project, activePattern, cuePattern, beatsPerMeasure, isPunchIn, counterRoleCueEnabled, language]
  );

  const counterRoleRecordedCount = useMemo(() => {
    if (takeMode === 'pattern') return 0;
    const counterRole = takeMode === 'puxador' ? 'coro' : 'puxador';
    return project.patterns.filter((p) => p.role === counterRole && Boolean(p.recordingResult?.pcm?.length || p.variants?.[p.activeVariantKey]?.recordingResult?.pcm?.length)).length;
  }, [takeMode, project.patterns]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number | null = null, lastPhase: typeof livePhase = 'idle';

    const renderFrame = () => {
      const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width)), h = 116;
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
        const nextPhase: typeof livePhase = !running
          ? 'idle'
          : timelineData.isCallInBeat(curBeat)
            ? 'call'
            : timelineData.isAnacrusisBeat(curBeat)
              ? 'anacrusis'
              : timelineData.isRecordingBeat(curBeat)
                ? 'recording'
                : 'preroll';
        if (nextPhase !== lastPhase) { lastPhase = nextPhase; setLivePhase(nextPhase); }
        drawCabineTimelineRibbon(ctx, w, h, timelineData.measures, curBeat, beatProg, running, takeMode !== 'pattern', language);
        ctx.restore();
      }
      if (isActive) rafId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
  }, [isActive, takeMode, engine, getContinuousLiveStatus, timelineData, language]);

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {livePhase === 'recording' || livePhase === 'anacrusis' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-red-600 text-white flex items-center gap-1.5 animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>{livePhase === 'anacrusis' ? (isBr ? 'GRAVAÇÃO • ANACRUSE' : 'ENREGISTREMENT • ANACROUSE') : (isBr ? 'GRAVAÇÃO' : 'ENREGISTREMENT')}</span>
            </span>
          ) : livePhase === 'call' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-400 text-stone-950 flex items-center gap-1.5">
              <span>{isBr ? 'CHAMADA CLAVE (2 TEMPOS ANTES DA ENTRADA)' : 'APPEL CLAVE (2 TEMPS AVANT ENTRÉE)'}</span>
            </span>
          ) : livePhase === 'preroll' ? (
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-700 text-slate-100">
              {isBr ? 'PRÉ-CONTAGEM / ESCUTA GUIA' : 'PRÉCOMPTE / ÉCOUTE TÉMOIN'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--cordel-subcard-bg)] text-theme-ink border border-[var(--cordel-border-sub)]">
              {isBr ? `FITA DE COMPASSOS (${beatsPerMeasure} TEMPOS / COMPASSO)` : `RUBAN DES MESURES (${beatsPerMeasure} TEMPS / MESURE)`}
            </span>
          )}
        </div>

        {takeMode !== 'pattern' && (
          <button
            type="button" onClick={onToggleCounterRoleCue} disabled={isActive}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${counterRoleCueEnabled ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-[var(--cordel-subcard-bg)] text-stone-400 border-[var(--cordel-border-sub)]'} ${isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{isBr ? 'Voz guia :' : 'Voix témoin :'} {counterRoleCueEnabled ? 'ON' : 'OFF'}{counterRoleRecordedCount > 0 ? ` (${counterRoleRecordedCount})` : ''}</span>
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-[116px] rounded bg-stone-950/90 border border-stone-800 block" />
      {children}
    </div>
  );
};
