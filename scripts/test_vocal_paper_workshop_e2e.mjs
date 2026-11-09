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

const { wrapVocalSheetA4Document } = await import('../src/utils/vocal-paper/vocalPaperPrintHelper.ts');
const { renderVocalSheetSequenceHTML } = await import('../src/utils/vocal-paper/vocalSheetSequenceTemplate.ts');
const { renderVocalSheetNotesHTML, VOCAL_PAPER_KEYBOARD_ROWS } = await import('../src/utils/vocal-paper/vocalSheetNotesTemplate.ts');
const { renderVocalSheetRhythmHTML } = await import('../src/utils/vocal-paper/vocalSheetRhythmTemplate.ts');
const { renderVocalSheetInstructionsHTML } = await import('../src/utils/vocal-paper/vocalSheetInstructionsTemplate.ts');
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
  underlineFirstSyllableLetter,
} = await import('../../o-girador-organizador/src/utils/vocalPaperToOrganizadorConverter.js');
const { buildOrganizadorVocalSheetHTML } = await import('../../o-girador-organizador/src/utils/vocalPaperSheetPrinter.js');
const { buildSequencerToadaPackFromVocalScan } = await import('../../o-girador-sequenciador/src/utils/paper/vocalPaperSequenciadorHelper.ts');

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
  const rhythmHtml = wrapVocalSheetA4Document(renderVocalSheetRhythmHTML({ sheetType: 'rhythm_only', title: 'Vovó falou', bpm: 85 }), 'landscape');
  const rhythm2mHtml = wrapVocalSheetA4Document(renderVocalSheetRhythmHTML({ sheetType: 'rhythm_only', title: 'Vovó falou', bpm: 85, rhythmMeasuresPerLine: 2 }), 'landscape');
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
    assert.ok(!html.includes('flex-direction:column;justify-content:space-between'), `${label} ne doit pas utiliser justify-content:space-between entre les blocs`);
    assert.ok(html.includes('gap:2mm') || html.includes('gap: 2mm'), `${label} doit utiliser gap: 2mm`);
  }

  // Conservation des numéros de mesures M1..M32 sur CHANT-SEQ
  for (const m of [1, 8, 9, 16, 17, 24, 25, 32]) {
    assert.ok(seqHtml.includes(`>M${m}<`), `CHANT-SEQ doit conserver le numéro de mesure M${m}`);
  }

  // Clavier 1 octave commençant par La (La, Si♭, Si, Do, Do#, Ré, Mi♭, Mi, Fa, Fa#, Sol, Sol#)
  const expectedLabels = ['La (A)', 'Si♭', 'Si (B)', 'Do (C)', 'Do#', 'Ré (D)', 'Mi♭', 'Mi (E)', 'Fa (F)', 'Fa#', 'Sol (G)', 'Sol#'];
  assert.deepEqual(VOCAL_PAPER_KEYBOARD_ROWS.map((r) => r.label), expectedLabels, 'Clavier 1 octave doit aller de La à Sol#');
  assert.ok(VOCAL_PAPER_KEYBOARD_ROWS[0].strongBorder && VOCAL_PAPER_KEYBOARD_ROWS[3].strongBorder, 'Filets renforcés sur La (1re ligne) et Do (4e ligne)');
  assert.ok(notes1mHtml.includes('hatch-bw'), 'Touches noires hachurées N&B (.hatch-bw) présentes');
  assert.ok(notes1mHtml.includes('OCT / ±') && notes1mHtml.includes('(3/4/5)'), 'Ligne OCT / ± (3/4/5) présente au-dessus du clavier');

  // Vérification des 5 blocs en Portrait 1M (P1..P5) et 4 blocs en Paysage 2M (P1..P4)
  for (let p = 1; p <= 5; p++) {
    assert.ok(notes1mHtml.includes(`[ PATTERN : P${p} ]`), `CHANT-NOTES-1M doit contenir [ PATTERN : P${p} ]`);
  }
  assert.ok(!notes1mHtml.includes('[ PATTERN : P6 ]'), 'CHANT-NOTES-1M doit contenir exactement 5 blocs par défaut');
  for (let p = 1; p <= 4; p++) {
    assert.ok(notes2mHtml.includes(`[ PATTERN : P${p} ]`), `CHANT-NOTES-2M doit contenir [ PATTERN : P${p} ]`);
  }
  assert.ok(!notes2mHtml.includes('[ PATTERN : P5 ]'), 'CHANT-NOTES-2M doit contenir exactement 4 blocs par défaut');

  // Vérification de la Feuille 3 (CHANT-RYTHME) en A4 Paysage Grand Confort : 7 lignes (P1..P7), cartouche 13mm, RYTHME 5.5mm + SYLLABES ouverte 11mm (colspan="4")
  assert.ok(rhythmHtml.includes('size: A4 landscape'), 'CHANT-RYTHME doit être en A4 landscape');
  for (let p = 1; p <= 7; p++) {
    assert.ok(rhythmHtml.includes(`>P${p}<`), `CHANT-RYTHME doit contenir le cartouche P${p}`);
  }
  assert.ok(!rhythmHtml.includes('>P8<'), 'CHANT-RYTHME doit empiler exactement 7 lignes par page A4 Paysage');
  assert.ok(rhythmHtml.includes('width:13mm') && rhythmHtml.includes('height:5.5mm') && rhythmHtml.includes('height:11mm') && rhythmHtml.includes('colspan="4"'), 'CHANT-RYTHME : cartouche gauche 13mm, bande RYTHME 5.5mm et bande SYLLABES ouverte 11mm (colspan="4")');
  assert.ok(rhythm2mHtml.includes('M1•T1') && rhythm2mHtml.includes('M2•T4'), 'CHANT-RYTHME supporte l’option 2 Mesures par ligne en Paysage');

  // Vérification du clavier ultra-compact (2.2mm, 12mm), bande OCTAVE (6mm, colspan="4") et bande SYLLABES ouverte (9.5mm, colspan="4")
  assert.ok(notes1mHtml.includes('width:12mm') && notes1mHtml.includes('height:2.2mm'), 'Clavier ultra-compact (12mm x 2.2mm)');
  assert.ok(notes1mHtml.includes('colspan="4"') && notes1mHtml.includes('height:6mm') && notes1mHtml.includes('height:9.5mm'), 'Bandes OCTAVE (6mm) et SYLLABES (9.5mm) ouvertes avec colspan="4"');

  // Absence de cases à cocher manuelles Anacrouse / Chute dans les blocs
  assert.ok(!notes1mHtml.includes('Anacrouse (Ana T3-T4)') && !notes1mHtml.includes('Chute (+T1)'), 'Aucune case à cocher manuelle Anacrouse/Chute sur CHANT-NOTES-1M');
  assert.ok(!rhythmHtml.includes('Chute +T1'), 'Aucune case à cocher manuelle Anacrouse/Chute sur CHANT-RYTHME');

  // Vérification également sur Organizador (5 blocs en 1M, 4 blocs en 2M, 7 lignes en Paysage sur CHANT-RYTHME)
  const orgNotesHtml = buildOrganizadorVocalSheetHTML('notes_1m', { titre: 'Vovó falou', bpmDefaut: 85 });
  const orgNotes2mHtml = buildOrganizadorVocalSheetHTML('notes_2m', { titre: 'Vovó falou', bpmDefaut: 85 });
  const orgRhythmHtml = buildOrganizadorVocalSheetHTML('rhythm_only', { titre: 'Vovó falou', bpmDefaut: 85 });
  assert.ok(orgNotesHtml.includes('[CODE: CHANT-NOTES-1M]') && orgNotesHtml.includes('hatch-bw') && orgNotesHtml.includes('OCT / ±'));
  assert.ok(orgNotesHtml.includes('[ PATTERN : P5 ]') && !orgNotesHtml.includes('[ PATTERN : P6 ]'), 'Organizador CHANT-NOTES-1M = 5 blocs');
  assert.ok(orgNotes2mHtml.includes('[ PATTERN : P4 ]') && !orgNotes2mHtml.includes('[ PATTERN : P5 ]'), 'Organizador CHANT-NOTES-2M = 4 blocs');
  assert.ok(orgRhythmHtml.includes('size:A4 landscape') && orgRhythmHtml.includes('>P7<') && orgRhythmHtml.includes('height:5.5mm') && orgRhythmHtml.includes('height:11mm'), 'Organizador CHANT-RYTHME = A4 Paysage, 7 lignes, RYTHME 5.5mm + SYLLABES 11mm');
  console.log('✓ 1. Rendu HTML A4 100 % N&B (CHANT-RYTHME Paysage 7 lignes 5.5mm/11mm, 5 blocs 1M, 4 blocs 2M, gap: 2mm sans space-between) validé.');
}

// ---------------------------------------------------------------------------
// 1bis. Auto-détection 100 % automatique Anacrouse (Ana T3-T4) & Chute (+T1)
//       + Traits horizontaux de notes (durationSteps) + Bande OCTAVE (3 / 4 / 5)
// ---------------------------------------------------------------------------
{
  const autoBlockWithStrokes = {
    code: 'P1',
    sheetCode: 'CHANT-NOTES-1M',
    measuresCount: 1,
    hasAnacrusis: false, // Même si false dans le JSON, la présence d'une cellule dans anacrusisCells doit activer hasAnacrusis = true !
    hasTailBeat: false,  // Même si false dans le JSON, la présence d'une cellule dans tailCells doit activer hasTailBeat = true !
    rhythmOnlyMode: false,
    anacrusisCells: [
      { stepIndex: 4, durationSteps: 2, syllable: 'Ô', pitchKey: 'E', octave: 4 },
    ],
    mainCells: [
      { stepIndex: 0, durationSteps: 3, syllable: 'NA-', pitchKey: 'G', octave: 4 },
      { stepIndex: 4, durationSteps: 2, syllable: 'ÇÃO', pitchKey: 'A', octave: 5 },
    ],
    tailCells: [
      { stepIndex: 0, durationSteps: 2, syllable: 'NAGÔ', pitchKey: 'C', octave: 4 },
    ],
  };

  const resAuto = buildStepsAndLyricsFromScannedBlock(autoBlockWithStrokes);
  assert.equal(resAuto.hasAnacrusis, true, 'Auto-détection hasAnacrusis = true dès que Ana T3-T4 contient un trait/syllabe');
  assert.equal(resAuto.hasTailBeat, true, 'Auto-détection hasTailBeat = true dès que +T1 contient un trait/syllabe');
  assert.equal(resAuto.anacrusisSteps.length, 8, '8 pas d’anacrouse générés automatiquement');
  assert.equal(resAuto.mainSteps.length, 20, '16 pas principaux + 4 pas de chute (+T1) générés automatiquement');

  // Vérification du trait horizontal (durationSteps) et du rattachement de la syllabe au début du trait
  assert.equal(resAuto.anacrusisSteps[4].active && !resAuto.anacrusisSteps[4].isTie, true);
  assert.equal(resAuto.anacrusisSteps[4].syllable, 'Ô');
  assert.equal(resAuto.anacrusisSteps[5].active && resAuto.anacrusisSteps[5].isTie, true, 'Le 2e pas du trait horizontal (durationSteps=2) est en tenue ───');

  assert.equal(resAuto.mainSteps[0].syllable, 'na', 'Syllabe rattachée sous le début du trait (stepIndex 0)');
  assert.equal(resAuto.mainSteps[1].isTie && resAuto.mainSteps[2].isTie, true, 'Les pas 1 et 2 du trait horizontal (durationSteps=3) sont en tenue ───');
  assert.equal(resAuto.mainSteps[4].syllable, 'ção', 'Syllabe rattachée sous le début du trait (stepIndex 4)');
  assert.equal(resAuto.mainSteps[4].midiNumber, 69, 'Octave 5 sur La (A) = MIDI 69 (A4)');
  assert.equal(resAuto.mainSteps[16].syllable, 'nagô', 'Syllabe sur +T1 (stepIndex 16)');
  assert.equal(resAuto.mainSteps[17].isTie, true, 'Tenue sur +T1 (stepIndex 17)');

  // Vérification sur Organizador et Sequenciador (auto-détection Ana + Chute sans case cochée)
  const orgAuto = convertScannedVocalBatchToOrganizador({
    sequenceColumns: [{ measureNumber: 1, puxCode: 'P1', corCode: 'X' }],
    patterns: [autoBlockWithStrokes],
  });
  assert.ok(orgAuto.rawTxtCode.includes('[4]Ô') && orgAuto.rawTxtCode.includes('[1]nagô'), 'Organizador détecte automatiquement Ana T4 et +T1');

  const seqAuto = buildSequencerToadaPackFromVocalScan({
    sequenceColumns: [{ measureNumber: 1, puxCode: 'P1', corCode: 'X' }],
    patterns: [autoBlockWithStrokes],
  }, 88, 'Test Auto');
  assert.equal(seqAuto.patterns[0].hasAnacrusis, true, 'Sequenciador auto-détecte hasAnacrusis = true');
  assert.equal(seqAuto.patterns[0].hasTailBeat, true, 'Sequenciador auto-détecte hasTailBeat = true');
  assert.equal(seqAuto.patterns[0].exitBeat, 1, 'Sequenciador configure exitBeat = 1');
  console.log('✓ 1bis. Auto-détection Anacrouse/Chute (+T1), traits horizontaux (durationSteps) et bande OCTAVE (3/4/5) validés.');
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

  // Cas 1 : Saisie manuscrite rapide sans accents ("VO- | VO | FA- | LOU | E'O | BA- | RAO") sur Vovó falou
  const unaccentedVovoPatterns = [
    {
      code: 'P1',
      sheetCode: 'CHANT-NOTES-1M',
      measuresCount: 1,
      hasAnacrusis: false,
      hasTailBeat: false,
      rhythmOnlyMode: false,
      mainCells: [
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

  // Cas 2 : Saisie manuscrite rapide sans accents ni ponctuation ("TROU- | XE | A | CAI- | XA | TROU- | XE'O | GON- | GUE") sur De Norte a Sul
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
      measuresCount: 1,
      hasAnacrusis: true,
      hasTailBeat: false,
      rhythmOnlyMode: false,
      anacrusisCells: [
        { stepIndex: 4, syllable: 'TROU-', pitchKey: 'E', octaveShift: 0 },
        { stepIndex: 6, syllable: 'XE', pitchKey: 'G', octaveShift: 0 },
        { stepIndex: 7, syllable: 'A', pitchKey: 'A', octaveShift: 0 },
      ],
      mainCells: [
        { stepIndex: 0, syllable: 'CAI-', pitchKey: 'C', octaveShift: 0 },
        { stepIndex: 2, syllable: 'XA', pitchKey: 'D', octaveShift: 0 },
        { stepIndex: 4, syllable: 'TROU-', pitchKey: 'E', octaveShift: 0 },
        { stepIndex: 6, syllable: "XE'O", pitchKey: 'D', octaveShift: 0 },
        { stepIndex: 8, syllable: 'GON-', pitchKey: 'C', octaveShift: 0 },
        { stepIndex: 12, syllable: 'GUE', pitchKey: 'A', octaveShift: 0 },
      ],
    },
  ];
  const alignedNorte = alignScannedPatternsWithOrganizadorLyrics(unaccentedNortePatterns, norteSulOrgDoc);
  assert.equal(alignedNorte[0].officialLyricsText, 'Trouxe a caixa, trouxe o gonguê', 'Restitution à 100 % de "Trouxe a caixa, trouxe o gonguê"');
  const norteStepsRes = buildStepsAndLyricsFromScannedBlock(alignedNorte[0]);
  assert.equal(norteStepsRes.assignedLyricsText, 'Trouxe a caixa, trouxe o gonguê');
  const norteAnaActive = norteStepsRes.anacrusisSteps.filter((s) => s.active && !s.isTie);
  const norteMainActive = norteStepsRes.mainSteps.filter((s) => s.active && !s.isTie);
  assert.deepEqual(norteAnaActive.map((s) => s.stepIndex), [4, 6, 7], 'Pas anacrouse 100 % préservés');
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

