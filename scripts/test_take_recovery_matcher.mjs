/**
 * scripts/test_take_recovery_matcher.mjs
 * Volet B : rejoue le cas réel « Vovó falou » (fiche de 16 lignes ↔ pack Cloud de 12 prises, cartes 0,1,6,7 absentes,
 * ids régénérés) et vérifie : appariement par rôle + paroles (+ carte), réutilisation pour strophes répétées,
 * garde-fou titre (`toada-default` d'un autre chant ⇒ jamais `high`), contrôle t1/trim/durée, lots Storage et en-tête WAV.
 * Lancer : node --import ./scripts/resolve-ts.mjs scripts/test_take_recovery_matcher.mjs
 */
import assert from 'node:assert/strict';
import { matchTakesToPatterns, rankTakesForPattern, isPackTitleMatching } from '../src/utils/takeRecoveryMatcher.ts';
import { parseBatchInfo, parseWavHeader, estimateWavDurationFromSize } from '../src/utils/takeRecoveryBatchInfo.ts';
import { buildSyncedPatternMatchMap, mergeCloudOnlyMatchedPattern } from '../src/utils/patternTakeMatcher.ts';
import { deleteOrphanPatternWavsFromStorage } from '../src/utils/unusedPatternsPurger.ts';

const L = { vovo: 'Vovó falou e o barão assinou', estrela: 'Estrela brilhante é Nação Nagô', alfaias: 'Na marcação das alfaias', gongue: 'No tilintar do gonguê', maracas: 'No xiquexá das maracas', agbe: 'Na marcação do agbê' };
const packRows = [ // [suffix, role, card, lyrics, trimEnd, t1, kb]
  ['xtwx', 'coro', 2, L.estrela, 3.472958, 0], ['o444', 'coro', 3, L.estrela, 3.289417, 0], ['xtoy', 'puxador', 4, L.vovo, 3.485, 0.004118], ['kz0u', 'puxador', 5, L.vovo, 3.352354, 0],
  ['r2e6', 'puxador', 8, L.alfaias, 3.640542, 0], ['v19z', 'puxador', 9, L.gongue, 3.465667, 0], ['7vx0', 'puxador', 10, L.maracas, 3.605667, 0], ['c2zo', 'puxador', 11, L.agbe, 3.351187, 0],
  ['ef9b', 'coro', 12, L.alfaias, 3.591771, 0], ['tvlm', 'coro', 13, L.gongue, 3.77825, 0], ['3f6o', 'coro', 14, L.maracas, 3.794708, 0], ['ptpk', 'coro', 15, L.agbe, 3.291187, 0],
];
const packTakes = packRows.map(([id, role, card, lyrics, dur, t1]) => ({
  key: `pack:${id}`, source: 'pack', storagePath: `vocalRecordings/toada-default_pat-mw51a504-${id}.wav`, sizeKb: 330, durationSec: dur, durationExact: true,
  batchKey: 'b', batchLabel: 'b', patternId: `pat-mw51a504-${id}`, role, lyrics, cardIndex: card, hasTailBeat: true, t1OffsetSec: t1, trimStartSec: 0, trimEndSec: dur, recordedBpm: 85, transpositionSemitones: 0,
}));
const sheet = [ // 16 lignes de la fiche, ids régénérés
  ['puxador', L.vovo], ['puxador', L.vovo], ['coro', L.estrela], ['coro', L.estrela], ['puxador', L.vovo], ['puxador', L.vovo], ['coro', L.estrela], ['coro', L.estrela],
  ['puxador', L.alfaias], ['puxador', L.gongue], ['puxador', L.maracas], ['puxador', L.agbe], ['coro', L.alfaias], ['coro', L.gongue], ['coro', L.maracas], ['coro', L.agbe],
];
const patterns = sheet.map(([role, lyrics], i) => ({ id: `pat-NEW-${i}`, role, assignedLyricsText: `[1]_ [2]${lyrics}`, cardIndex: i, measuresCount: 1, hasTailBeat: true, hasAnacrusis: false }));
const ctx = { patterns, bpm: 86, beatsPerMeasure: 4, projectTitle: 'Vovó falou', projectDocumentId: 'AZ0i0QaxiD2Zj5m9pwYW' };
const inv = { pack: { id: 'toada-default', title: 'Vovó falou', documentId: 'AZ0i0QaxiD2Zj5m9pwYW', transpositionSemitones: 0 }, packTakes, orphanTakes: [] };

console.log('=== TEST 1 : 16 lignes ↔ 12 prises, ids régénérés ===');
{
  const props = matchTakesToPatterns(ctx, inv), byPat = new Map(props.map((p) => [p.patternId, p]));
  assert.equal(props.length, 16, 'toutes les lignes doivent retrouver une prise');
  for (const [i, [role, lyrics]] of sheet.entries()) {
    const p = byPat.get(`pat-NEW-${i}`);
    assert.equal(p.take.role, role, `ligne ${i} : mauvais rôle`);
    assert.equal(p.take.lyrics, lyrics, `ligne ${i} : mauvaises paroles (décalage)`);
    assert.equal(p.confidence, 'high', `ligne ${i} : devrait être high (${p.warnings})`);
  }
  assert.equal(byPat.get('pat-NEW-8').take.cardIndex, 8, 'carte 8 ➔ prise de la carte 8');
  assert.equal(byPat.get('pat-NEW-12').take.cardIndex, 12, 'carte 12 ➔ prise de la carte 12');
  const reused = props.filter((p) => p.reason === 'role+lyrics(repeat)');
  assert.equal(reused.length, 4, 'les 4 strophes répétées réutilisent une prise (cartes 0,1,6,7 absentes)');
  assert.ok(reused.every((p) => p.warnings.includes('reused')));
  console.log(`  OK : 16/16 appariées, ${reused.length} réutilisations signalées, 0 décalage de paroles`);
}

console.log('=== TEST 2 : garde-fou titre (toada-default d\'un autre chant) ===');
{
  const other = { ...ctx, projectTitle: 'De Norte a Sul', projectDocumentId: 'DOC-DE-NORTE' };
  assert.equal(isPackTitleMatching('Vovó falou', 'AZ0i0QaxiD2Zj5m9pwYW', other), false);
  const props = matchTakesToPatterns(other, inv);
  assert.ok(props.every((p) => p.confidence === 'suggest' && p.warnings.includes('title-mismatch')), 'aucune prise ne doit être high');
  assert.equal(isPackTitleMatching('VOVÓ  Falou!', undefined, ctx), true, 'titre normalisé (casse/accents/ponctuation)');
  assert.equal(isPackTitleMatching('Autre titre', 'AZ0i0QaxiD2Zj5m9pwYW', ctx), true, 'même documentId ➔ chant renommé');
  console.log('  OK : titre différent ➔ 100 % suggest');
}

console.log('=== TEST 3 : prise transposée Troupe ou durée aberrante ➔ jamais high ===');
{
  const transposed = { ...inv, packTakes: packTakes.map((t) => ({ ...t, transpositionSemitones: -1 })) };
  assert.ok(matchTakesToPatterns(ctx, transposed).every((p) => p.confidence === 'suggest' && p.warnings.includes('transposed')));
  const longTakes = { ...inv, packTakes: packTakes.map((t) => ({ ...t, durationSec: 9 })) };
  assert.ok(matchTakesToPatterns(ctx, longTakes).every((p) => p.confidence === 'suggest' && p.warnings.includes('duration-far')));
  console.log('  OK');
}

console.log('=== TEST 4 : t1 / trimStart / durée attendue ===');
{
  const p = matchTakesToPatterns(ctx, inv).find((x) => x.take.patternId === 'pat-mw51a504-xtoy');
  assert.equal(p.checks.normalizedT1, 0, 't1 de 4 ms normalisé à 0');
  assert.ok(Math.abs(p.checks.expectedSec - 3.529) < 0.01, `durée attendue ${p.checks.expectedSec}`);
  assert.ok(Math.abs(p.checks.deltaPct) < 12);
  const shifted = matchTakesToPatterns(ctx, { ...inv, packTakes: packTakes.map((t) => ({ ...t, t1OffsetSec: 0.6, trimStartSec: 0.4 })) });
  assert.ok(shifted.every((x) => x.warnings.includes('t1-off') && x.warnings.includes('trim-start')));
  console.log('  OK');
}

console.log('=== TEST 5 : classement manuel des orphelins par durée ===');
{
  const orphans = [2.0, 3.5, 7.2].map((d, i) => ({ key: `o${i}`, source: 'orphan', storagePath: '', sizeKb: 1, durationSec: d, durationExact: true, batchKey: 'x', batchLabel: 'x' }));
  const ranked = rankTakesForPattern(patterns[0], orphans, ctx);
  assert.equal(ranked[0].take.key, 'o1'); assert.equal(ranked.at(-1).take.key, 'o2');
  console.log('  OK');
}

console.log('=== TEST 6 : lots Storage (préfixe + date) ===');
{
  const a = parseBatchInfo('toada-default_pat-mvphidgv-1xwr.wav', '2026-11-06T12:51:00.000Z'), b = parseBatchInfo('toada-default_pat-mvphidgv-30kq.wav', '2026-11-06T12:50:00.000Z');
  assert.equal(a.batchKey, b.batchKey); assert.equal(a.batchLabel, 'pat-mvphidgv • 06/11/2026');
  assert.notEqual(parseBatchInfo('toada-default_pat-mvoiqepd-06m1.wav', '2026-10-26T02:43:00.000Z').batchKey, a.batchKey);
  assert.equal(parseBatchInfo('1790296486916_1791066306129.wav', '2026-10-03T22:25:00Z').batchKey, 'legacy/1790296486916/2026-10-03');
  console.log('  OK');
}

console.log('=== TEST 7 : durée exacte depuis l\'en-tête WAV ===');
{
  const sr = 48000, samples = 163200, buf = new ArrayBuffer(44), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples * 2, true);
  const info = parseWavHeader(new Uint8Array(buf), 44 + samples * 2);
  assert.equal(info.sampleRate, sr); assert.ok(Math.abs(info.durationSec - 3.4) < 1e-6);
  assert.ok(Math.abs(estimateWavDurationFromSize(44 + samples * 2) - 3.4) < 1e-6);
  assert.equal(parseWavHeader(new Uint8Array(10), 10), null);
  console.log('  OK : 3.400 s');
}

console.log('=== TEST 8 : resync Organizador 16 lignes ↔ 12 patterns Cloud + purge Storage opt-in ===');
{
  const cloudPatterns = packRows.map(([id, role, card, lyrics, dur, t1]) => ({
    id: `pat-mw51a504-${id}`, name: lyrics.split(' ')[0], role, cardIndex: card, assignedLyricsText: lyrics,
    measuresCount: 1, audioUrl: `https://example.test/${id}.wav`, trimStartSec: 0, trimEndSec: dur, t1OffsetSec: t1,
  }));
  const map = buildSyncedPatternMatchMap(patterns, cloudPatterns);
  assert.equal(map.size, 16, 'les 16 lignes reçoivent un pattern Cloud');
  assert.equal(map.get('pat-NEW-4').id, 'pat-mw51a504-xtoy', 'carte 4 réservée à sa prise exacte');
  assert.equal(map.get('pat-NEW-8').id, 'pat-mw51a504-r2e6', 'carte 8 réservée à sa prise exacte');
  const merged0 = mergeCloudOnlyMatchedPattern(patterns[0], map.get('pat-NEW-0'), 86);
  assert.ok(merged0.audioUrl?.endsWith('.wav'), 'audioUrl Cloud préservé sans PCM local');
  assert.equal(await deleteOrphanPatternWavsFromStorage('toada-default', ['pat-x']), 0, 'purge Storage désactivée par défaut (opt-in)');
  console.log('  OK : 16/16 préservées + purge Storage opt-in verrouillée');
}
console.log('\n✅ test_take_recovery_matcher : tous les contrôles passent');
