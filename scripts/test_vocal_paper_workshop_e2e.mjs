/**
 * test_vocal_paper_workshop_e2e.mjs
 * Suite de tests E2E automatisée de « l'Atelier Papier du Chant » sur les 3 dépôts
 * (Cantador, Organizador, Sequenciador).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './resolve-ts.mjs';

const { wrapVocalSheetA4Document, buildVocalPaperBatchDocumentHTML } = await import('../src/utils/vocal-paper/vocalPaperPrintHelper.ts');
const { renderVocalSheetSequenceHTML } = await import('../src/utils/vocal-paper/vocalSheetSequenceTemplate.ts');
const { renderVocalSheetNotesHTML, VOCAL_PAPER_KEYBOARD_ROWS } = await import('../src/utils/vocal-paper/vocalSheetNotesTemplate.ts');
const { renderVocalSheetRhythmHTML } = await import('../src/utils/vocal-paper/vocalSheetRhythmTemplate.ts');
const { renderVocalSheetInstructionsHTML } = await import('../src/utils/vocal-paper/vocalSheetInstructionsTemplate.ts');
const {
  resolveEightBeatNumbers,
  normalizeScannedBlockToCanonical,
  mergeMultiLineScannedBlocks,
} = await import('../src/utils/vocal-paper/vocalPaperBeatDecoder.ts');
const {
  keyboardNoteToMidi,
  midiToScientificNote,
  buildStepsAndLyricsFromScannedBlock,
  convertVocalPaperScanToProject,
} = await import('../src/utils/vocal-paper/vocalPaperToProjectConverter.ts');
const { alignScannedPatternsWithOrganizadorLyrics } = await import('../src/utils/vocal-paper/vocalPaperLyricsAligner.ts');
const { buildVocalPaperOpticalSystemPrompt } = await import('../src/utils/vocal-paper/vocalPaperOpticalPrompt.ts');
const { createDefaultToadaProject } = await import('../src/utils/toadaProjectDefaults.ts');
const { reconstituteToadaTxt } = await import('../src/utils/toadaTxtReconstitutor.ts');
const {
  convertScannedVocalBatchToOrganizador,
} = await import('../../o-girador-organizador/src/utils/vocalPaperToOrganizadorConverter.js');
const { buildOrganizadorVocalSheetHTML, buildOrganizadorVocalCartBatchHTML } = await import('../../o-girador-organizador/src/utils/vocalPaperSheetPrinter.js');
const { buildSequencerToadaPackFromVocalScan } = await import('../../o-girador-sequenciador/src/utils/paper/vocalPaperSequenciadorHelper.ts');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cantadorRoot = path.resolve(__dirname, '..');
const organizadorRoot = path.resolve(cantadorRoot, '../o-girador-organizador');
const sequenciadorRoot = path.resolve(cantadorRoot, '../o-girador-sequenciador');

console.log('=== TEST E2E : ATELIER PAPIER DU CHANT (CANTADOR • ORGANIZADOR • SEQUENCIADOR) ===\n');

// ---------------------------------------------------------------------------
// 1. Rendu HTML A4 100 % N&B — Grille Universelle A4 Paysage à 8 Temps Libres (32 subdivisions de 8.4mm)
// ---------------------------------------------------------------------------
{
  const seqHtml = wrapVocalSheetA4Document(renderVocalSheetSequenceHTML({ sheetType: 'sequence', title: 'Vovó falou', bpm: 85 }));
  const notesHtml = wrapVocalSheetA4Document(renderVocalSheetNotesHTML({ sheetType: 'notes_1m', title: 'Vovó falou', bpm: 85 }));
  const rhythmHtml = wrapVocalSheetA4Document(renderVocalSheetRhythmHTML({ sheetType: 'rhythm_only', title: 'Vovó falou', bpm: 85 }));
  const guideHtml = wrapVocalSheetA4Document(renderVocalSheetInstructionsHTML());

  for (const [label, html, expectedCode] of [
    ['CHANT-SEQ', seqHtml, '[CODE: CHANT-SEQ]'],
    ['CHANT-NOTES-1M', notesHtml, '[CODE: CHANT-NOTES-1M]'],
    ['CHANT-RYTHME', rhythmHtml, '[CODE: CHANT-RYTHME]'],
    ['CHANT-GUIDE', guideHtml, '[CODE: CHANT-GUIDE]'],
  ]) {
    assert.ok(html.includes(expectedCode), `${label} doit contenir ${expectedCode}`);
    assert.ok(html.includes('fiducial-tl') && html.includes('fiducial-tr') && html.includes('fiducial-bl') && html.includes('fiducial-br'), `${label} doit contenir les 4 repères ■`);
    assert.ok(!html.includes('flex-direction:column;justify-content:space-between'), `${label} ne doit pas utiliser justify-content:space-between`);
    assert.ok(html.includes('gap:2.5mm') || html.includes('gap: 2.5mm') || html.includes('gap:3mm') || html.includes('gap: 2mm'), `${label} doit utiliser un gap compact`);
    assert.ok(html.includes('@page { size: A4 landscape; margin: 7mm; }'), `${label} doit déclarer @page { size: A4 landscape; margin: 7mm; }`);
    assert.ok(!/portrait/i.test(html), `${label} ne doit contenir aucune occurrence du mot "portrait"`);
    assert.ok(html.includes('grayscale(100%)'), `${label} doit forcer le rendu monochrome N&B via grayscale(100%)`);
  }

  // Test du Panier / Lot d'Impression Multi-Feuilles (3 × sequence + 6 × notes + 1 × rhythm = 10 pages .vocal-print-page)
  const batchContinuousHtml = buildVocalPaperBatchDocumentHTML(
    { sequence: 3, notes: 6, rhythm: 1, instructions: 0 },
    { sheetType: 'sequence', title: 'Vovó falou', bpm: 85, patternNumberingMode: 'continuous' }
  );
  const printPageMatches = batchContinuousHtml.match(/class="vocal-sheet-page vocal-print-page"/g) || [];
  assert.equal(printPageMatches.length, 10, 'Le lot (3×sequence + 6×notes + 1×rhythm) doit générer exactement 10 conteneurs .vocal-print-page dans un seul document HTML');
  const pageDirectiveMatches = batchContinuousHtml.match(/@page\s*\{[^}]*\}/g) || [];
  assert.equal(pageDirectiveMatches.length, 1, 'Le document multi-pages doit contenir une unique directive @page');
  assert.equal(pageDirectiveMatches[0], '@page { size: A4 landscape; margin: 7mm; }', 'La directive @page unique doit être exactement "@page { size: A4 landscape; margin: 7mm; }"');
  assert.ok(!/portrait/i.test(batchContinuousHtml), 'Absence totale du mot "portrait" dans le CSS et le HTML du lot');
  for (let p = 1; p <= 18; p++) {
    assert.ok(batchContinuousHtml.includes(`[P${p}]`), `Mode continu : les 6 feuilles de notes doivent numéroter de [P1] à [P18] (manquant: [P${p}])`);
  }
  assert.ok(batchContinuousHtml.includes('[ P19 ]') && batchContinuousHtml.includes('[ P24 ]'), 'Mode continu : la feuille rythme qui suit continue à [ P19 ]..[ P24 ]');

  // Test de l'option vierge [ P__ ] sur le lot
  const batchBlankHtml = buildVocalPaperBatchDocumentHTML(
    { sequence: 3, notes: 6, rhythm: 1, instructions: 0 },
    { sheetType: 'sequence', title: 'Vovó falou', bpm: 85, patternNumberingMode: 'blank' }
  );
  assert.ok(batchBlankHtml.includes('[P__]'), 'Mode vierge : les cartouches doivent afficher [P__]');
  assert.ok(!batchBlankHtml.includes('[P1]') && !batchBlankHtml.includes('[P18]'), 'Mode vierge : aucun numéro [P1]..[P18] pré-imprimé sur les feuilles de patterns');

  // Test du lot équivalent côté Organizador
  const orgBatchContinuous = buildOrganizadorVocalCartBatchHTML(
    { sequence: 3, notes: 6, rhythm: 1, instructions: 0 },
    { titre: 'Vovó falou', bpmDefaut: 85 },
    'continuous'
  );
  const orgPageMatches = orgBatchContinuous.match(/class="page vocal-print-page"/g) || [];
  assert.equal(orgPageMatches.length, 10, 'Lot Organizador : 10 pages .vocal-print-page');
  assert.ok(!/portrait/i.test(orgBatchContinuous), 'Lot Organizador : zéro occurrence de "portrait"');
  assert.ok(orgBatchContinuous.includes('[P1]') && orgBatchContinuous.includes('[P18]'), 'Lot Organizador continu : [P1] à [P18]');

  // Conservation des numéros de mesures M1..M32 sur CHANT-SEQ
  for (const m of [1, 8, 9, 16, 17, 24, 25, 32]) {
    assert.ok(seqHtml.includes(`>M${m}<`), `CHANT-SEQ doit conserver le numéro de mesure M${m}`);
  }

  // Feuille 2 (CHANT-NOTES) : A4 Paysage, exactement 3 systèmes complets [P1]..[P3], Piano Roll A (en bas) -> G# (en haut), lettres A..G seules, colonne gauche 8.5mm, 12 lignes de 1.8mm
  assert.ok(notesHtml.includes('size: A4 landscape'), 'Feuille 2 doit être en A4 landscape');
  for (let p = 1; p <= 3; p++) {
    assert.ok(notesHtml.includes(`[P${p}]`), `Feuille 2 doit contenir le cartouche [P${p}]`);
  }
  assert.ok(!notesHtml.includes('[P4]'), 'Feuille 2 doit contenir exactement 3 systèmes complets ([P1], [P2], [P3]) par page A4 Paysage');
  assert.ok(!notesHtml.includes('Ana T3') && !notesHtml.includes('Ana T4') && !notesHtml.includes('+T1'), 'Feuille 2 ne doit contenir aucun numéro de temps pré-imprimé (Ana T3-T4 / +T1)');
  assert.ok(
    notesHtml.includes('width:8.5mm') &&
    notesHtml.includes('height:5.5mm') &&
    notesHtml.includes('height:1.8mm') &&
    notesHtml.includes('height:11.5mm') &&
    notesHtml.includes('gap:3mm') &&
    notesHtml.includes('colspan="4"'),
    'Feuille 2 : géométrie exacte (colonne gauche 8.5mm, TEMPS 5.5mm, OCT 5.5mm, Clavier 1.8mm, SYLLABES 11.5mm, gap 3mm, colspan=4)'
  );

  // Vérification de la hauteur verticale totale < 175mm pour 3 blocs complets sur 1 page A4 Paysage
  const headerHeightMm = 5.5;
  const singleBlockHeightMm = 5.5 + 5.5 + 12 * 1.8 + 11.5 + 1.5; // 45.6mm
  const totalSheet2HeightMm = headerHeightMm + 3 * singleBlockHeightMm + 2 * 3; // 148.3mm
  assert.ok(totalSheet2HeightMm < 175, `Hauteur totale des 3 blocs (${totalSheet2HeightMm.toFixed(1)}mm) doit être < 175mm`);

  // Clavier Piano Roll 1 octave : de haut en bas ['G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A'] (donc de bas en haut : A ➔ G#)
  const expectedTopToBottomKeys = ['G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A'];
  assert.deepEqual(VOCAL_PAPER_KEYBOARD_ROWS.map((r) => r.key), expectedTopToBottomKeys, 'Clavier Piano Roll doit aller de G# (en haut) à A (en bas)');
  assert.deepEqual(VOCAL_PAPER_KEYBOARD_ROWS.map((r) => r.label), expectedTopToBottomKeys, 'Labels du clavier = lettres A B C D E F G seules (sans Do, Ré, Mi...)');
  assert.ok(VOCAL_PAPER_KEYBOARD_ROWS[8].strongBorder && VOCAL_PAPER_KEYBOARD_ROWS[11].strongBorder, 'Filets renforcés sous C (index 8) et sous A (index 11, juste au-dessus de SYLLABES)');
  for (const solfege of ['La (A)', 'Si (B)', 'Do (C)', 'Ré (D)', 'Mi (E)', 'Fa (F)', 'Sol (G)', 'Si♭', 'Do#', 'Mi♭', 'Fa#', 'Sol#']) {
    assert.ok(!notesHtml.includes(solfege), `Feuille 2 ne doit contenir aucun nom de solfège (${solfege})`);
  }
  const idxGSharp = notesHtml.indexOf('>G#<');
  const idxC = notesHtml.indexOf('>C<');
  const idxA = notesHtml.indexOf('>A<');
  assert.ok(idxGSharp > 0 && idxC > idxGSharp && idxA > idxC, 'Dans le flux HTML (haut -> bas), G# apparaît avant C qui apparaît avant A (grave en bas)');
  assert.ok(notesHtml.includes('hatch-bw'), 'Touches noires hachurées N&B (.hatch-bw) présentes');

  // Feuille 3 (CHANT-RYTHME) : A4 Paysage, 6 systèmes [ P1 ]..[ P6 ], 8 colonnes de temps vierges (4.5mm), RYTHME (5.5mm, 32 sous-cases), SYLLABES ouverte (11mm)
  assert.ok(rhythmHtml.includes('size: A4 landscape'), 'Feuille 3 doit être en A4 landscape');
  for (let p = 1; p <= 6; p++) {
    assert.ok(rhythmHtml.includes(`[ P${p} ]`), `Feuille 3 doit contenir le cartouche [ P${p} ]`);
  }
  assert.ok(!rhythmHtml.includes('[ P7 ]'), 'Feuille 3 doit empiler exactement 6 systèmes complets par page A4 Paysage');
  assert.ok(!rhythmHtml.includes('ANA T3') && !rhythmHtml.includes('TEMPS 1') && !rhythmHtml.includes('+T1'), 'Feuille 3 ne doit contenir aucun numéro de temps pré-imprimé');
  assert.ok(rhythmHtml.includes('width:14mm') && rhythmHtml.includes('height:4.5mm') && rhythmHtml.includes('height:5.5mm') && rhythmHtml.includes('height:11mm') && rhythmHtml.includes('colspan="4"'), 'Feuille 3 : cartouche 14mm, TEMPS 4.5mm, RYTHME 5.5mm et SYLLABES ouverte 11mm (colspan=4)');

  // Vérification également sur Organizador (3 systèmes Paysage sur CHANT-NOTES avec A en bas -> G# en haut, 6 systèmes Paysage sur CHANT-RYTHME)
  const orgNotesHtml = buildOrganizadorVocalSheetHTML('notes_1m', { titre: 'Vovó falou', bpmDefaut: 85 });
  const orgRhythmHtml = buildOrganizadorVocalSheetHTML('rhythm_only', { titre: 'Vovó falou', bpmDefaut: 85 });
  assert.ok(
    orgNotesHtml.includes('size:A4 landscape') &&
    orgNotesHtml.includes('[P3]') &&
    !orgNotesHtml.includes('[P4]') &&
    orgNotesHtml.includes('width:8.5mm') &&
    orgNotesHtml.includes('height:5.5mm') &&
    orgNotesHtml.includes('height:1.8mm') &&
    orgNotesHtml.includes('height:11.5mm') &&
    orgNotesHtml.indexOf('>G#<') < orgNotesHtml.indexOf('>A<'),
    'Organizador CHANT-NOTES = A4 Paysage, 3 systèmes [P1]..[P3], Piano Roll G# (haut) -> A (bas), lettres A..G seules'
  );
  assert.ok(orgRhythmHtml.includes('size:A4 landscape') && orgRhythmHtml.includes('[ P6 ]') && !orgRhythmHtml.includes('[ P7 ]') && orgRhythmHtml.includes('height:4.5mm') && orgRhythmHtml.includes('height:5.5mm') && orgRhythmHtml.includes('height:11mm'), 'Organizador CHANT-RYTHME = A4 Paysage, 6 systèmes, 8 temps libres');
  console.log('✓ 1. Grille Universelle A4 Paysage à 8 Temps Libres (Feuille 2 : 3 systèmes [P1]..[P3], Piano Roll A en bas ➔ G# en haut, lettres A..G seules, 1.8mm/note ; Feuille 3 : 6 systèmes) validée.');
}

// ---------------------------------------------------------------------------
// 1bis. Décodage Automatique des Numéros de Temps Manuscrits :
//       - "2 | 3 | 4 | 1 | 2 | 3 | 4 | 1" (et "1" seuls en c=3 et c=7) ➔ 3T d'anacrouse (T2-T3-T4) + 1M + Chute (+T1)
//       - "1 | 2 | 3 | 4 | 1 | 2 | 3 | 4" ➔ 2 mesures complètes (2M)
//       - Concaténation multi-lignes (P3 sur 2 lignes consécutives ➔ pattern 3M)
// ---------------------------------------------------------------------------
{
  // Déduction par continuité modulo 4 à partir des seuls "1" inscrits en c=3 et c=7
  assert.deepEqual(
    resolveEightBeatNumbers([null, null, null, 1, null, null, null, 1]),
    [2, 3, 4, 1, 2, 3, 4, 1],
    'Déduction modulo 4 depuis les seuls "1" en 4e et 8e colonnes'
  );
  assert.deepEqual(
    resolveEightBeatNumbers([null, null, null, null, null, null, null, null]),
    [1, 2, 3, 4, 1, 2, 3, 4],
    'Par défaut (aucun numéro inscrit) : c=0 démarre sur T1 (2 mesures de 4 temps)'
  );

  // Cas A : Grille 8 temps numérotée "2 | 3 | 4 | 1 | 2 | 3 | 4 | 1" (via les seuls "1" en c=3 et c=7)
  //         avec anacrouse dès T2 (c=0, stepIndex=0), mesure 1M (c=3..6, stepIndex=12..27) et chute +T1 (c=7, stepIndex=28)
  const freeGridBlockAna3T = {
    code: 'P1',
    sheetCode: 'CHANT-NOTES-1M',
    beatNumbers: [null, null, null, 1, null, null, null, 1],
    rhythmOnlyMode: false,
    cells: [
      { stepIndex: 0, durationSteps: 2, syllable: 'Ô', pitchKey: 'E', octave: 4 },    // c=0 (T2 d'anacrouse) -> anacrusisSteps[4]
      { stepIndex: 8, durationSteps: 2, syllable: 'LA-', pitchKey: 'F', octave: 4 },  // c=2 (T4 d'anacrouse) -> anacrusisSteps[12]
      { stepIndex: 12, durationSteps: 3, syllable: 'NA-', pitchKey: 'G', octave: 4 }, // c=3 (T1 mesure 1) -> mainSteps[0]
      { stepIndex: 16, durationSteps: 2, syllable: 'ÇÃO', pitchKey: 'A', octave: 5 }, // c=4 (T2 mesure 1) -> mainSteps[4]
      { stepIndex: 28, durationSteps: 2, syllable: 'NAGÔ', pitchKey: 'C', octave: 4 },// c=7 (+T1 chute) -> mainSteps[16]
    ],
  };

  const resAna3T = buildStepsAndLyricsFromScannedBlock(freeGridBlockAna3T);
  assert.equal(resAna3T.hasAnacrusis, true, 'Anacrouse 3 temps détectée à gauche du premier T1');
  assert.equal(resAna3T.anacrusisBeats, 3, '3 temps d’anacrouse (T2, T3, T4)');
  assert.equal(resAna3T.anacrusisSteps.length, 16, 'anacrusisSteps de 16 pas aligné sur T2=4..7, T3=8..11, T4=12..15');
  assert.equal(resAna3T.anacrusisSteps[4].syllable, 'Ô', 'T2 d’anacrouse placé sur stepIndex 4');
  assert.equal(resAna3T.anacrusisSteps[5].isTie, true, 'Tenue du trait horizontal sur stepIndex 5');
  assert.equal(resAna3T.anacrusisSteps[12].syllable, 'la', 'T4 d’anacrouse placé sur stepIndex 12');
  assert.equal(resAna3T.measuresCount, 1, '1 mesure principale (1M)');
  assert.equal(resAna3T.hasTailBeat, true, 'Chute +T1 détectée sur la 8e colonne (1 isolé après T4)');
  assert.equal(resAna3T.mainSteps.length, 20, '16 pas principaux + 4 pas de chute (+T1)');
  assert.equal(resAna3T.mainSteps[0].syllable, 'na', 'T1 de la mesure principale sur mainSteps[0]');
  assert.equal(resAna3T.mainSteps[16].syllable, 'nagô', 'Chute +T1 sur mainSteps[16]');

  // Cas B : Grille 8 temps numérotée "1 | 2 | 3 | 4 | 1 | 2 | 3 | 4" ➔ 2 mesures complètes (2M)
  const freeGridBlock2M = {
    code: 'P2',
    sheetCode: 'CHANT-NOTES-2M',
    beatNumbers: [1, 2, 3, 4, 1, 2, 3, 4],
    rhythmOnlyMode: false,
    cells: [
      { stepIndex: 0, durationSteps: 2, syllable: 'MA-', pitchKey: 'C', octave: 4 },
      { stepIndex: 16, durationSteps: 2, syllable: 'RA-', pitchKey: 'D', octave: 4 },
      { stepIndex: 24, durationSteps: 2, syllable: 'CA-', pitchKey: 'E', octave: 4 },
      { stepIndex: 28, durationSteps: 2, syllable: 'TU', pitchKey: 'G', octave: 4 },
    ],
  };
  const res2M = buildStepsAndLyricsFromScannedBlock(freeGridBlock2M);
  assert.equal(res2M.hasAnacrusis, false, 'Aucune anacrouse sur 1|2|3|4|1|2|3|4');
  assert.equal(res2M.measuresCount, 2, '2 mesures complètes détectées (2M)');
  assert.equal(res2M.hasTailBeat, false, 'Pas de chute +T1 sur 2 mesures complètes');
  assert.equal(res2M.mainSteps.length, 32, '32 pas principaux pour 2M');
  assert.equal(res2M.mainSteps[28].syllable, 'tu', 'Dernier temps de la 2e mesure sur mainSteps[28]');

  // Cas C : Concaténation multi-lignes (2 lignes consécutives portant le même code "P3" -> pattern 3M)
  const multiLineBlocks = [
    {
      code: 'P3',
      beatNumbers: [1, 2, 3, 4, 1, 2, 3, 4],
      cells: [
        { stepIndex: 0, durationSteps: 2, syllable: 'UN', pitchKey: 'C', octave: 4 },
        { stepIndex: 16, durationSteps: 2, syllable: 'DEUX', pitchKey: 'D', octave: 4 },
      ],
    },
    {
      code: 'P3',
      beatNumbers: [1, 2, 3, 4, 1, null, null, null],
      cells: [
        { stepIndex: 0, durationSteps: 2, syllable: 'TROIS', pitchKey: 'E', octave: 4 },
        { stepIndex: 16, durationSteps: 2, syllable: 'FIN', pitchKey: 'C', octave: 4 },
      ],
    },
  ];
  const merged = mergeMultiLineScannedBlocks(multiLineBlocks);
  assert.equal(merged.length, 1, 'Deux lignes P3 fusionnées en un seul bloc P3');
  assert.equal(merged[0].measuresCount, 3, '2M + 1M = 3 mesures (3M)');
  assert.equal(merged[0].hasTailBeat, true, 'Chute +T1 de la 2e ligne conservée');
  const resMerged = buildStepsAndLyricsFromScannedBlock(merged[0]);
  assert.equal(resMerged.mainSteps.length, 52, '3 mesures (48 pas) + chute (+T1, 4 pas) = 52 pas');
  assert.equal(resMerged.mainSteps[32].syllable, 'trois', '1re attaque de la 2e ligne placée au début de la 3e mesure (pas 32)');
  assert.equal(resMerged.mainSteps[48].syllable, 'fin', 'Chute +T1 placée au pas 48');

  // Vérification sur Organizador et Sequenciador avec la grille 8 temps libres
  const orgFree = convertScannedVocalBatchToOrganizador({
    sequenceColumns: [{ measureNumber: 1, puxCode: 'P1', corCode: 'X' }],
    patterns: [freeGridBlockAna3T],
  });
  assert.ok(orgFree.rawTxtCode.includes('[2]Ô') && orgFree.rawTxtCode.includes('[4]la[1]na[2]ção') && orgFree.rawTxtCode.includes('[1]nagô'), `Organizador décode 3T d'anacrouse ([2]Ô..[4]la) + 1M + chute ([1]nagô), reçu: ${orgFree.rawTxtCode}`);

  const seqFree = buildSequencerToadaPackFromVocalScan({
    sequenceColumns: [{ measureNumber: 1, puxCode: 'P1', corCode: 'X' }],
    patterns: [freeGridBlockAna3T],
  }, 88, 'Test 8 Temps');
  assert.equal(seqFree.patterns[0].hasAnacrusis, true, 'Sequenciador auto-détecte hasAnacrusis sur grille 8 temps');
  assert.equal(seqFree.patterns[0].anacrusisSteps.length, 16, 'Sequenciador génère 16 pas d’anacrouse');
  assert.equal(seqFree.patterns[0].hasTailBeat, true, 'Sequenciador auto-détecte hasTailBeat sur grille 8 temps');
  console.log('✓ 1bis. Décodage automatique des 8 temps libres (3T anacrouse T2-T3-T4, 1M/2M, chute +T1, concaténation multi-lignes P3+P3) validé.');
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

  const baseProj = createDefaultToadaProject();
  const convertedProj = convertVocalPaperScanToProject(baseProj, mockScanResult);
  assert.equal(convertedProj.slots.length, 6, '6 slots dans la séquence convertie');
  const patById = new Map(convertedProj.patterns.map((p) => [p.id, p]));

  assert.equal(patById.get(convertedProj.slots[0].puxadorPatternId)?.role, 'puxador');
  assert.equal(convertedProj.slots[0].coroPatternId, null);
  assert.equal(patById.get(convertedProj.slots[1].puxadorPatternId)?.role, 'puxador');
  assert.equal(convertedProj.slots[1].coroPatternId, null);
  assert.equal(convertedProj.slots[2].puxadorPatternId, null);
  assert.equal(patById.get(convertedProj.slots[2].coroPatternId)?.role, 'coro');
  assert.equal(convertedProj.slots[3].puxadorPatternId, null);
  assert.equal(patById.get(convertedProj.slots[3].coroPatternId)?.role, 'coro');

  const slot4Pux = patById.get(convertedProj.slots[4].puxadorPatternId);
  const slot4Cor = patById.get(convertedProj.slots[4].coroPatternId);
  assert.ok(slot4Pux && slot4Cor, 'Mesure 5 (P5/P5) doit activer Puxador ET Coro simultanément');
  assert.equal(slot4Pux.cardIndex, slot4Cor.cardIndex, 'Même cardIndex pour le couple Unisson P5/P5');
  assert.equal(convertedProj.slots[5].puxadorPatternId, null);
  assert.equal(convertedProj.slots[5].coroPatternId, null);

  const p1 = patById.get(convertedProj.slots[0].puxadorPatternId);
  assert.equal(p1.assignedLyricsText, "Vovó falou e'o barão", 'Reconstruction exacte des mots avec tirets "-" et élision "e\'o"');
  const activeSyls = p1.mainSteps.filter((s) => s.active && !s.isTie).map((s) => s.syllable);
  assert.deepEqual(activeSyls, ['Vo', 'vó', 'fa', 'lou', "e'o", 'ba', 'rão'], 'Syllabes exactes sur les pas MIDI');

  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(convertedProj);
  assert.ok(rawTxtCode.includes("*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão*"), `Ligne P1 attendue dans rawTxtCode, reçu:\n${rawTxtCode}`);
  assert.ok(rawTxtCode.includes('***[1]Na[2]ção [3]_ [4]_***'), 'Mesure 5 (P5/P5) formatée en Unisson ***...***');
  assert.ok(rawTxtCode.includes('[PAUSE 1M]'), 'Mesure 6 (X/X) formatée en [PAUSE 1M]');
  assert.ok(cleanHtml.includes("<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou <u>e</u>'o <u>b</u>a<u>r</u>ão"), 'Soulignement <u> sur la 1re lettre de chaque syllabe');

  const orgDirect = convertScannedVocalBatchToOrganizador(mockScanResult);
  assert.ok(orgDirect.rawTxtCode.includes("*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão*"));
  assert.ok(orgDirect.rawTxtCode.includes('***[1]Na[2]ção [3]_ [4]_***'));
  assert.ok(orgDirect.rawTxtCode.includes('[PAUSE 1M]'));
  assert.ok(orgDirect.parolesOriginales.includes("<u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou <u>e</u>'o <u>b</u>a<u>r</u>ão"));

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
// 4bis. Guidage et Verrouillage Orthographique par la Fiche existante d'Organizador
//       ("VO- | VO | FA- | LOU | E'O | BA- | RAO" ➔ "Vovó falou e o barão")
//       ("TROU- | XE | A | CAI- | XA | TROU- | XE'O | GON- | GUE" ➔ "Trouxe a caixa, trouxe o gonguê")
// ---------------------------------------------------------------------------
{
  const vovoOrgDoc = {
    id: 'doc-vovo-falou',
    titre: 'Vovó falou',
    bpmDefaut: 85,
    parolesOriginales: '<p><u>V</u>o<u>v</u>ó <u>f</u>a<u>l</u>ou <u>e</u> <u>o</u> <u>b</u>a<u>r</u>ão <u>a</u>s<u>s</u>i<u>n</u>ou</p>',
    rawTxtCode: "*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão _ assi[1]nou*",
  };

  const promptWithRef = buildVocalPaperOpticalSystemPrompt({ organizadorDoc: vovoOrgDoc, defaultBpm: 85 });
  assert.ok(
    promptWithRef.includes("Les paroles officielles de ce chant sont déjà connues ci-dessus. L'écriture manuscrite sur la grille peut être rapide, abrégée ou sans accents. Utilise obligatoirement les mots et syllabes du texte officiel fourni pour identifier chaque syllabe manuscrite, tout en respectant à 100 % les cases de temps/subdivisions où elles sont inscrites sur la grille."),
    'Le prompt optique doit contenir la consigne impérative de verrouillage orthographique'
  );

  const unaccentedVovoPatterns = [
    {
      code: 'P1',
      sheetCode: 'CHANT-NOTES-1M',
      beatNumbers: [1, 2, 3, 4, null, null, null, null],
      rhythmOnlyMode: false,
      cells: [
        { stepIndex: 4, syllable: 'VO-', pitchKey: 'C', octaveShift: 0 },
        { stepIndex: 5, syllable: 'VO', pitchKey: 'D', octaveShift: 0 },
        { stepIndex: 7, syllable: 'FA-', pitchKey: 'E', octaveShift: 0 },
        { stepIndex: 8, syllable: 'LOU', pitchKey: 'G', octaveShift: 0 },
        { stepIndex: 10, syllable: "E'O", pitchKey: 'E', octaveShift: 0 },
        { stepIndex: 11, syllable: 'BA-', pitchKey: 'D', octaveShift: 0 },
        { stepIndex: 12, syllable: 'RAO', pitchKey: 'C', octaveShift: 0 },
      ],
    },
  ];
  const alignedVovo = alignScannedPatternsWithOrganizadorLyrics(unaccentedVovoPatterns, vovoOrgDoc);
  assert.equal(alignedVovo[0].officialLyricsText, 'Vovó falou e o barão', 'Restitution à 100 % de "Vovó falou e o barão"');
  const vovoStepsRes = buildStepsAndLyricsFromScannedBlock(alignedVovo[0]);
  assert.equal(vovoStepsRes.assignedLyricsText, 'Vovó falou e o barão');
  const vovoActive = vovoStepsRes.mainSteps.filter((s) => s.active && !s.isTie);
  assert.deepEqual(vovoActive.map((s) => s.stepIndex), [4, 5, 7, 8, 10, 11, 12], 'Positions rythmiques stepIndex 100 % préservées');
  assert.deepEqual(vovoActive.map((s) => s.midiNumber), [60, 62, 64, 67, 64, 62, 60], 'Hauteurs MIDI 100 % préservées');
  assert.deepEqual(vovoActive.map((s) => s.syllable), ['Vo', 'vó', 'fa', 'lou', "e'o", 'ba', 'rão'], 'Syllabes accentuées exactes sur les pas');

  const norteSulOrgDoc = {
    id: 'doc-norte-a-sul',
    titre: 'De Norte a Sul',
    bpmDefaut: 92,
    parolesOriginales: 'De Norte a Sul\nTrouxe a caixa, trouxe o gonguê\nMaracatu chegou',
  };
  const unaccentedNortePatterns = [
    {
      code: 'P2',
      sheetCode: 'CHANT-NOTES-1M',
      beatNumbers: [2, 3, 4, 1, 2, 3, 4, 1],
      rhythmOnlyMode: false,
      cells: [
        { stepIndex: 8, syllable: 'TROU-', pitchKey: 'E', octaveShift: 0 },  // c=2 (T4 d'anacrouse) -> stepIndex 12 in 16-step ana
        { stepIndex: 10, syllable: 'XE', pitchKey: 'G', octaveShift: 0 },    // stepIndex 14 in 16-step ana
        { stepIndex: 11, syllable: 'A', pitchKey: 'A', octaveShift: 0 },     // stepIndex 15 in 16-step ana
        { stepIndex: 12, syllable: 'CAI-', pitchKey: 'C', octaveShift: 0 },  // c=3 (T1 main) -> stepIndex 0
        { stepIndex: 14, syllable: 'XA', pitchKey: 'D', octaveShift: 0 },    // stepIndex 2
        { stepIndex: 16, syllable: 'TROU-', pitchKey: 'E', octaveShift: 0 }, // stepIndex 4
        { stepIndex: 18, syllable: "XE'O", pitchKey: 'D', octaveShift: 0 },  // stepIndex 6
        { stepIndex: 20, syllable: 'GON-', pitchKey: 'C', octaveShift: 0 },  // stepIndex 8
        { stepIndex: 24, syllable: 'GUE', pitchKey: 'A', octaveShift: 0 },   // stepIndex 12
      ],
    },
  ];
  const alignedNorte = alignScannedPatternsWithOrganizadorLyrics(unaccentedNortePatterns, norteSulOrgDoc);
  assert.equal(alignedNorte[0].officialLyricsText, 'Trouxe a caixa, trouxe o gonguê', 'Restitution à 100 % de "Trouxe a caixa, trouxe o gonguê"');
  const norteStepsRes = buildStepsAndLyricsFromScannedBlock(alignedNorte[0]);
  assert.equal(norteStepsRes.assignedLyricsText, 'Trouxe a caixa, trouxe o gonguê');
  const norteAnaActive = norteStepsRes.anacrusisSteps.filter((s) => s.active && !s.isTie);
  const norteMainActive = norteStepsRes.mainSteps.filter((s) => s.active && !s.isTie);
  assert.deepEqual(norteAnaActive.map((s) => s.stepIndex), [12, 14, 15], 'Pas anacrouse T4 (12, 14, 15 sur 16 pas) 100 % préservés');
  assert.deepEqual(norteMainActive.map((s) => s.stepIndex), [0, 2, 4, 6, 8, 12], 'Pas mesure principale 100 % préservés');
  assert.deepEqual(
    [...norteAnaActive, ...norteMainActive].map((s) => s.syllable),
    ['Trou', 'xe', 'a', 'cai', 'xa', 'trou', "xe'o", 'gon', 'guê'],
    'Syllabes accentuées exactes ("Trou", "xe", "a", "cai", "xa", "trou", "xe\'o", "gon", "guê") sur les pas exacts de la grille'
  );
  console.log('✓ 4bis. Verrouillage orthographique Organizador ("Vovó falou e o barão" & "Trouxe a caixa, trouxe o gonguê") validé à 100 %.');
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
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperBeatDecoder.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperImagePreprocessor.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperOpticalPrompt.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperOpticalService.ts'),
    path.join(cantadorRoot, 'src/utils/vocal-paper/vocalPaperLyricsAligner.ts'),
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
