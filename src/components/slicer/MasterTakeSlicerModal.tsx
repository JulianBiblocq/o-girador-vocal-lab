/**
 * MasterTakeSlicerModal.tsx
 * Modale Cordel du Banc de Decoupe Multi-Blocs & Calage Fin (< 130 lignes).
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { decodeAudioFile, type DecodedAudioResult } from '../../utils/directAudioImporter';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { analyzeBeatPegs, piecewiseTimeWarp } from '../../audio/piecewiseTimeWarper';
import { extractPatternFromMaster } from '../../utils/masterTakeExtractor';
import { executeBatchAssign } from '../../utils/slicerBatchAssigner';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { buildOrganizadorSlices } from '../../utils/slicerAlignmentHelper';
import type { SliceSegment } from '../../types/slicerSegments.types';
import type { VocalRole } from '../../types/toadaProject.types';
import { SlicerModeTabs, type SlicerWorkMode } from './SlicerModeTabs';
import { SlicerMultiSection } from './SlicerMultiSection';
import { SlicerSingleSection } from './SlicerSingleSection';
import { Upload, X } from 'lucide-react';

interface SlicerModalProps {
  isOpen: boolean; onClose: () => void;
  initialAudio?: DecodedAudioResult | null; defaultRole?: VocalRole;
}

export const MasterTakeSlicerModal: React.FC<SlicerModalProps> = ({
  isOpen, onClose, initialAudio, defaultRole = 'puxador',
}) => {
  const { project, addPattern, updatePattern, updateVariant, setActivePatternId, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const [mode, setMode] = useState<SlicerWorkMode>('multi');
  const [audio, setAudio] = useState<DecodedAudioResult | null>(null);
  const [segments, setSegments] = useState<SliceSegment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const [trimIn, setTrimIn] = useState(0), [trimOut, setTrimOut] = useState(8);
  const [beatPegs, setBeatPegs] = useState<number[]>([]), [warpPct, setWarpPct] = useState(0);
  const [customBpm, setCustomBpm] = useState<number | undefined>(undefined);
  const [role, setRole] = useState<VocalRole>(defaultRole), [patternName, setPatternName] = useState('Puxador 1');
  const [targetPatternId, setTargetPatternId] = useState<string>('new');
  const [measures, setMeasures] = useState<1 | 2 | 3 | 4>(2), [hasAnacrusis, setHasAnacrusis] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false), [loop, setLoop] = useState(true), [witnessClick, setWitnessClick] = useState(true);
  const [playheadSec, setPlayheadSec] = useState(-1), [isExtracting, setIsExtracting] = useState(false), [lastExtracted, setLastExtracted] = useState<string | null>(null);

  const engine = useMemo(() => new SlicerAudioEngine(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { phraseBpm, targetPegs } = useMemo(() => analyzeBeatPegs(beatPegs, customBpm), [beatPegs, customBpm]);

  const loadAudioWithAutoSlices = useCallback((aud: DecodedAudioResult) => {
    setAudio(aud); setTrimIn(0); setTrimOut(Math.min(aud.durationSec, 8)); setBeatPegs([]);
    const detected = detectVocalPhrases(aud.pcm, aud.sampleRate);
    setSegments(buildOrganizadorSlices(project.patterns, defaultRole, project.bpm || 55, detected, 0.8));
  }, [defaultRole, project.patterns, project.bpm]);

  useEffect(() => {
    if (isOpen && initialAudio && (!audio || audio.pcm !== initialAudio.pcm)) loadAudioWithAutoSlices(initialAudio);
  }, [isOpen, initialAudio, audio, loadAudioWithAutoSlices]);

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

  useEffect(() => () => { engine.stop(); }, [engine]);

  const handleBatchAssign = async () => {
    if (!audio || isAssigning) return;
    setIsAssigning(true);
    try {
      const res = executeBatchAssign({ project, masterPCM: audio.pcm, sampleRate: audio.sampleRate, segments, addPattern, updatePattern, updateVariant });
      if (res.firstAssignedId) setActivePatternId(res.firstAssignedId);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('slicerAssignSuccessToast', { count: res.processedCount }), type: 'success' } }));
      onClose();
    } finally { setIsAssigning(false); }
  };

  const handleSinglePlay = async () => {
    if (!audio) return;
    if (isPlaying) { engine.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    const slice = piecewiseTimeWarp(audio.pcm, audio.sampleRate, trimIn, trimOut, beatPegs, warpPct, phraseBpm);
    await engine.play({ pcm: slice, sampleRate: audio.sampleRate, loop, witnessClick, targetPegsRelativeSec: targetPegs.map((p) => p - trimIn), onEnded: () => setIsPlaying(false) });
  };

  const handleSingleExtract = async () => {
    if (!audio || isExtracting || beatPegs.length < 2) return;
    setIsExtracting(true);
    try {
      const res = extractPatternFromMaster({
        rawAudio: audio.pcm, sampleRate: audio.sampleRate, trimInSec: trimIn, trimOutSec: trimOut,
        beatPegs, warpPct, phraseBpm, role, patternName: patternName.trim() || `Pattern ${Date.now() % 100}`,
        measuresCount: measures, hasAnacrusis, beatsPerMeasure: 4, beatResolutions: [4, 4, 4, 4], referencePitch: 'C4',
      });
      const patId = targetPatternId === 'new' ? addPattern(res.role, res.name) : targetPatternId;
      updatePattern(patId, {
        measuresCount: res.measuresCount, baseBpm: Math.round(res.phraseBpm), hasAnacrusis: res.hasAnacrusis,
        pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
        anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, t1OffsetSec: res.t1OffsetSec, isMidiInitialized: true, midiLocked: true,
      });
      setLastExtracted(res.name);
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
          <div className="flex flex-col gap-2.5">
            <SlicerModeTabs mode={mode} onModeChange={setMode} />
            {mode === 'multi' ? (
              <SlicerMultiSection project={project} audio={audio} segments={segments} onSegmentsChange={setSegments} patterns={project.patterns} defaultRole={defaultRole} isAssigning={isAssigning} onExecuteBatchAssign={handleBatchAssign} onChangeFile={() => fileInputRef.current?.click()} engine={engine} onProjectUpdate={loadProject} />
            ) : (
              <SlicerSingleSection
                audio={audio} patterns={project.patterns} trimIn={trimIn} trimOut={trimOut} beatPegs={beatPegs} targetPegs={targetPegs} playheadSec={playheadSec} isPlaying={isPlaying} loop={loop} witnessClick={witnessClick} phraseBpm={phraseBpm} warpPct={warpPct} measures={measures} hasAnacrusis={hasAnacrusis} role={role} patternName={patternName} targetPatternId={targetPatternId} isExtracting={isExtracting} lastExtracted={lastExtracted}
                onTrimChange={(s, e) => { setTrimIn(s); setTrimOut(e); }} onPegsChange={setBeatPegs} onTogglePlay={handleSinglePlay} onToggleLoop={() => { const n = !loop; setLoop(n); engine.setLoop(n); }} onToggleWitnessClick={() => { const n = !witnessClick; setWitnessClick(n); engine.setWitnessClick(n); }} onPlantPeg={() => { const cur = playheadSec >= 0 ? playheadSec : trimIn + 0.1; setBeatPegs((p) => [...p, cur].filter((x) => x >= trimIn && x <= trimOut).sort((a, b) => a - b)); }} onClearPegs={() => setBeatPegs([])} onBpmNudge={(d) => setCustomBpm(Math.max(30, Math.min(240, phraseBpm + d)))} onWarpPctChange={setWarpPct} onMeasuresChange={setMeasures} onHasAnacrusisChange={setHasAnacrusis} onTargetPatternChange={setTargetPatternId} onRoleChange={setRole} onNameChange={setPatternName} onExtract={handleSingleExtract}
              />
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) loadAudioWithAutoSlices(await decodeAudioFile(f)); }} className="hidden" />
      </div>
    </div>
  );
};
