import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  type ToadaProject, type VocalPatternItem, type VocalRole, type VocalAudioVariant,
  createDefaultToadaProject, createDefaultVocalPattern, createDefaultVariant,
} from '../types/toadaProject.types';
import type { TimeSignatureString } from '../types/vocalPack.types';
import type { ToadaProjectContextValue } from '../types/toadaProjectContext.types';
import { createMirroredPattern, propagateSourceUpdatesToLinkedPatterns, unlinkPattern } from '../utils/patternMirrorHelper';
import { swapProjectRoles, duplicatePatternAsVariation } from '../utils/projectRoleOps';
import {
  batchUpdateProjectBpm, batchUpdateProjectMeasures, batchUpdateProjectAnacrusis,
  batchUpdateProjectPitch, batchUpdateProjectTimeSignature, batchUpdateProjectTessitura,
} from '../utils/projectBatchOps';
import { applySetActiveVariantKey, applyUpdateVariant, applyEnsureVariantExists } from '../utils/variantContextOps';
import { usePatternSelection } from '../hooks/usePatternSelection';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';

const ToadaContext = createContext<ToadaProjectContextValue | null>(null);

export const ToadaProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ToadaProject>(() => createDefaultToadaProject());
  const [cueMode, setCueMode] = useState<string>('auto_previous');
  useProjectAutoSave(project, setProject);

  const patternIds = useMemo(() => project.patterns.map((p) => p.id), [project.patterns]);
  const {
    applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns,
  } = usePatternSelection(patternIds);

  const activePattern = useMemo(() => project.patterns.find((p) => p.id === project.activePatternId) ?? project.patterns[0], [project.patterns, project.activePatternId]);
  const activeVariant = useMemo(() => activePattern.variants[activePattern.activeVariantKey] ?? Object.values(activePattern.variants)[0] ?? createDefaultVariant(1.0, 0), [activePattern]);
  const setActivePatternId = useCallback((id: string) => setProject((prev) => ({ ...prev, activePatternId: id })), []);

  const setActiveVariantKey = useCallback((patternId: string, variantKey: string) => setProject((prev) => applySetActiveVariantKey(prev, patternId, variantKey)), []);
  const updateVariant = useCallback((patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => setProject((prev) => applyUpdateVariant(prev, patternId, variantKey, partial)), []);
  const ensureVariantExists = useCallback((patternId: string, speedRatio: number, pitchShiftSemitones: number): string => {
    let key = '';
    setProject((prev) => {
      const res = applyEnsureVariantExists(prev, patternId, speedRatio, pitchShiftSemitones);
      key = res.variantKey;
      return res.updatedProject;
    });
    return key;
  }, []);

  const addPattern = useCallback((role: VocalRole, name?: string): string => {
    const defaultName = role === 'puxador' ? `Appel ${Date.now() % 100}` : `Choeur ${Date.now() % 100}`;
    const newPat = createDefaultVocalPattern(role, name ?? defaultName, 2, project.bpm ?? 55, 'C4');
    if (activePattern?.hasAnacrusis !== undefined) newPat.hasAnacrusis = activePattern.hasAnacrusis;
    setProject((prev) => ({ ...prev, patterns: [...prev.patterns, newPat], activePatternId: newPat.id }));
    return newPat.id;
  }, [project.bpm, activePattern?.hasAnacrusis]);

  const updatePattern = useCallback((id: string, partial: Partial<VocalPatternItem>) => {
    setProject((prev) => ({ ...prev, patterns: propagateSourceUpdatesToLinkedPatterns(prev.patterns.map((p) => (p.id === id ? { ...p, ...partial } : p)), id) }));
  }, []);

  const mirrorPatternToRole = useCallback((sourcePatternId: string, targetRole: VocalRole): string => {
    let newId = '';
    setProject((prev) => {
      const source = prev.patterns.find((p) => p.id === sourcePatternId);
      if (!source) return prev;
      const mirrored = createMirroredPattern(source, targetRole);
      newId = mirrored.id;
      return { ...prev, patterns: [...prev.patterns, mirrored], activePatternId: mirrored.id };
    });
    return newId;
  }, []);

  const handleUnlink = useCallback((patternId: string) => setProject((prev) => ({ ...prev, patterns: prev.patterns.map((p) => (p.id === patternId ? unlinkPattern(p) : p)) })), []);

  const removePattern = useCallback((id: string) => {
    setProject((prev) => {
      if (prev.patterns.length <= 1) return prev;
      const filtered = prev.patterns.filter((p) => p.id !== id).map((p) => (p.linkedSourcePatternId === id ? unlinkPattern(p) : p));
      const nextActiveId = prev.activePatternId === id ? filtered[0].id : prev.activePatternId;
      const cleanSlots = prev.slots.map((s) => ({
        ...s, puxadorPatternId: s.puxadorPatternId === id ? null : s.puxadorPatternId, coroPatternId: s.coroPatternId === id ? null : s.coroPatternId,
      }));
      return { ...prev, patterns: filtered, slots: cleanSlots, activePatternId: nextActiveId };
    });
  }, []);

  const loadProject = useCallback((p: ToadaProject) => setProject(p), []);
  const addSlot = useCallback(() => setProject((prev) => ({ ...prev, slots: [...prev.slots, { slotId: `slot-${Date.now().toString(36)}`, puxadorPatternId: null, coroPatternId: null }] })), []);
  const removeSlot = useCallback((slotId: string) => setProject((prev) => (prev.slots.length <= 1 ? prev : { ...prev, slots: prev.slots.filter((s) => s.slotId !== slotId) })), []);
  const updateSlot = useCallback((slotId: string, puxadorId: string | null, coroId: string | null) => setProject((prev) => ({ ...prev, slots: prev.slots.map((s) => (s.slotId === slotId ? { ...s, puxadorPatternId: puxadorId, coroPatternId: coroId } : s)) })), []);
  const swapAllRoles = useCallback(() => setProject((prev) => swapProjectRoles(prev)), []);

  const duplicateVariation = useCallback((patternId: string): string => {
    let createdId = '';
    setProject((prev) => {
      const res = duplicatePatternAsVariation(prev, patternId);
      createdId = res.newId;
      return res.updatedProject;
    });
    return createdId;
  }, []);

  // Scoped metric & pitch updates (Micro-sécurité 1)
  const updateScopedBpm = useCallback((bpm: number) => setProject((prev) => batchUpdateProjectBpm(prev, applyScope, selectedPatternIds, bpm)), [applyScope, selectedPatternIds]);
  const updateScopedMeasuresCount = useCallback((count: 1 | 2 | 3 | 4) => setProject((prev) => batchUpdateProjectMeasures(prev, applyScope, selectedPatternIds, count)), [applyScope, selectedPatternIds]);
  const updateScopedHasAnacrusis = useCallback((has: boolean) => setProject((prev) => batchUpdateProjectAnacrusis(prev, applyScope, selectedPatternIds, has)), [applyScope, selectedPatternIds]);
  const updateScopedReferencePitch = useCallback((pitch: string) => setProject((prev) => batchUpdateProjectPitch(prev, applyScope, selectedPatternIds, pitch)), [applyScope, selectedPatternIds]);
  const updateScopedTimeSignature = useCallback((sig: TimeSignatureString) => setProject((prev) => batchUpdateProjectTimeSignature(prev, applyScope, selectedPatternIds, sig)), [applyScope, selectedPatternIds]);
  const updateScopedTessitura = useCallback((tessitura: import('../types/tessitura.types').TessituraRange) => setProject((prev) => batchUpdateProjectTessitura(prev, applyScope, selectedPatternIds, tessitura)), [applyScope, selectedPatternIds]);
  const updateHarmonyConfig = useCallback((cfg: import('../types/harmony.types').HarmonyConfig) => setProject((prev) => ({ ...prev, harmonyConfig: cfg })), []);
  const updateToadaMeta = useCallback((meta: Partial<import('../types/toadaDocument.types').ToadaDocument>) => setProject((prev) => ({ ...prev, toadaMeta: { ...(prev.toadaMeta || {}), ...meta } })), []);

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
    addPattern, updatePattern, removePattern, mirrorPatternToRole, unlinkPattern: handleUnlink,
    loadProject, addSlot, removeSlot, updateSlot, setCueMode, getPreviousConductorPattern,
    swapAllRoles, duplicateVariation,
    applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns,
    updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedReferencePitch, updateScopedTimeSignature, updateScopedTessitura, updateHarmonyConfig, updateToadaMeta,
  }), [project, activePattern, activeVariant, cueMode, setActivePatternId, setActiveVariantKey, updateVariant, ensureVariantExists, addPattern, updatePattern, removePattern, mirrorPatternToRole, handleUnlink, loadProject, addSlot, removeSlot, updateSlot, setCueMode, getPreviousConductorPattern, swapAllRoles, duplicateVariation, applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns, updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedReferencePitch, updateScopedTimeSignature, updateScopedTessitura, updateHarmonyConfig, updateToadaMeta]);

  return <ToadaContext.Provider value={value}>{children}</ToadaContext.Provider>;
};

export function useToadaProject(): ToadaProjectContextValue {
  const ctx = useContext(ToadaContext);
  if (!ctx) throw new Error('useToadaProject must be used within a ToadaProjectProvider');
  return ctx;
}
