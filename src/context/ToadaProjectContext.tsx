/**
 * ToadaProjectContext.tsx
 * Gestion centralisée de la Toada (Bibliothèque de Patterns & Frise Conducteur).
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  type ToadaProject, type VocalPatternItem, type VocalRole,
  createDefaultToadaProject, createDefaultVocalPattern,
} from '../types/toadaProject.types';

interface ToadaProjectContextValue {
  project: ToadaProject;
  activePattern: VocalPatternItem;
  cueMode: string;
  setActivePatternId: (id: string) => void;
  addPattern: (role: VocalRole, name?: string) => string;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  removePattern: (id: string) => void;
  addSlot: () => void;
  removeSlot: (slotId: string) => void;
  updateSlot: (slotId: string, puxadorId: string | null, coroId: string | null) => void;
  setCueMode: (mode: string) => void;
  getPreviousConductorPattern: () => VocalPatternItem | null;
}

const ToadaContext = createContext<ToadaProjectContextValue | null>(null);

export const ToadaProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ToadaProject>(() => createDefaultToadaProject());
  const [cueMode, setCueMode] = useState<string>('auto_previous');

  const activePattern = useMemo(() => {
    return project.patterns.find((p) => p.id === project.activePatternId) ?? project.patterns[0];
  }, [project.patterns, project.activePatternId]);

  const setActivePatternId = useCallback((id: string) => {
    setProject((prev) => ({ ...prev, activePatternId: id }));
  }, []);

  const addPattern = useCallback((role: VocalRole, name?: string): string => {
    const defaultName = role === 'puxador' ? `Appel ${Date.now() % 100}` : `Chœur ${Date.now() % 100}`;
    const newPat = createDefaultVocalPattern(role, name ?? defaultName, 2);
    setProject((prev) => ({
      ...prev,
      patterns: [...prev.patterns, newPat],
      activePatternId: newPat.id,
    }));
    return newPat.id;
  }, []);

  const updatePattern = useCallback((id: string, partial: Partial<VocalPatternItem>) => {
    setProject((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    }));
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
      slots: [
        ...prev.slots,
        { slotId: `slot-${Date.now().toString(36)}`, puxadorPatternId: null, coroPatternId: null },
      ],
    }));
  }, []);

  const removeSlot = useCallback((slotId: string) => {
    setProject((prev) => {
      if (prev.slots.length <= 1) return prev;
      return { ...prev, slots: prev.slots.filter((s) => s.slotId !== slotId) };
    });
  }, []);

  const updateSlot = useCallback((slotId: string, puxadorId: string | null, coroId: string | null) => {
    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.slotId === slotId ? { ...s, puxadorPatternId: puxadorId, coroPatternId: coroId } : s)),
    }));
  }, []);

  const getPreviousConductorPattern = useCallback((): VocalPatternItem | null => {
    const slotIdx = project.slots.findIndex(
      (s) => s.puxadorPatternId === project.activePatternId || s.coroPatternId === project.activePatternId
    );
    if (slotIdx > 0) {
      const prevSlot = project.slots[slotIdx - 1];
      const prevId = prevSlot.puxadorPatternId ?? prevSlot.coroPatternId;
      if (prevId) {
        return project.patterns.find((p) => p.id === prevId) ?? null;
      }
    }
    // Si premier bloc ou non trouvé : renvoyer le premier autre pattern qui a un enregistrement
    return project.patterns.find((p) => p.id !== project.activePatternId && p.recordingResult !== null) ?? null;
  }, [project.slots, project.activePatternId, project.patterns]);

  const value = useMemo(
    () => ({
      project, activePattern, cueMode, setActivePatternId,
      addPattern, updatePattern, removePattern, addSlot, removeSlot, updateSlot,
      setCueMode, getPreviousConductorPattern,
    }),
    [project, activePattern, cueMode, setActivePatternId, addPattern, updatePattern, removePattern, addSlot, removeSlot, updateSlot, setCueMode, getPreviousConductorPattern]
  );

  return <ToadaContext.Provider value={value}>{children}</ToadaContext.Provider>;
};

export function useToadaProject(): ToadaProjectContextValue {
  const ctx = useContext(ToadaContext);
  if (!ctx) throw new Error('useToadaProject must be used within a ToadaProjectProvider');
  return ctx;
}
