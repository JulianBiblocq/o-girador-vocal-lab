/**
 * useMelodyneAudioProcessor.ts
 * Hook gérant l'état des MelodyneRegion, le pré-calcul des marques glottales TD-PSOLA,
 * le recalcul temps réel de la courbe et la synthèse audio débouncée (< 135 lignes).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import { computeCorrectedPitchCurve, correctAudioPitchWithMelodyne, ensureRegionForMovedBrick } from '../audio/melodynePitchCorrector';
import { buildNoteBrickSpans } from '../audio/melodynePitchDecomposer';
import { analyzeVoicingAndEpochs } from '../audio/tdPsolaEpochDetector';
import { createNewMelodyneRegion, updateRegionBounds, deleteMelodyneRegion } from '../components/livret-melodia/melodyneRegionInteractions';

interface UseMelodyneOptions {
  initialRegions?: MelodyneRegion[]; rawAudio: Float32Array; sampleRate: number; totalDurationSec: number;
  rawPitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[]; onAudioUpdated: (pcm: Float32Array | null, regions: MelodyneRegion[]) => void;
}

export function useMelodyneAudioProcessor(options: UseMelodyneOptions) {
  const { initialRegions = [], rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, onAudioUpdated } = options;
  const [regions, setRegions] = useState<MelodyneRegion[]>(initialRegions);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegions[0]?.id ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === selectedRegionId) ?? null, [regions, selectedRegionId]);
  const bricks = useMemo(() => buildNoteBrickSpans(allSteps, rawPitchCurve, totalDurationSec), [allSteps, rawPitchCurve, totalDurationSec]);
  const tdPsolaAnalysis = useMemo(
    () => (rawAudio && rawAudio.length > 0 ? analyzeVoicingAndEpochs(rawAudio, sampleRate, rawPitchCurve, bricks) : undefined),
    [rawAudio, sampleRate, rawPitchCurve, bricks]
  );
  const displayedCurve = useMemo(() => computeCorrectedPitchCurve(rawPitchCurve, allSteps, totalDurationSec, regions), [rawPitchCurve, allSteps, totalDurationSec, regions]);

  const triggerAudioProcessing = useCallback((updatedRegions: MelodyneRegion[], stepsOverride?: VocalStepData[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const targetSteps = stepsOverride ?? allSteps;
    const hasRegionActive = updatedRegions.length > 0 && updatedRegions.some((r) => (r.pitchCenterPct ?? 0) > 0 || (r.driftCorrectionPct ?? 0) > 0 || (r.flattenPct ?? 0) > 0);
    const hasBrickPull = targetSteps.some((s) => s.active && s.note !== '───' && (s.melodynePullPct ?? 0) > 0);
    if (!hasRegionActive && !hasBrickPull) { setIsProcessing(false); onAudioUpdated(null, updatedRegions); return; }
    setIsProcessing(true);
    debounceTimerRef.current = window.setTimeout(() => {
      const targetBricks = stepsOverride ? buildNoteBrickSpans(stepsOverride, rawPitchCurve, totalDurationSec) : bricks;
      const newPCM = correctAudioPitchWithMelodyne(rawAudio, sampleRate, totalDurationSec, rawPitchCurve, targetSteps, updatedRegions, undefined, undefined, tdPsolaAnalysis, targetBricks);
      onAudioUpdated(newPCM, updatedRegions);
      setIsProcessing(false);
    }, 90);
  }, [rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, bricks, tdPsolaAnalysis, onAudioUpdated]);

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
    setRegions((prev) => {
      const next = ensureRegionForMovedBrick(prev, updatedSteps, rootIdx, totalDurationSec);
      triggerAudioProcessing(next, updatedSteps); return next;
    });
  }, [totalDurationSec, triggerAudioProcessing]);

  const updateSelectedRegion = useCallback((partial: Partial<MelodyneRegion>) => {
    if (!selectedRegionId) return;
    setRegions((prev) => {
      const next = prev.map((r) => (r.id === selectedRegionId ? { ...r, ...partial } : r));
      triggerAudioProcessing(next); return next;
    });
  }, [selectedRegionId, triggerAudioProcessing]);

  const updateBounds = useCallback((regionId: string, newStart: number, newEnd: number) => {
    setRegions((prev) => {
      const next = updateRegionBounds(prev, regionId, newStart, newEnd, totalDurationSec);
      triggerAudioProcessing(next); return next;
    });
  }, [totalDurationSec, triggerAudioProcessing]);

  const deleteSelected = useCallback(() => {
    if (!selectedRegionId) return;
    setRegions((prev) => { const next = deleteMelodyneRegion(prev, selectedRegionId); triggerAudioProcessing(next); return next; });
    setSelectedRegionId(null);
  }, [selectedRegionId, triggerAudioProcessing]);

  const clearAllRegions = useCallback(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    setRegions([]); setSelectedRegionId(null); onAudioUpdated(null, []); setIsProcessing(false);
  }, [onAudioUpdated]);

  const restoreRegions = useCallback((newRegions: MelodyneRegion[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    setRegions(newRegions);
    setSelectedRegionId((prev) => (newRegions.some((r) => r.id === prev) ? prev : newRegions[0]?.id ?? null));
    triggerAudioProcessing(newRegions);
  }, [triggerAudioProcessing]);

  const prevStepsRef = useRef<VocalStepData[]>(allSteps);
  useEffect(() => {
    if (prevStepsRef.current !== allSteps) {
      prevStepsRef.current = allSteps;
      triggerAudioProcessing(regions, allSteps);
    }
  }, [allSteps, regions, triggerAudioProcessing]);

  useEffect(() => () => { if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current); }, []);

  return {
    regions, selectedRegionId, selectedRegion, displayedCurve, isProcessing, setSelectedRegionId,
    addRegion, addWholePhraseRegion, applyAutoSweetSpot, syncMovedBrickRegion,
    updateSelectedRegion, updateBounds, deleteSelected, clearAllRegions, restoreRegions,
  };
}
