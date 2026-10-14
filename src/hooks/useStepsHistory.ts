/**
 * useStepsHistory.ts
 * Hook d'historique Annuler / Rétablir (Ctrl+Z / Ctrl+Y) plafonné à 10 niveaux.
 */
import { useState, useCallback } from 'react';
import type { VocalStepData } from '../types/vocalPack.types';

export interface UseStepsHistoryReturn {
  steps: VocalStepData[];
  setSteps: (next: VocalStepData[] | ((prev: VocalStepData[]) => VocalStepData[]), commit?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyCount: number;
}

export function useStepsHistory(initialSteps: VocalStepData[], maxHistory = 10): UseStepsHistoryReturn {
  const [current, setCurrent] = useState<VocalStepData[]>(initialSteps);
  const [past, setPast] = useState<VocalStepData[][]>([]);
  const [future, setFuture] = useState<VocalStepData[][]>([]);

  const setSteps = useCallback((next: VocalStepData[] | ((prev: VocalStepData[]) => VocalStepData[]), commit = true) => {
    setCurrent((prevCurrent) => {
      const resolved = typeof next === 'function' ? next(prevCurrent) : next;
      if (commit) {
        setPast((prevPast) => {
          const clonedPrev = prevCurrent.map((s) => ({ ...s }));
          const nextPast = [...prevPast, clonedPrev];
          return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
        });
        setFuture([]);
      }
      return resolved;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previousState = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);
      setCurrent((curr) => {
        setFuture((prevFuture) => [curr.map((s) => ({ ...s })), ...prevFuture]);
        return previousState;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[0];
      const newFuture = prevFuture.slice(1);
      setCurrent((curr) => {
        setPast((prevPast) => {
          const nextPast = [...prevPast, curr.map((s) => ({ ...s }))];
          return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
        });
        return nextState;
      });
      return newFuture;
    });
  }, [maxHistory]);

  return {
    steps: current,
    setSteps,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historyCount: past.length,
  };
}
