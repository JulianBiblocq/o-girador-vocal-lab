/**
 * useMelodyneAudioProcessor.ts
 * Hook gérant l'état des MelodyneRegion, la courbe d'aperçu 60 FPS sur le Piano Roll
 * et la synthèse TD-PSOLA déportée dans le Web Worker DSP avec Latest-Wins (`dedupeKey`) (< 120 lignes).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import { computeCorrectedPitchCurve, ensureRegionForMovedBrick } from '../audio/melodynePitchCorrector';
import { createNewMelodyneRegion, updateRegionBounds, deleteMelodyneRegion } from '../components/livret-melodia/melodyneRegionInteractions';
import { renderVoiceDspInWorker, isVocalDspCancelled } from '../workers/vocalDspWorkerClient';

interface UseMelodyneOptions {
  patternId?: string;
  initialRegions?: MelodyneRegion[];
  rawAudio: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  rawPitchCurve: PitchCurvePoint[];
  allSteps: VocalStepData[];
  onAudioUpdated: (pcm: Float32Array | null, regions: MelodyneRegion[]) => void;
}

export function useMelodyneAudioProcessor(options: UseMelodyneOptions) {
  const { patternId = 'default', initialRegions = [], rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, onAudioUpdated } = options;
  const [regions, setRegions] = useState<MelodyneRegion[]>(initialRegions);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegions[0]?.id ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const jobTokenRef = useRef(0);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === selectedRegionId) ?? null, [regions, selectedRegionId]);
  const displayedCurve = useMemo(() => computeCorrectedPitchCurve(rawPitchCurve, allSteps, totalDurationSec, regions), [rawPitchCurve, allSteps, totalDurationSec, regions]);

  const triggerAudioProcessing = useCallback((updatedRegions: MelodyneRegion[], stepsOverride?: VocalStepData[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const targetSteps = stepsOverride ?? allSteps;
    const hasRegionActive = updatedRegions.length > 0 && updatedRegions.some((r) => (r.pitchCenterPct ?? 0) > 0 || (r.driftCorrectionPct ?? 0) > 0 || (r.flattenPct ?? 0) > 0);
    const hasBrickPull = targetSteps.some((s) => s.active && s.note !== '───' && (s.melodynePullPct ?? 0) > 0);
    if (!hasRegionActive && !hasBrickPull || !rawAudio || rawAudio.length === 0) {
      jobTokenRef.current += 1; setIsProcessing(false); onAudioUpdated(null, updatedRegions); return;
    }
    const token = ++jobTokenRef.current;
    setIsProcessing(true);
    debounceTimerRef.current = window.setTimeout(() => {
      renderVoiceDspInWorker({
        mode: 'melodyne', pcm: rawAudio, sampleRate, totalDurationSec,
        rawPitchCurve, allSteps: targetSteps, regions: updatedRegions,
      }, { dedupeKey: `melodyne_preview_${patternId}` }).then((res) => {
        if (jobTokenRef.current !== token) return;
        onAudioUpdated(res.processedPCM, updatedRegions);
        setIsProcessing(false);
      }).catch((err) => {
        if (isVocalDspCancelled(err)) return;
        if (jobTokenRef.current === token) setIsProcessing(false);
      });
    }, 60);
  }, [patternId, rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, onAudioUpdated]);

  const addRegion = useCallback((startSec: number, endSec: number) => {
    const newReg = createNewMelodyneRegion(startSec, endSec, totalDurationSec);
    setRegions((prev) => { const next = [...prev, newReg]; triggerAudioProcessing(next); return next; });
    setSelectedRegionId(newReg.id);
  }, [totalDurationSec, triggerAudioProcessing]);

  const addWholePhraseRegion = useCallback(() => {
    const newReg = createNewMelodyneRegion(0, totalDurationSec, totalDurationSec, 65, 0, 80);
    setRegions((prev) => { const next = [...prev, newReg]; triggerAudioProcessing(next); return next; });
    setSelectedRegionId(newReg.id);
  }, [totalDurationSec, triggerAudioProcessing]);

  const applyAutoSweetSpot = useCallback(() => {
    const sweetReg = createNewMelodyneRegion(0, totalDurationSec, totalDurationSec, 75, 0, 80);
    setRegions([sweetReg]); setSelectedRegionId(sweetReg.id); triggerAudioProcessing([sweetReg]);
  }, [totalDurationSec, triggerAudioProcessing]);

  const syncMovedBrickRegion = useCallback((rootIdx: number, updatedSteps: VocalStepData[]) => {
    setRegions((prev) => { const next = ensureRegionForMovedBrick(prev, updatedSteps, rootIdx, totalDurationSec); triggerAudioProcessing(next, updatedSteps); return next; });
  }, [totalDurationSec, triggerAudioProcessing]);

  const updateSelectedRegion = useCallback((partial: Partial<MelodyneRegion>) => {
    if (!selectedRegionId) return;
    setRegions((prev) => { const next = prev.map((r) => (r.id === selectedRegionId ? { ...r, ...partial } : r)); triggerAudioProcessing(next); return next; });
  }, [selectedRegionId, triggerAudioProcessing]);

  const updateBounds = useCallback((regionId: string, newStart: number, newEnd: number) => {
    setRegions((prev) => { const next = updateRegionBounds(prev, regionId, newStart, newEnd, totalDurationSec); triggerAudioProcessing(next); return next; });
  }, [totalDurationSec, triggerAudioProcessing]);

  const deleteSelected = useCallback(() => {
    if (!selectedRegionId) return;
    setRegions((prev) => { const next = deleteMelodyneRegion(prev, selectedRegionId); triggerAudioProcessing(next); return next; });
    setSelectedRegionId(null);
  }, [selectedRegionId, triggerAudioProcessing]);

  const clearAllRegions = useCallback(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    jobTokenRef.current += 1; setRegions([]); setSelectedRegionId(null); onAudioUpdated(null, []); setIsProcessing(false);
  }, [onAudioUpdated]);

  const restoreRegions = useCallback((newRegions: MelodyneRegion[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    setRegions(newRegions);
    setSelectedRegionId((prev) => (newRegions.some((r) => r.id === prev) ? prev : newRegions[0]?.id ?? null));
    triggerAudioProcessing(newRegions);
  }, [triggerAudioProcessing]);

  const prevStepsRef = useRef<VocalStepData[]>(allSteps);
  useEffect(() => {
    if (prevStepsRef.current !== allSteps) { prevStepsRef.current = allSteps; triggerAudioProcessing(regions, allSteps); }
  }, [allSteps, regions, triggerAudioProcessing]);
  useEffect(() => () => { if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current); jobTokenRef.current += 1; }, []);

  return {
    regions, selectedRegionId, selectedRegion, displayedCurve, isProcessing, setSelectedRegionId,
    addRegion, addWholePhraseRegion, applyAutoSweetSpot, syncMovedBrickRegion,
    updateSelectedRegion, updateBounds, deleteSelected, clearAllRegions, restoreRegions,
  };
}
