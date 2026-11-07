/**
 * ToadaProjectContext.tsx
 * Contexte global de gestion du projet Toada, des patterns, des variantes et du conducteur (< 130 lignes).
 */
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  type ToadaProject, type VocalPatternItem, type VocalRole, type VocalAudioVariant, type SequenciadorExportMode,
  DEFAULT_TOADA_BPM, createDefaultToadaProject, createDefaultVocalPattern, createDefaultVariant,
} from '../types/toadaProject.types';
import type { TimeSignatureString } from '../types/vocalPack.types';
import type { ToadaProjectContextValue } from '../types/toadaProjectContext.types';
import { createMirroredPattern, injectSourceIntoTargetPattern, propagateSourceUpdatesToLinkedPatterns, unlinkPattern } from '../utils/patternMirrorHelper';
import { swapProjectRoles, duplicatePatternAsVariation } from '../utils/projectRoleOps';
import { batchUpdateProjectBpm, batchUpdateProjectMeasures, batchUpdateProjectAnacrusis, batchUpdateProjectPitch, batchUpdateProjectTimeSignature, batchUpdateProjectTessitura, applyTogglePatternFoldNotes, applySetAllPatternsFoldNotes, applySetSequenciadorExportMode } from '../utils/projectBatchOps';
import { applySetActiveVariantKey, applyUpdateVariant, applyEnsureVariantExists } from '../utils/variantContextOps';
import { usePatternSelection } from '../hooks/usePatternSelection';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { stopAllActiveAudioEngines } from '../audio/sharedAudioContext';

const ToadaContext = createContext<ToadaProjectContextValue | null>(null);
const FALLBACK_PATTERN = createDefaultVocalPattern('puxador', 'Puxador 1', 2, DEFAULT_TOADA_BPM, 'C4');
const FALLBACK_VARIANT = createDefaultVariant(1.0, 0);

export const ToadaProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ToadaProject>(() => createDefaultToadaProject()), [cueMode, setCueMode] = useState<string>('auto_previous');
  useProjectAutoSave(project, setProject);
  const patternIds = useMemo(() => project.patterns.map((p) => p.id), [project.patterns]);
  const { applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns } = usePatternSelection(patternIds);

  const activePattern = useMemo(() => project.patterns.find((p) => p.id === project.activePatternId) ?? project.patterns[0] ?? FALLBACK_PATTERN, [project.patterns, project.activePatternId]);
  const activeVariant = useMemo(() => activePattern.variants?.[activePattern.activeVariantKey] ?? Object.values(activePattern.variants || {})[0] ?? FALLBACK_VARIANT, [activePattern]);

  useEffect(() => {
    if (project.patterns.length > 0 && !project.patterns.some((p) => p.id === project.activePatternId)) {
      setProject((prev) => ({ ...prev, activePatternId: prev.patterns[0]?.id ?? prev.activePatternId }));
    }
  }, [project.patterns, project.activePatternId]);

  const setActivePatternId = useCallback((id: string) => setProject((prev) => ({ ...prev, activePatternId: id })), []);
  const setActiveVariantKey = useCallback((patternId: string, variantKey: string) => setProject((prev) => applySetActiveVariantKey(prev, patternId, variantKey)), []);
  const updateVariant = useCallback((patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => setProject((prev) => applyUpdateVariant(prev, patternId, variantKey, partial)), []);
  const updatePatternAndVariant = useCallback((patternId: string, variantKey: string, patternPartial: Partial<VocalPatternItem>, variantPartial: Partial<VocalAudioVariant>) => {
    setProject((prev) => {
      const withVar = applyUpdateVariant(prev, patternId, variantKey, variantPartial);
      return { ...withVar, patterns: propagateSourceUpdatesToLinkedPatterns(withVar.patterns.map((p) => (p.id === patternId ? { ...p, ...patternPartial } : p)), patternId) };
    });
  }, []);
  const ensureVariantExists = useCallback((patternId: string, speedRatio: number, pitchShiftSemitones: number): string => {
    let key = ''; setProject((prev) => { const res = applyEnsureVariantExists(prev, patternId, speedRatio, pitchShiftSemitones); key = res.variantKey; return res.updatedProject; }); return key;
  }, []);
  const addPattern = useCallback((role: VocalRole, name?: string): string => {
    const newPat = createDefaultVocalPattern(role, name || '', 2, DEFAULT_TOADA_BPM, 'C4');
    setProject((prev) => {
      const count = prev.patterns.filter((p) => p.role === role).length + 1, resolvedName = name?.trim() || (role === 'puxador' ? `Appel ${count}` : `Chœur ${count}`);
      const curActive = prev.patterns.find((p) => p.id === prev.activePatternId) ?? prev.patterns[0];
      const pat: VocalPatternItem = { ...newPat, name: resolvedName, bpm: prev.bpm ?? DEFAULT_TOADA_BPM, baseBpm: prev.bpm ?? DEFAULT_TOADA_BPM, hasAnacrusis: curActive?.hasAnacrusis ?? true };
      return { ...prev, patterns: [...prev.patterns, pat], activePatternId: pat.id };
    });
    return newPat.id;
  }, []);
  const updatePattern = useCallback((id: string, partial: Partial<VocalPatternItem>) => setProject((prev) => ({ ...prev, patterns: propagateSourceUpdatesToLinkedPatterns(prev.patterns.map((p) => (p.id === id ? { ...p, ...partial } : p)), id) })), []);
  const mirrorPatternToRole = useCallback((sourcePatternId: string, targetRole: VocalRole): string => {
    let newId = '';
    setProject((prev) => {
      const source = prev.patterns.find((p) => p.id === sourcePatternId); if (!source) return prev;
      const mirrored = createMirroredPattern(source, targetRole); newId = mirrored.id;
      return { ...prev, patterns: [...prev.patterns, mirrored], activePatternId: mirrored.id };
    });
    return newId;
  }, []);
  const injectPatternIntoTarget = useCallback((sourceId: string, targetId: string) => {
    setProject((prev) => {
      const s = prev.patterns.find((p) => p.id === sourceId), t = prev.patterns.find((p) => p.id === targetId); if (!s || !t) return prev;
      return { ...prev, patterns: prev.patterns.map((p) => (p.id === targetId ? injectSourceIntoTargetPattern(s, t) : p)), activePatternId: targetId };
    });
  }, []);
  const handleUnlink = useCallback((patternId: string) => setProject((prev) => ({ ...prev, patterns: prev.patterns.map((p) => (p.id === patternId ? unlinkPattern(p) : p)) })), []);
  const removePattern = useCallback((id: string) => {
    setProject((prev) => {
      if (prev.patterns.length <= 1) return prev;
      const filtered = prev.patterns.filter((p) => p.id !== id).map((p) => (p.linkedSourcePatternId === id ? unlinkPattern(p) : p));
      const nextActiveId = prev.activePatternId === id || !filtered.some((p) => p.id === prev.activePatternId) ? filtered[0].id : prev.activePatternId;
      const clearedSlots = prev.slots.map((s) => ({ ...s, puxadorPatternId: s.puxadorPatternId === id ? null : s.puxadorPatternId, coroPatternId: s.coroPatternId === id ? null : s.coroPatternId }));
      const nonEmpty = clearedSlots.filter((s) => s.puxadorPatternId !== null || s.coroPatternId !== null || (s.advanceMeasures && s.advanceMeasures >= 1));
      return { ...prev, patterns: filtered, slots: nonEmpty.length > 0 ? nonEmpty : [clearedSlots[0]], activePatternId: nextActiveId };
    });
  }, []);
  const loadProject = useCallback((p: ToadaProject) => {
    stopAllActiveAudioEngines();
    setProject({ ...p, activePatternId: p.patterns.some((pat) => pat.id === p.activePatternId) ? p.activePatternId : (p.patterns[0]?.id ?? '') });
  }, []);
  const addSlot = useCallback((advanceMeasures?: number) => setProject((prev) => ({ ...prev, slots: [...prev.slots, { slotId: `slot-${Date.now().toString(36)}-${prev.slots.length}`, puxadorPatternId: null, coroPatternId: null, ...(typeof advanceMeasures === 'number' ? { advanceMeasures } : {}) }] })), []);
  const removeSlot = useCallback((slotId: string) => setProject((prev) => (prev.slots.length <= 1 ? prev : { ...prev, slots: prev.slots.filter((s) => s.slotId !== slotId) })), []);
  const updateSlot = useCallback((slotId: string, puxadorId: string | null, coroId: string | null, advanceMeasures?: number) => setProject((prev) => ({ ...prev, slots: prev.slots.map((s) => (s.slotId === slotId ? { ...s, puxadorPatternId: puxadorId, coroPatternId: coroId, ...(advanceMeasures !== undefined ? { advanceMeasures } : {}) } : s)) })), []);
  const reorderSlots = useCallback((fromIndex: number, toIndex: number) => setProject((prev) => {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= prev.slots.length || toIndex < 0 || toIndex >= prev.slots.length) return prev;
    const nextSlots = [...prev.slots]; const [moved] = nextSlots.splice(fromIndex, 1); nextSlots.splice(toIndex, 0, moved);
    return { ...prev, slots: nextSlots };
  }), []);
  const swapAllRoles = useCallback(() => setProject((prev) => swapProjectRoles(prev)), []);
  const duplicateVariation = useCallback((patternId: string): string => {
    let createdId = ''; setProject((prev) => { const res = duplicatePatternAsVariation(prev, patternId); createdId = res.newId; return res.updatedProject; }); return createdId;
  }, []);
  const updateScopedBpm = useCallback((bpm: number) => setProject((prev) => batchUpdateProjectBpm(prev, applyScope, selectedPatternIds, bpm)), [applyScope, selectedPatternIds]);
  const updateScopedMeasuresCount = useCallback((count: 1 | 2 | 3 | 4) => setProject((prev) => batchUpdateProjectMeasures(prev, applyScope, selectedPatternIds, count)), [applyScope, selectedPatternIds]);
  const updateScopedHasAnacrusis = useCallback((has: boolean) => setProject((prev) => batchUpdateProjectAnacrusis(prev, applyScope, selectedPatternIds, has)), [applyScope, selectedPatternIds]);
  const updateScopedReferencePitch = useCallback((p: string) => setProject((prev) => batchUpdateProjectPitch(prev, applyScope, selectedPatternIds, p)), [applyScope, selectedPatternIds]);
  const updateScopedTimeSignature = useCallback((s: TimeSignatureString) => setProject((prev) => batchUpdateProjectTimeSignature(prev, applyScope, selectedPatternIds, s)), [applyScope, selectedPatternIds]);
  const updateScopedTessitura = useCallback((t: import('../types/tessitura.types').TessituraRange) => setProject((prev) => batchUpdateProjectTessitura(prev, applyScope, selectedPatternIds, t)), [applyScope, selectedPatternIds]);
  const updateHarmonyConfig = useCallback((cfg: import('../types/harmony.types').HarmonyConfig) => setProject((prev) => ({ ...prev, harmonyConfig: cfg })), []);
  const updateToadaMeta = useCallback((meta: Partial<import('../types/toadaDocument.types').ToadaDocument>) => setProject((prev) => ({ ...prev, toadaMeta: { ...(prev.toadaMeta || {}), ...meta } })), []);
  const togglePatternFoldNotes = useCallback((patternId: string, folded?: boolean) => setProject((prev) => applyTogglePatternFoldNotes(prev, patternId, folded)), []);
  const setAllPatternsFoldNotes = useCallback((folded: boolean) => setProject((prev) => applySetAllPatternsFoldNotes(prev, folded)), []);
  const setSequenciadorExportMode = useCallback((mode: SequenciadorExportMode) => setProject((prev) => applySetSequenciadorExportMode(prev, mode)), []);

  const getPreviousConductorPattern = useCallback((): VocalPatternItem | null => {
    const hasAudio = (p?: VocalPatternItem) => Boolean(p?.recordingResult?.pcm?.length || p?.variants?.[p.activeVariantKey]?.recordingResult?.pcm?.length);
    const slotIdx = project.slots.findIndex((s) => s.puxadorPatternId === project.activePatternId || s.coroPatternId === project.activePatternId);
    if (slotIdx > 0) {
      const prevId = project.slots[slotIdx - 1].puxadorPatternId ?? project.slots[slotIdx - 1].coroPatternId;
      const found = prevId ? project.patterns.find((p) => p.id === prevId) : undefined;
      if (found && hasAudio(found)) return found;
    }
    return project.patterns.find((p) => p.id !== project.activePatternId && hasAudio(p)) ?? null;
  }, [project.slots, project.activePatternId, project.patterns]);

  const value = useMemo(() => ({
    project, activePattern, activeVariant, cueMode, setActivePatternId, setActiveVariantKey, updateVariant, updatePatternAndVariant, ensureVariantExists,
    addPattern, updatePattern, removePattern, mirrorPatternToRole, injectPatternIntoTarget, unlinkPattern: handleUnlink,
    loadProject, addSlot, removeSlot, updateSlot, reorderSlots, setCueMode, getPreviousConductorPattern, swapAllRoles, duplicateVariation,
    applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns,
    updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedReferencePitch, updateScopedTimeSignature, updateScopedTessitura, updateHarmonyConfig, updateToadaMeta,
    togglePatternFoldNotes, setAllPatternsFoldNotes, setSequenciadorExportMode,
  }), [project, activePattern, activeVariant, cueMode, setActivePatternId, setActiveVariantKey, updateVariant, updatePatternAndVariant, ensureVariantExists, addPattern, updatePattern, removePattern, mirrorPatternToRole, injectPatternIntoTarget, handleUnlink, loadProject, addSlot, removeSlot, updateSlot, reorderSlots, setCueMode, getPreviousConductorPattern, swapAllRoles, duplicateVariation, applyScope, setApplyScope, selectedPatternIds, toggleSelectPattern, selectAllPatterns, clearSelectedPatterns, updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedReferencePitch, updateScopedTimeSignature, updateScopedTessitura, updateHarmonyConfig, updateToadaMeta, togglePatternFoldNotes, setAllPatternsFoldNotes, setSequenciadorExportMode]);

  return <ToadaContext.Provider value={value}>{children}</ToadaContext.Provider>;
};

export function useToadaProject(): ToadaProjectContextValue {
  const ctx = useContext(ToadaContext); if (!ctx) throw new Error('useToadaProject must be used within a ToadaProjectProvider'); return ctx;
}
