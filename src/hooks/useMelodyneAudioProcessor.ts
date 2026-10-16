/**
 * useMelodyneAudioProcessor.ts
 * Hook personnalisé gérant l'état des MelodyneRegion, le recalcul temps réel de la courbe
 * et le processing audio WSOLA asynchrone débouncé (< 120 lignes).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import {
  computeCorrectedPitchCurve,
  correctAudioPitchWithMelodyne,
} from '../audio/melodynePitchCorrector';
import { createNewMelodyneRegion, updateRegionBounds, deleteMelodyneRegion } from '../components/livret-melodia/melodyneRegionInteractions';

interface UseMelodyneOptions {
  initialRegions?: MelodyneRegion[];
  rawAudio: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  rawPitchCurve: PitchCurvePoint[];
  allSteps: VocalStepData[];
  onAudioUpdated: (pcm: Float32Array | null, regions: MelodyneRegion[]) => void;
}

export function useMelodyneAudioProcessor(options: UseMelodyneOptions) {
  const { initialRegions = [], rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, onAudioUpdated } = options;
  const [regions, setRegions] = useState<MelodyneRegion[]>(initialRegions);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegions[0]?.id ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === selectedRegionId) ?? null, [regions, selectedRegionId]);

  // Courbe de pitch 60 FPS immédiate
  const displayedCurve = useMemo(() => {
    return computeCorrectedPitchCurve(rawPitchCurve, allSteps, totalDurationSec, regions);
  }, [rawPitchCurve, allSteps, totalDurationSec, regions]);

  // Recalcul audio WSOLA asynchrone débouncé (bypass strict à null si aucune correction)
  const triggerAudioProcessing = useCallback((updatedRegions: MelodyneRegion[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const hasActive = updatedRegions.length > 0 && updatedRegions.some((r) => r.pitchCenterPct > 0 || r.flattenPct > 0);
    if (!hasActive) {
      setIsProcessing(false);
      onAudioUpdated(null, updatedRegions);
      return;
    }
    setIsProcessing(true);
    debounceTimerRef.current = window.setTimeout(() => {
      const newPCM = correctAudioPitchWithMelodyne(rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, updatedRegions);
      onAudioUpdated(newPCM, updatedRegions);
      setIsProcessing(false);
    }, 150);
  }, [rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, onAudioUpdated]);

  const addRegion = useCallback((startSec: number, endSec: number) => {
    const newReg = createNewMelodyneRegion(startSec, endSec, totalDurationSec);
    setRegions((prev) => {
      const next = [...prev, newReg];
      triggerAudioProcessing(next);
      return next;
    });
    setSelectedRegionId(newReg.id);
  }, [totalDurationSec, triggerAudioProcessing]);

  const addWholePhraseRegion = useCallback(() => {
    const newReg = createNewMelodyneRegion(0, totalDurationSec, totalDurationSec, 50, 50);
    setRegions((prev) => {
      const next = [...prev, newReg];
      triggerAudioProcessing(next);
      return next;
    });
    setSelectedRegionId(newReg.id);
  }, [totalDurationSec, triggerAudioProcessing]);

  const updateSelectedRegion = useCallback((partial: Partial<MelodyneRegion>) => {
    if (!selectedRegionId) return;
    setRegions((prev) => {
      const next = prev.map((r) => (r.id === selectedRegionId ? { ...r, ...partial } : r));
      triggerAudioProcessing(next);
      return next;
    });
  }, [selectedRegionId, triggerAudioProcessing]);

  const updateBounds = useCallback((regionId: string, newStart: number, newEnd: number) => {
    setRegions((prev) => {
      const next = updateRegionBounds(prev, regionId, newStart, newEnd, totalDurationSec);
      triggerAudioProcessing(next);
      return next;
    });
  }, [totalDurationSec, triggerAudioProcessing]);

  const deleteSelected = useCallback(() => {
    if (!selectedRegionId) return;
    setRegions((prev) => {
      const next = deleteMelodyneRegion(prev, selectedRegionId);
      triggerAudioProcessing(next);
      return next;
    });
    setSelectedRegionId(null);
  }, [selectedRegionId, triggerAudioProcessing]);

  const clearAllRegions = useCallback(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    setRegions([]);
    setSelectedRegionId(null);
    onAudioUpdated(null, []);
    setIsProcessing(false);
  }, [onAudioUpdated]);

  const restoreRegions = useCallback((newRegions: MelodyneRegion[]) => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    setRegions(newRegions);
    setSelectedRegionId((prev) => (newRegions.some((r) => r.id === prev) ? prev : newRegions[0]?.id ?? null));
    triggerAudioProcessing(newRegions);
  }, [triggerAudioProcessing]);

  useEffect(() => () => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
  }, []);

  return {
    regions,
    selectedRegionId,
    selectedRegion,
    displayedCurve,
    isProcessing,
    setSelectedRegionId,
    addRegion,
    addWholePhraseRegion,
    updateSelectedRegion,
    updateBounds,
    deleteSelected,
    clearAllRegions,
    restoreRegions,
  };
}
