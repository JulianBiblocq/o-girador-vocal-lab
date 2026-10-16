/**
 * useStepsHistory.ts
 * Historique complet Annuler / Rétablir du Livret 2 (30 snapshots atomiques) (< 115 lignes).
 * Sauvegarde atomiquement : steps, rawPitchCurve, melodyneRegions et assignedLyricsText.
 */
import { useState, useCallback, useRef } from 'react';
import type { VocalStepData, PitchCurvePoint, MelodyneRegion } from '../types/vocalPack.types';

export interface LivretMelodiaSnapshot {
  steps: VocalStepData[];
  rawPitchCurve: PitchCurvePoint[];
  melodyneRegions: MelodyneRegion[];
  assignedLyricsText: string;
}

export interface UseStepsHistoryOptions {
  initialSnapshot: LivretMelodiaSnapshot;
  maxHistory?: number;
  onRestore?: (snapshot: LivretMelodiaSnapshot) => void;
}

export interface UseStepsHistoryReturn {
  currentSnapshot: LivretMelodiaSnapshot;
  steps: VocalStepData[];
  setSteps: (next: VocalStepData[] | ((prev: VocalStepData[]) => VocalStepData[]), commit?: boolean) => void;
  commitSnapshot: (snapshot: LivretMelodiaSnapshot) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyCount: number;
}

function cloneSnapshot(s: LivretMelodiaSnapshot): LivretMelodiaSnapshot {
  return {
    steps: s.steps.map((st) => ({ ...st })),
    rawPitchCurve: s.rawPitchCurve.map((pt) => ({ ...pt })),
    melodyneRegions: s.melodyneRegions.map((r) => ({ ...r })),
    assignedLyricsText: s.assignedLyricsText ?? '',
  };
}

export function useStepsHistory(options: UseStepsHistoryOptions): UseStepsHistoryReturn {
  const { initialSnapshot, maxHistory = 30, onRestore } = options;
  const [current, setCurrent] = useState<LivretMelodiaSnapshot>(() => cloneSnapshot(initialSnapshot));
  const [past, setPast] = useState<LivretMelodiaSnapshot[]>([]);
  const [future, setFuture] = useState<LivretMelodiaSnapshot[]>([]);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const commitSnapshot = useCallback((nextSnapshot: LivretMelodiaSnapshot) => {
    setCurrent((prevCurrent) => {
      const clonedPrev = cloneSnapshot(prevCurrent);
      setPast((prevPast) => {
        const nextPast = [...prevPast, clonedPrev];
        return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
      });
      setFuture([]);
      return cloneSnapshot(nextSnapshot);
    });
  }, [maxHistory]);

  const setSteps = useCallback((next: VocalStepData[] | ((prev: VocalStepData[]) => VocalStepData[]), commit = true) => {
    setCurrent((prevCurrent) => {
      const resolvedSteps = typeof next === 'function' ? next(prevCurrent.steps) : next;
      const nextSnap: LivretMelodiaSnapshot = { ...prevCurrent, steps: resolvedSteps };
      if (commit) {
        const clonedPrev = cloneSnapshot(prevCurrent);
        setPast((prevPast) => {
          const nextPast = [...prevPast, clonedPrev];
          return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
        });
        setFuture([]);
      }
      return nextSnap;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previousState = prevPast[prevPast.length - 1];
      const nextPast = prevPast.slice(0, prevPast.length - 1);
      setCurrent((curr) => {
        setFuture((prevFuture) => [cloneSnapshot(curr), ...prevFuture]);
        onRestoreRef.current?.(previousState);
        return previousState;
      });
      return nextPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[0];
      const nextFuture = prevFuture.slice(1);
      setCurrent((curr) => {
        setPast((prevPast) => {
          const nextPast = [...prevPast, cloneSnapshot(curr)];
          return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
        });
        onRestoreRef.current?.(nextState);
        return nextState;
      });
      return nextFuture;
    });
  }, [maxHistory]);

  return {
    currentSnapshot: current,
    steps: current.steps,
    setSteps,
    commitSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historyCount: past.length,
  };
}
