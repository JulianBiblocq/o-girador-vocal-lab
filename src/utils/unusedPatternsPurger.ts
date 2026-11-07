/**
 * unusedPatternsPurger.ts
 * Détection des patterns non référencés dans la Frise Conducteur (project.slots),
 * calcul du poids mémoire PCM (octets & Mo), purge du projet et nettoyage des WAV orphelins Storage (< 115 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';

export interface UnusedPatternsSummary {
  unusedPatterns: VocalPatternItem[];
  unusedPatternIds: string[];
  count: number;
  totalBytes: number;
  totalMegabytes: number;
  formattedMegabytes: string;
}

export function getPatternUsageCount(project: ToadaProject, patternId: string): number {
  if (!project || !patternId) return 0;
  let count = 0;
  for (const slot of project.slots || []) {
    if (slot.puxadorPatternId === patternId) count++;
    if (slot.coroPatternId === patternId) count++;
  }
  return count;
}

export function estimatePatternMemoryBytes(pattern?: VocalPatternItem | null): number {
  if (!pattern) return 0;
  const seenBuffers = new Set<object>();
  let bytes = 0;
  const addBuffer = (buf?: Float32Array | number[] | null) => {
    if (!buf || typeof buf.length !== 'number' || buf.length === 0) return;
    if (typeof buf === 'object') {
      if (seenBuffers.has(buf)) return;
      seenBuffers.add(buf);
    }
    bytes += buf.length * 4;
  };
  addBuffer(pattern.recordingResult?.pcm);
  addBuffer(pattern.rawAudioSamples);
  addBuffer(pattern.correctedAudioSamples);
  if (pattern.variants) {
    for (const v of Object.values(pattern.variants)) addBuffer(v?.recordingResult?.pcm);
  }
  return bytes;
}

export function estimatePatternMemoryMegabytes(pattern?: VocalPatternItem | null): number {
  return Number((estimatePatternMemoryBytes(pattern) / (1024 * 1024)).toFixed(2));
}

export function getUnusedPatternsSummary(project: ToadaProject): UnusedPatternsSummary {
  const patterns = project?.patterns || [];
  const unusedPatterns = patterns.filter((p) => getPatternUsageCount(project, p.id) === 0);
  const totalBytes = unusedPatterns.reduce((acc, p) => acc + estimatePatternMemoryBytes(p), 0);
  const rawMb = totalBytes / (1024 * 1024);
  const totalMegabytes = Number(rawMb.toFixed(2));
  const formattedMegabytes = rawMb > 0 && rawMb < 0.1 ? '0.1' : rawMb.toFixed(1);
  return {
    unusedPatterns,
    unusedPatternIds: unusedPatterns.map((p) => p.id),
    count: unusedPatterns.length,
    totalBytes,
    totalMegabytes,
    formattedMegabytes,
  };
}

export function purgeUnusedPatternsFromProject(project: ToadaProject): {
  updatedProject: ToadaProject;
  purgedPatterns: VocalPatternItem[];
  purgedIds: string[];
  totalBytes: number;
  totalMegabytes: number;
  formattedMegabytes: string;
} {
  const summary = getUnusedPatternsSummary(project);
  if (summary.count === 0) {
    return { updatedProject: project, purgedPatterns: [], purgedIds: [], totalBytes: 0, totalMegabytes: 0, formattedMegabytes: '0.0' };
  }
  const unusedSet = new Set(summary.unusedPatternIds);
  let keptPatterns = project.patterns.filter((p) => !unusedSet.has(p.id));
  if (keptPatterns.length === 0 && project.patterns.length > 0) keptPatterns = [project.patterns[0]];
  const nextActiveId = keptPatterns.some((p) => p.id === project.activePatternId)
    ? project.activePatternId
    : (keptPatterns[0]?.id || project.activePatternId);
  return {
    updatedProject: { ...project, patterns: keptPatterns, activePatternId: nextActiveId },
    purgedPatterns: summary.unusedPatterns,
    purgedIds: summary.unusedPatternIds,
    totalBytes: summary.totalBytes,
    totalMegabytes: summary.totalMegabytes,
    formattedMegabytes: summary.formattedMegabytes,
  };
}

export async function deleteOrphanPatternWavsFromStorage(toadaId: string, patternIds: string[]): Promise<number> {
  if (!toadaId || !patternIds || patternIds.length === 0) return 0;
  let deletedCount = 0;
  try {
    const [{ ref, deleteObject }, { storage }] = await Promise.all([import('firebase/storage'), import('../services/firebaseClient')]);
    await Promise.all(patternIds.map(async (pid) => {
      try { await deleteObject(ref(storage, `vocalRecordings/${toadaId}_${pid}.wav`)); deletedCount++; } catch { /* ignore */ }
    }));
  } catch { /* ignore */ }
  return deletedCount;
}
