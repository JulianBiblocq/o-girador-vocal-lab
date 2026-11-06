/**
 * MasterTakeSlicerModal.tsx — Modale Cordel du Banc de Decoupe Multi-Blocs & Calage Fin (< 143 lignes).
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { decodeAudioFile, type DecodedAudioResult } from '../../utils/directAudioImporter';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { analyzeBeatPegs, piecewiseTimeWarp } from '../../audio/piecewiseTimeWarper';
import { extractPatternFromMaster } from '../../utils/masterTakeExtractor';
import { executeBatchAssign } from '../../utils/slicerBatchAssigner';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { buildOrganizadorSlices, calculateInitialMasterGridOffsetSec } from '../../utils/slicerAlignmentHelper';
import { getRoleSlicerSession, setRoleSlicerSession, computeRoleReadinessCounts } from '../../utils/slicerSessionStore';
import type { SliceSegment } from '../../types/slicerSegments.types';
import type { VocalRole } from '../../types/toadaProject.types';
import { SlicerModeTabs, type SlicerWorkMode } from './SlicerModeTabs';
import { SlicerMultiSection } from './SlicerMultiSection';
import { SlicerSingleSection } from './SlicerSingleSection';
import { SlicerRoleSessionBar, type PostAssignBannerState } from './SlicerRoleSessionBar';
import { Upload, X } from 'lucide-react';

interface SlicerModalProps { isOpen: boolean; onClose: () => void; initialAudio?: DecodedAudioResult | null; defaultRole?: VocalRole; }

export const MasterTakeSlicerModal: React.FC<SlicerModalProps> = ({ isOpen, onClose, initialAudio, defaultRole = 'puxador' }) => {
  const { project, addPattern, updatePattern, loadProject } = useToadaProject(), { t } = useLanguage();
  const [mode, setMode] = useState<SlicerWorkMode>('multi'), [activeRole, setActiveRole] = useState<VocalRole>(defaultRole);
  const [audio, setAudio] = useState<DecodedAudioResult | null>(null), [segments, setSegments] = useState<SliceSegment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false), [gridOffsetSec, setGridOffsetSec] = useState(0.1), [postAssignBanner, setPostAssignBanner] = useState<PostAssignBannerState | null>(null);
  const [trimIn, setTrimIn] = useState(0), [trimOut, setTrimOut] = useState(8), [beatPegs, setBeatPegs] = useState<number[]>([]), [warpPct, setWarpPct] = useState(0);
  const [customBpm, setCustomBpm] = useState<number | undefined>(undefined), [role, setRole] = useState<VocalRole>(defaultRole), [patternName, setPatternName] = useState('Puxador 1');
  const [targetPatternId, setTargetPatternId] = useState<string>('new'), [measures, setMeasures] = useState<1 | 2 | 3 | 4>(2), [hasAnacrusis, setHasAnacrusis] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false), [loop, setLoop] = useState(true), [witnessClick, setWitnessClick] = useState(true);
  const [playheadSec, setPlayheadSec] = useState(-1), [isExtracting, setIsExtracting] = useState(false), [lastExtracted, setLastExtracted] = useState<string | null>(null);
  const engine = useMemo(() => new SlicerAudioEngine(), []), fileInputRef = useRef<HTMLInputElement>(null), pendingLoadRoleRef = useRef<VocalRole>(defaultRole);
  const { phraseBpm, targetPegs } = useMemo(() => analyzeBeatPegs(beatPegs, customBpm), [beatPegs, customBpm]);
  const roleCounts = useMemo(() => computeRoleReadinessCounts(project.patterns), [project.patterns]);
  const hasPuxadorMaster = Boolean(getRoleSlicerSession(project.id, 'puxador')), hasCoroMaster = Boolean(getRoleSlicerSession(project.id, 'coro'));

  const loadAudioWithAutoSlices = useCallback((aud: DecodedAudioResult, targetRole: VocalRole) => {
    setActiveRole(targetRole); setRole(targetRole); setPostAssignBanner(null); setAudio(aud); setTrimIn(0); setTrimOut(Math.min(aud.durationSec, 8)); setBeatPegs([]);
    const detected = detectVocalPhrases(aud.pcm, aud.sampleRate), autoOff = calculateInitialMasterGridOffsetSec(project.patterns, targetRole, project.bpm || 88, detected, project.slots);
    const nextSegs = buildOrganizadorSlices(project.patterns, targetRole, project.bpm || 88, detected, autoOff, project.slots, aud.pcm, aud.sampleRate);
    setGridOffsetSec(autoOff); setSegments(nextSegs); setRoleSlicerSession(project.id, targetRole, { audio: aud, segments: nextSegs, gridOffsetSec: autoOff });
  }, [project.id, project.patterns, project.bpm, project.slots]);

  const handleSelectRoleSession = useCallback((targetRole: VocalRole) => {
    engine.stop(); setIsPlaying(false); setActiveRole(targetRole); setRole(targetRole);
    const saved = getRoleSlicerSession(project.id, targetRole);
    if (saved) { setAudio(saved.audio); setSegments(saved.segments); setGridOffsetSec(saved.gridOffsetSec); } else { setAudio(null); setSegments([]); }
  }, [engine, project.id]);

  const handleLoadRoleFile = useCallback((targetRole: VocalRole) => {
    pendingLoadRoleRef.current = targetRole; setActiveRole(targetRole); setRole(targetRole);
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
  }, []);

  const handleSegmentsChange = useCallback((nextSegs: SliceSegment[], nextOff?: number) => {
    const effOff = typeof nextOff === 'number' ? nextOff : gridOffsetSec;
    setSegments(nextSegs); if (typeof nextOff === 'number') setGridOffsetSec(nextOff);
    if (audio) setRoleSlicerSession(project.id, activeRole, { audio, segments: nextSegs, gridOffsetSec: effOff });
  }, [audio, activeRole, gridOffsetSec, project.id]);

  useEffect(() => {
    if (!isOpen) return;
    stopAllActiveAudioEngines('slicer-player');
    if (initialAudio && (!audio || audio.pcm !== initialAudio.pcm)) { loadAudioWithAutoSlices(initialAudio, defaultRole); return; }
    if (!audio) {
      const saved = getRoleSlicerSession(project.id, activeRole) ?? getRoleSlicerSession(project.id, defaultRole);
      if (saved) { setAudio(saved.audio); setSegments(saved.segments); setGridOffsetSec(saved.gridOffsetSec); }
    }
  }, [isOpen, initialAudio, audio, activeRole, defaultRole, project.id, loadAudioWithAutoSlices]);
  useEffect(() => {
    if (!isPlaying) { setPlayheadSec(-1); return; }
    let id: number;
    const tick = () => {
      setPlayheadSec(trimIn + engine.getCurrentPlayheadSec());
      if (engine.getIsPlaying()) id = requestAnimationFrame(tick); else { setIsPlaying(false); setPlayheadSec(-1); }
    };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, [isPlaying, engine, trimIn]);
  useEffect(() => () => { engine.stop(); }, [engine]);
  const handleBatchAssign = async () => {
    if (!audio || isAssigning) return;
    setIsAssigning(true);
    try {
      const res = executeBatchAssign({ project, masterPCM: audio.pcm, sampleRate: audio.sampleRate, segments, loadProject });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('slicerAssignSuccessToast', { count: res.processedCount }), type: 'success' } }));
      const nextCounts = computeRoleReadinessCounts(res.updatedProject.patterns), otherRole: VocalRole = activeRole === 'puxador' ? 'coro' : 'puxador';
      const otherTotal = otherRole === 'coro' ? nextCounts.coroTotalCount : nextCounts.puxTotalCount, otherReady = otherRole === 'coro' ? nextCounts.coroRecordedCount : nextCounts.puxRecordedCount;
      if (otherTotal > 0 && otherReady < otherTotal) setPostAssignBanner({ assignedRole: activeRole, assignedCount: res.processedCount, nextRole: otherRole });
      else { setPostAssignBanner(null); onClose(); }
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
      const res = extractPatternFromMaster({ rawAudio: audio.pcm, sampleRate: audio.sampleRate, trimInSec: trimIn, trimOutSec: trimOut, beatPegs, warpPct, phraseBpm, role, patternName: patternName.trim() || `Pattern ${Date.now() % 100}`, measuresCount: measures, hasAnacrusis, beatsPerMeasure: 4, beatResolutions: [4, 4, 4, 4], referencePitch: 'C4' });
      const patId = targetPatternId === 'new' ? addPattern(res.role, res.name) : targetPatternId;
      updatePattern(patId, { measuresCount: res.measuresCount, baseBpm: Math.round(res.phraseBpm), bpm: Math.round(res.phraseBpm), hasAnacrusis: res.hasAnacrusis, pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve, anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, t1OffsetSec: res.t1OffsetSec, isMidiInitialized: true, midiLocked: true, hasCanonicalAlignment: true as any, correctedAudioSamples: null, melodyneRegions: [] });
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
          <div className="flex flex-col gap-3">
            <SlicerRoleSessionBar activeRole={activeRole} counts={roleCounts} hasPuxadorMaster={hasPuxadorMaster} hasCoroMaster={hasCoroMaster} postAssignBanner={postAssignBanner} onSelectRoleSession={handleSelectRoleSession} onLoadRoleFile={handleLoadRoleFile} onCloseModal={onClose} />
            <div onClick={() => handleLoadRoleFile(activeRole)} className="border-2 border-dashed border-[var(--cordel-border-panel)] rounded p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[var(--cordel-subcard-bg)]">
              <Upload className="w-8 h-8 text-theme-accent animate-bounce" /><span className="font-bold text-sm text-center">{activeRole === 'puxador' ? 'Importer le fichier maître du Puxador' : 'Importer le fichier maître du Chœur (Coro)'}</span><span className="text-xs text-theme-ink/60 text-center">{t('slicerDropzoneSub')}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <SlicerModeTabs mode={mode} onModeChange={setMode} />
            {mode === 'multi' ? (
              <SlicerMultiSection project={project} audio={audio} segments={segments} onSegmentsChange={handleSegmentsChange} patterns={project.patterns} defaultRole={activeRole} roleCounts={roleCounts} hasPuxadorMaster={hasPuxadorMaster} hasCoroMaster={hasCoroMaster} postAssignBanner={postAssignBanner} onSelectRoleSession={handleSelectRoleSession} onLoadRoleFile={handleLoadRoleFile} onCloseModal={onClose} isAssigning={isAssigning} onExecuteBatchAssign={handleBatchAssign} engine={engine} onProjectUpdate={loadProject} initialGridOffsetSec={gridOffsetSec} />
            ) : (
              <SlicerSingleSection audio={audio} patterns={project.patterns} trimIn={trimIn} trimOut={trimOut} beatPegs={beatPegs} targetPegs={targetPegs} playheadSec={playheadSec} isPlaying={isPlaying} loop={loop} witnessClick={witnessClick} phraseBpm={phraseBpm} warpPct={warpPct} measures={measures} hasAnacrusis={hasAnacrusis} role={role} patternName={patternName} targetPatternId={targetPatternId} isExtracting={isExtracting} lastExtracted={lastExtracted} onTrimChange={(s, e) => { setTrimIn(s); setTrimOut(e); }} onPegsChange={setBeatPegs} onTogglePlay={handleSinglePlay} onToggleLoop={() => { const n = !loop; setLoop(n); engine.setLoop(n); }} onToggleWitnessClick={() => { const n = !witnessClick; setWitnessClick(n); engine.setWitnessClick(n); }} onPlantPeg={() => { const cur = playheadSec >= 0 ? playheadSec : trimIn + 0.1; setBeatPegs((p) => [...p, cur].filter((x) => x >= trimIn && x <= trimOut).sort((a, b) => a - b)); }} onClearPegs={() => setBeatPegs([])} onBpmNudge={(d) => setCustomBpm(Math.max(30, Math.min(240, phraseBpm + d)))} onWarpPctChange={setWarpPct} onMeasuresChange={setMeasures} onHasAnacrusisChange={setHasAnacrusis} onTargetPatternChange={setTargetPatternId} onRoleChange={setRole} onNameChange={setPatternName} onExtract={handleSingleExtract} />
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) loadAudioWithAutoSlices(await decodeAudioFile(f), pendingLoadRoleRef.current); }} className="hidden" />
      </div>
    </div>
  );
};
