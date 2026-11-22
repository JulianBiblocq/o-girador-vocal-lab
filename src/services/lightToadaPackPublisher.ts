/**
 * lightToadaPackPublisher.ts
 * Synchronisation automatique d'un pack mélodique et structurel léger (< 50 Ko, sans upload WAV)
 * vers Firestore `/toada_packs/{toadaId}` lors du renvoi Cantador ➔ Organizador (< 115 lignes).
 */
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { resolveProjectDualScale, transposeVocalSteps } from '../utils/scaleTranspositionHelper';
import { transposePitchNote } from '../utils/musicalMath';
import { sanitizePitchHz } from '../utils/pitchHzContract';
import { VOCAL_GRAMMAR_VERSION } from '../utils/vocalGrammarV2';
import { getPatternUsageCount } from '../utils/unusedPatternsPurger';
import { resolveCanonicalToadaPackId } from '../utils/toadaPackIdResolver';
import { removeUndefinedFields } from './cloudToadaPublisher';

export function buildLightweightToadaScorePack(
  project: ToadaProject,
  documentIdOrOpts?: string | { toadaId?: string; documentId?: string; groupId?: string },
  targetGroupIdArg = ''
): Record<string, any> {
  const opts = typeof documentIdOrOpts === 'object' && documentIdOrOpts !== null ? documentIdOrOpts : null;
  const documentId = opts ? (opts.documentId || '') : String(documentIdOrOpts || '');
  const toadaId = opts?.toadaId || resolveCanonicalToadaPackId(project, documentId ? { id: documentId } : undefined);
  const targetGroupId = opts ? (opts.groupId || '') : targetGroupIdArg;
  const cleanGroupId = String(targetGroupId || project.toadaMeta?.groupId || '').trim().toLowerCase();
  const bpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const signature = project.timeSignature || '4/4';
  const referencePitchHz = sanitizePitchHz(project.referencePitchHz ?? project.toadaMeta?.referencePitchHz);
  const dual = resolveProjectDualScale(project, 'fr');
  const shiftSt = dual.transpositionSemitones;
  const harmonyGrid = project.globalHarmonyGrid || (project as any).harmonyGrid || project.toadaMeta?.harmonyGrid || project.patterns[0]?.harmonyGrid || null;

  const stripHeavyStepFields = (steps: any[] = []) => steps.map(({ waveEnvelopeBins: _w, ...rest }) => rest);
  const sourcePatterns = project.slots?.length
    ? (project.patterns || []).filter((p) => getPatternUsageCount(project, p.id) > 0)
    : (project.patterns || []);

  const lightPatterns = sourcePatterns.map((p, idx) => {
    const sungAna = stripHeavyStepFields(p.anacrusisSteps || []);
    const sungMain = stripHeavyStepFields(p.mainSteps || []);
    return {
      id: p.id, name: p.name, role: p.role, cardIndex: p.cardIndex ?? idx,
      bpm: Number(p.bpm || p.baseBpm || bpm), measuresCount: p.measuresCount || 1,
      hasAnacrusis: p.hasAnacrusis !== false, anacrusisBeats: p.anacrusisBeats,
      hasTailBeat: Boolean(p.hasTailBeat || p.exitBeat === 1), exitBeat: p.exitBeat,
      foldNotesView: Boolean(p.foldNotesView),
      referencePitch: transposePitchNote(p.referencePitch || 'A3', shiftSt),
      sungReferencePitch: p.referencePitch || 'A3', transpositionSemitones: shiftSt,
      stepsInTroupeKey: true, referenceMidiNotes: p.referenceMidiNotes || [],
      assignedLyricsText: p.assignedLyricsText || '', assignedPhoneticText: p.assignedPhoneticText || '',
      rawLineCode: p.rawLineCode || '', harmonyGrid: p.harmonyGrid || null,
      anacrusisSteps: transposeVocalSteps(sungAna, shiftSt), mainSteps: transposeVocalSteps(sungMain, shiftSt),
      sungAnacrusisSteps: sungAna, sungMainSteps: sungMain,
    };
  });

  return removeUndefinedFields({
    id: toadaId, documentId, ...(cleanGroupId ? { groupId: cleanGroupId } : {}), title: project.title,
    status: 'valide', cantadorValidated: true, isLightScorePack: true,
    grammarVersion: VOCAL_GRAMMAR_VERSION, bpm, signature, timeSignature: signature, referencePitchHz,
    sungKey: dual.sungScaleLabel, troupeKey: dual.troupeScaleLabel,
    sungScaleRoot: dual.sungScaleRoot, sungScaleMode: dual.sungScaleMode,
    troupeScaleRoot: dual.troupeScaleRoot, transpositionSemitones: shiftSt,
    harmonyGrid, globalHarmonyGrid: harmonyGrid,
    slots: project.slots || [], arrangementSlots: project.slots || [],
    patterns: lightPatterns, updatedAt: Date.now(),
  });
}

export async function syncLightweightToadaPackToFirestore(
  project: ToadaProject,
  documentId: string,
  targetGroupId: string
): Promise<Record<string, any>> {
  const toadaId = resolveCanonicalToadaPackId(project, documentId ? { id: documentId } : undefined);
  const packPayload = buildLightweightToadaScorePack(project, { toadaId, documentId, groupId: targetGroupId });
  await setDoc(doc(db, 'toada_packs', toadaId), packPayload, { merge: true });
  if (documentId) {
    await updateDoc(doc(db, 'documents', documentId), {
      cantadorToadaId: toadaId,
      cantadorValidated: true,
    }).catch(() => {});
  }
  return packPayload;
}
