/**
 * projectProgressTracker.ts
 * Calcul des 7 indicateurs d'avancement d'une Toada (« Où j'en suis ») par pattern et globalement (< 135 lignes).
 */
import type { ToadaProject, VocalPatternItem, PatternStepStatus, SequenciadorExportMode } from '../types/project.types';
import type { LivretType } from '../stores/useVocalTransportStore';
import { resolveProjectDualScale } from './scaleTranspositionHelper';

export type ProgressStepId = 'structure' | 'recording' | 'calage' | 'rhythm' | 'notes' | 'variants' | 'sync';
export type ProgressStepState = 'done' | 'partial' | 'todo';

export interface ProgressStepMetric {
  id: ProgressStepId;
  done: number;
  total: number;
  status: ProgressStepState;
  nextIncompletePatternId: string | null;
  badgeText: string;
  tooltip: string;
}

export interface ProjectProgressSummary {
  steps: Record<ProgressStepId, ProgressStepMetric>;
  orderedSteps: ProgressStepMetric[];
  patternRows: Array<{ pattern: VocalPatternItem; status: PatternStepStatus }>;
  overallCompletionPct: number;
  puxadorDone: number; puxadorTotal: number;
  coroDone: number; coroTotal: number;
  troupeKeyBadge: string;
  organizadorSynced: boolean;
  sequenciadorSynced: boolean;
  sequenciadorMode: SequenciadorExportMode | null;
  nextAction: {
    stepId: ProgressStepId;
    livret: LivretType;
    patternId: string | null;
    foldNotes?: boolean;
    label: string;
  };
}

export function resolvePatternStepStatus(p: VocalPatternItem, project?: ToadaProject): PatternStepStatus {
  const autoRec = Boolean(
    p.rawAudioSamples?.length || p.recordingResult?.pcm?.length ||
    Object.values(p.variants || {}).some((v) => Boolean(v?.recordingResult?.pcm?.length))
  );
  const recorded = typeof p.stepStatus?.recorded === 'boolean' ? p.stepStatus.recorded : autoRec;

  const autoTrimmed = recorded && Boolean(
    p.hasCanonicalAlignment || p.pack || (p.trimEndSec && p.trimEndSec > 0 && typeof p.t1OffsetSec === 'number')
  );
  const trimmed = typeof p.stepStatus?.trimmed === 'boolean' ? p.stepStatus.trimmed : autoTrimmed;

  const hasActiveSteps = Boolean(p.mainSteps?.some((s) => s.active) || p.anacrusisSteps?.some((s) => s.active));
  const autoRhythm = Boolean(p.midiLocked && hasActiveSteps);
  const rhythmValidated = typeof p.stepStatus?.rhythmValidated === 'boolean' ? p.stepStatus.rhythmValidated : autoRhythm;

  const hasPitchedNotes = Boolean(
    p.mainSteps?.some((s) => s.active && s.note !== '───') || p.anacrusisSteps?.some((s) => s.active && s.note !== '───')
  );
  const autoNotes = Boolean(
    !p.foldNotesView && p.midiLocked && hasPitchedNotes &&
    (p.correctedAudioSamples?.length || (p.melodyneRegions?.length ?? 0) > 0 || Boolean(project?.sungScaleRoot))
  );
  const notesValidated = typeof p.stepStatus?.notesValidated === 'boolean' ? p.stepStatus.notesValidated : autoNotes;

  const recordedVars = Object.values(p.variants || {}).filter((v) => Boolean(v?.recordingResult?.pcm?.length));
  const hasExtraVariantTake = recordedVars.length > 1 || recordedVars.some((v) => (v.speedRatio !== undefined && Math.abs(v.speedRatio - 1) > 0.01) || (v.pitchShiftSemitones !== undefined && v.pitchShiftSemitones !== 0));
  const shiftSt = project?.transpositionSemitones ?? project?.toadaMeta?.transpositionSemitones ?? 0;
  const hasTargetTransposition = shiftSt !== 0 || Boolean(project?.troupeScaleRoot && project?.sungScaleRoot && project.troupeScaleRoot !== project.sungScaleRoot);
  const autoVariants = recorded && Boolean(hasExtraVariantTake || p.troupeTransposedPCM?.length || p.variantSpeedsConfig || hasTargetTransposition);
  const variantsReady = typeof p.stepStatus?.variantsReady === 'boolean' ? p.stepStatus.variantsReady : autoVariants;

  return { recorded, trimmed, rhythmValidated, notesValidated, variantsReady };
}

export function applyUpdatePatternStepStatus(project: ToadaProject, patternId: string, partial: Partial<PatternStepStatus>): ToadaProject {
  return {
    ...project,
    patterns: project.patterns.map((p) => (p.id === patternId ? { ...p, stepStatus: { ...resolvePatternStepStatus(p, project), ...(p.stepStatus || {}), ...partial } } : p)),
  };
}

function toState(done: number, total: number): ProgressStepState {
  if (total <= 0 || done <= 0) return 'todo';
  return done >= total ? 'done' : 'partial';
}

export function computeProjectProgress(project: ToadaProject, language: 'fr' | 'br' = 'fr'): ProjectProgressSummary {
  const isBr = language === 'br', total = project.patterns.length, firstId = project.patterns[0]?.id ?? null;
  const patternRows = project.patterns.map((pattern) => ({ pattern, status: resolvePatternStepStatus(pattern, project) }));
  const puxRows = patternRows.filter((r) => r.pattern.role === 'puxador'), coroRows = patternRows.filter((r) => r.pattern.role === 'coro');
  const puxadorDone = puxRows.filter((r) => r.status.recorded).length, puxadorTotal = puxRows.length;
  const coroDone = coroRows.filter((r) => r.status.recorded).length, coroTotal = coroRows.length;

  const recDone = patternRows.filter((r) => r.status.recorded).length;
  const trimDone = patternRows.filter((r) => r.status.trimmed).length;
  const rhyDone = patternRows.filter((r) => r.status.rhythmValidated).length;
  const notesDone = patternRows.filter((r) => r.status.notesValidated).length;
  const varDone = patternRows.filter((r) => r.status.variantsReady).length;

  const dual = resolveProjectDualScale(project, language);
  const st = dual.transpositionSemitones, stTxt = st >= 0 ? `+${st} st` : `${st} st`;
  const troupeKeyBadge = `${dual.troupeScaleLabel.replace('Majeur', 'Maj').replace('Mineur naturel', 'Min').replace('Maior', 'Mai').replace('Menor natural', 'Men')} (${stTxt})`;

  const organizadorSynced = Boolean(project.organizadorSyncedAt || project.source === 'organizador' || project.toadaMeta?.id || project.toadaMeta?.repertoireId);
  const sequenciadorSynced = Boolean(project.sequenciadorSyncedAt || (project.toadaMeta as any)?.sequenciadorPackId);
  const sequenciadorMode: SequenciadorExportMode | null = project.sequenciadorLastExportMode ?? (sequenciadorSynced ? (project.sequenciadorExportMode ?? 'rhythm_only') : null);
  const syncDone = (organizadorSynced ? 1 : 0) + (sequenciadorSynced ? 1 : 0);

  const steps: Record<ProgressStepId, ProgressStepMetric> = {
    structure: { id: 'structure', done: total > 0 ? 1 : 0, total: 1, status: total > 0 ? 'done' : 'todo', nextIncompletePatternId: firstId, badgeText: `✓ OK (${total} ${isBr ? 'blocos' : 'blocs'} • ${project.bpm || 88} BPM)`, tooltip: isBr ? 'Estrutura e andamento da toada' : 'Structure et tempo du morceau' },
    recording: { id: 'recording', done: recDone, total, status: toState(recDone, total), nextIncompletePatternId: patternRows.find((r) => !r.status.recorded)?.pattern.id ?? firstId, badgeText: `${recDone}/${total}`, tooltip: `Puxador ${puxadorDone}/${puxadorTotal} • Coro ${coroDone}/${coroTotal}` },
    calage: { id: 'calage', done: trimDone, total, status: toState(trimDone, total), nextIncompletePatternId: (patternRows.find((r) => r.status.recorded && !r.status.trimmed) ?? patternRows.find((r) => !r.status.trimmed))?.pattern.id ?? firstId, badgeText: `${trimDone}/${total}`, tooltip: isBr ? 'Corte e alinhamento do Tempo 1' : 'Découpe et calage du Temps 1' },
    rhythm: { id: 'rhythm', done: rhyDone, total, status: toState(rhyDone, total), nextIncompletePatternId: (patternRows.find((r) => r.status.trimmed && !r.status.rhythmValidated) ?? patternRows.find((r) => !r.status.rhythmValidated))?.pattern.id ?? firstId, badgeText: `${rhyDone}/${total}`, tooltip: isBr ? 'Ritmo e sílabas validados no Livreto 4' : 'Rythme et syllabes validés au Livret 4' },
    notes: { id: 'notes', done: notesDone, total, status: toState(notesDone, total), nextIncompletePatternId: (patternRows.find((r) => r.status.rhythmValidated && !r.status.notesValidated) ?? patternRows.find((r) => !r.status.notesValidated))?.pattern.id ?? firstId, badgeText: `${notesDone}/${total}`, tooltip: isBr ? 'Alturas de notas validadas (Melodia)' : 'Hauteurs de notes validées (Mélodie)' },
    variants: { id: 'variants', done: varDone, total, status: toState(varDone, total), nextIncompletePatternId: (patternRows.find((r) => r.status.recorded && !r.status.variantsReady) ?? patternRows.find((r) => !r.status.variantsReady))?.pattern.id ?? firstId, badgeText: varDone > 0 ? `${troupeKeyBadge} • ${varDone}/${total}` : `1x • ${isBr ? 'Origem' : 'Origine'}`, tooltip: `${troupeKeyBadge} • ${varDone}/${total}` },
    sync: { id: 'sync', done: syncDone, total: 2, status: toState(syncDone, 2), nextIncompletePatternId: project.activePatternId || firstId, badgeText: `Organizador ${organizadorSynced ? '✓' : '•'} • Sequenciador : ${sequenciadorSynced ? (sequenciadorMode === 'full_notes' ? (isBr ? 'Completo' : 'Complet') : (isBr ? 'Ritmo' : 'Rythme')) : (isBr ? 'A enviar' : 'À envoyer')}`, tooltip: isBr ? 'Sincronização Organizador e Sequenciador' : 'Synchronisation Organizador & Sequenciador' },
  };

  const orderedSteps = [steps.structure, steps.recording, steps.calage, steps.rhythm, steps.notes, steps.variants, steps.sync];
  const includeVarsInPct = varDone > 0;
  const totalChecks = Math.max(1, total * (includeVarsInPct ? 5 : 4) + 3);
  const doneChecks = (total > 0 ? 1 : 0) + recDone + trimDone + rhyDone + notesDone + (includeVarsInPct ? varDone : 0) + syncDone;
  const overallCompletionPct = Math.min(100, Math.round((doneChecks / totalChecks) * 100));
  const nextStep = orderedSteps.find((s) => s.id !== 'variants' && s.status !== 'done') ?? steps.sync;
  const livretMap: Record<ProgressStepId, LivretType> = { structure: 'structure', recording: 'prise', calage: 'calage', rhythm: 'melodia', notes: 'melodia', variants: 'melodia', sync: 'melodia' };
  return {
    steps, orderedSteps, patternRows, overallCompletionPct, puxadorDone, puxadorTotal, coroDone, coroTotal, troupeKeyBadge, organizadorSynced, sequenciadorSynced, sequenciadorMode,
    nextAction: { stepId: nextStep.id, livret: livretMap[nextStep.id], patternId: nextStep.nextIncompletePatternId, foldNotes: nextStep.id === 'rhythm' ? true : nextStep.id === 'notes' ? false : undefined, label: nextStep.tooltip },
  };
}
