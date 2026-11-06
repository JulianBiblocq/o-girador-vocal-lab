import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { extractInlineLineDirectives } from '../src/utils/toadaCardParser.ts';
import { parseRichTextLyricsAndPhonetics } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { stitchSyllablesFromSteps, reconstituteToadaTxt, toadaToCleanHtml } from '../src/utils/toadaTxtReconstitutor.ts';
import { syllabifySingleWord } from '../src/utils/syllableSplitter.ts';
import { convertTwoLineNotationToBrackets, extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { applyLyricsSyllablesToSteps } from '../src/utils/syllableAligner.ts';
import { computePatternVocalOffsetsBeats } from '../src/utils/subbeatAnchorHelper.ts';
import { calculateSliceMetricT1Sec } from '../src/utils/slicerAlignmentHelper.ts';

console.log('========================================================================');
console.log('🧪 TEST AUTOMATISÉ : PASSERELLE BIDIRECTIONNELLE CANTADOR <-> ORGANIZADOR');
console.log('========================================================================\n');

// 1. Test Élision par apostrophe (1.1)
console.log('▶️ Test 1.1 : Élision par apostrophe (monosyllabique vs polysyllabique)');
const elisionMono1 = syllabifySingleWord("e'o");
assert.deepStrictEqual(elisionMono1, ["e'o "], "Doit traiter e'o comme monosyllabe insécable");
const elisionMono2 = syllabifySingleWord("d'água");
assert.deepStrictEqual(elisionMono2, ["d'água "], "Doit traiter d'água comme monosyllabe insécable");
const elisionPoly = syllabifySingleWord("trazendo'o");
assert.deepStrictEqual(elisionPoly, ["tra", "zen", "do'o "], "Doit découper le radical et fusionner uniquement la dernière syllabe avec 'o");
console.log('  ✅ Test 1.1 validé : Élisions gérées parfaitement.\n');

// 2. Test Format .txt sur 2 lignes (1.2)
console.log('▶️ Test 1.2a : Conversion format .txt 2 lignes manuscrit vers crochets [b]');
const anchorLine = '1  2          3   4     1';
const lyricsLine = '   Vovó falou e\'o barão assinou';
const converted = convertTwoLineNotationToBrackets(anchorLine, lyricsLine);
assert.strictEqual(converted, "[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou", `Attendu crochets avec silence [1] _ (obtenu: ${converted})`);
console.log('  ✅ Test 1.2a validé : Conversion colonne par colonne réussie.\n');

// 3. Test Extraction Ancres [1]..[12] et Rests (_)
console.log('▶️ Test 1.2b : Parsing ancres [1]..[12], silences et anacrouse');
const parsedAnchors = extractTimeAnchors("[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou");
assert.strictEqual(parsedAnchors.timeAnchors.length, 5, 'Doit trouver 5 ancres');
assert.strictEqual(parsedAnchors.timeAnchors[0].beat, 1);
assert.strictEqual(parsedAnchors.timeAnchors[0].isRest, true, 'Ancre 1 doit être un silence');
assert.strictEqual(parsedAnchors.timeAnchors[1].beat, 2);
assert.strictEqual(parsedAnchors.timeAnchors[1].isRest, false, 'Ancre 2 doit porter du texte');
assert.strictEqual(parsedAnchors.timeAnchors[4].beat, 1);
assert.strictEqual(parsedAnchors.timeAnchors[4].measureOffset, 1, 'Deuxième ancre [1] doit être sur mesure 2');
assert.strictEqual(parsedAnchors.measuresCount, 2, 'Doit couvrir 2 mesures');
assert.strictEqual(parsedAnchors.hasAnacrusis, false, 'Attaque sur [1] (silence ou texte) -> sans anacrouse');
assert.strictEqual(parsedAnchors.exitBeat, 1, 'Sortie sur temps 1');

const parsedWithoutRest = extractTimeAnchors("[2]Vovó falou [3]e'o [4]barão [1]assinou");
assert.strictEqual(parsedWithoutRest.hasAnacrusis, true, 'Attaque sur temps 2 sans [1] initial -> avec anacrouse');
assert.strictEqual(parsedWithoutRest.measuresCount, 1, '1 mesure principale avec anacrouse');
assert.strictEqual(parsedWithoutRest.exitBeat, 1);

// 3b. Test De Norte a Sul (2 M + Ana) et coupure par Entrée
console.log('▶️ Test 1.2c : De Norte a Sul (1 pattern Puxador 2M+Ana, 1 pattern Coro 2M+Ana)');
const deNorteASulPux = extractTimeAnchors("[3] _ Negro [4]vem de Lu[1]anda [2]Trazen[3]_do [4]o baque vi[1]rado nação");
assert.strictEqual(deNorteASulPux.hasAnacrusis, true, 'Doit avoir une anacrouse');
assert.strictEqual(deNorteASulPux.measuresCount, 2, 'Doit couvrir exactement 2 mesures');
assert.strictEqual(deNorteASulPux.timeAnchors[0].measureOffset, 0, 'Anacrouse sur mesure 0');
assert.strictEqual(deNorteASulPux.timeAnchors[2].measureOffset, 1, '1er temps 1 sur mesure 1');
assert.strictEqual(deNorteASulPux.timeAnchors[6].measureOffset, 2, '2e temps 1 sur mesure 2');
console.log('  ✅ Test 1.2b & 1.2c validés : Extraction, 2 M + Ana et offsets Piano Roll conformes.\n');

// 4. Test Alignement Syllabique Guidé par Ancres (1.3)
console.log('▶️ Test 1.3 : Alignement syllabique calé sur (m * BPM + (b - 1)) * SPB');
const alignedSteps = applyLyricsSyllablesToSteps([], parsedAnchors.cleanText, parsedAnchors.timeAnchors, 4, 4);
assert.strictEqual(alignedSteps[0].active, false, 'Temps 1 (silence) doit avoir active: false');
assert.strictEqual(alignedSteps[1].active, false);
assert.strictEqual(alignedSteps[4].active, true, 'Temps 2 début doit être actif');
assert.strictEqual(alignedSteps[4].syllable, 'Vo');
assert.strictEqual(alignedSteps[8].active, true, 'Temps 3 début (e\'o)');
assert.strictEqual(alignedSteps[8].syllable.trim(), "e'o");
assert.strictEqual(alignedSteps[16].active, true, 'Temps 1 de la mesure suivante (step 16)');
assert.strictEqual(alignedSteps[16].syllable, 'as');

// 4b. Test Départ après soupir sur le Temps 2 ([1]_ [2]_ Na marca[3]ção / [1]_ [2]_ No tilin[3]tar)
const marcacaoParsed = extractTimeAnchors('[1]_ [2]_ Na marca[3]ção [4]do meu [1]ganzá');
assert.strictEqual(marcacaoParsed.hasAnacrusis, false, '[1]_ [2]_ ne doit pas être en anacrouse');
assert.strictEqual(marcacaoParsed.timeAnchors[0].isInitialRest, true, '[1]_ doit être un silence initial');
assert.strictEqual(marcacaoParsed.timeAnchors[1].hasLeadingRest, true, '[2]_ doit avoir hasLeadingRest: true');
assert.deepStrictEqual(marcacaoParsed.timeAnchors[1].syllableSubdivs, [1, 2, 3], 'Na mar-ca doit occuper s = 1, 2, 3 du Temps 2');
assert.strictEqual(marcacaoParsed.timeAnchors[2].isDownbeatLocked, true, 'ção sur [3] doit avoir isDownbeatLocked: true (s = 0)');
const marcacaoOffsets = computePatternVocalOffsetsBeats(marcacaoParsed.timeAnchors, false, 4, 2);
assert.strictEqual(marcacaoOffsets.firstVocalOffsetBeats, 1.25, 'firstVocalOffsetBeats doit valoir +1.25 temps après M•T1');
const marcacaoSteps = applyLyricsSyllablesToSteps([], marcacaoParsed.cleanText, marcacaoParsed.timeAnchors, 4, 4);
assert.strictEqual(marcacaoSteps[0].active, false, 'Temps 1 (s=0..3) doit être muet');
assert.strictEqual(marcacaoSteps[4].active, false, 'Temps 2 s=0 doit être un soupir muet');
assert.strictEqual(marcacaoSteps[5].syllable.trim(), 'Na', 'Temps 2 s=1 = Na');
assert.strictEqual(marcacaoSteps[6].syllable.trim(), 'mar', 'Temps 2 s=2 = mar');
assert.strictEqual(marcacaoSteps[7].syllable.trim(), 'ca', 'Temps 2 s=3 = ca');
assert.strictEqual(marcacaoSteps[8].syllable.trim(), 'ção', 'Temps 3 s=0 = ção verrouillé sur le temps');
const snappedT1 = calculateSliceMetricT1Sec(0.8 + 1.25 * (60 / 88), 88, 0.8, false, 0, undefined, marcacaoOffsets.firstVocalOffsetBeats);
assert.strictEqual(snappedT1, 0.8, 'metricT1Sec doit rester calé 1.25 temps à gauche de Na');
console.log('  ✅ Test 1.3 & 1.3b validés : Calage syllabique et départ après soupir [1]_ [2]_ Na marca[3]ção parfaits.\n');

// 5. Test 1 Carte = 1 Pattern (cardIndex) & Tuilage Horizontal (1.4)
console.log('▶️ Test 1.4 : Identité stable 1 carte = 1 pattern (cardIndex) et tuilage horizontal advanceMeasures');
const repeatText = `[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou

[2]Vovó falou [3]e'o [4]barão [1]assinou`;

const baseProject = { id: 'p1', title: 'Test', bpm: 88, timeSignature: '4/4', patterns: [], slots: [], activePatternId: '' };
const parsedRepeat = { segments: parseRichTextLyricsAndPhonetics(repeatText, undefined, 'puxador') };
const genRepeat = generateToadaFromSheet(baseProject, parsedRepeat);

assert.strictEqual(genRepeat.patterns.length, 2, `Chaque carte génère 1 pattern distinct (obtenu: ${genRepeat.patterns.length})`);
assert.strictEqual(genRepeat.patterns[0].cardIndex, 0);
assert.strictEqual(genRepeat.patterns[1].cardIndex, 1);
assert.strictEqual(genRepeat.slots.length, 2, 'Doit générer 2 slots');
assert.strictEqual(genRepeat.slots[0].advanceMeasures, 1, 'Slot 0 doit avancer de 1 mesure pour tuiler sans trou de 3 temps');

const deNorteLyrics = `*[3] _ Negro [4]vem de Lu[1]anda [2]Trazen[3]_do [4]o baque vi[1]rado nação*\n[3] _ Negro [4]vem de Lu[1]anda [2]Trazen[3]_do [4]o baque vi[1]rado nação`;
const genDeNorte = generateToadaFromSheet(baseProject, { segments: parseRichTextLyricsAndPhonetics(deNorteLyrics, undefined, 'puxador') });
assert.strictEqual(genDeNorte.patterns.length, 2, 'Doit générer 1 pattern Puxador et 1 pattern Coro distincts');
assert.strictEqual(genDeNorte.patterns[0].measuresCount, 2, 'Puxador doit avoir 2 mesures');
assert.strictEqual(genDeNorte.patterns[0].hasAnacrusis, true, 'Puxador doit avoir anacrouse');
assert.strictEqual(genDeNorte.patterns[1].measuresCount, 2, 'Coro doit avoir 2 mesures');
assert.strictEqual(genDeNorte.patterns[1].hasAnacrusis, true, 'Coro doit avoir anacrouse');
assert.strictEqual(genDeNorte.slots.length, 2, 'Appel-Réponse 1 ligne (sans ***) doit conserver 2 slots séquentiels');

// 5c. Test Superposition Tutti / Ensemble (K >= 2 lignes Puxador + Coro identiques & notation ***...***)
console.log('▶️ Test 1.4c : Superposition Tutti / Ensemble (Vovó falou K=2 & notation ***...***)');
const vovoTuttiLyrics = [
  "*[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou*",
  "*[2]Princesa Isabel [3]escreveu [4]a lei [1]áurea*",
  "[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou",
  "[2]Princesa Isabel [3]escreveu [4]a lei [1]áurea"
].join('\n');
const genVovoTutti = generateToadaFromSheet(baseProject, { segments: parseRichTextLyricsAndPhonetics(vovoTuttiLyrics, undefined, 'puxador') });
assert.strictEqual(genVovoTutti.patterns.length, 4, 'Doit créer 2 motifs Puxador + 2 motifs Coro distincts (4 au total)');
assert.strictEqual(genVovoTutti.slots.length, 2, 'Doit superposer Puxador et Coro sur 2 slots partagés au lieu de 4');
assert(genVovoTutti.slots[0].puxadorPatternId && genVovoTutti.slots[0].coroPatternId, 'Slot 1 doit avoir Puxador ET Coro');
assert(genVovoTutti.slots[1].puxadorPatternId && genVovoTutti.slots[1].coroPatternId, 'Slot 2 doit avoir Puxador ET Coro');

const explicitTuttiLyrics = "***[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou***";
const genExplicitTutti = generateToadaFromSheet(baseProject, { segments: parseRichTextLyricsAndPhonetics(explicitTuttiLyrics, undefined, 'puxador') });
assert.strictEqual(genExplicitTutti.patterns.length, 2, 'Notation ***...*** sur 1 ligne doit créer 1 motif Puxador + 1 motif Coro');
assert.strictEqual(genExplicitTutti.slots.length, 1, 'Notation ***...*** sur 1 ligne doit les placer sur 1 seul slot partagé');
assert(genExplicitTutti.slots[0].puxadorPatternId && genExplicitTutti.slots[0].coroPatternId, 'Le slot unique doit avoir Puxador ET Coro');
console.log('  ✅ Test 1.4, 1.4b & 1.4c validés : 1 carte = 1 pattern, Appel-Réponse et Tutti simultanés confirmés.\n');

// 6. Test Nettoyage HTML Varal (1.5)
console.log('▶️ Test 1.5 : Nettoyage HTML Varal (zéro [1]..[12], zéro _)');
const cleanVaral = toadaToCleanHtml("[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou");
assert.strictEqual(cleanVaral, '<p>Vovó falou e\'o barão assinou</p>', `HTML doit être 100% propre (obtenu: ${cleanVaral})`);
assert(!cleanVaral.includes('_'), 'Le HTML ne doit pas contenir de _');
assert(!cleanVaral.includes('['), 'Le HTML ne doit pas contenir de crochets');
console.log('  ✅ Test 1.5 validé : HTML Varal 100% propre.\n');

// 7. Test Règle Anti-Monolithe (< 150 lignes)
console.log('▶️ Test 1.6 : Règle Anti-Monolithe (< 150 lignes par fichier)');
const files = [
  'src/types/toadaDocument.types.ts',
  'src/types/toadaProject.types.ts',
  'src/utils/syllableSplitter.ts',
  'src/utils/timeAnchorParser.ts',
  'src/utils/toadaCardParser.ts',
  'src/utils/toadaSheetParser.ts',
  'src/utils/syllableAligner.ts',
  'src/utils/sheetSlotBuilder.ts',
  'src/utils/toadaConductorGenerator.ts',
  'src/utils/toadaTxtReconstitutor.ts',
  'src/services/organizadorToadaPublisher.ts',
  'src/components/header/SaveAndExportDropdown.tsx'
];

for (const f of files) {
  const absPath = path.resolve(process.cwd(), f);
  const lines = fs.readFileSync(absPath, 'utf8').split('\n').length;
  console.log(`   - ${f} : ${lines} lignes`);
  assert(lines < 150, `${f} dépasse 150 lignes (${lines})`);
}
console.log('  ✅ Test 1.6 validé : 100% des fichiers sont strictement sous 150 lignes.\n');

console.log('========================================================================');
console.log('🏆 TOUS LES TESTS DE LA MISSION CANTADOR SONT 100% VALIDÉS !');
console.log('========================================================================');
