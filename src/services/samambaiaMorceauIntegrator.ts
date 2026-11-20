/**
 * samambaiaMorceauIntegrator.ts
 * Récupération des morceaux sauvegardés du répertoire du groupe actif (Sequenciador `presets`),
 * intégration de la Toada Cantador avec ID unique et nettoyage automatique de `toada-default` après migration (< 138 lignes).
 */
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ToadaProject } from '../types/toadaProject.types';
import { publishToadaToSequencer } from './cloudToadaPublisher';
import { cleanupLegacyDefaultPackIfUnreferenced } from './cloudToadaStorageCleaner';
import { parseSequenciadorPresetData, encodeSequenciadorPresetData } from '../utils/lzStringCodec';
import {
  type SamambaiaMorceauSummary, normalizeMorceauTitle,
  injectToadaPackIntoSequenciadorPreset, applySequenciadorBpmBackToProject,
} from '../utils/sequenciadorPresetBuilder';
import { getEcosystemAppUrl } from '../utils/ecosystemUrls';
import { resolveActiveTenantContext, buildGroupCandidates } from './activeTenantResolver';
import { isLegacyDefaultToadaId, resolveCanonicalToadaPackId } from '../utils/toadaPackIdResolver';

function detectHasVocalToada(parsed: Record<string, any> | null, rawDoc: Record<string, any>): boolean {
  if (rawDoc?.toadaPackId || parsed?.metadata?.toadaPackId) return true;
  if (!Array.isArray(parsed?.tracks)) return false;
  return parsed.tracks.some((t: any) =>
    (t?.instrumentIdx === 10 || t?.instrumentIdx === 11) && Array.isArray(t.patterns) &&
    t.patterns.some((p: any) => Boolean(p?.vocalAudioUrl || p?.vocalClip || (Array.isArray(p?.activeSteps) && p.activeSteps.some((s: any) => s === 'P' || s === 'C'))))
  );
}

export async function fetchSamambaiaSavedMorceaux(explicitGroupId?: string | null): Promise<SamambaiaMorceauSummary[]> {
  const presetsRef = collection(db, 'presets');
  const { uid: currentUid, groupId } = await resolveActiveTenantContext(explicitGroupId);
  const groupVariants = buildGroupCandidates(groupId);
  const queries = [getDocs(query(presetsRef, where('visibility', 'in', ['admin_global', 'public']), limit(150)))];
  if (groupVariants.length > 0) queries.unshift(getDocs(query(presetsRef, where('groupId', 'in', groupVariants), limit(150))));
  if (currentUid) {
    queries.push(getDocs(query(presetsRef, where('ownerId', '==', currentUid), limit(100))));
    queries.push(getDocs(query(presetsRef, where('mestreId', '==', currentUid), limit(100))));
  }

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
  sequenciadorMorceauUrl: string; exportedPatternsCount: number; uploadedWavsCount: number;
  purgedCloudFilesCount: number; savedMegabytes: string; updatedProject: ToadaProject;
}

export async function integrateToadaIntoSamambaiaMorceau(
  project: ToadaProject, options: IntegrateMorceauOptions, onProgress?: (msg: string) => void
): Promise<IntegrateMorceauResult> {
  const target = options.targetMorceau;
  const wasTargetLegacyDefault = target?.toadaPackId === 'toada-default';
  const canonicalProject: ToadaProject = { ...project, id: resolveCanonicalToadaPackId(project) };
  const sequenciadorBpm = target ? target.bpm : Math.max(30, Math.round(Number(options.createNewMorceau?.bpm || project.bpm || 96)));
  const morceauName = target ? target.name : (options.createNewMorceau?.name?.trim() || project.title || 'Nouvelle Toada');
  const firstPat = canonicalProject.patterns[0];
  const recordedBpm = Math.round(Number((firstPat as any)?.recordedBpm || firstPat?.recordingResult?.recordedBpm || firstPat?.baseBpm || project.bpm || sequenciadorBpm));

  const pubRes = await publishToadaToSequencer(canonicalProject, onProgress, sequenciadorBpm, { purgeStorageOrphans: true });

  onProgress?.(`Intégration dans le morceau "${morceauName}" (${sequenciadorBpm} BPM)...`);
  const basePreset = target?.parsedPreset || {
    bpm: sequenciadorBpm, timeSig: project.timeSignature || '4/4', totalMeasures: 8, tracks: [],
    metadata: { toada: morceauName, nacao: project.toadaMeta?.nacao || 'Nagô', ritmo: options.createNewMorceau?.ritmo || 'Baque Virado' },
  };
  const tenant = await resolveActiveTenantContext(project.toadaMeta?.groupId);
  const resolvedUid = target?.rawDoc?.ownerId || tenant.uid;
  if (!resolvedUid) throw new Error('Session authentifiée requise pour intégrer un morceau dans Sequenciador.');
  const resolvedGroupId = String(target?.rawDoc?.groupId || project.toadaMeta?.groupId || tenant.groupId || '').trim().toLowerCase();
  if (!resolvedGroupId) throw new Error('Aucun groupe actif identifié pour ce morceau.');
  let finalPresetId = target?.id || '';
  const mergedPreset = injectToadaPackIntoSequenciadorPreset(basePreset, pubRes.publishedPack, sequenciadorBpm, finalPresetId || undefined);
  const presetPayload: Record<string, any> = {
    name: morceauName, data: encodeSequenciadorPresetData(mergedPreset), bpm: sequenciadorBpm, toadaPackId: pubRes.toadaId,
    groupId: resolvedGroupId, mestreId: target?.rawDoc?.mestreId || tenant.uid || resolvedUid,
    visibility: target?.rawDoc?.visibility || 'mestre_group', ownerId: resolvedUid, updatedAt: Date.now(),
  };

  if (finalPresetId) await setDoc(doc(db, 'presets', finalPresetId), presetPayload, { merge: true });
  else { presetPayload.createdAt = Date.now(); finalPresetId = (await addDoc(collection(db, 'presets'), presetPayload)).id; }

  let extraPurged = 0;
  if (wasTargetLegacyDefault && !isLegacyDefaultToadaId(pubRes.toadaId)) {
    extraPurged = await cleanupLegacyDefaultPackIfUnreferenced(pubRes.toadaId);
  }

  const docId = project.toadaMeta?.id;
  if (docId && !isLegacyDefaultToadaId(docId)) {
    await updateDoc(doc(db, 'documents', docId), {
      cantadorToadaId: pubRes.toadaId, cantadorValidated: true, bpmDefaut: sequenciadorBpm,
      bpm: sequenciadorBpm, lienSequenceurId: finalPresetId, tonaliteDefaut: pubRes.publishedPack.troupeKey, updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  const synced = applySequenciadorBpmBackToProject(canonicalProject, sequenciadorBpm, finalPresetId);
  const updatedProject: ToadaProject = { ...synced, id: pubRes.toadaId, toadaMeta: { ...(synced.toadaMeta || {}), cantadorToadaId: pubRes.toadaId } };
  return {
    presetId: finalPresetId, morceauName, sequenciadorBpm, recordedBpm,
    sequenciadorMorceauUrl: `${getEcosystemAppUrl('sequenciador')}/?loadPreset=${encodeURIComponent(finalPresetId)}`,
    exportedPatternsCount: pubRes.exportedPatternsCount, uploadedWavsCount: pubRes.uploadedWavsCount,
    purgedCloudFilesCount: pubRes.purgedCloudFilesCount + extraPurged, savedMegabytes: pubRes.savedMegabytes, updatedProject,
  };
}
