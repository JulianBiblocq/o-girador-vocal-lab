/**
 * PianoRollEditor.tsx
 * Conteneur du Piano Roll combinant Toolbar, Clavier C2..C5, Règle Sticky Y,
 * Palette contextuelle, Canvas zoomable et centrage automatique du scrollTop.
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { calculateTessitura, midiToNoteName } from '../../utils/noteUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import { PianoRollToolbar } from './PianoRollToolbar';
import { PianoRollKeyboard } from './PianoRollKeyboard';
import { PianoRollCanvas } from './PianoRollCanvas';
import { PianoRollStickyHeader } from './PianoRollStickyHeader';
import { FloatingSyllableInput } from './FloatingSyllableInput';
import { PianoRollToolPalette } from './PianoRollToolPalette';
import type { PianoRollTool } from './pianoRollInteractions';

interface PianoRollEditorProps {
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  seekStartSec: number;
  isPlaying: boolean;
  tonic: string;
  scaleType: ScaleType;
  smoothingLevel: number;
  canUndo?: boolean;
  canRedo?: boolean;
  historyCount?: number;
  getPlayheadSec?: () => number;
  onSeek: (sec: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSetTonic: (t: string) => void;
  onSetScaleType: (st: ScaleType) => void;
  onSetSmoothingLevel: (lvl: number) => void;
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
  onPlayNotePreview: (midi: number) => void;
}

const ROW_HEIGHT = 20;

export const PianoRollEditor: React.FC<PianoRollEditorProps> = (props) => {
  const { allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, beatsPerMeasure, beatResolutions, seekStartSec, isPlaying, tonic, scaleType, smoothingLevel, canUndo, canRedo, historyCount, getPlayheadSec, onSeek, onUndo, onRedo, onSetTonic, onSetScaleType, onSetSmoothingLevel, onUpdateSteps, onPlayNotePreview } = props;
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState<number>(640);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<PianoRollTool>('pointer');
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ stepIndex: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const hasAutoCentered = useRef<boolean>(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => { if (e) setBaseWidth(Math.max(320, Math.floor(e.contentRect.width) - 66)); });
    obs.observe(el);
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) { e.preventDefault(); setZoomLevel((p) => Math.max(1, Math.min(8, p * (e.deltaY < 0 ? 1.25 : 0.8)))); }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => { obs.disconnect(); el.removeEventListener('wheel', handleWheel); };
  }, []);

  const activeMidis = useMemo(() => allSteps.filter((s) => s.active && s.midiNumber > 0).map((s) => s.midiNumber), [allSteps]);
  const { minMidi, maxMidi } = useMemo(() => calculateTessitura(activeMidis), [activeMidis]);
  const canvasHeight = Math.max(1, maxMidi - minMidi + 1) * ROW_HEIGHT;
  const gridWidth = Math.round(baseWidth * zoomLevel);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hasAutoCentered.current) return;
    const avgMidi = activeMidis.length > 0 ? activeMidis.reduce((a, b) => a + b, 0) / activeMidis.length : 54;
    el.scrollTop = Math.max(0, (maxMidi - avgMidi) * ROW_HEIGHT - 140);
    hasAutoCentered.current = true;
  }, [activeMidis, maxMidi]);

  const handleConfirmText = useCallback((text: string, jumpNext: boolean) => {
    if (!textInput) return;
    const cur = textInput.stepIndex;
    const nextSteps = allSteps.map((st, i) => (i === cur ? { ...st, syllable: text } : st));
    onUpdateSteps(nextSteps);
    if (jumpNext) {
      const nextActive = nextSteps.findIndex((st, i) => i > cur && st.active && st.note !== '───');
      if (nextActive !== -1) {
        const stepW = gridWidth / nextSteps.length;
        setTextInput({ stepIndex: nextActive, rect: { x: nextActive * stepW, y: (maxMidi - nextSteps[nextActive].midiNumber) * ROW_HEIGHT, w: stepW * 2, h: ROW_HEIGHT } });
        return;
      }
    }
    setTextInput(null);
  }, [textInput, allSteps, gridWidth, maxMidi, onUpdateSteps]);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <PianoRollToolbar
        activeTool={activeTool} onSelectTool={setActiveTool} zoomLevel={zoomLevel} onSetZoom={setZoomLevel}
        tonic={tonic} onSetTonic={onSetTonic} scaleType={scaleType} onSetScaleType={onSetScaleType}
        smoothingLevel={smoothingLevel} onSetSmoothingLevel={onSetSmoothingLevel}
        canUndo={canUndo} canRedo={canRedo} historyCount={historyCount} onUndo={onUndo} onRedo={onRedo}
      />
      <div className="flex items-center justify-between text-[11px] font-mono text-theme-ink/80 px-1">
        <span className="font-semibold text-amber-400">🎹 PIANO ROLL • {midiToNoteName(minMidi)} ➔ {midiToNoteName(maxMidi)} ({zoomLevel.toFixed(1)}x)</span>
        <span className="text-[10px] text-sky-400/90 hidden sm:inline">{t('pianoRollHint')}</span>
      </div>
      <div ref={scrollRef} className="w-full cordel-card overflow-x-auto overflow-y-auto cordel-scrollbar bg-stone-950/80 border border-theme-border/60 max-h-[380px]">
        <div style={{ width: `${64 + gridWidth}px`, height: `${42 + canvasHeight}px` }}>
          <PianoRollStickyHeader
            gridWidth={gridWidth} beatsPerMeasure={beatsPerMeasure} totalDurationSec={totalDurationSec}
            anacrusisDurationSec={anacrusisDurationSec} seekStartSec={seekStartSec} isPlaying={isPlaying}
            getPlayheadSec={getPlayheadSec} onSeek={onSeek}
          />
          <div className="flex relative" style={{ width: `${64 + gridWidth}px`, height: `${canvasHeight}px` }}>
            <PianoRollKeyboard minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT} onPlayNote={onPlayNotePreview} />
            <div className="relative" style={{ width: `${gridWidth}px`, height: `${canvasHeight}px` }}>
              <PianoRollCanvas
                width={gridWidth} height={canvasHeight} minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT}
                beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions} allSteps={allSteps} pitchCurve={pitchCurve}
                totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec} seekStartSec={seekStartSec}
                isPlaying={isPlaying} activeTool={activeTool} getPlayheadSec={getPlayheadSec}
                onOpenContextMenu={(x, y) => setPalettePos({ x, y })} onUpdateSteps={onUpdateSteps}
                onPlayNotePreview={onPlayNotePreview} onOpenTextInput={(idx, rect) => setTextInput({ stepIndex: idx, rect })}
              />
              {textInput && (
                <FloatingSyllableInput
                  initialText={allSteps[textInput.stepIndex]?.syllable ?? ''}
                  x={textInput.rect.x} y={textInput.rect.y} width={textInput.rect.w} height={textInput.rect.h}
                  onConfirm={handleConfirmText} onCancel={() => setTextInput(null)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {palettePos && <PianoRollToolPalette x={palettePos.x} y={palettePos.y} activeTool={activeTool} onSelectTool={setActiveTool} onClose={() => setPalettePos(null)} />}
    </div>
  );
};
