/**
 * samambaiaMorceauIntegrator.ts
 * Récupération des morceaux sauvegardés du répertoire Samambaia (Sequenciador `presets`)
 * et intégration directe de la Toada Cantador calée au BPM maître du morceau Sequenciador (< 125 lignes).
 */
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { ToadaProject } from '../types/toadaProject.types';
import { publishToadaToSequencer } from './cloudToadaPublisher';
import { parseSequenciadorPresetData, encodeSequenciadorPresetData } from '../utils/lzStringCodec';
import {
  type SamambaiaMorceauSummary, normalizeMorceauTitle,
  injectToadaPackIntoSequenciadorPreset, applySequenciadorBpmBackToProject,
} from '../utils/sequenciadorPresetBuilder';
import { getEcosystemAppUrl } from '../utils/ecosystemUrls';

const SAMAMBAIA_MESTRE_UID = 'iA0SweEHyOPzAPGIDVZdeKAV2mk1';

function detectHasVocalToada(parsed: Record<string, any> | null, rawDoc: Record<string, any>): boolean {
  if (rawDoc?.toadaPackId || parsed?.metadata?.toadaPackId) return true;
  if (!Array.isArray(parsed?.tracks)) return false;
  return parsed.tracks.some((t: any) =>
    (t?.instrumentIdx === 10 || t?.instrumentIdx === 11) && Array.isArray(t.patterns) &&
    t.patterns.some((p: any) => Boolean(p?.vocalAudioUrl || p?.vocalClip || (Array.isArray(p?.activeSteps) && p.activeSteps.some((s: any) => s === 'P' || s === 'C'))))
  );
}

export async function fetchSamambaiaSavedMorceaux(): Promise<SamambaiaMorceauSummary[]> {
  const presetsRef = collection(db, 'presets'), currentUid = auth.currentUser?.uid;
  const queries = [
    getDocs(query(presetsRef, where('groupId', 'in', ['samambaia', 'Samambaia', 'SAMAMBAIA']), limit(150))),
    getDocs(query(presetsRef, where('mestreId', '==', SAMAMBAIA_MESTRE_UID), limit(150))),
    getDocs(query(presetsRef, where('visibility', 'in', ['mestre_group', 'admin_global', 'public']), limit(150))),
  ];
  if (currentUid) queries.push(getDocs(query(presetsRef, where('ownerId', '==', currentUid), limit(100))));

  const settled = await Promise.allSettled(queries);
  const seenIds = new Set<string>(), seenNormNames = new Set<string>(), list: SamambaiaMorceauSummary[] = [];

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    res.value.forEach((docSnap) => {
      if (seenIds.has(docSnap.id)) return;
      const raw = docSnap.data() || {};
      if (typeof raw.name === 'string' && /^test_e2e_/i.test(raw.name)) return;
      const parsed = parseSequenciadorPresetData(raw.data);
      const name = String(raw.name || parsed?.metadata?.toada || docSnap.id).trim();
      const norm = normalizeMorceauTitle(name);
      if (norm && seenNormNames.has(norm)) return;
      seenIds.add(docSnap.id); if (norm) seenNormNames.add(norm);
      const bpm = Math.max(30, Math.round(Number(parsed?.bpm || raw.bpm || 96)));
      list.push({
        id: docSnap.id, name, bpm, ritmo: parsed?.metadata?.ritmo || raw.ritmo || 'Baque Virado',
        nacao: parsed?.metadata?.nacao || raw.nacao || '', toadaPackId: parsed?.metadata?.toadaPackId || raw.toadaPackId,
        hasVocalToada: detectHasVocalToada(parsed, raw), updatedAt: Number(raw.updatedAt || raw.createdAt || 0),
        rawDoc: raw, parsedPreset: parsed || undefined,
      });
    });
  }
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || a.name.localeCompare(b.name));
}

export interface IntegrateMorceauOptions {
  targetMorceau?: SamambaiaMorceauSummary | null;
  createNewMorceau?: { name: string; bpm: number; ritmo?: string };
}

export interface IntegrateMorceauResult {
  presetId: string; morceauName: string; sequenciadorBpm: number; recordedBpm: number;
  sequenciadorMorceauUrl: string; exportedPatternsCount: number; savedMegabytes: string; updatedProject: ToadaProject;
}

export async function integrateToadaIntoSamambaiaMorceau(
  project: ToadaProject, options: IntegrateMorceauOptions, onProgress?: (msg: string) => void
): Promise<IntegrateMorceauResult> {
  const target = options.targetMorceau;
  const sequenciadorBpm = target ? target.bpm : Math.max(30, Math.round(Number(options.createNewMorceau?.bpm || project.bpm || 96)));
  const morceauName = target ? target.name : (options.createNewMorceau?.name?.trim() || project.title || 'Nouvelle Toada');
  const firstPat = project.patterns[0];
  const recordedBpm = Math.round(Number((firstPat as any)?.recordedBpm || firstPat?.recordingResult?.recordedBpm || firstPat?.baseBpm || project.bpm || sequenciadorBpm));

  // 1. Publication du pack Toada avec pack.bpm = sequenciadorBpm et préservation de recordedBpm sur chaque pattern
  const pubRes = await publishToadaToSequencer(project, onProgress, sequenciadorBpm);

  // 2. Injection dans le Preset Sequenciador sans jamais modifier le BPM maître de Sequenciador
  onProgress?.(`Intégration dans le morceau "${morceauName}" (${sequenciadorBpm} BPM)...`);
  const basePreset = target?.parsedPreset || {
    bpm: sequenciadorBpm, timeSig: project.timeSignature || '4/4', totalMeasures: 8, tracks: [],
    metadata: { toada: morceauName, nacao: project.toadaMeta?.nacao || 'Nagô', ritmo: options.createNewMorceau?.ritmo || 'Baque Virado' },
  };
  let finalPresetId = target?.id || '';
  const mergedPreset = injectToadaPackIntoSequenciadorPreset(basePreset, pubRes.publishedPack, sequenciadorBpm, finalPresetId || undefined);
  const ownerId = target?.rawDoc?.ownerId || auth.currentUser?.uid || SAMAMBAIA_MESTRE_UID;
  const presetPayload: Record<string, any> = {
    name: morceauName, data: encodeSequenciadorPresetData(mergedPreset), bpm: sequenciadorBpm, toadaPackId: pubRes.toadaId,
    groupId: target?.rawDoc?.groupId || 'samambaia', mestreId: target?.rawDoc?.mestreId || SAMAMBAIA_MESTRE_UID,
    visibility: target?.rawDoc?.visibility || 'mestre_group', ownerId, updatedAt: Date.now(),
  };

  if (finalPresetId) {
    await setDoc(doc(db, 'presets', finalPresetId), presetPayload, { merge: true });
  } else {
    presetPayload.createdAt = Date.now();
    finalPresetId = (await addDoc(collection(db, 'presets'), presetPayload)).id;
  }

  // 3. Synchronisation retour du BPM vers Organizador (/documents) et Cantador (sans écraser recordedBpm)
  const docId = project.toadaMeta?.id || (project.source === 'organizador' ? project.id : undefined);
  if (docId) {
    try {
      await updateDoc(doc(db, 'documents', docId), {
        bpmDefaut: sequenciadorBpm, bpm: sequenciadorBpm, lienSequenceurId: finalPresetId,
        tonaliteDefaut: pubRes.publishedPack.troupeKey, updatedAt: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  }

  const updatedProject = applySequenciadorBpmBackToProject(project, sequenciadorBpm, finalPresetId);
  return {
    presetId: finalPresetId, morceauName, sequenciadorBpm, recordedBpm,
    sequenciadorMorceauUrl: `${getEcosystemAppUrl('sequenciador')}/?loadPreset=${encodeURIComponent(finalPresetId)}`,
    exportedPatternsCount: pubRes.exportedPatternsCount, savedMegabytes: pubRes.savedMegabytes, updatedProject,
  };
}
