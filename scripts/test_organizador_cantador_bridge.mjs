import assert from 'node:assert';
import { normalizeToadaDoc, normalizeLexiconList, normalizeQuizList, normalizeHarmonyGrid } from '../src/utils/toadaDocNormalizer.ts';
import { parseToadaDocument } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { createDefaultToadaProject } from '../src/types/toadaProject.types.ts';
import { mergeAndDeduplicateToadas } from '../src/utils/varalSongFilter.ts';
import { sanitizePatternForFirestore } from '../src/services/toadaPublishHelpers.ts';

console.log('🧪 Démarrage des tests de la Passerelle Organizador ➔ Cantador ➔ Sequenciador...');

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
  bpmDefaut: 92,
  notesLexique: rawLexique,
  questionsQcm: rawQuiz,
  harmonyGrid: ['Dm', 'A7'],
  parolesOriginales: `[Dm] *Negro vem de Luanda*\n[A7] Trazendo o baque virado`,
  traduction: 'Du Nord au Sud',
  anecdote: 'Morceau traditionnel composé à Recife.'
};

const normalizedDoc = normalizeToadaDoc('test_doc_123', mockOrganizadorDoc);
assert.strictEqual(normalizedDoc.titre, 'De Norte a Sul - Live Edité');
assert.strictEqual(normalizedDoc.bpmDefaut, 92);
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
assert.strictEqual(generatedProject.bpm, 92, 'Le BPM du projet doit être 92');
assert.strictEqual(generatedProject.toadaMeta?.notesLexique?.length, 2, 'Le lexique d Organizador ne doit pas être écrasé');
assert.strictEqual(generatedProject.toadaMeta?.notesLexique[0].mot, 'Xangô');
assert.strictEqual(generatedProject.toadaMeta?.questionsQcm?.length, 1, 'Le QCM d Organizador ne doit pas être écrasé');
assert.strictEqual(generatedProject.toadaMeta?.questionsQcm[0].question, 'Qui est Xangô ?');
assert.ok(generatedProject.globalHarmonyGrid, 'La grille harmonique globale doit être injectée');
assert.ok(generatedProject.patterns[0]?.harmonyGrid, 'Les patterns doivent recevoir la grille harmonique');
console.log('✅ 5. Injection sans perte dans ToadaProject OK');

// 6. Test déduplication Varal <-> Répertoire (sans pollution de templates locaux)
const merged = mergeAndDeduplicateToadas([normalizedDoc], [
  { id: 'rep_123', data: { toadaDocId: 'test_doc_123', titre: 'De Norte a Sul - Live Edité', rythme: 'Baque Virado' } }
]);
assert.strictEqual(merged.length, 1);
assert.strictEqual(merged[0].repertoireId, 'rep_123');
assert.strictEqual(merged[0].rythme, 'Baque Virado');
console.log('✅ 6. Déduplication Varal <-> Répertoire purement Cloud OK');

// 7. Test pureté de sanitizePatternForFirestore (Zéro Base64, Zéro variante fantôme)
const dirtyPat = {
  ...generatedProject.patterns[0],
  pack: { audio: { audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEA...' } },
  rawAudioSamples: new Float32Array([0.1, -0.1]),
  correctedAudioSamples: new Float32Array([0.2, -0.2]),
  recordingResult: { pcm: new Float32Array([0.1]), sampleRate: 44100 },
  rawPitchCurve: [{ timeSec: 0, freqHz: 220, midiFloat: 57, confidence: 0.9 }],
  pitchCurve: [{ timeSec: 0, freqHz: 220, midiFloat: 57, confidence: 0.9 }],
};
const cleanPat = sanitizePatternForFirestore(dirtyPat, 'https://storage.googleapis.com/test.wav', 4.5, 1.36, -1.36);
assert.strictEqual(cleanPat.pack, undefined, 'pack (et son audioBase64) doit être intégralement purgé');
assert.strictEqual(cleanPat.rawAudioSamples, undefined, 'rawAudioSamples doit être purgé');
assert.strictEqual(cleanPat.correctedAudioSamples, undefined, 'correctedAudioSamples doit être purgé');
assert.strictEqual(cleanPat.recordingResult, undefined, 'recordingResult doit être purgé');
assert.strictEqual(cleanPat.pitchCurve, undefined, 'pitchCurve doit être purgé');
assert.strictEqual(Object.keys(cleanPat.variants).length, 1, 'Seule la variante réellement enregistrée doit être exportée');
assert.strictEqual(cleanPat.variants['spd100_pit+0'].audioUrl, 'https://storage.googleapis.com/test.wav');
console.log('✅ 7. Pureté du payload Firestore /toada_packs (Zéro Base64 & Zéro variante fantôme) OK');

console.log('🎉 TOUS LES TESTS DE LA PASSERELLE ORGANIZADOR ➔ CANTADOR ➔ SEQUENCIADOR SONT PASSÉS AVEC SUCCÈS !');
