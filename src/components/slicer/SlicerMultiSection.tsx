/**
 * SlicerMultiSection.tsx
 * Section complète de découpe multi-tranches et assignation aux blocs Toada (< 135 lignes).
 */
import React, { useState, useEffect } from 'react';
import type { DecodedAudioResult } from '../../utils/directAudioImporter';
import type { VocalPatternItem, VocalRole } from '../../types/toadaProject.types';
import type { SliceSegment, PreAssignMode } from '../../types/slicerSegments.types';
import { SlicerAudioEngine } from '../../audio/slicerAudioEngine';
import { detectVocalPhrases } from '../../audio/silenceDetector';
import { SlicerMultiSegmentToolbar } from './SlicerMultiSegmentToolbar';
import { SlicerSegmentWaveform } from './SlicerSegmentWaveform';
import { SlicerSegmentList } from './SlicerSegmentList';
import { Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerMultiSectionProps {
  audio: DecodedAudioResult; segments: SliceSegment[]; patterns: VocalPatternItem[];
  defaultRole: VocalRole; isAssigning: boolean; engine: SlicerAudioEngine;
  onSegmentsChange: (segments: SliceSegment[]) => void;
  onExecuteBatchAssign: () => void; onChangeFile: () => void;
}

export const SlicerMultiSection: React.FC<SlicerMultiSectionProps> = ({
  audio, segments, onSegmentsChange, patterns, defaultRole, isAssigning,
  onExecuteBatchAssign, onChangeFile, engine,
}) => {
  const { t } = useLanguage();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(-1);

  const applyPreAssign = (rawSegments: SliceSegment[], mode: PreAssignMode): SliceSegment[] => {
    const list = mode === 'puxador' ? patterns.filter((p) => p.role === 'puxador') : mode === 'coro' ? patterns.filter((p) => p.role === 'coro') : patterns;
    return rawSegments.map((s, idx) => ({ ...s, targetPatternId: list[idx]?.id ?? (list.length > 0 ? list[idx % list.length].id : 'new') }));
  };

  const handleDetect = () => {
    const detected = detectVocalPhrases(audio.pcm, audio.sampleRate);
    onSegmentsChange(applyPreAssign(detected, defaultRole === 'coro' ? 'coro' : 'puxador'));
  };

  const handlePlaySegment = async (seg: SliceSegment) => {
    if (playingSegmentId === seg.id) { engine.stop(); setPlayingSegmentId(null); setPlayheadSec(-1); return; }
    engine.stop(); setPlayingSegmentId(seg.id);
    const sStart = Math.floor(seg.startSec * audio.sampleRate), sEnd = Math.floor(seg.endSec * audio.sampleRate);
    await engine.play({
      pcm: audio.pcm.slice(sStart, sEnd), sampleRate: audio.sampleRate, loop: false, witnessClick: false,
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

  const handleAddSegmentAt = (sec: number) => {
    const newSeg: SliceSegment = { id: `seg-${Date.now()}`, startSec: Math.max(0, sec - 1.5), endSec: Math.min(audio.durationSec, sec + 1.5), targetPatternId: 'ignore' };
    onSegmentsChange([...segments, newSeg].sort((a, b) => a.startSec - b.startSec));
  };

  const handleSplitSegment = (segId: string) => {
    const target = segments.find((s) => s.id === segId);
    if (!target) return;
    const mid = Math.round(((target.startSec + target.endSec) / 2) * 100) / 100;
    const s1: SliceSegment = { ...target, id: `seg-${Date.now()}-a`, endSec: mid };
    const s2: SliceSegment = { ...target, id: `seg-${Date.now()}-b`, startSec: mid };
    onSegmentsChange(segments.flatMap((s) => (s.id === segId ? [s1, s2] : [s])));
  };

  const activeCount = segments.filter((s) => s.targetPatternId !== 'ignore').length;

  return (
    <div className="flex flex-col gap-2.5">
      <SlicerMultiSegmentToolbar
        segmentCount={segments.length} durationSec={audio.durationSec} onDetectSilences={handleDetect}
        onAddSegment={() => handleAddSegmentAt(audio.durationSec / 2)} onClearSegments={() => onSegmentsChange([])} onChangeFile={onChangeFile}
      />
      <SlicerSegmentWaveform
        pcm={audio.pcm} durationSec={audio.durationSec} segments={segments} selectedSegmentId={selectedSegmentId}
        playheadSec={playheadSec} onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onSeek={setPlayheadSec} onAddSegmentAtSec={handleAddSegmentAt}
      />
      <SlicerSegmentList
        segments={segments} patterns={patterns} playingSegmentId={playingSegmentId} selectedSegmentId={selectedSegmentId}
        onSegmentsChange={onSegmentsChange} onSelectSegment={setSelectedSegmentId} onPlaySegment={handlePlaySegment}
        onSplitSegment={handleSplitSegment} onDeleteSegment={(id) => onSegmentsChange(segments.filter((s) => s.id !== id))}
        onPreAssign={(mode) => onSegmentsChange(applyPreAssign(segments, mode))}
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
