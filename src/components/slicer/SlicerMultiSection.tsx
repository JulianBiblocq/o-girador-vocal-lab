/**
 * SlicerMultiSection.tsx
 * Orchestration multi-tranches avec grille métronome, calquage Organizador et magnétisme (< 145 lignes).
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { DecodedAudioResult } from '../../utils/directAudioImporter';
import type { VocalPatternItem, VocalRole, ToadaProject } from '../../types/toadaProject.types';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { buildOrganizadorSlices } from '../../utils/slicerAlignmentHelper';
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
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(-1);
  const [metronomeActive, setMetronomeActive] = useState(true);
  const [gridOffsetSec, setGridOffsetSec] = useState(0.8);
  const [cascadeMove, setCascadeMove] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const bpm = project.bpm || 55;
  const beatDur = 60 / bpm;
  const measureDur = beatDur * 4;

  const handleAlignOrganizador = useCallback(() => {
    const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
    const generated = buildOrganizadorSlices(patterns, defaultRole, bpm, detected, gridOffsetSec);
    onSegmentsChange(generated);
  }, [patterns, defaultRole, bpm, audio, gridOffsetSec, onSegmentsChange]);

  const handleSyncOrganizador = async () => {
    setIsSyncing(true);
    try {
      const res = await syncProjectWithOrganizador(project);
      if (res) {
        onProjectUpdate?.(res.updatedProject);
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
    req = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(req);
  }, [playingSegmentId, engine, segments]);

  const activeCount = segments.filter((s) => s.targetPatternId !== 'ignore').length;

  return (
    <div className="flex flex-col gap-2.5">
      <SlicerMultiSegmentToolbar
        segmentCount={segments.length} durationSec={audio.durationSec} bpm={bpm} gridOffsetSec={gridOffsetSec}
        metronomeActive={metronomeActive} cascadeMove={cascadeMove} isSyncing={isSyncing}
        onToggleMetronome={() => { const n = !metronomeActive; setMetronomeActive(n); engine.setMetronome(n, bpm, gridOffsetSec); }}
        onNudgeOffset={(d) => setGridOffsetSec((prev) => Math.max(0, Math.round((prev + d) * 100) / 100))}
        onToggleCascade={() => setCascadeMove((v) => !v)} onAlignOrganizador={handleAlignOrganizador}
        onSyncOrganizador={handleSyncOrganizador} onDetectSilences={handleAlignOrganizador}
        onAddSegment={() => onSegmentsChange([...segments, { id: `seg-${Date.now()}`, startSec: gridOffsetSec, endSec: gridOffsetSec + 2 * measureDur, targetPatternId: 'ignore', measuresCount: 2, hasAnacrusis: true, hasTailBeat: true }])}
        onClearSegments={() => onSegmentsChange([])} onChangeFile={onChangeFile}
      />
      <SlicerSegmentWaveform
        pcm={audio.pcm} durationSec={audio.durationSec} segments={segments} selectedSegmentId={selectedSegmentId}
        playheadSec={playheadSec} bpm={bpm} gridOffsetSec={gridOffsetSec} cascadeMove={cascadeMove}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onSeek={setPlayheadSec}
        onAddSegmentAtSec={(sec) => onSegmentsChange([...segments, { id: `seg-${Date.now()}`, startSec: sec, endSec: sec + 2 * measureDur, targetPatternId: 'ignore', measuresCount: 2, hasAnacrusis: true, hasTailBeat: true }])}
        onGridOffsetChange={setGridOffsetSec}
      />
      <SlicerSegmentList
        segments={segments} patterns={patterns} playingSegmentId={playingSegmentId} selectedSegmentId={selectedSegmentId}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onPlaySegment={handlePlaySegment}
        onSplitSegment={(segId) => {
          const t = segments.find((s) => s.id === segId); if (!t) return;
          const mid = (t.startSec + t.endSec) / 2;
          onSegmentsChange(segments.flatMap((s) => s.id === segId ? [{ ...t, id: `seg-${Date.now()}-a`, endSec: mid }, { ...t, id: `seg-${Date.now()}-b`, startSec: mid, targetPatternId: 'new' }] : [s]));
        }}
        onDeleteSegment={(id) => onSegmentsChange(segments.filter((s) => s.id !== id))}
        onPreAssign={(mode) => {
          const list = mode === 'puxador' ? patterns.filter((p) => p.role === 'puxador') : mode === 'coro' ? patterns.filter((p) => p.role === 'coro') : patterns;
          onSegmentsChange(segments.map((s, idx) => ({ ...s, targetPatternId: idx < list.length ? list[idx].id : 'new' })));
        }}
      />
      <button
        type="button" onClick={onExecuteBatchAssign} disabled={isAssigning || activeCount === 0}
        className={`w-full py-2.5 px-4 cordel-btn-primary flex items-center justify-center gap-2 text-xs font-black tracking-wider uppercase cursor-pointer transition-colors bg-emerald-700 hover:bg-emerald-600 text-white shadow-md ${
          activeCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isAssigning ? (<><Loader2 className="w-4 h-4 animate-spin text-[#f4ecd8]" /><span>{t('slicerAssigningProgress')}</span></>)
          : (<><Check className="w-4 h-4 text-[#f4ecd8]" /><span>{t('slicerExecuteBatchAssignBtn', { count: activeCount })}</span></>)}
      </button>
    </div>
  );
};
