/**
 * PianoRollEditor.tsx
 * Éditeur Piano Roll Cubase VariAudio avec Zone Supérieure auto-centrée sur les briques/courbe verte
 * et Bandeau Inférieur Épinglé (Docked Footer : Syllabes + Figures Rythmiques 1-2-4) toujours visible (< 138 lignes).
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../../types/vocalPack.types';
import type { ScaleType } from '../../audio/scaleQuantizer';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { calculateTessitura, midiToNoteName } from '../../utils/noteUtils';
import { getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { useLanguage } from '../../i18n/LanguageContext';
import { PianoRollToolbar } from './PianoRollToolbar'; import { PianoRollKeyboard } from './PianoRollKeyboard';
import { PianoRollCanvas } from './PianoRollCanvas'; import { PianoRollStickyHeader } from './PianoRollStickyHeader';
import { FloatingSyllableInput } from './FloatingSyllableInput'; import { PianoRollSyllablesRow } from './PianoRollSyllablesRow';
import { BeatRhythmPresetBar } from './BeatRhythmPresetBar'; import { PianoRollContextMenu } from './PianoRollContextMenu';
import { CordelPiano } from '../common/CordelIcons';
import type { PianoRollTool } from './pianoRollInteractions';

export interface PianoRollEditorProps {
  allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[]; rawPitchCurve?: PitchCurvePoint[];
  totalDurationSec: number; anacrusisDurationSec: number; beatsPerMeasure: number; beatResolutions: number[];
  seekStartSec: number; isPlaying: boolean; tonic: string; scaleType: ScaleType; smoothingLevel: number;
  canUndo?: boolean; canRedo?: boolean; historyCount?: number; regions?: MelodyneRegion[]; selectedRegionId?: string | null;
  activeTool?: PianoRollTool; onSelectTool?: (tool: PianoRollTool) => void;
  hasAnacrusis?: boolean; bpm?: number; t1OffsetSec?: number; measuresCount?: number;
  getPlayheadSec?: () => number; onSeek: (sec: number) => void; onUndo?: () => void; onRedo?: () => void;
  onSetTonic: (t: string) => void; onSetScaleType: (st: ScaleType) => void; onSetSmoothingLevel: (lvl: number) => void;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void; onPlayNotePreview: (midi: number) => void;
  onSnapToGreenLine?: () => void; onReExtractNotes?: () => void; onSimplifyMelody?: () => void; onWeldSelected?: () => void;
  globalVariAudioPct?: number; onChangeGlobalVariAudioPct?: (pct: number) => void; onPurgeVariAudio?: () => void;
  onSelectRegion?: (id: string | null) => void; onAddRegion?: (start: number, end: number) => void;
  onUpdateRegionBounds?: (id: string, start: number, end: number) => void; onDeleteSelectedRegion?: () => void;
  selectedStepIdx?: number | null; onSelectStep?: (idx: number | null) => void;
  onBrickMoved?: (rootIdx: number, newSteps: VocalStepData[]) => void;
  harmonyGrid?: PatternHarmonyGrid; onUpdateHarmonyGrid?: (grid: PatternHarmonyGrid) => void;
  pitchShiftSemitones?: number; allowedPitchClasses?: Set<number> | null; readOnly?: boolean;
}

const ROW_HEIGHT = 20, NOTES_VIEWPORT_HEIGHT = 320;

export const PianoRollEditor: React.FC<PianoRollEditorProps> = (p) => {
  const { t, language } = useLanguage();
  const horizScrollRef = useRef<HTMLDivElement>(null), notesScrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(640), [zoomLevel, setZoomLevel] = useState(1);
  const [internalTool, setInternalTool] = useState<PianoRollTool>('pointer');
  const activeTool = p.activeTool ?? internalTool, setActiveTool = p.onSelectTool ?? setInternalTool;
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ stepIndex: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const hasAutoCentered = useRef(false);

  useEffect(() => {
    const el = horizScrollRef.current; if (!el) return;
    const obs = new ResizeObserver(([e]) => { if (e) setBaseWidth(Math.max(320, Math.floor(e.contentRect.width) - 66)); });
    obs.observe(el);
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); setZoomLevel((z) => Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.25 : 0.8)))); } };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { obs.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, []);

  const activeMidis = useMemo(() => p.allSteps.filter((s) => s.active && s.midiNumber > 0).map((s) => s.midiNumber), [p.allSteps]);
  const { minMidi, maxMidi } = useMemo(() => calculateTessitura(activeMidis), [activeMidis]);
  const canvasHeight = Math.max(1, maxMidi - minMidi + 1) * ROW_HEIGHT, gridWidth = Math.round(baseWidth * zoomLevel);
  const t1OffsetSec = p.t1OffsetSec ?? getPatternT1OffsetSec(p.hasAnacrusis, p.beatsPerMeasure * (60 / (p.bpm || 88)));

  useEffect(() => {
    const el = notesScrollRef.current;
    if (!el || hasAutoCentered.current) return;
    const curveMidis = (p.rawPitchCurve?.length ? p.rawPitchCurve : p.pitchCurve).filter((pt) => pt.midiFloat >= 36 && pt.midiFloat <= 96).map((pt) => pt.midiFloat);
    const pool = activeMidis.length > 0 ? activeMidis : curveMidis;
    if (pool.length === 0) return;
    const midMidi = (Math.min(...pool) + Math.max(...pool)) / 2;
    el.scrollTop = Math.max(0, Math.round((maxMidi - midMidi) * ROW_HEIGHT + ROW_HEIGHT / 2 - NOTES_VIEWPORT_HEIGHT / 2));
    hasAutoCentered.current = true;
  }, [activeMidis, p.rawPitchCurve, p.pitchCurve, maxMidi]);

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
          canUndo={p.canUndo} canRedo={p.canRedo} historyCount={p.historyCount} onUndo={p.onUndo} onRedo={p.onRedo}
          onSnapToGreenLine={p.onSnapToGreenLine} onReExtractNotes={p.onReExtractNotes}
          globalVariAudioPct={p.globalVariAudioPct} onChangeGlobalVariAudioPct={p.onChangeGlobalVariAudioPct} onPurgeVariAudio={p.onPurgeVariAudio}
        />
      )}
      <div className="flex items-center justify-between text-[11px] font-mono px-1">
        <span className="font-bold text-theme-accent flex items-center gap-1.5">
          <CordelPiano className="w-3.5 h-3.5" /><span>PIANO ROLL • {midiToNoteName(minMidi)} ➔ {midiToNoteName(maxMidi)} ({zoomLevel.toFixed(1)}x)</span>
        </span>
        {p.readOnly ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-theme-ink/70 hidden sm:inline">{t('rulerClickSeekHint')}</span>
            <div className="flex items-center gap-1">
              {[1, 2, 4, 8].map((z) => (
                <button key={z} type="button" onClick={() => setZoomLevel(z)} className={`px-1.5 py-0.5 text-[10px] border border-theme-border/60 cursor-pointer ${zoomLevel === z ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'hover:bg-white/10'}`}>{z}x</button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-theme-ink/70 hidden sm:inline">
            {language === 'br'
              ? '◆ Topo do bloco = Correção de Voz (0..100%) • Centro = Nota MIDI • Clique direito mantido = Ferramentas'
              : "◆ Bord haut d'une brique = Correction Voix (0..100%) • Centre = Hauteur MIDI • Clic droit maintenu = Outils"}
          </span>
        )}
      </div>

      {/* Conteneur principal : scroll horizontal partagé, Zone Supérieure scrollable verticalement + Bandeau Inférieur Épinglé */}
      <div ref={horizScrollRef} className="w-full cordel-card overflow-x-auto overflow-y-hidden cordel-scrollbar rounded">
        <div style={{ width: `${64 + gridWidth}px` }} className="flex flex-col">
          <PianoRollStickyHeader gridWidth={gridWidth} beatsPerMeasure={p.beatsPerMeasure} totalDurationSec={p.totalDurationSec} anacrusisDurationSec={p.anacrusisDurationSec} seekStartSec={p.seekStartSec} isPlaying={p.isPlaying} hasAnacrusis={p.hasAnacrusis} bpm={p.bpm} t1OffsetSec={t1OffsetSec} getPlayheadSec={p.getPlayheadSec} onSeek={p.onSeek} />
          <div ref={notesScrollRef} className="flex relative overflow-y-auto overflow-x-hidden cordel-scrollbar" style={{ width: `${64 + gridWidth}px`, height: `${NOTES_VIEWPORT_HEIGHT}px` }}>
            <PianoRollKeyboard minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT} onPlayNote={p.onPlayNotePreview} />
            <div className="relative" style={{ width: `${gridWidth}px`, height: `${canvasHeight}px` }}>
              <PianoRollCanvas {...p} t1OffsetSec={t1OffsetSec} readOnly={p.readOnly} width={gridWidth} height={canvasHeight} minMidi={minMidi} maxMidi={maxMidi} rowHeight={ROW_HEIGHT} activeTool={activeTool} onOpenContextMenu={(x, y) => setPalettePos({ x, y })} onOpenTextInput={(idx, rect) => setTextInput({ stepIndex: idx, rect })} />
              {textInput && (<FloatingSyllableInput initialText={p.allSteps[textInput.stepIndex]?.syllable ?? ''} x={textInput.rect.x} y={textInput.rect.y} width={textInput.rect.w} height={textInput.rect.h} onConfirm={handleConfirmText} onCancel={() => setTextInput(null)} />)}
            </div>
          </div>
          <PianoRollSyllablesRow allSteps={p.allSteps} gridWidth={gridWidth} readOnly={p.readOnly} onUpdateSteps={p.onUpdateSteps} />
          <BeatRhythmPresetBar allSteps={p.allSteps} gridWidth={gridWidth} resPerBeat={p.beatResolutions?.[0] || 4} readOnly={p.readOnly} onUpdateSteps={p.onUpdateSteps} />
        </div>
      </div>
      {palettePos && <PianoRollContextMenu x={palettePos.x} y={palettePos.y} activeTool={activeTool} onSelectTool={setActiveTool} onClose={() => setPalettePos(null)} />}
    </div>
  );
};
