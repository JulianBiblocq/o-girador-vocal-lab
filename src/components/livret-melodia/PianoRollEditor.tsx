import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../../types/vocalPack.types';
import type { ScaleType } from '../../audio/scaleQuantizer'; import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { calculateTessitura, midiToNoteName } from '../../utils/noteUtils';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { useLanguage } from '../../i18n/LanguageContext';
import { PianoRollToolbar } from './PianoRollToolbar';
import { PianoRollKeyboard } from './PianoRollKeyboard';
import { PianoRollCanvas } from './PianoRollCanvas';
import { PianoRollStickyHeader } from './PianoRollStickyHeader';
import { FloatingSyllableInput } from './FloatingSyllableInput';
import { PianoRollSyllablesRow } from './PianoRollSyllablesRow';
import { PianoRollToolPopover } from './PianoRollToolPopover';
import { CordelPiano } from '../common/CordelIcons';
import type { PianoRollTool } from './pianoRollInteractions';

export interface PianoRollEditorProps {
  allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[]; totalDurationSec: number; anacrusisDurationSec: number; beatsPerMeasure: number; beatResolutions: number[]; seekStartSec: number; isPlaying: boolean;
  tonic: string; scaleType: ScaleType; smoothingLevel: number; canUndo?: boolean; canRedo?: boolean; historyCount?: number; regions?: MelodyneRegion[]; selectedRegionId?: string | null; activeTool?: PianoRollTool; onSelectTool?: (tool: PianoRollTool) => void;
  hasAnacrusis?: boolean; bpm?: number; t1OffsetSec?: number; getPlayheadSec?: () => number; onSeek: (sec: number) => void; onUndo?: () => void; onRedo?: () => void; onSetTonic: (t: string) => void; onSetScaleType: (st: ScaleType) => void;
  onSetSmoothingLevel: (lvl: number) => void; onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void; onPlayNotePreview: (midi: number) => void; onReExtractNotes?: () => void; onSelectRegion?: (id: string | null) => void; onAddRegion?: (start: number, end: number) => void;
  onUpdateRegionBounds?: (id: string, start: number, end: number) => void; onDeleteSelectedRegion?: () => void; selectedStepIdx?: number | null; onSelectStep?: (idx: number | null) => void; harmonyGrid?: PatternHarmonyGrid; pitchShiftSemitones?: number; readOnly?: boolean;
}

const ROW_HEIGHT = 20;

export const PianoRollEditor: React.FC<PianoRollEditorProps> = (p) => {
  const { t } = useLanguage(), scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(640), [zoomLevel, setZoomLevel] = useState(1);
  const [internalTool, setInternalTool] = useState<PianoRollTool>('pointer');
  const activeTool = p.activeTool ?? internalTool, setActiveTool = p.onSelectTool ?? setInternalTool;
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ stepIndex: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const hasAutoCentered = useRef(false);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const obs = new ResizeObserver(([e]) => { if (e) setBaseWidth(Math.max(320, Math.floor(e.contentRect.width) - 66)); });
    obs.observe(el);
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); setZoomLevel((z) => Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.25 : 0.8)))); } };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { obs.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, []);

  const activeMidis = useMemo(() => p.allSteps.filter((s) => s.active && s.midiNumber > 0).map((s) => s.midiNumber), [p.allSteps]);
  const { minMidi, maxMidi } = useMemo(() => calculateTessitura(activeMidis), [activeMidis]);
  const canvasHeight = Math.max(1, maxMidi - minMidi + 1) * ROW_HEIGHT, gridWidth = Math.round(baseWidth * zoomLevel);
  const t1OffsetSec = p.t1OffsetSec ?? getPatternT1OffsetSec(p.hasAnacrusis, p.beatsPerMeasure * (60 / (p.bpm || 60)));

  useEffect(() => {
    const el = scrollRef.current; if (!el || hasAutoCentered.current) return;
    const avgMidi = activeMidis.length > 0 ? activeMidis.reduce((a, b) => a + b, 0) / activeMidis.length : 54;
    el.scrollTop = Math.max(0, (maxMidi - avgMidi) * ROW_HEIGHT - 140); hasAutoCentered.current = true;
  }, [activeMidis, maxMidi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName || '').toUpperCase());
      if ((e.key === 'Delete' || e.key === 'Backspace') && p.selectedRegionId && !isInput) { e.preventDefault(); p.onDeleteSelectedRegion?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.selectedRegionId, p.onDeleteSelectedRegion]);

  const handleConfirmText = useCallback((text: string, jumpNext: boolean) => {
    if (!textInput) return;
    const cur = textInput.stepIndex, nextSteps = p.allSteps.map((st, i) => (i === cur ? { ...st, syllable: text } : st));
    p.onUpdateSteps(nextSteps);
    if (jumpNext) {
      const nextActive = nextSteps.findIndex((st, i) => i > cur && st.active && st.note !== '───');
      if (nextActive !== -1) {
        const stepW = gridWidth / nextSteps.length;
        setTextInput({ stepIndex: nextActive, rect: { x: nextActive * stepW, y: (maxMidi - nextSteps[nextActive].midiNumber) * ROW_HEIGHT, w: stepW * 2, h: ROW_HEIGHT } });
        return;
      }
    }
    setTextInput(null);
  }, [textInput, p.allSteps, gridWidth, maxMidi, p.onUpdateSteps]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {!p.readOnly && (
        <PianoRollToolbar
          activeTool={activeTool} onSelectTool={setActiveTool} zoomLevel={zoomLevel} onSetZoom={setZoomLevel}
          tonic={p.tonic} onSetTonic={p.onSetTonic} scaleType={p.scaleType} onSetScaleType={p.onSetScaleType}
          smoothingLevel={p.smoothingLevel} onSetSmoothingLevel={p.onSetSmoothingLevel}
          canUndo={p.canUndo} canRedo={p.canRedo} historyCount={p.historyCount} onUndo={p.onUndo} onRedo={p.onRedo}
          onReExtractNotes={p.onReExtractNotes}
        />
      )}
      <div className="flex items-center justify-between text-[11px] font-mono px-1">
        <span className="font-bold text-theme-accent flex items-center gap-1.5">
          <CordelPiano className="w-3.5 h-3.5" />
          <span>PIANO ROLL • {midiToNoteName(minMidi)} ➔ {midiToNoteName(maxMidi)} ({zoomLevel.toFixed(1)}x)</span>
        </span>
        {p.readOnly ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-theme-ink/70 hidden sm:inline">{t('rulerClickSeekHint')}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] opacity-75">🔍</span>
              {[1, 2, 4, 8].map((z) => (
                <button key={z} type="button" onClick={() => setZoomLevel(z)} className={`px-1.5 py-0.5 text-[10px] border border-theme-border/60 cursor-pointer ${zoomLevel === z ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'hover:bg-white/10'}`}>{z}x</button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-theme-ink/70 hidden sm:inline">{t('pianoRollHint')}</span>
        )}
      </div>
      <div ref={scrollRef} className="w-full cordel-card overflow-x-auto overflow-y-auto cordel-scrollbar max-h-[420px] rounded">
        <div style={{ width: `${64 + gridWidth}px`, minHeight: `${66 + canvasHeight}px` }}>
          <PianoRollStickyHeader
            gridWidth={gridWidth} beatsPerMeasure={p.beatsPerMeasure} totalDurationSec={p.totalDurationSec}
            anacrusisDurationSec={p.anacrusisDurationSec} seekStartSec={p.seekStartSec} isPlaying={p.isPlaying}
            hasAnacrusis={p.hasAnacrusis} bpm={p.bpm} t1OffsetSec={t1OffsetSec} getPlayheadSec={p.getPlayheadSec} onSeek={p.onSeek}
            regions={p.regions} selectedRegionId={p.selectedRegionId} onSelectRegion={p.onSelectRegion}
            onUpdateRegionBounds={p.onUpdateRegionBounds} onAddRegion={p.onAddRegion}
          />
          <div className="flex relative" style={{ width: `${64 + gridWidth}px`, height: `${canvasHeight}px` }}>
            <PianoRollKeyboard minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT} onPlayNote={p.onPlayNotePreview} />
            <div className="relative" style={{ width: `${gridWidth}px`, height: `${canvasHeight}px` }}>
              <PianoRollCanvas
                {...p} t1OffsetSec={t1OffsetSec} readOnly={p.readOnly} width={gridWidth} height={canvasHeight} minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT}
                activeTool={activeTool} onOpenContextMenu={(x, y) => setPalettePos({ x, y })}
                onOpenTextInput={(idx, rect) => setTextInput({ stepIndex: idx, rect })}
              />
              {textInput && (
                <FloatingSyllableInput
                  initialText={p.allSteps[textInput.stepIndex]?.syllable ?? ''}
                  x={textInput.rect.x} y={textInput.rect.y} width={textInput.rect.w} height={textInput.rect.h}
                  onConfirm={handleConfirmText} onCancel={() => setTextInput(null)}
                />
              )}
            </div>
          </div>
          <PianoRollSyllablesRow allSteps={p.allSteps} gridWidth={gridWidth} readOnly={p.readOnly} onUpdateSteps={p.onUpdateSteps} />
        </div>
      </div>
      {palettePos && <PianoRollToolPopover x={palettePos.x} y={palettePos.y} activeTool={activeTool} onSelectTool={setActiveTool} onClose={() => setPalettePos(null)} />}
    </div>
  );
};
