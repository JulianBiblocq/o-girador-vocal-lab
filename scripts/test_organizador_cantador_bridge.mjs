import assert from 'node:assert';
import { normalizeToadaDoc, normalizeLexiconList, normalizeQuizList, normalizeHarmonyGrid } from '../src/utils/toadaDocNormalizer.ts';
import { parseToadaDocument } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { createDefaultToadaProject } from '../src/types/toadaProject.types.ts';
import { mergeWithLocalSamambaiaToadas } from '../src/utils/samambaiaToadaResolver.ts';

console.log('🧪 Démarrage des tests de la Passerelle Organizador ➔ Cantador...');

// 1. Test de normalisation des notesLexique
const rawLexique = [
  { mot: 'Xangô', explication: 'Orixá du tonnerre et de la justice', traductionFr: 'Divinité de la justice' },
  { mot: 'Batuqueiro', explication: 'Joueur de tambour de Maracatu' }
];
const normLex = normalizeLexiconList(rawLexique);
assert.strictEqual(normLex.length, 2, 'Doit avoir 2 entrées lexique');
assert.strictEqual(normLex[0].mot, 'Xangô');
assert.strictEqual(normLex[0].traductionFr, 'Divinité de la justice');
assert.strictEqual(normLex[1].traductionFr, 'Joueur de tambour de Maracatu');
console.log('✅ 1. Normalisation notesLexique OK');

// 2. Test de normalisation des questionsQcm
const rawQuiz = [
  { question: 'Qui est Xangô ?', options: ['Un Orixá', 'Une cloche'], correctIndex: 0, extraitTexte: 'Viva Xangô' }
];
const normQuiz = normalizeQuizList(rawQuiz);
assert.strictEqual(normQuiz.length, 1, 'Doit avoir 1 question');
assert.strictEqual(normQuiz[0].question, 'Qui est Xangô ?');
assert.strictEqual(normQuiz[0].correctIndex, 0);
console.log('✅ 2. Normalisation questionsQcm OK');

// 3. Test de normalisation de harmonyGrid
const normGridFromChords = normalizeHarmonyGrid(['Dm', 'A7']);
assert.ok(normGridFromChords?.measures?.length >= 2, 'Doit générer une grille harmonique valide');
assert.strictEqual(normGridFromChords?.measures[0].chordsByBeat[0], 'Dm');
assert.strictEqual(normGridFromChords?.measures[1].chordsByBeat[0], 'A7');
console.log('✅ 3. Normalisation harmonyGrid OK');

// 4. Test du document complet Organizador -> normalizeToadaDoc
const mockOrganizadorDoc = {
  titre: 'De Norte a Sul - Live Edité',
  type: 'song',
  notesLexique: rawLexique,
  questionsQcm: rawQuiz,
  harmonyGrid: ['Dm', 'A7'],
  parolesOriginales: `[Dm] *Negro vem de Luanda*\n[A7] Trazendo o baque virado`,
  traduction: 'Du Nord au Sud',
  anecdote: 'Morceau traditionnel composé à Recife.'
};

const normalizedDoc = normalizeToadaDoc('test_doc_123', mockOrganizadorDoc);
assert.strictEqual(normalizedDoc.titre, 'De Norte a Sul - Live Edité');
assert.strictEqual(normalizedDoc.notesLexique?.length, 2);
assert.strictEqual(normalizedDoc.questionsQcm?.length, 1);
assert.ok(normalizedDoc.harmonyGrid);
assert.strictEqual(normalizedDoc.traduction, 'Du Nord au Sud');
console.log('✅ 4. normalizeToadaDoc préserve toutes les métadonnées OK');

// 5. Test parseToadaDocument & generateToadaFromSheet
const baseProject = createDefaultToadaProject();
const parsed = parseToadaDocument(normalizedDoc, 'puxador');
assert.ok(parsed.docMeta?.notesLexique?.length === 2);
assert.ok(parsed.docMeta?.questionsQcm?.length === 1);
assert.ok(parsed.docMeta?.harmonyGrid);

const generatedProject = generateToadaFromSheet(baseProject, parsed);
assert.strictEqual(generatedProject.title, 'De Norte a Sul - Live Edité');
assert.strictEqual(generatedProject.toadaMeta?.notesLexique?.length, 2, 'Le lexique d Organizador ne doit pas être écrasé');
assert.strictEqual(generatedProject.toadaMeta?.notesLexique[0].mot, 'Xangô');
assert.strictEqual(generatedProject.toadaMeta?.questionsQcm?.length, 1, 'Le QCM d Organizador ne doit pas être écrasé');
assert.strictEqual(generatedProject.toadaMeta?.questionsQcm[0].question, 'Qui est Xangô ?');
assert.ok(generatedProject.globalHarmonyGrid, 'La grille harmonique globale doit être injectée');
assert.ok(generatedProject.patterns[0]?.harmonyGrid, 'Les patterns doivent recevoir la grille harmonique');
console.log('✅ 5. Injection sans perte dans ToadaProject OK');

// 6. Test de non-régression Samambaia (le document live Firestore prévaut sur le template local)
const liveFirestoreSamambaia = normalizeToadaDoc('JldyOUUlSWSN2Nth63wt', {
  titre: 'De Norte a Sul',
  type: 'song',
  notesLexique: [{ mot: 'Batuqueiro', explication: 'Percussionniste' }],
  questionsQcm: [{ question: 'Que signifie Batuqueiro ?', options: ['Percussionniste', 'Chanteur'], correctIndex: 0 }],
  parolesOriginales: `[Dm] *Negro vem de Luanda*\n[A7] Trazendo o baque virado`
});

const mergedSamambaia = mergeWithLocalSamambaiaToadas([liveFirestoreSamambaia]);
const foundMerged = mergedSamambaia.find((t) => t.id === 'JldyOUUlSWSN2Nth63wt');
assert.ok(foundMerged, 'Le document Samambaia doit exister');
assert.strictEqual(foundMerged.notesLexique?.length, 1, 'Le document Firestore ne doit pas être écrasé par le local vide');
assert.strictEqual(foundMerged.notesLexique[0].mot, 'Batuqueiro');
assert.strictEqual(foundMerged.questionsQcm?.length, 1);
console.log('✅ 6. Priorité Firestore sur le template local Samambaia OK');

console.log('🎉 TOUS LES TESTS DE LA PASSERELLE ORGANIZADOR ➔ CANTADOR SONT PASSÉS AVEC SUCCÈS !');
