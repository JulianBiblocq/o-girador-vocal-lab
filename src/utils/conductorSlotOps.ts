/**
 * conductorSlotOps.ts
 * Opérations pures sur les colonnes (slots) de la Frise Conducteur : insertion à l'endroit voulu, ajout en fin.
 * Un slot ne référence que des `patternId` immuables : insérer / retirer une colonne ne touche JAMAIS `patterns`
 * ni les audios des autres blocs (< 60 lignes).
 */
import type { ToadaArrangementSlot } from '../types/toadaProject.types';

export function createEmptySlot(existing: ToadaArrangementSlot[], advanceMeasures?: number): ToadaArrangementSlot {
  const taken = new Set(existing.map((s) => s.slotId));
  let n = existing.length, slotId = `slot-${Date.now().toString(36)}-${n}`;
  while (taken.has(slotId)) slotId = `slot-${Date.now().toString(36)}-${++n}`;
  return { slotId, puxadorPatternId: null, coroPatternId: null, ...(typeof advanceMeasures === 'number' ? { advanceMeasures } : {}) };
}

/** Insère une colonne vide à l'index donné (0 = avant la 1re, longueur = fin de frise) et retourne un NOUVEAU tableau. */
export function insertSlotAt(slots: ToadaArrangementSlot[], index: number, advanceMeasures?: number): ToadaArrangementSlot[] {
  const at = Math.max(0, Math.min(slots.length, Number.isFinite(index) ? Math.trunc(index) : slots.length));
  const next = [...slots];
  next.splice(at, 0, createEmptySlot(slots, advanceMeasures));
  return next;
}

export function removeSlotById(slots: ToadaArrangementSlot[], slotId: string): ToadaArrangementSlot[] {
  return slots.length <= 1 ? slots : slots.filter((s) => s.slotId !== slotId);
}

export function reorderSlotList(slots: ToadaArrangementSlot[], from: number, to: number): ToadaArrangementSlot[] {
  if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return slots;
  const next = [...slots]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
  return next;
}
