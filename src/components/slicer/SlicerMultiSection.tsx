/**
 * SlicerMultiSection.tsx
 * Orchestration multi-tranches avec grille métronome, commutateur [Avec les trous | Phrases à la suite] et magnétisme (< 145 lignes).
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { DecodedAudioResult } from '../../utils/directAudioImporter';
import type { VocalPatternItem, VocalRole, ToadaProject } from '../../types/toadaProject.types';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { buildOrganizadorSlices, calculateInitialMasterGridOffsetSec, calculateSliceMetricT1Sec, splitSliceSegment, mergeAdjacentSliceSegments, type SlicerGapMode } from '../../utils/slicerAlignmentHelper';
import { insertPauseInSlices, insertVocalSliceAt, shiftSliceAndFollowingByMeasures, reorderSlicesWithCascade, updatePauseMeasuresWithCascade, deleteSliceWithCascade } from '../../utils/slicerCascadeHelper';
import { syncProjectWithOrganizador } from '../../utils/toadaSyncService';
import { SlicerMultiSegmentToolbar } from './SlicerMultiSegmentToolbar';
import { SlicerSegmentWaveform } from './SlicerSegmentWaveform';
import { SlicerSegmentList } from './SlicerSegmentList';
import { Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerMultiSectionProps {
  project: ToadaProject; audio: DecodedAudioResult; segments: SliceSegment[]; patterns: VocalPatternItem[];
  defaultRole: VocalRole; isAssigning: boolean; engine: SlicerAudioEngine; initialGridOffsetSec?: number;
  onSegmentsChange: (segments: SliceSegment[]) => void; onExecuteBatchAssign: () => void;
  onChangeFile: () => void; onProjectUpdate?: (p: ToadaProject) => void;
}

export const SlicerMultiSection: React.FC<SlicerMultiSectionProps> = ({
  project, audio, segments, onSegmentsChange, patterns, defaultRole, isAssigning,
  engine, initialGridOffsetSec, onExecuteBatchAssign, onChangeFile, onProjectUpdate,
}) => {
  const { t } = useLanguage();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null), [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(-1), [metronomeActive, setMetronomeActive] = useState(true);
  const [gridOffsetSec, setGridOffsetSec] = useState(initialGridOffsetSec ?? 0.1), [cascadeMove, setCascadeMove] = useState(true);
  const [gapMode, setGapMode] = useState<SlicerGapMode>('with_gaps'), [isSyncing, setIsSyncing] = useState(false);
  const [slicerBpm, setSlicerBpm] = useState(project.bpm || 88);
  const bpm = slicerBpm, beatDur = 60 / bpm, measureDur = beatDur * 4;

  useEffect(() => { if (typeof initialGridOffsetSec === 'number') setGridOffsetSec(initialGridOffsetSec); }, [initialGridOffsetSec]);

  useEffect(() => {
    if (project.bpm && project.bpm !== slicerBpm) {
      setSlicerBpm(project.bpm);
      if (metronomeActive) engine.setMetronome(true, project.bpm, gridOffsetSec);
    }
  }, [project.bpm, slicerBpm, metronomeActive, engine, gridOffsetSec]);

  const applyAlignment = useCallback((mode: SlicerGapMode, customOffset?: number) => {
    const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
    const effOff = typeof customOffset === 'number' ? customOffset : calculateInitialMasterGridOffsetSec(patterns, defaultRole, bpm, detected, project.slots);
    setGridOffsetSec(effOff);
    onSegmentsChange(buildOrganizadorSlices(patterns, defaultRole, bpm, detected, effOff, project.slots, audio.pcm, audio.sampleRate, mode));
  }, [patterns, defaultRole, bpm, audio, project.slots, onSegmentsChange]);

  const handleGapModeChange = useCallback((nextMode: SlicerGapMode) => { setGapMode(nextMode); applyAlignment(nextMode, gridOffsetSec); }, [applyAlignment, gridOffsetSec]);

  const handleDetectRmsSilences = useCallback(() => {
    const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
    const rolePats = patterns.filter((p) => p.role === defaultRole), list = rolePats.length > 0 ? rolePats : patterns;
    onSegmentsChange(detected.map((seg, idx) => {
      const pat = list[idx], hasAnacrusis = pat ? pat.hasAnacrusis !== false : seg.hasAnacrusis !== false, anacrusisBeats = pat?.anacrusisBeats ?? (hasAnacrusis ? 2 : 0);
      return { ...seg, targetPatternId: pat ? pat.id : 'new', role: pat?.role ?? defaultRole, name: pat?.name, measuresCount: pat?.measuresCount ?? seg.measuresCount ?? 2, hasAnacrusis, anacrusisBeats, metricT1Sec: calculateSliceMetricT1Sec(seg.startSec, bpm, gridOffsetSec, hasAnacrusis, anacrusisBeats) };
    }));
  }, [audio, patterns, defaultRole, bpm, gridOffsetSec, onSegmentsChange]);

  const handleSyncOrganizador = async () => {
    setIsSyncing(true);
    try {
      const res = await syncProjectWithOrganizador(project, project.toadaMeta?.groupId);
      if (res) {
        const freshBpm = res.updatedProject.bpm || 88;
        const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
        const autoOff = calculateInitialMasterGridOffsetSec(res.updatedProject.patterns, defaultRole, freshBpm, detected, res.updatedProject.slots);
        setSlicerBpm(freshBpm); setGridOffsetSec(autoOff); if (metronomeActive) engine.setMetronome(true, freshBpm, autoOff);
        onProjectUpdate?.(res.updatedProject);
        onSegmentsChange(buildOrganizadorSlices(res.updatedProject.patterns, defaultRole, freshBpm, detected, autoOff, res.updatedProject.slots, audio.pcm, audio.sampleRate, gapMode));
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: res.toastMessage } }));
      }
    } finally { setIsSyncing(false); }
  };

  const handlePlaySegment = async (seg: SliceSegment) => {
    setSelectedSegmentId(seg.id);
    if (playingSegmentId === seg.id) { engine.stop(); setPlayingSegmentId(null); setPlayheadSec(-1); return; }
    engine.stop(); setPlayingSegmentId(seg.id);
    const sStart = Math.floor(seg.startSec * audio.sampleRate), sEnd = Math.floor(seg.endSec * audio.sampleRate);
    await engine.play({
      pcm: audio.pcm.slice(sStart, sEnd), sampleRate: audio.sampleRate, loop: false, witnessClick: false,
      metronomeClick: metronomeActive, bpm, gridOffsetSec: gridOffsetSec - seg.startSec,
      targetPegsRelativeSec: [], onEnded: () => { setPlayingSegmentId(null); setPlayheadSec(-1); },
    });
  };

  useEffect(() => {
    if (!playingSegmentId) return;
    let req: number;
    const tick = () => {
      const seg = segments.find((s) => s.id === playingSegmentId);
      if (seg && engine.getIsPlaying()) { setPlayheadSec(seg.startSec + engine.getCurrentPlayheadSec()); req = requestAnimationFrame(tick); }
      else setPlayheadSec(-1);
    };
    req = requestAnimationFrame(tick); return () => cancelAnimationFrame(req);
  }, [playingSegmentId, engine, segments]);

  const activeCount = segments.filter((s) => s.targetPatternId !== 'ignore').length;

  return (
    <div className="flex flex-col gap-2.5">
      <SlicerMultiSegmentToolbar
        segmentCount={segments.length} durationSec={audio.durationSec} bpm={bpm} gridOffsetSec={gridOffsetSec} metronomeActive={metronomeActive} cascadeMove={cascadeMove} isSyncing={isSyncing}
        gapMode={gapMode} onGapModeChange={handleGapModeChange}
        onToggleMetronome={() => { const n = !metronomeActive; setMetronomeActive(n); engine.setMetronome(n, bpm, gridOffsetSec); }}
        onBpmChange={(nb) => { const det = detectVocalPhrases(audio.pcm, audio.sampleRate), off = calculateInitialMasterGridOffsetSec(patterns, defaultRole, nb, det, project.slots); setSlicerBpm(nb); setGridOffsetSec(off); if (metronomeActive) engine.setMetronome(true, nb, off); onSegmentsChange(buildOrganizadorSlices(patterns, defaultRole, nb, det, off, project.slots, audio.pcm, audio.sampleRate, gapMode)); onProjectUpdate?.({ ...project, bpm: nb, toadaMeta: project.toadaMeta ? { ...project.toadaMeta, bpmDefaut: nb } : project.toadaMeta, patterns: (project.patterns || []).map((p) => ({ ...p, bpm: nb, baseBpm: nb })) }); }}
        onNudgeOffset={(d) => { const nextOff = Math.max(0, Math.round((gridOffsetSec + d) * 100) / 100); applyAlignment(gapMode, nextOff); }} onToggleCascade={() => setCascadeMove((v) => !v)}
        onAlignOrganizador={() => applyAlignment(gapMode)} onSyncOrganizador={handleSyncOrganizador} onDetectSilences={handleDetectRmsSilences}
        onAddSegment={() => onSegmentsChange(insertVocalSliceAt(segments, segments.length, 2, bpm, gridOffsetSec))}
        onAddPauseSegment={() => onSegmentsChange(insertPauseInSlices(segments, segments.length, 1, bpm, gridOffsetSec))}
        onClearSegments={() => onSegmentsChange([])} onChangeFile={onChangeFile}
      />
      <SlicerSegmentWaveform
        pcm={audio.pcm} durationSec={audio.durationSec} segments={segments} selectedSegmentId={selectedSegmentId} playheadSec={playheadSec} bpm={bpm} gridOffsetSec={gridOffsetSec} cascadeMove={cascadeMove}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onSeek={setPlayheadSec} onGridOffsetChange={(off) => applyAlignment(gapMode, off)}
        onAddSegmentAtSec={(sec) => onSegmentsChange([...segments, { id: `seg-${Date.now()}`, startSec: sec, endSec: sec + 2 * measureDur, targetPatternId: 'ignore', measuresCount: 2, hasAnacrusis: true, hasTailBeat: true }])}
      />
      <SlicerSegmentList
        segments={segments} patterns={patterns} playingSegmentId={playingSegmentId} selectedSegmentId={selectedSegmentId}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onPlaySegment={handlePlaySegment}
        onSplitSegment={(segId) => { const target = segments.find((s) => s.id === segId); if (!target) return; const [s1, s2] = splitSliceSegment(target, (target.startSec + target.endSec) / 2, bpm, gridOffsetSec); onSegmentsChange(segments.flatMap((s) => (s.id === segId ? [s1, s2] : [s]))); }}
        onMergeSegment={(segId) => { const idx = segments.findIndex((s) => s.id === segId); if (idx < 0 || idx >= segments.length - 1) return; const merged = mergeAdjacentSliceSegments(segments[idx], segments[idx + 1], bpm, gridOffsetSec); onSegmentsChange([...segments.slice(0, idx), merged, ...segments.slice(idx + 2)]); }}
        onDeleteSegment={(id) => { const idx = segments.findIndex((s) => s.id === id); if (idx >= 0) onSegmentsChange(deleteSliceWithCascade(segments, idx, bpm, cascadeMove)); }}
        onMoveSegment={(fromIdx, toIdx) => onSegmentsChange(reorderSlicesWithCascade(segments, fromIdx, toIdx, bpm))}
        onShiftMeasures={(idx, deltaM) => onSegmentsChange(shiftSliceAndFollowingByMeasures(segments, idx, deltaM, bpm))}
        onInsertPauseBefore={(idx) => onSegmentsChange(insertPauseInSlices(segments, idx, 1, bpm, gridOffsetSec))}
        onInsertSliceAfter={(idx) => onSegmentsChange(insertVocalSliceAt(segments, idx, 2, bpm, gridOffsetSec))}
        onUpdatePauseMeasures={(idx, m) => onSegmentsChange(updatePauseMeasuresWithCascade(segments, idx, m, bpm))}
        onPreAssign={(mode) => {
          const list = mode === 'puxador' ? patterns.filter((p) => p.role === 'puxador') : mode === 'coro' ? patterns.filter((p) => p.role === 'coro') : patterns;
          let vIdx = 0;
          onSegmentsChange(segments.map((s) => (s.isPause ? { ...s, targetPatternId: 'ignore' } : { ...s, targetPatternId: list[vIdx++]?.id ?? 'new' })));
        }}
      />
      <button type="button" onClick={onExecuteBatchAssign} disabled={isAssigning || activeCount === 0} className={`w-full sm:w-auto sm:min-w-[320px] self-end py-2.5 px-6 cordel-btn-primary flex items-center justify-center gap-2 text-xs font-black tracking-wider uppercase cursor-pointer transition-colors bg-emerald-700 hover:bg-emerald-600 text-white shadow-md ${activeCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {isAssigning ? (<><Loader2 className="w-4 h-4 animate-spin text-[#f4ecd8]" /><span>{t('slicerAssigningProgress')}</span></>) : (<><Check className="w-4 h-4 text-[#f4ecd8]" /><span>{t('slicerExecuteBatchAssignBtn', { count: activeCount })}</span></>)}
      </button>
    </div>
  );
};
