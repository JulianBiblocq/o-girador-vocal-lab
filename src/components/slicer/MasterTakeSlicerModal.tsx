/**
 * MasterTakeSlicerModal.tsx
 * Modale Cordel du Banc de Decoupe de Toada Audio Maitre (< 145 lignes).
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { decodeAudioFile, type DecodedAudioResult } from '../../utils/directAudioImporter';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { analyzeBeatPegs, piecewiseTimeWarp } from '../../audio/piecewiseTimeWarper';
import { extractPatternFromMaster } from '../../utils/masterTakeExtractor';
import { SlicerWaveformCanvas } from './SlicerWaveformCanvas';
import { SlicerTransportBar } from './SlicerTransportBar';
import { SlicerWarpControls } from './SlicerWarpControls';
import { SlicerExtractionPanel } from './SlicerExtractionPanel';
import { Upload, X } from 'lucide-react';
import type { VocalRole } from '../../types/toadaProject.types';

export const MasterTakeSlicerModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { addPattern, updatePattern } = useToadaProject();
  const { t } = useLanguage();
  const [audio, setAudio] = useState<DecodedAudioResult | null>(null);
  const [trimIn, setTrimIn] = useState(0), [trimOut, setTrimOut] = useState(8);
  const [beatPegs, setBeatPegs] = useState<number[]>([]), [warpPct, setWarpPct] = useState(0);
  const [customBpm, setCustomBpm] = useState<number | undefined>(undefined);
  const [role, setRole] = useState<VocalRole>('puxador'), [patternName, setPatternName] = useState('Puxador 1');
  const [measures, setMeasures] = useState<1 | 2 | 3 | 4>(2), [hasAnacrusis, setHasAnacrusis] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false), [loop, setLoop] = useState(true), [witnessClick, setWitnessClick] = useState(true);
  const [playheadSec, setPlayheadSec] = useState(-1), [isExtracting, setIsExtracting] = useState(false), [lastExtracted, setLastExtracted] = useState<string | null>(null);

  const engine = useMemo(() => new SlicerAudioEngine(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { phraseBpm, targetPegs } = useMemo(() => analyzeBeatPegs(beatPegs, customBpm), [beatPegs, customBpm]);

  useEffect(() => () => { engine.stop(); }, [engine]);

  useEffect(() => {
    if (!isPlaying) { setPlayheadSec(-1); return; }
    let id: number;
    const tick = () => {
      setPlayheadSec(trimIn + engine.getCurrentPlayheadSec());
      if (engine.getIsPlaying()) id = requestAnimationFrame(tick);
      else { setIsPlaying(false); setPlayheadSec(-1); }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, engine, trimIn]);

  const handleStartPlay = useCallback(async () => {
    if (!audio) return;
    if (isPlaying) { engine.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    const slice = piecewiseTimeWarp(audio.pcm, audio.sampleRate, trimIn, trimOut, beatPegs, warpPct, phraseBpm);
    const targetPegsRel = targetPegs.map((p) => p - trimIn);
    await engine.play({ pcm: slice, sampleRate: audio.sampleRate, loop, witnessClick, targetPegsRelativeSec: targetPegsRel, onEnded: () => setIsPlaying(false) });
  }, [audio, isPlaying, engine, trimIn, trimOut, beatPegs, warpPct, phraseBpm, targetPegs, loop, witnessClick]);

  const handlePlantPeg = useCallback(() => {
    if (!audio) return;
    const cur = playheadSec >= 0 ? playheadSec : trimIn + 0.1;
    setBeatPegs((prev) => { const n = [...prev, cur].filter((p) => p >= trimIn && p <= trimOut); n.sort((a, b) => a - b); return n; });
  }, [audio, playheadSec, trimIn, trimOut]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); handleStartPlay(); }
      else if (e.key.toLowerCase() === 't') { e.preventDefault(); handlePlantPeg(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleStartPlay, handlePlantPeg, onClose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const res = await decodeAudioFile(f);
    setAudio(res); setTrimIn(0); setTrimOut(Math.min(res.durationSec, 8)); setBeatPegs([]); setCustomBpm(undefined);
  };

  const handleExtract = async () => {
    if (!audio || isExtracting || beatPegs.length < 2) return;
    setIsExtracting(true);
    try {
      const res = extractPatternFromMaster({
        rawAudio: audio.pcm, sampleRate: audio.sampleRate, trimInSec: trimIn, trimOutSec: trimOut,
        beatPegs, warpPct, phraseBpm, role, patternName: patternName.trim() || `Pattern ${Date.now() % 100}`,
        measuresCount: measures, hasAnacrusis, beatsPerMeasure: 4, beatResolutions: [4, 4, 4, 4], referencePitch: 'C4',
      });
      const newId = addPattern(res.role, res.name);
      updatePattern(newId, {
        measuresCount: res.measuresCount, baseBpm: Math.round(res.phraseBpm), hasAnacrusis: res.hasAnacrusis,
        pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
        anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, isMidiInitialized: true, midiLocked: true,
        assignedLyricsText: res.assignedLyricsText, assignedPhoneticText: res.assignedPhoneticText,
      });
      setLastExtracted(res.name);
      setPatternName(role === 'puxador' ? `Appel ${Date.now() % 100}` : `Choeur ${Date.now() % 100}`);
    } finally { setIsExtracting(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl cordel-card flex flex-col gap-3 p-3 sm:p-4 text-theme-ink max-h-[95vh] overflow-y-auto cordel-scrollbar rounded">
        <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
          <h2 className="text-sm sm:text-base font-black tracking-widest uppercase m-0 text-theme-wood">{t('slicerModalTitle')}</h2>
          <button type="button" onClick={onClose} className="p-1 cordel-card-sm hover:bg-red-500/10 cursor-pointer rounded"><X className="w-4 h-4" /></button>
        </div>
        {!audio ? (
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[var(--cordel-border-panel)] rounded p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[var(--cordel-subcard-bg)]">
            <Upload className="w-8 h-8 text-theme-accent animate-bounce" />
            <span className="font-bold text-sm text-center">{t('slicerDropzoneTitle')}</span>
            <span className="text-xs text-theme-ink/60 text-center">{t('slicerDropzoneSub')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <span>Fichier : <strong>{audio.fileName}</strong> ({(audio.durationSec / 60).toFixed(1)} min)</span>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-theme-accent underline cursor-pointer">{t('slicerChangeFile')}</button>
            </div>
            <SlicerWaveformCanvas pcm={audio.pcm} sampleRate={audio.sampleRate} durationSec={audio.durationSec} trimInSec={trimIn} trimOutSec={trimOut} beatPegs={beatPegs} targetPegs={targetPegs} playheadSec={playheadSec} beatsPerMeasure={4} onTrimChange={(s, e) => { setTrimIn(s); setTrimOut(e); }} onPegsChange={setBeatPegs} />
            <SlicerTransportBar isPlaying={isPlaying} loop={loop} witnessClick={witnessClick} pegsCount={beatPegs.length} measuresEstimate={measures} onTogglePlay={handleStartPlay} onToggleLoop={() => { const n = !loop; setLoop(n); engine.setLoop(n); }} onToggleWitnessClick={() => { const n = !witnessClick; setWitnessClick(n); engine.setWitnessClick(n); }} onPlantPeg={handlePlantPeg} onClearPegs={() => setBeatPegs([])} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SlicerWarpControls phraseBpm={phraseBpm} warpPct={warpPct} measuresCount={measures} hasAnacrusis={hasAnacrusis} onBpmNudge={(d) => setCustomBpm(Math.max(30, Math.min(240, phraseBpm + d)))} onWarpPctChange={setWarpPct} onMeasuresCountChange={setMeasures} onHasAnacrusisChange={setHasAnacrusis} />
              <SlicerExtractionPanel role={role} patternName={patternName} isExtracting={isExtracting} pegsCount={beatPegs.length} lastExtractedName={lastExtracted} onRoleChange={setRole} onNameChange={setPatternName} onExtract={handleExtract} />
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
      </div>
    </div>
  );
};
