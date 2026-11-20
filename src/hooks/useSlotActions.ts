/**
 * useSlotActions.ts
 * Actions de la Frise Conducteur (ajout, insertion positionnelle, suppression, assignation, réordonnancement)
 * extraites de ToadaProjectContext. Aucune action ne modifie `project.patterns` (< 50 lignes).
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { insertSlotAt as insertSlotInList, removeSlotById, reorderSlotList } from '../utils/conductorSlotOps';

export function useSlotActions(setProject: Dispatch<SetStateAction<ToadaProject>>) {
  const insertSlotAt = useCallback((index: number, advanceMeasures?: number) =>
    setProject((prev) => ({ ...prev, slots: insertSlotInList(prev.slots, index, advanceMeasures) })), [setProject]);
  const addSlot = useCallback((advanceMeasures?: number) =>
    setProject((prev) => ({ ...prev, slots: insertSlotInList(prev.slots, prev.slots.length, advanceMeasures) })), [setProject]);
  const removeSlot = useCallback((slotId: string) =>
    setProject((prev) => { const slots = removeSlotById(prev.slots, slotId); return slots === prev.slots ? prev : { ...prev, slots }; }), [setProject]);
  const updateSlot = useCallback((slotId: string, puxadorId: string | null, coroId: string | null, advanceMeasures?: number) =>
    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.slotId === slotId ? { ...s, puxadorPatternId: puxadorId, coroPatternId: coroId, ...(advanceMeasures !== undefined ? { advanceMeasures } : {}) } : s)),
    })), [setProject]);
  const reorderSlots = useCallback((from: number, to: number) =>
    setProject((prev) => { const slots = reorderSlotList(prev.slots, from, to); return slots === prev.slots ? prev : { ...prev, slots }; }), [setProject]);
  return { addSlot, insertSlotAt, removeSlot, updateSlot, reorderSlots };
}
