/**
 * usePatternSelection.ts
 * Hook de sélection multiple de patterns et portée métrique ('all' | 'active' | 'selected') (< 50 lignes).
 */
import { useState, useCallback } from 'react';
import type { MetricApplyScope } from '../utils/projectBatchOps';

export function usePatternSelection(allPatternIds: string[]) {
  const [applyScope, setApplyScope] = useState<MetricApplyScope>('all');
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>([]);

  const toggleSelectPattern = useCallback((id: string) => {
    setSelectedPatternIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((pId) => pId !== id) : [...prev, id];
      if (next.length > 0) setApplyScope('selected');
      else if (applyScope === 'selected') setApplyScope('all');
      return next;
    });
  }, [applyScope]);

  const selectAllPatterns = useCallback((select: boolean) => {
    if (select) {
      setSelectedPatternIds(allPatternIds);
      if (allPatternIds.length > 0) setApplyScope('selected');
    } else {
      setSelectedPatternIds([]);
      if (applyScope === 'selected') setApplyScope('all');
    }
  }, [allPatternIds, applyScope]);

  const clearSelectedPatterns = useCallback(() => {
    setSelectedPatternIds([]);
    if (applyScope === 'selected') setApplyScope('all');
  }, [applyScope]);

  return {
    applyScope,
    setApplyScope,
    selectedPatternIds,
    toggleSelectPattern,
    selectAllPatterns,
    clearSelectedPatterns,
  };
}
