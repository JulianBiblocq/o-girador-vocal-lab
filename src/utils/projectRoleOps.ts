import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';

/**
 * Inverse globalement les rôles 'puxador' et 'coro' dans un projet Toada :
 * 1. Sur chaque pattern de la bibliothèque.
 * 2. Sur chaque slot du conducteur (puxadorPatternId <-> coroPatternId).
 * 3. Sur les lignes de la fiche toada (sheetLines) pour cohérence totale.
 */
export function swapProjectRoles(project: ToadaProject): ToadaProject {
  const swappedPatterns = project.patterns.map((p) => ({
    ...p,
    role: (p.role === 'puxador' ? 'coro' : 'puxador') as VocalRole,
  }));

  const swappedSlots = project.slots.map((s) => ({
    ...s,
    puxadorPatternId: s.coroPatternId,
    coroPatternId: s.puxadorPatternId,
  }));

  const swappedSheetLines = project.sheetLines?.map((line) => ({
    ...line,
    role: (line.role === 'puxador' ? 'coro' : 'puxador') as VocalRole,
  }));

  return {
    ...project,
    patterns: swappedPatterns,
    slots: swappedSlots,
    ...(swappedSheetLines ? { sheetLines: swappedSheetLines } : {}),
  };
}

/**
 * Duplique un pattern existant en tant que variation indépendante :
 * - linkedSourcePatternId: null (mélodie et audio modifiables sans altérer l'original)
 * - Nommage formaté : `${baseWord} (${nextNum})`
 * - Nouveau pattern sélectionné automatiquement comme activePatternId.
 */
export function duplicatePatternAsVariation(
  project: ToadaProject,
  patternId: string
): { updatedProject: ToadaProject; newId: string } {
  const source = project.patterns.find((p) => p.id === patternId);
  if (!source) return { updatedProject: project, newId: patternId };

  const baseWord = source.name.replace(/\s*\(\d+\)$/, '').trim() || 'Variation';
  const escapedBase = baseWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const existingNumbers = project.patterns
    .filter((p) => p.role === source.role)
    .map((p) => {
      const match = p.name.trim().match(new RegExp(`^${escapedBase}(?:\\s*\\((\\d+)\\))?$`, 'i'));
      if (!match) return null;
      return match[1] ? parseInt(match[1], 10) : 1;
    })
    .filter((n): n is number => n !== null);

  const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
  const newName = `${baseWord} (${nextNum})`;
  const newId = `pat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const cloned: VocalPatternItem = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    name: newName,
    linkedSourcePatternId: null,
    createdAt: new Date().toISOString(),
  };

  const updatedProject: ToadaProject = {
    ...project,
    patterns: [...project.patterns, cloned],
    activePatternId: newId,
  };

  return { updatedProject, newId };
}
