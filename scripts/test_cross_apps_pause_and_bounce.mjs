/**
 * test_cross_apps_pause_and_bounce.mjs
 * Suite de tests transversale Organizador <-> Cantador <-> Sequenciador :
 * 1. 0 occurrence de "Bateria" (règle terminologique Maracatu -> "Baque").
 * 2. Non-incrémentation de measuresCount sur un [1] / [M8•1]_ final de sortie (+ Fin 1).
 * 3. Support de [PAUSE XM] (1M..8M) et préservation de <u>...</u> dans Organizador.
 * 4. Avancement de X mesures sur un slot [PAUSE XM], pas liés (───), pas silencieux et +1T dans Sequenciador.
 * 5. Durée exacte à l'échantillon près (N * 4 * (60 / bpm) * sampleRate) et nommage <nom>_<bpm>bpm.wav du bounce Baque.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 1. Imports Cantador
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { parseOrganizadorCardLine, parseOrganizadorToadaSegments } from '../src/utils/toadaCardParser.ts';

// 2. Imports Organizador
import {
  parseLineToCharAnchors,
  rebuildLineFromCharAnchors,
  computePhraseMeasures,
  computeSongStructure,
} from '../../o-girador-organizador/src/utils/toadaLineEditorHelper.js';
import { groupLyricsByRole } from '../../o-girador-organizador/src/utils/toadaTwoLineConverter.js';

// 3. Imports Sequenciador
import { buildToadaConductorSlots, deployToadaCycle } from '../../o-girador-sequenciador/src/utils/toadaArrangement.ts';
import { convertToadaPattern } from '../../o-girador-sequenciador/src/utils/toadaPatternConverter.ts';
import { formatBaqueBounceFilename, computeBaqueCycleTiming } from '../../o-girador-sequenciador/src/utils/baqueBounceTiming.ts';

console.log('=== TEST CROSS-APPS : ORGANIZADOR <-> CANTADOR <-> SEQUENCIADOR ===');

// --- TEST 1 : 0 occurrence de "Bateria" dans Cantador, Sequenciador & Organizador (Toada) ---
function scanNoBateria(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const hits = [];
  for (const e of entries) {
    const full = path.join(dirPath, e.name);
    if (e.isDirectory()) hits.push(...scanNoBateria(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      const txt = fs.readFileSync(full, 'utf8');
      if (/\bbateria\b/i.test(txt)) hits.push(full);
    }
  }
  return hits;
}

const cantadorHits = scanNoBateria('E:/o-girador/o-girador-vocal-lab/src');
const sequenciadorHits = scanNoBateria('E:/o-girador/o-girador-sequenciador/src');
const organizadorToadaHits = [
  ...scanNoBateria('E:/o-girador/o-girador-organizador/src/components/documents/toada'),
];
assert.equal(cantadorHits.length, 0, `Occurrences de Bateria dans Cantador : ${cantadorHits.join(', ')}`);
assert.equal(sequenciadorHits.length, 0, `Occurrences de Bateria dans Sequenciador : ${sequenciadorHits.join(', ')}`);
assert.equal(organizadorToadaHits.length, 0, `Occurrences de Bateria dans Organizador Toada : ${organizadorToadaHits.join(', ')}`);
console.log('✅ Test 1 OK : 0 occurrence de "Bateria" dans Cantador, Sequenciador et Organizador Toada');

// --- TEST 2 : Non-incrémentation de measuresCount sur un [1] / [M8•1]_ final de sortie ---
const lineWithExitBeat1 = '*[3] _ Negro [1]vem de Lu[2]an[3]da, [1]trouxe o [2]baque [3]de [1]na[2]ção [3]e [4]fé [M8•1]_*';
const orgInfo = computePhraseMeasures(lineWithExitBeat1);
assert.equal(orgInfo.measuresCount, 3, `Organizador measuresCount doit être 3 (et non 4), reçu: ${orgInfo.measuresCount}`);
assert.equal(orgInfo.hasExitOnNextBeat1, true, 'Organizador doit détecter hasExitOnNextBeat1 = true');
assert.ok(orgInfo.badgeLabel.includes('+ Fin 1'), `Organizador badgeLabel doit afficher "+ Fin 1", reçu: ${orgInfo.badgeLabel}`);

const cantadorAnchors = extractTimeAnchors(lineWithExitBeat1);
assert.equal(cantadorAnchors.measuresCount, 3, `Cantador extractTimeAnchors.measuresCount doit être 3, reçu: ${cantadorAnchors.measuresCount}`);
const cantadorCard = parseOrganizadorCardLine(lineWithExitBeat1, 'puxador', 0);
assert.equal(cantadorCard.measuresCount, 3, `Cantador card.measuresCount doit être 3, reçu: ${cantadorCard.measuresCount}`);
assert.equal(cantadorCard.exitBeat, 1, 'Cantador card.exitBeat doit être 1');
console.log('✅ Test 2 OK : [M8•1]_ final de sortie ne gonfle pas measuresCount (3 M + Fin 1 dans Organizador & Cantador)');

// --- TEST 3 : [PAUSE XM] (1M..8M) et préservation des balises <u>...</u> dans Organizador ---
const songLines = [
  lineWithExitBeat1,
  '[PAUSE 2M]',
  '[1]Ô Lu[2]an[3]da [4]ê [1]povo [2]de [3]na[4]ção',
];
const songStruct = computeSongStructure(songLines, '4/4');
assert.equal(songStruct.totalMeasures, 3 + 2 + 2, `Total mesures attendu: 7 (3 + 2 pause + 2 coro), reçu: ${songStruct.totalMeasures}`);
assert.equal(songStruct.lineDetails[1].isPauseBaque, true);
assert.equal(songStruct.lineDetails[1].pauseMeasures, 2);

const lineWithUnderline = '*[1]Vovó fa[2]<u>lou</u> [3]que [4]vem*';
const parsedU = parseLineToCharAnchors(lineWithUnderline);
assert.equal(parsedU.charUnderlineFlags[7], true, 'Flag underline attendu sur "l" de "lou"');
assert.equal(parsedU.charUnderlineFlags[8], true, 'Flag underline attendu sur "o" de "lou"');
assert.equal(parsedU.charUnderlineFlags[9], true, 'Flag underline attendu sur "u" de "lou"');
const rebuiltU = rebuildLineFromCharAnchors(
  parsedU.rawCleanChars, parsedU.charAnchors, parsedU.hasLeadingRest, parsedU.leadingRestBeat,
  parsedU.isPuxador, parsedU.lineSignature, parsedU.charSignatures, parsedU.charUnderlineFlags
);
assert.ok(rebuiltU.includes('<u>lou</u>'), `La reconstruction doit préserver <u>lou</u>, reçu: ${rebuiltU}`);

const groupedU = groupLyricsByRole('<p><strong>Vovó fa<u>lou</u></strong></p><p>Ô Lu<u>an</u>da</p>');
assert.equal(groupedU[0], '*Vovó fa<u>lou</u>*');
assert.equal(groupedU[1], 'Ô Lu<u>an</u>da');

const cantadorCardsWithPause = parseOrganizadorToadaSegments(songLines.join('\n'));
assert.equal(cantadorCardsWithPause.length, 3);
assert.equal(cantadorCardsWithPause[1].isSilenceSlot, true);
assert.equal(cantadorCardsWithPause[1].silenceMeasures, 2);
console.log('✅ Test 3 OK : [PAUSE XM] (1M..8M) comptabilisé et balises <u>...</u> intégralement préservées');

// --- TEST 4 : Avancement de X mesures sur [PAUSE XM], pas liés (───), pas silencieux et +1T dans Sequenciador ---
const patIdMap = new Map([['pat-pux-1', 1001], ['pat-coro-1', 2001]]);
const rawPatterns = [
  { id: 'pat-pux-1', role: 'puxador', measuresCount: 3 },
  { id: 'pat-coro-1', role: 'coro', measuresCount: 2 },
];
const rawSlots = [
  { slotId: 's1', puxadorPatternId: 'pat-pux-1', coroPatternId: null, advanceMeasures: 3 },
  { slotId: 's2', puxadorPatternId: null, coroPatternId: null, advanceMeasures: 2, isSilenceSlot: true },
  { slotId: 's3', puxadorPatternId: null, coroPatternId: 'pat-coro-1', advanceMeasures: 2 },
];
const conductorSlots = buildToadaConductorSlots(rawSlots, rawPatterns, patIdMap);
assert.equal(conductorSlots.length, 3);
assert.equal(conductorSlots[1].isSilenceSlot, true);
assert.equal(conductorSlots[1].measuresCount, 2, 'Le slot [PAUSE 2M] doit avancer de 2 mesures');

const mockState = {
  totalMeasures: 4,
  bpm: 92,
  timeSig: '4/4',
  toadaConductorSlots: conductorSlots,
  tracks: [
    { id: 10, instrumentIdx: 10, patterns: [{ id: 1001, measureAssignments: [false, false, false, false] }] },
    { id: 11, instrumentIdx: 11, patterns: [{ id: 2001, measureAssignments: [false, false, false, false] }] },
  ],
};
const deployed = deployToadaCycle(mockState, 0);
assert.equal(deployed.totalMeasures, 7, 'Le cycle déployé doit couvrir 3 + 2 + 2 = 7 mesures');
const puxAssign = deployed.tracks[0].patterns[0].measureAssignments;
const coroAssign = deployed.tracks[1].patterns[0].measureAssignments;
assert.deepEqual(puxAssign, [true, true, true, false, false, false, false], 'Puxador actif sur M1..M3 puis muet');
assert.deepEqual(coroAssign, [false, false, false, false, false, true, true], 'Coro muet sur M1..M5 (dont 2M de Pause Baque M4..M5) puis actif sur M6..M7');

// Test convertToadaPattern : pas liés (───), pas silencieux (midiNumber: null) et débordement +1T (3*16 + 4 = 52 pas)
const rawSteps52 = Array.from({ length: 52 }, (_, i) => {
  if (i === 0) return { index: 0, active: true, note: 'D4', midiNumber: 62, syllable: 'Vo' };
  if (i === 1) return { index: 1, active: true, isTie: true, note: '───', midiNumber: 62, syllable: '───' };
  if (i === 2) return { index: 2, active: false, note: 'D4', midiNumber: null, syllable: '_' }; // silence 𝄽
  return { index: i, active: false, note: '', midiNumber: null, syllable: '' };
});
const convertedPat = convertToadaPattern({ id: 'pat-pux-1', name: 'Pux 1', measuresCount: 3, hasAnacrusis: false, mainSteps: rawSteps52 }, 'puxador', 1001, 92, 7);
assert.equal(convertedPat.steps, 48, 'Un débordement +1T (52 pas) ne doit jamais gonfler pattern.steps au-delà de 3*16 = 48');
assert.equal(convertedPat.activeSteps[0], 'P');
assert.equal(convertedPat.lyrics[0], 'Vo');
assert.equal(convertedPat.activeSteps[1], 'P');
assert.equal(convertedPat.lyrics[1], '───', 'Le pas lié doit avoir lyrics = "───" pour prolonger l’arc sans ré-attaque');
assert.equal(convertedPat.activeSteps[2], 0, 'Le pas silencieux (midiNumber: null / active: false) doit rester à 0 sans note fantôme');
console.log('✅ Test 4 OK : Avancement [PAUSE 2M] sur la Timeline, pas liés "───", silences et +1T vérifiés dans Sequenciador');

// --- TEST 5 : Durée exacte à l'échantillon près et nommage <nom>_<bpm>bpm.wav du bounce Baque ---
const bounceFilename = formatBaqueBounceFilename('Baque de Virada (Nação)', 92);
assert.equal(bounceFilename, 'baque_de_virada_nacao_92bpm.wav');

const N = 8, bpm = 92, sampleRate = 44100;
const timing = computeBaqueCycleTiming({ totalMeasures: N, bpm, timeSig: '4/4', sampleRate });
const expectedSec = N * 4 * (60 / bpm);
const expectedSamples = Math.round(expectedSec * sampleRate);
assert.ok(Math.abs(timing.totalDurationSec - expectedSec) < 1e-9, `Durée attendue ${expectedSec}s, reçu ${timing.totalDurationSec}s`);
assert.equal(timing.exactTotalSamples, expectedSamples, `Échantillons attendus ${expectedSamples}, reçu ${timing.exactTotalSamples}`);
console.log(`✅ Test 5 OK : Bounce Baque "${bounceFilename}" -> ${timing.exactTotalSamples} échantillons exacts (${timing.totalDurationSec.toFixed(4)}s @ ${sampleRate}Hz)`);

console.log('🎉 TOUS LES TESTS CROSS-APPS (ORGANIZADOR <-> CANTADOR <-> SEQUENCIADOR) SONT PASSÉS AVEC SUCCÈS !');
