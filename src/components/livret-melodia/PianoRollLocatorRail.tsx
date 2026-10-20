/**
 * PianoRollLocatorRail.tsx
 * Rail horizontal sticky des bornes Melodyne [ In ── Out ] sous la règle des Temps.
 * Poignées larges (22px+), glisser-déposer fluide avec pointer capture et clic-glisser (< 125 lignes).
 */
import React, { useState, useCallback, useRef } from 'react';
import type { MelodyneRegion } from '../../types/vocalPack.types';

interface Props {
  gridWidth: number; totalDurationSec: number; anacrusisDurationSec: number; beatsPerMeasure: number;
  hasAnacrusis?: boolean; t1OffsetSec?: number; bpm?: number; regions: MelodyneRegion[];
  selectedRegionId: string | null; onSelectRegion: (id: string | null) => void;
  onUpdateRegionBounds: (id: string, startSec: number, endSec: number) => void;
  onAddRegion: (startSec: number, endSec: number) => void;
}

type DragMode = 'in' | 'out' | 'body' | 'create';

export const PianoRollLocatorRail: React.FC<Props> = ({
  gridWidth, totalDurationSec, anacrusisDurationSec, beatsPerMeasure,
  hasAnacrusis = true, t1OffsetSec, bpm, regions, selectedRegionId,
  onSelectRegion, onUpdateRegionBounds, onAddRegion,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ mode: DragMode; regionId?: string; startX: number; startSec: number; endSec: number } | null>(null);

  const beatDur = bpm ? 60 / bpm : (hasAnacrusis && beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6);
  const totalBeats = Math.max(1, Math.round(totalDurationSec / beatDur)), gridDur = totalBeats * beatDur;
  const t1Offset = t1OffsetSec ?? (hasAnacrusis ? 0 : 0.15);

  const secToX = useCallback((sec: number) => {
    const rel = hasAnacrusis ? sec : (sec - t1Offset);
    return Math.max(0, Math.min(gridWidth, (rel / gridDur) * gridWidth));
  }, [hasAnacrusis, t1Offset, gridDur, gridWidth]);

  const xToSec = useCallback((x: number) => {
    const rel = (Math.max(0, Math.min(gridWidth, x)) / gridWidth) * gridDur;
    return Math.max(0, Math.min(totalDurationSec, hasAnacrusis ? rel : (rel + t1Offset)));
  }, [gridWidth, gridDur, totalDurationSec, hasAnacrusis, t1Offset]);

  const startDrag = (e: React.PointerEvent, mode: DragMode, regionId?: string, sSec = 0, eSec = 0) => {
    e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ mode, regionId, startX: e.clientX, startSec: sSec, endSec: eSec });
    if (regionId) onSelectRegion(regionId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dSec = ((e.clientX - drag.startX) / gridWidth) * gridDur;
    if (drag.mode === 'in' && drag.regionId) {
      onUpdateRegionBounds(drag.regionId, Math.max(0, Math.min(drag.endSec - 0.05, drag.startSec + dSec)), drag.endSec);
    } else if (drag.mode === 'out' && drag.regionId) {
      onUpdateRegionBounds(drag.regionId, drag.startSec, Math.min(totalDurationSec, Math.max(drag.startSec + 0.05, drag.endSec + dSec)));
    } else if (drag.mode === 'body' && drag.regionId) {
      const dur = drag.endSec - drag.startSec, nStart = Math.max(0, Math.min(totalDurationSec - dur, drag.startSec + dSec));
      onUpdateRegionBounds(drag.regionId, nStart, nStart + dur);
    } else if (drag.mode === 'create' && railRef.current) {
      const rect = railRef.current.getBoundingClientRect(), curSec = xToSec(e.clientX - rect.left);
      const s = Math.min(drag.startSec, curSec), end = Math.max(drag.startSec, curSec);
      if (drag.regionId) onUpdateRegionBounds(drag.regionId, s, Math.max(s + 0.05, end));
      else if (Math.abs(curSec - drag.startSec) > 0.06) {
        onAddRegion(s, Math.max(s + 0.05, end));
        setDrag((d) => (d ? { ...d, mode: 'create', regionId: regions[regions.length - 1]?.id } : null));
      }
    }
  };

  const handleRailDown = (e: React.PointerEvent) => {
    if (!railRef.current) return;
    const clickSec = xToSec(e.clientX - railRef.current.getBoundingClientRect().left);
    const existing = regions.find((r) => clickSec >= r.startSec && clickSec <= r.endSec);
    if (existing) {
      startDrag(e, 'body', existing.id, existing.startSec, existing.endSec);
    } else {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const sel = regions.find((r) => r.id === selectedRegionId);
      if (sel) {
        const dur = sel.endSec - sel.startSec, clampedStart = Math.max(0, Math.min(totalDurationSec - dur, clickSec - dur / 2));
        onUpdateRegionBounds(sel.id, clampedStart, clampedStart + dur);
        setDrag({ mode: 'body', regionId: sel.id, startX: e.clientX, startSec: clampedStart, endSec: clampedStart + dur });
      } else {
        setDrag({ mode: 'create', startX: e.clientX, startSec: clickSec, endSec: clickSec + 0.05 });
      }
    }
  };

  return (
    <div
      ref={railRef} onPointerDown={handleRailDown} onPointerMove={handlePointerMove} onPointerUp={() => setDrag(null)}
      className="relative w-full h-[24px] bg-[var(--cordel-surface)] border-b border-[var(--cordel-border-sub)] select-none overflow-hidden cursor-crosshair"
      style={{ width: `${gridWidth}px` }}
    >
      <div className="absolute inset-0 bg-[var(--cordel-subcard-bg)]/40 pointer-events-none" />
      {regions.map((r) => {
        const xIn = secToX(r.startSec), xOut = secToX(r.endSec), isSel = r.id === selectedRegionId, w = Math.max(4, xOut - xIn);
        return (
          <div key={r.id} className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: `${xIn}px`, width: `${w}px` }}>
            <div
              onPointerDown={(e) => startDrag(e, 'body', r.id, r.startSec, r.endSec)}
              className={`absolute inset-0 border-y flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors ${
                isSel ? 'bg-[#d97706]/35 border-[#f59e0b]' : 'bg-[#0284c7]/25 border-[#38bdf8]/70 hover:bg-[#0284c7]/35'
              }`}
            >
              {w > 72 && <span className="text-[9px] font-mono font-bold text-amber-200 truncate px-1 pointer-events-none drop-shadow">[ IN ── OUT ]</span>}
            </div>
            <div
              onPointerDown={(e) => startDrag(e, 'in', r.id, r.startSec, r.endSec)} title="Borne IN"
              className={`absolute top-0.5 bottom-0.5 -left-[24px] w-[26px] z-10 flex items-center justify-center text-[9px] font-mono font-extrabold cursor-ew-resize border shadow-md select-none rounded-none transition-transform hover:scale-105 ${
                isSel ? 'bg-[#d97706] text-black border-[#f59e0b]' : 'bg-[#0284c7] text-white border-[#38bdf8]'
              }`}
            >
              IN ▸
            </div>
            <div
              onPointerDown={(e) => startDrag(e, 'out', r.id, r.startSec, r.endSec)} title="Borne OUT"
              className={`absolute top-0.5 bottom-0.5 -right-[2px] w-[26px] z-10 flex items-center justify-center text-[9px] font-mono font-extrabold cursor-ew-resize border shadow-md select-none rounded-none transition-transform hover:scale-105 ${
                isSel ? 'bg-[#d97706] text-black border-[#f59e0b]' : 'bg-[#0284c7] text-white border-[#38bdf8]'
              }`}
            >
              ◂ OUT
            </div>
          </div>
        );
      })}
    </div>
  );
};
