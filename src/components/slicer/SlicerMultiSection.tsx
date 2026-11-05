/**
 * SlicerMultiSection.tsx
 * Orchestration multi-tranches avec grille métronome, calquage Organizador et magnétisme (< 130 lignes).
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { DecodedAudioResult } from '../../utils/directAudioImporter';
import type { VocalPatternItem, VocalRole, ToadaProject } from '../../types/toadaProject.types';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { buildOrganizadorSlices, calculateSliceMetricT1Sec, splitSliceSegment, mergeAdjacentSliceSegments } from '../../utils/slicerAlignmentHelper';
import { syncProjectWithOrganizador } from '../../utils/toadaSyncService';
import { SlicerMultiSegmentToolbar } from './SlicerMultiSegmentToolbar';
import { SlicerSegmentWaveform } from './SlicerSegmentWaveform';
import { SlicerSegmentList } from './SlicerSegmentList';
import { Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerMultiSectionProps {
  project: ToadaProject; audio: DecodedAudioResult; segments: SliceSegment[]; patterns: VocalPatternItem[];
  defaultRole: VocalRole; isAssigning: boolean; engine: SlicerAudioEngine;
  onSegmentsChange: (segments: SliceSegment[]) => void; onExecuteBatchAssign: () => void;
  onChangeFile: () => void; onProjectUpdate?: (p: ToadaProject) => void;
}

export const SlicerMultiSection: React.FC<SlicerMultiSectionProps> = ({
  project, audio, segments, onSegmentsChange, patterns, defaultRole, isAssigning,
  engine, onExecuteBatchAssign, onChangeFile, onProjectUpdate,
}) => {
  const { t } = useLanguage();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null), [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(-1), [metronomeActive, setMetronomeActive] = useState(true);
  const [gridOffsetSec, setGridOffsetSec] = useState(0.8), [cascadeMove, setCascadeMove] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false), [slicerBpm, setSlicerBpm] = useState(project.bpm || 88);
  const bpm = slicerBpm, beatDur = 60 / bpm, measureDur = beatDur * 4;

  useEffect(() => {
    if (project.bpm && project.bpm !== slicerBpm) {
      setSlicerBpm(project.bpm);
      if (metronomeActive) engine.setMetronome(true, project.bpm, gridOffsetSec);
    }
  }, [project.bpm, slicerBpm, metronomeActive, engine, gridOffsetSec]);

  const handleAlignOrganizador = useCallback(() => {
    const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
    onSegmentsChange(buildOrganizadorSlices(patterns, defaultRole, bpm, detected, gridOffsetSec, project.slots));
  }, [patterns, defaultRole, bpm, audio, gridOffsetSec, project.slots, onSegmentsChange]);

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
        setSlicerBpm(freshBpm); if (metronomeActive) engine.setMetronome(true, freshBpm, gridOffsetSec);
        onProjectUpdate?.(res.updatedProject);
        const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
        onSegmentsChange(buildOrganizadorSlices(res.updatedProject.patterns, defaultRole, freshBpm, detected, gridOffsetSec, res.updatedProject.slots));
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: res.toastMessage } }));
      }
    } finally { setIsSyncing(false); }
  };

  const handlePlaySegment = async (seg: SliceSegment) => {
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
        onToggleMetronome={() => { const n = !metronomeActive; setMetronomeActive(n); engine.setMetronome(n, bpm, gridOffsetSec); }}
        onBpmChange={(nb) => { setSlicerBpm(nb); if (metronomeActive) engine.setMetronome(true, nb, gridOffsetSec); onProjectUpdate?.({ ...project, bpm: nb, toadaMeta: project.toadaMeta ? { ...project.toadaMeta, bpmDefaut: nb } : project.toadaMeta, patterns: (project.patterns || []).map((p) => ({ ...p, bpm: nb, baseBpm: nb })) }); }}
        onNudgeOffset={(d) => setGridOffsetSec((prev) => Math.max(0, Math.round((prev + d) * 100) / 100))} onToggleCascade={() => setCascadeMove((v) => !v)}
        onAlignOrganizador={handleAlignOrganizador} onSyncOrganizador={handleSyncOrganizador} onDetectSilences={handleDetectRmsSilences}
        onAddSegment={() => onSegmentsChange([...segments, { id: `seg-${Date.now()}`, startSec: gridOffsetSec, endSec: gridOffsetSec + 2 * measureDur, targetPatternId: 'ignore', measuresCount: 2, hasAnacrusis: true, hasTailBeat: true }])}
        onClearSegments={() => onSegmentsChange([])} onChangeFile={onChangeFile}
      />
      <SlicerSegmentWaveform
        pcm={audio.pcm} durationSec={audio.durationSec} segments={segments} selectedSegmentId={selectedSegmentId} playheadSec={playheadSec} bpm={bpm} gridOffsetSec={gridOffsetSec} cascadeMove={cascadeMove}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onSeek={setPlayheadSec} onGridOffsetChange={setGridOffsetSec}
        onAddSegmentAtSec={(sec) => onSegmentsChange([...segments, { id: `seg-${Date.now()}`, startSec: sec, endSec: sec + 2 * measureDur, targetPatternId: 'ignore', measuresCount: 2, hasAnacrusis: true, hasTailBeat: true }])}
      />
      <SlicerSegmentList
        segments={segments} patterns={patterns} playingSegmentId={playingSegmentId} selectedSegmentId={selectedSegmentId}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onPlaySegment={handlePlaySegment}
        onSplitSegment={(segId) => { const target = segments.find((s) => s.id === segId); if (!target) return; const [s1, s2] = splitSliceSegment(target, (target.startSec + target.endSec) / 2, bpm, gridOffsetSec); onSegmentsChange(segments.flatMap((s) => (s.id === segId ? [s1, s2] : [s]))); }}
        onMergeSegment={(segId) => { const idx = segments.findIndex((s) => s.id === segId); if (idx < 0 || idx >= segments.length - 1) return; const merged = mergeAdjacentSliceSegments(segments[idx], segments[idx + 1], bpm, gridOffsetSec); onSegmentsChange([...segments.slice(0, idx), merged, ...segments.slice(idx + 2)]); }}
        onDeleteSegment={(id) => onSegmentsChange(segments.filter((s) => s.id !== id))}
        onPreAssign={(mode) => { const list = mode === 'puxador' ? patterns.filter((p) => p.role === 'puxador') : mode === 'coro' ? patterns.filter((p) => p.role === 'coro') : patterns; onSegmentsChange(segments.map((s, idx) => ({ ...s, targetPatternId: idx < list.length ? list[idx].id : 'new' }))); }}
      />
      <button type="button" onClick={onExecuteBatchAssign} disabled={isAssigning || activeCount === 0} className={`w-full sm:w-auto sm:min-w-[320px] self-end py-2.5 px-6 cordel-btn-primary flex items-center justify-center gap-2 text-xs font-black tracking-wider uppercase cursor-pointer transition-colors bg-emerald-700 hover:bg-emerald-600 text-white shadow-md ${activeCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {isAssigning ? (<><Loader2 className="w-4 h-4 animate-spin text-[#f4ecd8]" /><span>{t('slicerAssigningProgress')}</span></>) : (<><Check className="w-4 h-4 text-[#f4ecd8]" /><span>{t('slicerExecuteBatchAssignBtn', { count: activeCount })}</span></>)}
      </button>
    </div>
  );
};
