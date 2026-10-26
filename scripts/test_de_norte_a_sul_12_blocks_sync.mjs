import assert from 'node:assert';
import { parseToadaDocument } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { createDefaultToadaProject } from '../src/types/toadaProject.types.ts';
import { normalizeToadaDoc } from '../src/utils/toadaDocNormalizer.ts';
import { findDocByIdOrNormalizedTitle } from '../src/utils/samambaiaToadaResolver.ts';
import { buildOrganizadorSlices } from '../src/utils/slicerAlignmentHelper.ts';

console.log('🧪 Test de synchronisation fidèle De Norte a Sul (12 blocs + BPM Organizador)...');

// 1. Données réelles exactes envoyées par Organizador pour De Norte a Sul
const mockOrganizadorDeNorteASul = {
  id: 'JldyOUUlSWSN2Nth63wt',
  titre: 'De Norte a Sul',
  bpmDefaut: 92,
  signature: '4/4',
  rawTxtCode: `*[3]_ Negro _ [4]vem _ de _ Lu[1]anda _ [2]Trazen[3]_ do _ [4]o _ baque _ vir[1]ado _ [2]nação*
[3]_ Negro _ [4]vem _ de _ Lu[1]anda _ [2]Trazen[3]_ do _ o _ [4]baque _ vir[1]ado _ [2]nação _ [3]_ [4]_
*[1]_ [2]_ Trouxe _ a _ [3]caixa, _ Trouxe _ o _ [4]gonguê*
*[1]_ [2]_ A _ ma[3]raca _ e _ o _ [4]tambor [1]_ [2]_ [3]_ [4]_*
*[1]_ Mais _ [2]é _ no _ [3]baque _ do _ [4]maracatu*
*[1]_ Es[2]trela _ Bri[3]lhante _ Brilha _ [4]de _ norte _ a _ sul*
*[1]_ [2]É _ no _ [3]baque _ do _ [4]maracatu*
*[1]_ [2]Sou _ batu[3]queiro _ de _ [4]Cangarussu*
[1]_ Mais _ [2]é _ no _ [3]baque _ do _ [4]maracatu
[1]_ Es[2]trela _ Bri[3]lhante _ Brilha _ [4]de _ norte _ a _ sul
[1]_ [2]É _ no _ [3]baque _ do _ [4]maracatu
[1]_ [2]Sou _ batu[3]queiro _ de _ [4]Cangarussu`,
  parolesOriginales: `Negro vem de Luanda Trazendo o baque virado nação...`
};

// 2. Test réconciliation par ID OU Titre normalisé
const normalizedDoc = normalizeToadaDoc('JldyOUUlSWSN2Nth63wt', mockOrganizadorDeNorteASul);
assert.strictEqual(normalizedDoc.bpmDefaut, 92, 'Le BPM normalisé doit être 92');

const foundBySlug = findDocByIdOrNormalizedTitle([normalizedDoc], 'de-norte-a-sul');
assert.ok(foundBySlug, 'Doit réconcilier "de-norte-a-sul" avec "De Norte a Sul"');
assert.strictEqual(foundBySlug.id, 'JldyOUUlSWSN2Nth63wt');

const foundByTitle = findDocByIdOrNormalizedTitle([normalizedDoc], 'De Norte a Sul');
assert.ok(foundByTitle, 'Doit réconcilier par titre exact ou avec accents');

// 3. Test parsing en 12 cartes
const parsed = parseToadaDocument(normalizedDoc, 'puxador');
assert.strictEqual(parsed.segments.length, 12, `Doit découper exactement en 12 blocs (reçu: ${parsed.segments.length})`);

// Vérification de la carte #1 : Puxador • 2 M + Ana (Negro...)
assert.strictEqual(parsed.segments[0].role, 'puxador');
assert.strictEqual(parsed.segments[0].measuresCount, 2, '#1 doit avoir 2 mesures');
assert.strictEqual(parsed.segments[0].hasAnacrusis, true, '#1 doit avoir anacrouse');
assert(parsed.segments[0].text.startsWith('Negro'), '#1 doit commencer par Negro');

// Vérification de la carte #2 : Coro • 2 M + Ana (Negro...)
assert.strictEqual(parsed.segments[1].role, 'coro');
assert.strictEqual(parsed.segments[1].measuresCount, 2, '#2 doit avoir 2 mesures');
assert.strictEqual(parsed.segments[1].hasAnacrusis, true, '#2 doit avoir anacrouse');

// Vérification de la carte #3 : Puxador • 1 M (Trouxe...)
assert.strictEqual(parsed.segments[2].role, 'puxador');
assert.strictEqual(parsed.segments[2].measuresCount, 1, '#3 doit avoir 1 mesure');
assert.strictEqual(parsed.segments[2].hasAnacrusis, false, '#3 sans anacrouse');
assert(parsed.segments[2].text.startsWith('Trouxe'), '#3 doit commencer par Trouxe');

// Vérification de la carte #4 : Puxador • 2 M (A maraca e o tambor...)
assert.strictEqual(parsed.segments[3].role, 'puxador');
assert.strictEqual(parsed.segments[3].measuresCount, 2, '#4 doit avoir 2 mesures');
assert(parsed.segments[3].text.startsWith('A maraca'), '#4 doit commencer par A maraca');
assert(!parsed.segments[3].text.includes('____'), '#4 ne doit pas avoir ____');

// Vérification de la carte #5 : Puxador • 1 M (Mais...)
assert.strictEqual(parsed.segments[4].role, 'puxador');
assert.strictEqual(parsed.segments[4].measuresCount, 1, '#5 doit avoir 1 mesure');

// Vérification des cartes #9 à #12 : Coro • 1 M
for (let c = 8; c <= 11; c++) {
  assert.strictEqual(parsed.segments[c].role, 'coro', `#${c + 1} doit être du choeur`);
  assert.strictEqual(parsed.segments[c].measuresCount, 1, `#${c + 1} doit avoir 1 mesure`);
}

// 4. Test Génération Conducteur ToadaProject
const baseProject = createDefaultToadaProject();
const generatedProject = generateToadaFromSheet(baseProject, parsed, { bpm: normalizedDoc.bpmDefaut });

assert.strictEqual(generatedProject.bpm, 92, 'Le tempo du projet généré doit être 92 BPM');
assert.strictEqual(generatedProject.slots.length, 12, 'Doit générer exactement 12 slots Conducteur');

// 5. Test Génération des tranches Slicer (calquage)
const mockDetectedSlices = [];
const slicerSlices = buildOrganizadorSlices(generatedProject.patterns, 'puxador', generatedProject.bpm, mockDetectedSlices);
assert.ok(slicerSlices.length > 0, 'Doit générer les tranches Slicer alignées');
assert.strictEqual(slicerSlices[0].measuresCount, 2, 'La tranche #1 doit avoir 2 mesures');

console.log('🎉 TEST RÉUSSI : 12 BLOCS, BPM ET CARTE CALQUÉE À 100% IDENTIQUES À ORGANIZADOR !');
