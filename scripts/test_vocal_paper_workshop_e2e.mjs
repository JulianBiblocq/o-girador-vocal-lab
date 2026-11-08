/**
 * test_vocal_paper_workshop_e2e.mjs
 * Suite de tests E2E automatisée de « l'Atelier Papier du Chant » sur les 3 dépôts
 * (Cantador, Organizador, Sequenciador).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wrapVocalSheetA4Document } from '../src/utils/vocal-paper/vocalPaperPrintHelper.ts';
import { renderVocalSheetSequenceHTML } from '../src/utils/vocal-paper/vocalSheetSequenceTemplate.ts';
import { renderVocalSheetNotesHTML, VOCAL_PAPER_KEYBOARD_ROWS } from '../src/utils/vocal-paper/vocalSheetNotesTemplate.ts';
import { renderVocalSheetRhythmHTML } from '../src/utils/vocal-paper/vocalSheetRhythmTemplate.ts';
import { renderVocalSheetInstructionsHTML } from '../src/utils/vocal-paper/vocalSheetInstructionsTemplate.ts';
import {
  keyboardNoteToMidi,
  midiToScientificNote,
  buildStepsAndLyricsFromScannedBlock,
  convertVocalPaperScanToProject,
} from '../src/utils/vocal-paper/vocalPaperToProjectConverter.ts';
import { createDefaultToadaProject } from '../src/utils/toadaProjectDefaults.ts';
import { reconstituteToadaTxt } from '../src/utils/toadaTxtReconstitutor.ts';
import {
  convertScannedVocalBatchToOrganizador,
  underlineFirstSyllableLetter,
} from '../../o-girador-organizador/src/utils/vocalPaperToOrganizadorConverter.js';
import { buildOrganizadorVocalSheetHTML } from '../../o-girador-organizador/src/utils/vocalPaperSheetPrinter.js';
import { buildSequencerToadaPackFromVocalScan } from '../../o-girador-sequenciador/src/utils/paper/vocalPaperSequenciadorHelper.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cantadorRoot = path.resolve(__dirname, '..');
const organizadorRoot = path.resolve(cantadorRoot, '../o-girador-organizador');
const sequenciadorRoot = path.resolve(cantadorRoot, '../o-girador-sequenciador');

console.log('=== TEST E2E : ATELIER PAPIER DU CHANT (CANTADOR • ORGANIZADOR • SEQUENCIADOR) ===\n');

// ---------------------------------------------------------------------------
// 1. Rendu HTML A4 100 % N&B des 4 modèles (CHANT-SEQ, CHANT-NOTES-1M, CHANT-NOTES-2M, CHANT-RYTHME, CHANT-GUIDE)
// ---------------------------------------------------------------------------
{
  const seqHtml = wrapVocalSheetA4Document(renderVocalSheetSequenceHTML({ sheetType: 'sequence', title: 'Vovó falou', bpm: 85 }), 'portrait');
  const notes1mHtml = wrapVocalSheetA4Document(renderVocalSheetNotesHTML({ sheetType: 'notes_1m', title: 'Vovó falou', bpm: 85 }), 'portrait');
  const notes2mHtml = wrapVocalSheetA4Document(renderVocalSheetNotesHTML({ sheetType: 'notes_2m', title: 'Vovó falou', bpm: 85 }), 'landscape');
  const rhythmHtml = wrapVocalSheetA4Document(renderVocalSheetRhythmHTML({ sheetType: 'rhythm_only', title: 'Vovó falou', bpm: 85 }), 'portrait');
  const guideHtml = wrapVocalSheetA4Document(renderVocalSheetInstructionsHTML(), 'portrait');

  for (const [label, html, expectedCode] of [
    ['CHANT-SEQ', seqHtml, '[CODE: CHANT-SEQ]'],
    ['CHANT-NOTES-1M', notes1mHtml, '[CODE: CHANT-NOTES-1M]'],
    ['CHANT-NOTES-2M', notes2mHtml, '[CODE: CHANT-NOTES-2M]'],
    ['CHANT-RYTHME', rhythmHtml, '[CODE: CHANT-RYTHME]'],
    ['CHANT-GUIDE', guideHtml, '[CODE: CHANT-GUIDE]'],
  ]) {
    assert.ok(html.includes(expectedCode), `${label} doit contenir ${expectedCode}`);
    assert.ok(html.includes('fiducial-tl') && html.includes('fiducial-tr') && html.includes('fiducial-bl') && html.includes('fiducial-br'), `${label} doit contenir les 4 repères ■`);
  }

  // Clavier 1 octave commençant par La (La, Si♭, Si, Do, Do#, Ré, Mi♭, Mi, Fa, Fa#, Sol, Sol#)
  const expectedLabels = ['La (A)', 'Si♭', 'Si (B)', 'Do (C)', 'Do#', 'Ré (D)', 'Mi♭', 'Mi (E)', 'Fa (F)', 'Fa#', 'Sol (G)', 'Sol#'];
  assert.deepEqual(VOCAL_PAPER_KEYBOARD_ROWS.map((r) => r.label), expectedLabels, 'Clavier 1 octave doit aller de La à Sol#');
  assert.ok(VOCAL_PAPER_KEYBOARD_ROWS[0].strongBorder && VOCAL_PAPER_KEYBOARD_ROWS[3].strongBorder, 'Filets renforcés sur La (1re ligne) et Do (4e ligne)');
  assert.ok(notes1mHtml.includes('hatch-bw'), 'Touches noires hachurées N&B (.hatch-bw) présentes');
  assert.ok(notes1mHtml.includes('OCT / ±'), 'Ligne OCT / ± présente au-dessus du clavier');

  // Vérification également sur Organizador
  const orgNotesHtml = buildOrganizadorVocalSheetHTML('notes_1m', { titre: 'Vovó falou', bpmDefaut: 85 });
  assert.ok(orgNotesHtml.includes('[CODE: CHANT-NOTES-1M]') && orgNotesHtml.includes('hatch-bw') && orgNotesHtml.includes('OCT / ±'));
  console.log('✓ 1. Rendu HTML A4 100 % N&B des 4 modèles (repères ■, clavier La..Sol#, hachures .hatch-bw, OCT / ±) validé.');
}

// ---------------------------------------------------------------------------
// 2 & 3. Séquence multi-feuilles (Pux : P1 - P2 - X - X - P5 / Cor : X - X - P3 - P4 - P5 + Pause X/X)
//        & Reconstruction des mots ("VO-", "VÓ", "FA-", "LOU", "E'O", "BA-", "RÃO") + <u>
// ---------------------------------------------------------------------------
{
  const mockScanResult = {
    title: 'Vovó falou',
    bpm: 85,
    timeSignature: '4/4',
    sungKey: 'Do# Majeur',
    troupeKey: 'Do Majeur',
    detectedSheetCodes: ['CHANT-SEQ', 'CHANT-NOTES-1M'],
    sequenceColumns: [
      { measureNumber: 1, puxCode: 'P1', corCode: 'X' },
      { measureNumber: 2, puxCode: 'P2', corCode: 'X' },
      { measureNumber: 3, puxCode: 'X', corCode: 'P3' },
      { measureNumber: 4, puxCode: 'X', corCode: 'P4' },
      { measureNumber: 5, puxCode: 'P5', corCode: 'P5' },
      { measureNumber: 6, puxCode: 'X', corCode: 'X' },
    ],
    patterns: [
      {
        code: 'P1',
        sheetCode: 'CHANT-NOTES-1M',
        measuresCount: 1,
        hasAnacrusis: false,
        hasTailBeat: false,
        rhythmOnlyMode: false,
        mainCells: [
          { stepIndex: 4, syllable: 'VO-', pitchKey: 'C', octaveShift: 0 },
          { stepIndex: 5, syllable: 'VÓ', pitchKey: 'D', octaveShift: 0 },
          { stepIndex: 7, syllable: 'FA-', pitchKey: 'E', octaveShift: 0 },
          { stepIndex: 8, syllable: 'LOU', pitchKey: 'G', octaveShift: 0 },
          { stepIndex: 10, syllable: "E'O", pitchKey: 'E', octaveShift: 0 },
          { stepIndex: 11, syllable: 'BA-', pitchKey: 'D', octaveShift: 0 },
          { stepIndex: 12, syllable: 'RÃO', pitchKey: 'C', octaveShift: 0 },
          { stepIndex: 13, syllable: '───►', isTie: true },
        ],
      },
      {
        code: 'P2', sheetCode: 'CHANT-NOTES-1M', measuresCount: 1, hasAnacrusis: false, hasTailBeat: false, rhythmOnlyMode: false,
        mainCells: [{ stepIndex: 0, syllable: 'AS-', pitchKey: 'D' }, { stepIndex: 1, syllable: 'SI-', pitchKey: 'E' }, { stepIndex: 4, syllable: 'NOU', pitchKey: 'C' }],
      },
      {
        code: 'P3', sheetCode: 'CHANT-NOTES-1M', measuresCount: 1, hasAnacrusis: false, hasTailBeat: false, rhythmOnlyMode: false,
        mainCells: [{ stepIndex: 4, syllable: 'CA-', pitchKey: 'C' }, { stepIndex: 5, syllable: 'I-', pitchKey: 'D' }, { stepIndex: 6, syllable: 'XA', pitchKey: 'E' }],
      },
      {
        code: 'P4', sheetCode: 'CHANT-NOTES-1M', measuresCount: 1, hasAnacrusis: false, hasTailBeat: false, rhythmOnlyMode: false,
        mainCells: [{ stepIndex: 0, syllable: 'BA-', pitchKey: 'E' }, { stepIndex: 4, syllable: 'TEU', pitchKey: 'C' }],
      },
      {
        code: 'P5', sheetCode: 'CHANT-NOTES-1M', measuresCount: 1, hasAnacrusis: false, hasTailBeat: false, rhythmOnlyMode: false,
        mainCells: [{ stepIndex: 0, syllable: 'NA-', pitchKey: 'G' }, { stepIndex: 4, syllable: 'ÇÃO', pitchKey: 'A', octaveShift: 1 }],
      },
    ],
  };

  // Vérification Cantador
  const baseProj = createDefaultToadaProject();
  const convertedProj = convertVocalPaperScanToProject(baseProj, mockScanResult);
  assert.equal(convertedProj.slots.length, 6, '6 slots dans la séquence convertie');
  const patById = new Map(convertedProj.patterns.map((p) => [p.id, p]));

  // Slot 0 & 1 : P1 et P2 sur Puxador uniquement
  assert.equal(patById.get(convertedProj.slots[0].puxadorPatternId)?.role, 'puxador');
  assert.equal(convertedProj.slots[0].coroPatternId, null);
  assert.equal(patById.get(convertedProj.slots[1].puxadorPatternId)?.role, 'puxador');
  assert.equal(convertedProj.slots[1].coroPatternId, null);

  // Slot 2 & 3 : P3 et P4 sur Coro uniquement
  assert.equal(convertedProj.slots[2].puxadorPatternId, null);
  assert.equal(patById.get(convertedProj.slots[2].coroPatternId)?.role, 'coro');
  assert.equal(convertedProj.slots[3].puxadorPatternId, null);
  assert.equal(patById.get(convertedProj.slots[3].coroPatternId)?.role, 'coro');

  // Slot 4 : P5 simultanément sur Puxador et Coro (Unisson)
  const slot4Pux = patById.get(convertedProj.slots[4].puxadorPatternId);
  const slot4Cor = patById.get(convertedProj.slots[4].coroPatternId);
  assert.ok(slot4Pux && slot4Cor, 'Mesure 5 (P5/P5) doit activer Puxador ET Coro simultanément');
  assert.equal(slot4Pux.cardIndex, slot4Cor.cardIndex, 'Même cardIndex pour le couple Unisson P5/P5');

  // Slot 5 : X sur Pux et X sur Cor ➔ Pause [PAUSE 1M]
  assert.equal(convertedProj.slots[5].puxadorPatternId, null);
  assert.equal(convertedProj.slots[5].coroPatternId, null);

  // Reconstruction des mots et syllabes sur P1
  const p1 = slot4Pux ? patById.get(convertedProj.slots[0].puxadorPatternId) : null;
  assert.equal(p1.assignedLyricsText, "Vovó falou e'o barão", 'Reconstruction exacte des mots avec tirets "-" et élision "e\'o"');
  const activeSyls = p1.mainSteps.filter((s) => s.active && !s.isTie).map((s) => s.syllable);
  assert.deepEqual(activeSyls, ['Vo', 'vó', 'fa', 'lou', "e'o", 'ba', 'rão'], 'Syllabes exactes sur les pas MIDI');

  // Reconstitution Organizador depuis Cantador
  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(convertedProj);
  assert.ok(rawTxtCode.includes("*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão*"), `Ligne P1 attendue dans rawTxtCode, reçu:\n${rawTxtCode}`);
  assert.ok(rawTxtCode.includes('***[1]Na[2]ção [3]_ [4]_***'), 'Mesure 5 (P5/P5) formatée en Unisson ***...***');
  assert.ok(rawTxtCode.includes('[PAUSE 1M]'), 'Mesure 6 (X/X) formatée en [PAUSE 1M]');
  assert.ok(cleanHtml.includes("<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou <u>e</u>'o <u>b</u>a<u>r</u>ão"), 'Soulignement <u> sur la 1re lettre de chaque syllabe');

  // Vérification du convertisseur direct Organizador
  const orgDirect = convertScannedVocalBatchToOrganizador(mockScanResult);
  assert.ok(orgDirect.rawTxtCode.includes("*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão*"));
  assert.ok(orgDirect.rawTxtCode.includes('***[1]Na[2]ção [3]_ [4]_***'));
  assert.ok(orgDirect.rawTxtCode.includes('[PAUSE 1M]'));
  assert.ok(orgDirect.parolesOriginales.includes("<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou <u>e</u>'o <u>b</u>a<u>r</u>ão"));

  // Vérification du convertisseur direct Sequenciador
  const seqPack = buildSequencerToadaPackFromVocalScan(mockScanResult, 85, 'Vovó falou');
  assert.equal(seqPack.slots.length, 6);
  assert.ok(seqPack.slots[4].puxadorPatternId && seqPack.slots[4].coroPatternId, 'Unisson P5/P5 dans Sequenciador');
  console.log('✓ 2 & 3. Séquence Pux/Cor/Unisson/Pause et reconstruction des mots/syllabes ("Vovó falou e\'o barão" + <u>) validées.');
}

// ---------------------------------------------------------------------------
// 4. Mapping Clavier 1 octave (La..Sol#) + OCT / ± vers hauteurs MIDI exactes
// ---------------------------------------------------------------------------
{
  assert.equal(keyboardNoteToMidi('A', 0), 57, 'La (A) octave de base = MIDI 57 (A3)');
  assert.equal(keyboardNoteToMidi('Bb', 0), 58, 'Si♭ = MIDI 58 (A#3)');
  assert.equal(keyboardNoteToMidi('B', 0), 59, 'Si = MIDI 59 (B3)');
  assert.equal(keyboardNoteToMidi('C', 0), 60, 'Do (C) = MIDI 60 (C4)');
  assert.equal(keyboardNoteToMidi('C#', 0), 61, 'Do# = MIDI 61 (C#4)');
  assert.equal(keyboardNoteToMidi('G#', 0), 68, 'Sol# = MIDI 68 (G#4)');
  assert.equal(keyboardNoteToMidi('A', 1), 69, 'La avec OCT +1 = MIDI 69 (A4)');
  assert.equal(keyboardNoteToMidi('C', -1), 48, 'Do avec OCT -1 = MIDI 48 (C3)');
  assert.equal(midiToScientificNote(57), 'A3');
  assert.equal(midiToScientificNote(60), 'C4');
  assert.equal(midiToScientificNote(68), 'G#4');
  console.log('✓ 4. Mapping Clavier 1 octave (La=57, Do=60, Sol#=68) + OCT / ± (+1/-1) validé.');
}

// ---------------------------------------------------------------------------
// 5 & 6. Zéro occurrence de "IA" / "Intelligence Artificielle" & < 145 lignes sur tous les fichiers créés/modifiés
// ---------------------------------------------------------------------------
{
  const filesToCheck = [
    path.join(cantadorRoot, 'src/types/vocalPaperWorkshop.types.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperPrintHelper.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalSheetSequenceTemplate.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalSheetNotesTemplate.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalSheetRhythmTemplate.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalSheetInstructionsTemplate.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperImagePreprocessor.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperOpticalPrompt.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperOpticalService.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperToProjectConverter.ts'),
    path.join(cantadorRoot, 'src/components/modals/vocal-paper/VocalPaperWorkshopModal.tsx'),
    path.join(cantadorRoot, 'src/components/modals/vocal-paper/VocalPaperPrintTab.tsx'),
    path.join(cantadorRoot, 'src/components/modals/vocal-paper/VocalPaperImportTab.tsx'),
    path.join(cantadorRoot, 'src/components/header/ProjectSelectorBar.tsx'),
    path.join(cantadorRoot, 'src/components/livret-structure/StructureTopControls.tsx'),
    path.join(organizadorRoot, 'src/utils/vocalPaperSheetPrinter.js'),
    path.join(organizadorRoot, 'src/utils/vocalPaperToOrganizadorConverter.js'),
    path.join(organizadorRoot, 'src/components/documents/toada/VocalPaperOrganizadorModal.jsx'),
    path.join(organizadorRoot, 'src/components/documents/toada/ToadaMusicalToolbar.jsx'),
    path.join(organizadorRoot, 'src/components/documents/toada/ToadaMusicalStructureEditor.jsx'),
    path.join(sequenciadorRoot, 'src/utils/paper/blankSheetPdfExport.ts'),
    path.join(sequenciadorRoot, 'src/utils/paper/vocalPaperSequenciadorHelper.ts'),
    path.join(sequenciadorRoot, 'src/components/paper/VocalPaperSequenciadorPanel.tsx'),
    path.join(sequenciadorRoot, 'src/components/paper/BlankAndScanWorkshopModal.tsx'),
  ];

  const iaRegex = /\b(?:IA|Intelligence\s+Artificielle|Inteligência\s+Artificial)\b/i;

  for (const filePath of filesToCheck) {
    assert.ok(fs.existsSync(filePath), `Fichier introuvable : ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const linesCount = content.split(/\r?\n/).length;
    assert.ok(linesCount < 145, `Règle 6.A violée : ${filePath} fait ${linesCount} lignes (max 144)`);
    assert.ok(!iaRegex.test(content), `Mention interdite d'IA trouvée dans ${filePath}`);
  }
  assert.ok(!fs.existsSync(path.join(organizadorRoot, 'src/components/documents/toada/ToadaScanIaModal.jsx')), 'ToadaScanIaModal.jsx doit être supprimé');
  console.log(`✓ 5 & 6. Zéro mention d'IA et 100 % des ${filesToCheck.length} fichiers créés/modifiés < 145 lignes validés.`);
}

console.log('\n🎉 TOUS LES TESTS E2E DE L’ATELIER PAPIER DU CHANT SONT PASSÉS AVEC SUCCÈS !');
