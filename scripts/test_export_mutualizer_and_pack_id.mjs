/**
 * scripts/test_export_mutualizer_and_pack_id.mjs
 * Tests unitaires Node : résolution déterministe de `packId` (fin de `toada-default`),
 * détection/mutualisation des prises répétées (`single` / `pair_ab` / `keep`, purge locale opt-in),
 * empreinte binaire WAV et filtrage Storage strictement scopé à `${packId}_*` + parité i18n FR/PT-BR.
 * Lancer : node --import ./scripts/resolve-ts.mjs scripts/test_export_mutualizer_and_pack_id.mjs
 */
import assert from 'node:assert/strict';
import {
  isLegacyDefaultToadaId,
  resolveCanonicalToadaPackId,
  buildOrganizadorToadaPackId,
  generateFreshToadaPackId,
} from '../src/utils/toadaPackIdResolver.ts';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/utils/toadaProjectDefaults.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import {
  detectExportTwinGroups,
  applyExportTwinMutualization,
  scoreBestVocalTake,
} from '../src/utils/exportTwinMutualizer.ts';
import { getPatternUsageCount } from '../src/utils/unusedPatternsPurger.ts';
import {
  computeWavBufferFingerprint,
  filterStalePackStoragePaths,
  extractStoragePathFromAudioUrl,
} from '../src/services/cloudToadaStorageCleaner.ts';
import { exportCleanupTranslationsFr } from '../src/i18n/exportCleanupTranslationsFr.ts';
import { exportCleanupTranslationsBr } from '../src/i18n/exportCleanupTranslationsBr.ts';

function makePcm(len, amp, seed = 1) {
  const arr = new Float32Array(len);
  for (let i = 0; i < len; i++) arr[i] = Math.sin((i + seed) * 0.05) * amp;
  return arr;
}

console.log('=== TEST 1 : Résolution canonique de packId (zéro toada-default, zéro underscore) ===');
{
  const def = createDefaultToadaProject();
  assert.equal(isLegacyDefaultToadaId(def.id), false, 'createDefaultToadaProject ne doit plus retourner toada-default');
  assert.equal(def.id.includes('_'), false, 'aucun underscore autorisé dans packId');
  assert.equal(generateFreshToadaPackId().includes('_'), false);

  const legacyVovo = { id: 'toada-default', toadaMeta: { id: 'AZ0i0QaxiD2Zj5m9pwYW' } };
  assert.equal(resolveCanonicalToadaPackId(legacyVovo), 'toada-AZ0i0QaxiD2Zj5m9pwYW');
  assert.equal(buildOrganizadorToadaPackId('doc_with_under'), 'toada-doc-with-under');

  const openSongA = { ...def, id: 'toada-docA', toadaMeta: { id: 'docA' } };
  const sheetB = {
    docMeta: { id: 'DsypulOezkKx8Bavbevp', titre: 'Tem Macaíba', bpmDefaut: 92 },
    segments: [{ cardIndex: 0, role: 'puxador', text: 'Tem macaíba', measuresCount: 2, hasAnacrusis: false }],
  };
  const genB = generateToadaFromSheet(openSongA, sheetB);
  assert.equal(genB.id, 'toada-DsypulOezkKx8Bavbevp', 'changer de fiche Organizador doit changer project.id');

  const txtImport = generateToadaFromSheet(genB, { docMeta: { titre: 'Libre TXT' }, segments: sheetB.segments }, { forceNewIfNoDoc: true });
  assert.notEqual(txtImport.id, genB.id, 'un import .txt sans doc.id doit recevoir un nouvel ID propre');
  assert.equal(isLegacyDefaultToadaId(txtImport.id), false);
  console.log('  OK : IDs déterministes et isolés');
}

console.log('=== TEST 2 : Mutualisation des prises répétées (single vs pair_ab + meilleure prise + purge locale opt-in) ===');
{
  const sr = 44100, expectedSamples = Math.round(sr * 2 * 4 * (60 / 88)); // ~5.45s
  const mkTake = (id, role, lyrics, pcm) => {
    const p = createDefaultVocalPattern(role, id, 2, 88);
    p.id = id;
    p.assignedLyricsText = lyrics;
    p.recordingResult = { pcm, sampleRate: sr, recordedBpm: 88 };
    p.rawAudioSamples = pcm;
    p.trimStartSec = 0;
    p.trimEndSec = pcm.length / sr;
    return p;
  };

  // Groupe 1 : 4 refrains consécutifs Vovó falou (prises distinctes : silencieuse, idéale, bonne, écrêtée)
  const vSilent = mkTake('pat-v1', 'puxador', 'Vovó falou e o barão assinou', makePcm(expectedSamples, 0.002, 1));
  const vBest = mkTake('pat-v2', 'puxador', 'Vovó falou e o barão assinou', makePcm(expectedSamples, 0.18, 2));
  vBest.isNotesValidated = true;
  const vSecond = mkTake('pat-v3', 'puxador', 'Vovó falou e o barão assinou', makePcm(expectedSamples, 0.14, 3));
  const vClipped = mkTake('pat-v4', 'puxador', 'Vovó falou e o barão assinou', makePcm(expectedSamples, 1.0, 4));

  assert.ok(scoreBestVocalTake(vBest, 88) > scoreBestVocalTake(vSilent, 88), 'prise saine > prise muette');
  assert.ok(scoreBestVocalTake(vBest, 88) > scoreBestVocalTake(vClipped, 88), 'prise saine > prise saturée');

  // Groupe 2 : 2 couplets ayant EXACTEMENT le même buffer audio => dédupliqués silencieusement, pas de prompt utilisateur
  const sharedPcm = makePcm(expectedSamples, 0.15, 9);
  const cSame1 = mkTake('pat-c1', 'coro', 'Na marcação das alfaias', sharedPcm);
  const cSame2 = mkTake('pat-c2', 'coro', 'Na marcação das alfaias', sharedPcm);

  // Groupe 3 : 2 refrains NON consécutifs séparés par cSame1
  const rAlt1 = mkTake('pat-r1', 'coro', 'Estrela brilhante', makePcm(expectedSamples, 0.16, 11));
  const rAlt2 = mkTake('pat-r2', 'coro', 'Estrela brilhante', makePcm(expectedSamples, 0.12, 12));

  // Pattern inutilisé dans slots
  const unusedPat = mkTake('pat-unused', 'puxador', 'Brouillon abandonné', makePcm(expectedSamples, 0.1, 20));

  const project = {
    ...createDefaultToadaProject(),
    id: 'toada-AZ0i0QaxiD2Zj5m9pwYW',
    bpm: 88,
    patterns: [vSilent, vBest, vSecond, vClipped, cSame1, cSame2, rAlt1, rAlt2, unusedPat],
    slots: [
      { slotId: 's1', puxadorPatternId: 'pat-v1', coroPatternId: 'pat-r1' },
      { slotId: 's2', puxadorPatternId: 'pat-v2', coroPatternId: 'pat-c1' },
      { slotId: 's3', puxadorPatternId: 'pat-v3', coroPatternId: 'pat-r2' },
      { slotId: 's4', puxadorPatternId: 'pat-v4', coroPatternId: 'pat-c2' },
    ],
  };

  const groups = detectExportTwinGroups(project);
  assert.equal(groups.length, 2, 'seuls les groupes à audios distincts doivent être proposés (cSame1/cSame2 ignoré)');
  const gVovo = groups.find((g) => g.role === 'puxador');
  const gEstrela = groups.find((g) => g.role === 'coro');
  assert.equal(gVovo.hasAdjacentRepeat, true, 'Vovó se suit immédiatement => anti-mitraillette');
  assert.equal(gVovo.recommendedChoice, 'pair_ab');
  assert.equal(gVovo.bestPatternId, 'pat-v2');
  assert.equal(gVovo.secondBestPatternId, 'pat-v3');
  assert.equal(gEstrela.hasAdjacentRepeat, false, 'Estrela est séparé par un couplet => pas de répétition immédiate');
  assert.equal(gEstrela.recommendedChoice, 'single');

  // Application avec purgeLocalUnused = false (défaut)
  const keptLocal = applyExportTwinMutualization(project, {}, { purgeLocalUnused: false });
  assert.deepEqual(keptLocal.slots.map((s) => s.puxadorPatternId), ['pat-v2', 'pat-v3', 'pat-v2', 'pat-v3'], 'Paire A+B alternée');
  assert.equal(keptLocal.slots[0].coroPatternId, 'pat-r1');
  assert.equal(keptLocal.slots[2].coroPatternId, 'pat-r1', '1 seule prise pour Estrela');
  assert.equal(keptLocal.patterns.length, 9, 'les prises de réserve restent en local quand purgeLocalUnused=false');
  assert.equal(getPatternUsageCount(keptLocal, 'pat-v1'), 0);
  assert.equal(getPatternUsageCount(keptLocal, 'pat-unused'), 0);

  // Application avec purgeLocalUnused = true
  const purgedLocal = applyExportTwinMutualization(project, {}, { purgeLocalUnused: true });
  assert.equal(purgedLocal.patterns.length, 5, 'seuls les 5 patterns actifs restent en local quand purgeLocalUnused=true');
  console.log('  OK : détection, classement RMS/saturation, Paire A+B / Prise unique et option locale');
}

console.log('=== TEST 3 : Empreinte binaire WAV & Filtrage Storage strictement scopé ===');
{
  const ab1 = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 5, 6]).buffer;
  const ab2 = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 5, 6]).buffer;
  const ab3 = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 5, 7]).buffer;
  assert.equal(computeWavBufferFingerprint(ab1), computeWavBufferFingerprint(ab2));
  assert.notEqual(computeWavBufferFingerprint(ab1), computeWavBufferFingerprint(ab3));

  const bucketItems = [
    'vocalRecordings/1790296486916_1791066541252.wav', // Opanijé (ne jamais toucher)
    'vocalRecordings/toada-default_pat-mw51a504-3f6o.wav', // legacy (ne jamais toucher par filtre scopé)
    'vocalRecordings/toada-AZ0i0QaxiD2Zj5m9pwYW_pat-active1.wav', // actif de cette Toada
    'vocalRecordings/toada-AZ0i0QaxiD2Zj5m9pwYW_pat-oldSlicer2.wav', // ancien de cette Toada -> À PURGER
    'vocalRecordings/toada-AZ0i0QaxiD2Zj5m9pwYW2_pat-otherSong.wav', // autre Toada au préfixe proche -> NE PAS TOUCHER
  ];
  const kept = new Set(['vocalRecordings/toada-AZ0i0QaxiD2Zj5m9pwYW_pat-active1.wav']);
  const stale = filterStalePackStoragePaths(bucketItems, 'toada-AZ0i0QaxiD2Zj5m9pwYW', kept);
  assert.deepEqual(stale, ['vocalRecordings/toada-AZ0i0QaxiD2Zj5m9pwYW_pat-oldSlicer2.wav']);
  assert.deepEqual(filterStalePackStoragePaths(bucketItems, 'toada-default', new Set()), [], 'blocage strict sur toada-default');
  assert.equal(
    extractStoragePathFromAudioUrl('https://firebasestorage.googleapis.com/v0/b/o-girador-7828c.firebasestorage.app/o/vocalRecordings%2Ftoada-abc_pat-1.wav?alt=media'),
    'vocalRecordings/toada-abc_pat-1.wav'
  );
  console.log('  OK : isolation stricte par packId et déduplication binaire exacte');
}

console.log('=== TEST 4 : Parité i18n FR / PT-BR & Règle 0 ===');
{
  const frKeys = Object.keys(exportCleanupTranslationsFr).sort();
  const brKeys = Object.keys(exportCleanupTranslationsBr).sort();
  assert.deepEqual(frKeys, brKeys, 'clés FR et PT-BR identiques');
  for (const k of frKeys) {
    for (const val of [exportCleanupTranslationsFr[k], exportCleanupTranslationsBr[k]]) {
      assert.ok(typeof val === 'string' && val.trim().length > 0, `clé vide : ${k}`);
      assert.equal(/\bbateria\b/i.test(val), false, `mot Bateria interdit dans ${k}`);
      assert.equal(/\bIA\b/.test(val), false, `acronyme IA interdit dans ${k}`);
    }
  }
  console.log('  OK : parité FR / PT-BR et lexique Règle 0 conformes');
}

console.log('\n✅ test_export_mutualizer_and_pack_id : tous les contrôles passent');
