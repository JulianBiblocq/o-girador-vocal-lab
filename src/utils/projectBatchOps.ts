/**
 * projectBatchOps.ts
 * Opérations de mise à jour groupée ou ciblée sur les patterns d'une Toada (< 120 lignes).
 * Supporte les portées : 'all' (tout le chant), 'active' (ce bloc), 'selected' (sélection).
 */
import type { ToadaProject } from '../types/toadaProject.types';
import type { TimeSignatureString } from '../types/vocalPack.types';

export type MetricApplyScope = 'all' | 'active' | 'selected';

export function getTargetPatternIds(project: ToadaProject, scope: MetricApplyScope, selectedIds: string[]): Set<string> {
  const target = new Set<string>();
  if (scope === 'all') {
    project.patterns.forEach((p) => target.add(p.id));
  } else if (scope === 'selected' && selectedIds.length > 0) {
    selectedIds.forEach((id) => target.add(id));
  } else {
    if (project.activePatternId) target.add(project.activePatternId);
    else if (project.patterns[0]) target.add(project.patterns[0].id);
  }
  return target;
}

export function batchUpdateProjectBpm(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], bpm: number
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => {
    if (!targets.has(p.id)) return p;
    const patAny = p as any;
    const pack = p.pack ? { ...p.pack, metadata: { ...p.pack.metadata, bpm } } : p.pack;
    const metricConfig = patAny.metricConfig ? { ...patAny.metricConfig, bpm } : patAny.metricConfig;
    return { ...p, baseBpm: bpm, pack, metricConfig };
  });

  return {
    ...project,
    bpm: scope === 'all' ? bpm : project.bpm,
    patterns: updatedPatterns,
  };
}

export function batchUpdateProjectMeasures(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], measuresCount: 1 | 2 | 3 | 4
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => {
    if (!targets.has(p.id)) return p;
    const patAny = p as any;
    const pack = p.pack ? { ...p.pack, metadata: { ...p.pack.metadata, measuresCount } } : p.pack;
    const metricConfig = patAny.metricConfig ? { ...patAny.metricConfig, measuresCount } : patAny.metricConfig;

    let mainSteps = p.mainSteps || [];
    if (mainSteps.length > 0 && measuresCount < p.measuresCount) {
      const ratio = measuresCount / p.measuresCount;
      const targetLen = Math.max(1, Math.round(mainSteps.length * ratio));
      mainSteps = mainSteps.slice(0, targetLen);
    }

    return { ...p, measuresCount, mainSteps, pack, metricConfig };
  });

  return { ...project, patterns: updatedPatterns };
}

export function batchUpdateProjectAnacrusis(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], hasAnacrusis: boolean
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => {
    if (!targets.has(p.id)) return p;
    const patAny = p as any;
    const pack = p.pack ? {
      ...p.pack,
      alignment: { ...p.pack.alignment, anacrusis: { ...p.pack.alignment.anacrusis, hasAnacrusis } },
    } : p.pack;
    const metricConfig = patAny.metricConfig ? { ...patAny.metricConfig, hasAnacrusis } : patAny.metricConfig;
    return { ...p, hasAnacrusis, pack, metricConfig };
  });

  return { ...project, patterns: updatedPatterns };
}

export function batchUpdateProjectPitch(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], referencePitch: string
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => (targets.has(p.id) ? { ...p, referencePitch } : p));
  return { ...project, patterns: updatedPatterns };
}

export function batchUpdateProjectTimeSignature(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], timeSignature: TimeSignatureString
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => {
    if (!targets.has(p.id)) return p;
    const patAny = p as any;
    const pack = p.pack ? { ...p.pack, metadata: { ...p.pack.metadata, timeSignature } } : p.pack;
    const metricConfig = patAny.metricConfig ? { ...patAny.metricConfig, timeSignature } : patAny.metricConfig;
    return { ...p, pack, metricConfig };
  });

  return {
    ...project,
    timeSignature: scope === 'all' ? timeSignature : project.timeSignature,
    patterns: updatedPatterns,
  };
}

export function batchUpdateProjectTessitura(
  project: ToadaProject, scope: MetricApplyScope, selectedIds: string[], tessitura: import('../types/tessitura.types').TessituraRange
): ToadaProject {
  const targets = getTargetPatternIds(project, scope, selectedIds);
  const updatedPatterns = project.patterns.map((p) => (targets.has(p.id) ? { ...p, tessitura } : p));
  return { ...project, patterns: updatedPatterns };
}

