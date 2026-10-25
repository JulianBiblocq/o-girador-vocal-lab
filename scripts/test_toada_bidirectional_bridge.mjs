import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { extractInlineLineDirectives } from '../src/utils/sheetDirectiveHelper.ts';
import { parseRichTextLyricsAndPhonetics } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { stitchSyllablesFromSteps, reconstituteToadaTxt, toadaToCleanHtml } from '../src/utils/toadaTxtReconstitutor.ts';
import { syllabifySingleWord } from '../src/utils/syllableSplitter.ts';
import { convertTwoLineNotationToBrackets, extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { applyLyricsSyllablesToSteps } from '../src/utils/syllableAligner.ts';

console.log('========================================================================');
console.log('🧪 TEST AUTOMATISÉ : PASSERELLE BIDIRECTIONNELLE CANTADOR <-> ORGANIZADOR');
console.log('========================================================================\n');

// 1. Test Élisision par apostrophe (1.1)
console.log('▶️ Test 1.1 : Élision par apostrophe (monosyllabique vs polysyllabique)');
const elisionMono1 = syllabifySingleWord("e'o");
assert.deepStrictEqual(elisionMono1, ["e'o "], "Doit traiter e'o comme monosyllabe insécable");
const elisionMono2 = syllabifySingleWord("d'água");
assert.deepStrictEqual(elisionMono2, ["d'água "], "Doit traiter d'água comme monosyllabe insécable");
const elisionPoly = syllabifySingleWord("trazendo'o");
assert.deepStrictEqual(elisionPoly, ["tra", "zen", "do'o "], "Doit découper le radical et fusionner uniquement la dernière syllabe avec 'o");
console.log('  ✅ Test 1.1 validé : Élisisions gérées parfaitement.\n');

// 2. Test Format .txt sur 2 lignes (1.2)
console.log('▶️ Test 1.2a : Conversion format .txt 2 lignes manuscrit vers crochets [b]');
// Col 0: 1 (vide), Col 3: 2 (Vovó), Col 14: 3 (e'o), Col 18: 4 (barão), Col 24: 1 (assinou)
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
console.log('  ✅ Test 1.3 validé : Calage syllabique mathématiquement parfait.\n');

// 5. Test Déduplication (x2) & Tuilage Horizontal (1.4)
console.log('▶️ Test 1.4 : Déduplication unifiée (x2) et tuilage horizontal advanceMeasures');
const repeatText = `[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou

[2]Vovó falou [3]e'o [4]barão [1]assinou`;

const baseProject = { id: 'p1', title: 'Test', bpm: 55, timeSignature: '4/4', patterns: [], slots: [], activePatternId: '' };
const parsedRepeat = { segments: parseRichTextLyricsAndPhonetics(repeatText, undefined, 'puxador') };
const genRepeat = generateToadaFromSheet(baseProject, parsedRepeat);

assert.strictEqual(genRepeat.patterns.length, 1, `Les 2 phrases doivent partager 1 seul VocalPatternItem (obtenu: ${genRepeat.patterns.length})`);
assert.strictEqual(genRepeat.slots.length, 2, 'Doit générer 2 slots');
const activeId0 = genRepeat.slots[0].puxadorPatternId || genRepeat.slots[0].coroPatternId;
const activeId1 = genRepeat.slots[1].puxadorPatternId || genRepeat.slots[1].coroPatternId;
assert.strictEqual(activeId0, genRepeat.patterns[0].id);
assert.strictEqual(activeId1, genRepeat.patterns[0].id);
assert.strictEqual(genRepeat.slots[0].advanceMeasures, 1, 'Slot 0 doit avancer de 1 mesure pour tuiler sans trou de 3 temps');
const deNorteLyrics = `*[3] _ Negro [4]vem de Lu[1]anda [2]Trazen[3]_do [4]o baque vi[1]rado nação*\n[3] _ Negro [4]vem de Lu[1]anda [2]Trazen[3]_do [4]o baque vi[1]rado nação`;
const genDeNorte = generateToadaFromSheet(baseProject, { segments: parseRichTextLyricsAndPhonetics(deNorteLyrics, undefined, 'puxador') });
assert.strictEqual(genDeNorte.patterns.length, 2, 'Doit générer 1 pattern Puxador et 1 pattern Coro distincts');
assert.strictEqual(genDeNorte.patterns[0].measuresCount, 2, 'Puxador doit avoir 2 mesures');
assert.strictEqual(genDeNorte.patterns[0].hasAnacrusis, true, 'Puxador doit avoir anacrouse');
assert.strictEqual(genDeNorte.patterns[1].measuresCount, 2, 'Coro doit avoir 2 mesures');
assert.strictEqual(genDeNorte.patterns[1].hasAnacrusis, true, 'Coro doit avoir anacrouse');
console.log('  ✅ Test 1.4 & 1.4b validés : Déduplication et De Norte a Sul (2M + Ana) confirmés.\n');

// 6. Test Nettoyage HTML Varal (1.5)
console.log('▶️ Test 1.5 : Nettoyage HTML Varal (zéro [1]..[12], zéro _)');
const cleanVaral = toadaToCleanHtml("[1] _ [2]Vovó falou [3]e'o [4]barão [1]assinou");
assert.strictEqual(cleanVaral, '<p>Vovó falou e\'o barão assinou</p>', `HTML doit être 100% propre (obtenu: ${cleanVaral})`);
assert(!cleanVaral.includes('_'), 'Le HTML ne doit pas contenir de _');
assert(!cleanVaral.includes('['), 'Le HTML ne doit pas contenir de crochets');
console.log('  ✅ Test 1.5 validé : HTML Varal 100% propre.\n');

// 7. Test Règle Anti-Monolithe (< 140 lignes)
console.log('▶️ Test 1.6 : Règle Anti-Monolithe (< 140 lignes par fichier)');
const files = [
  'src/types/toadaDocument.types.ts',
  'src/types/toadaProject.types.ts',
  'src/utils/syllableSplitter.ts',
  'src/utils/timeAnchorParser.ts',
  'src/utils/sheetDirectiveHelper.ts',
  'src/utils/toadaSheetParser.ts',
  'src/utils/syllableAligner.ts',
  'src/utils/toadaConductorGenerator.ts',
  'src/utils/toadaTxtReconstitutor.ts',
  'src/services/organizadorToadaPublisher.ts',
  'src/components/header/SaveAndExportDropdown.tsx'
];

for (const f of files) {
  const absPath = path.resolve(process.cwd(), f);
  const lines = fs.readFileSync(absPath, 'utf8').split('\n').length;
  console.log(`   - ${f} : ${lines} lignes`);
  assert(lines < 140, `${f} dépasse 140 lignes (${lines})`);
}
console.log('  ✅ Test 1.6 validé : 100% des fichiers sont strictement sous 140 lignes.\n');

console.log('========================================================================');
console.log('🏆 TOUS LES TESTS DE LA MISSION CANTADOR SONT 100% VALIDÉS !');
console.log('========================================================================');
