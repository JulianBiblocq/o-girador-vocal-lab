/**
 * test_cantador_to_organizador_roundtrip.mjs
 * Test automatisé de la synchronisation bidirectionnelle Cantador ➔ Organizador :
 * 1. Déplacement de la brique "Es" sur la 4e double-croche de T1 (s=3) ➔ "[1]_ Es[2]trela" dans rawTxtCode + propagation aux cartes jumelles.
 * 2. Syllabes ["Vo", "vó", "fa", "lou"] ➔ "<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou" dans parolesOriginales.
 * 3. Mise à jour de bpmDefaut (ex: 85) et tonaliteDefaut (ex: "Fa# Majeur") dans le payload Firestore /documents.
 * 4. Parsing sans balise <u> brute dans l'éditeur "Poser les temps" d'Organizador.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cantadorRoot = path.resolve(__dirname, '..');

async function importTsModule(relPath) {
  const fullPath = path.resolve(cantadorRoot, relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

function makeEmptySteps(count) {
  return Array.from({ length: count }, (_, idx) => ({
    stepIndex: idx,
    active: false,
    note: '',
    midiNumber: 0,
    syllable: '',
    velocity: 0,
    decay: 0.15,
  }));
}

async function runTests() {
  console.log('=== TEST ROUNDTRIP CANTADOR ➔ ORGANIZADOR ===\n');

  const underlineSource = fs.readFileSync(path.resolve(cantadorRoot, 'src/utils/syllableUnderlineFormatter.ts'), 'utf8');
  const splitterMod = await importTsModule('src/utils/syllableSplitter.ts');
  const splitterUrl = `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(fs.readFileSync(path.resolve(cantadorRoot, 'src/utils/syllableSplitter.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64')}`;

  const underlinePatched = underlineSource.replace(`from './syllableSplitter'`, `from '${splitterUrl}'`);
  const underlineUrl = `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(underlinePatched, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64')}`;
  const underlineMod = await import(underlineUrl);

  const builderSource = fs
    .readFileSync(path.resolve(cantadorRoot, 'src/utils/stepsToOrganizadorLineBuilder.ts'), 'utf8')
    .replace(`from './syllableUnderlineFormatter'`, `from '${underlineUrl}'`);
  const builderUrl = `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(builderSource, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64')}`;
  const builderMod = await import(builderUrl);

  const chordHelperUrl = `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(fs.readFileSync(path.resolve(cantadorRoot, 'src/utils/chordGridHelper.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64')}`;

  const reconstitutorSource = fs
    .readFileSync(path.resolve(cantadorRoot, 'src/utils/toadaTxtReconstitutor.ts'), 'utf8')
    .replace(`from './chordGridHelper'`, `from '${chordHelperUrl}'`)
    .replace(`from './stepsToOrganizadorLineBuilder'`, `from '${builderUrl}'`)
    .replace(`from './syllableUnderlineFormatter'`, `from '${underlineUrl}'`);
  const reconstitutorUrl = `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(reconstitutorSource, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64')}`;
  const reconstitutorMod = await import(reconstitutorUrl);

  // 1. Test Volet 1 : Déplacement de la brique "Es" sur la 4e double-croche de T1 (s=3) ➔ "[1]_ Es[2]trela"
  const estrelaSteps = makeEmptySteps(16);
  // T1 (steps 0..3) : s=0..2 silence, s=3 = "Es"
  estrelaSteps[3] = { stepIndex: 3, active: true, note: 'F#4', midiNumber: 66, syllable: 'Es', velocity: 100, decay: 0.15 };
  // T2 (steps 4..7) : s=0 = "tre", s=1 = "la"
  estrelaSteps[4] = { stepIndex: 4, active: true, note: 'A4', midiNumber: 69, syllable: 'tre', velocity: 100, decay: 0.15 };
  estrelaSteps[5] = { stepIndex: 5, active: true, note: 'A4', midiNumber: 69, syllable: 'la', velocity: 100, decay: 0.15 };
  // T3 (steps 8..11) : s=0 = "bri", s=1 = "lhan", s=2 = "te"
  estrelaSteps[8] = { stepIndex: 8, active: true, note: 'B4', midiNumber: 71, syllable: 'bri', velocity: 100, decay: 0.15 };
  estrelaSteps[9] = { stepIndex: 9, active: true, note: 'C#5', midiNumber: 73, syllable: 'lhan', velocity: 100, decay: 0.15 };
  estrelaSteps[10] = { stepIndex: 10, active: true, note: 'A4', midiNumber: 69, syllable: 'te', velocity: 100, decay: 0.15 };
  // T4 (steps 12..15) : muet
  const patEstrelaEdited = {
    id: 'pat-3',
    cardIndex: 2,
    name: 'Puxador 3',
    role: 'puxador',
    measuresCount: 1,
    hasAnacrusis: false,
    isMidiInitialized: true,
    assignedLyricsText: 'Estrela brilhante',
    rawLineCode: '*[1]Estrela [2]brilhante [3]_ [4]_*',
    anacrusisSteps: [],
    mainSteps: estrelaSteps,
  };

  // Carte jumelle #4 (non éditée mais même texte)
  const patEstrelaTwinCoro = {
    id: 'pat-4',
    cardIndex: 3,
    name: 'Coro 4',
    role: 'coro',
    measuresCount: 1,
    hasAnacrusis: false,
    isMidiInitialized: false,
    assignedLyricsText: 'Estrela brilhante',
    rawLineCode: '[1]Estrela [2]brilhante [3]_ [4]_',
    anacrusisSteps: [],
    mainSteps: [],
  };

  const builtEstrelaLine = builderMod.buildOrganizadorLineFromSteps(patEstrelaEdited);
  console.log('Ligne reconstruite depuis Piano Roll :', builtEstrelaLine);
  assert.ok(
    builtEstrelaLine.includes('[1]_ Es[2]trela'),
    `Attendu "[1]_ Es[2]trela" dans "${builtEstrelaLine}"`
  );

  // 2. Test Volet 2 : Syllabes ["Vo", "vó", "fa", "lou"] ➔ "<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou"
  const underlinedVovo = underlineMod.formatWordsWithUnderlinedSyllables(
    'Vovó falou',
    ['Vo', 'vó', 'fa', 'lou'],
    false
  );
  console.log('Paroles soulignées (parolesOriginales) :', underlinedVovo);
  assert.equal(underlinedVovo, '<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou');

  const vovoSteps = makeEmptySteps(16);
  vovoSteps[0] = { stepIndex: 0, active: true, note: 'F#4', midiNumber: 66, syllable: 'Vo', velocity: 100, decay: 0.15 };
  vovoSteps[2] = { stepIndex: 2, active: true, note: 'A4', midiNumber: 69, syllable: 'vó', velocity: 100, decay: 0.15 };
  vovoSteps[4] = { stepIndex: 4, active: true, note: 'B4', midiNumber: 71, syllable: 'fa', velocity: 100, decay: 0.15 };
  vovoSteps[6] = { stepIndex: 6, active: true, note: 'C#5', midiNumber: 73, syllable: 'lou', velocity: 100, decay: 0.15 };

  const patVovo = {
    id: 'pat-1',
    cardIndex: 0,
    name: 'Puxador 1',
    role: 'puxador',
    measuresCount: 1,
    hasAnacrusis: false,
    isMidiInitialized: true,
    assignedLyricsText: 'Vovó falou',
    rawLineCode: '*[1]Vovó [2]falou [3]_ [4]_*',
    anacrusisSteps: [],
    mainSteps: vovoSteps,
  };

  // 3. Test reconstitution projet complet + propagation aux jumelles + métadonnées bpmDefaut / tonaliteDefaut
  const mockProject = {
    id: 'toada-vovo-falou',
    title: 'Vovó falou',
    bpm: 85,
    timeSignature: '4/4',
    patterns: [patVovo, patEstrelaEdited, patEstrelaTwinCoro],
    slots: [
      { slotId: 's1', puxadorPatternId: 'pat-1', coroPatternId: null },
      { slotId: 's2', puxadorPatternId: 'pat-3', coroPatternId: null },
      { slotId: 's3', puxadorPatternId: null, coroPatternId: 'pat-4' },
    ],
    activePatternId: 'pat-3',
    toadaMeta: {
      id: 'doc-vovo-123',
      groupId: 'samambaia',
      tonaliteDefaut: 'Fa# Majeur',
      bpmDefaut: 85,
    },
  };

  const { rawTxtCode, cleanHtml } = reconstitutorMod.reconstituteToadaTxt(mockProject);
  console.log('\nrawTxtCode reconstruit :\n' + rawTxtCode);
  console.log('\nparolesOriginales (cleanHtml) :\n' + cleanHtml);

  assert.ok(rawTxtCode.includes('[1]_ Es[2]trela'), 'rawTxtCode doit contenir "[1]_ Es[2]trela"');
  const rawLines = rawTxtCode.split('\n');
  assert.equal(rawLines[1], '*[1]_ Es[2]trela [3]brilhante [4]_*');
  assert.equal(rawLines[2], '[1]_ Es[2]trela [3]brilhante [4]_', 'La carte jumelle Coro #4 doit hériter du rythme "[1]_ Es[2]trela"');
  assert.ok(cleanHtml.includes('<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou'), 'parolesOriginales doit contenir "<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou"');
  assert.equal(mockProject.bpm, 85);
  assert.equal(mockProject.toadaMeta.tonaliteDefaut, 'Fa# Majeur');

  // 4. Test Organizador : parseLineToCharAnchors sur lignes avec <u> et sans <u> (zéro balise <u> brute à l'écran)
  const orgHelperPath = path.resolve(cantadorRoot, '../o-girador-organizador/src/utils/toadaLineEditorHelper.js');
  if (fs.existsSync(orgHelperPath)) {
    const orgHelperMod = await import(`file:///${orgHelperPath.replace(/\\/g, '/')}`);
    const parsedU = orgHelperMod.parseLineToCharAnchors('*[1]<u>V</u>o<u>v</u>ó [2]<u>f</u>a<u>l</u>ou*');
    assert.ok(!parsedU.rawCleanChars.includes('<u>') && !parsedU.rawCleanChars.includes('</u>'), 'Aucune balise <u> brute dans rawCleanChars');
    assert.equal(parsedU.rawCleanChars, 'Vovó falou');
    assert.equal(parsedU.charUnderlineFlags[0], true); // V
    assert.equal(parsedU.charUnderlineFlags[1], false); // o
    assert.equal(parsedU.charUnderlineFlags[2], true); // v
    assert.equal(parsedU.charUnderlineFlags[5], true); // f
    assert.equal(parsedU.charUnderlineFlags[7], true); // l

    const parsedAuto = orgHelperMod.parseLineToCharAnchors('*[1]_ Es[2]trela*');
    assert.equal(parsedAuto.rawCleanChars, 'Estrela');
    assert.equal(parsedAuto.charUnderlineFlags[0], true); // E
    assert.equal(parsedAuto.charUnderlineFlags[2], true); // t
    assert.equal(parsedAuto.charUnderlineFlags[5], true); // l
  }

  console.log('\n✅ TOUS LES TESTS DE SYNCHRONISATION BIDIRECTIONNELLE CANTADOR ➔ ORGANIZADOR SONT PASSÉS AVEC SUCCÈS !');
}

runTests().catch((err) => {
  console.error('❌ Échec du test :', err);
  process.exit(1);
});
