/**
 * ToadaProjectContext.tsx
 * Gestion centralisee de la Toada (Patterns, Matrice de Declinaisons & Conducteur).
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  type ToadaProject, type VocalPatternItem, type VocalRole, type VocalAudioVariant,
  createDefaultToadaProject, createDefaultVocalPattern, createDefaultVariant,
} from '../types/toadaProject.types';

interface ToadaProjectContextValue {
  project: ToadaProject; activePattern: VocalPatternItem; activeVariant: VocalAudioVariant;
  cueMode: string; setActivePatternId: (id: string) => void;
  setActiveVariantKey: (patternId: string, variantKey: string) => void;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  ensureVariantExists: (patternId: string, speedRatio: number, pitchShiftSemitones: number) => string;
  addPattern: (role: VocalRole, name?: string) => string;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  removePattern: (id: string) => void;
  addSlot: () => void; removeSlot: (slotId: string) => void;
  updateSlot: (slotId: string, puxadorId: string | null, coroId: string | null) => void;
  setCueMode: (mode: string) => void; getPreviousConductorPattern: () => VocalPatternItem | null;
}

const ToadaContext = createContext<ToadaProjectContextValue | null>(null);

export const ToadaProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ToadaProject>(() => createDefaultToadaProject());
  const [cueMode, setCueMode] = useState<string>('auto_previous');

  const activePattern = useMemo(() => {
    return project.patterns.find((p) => p.id === project.activePatternId) ?? project.patterns[0];
  }, [project.patterns, project.activePatternId]);

  const activeVariant = useMemo(() => {
    return activePattern.variants[activePattern.activeVariantKey]
      ?? Object.values(activePattern.variants)[0] ?? createDefaultVariant(1.0, 0);
  }, [activePattern]);

  const setActivePatternId = useCallback((id: string) => {
    setProject((prev) => ({ ...prev, activePatternId: id }));
  }, []);

  const setActiveVariantKey = useCallback((patternId: string, variantKey: string) => {
    setProject((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => {
        if (p.id !== patternId) return p;
        const v = p.variants[variantKey];
        return {
          ...p, activeVariantKey: variantKey,
          recordingResult: v?.recordingResult ?? null,
          trimStartSec: v?.trimStartSec ?? 0, trimEndSec: v?.trimEndSec ?? 0,
        };
      }),
    }));
  }, []);

  const updateVariant = useCallback((patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => {
    setProject((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => {
        if (p.id !== patternId) return p;
        const oldV = p.variants[variantKey] ?? createDefaultVariant(1.0, 0);
        const updatedV: VocalAudioVariant = { ...oldV, ...partial };
        const isCurrent = p.activeVariantKey === variantKey;
        return {
          ...p,
          variants: { ...p.variants, [variantKey]: updatedV },
          recordingResult: isCurrent ? (updatedV.recordingResult ?? null) : p.recordingResult,
          trimStartSec: isCurrent ? updatedV.trimStartSec : p.trimStartSec,
          trimEndSec: isCurrent ? updatedV.trimEndSec : p.trimEndSec,
        };
      }),
    }));
  }, []);

  const ensureVariantExists = useCallback((patternId: string, speedRatio: number, pitchShiftSemitones: number): string => {
    const v = createDefaultVariant(speedRatio, pitchShiftSemitones);
    setProject((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => {
        if (p.id !== patternId || p.variants[v.variantKey]) return p;
        return { ...p, variants: { ...p.variants, [v.variantKey]: v } };
      }),
    }));
    return v.variantKey;
  }, []);

  const addPattern = useCallback((role: VocalRole, name?: string): string => {
    const defaultName = role === 'puxador' ? `Appel ${Date.now() % 100}` : `Choeur ${Date.now() % 100}`;
    const newPat = createDefaultVocalPattern(role, name ?? defaultName, 2);
    setProject((prev) => ({ ...prev, patterns: [...prev.patterns, newPat], activePatternId: newPat.id }));
    return newPat.id;
  }, []);

  const updatePattern = useCallback((id: string, partial: Partial<VocalPatternItem>) => {
    setProject((prev) => ({ ...prev, patterns: prev.patterns.map((p) => (p.id === id ? { ...p, ...partial } : p)) }));
  }, []);

  const removePattern = useCallback((id: string) => {
    setProject((prev) => {
      if (prev.patterns.length <= 1) return prev;
      const filtered = prev.patterns.filter((p) => p.id !== id);
      const nextActiveId = prev.activePatternId === id ? filtered[0].id : prev.activePatternId;
      const cleanSlots = prev.slots.map((s) => ({
        ...s,
        puxadorPatternId: s.puxadorPatternId === id ? null : s.puxadorPatternId,
        coroPatternId: s.coroPatternId === id ? null : s.coroPatternId,
      }));
      return { ...prev, patterns: filtered, slots: cleanSlots, activePatternId: nextActiveId };
    });
  }, []);

  const addSlot = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      slots: [...prev.slots, { slotId: `slot-${Date.now().toString(36)}`, puxadorPatternId: null, coroPatternId: null }],
    }));
  }, []);

  const removeSlot = useCallback((slotId: string) => {
    setProject((prev) => prev.slots.length <= 1 ? prev : ({ ...prev, slots: prev.slots.filter((s) => s.slotId !== slotId) }));
  }, []);

  const updateSlot = useCallback((slotId: string, puxadorId: string | null, coroId: string | null) => {
    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.slotId === slotId ? { ...s, puxadorPatternId: puxadorId, coroPatternId: coroId } : s)),
    }));
  }, []);

  const getPreviousConductorPattern = useCallback((): VocalPatternItem | null => {
    const slotIdx = project.slots.findIndex((s) => s.puxadorPatternId === project.activePatternId || s.coroPatternId === project.activePatternId);
    if (slotIdx > 0) {
      const prevId = project.slots[slotIdx - 1].puxadorPatternId ?? project.slots[slotIdx - 1].coroPatternId;
      if (prevId) return project.patterns.find((p) => p.id === prevId) ?? null;
    }
    return project.patterns.find((p) => p.id !== project.activePatternId && p.recordingResult !== null) ?? null;
  }, [project.slots, project.activePatternId, project.patterns]);

  const value = useMemo(() => ({
    project, activePattern, activeVariant, cueMode, setActivePatternId,
    setActiveVariantKey, updateVariant, ensureVariantExists,
    addPattern, updatePattern, removePattern, addSlot, removeSlot, updateSlot,
    setCueMode, getPreviousConductorPattern,
  }), [project, activePattern, activeVariant, cueMode, setActivePatternId, setActiveVariantKey, updateVariant, ensureVariantExists, addPattern, updatePattern, removePattern, addSlot, removeSlot, updateSlot, setCueMode, getPreviousConductorPattern]);

  return <ToadaContext.Provider value={value}>{children}</ToadaContext.Provider>;
};

export function useToadaProject(): ToadaProjectContextValue {
  const ctx = useContext(ToadaContext);
  if (!ctx) throw new Error('useToadaProject must be used within a ToadaProjectProvider');
  return ctx;
}
