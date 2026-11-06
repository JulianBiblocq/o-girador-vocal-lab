/**
 * slicerSessionStore.ts
 * Mémorisation séparée en session des buffers maîtres Puxador (masterAudioPuxador)
 * et Coro (masterAudioCoro), ainsi que du calcul des compteurs de blocs prêts (< 90 lignes).
 */
import type { DecodedAudioResult } from './directAudioImporter';
import type { SliceSegment } from '../types/slicerSegments.types';
import type { VocalPatternItem, VocalRole } from '../types/toadaProject.types';

export interface RoleSlicerSessionState {
  audio: DecodedAudioResult;
  segments: SliceSegment[];
  gridOffsetSec: number;
}

interface ProjectSlicerMemory {
  masterAudioPuxador: RoleSlicerSessionState | null;
  masterAudioCoro: RoleSlicerSessionState | null;
}

const sessionStore = new Map<string, ProjectSlicerMemory>();

function getOrInitProjectMemory(projectId: string): ProjectSlicerMemory {
  const key = projectId || 'default';
  let entry = sessionStore.get(key);
  if (!entry) {
    entry = { masterAudioPuxador: null, masterAudioCoro: null };
    sessionStore.set(key, entry);
  }
  return entry;
}

export function getRoleSlicerSession(
  projectId: string,
  role: VocalRole
): RoleSlicerSessionState | null {
  const mem = getOrInitProjectMemory(projectId);
  return role === 'coro' ? mem.masterAudioCoro : mem.masterAudioPuxador;
}

export function setRoleSlicerSession(
  projectId: string,
  role: VocalRole,
  state: RoleSlicerSessionState | null
): void {
  const mem = getOrInitProjectMemory(projectId);
  if (role === 'coro') {
    mem.masterAudioCoro = state;
  } else {
    mem.masterAudioPuxador = state;
  }
}

export function hasPatternRecordedAudio(p: VocalPatternItem): boolean {
  if (p.rawAudioSamples && p.rawAudioSamples.length > 0) return true;
  if (p.recordingResult?.pcm && p.recordingResult.pcm.length > 0) return true;
  const variants = Object.values(p.variants || {});
  return variants.some((v) => Boolean(v?.recordingResult?.pcm && v.recordingResult.pcm.length > 0));
}

export interface RoleReadinessCounts {
  puxTotalCount: number;
  puxRecordedCount: number;
  coroTotalCount: number;
  coroRecordedCount: number;
}

export function computeRoleReadinessCounts(patterns: VocalPatternItem[]): RoleReadinessCounts {
  const puxPatterns = patterns.filter((p) => p.role === 'puxador');
  const coroPatterns = patterns.filter((p) => p.role === 'coro');
  return {
    puxTotalCount: puxPatterns.length,
    puxRecordedCount: puxPatterns.filter(hasPatternRecordedAudio).length,
    coroTotalCount: coroPatterns.length,
    coroRecordedCount: coroPatterns.filter(hasPatternRecordedAudio).length,
  };
}
