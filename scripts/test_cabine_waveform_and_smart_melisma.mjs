/**
 * test_cabine_waveform_and_smart_melisma.mjs
 * Suite de validation des 4 améliorations chirurgicales :
 * 1. Forme d'onde enregistrée (Ana, M1..Mn, +T1) & silhouette Voix Témoin dans 2. Cabine.
 * 2. Smart Tool Livret 4 : liaison [Lier] iso-hauteur (───) vs mélisme legato (`_`, isMelisma: true) + garde-fou >= 44 px.
 * 3. Filtrage intelligent des lignes [Phon.] identiques (Opanijé, vs Ajoussun).
 * 4. Terminologie Letra ao Vivo (zéro Karaoké/Karaokê), zéro double flèche ← ←, px-4 et badge BPM • bloc.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SMART_TOOL_MIN_BRICK_WIDTH_PX,
  resolveSmartToolHoverZone,
  linkAdjacentBricksSmart,
  snapSingleBrickToGreenMedian,
} from '../src/components/livret-melodia/pianoRollSmartTool.ts';
import { isMelismaBrickStep } from '../src/components/livret-melodia/pianoRollMelismaSlur.ts';
import { buildCabineTimelineMeasures } from '../src/components/livret-prise/cabineTimelineDrawer.ts';
import { shouldDisplayPhoneticLine } from '../src/components/livret-treino/StudentToadaSheetPanel.tsx';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/utils/toadaProjectDefaults.ts';
import { translationsFr } from '../src/i18n/translationsFr.ts';
import { translationsBr } from '../src/i18n/translationsBr.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

console.log('=== TEST SUITE : CABINE WAVEFORM, LETRA AO VIVO & SMART TOOL MELISMA ===\n');

// 1. Liaison Smart Tool : même hauteur MIDI (───) vs hauteurs différentes (Mélisme `_` legato)
{
  const makeSteps = (midi1, midi2) => {
    const arr = Array.from({ length: 8 }, (_, idx) => ({
      stepIndex: idx, active: false, note: '', midiNumber: 0, isTie: false, syllable: '', velocity: 0, decay: 0.15,
    }));
    arr[0] = { ...arr[0], active: true, note: 'A3', midiNumber: midi1, syllable: 'Na', velocity: 100 };
    arr[1] = { ...arr[1], active: true, note: '───', midiNumber: midi1, isTie: true, velocity: 90 };
    arr[2] = { ...arr[2], active: true, note: midi2 === 57 ? 'A3' : 'C4', midiNumber: midi2, syllable: 'gô', velocity: 100 };
    arr[3] = { ...arr[3], active: true, note: '───', midiNumber: midi2, isTie: true, velocity: 90 };
    return arr;
  };

  // Cas A : Même hauteur (A3 = 57 et A3 = 57) -> tenue plate '───'
  const linkedSame = linkAdjacentBricksSmart(makeSteps(57, 57), 0, 2);
  assert.equal(linkedSame[0].midiNumber, 57);
  assert.equal(linkedSame[0].syllable, 'Nagô');
  assert.equal(linkedSame[2].note, '───', 'Même hauteur MIDI : la 2e brique doit fusionner en tenue plate ───');
  assert.equal(linkedSame[2].isTie, true);
  assert.equal(Boolean(linkedSame[2].isMelisma), false);

  // Cas B : Hauteurs différentes (A3 = 57 et C4 = 60) -> mélisme legato '_' avec isMelisma: true
  const linkedDiff = linkAdjacentBricksSmart(makeSteps(57, 60), 0, 2);
  assert.equal(linkedDiff[0].midiNumber, 57, '1re brique conserve sa hauteur A3 (57)');
  assert.equal(linkedDiff[0].syllable, 'Na');
  assert.equal(linkedDiff[2].midiNumber, 60, '2e brique conserve sa hauteur C4 (60)');
  assert.equal(linkedDiff[2].note, 'C4');
  assert.equal(linkedDiff[2].isTie, false);
  assert.equal(linkedDiff[2].syllable, '_', '2e brique convertie en mélisme _');
  assert.equal(linkedDiff[2].isMelisma, true, 'isMelisma doit valoir true');
  assert.equal(linkedDiff[2].syllableAttack, false, 'syllableAttack doit valoir false');
  assert.equal(isMelismaBrickStep(linkedDiff[2]), true, 'Reconnu par drawMelismaLegatoSlurs pour tracer la courbe Bézier');

  // Double-clic : aimantation sur la médiane locale de la courbe verte
  const curve = Array.from({ length: 12 }, (_, k) => ({ timeSec: 0.02 + k * 0.02, midiFloat: 62.1, confidence: 0.95 }));
  const snapped = snapSingleBrickToGreenMedian(linkedDiff, 0, curve, 0, 0.5, null);
  assert.equal(snapped[0].midiNumber, 62, 'Double-clic sur le cœur de brique aimante sur Ré4 (62)');
  console.log('✓ 1. Liaison Smart Tool ([───] iso-hauteur vs Mélisme `_` Bézier) & aimantation médiane validées.');
}

// 2. Garde-fou de largeur minimale >= 44 px contre les fausses coupes accidentelles
{
  assert.equal(SMART_TOOL_MIN_BRICK_WIDTH_PX, 44);
  const steps16 = Array.from({ length: 16 }, (_, idx) => ({
    stepIndex: idx, active: false, note: '', midiNumber: 0, isTie: false, syllable: '', velocity: 0, decay: 0.15,
  }));
  // Brique de 2 pas (indices 0..1) en MIDI 60, maxMidi = 72, rowHeight = 22 => brickY = (72-60)*22 + 1.5 = 265.5, h = 19
  steps16[0] = { ...steps16[0], active: true, note: 'C4', midiNumber: 60, syllable: 'Ê', velocity: 100 };
  steps16[1] = { ...steps16[1], active: true, note: '───', midiNumber: 60, isTie: true, velocity: 90 };

  // Grille étroite 240px => 1 pas = 15px, brique de 2 pas = 30px (< 44px), non sélectionnée
  const bottomY = 265.5 + 16; // Dans la bande inférieure de la brique
  const narrowUnselected = resolveSmartToolHoverZone({
    x: 16, y: bottomY, stepIdx: 1, allSteps: steps16, width: 240, maxMidi: 72, rowHeight: 22, selectedStepIdx: null,
  });
  assert.equal(narrowUnselected.zone, 'move_body', 'Brique < 44px non sélectionnée : coupe ✂ bloquée (retourne move_body)');

  // Même brique < 44px MAIS déjà sélectionnée (selectedStepIdx = 0) => coupe ✂ autorisée !
  const narrowSelected = resolveSmartToolHoverZone({
    x: 16, y: bottomY, stepIdx: 1, allSteps: steps16, width: 240, maxMidi: 72, rowHeight: 22, selectedStepIdx: 0,
  });
  assert.equal(narrowSelected.zone, 'split_bottom', 'Brique sélectionnée : coupe ✂ active sur la subdivision');
  assert.equal(narrowSelected.splitStepIndex, 1);

  // Grille large 640px => 1 pas = 40px, brique de 2 pas = 80px (>= 44px), même non sélectionnée => coupe ✂ active !
  const wideUnselected = resolveSmartToolHoverZone({
    x: 41, y: bottomY, stepIdx: 1, allSteps: steps16, width: 640, maxMidi: 72, rowHeight: 22, selectedStepIdx: null,
  });
  assert.equal(wideUnselected.zone, 'split_bottom', 'Brique >= 44px : coupe ✂ active immédiatement au survol');
  console.log('✓ 2. Garde-fou >= 44 px validé (zéro fausse coupe sur petite brique non sélectionnée).');
}

// 3. Onde enregistrée (Ana, M1..Mn, +T1) & silhouette Voix Témoin dans 2. Cabine
{
  const proj = createDefaultToadaProject();
  const cuePat = createDefaultVocalPattern('puxador', 'Appel', 1, 90);
  const cuePcm = new Float32Array(48000 * 4);
  for (let i = 0; i < cuePcm.length; i++) cuePcm[i] = Math.sin(i * 0.04) * 0.5;
  cuePat.rawAudioSamples = cuePcm;

  const activePat = createDefaultVocalPattern('coro', 'Réponse', 2, 90);
  activePat.hasAnacrusis = true;
  activePat.anacrusisBeats = 2;
  const actPcm = new Float32Array(48000 * 9);
  for (let i = 0; i < actPcm.length; i++) actPcm[i] = Math.sin(i * 0.06) * 0.7;
  activePat.rawAudioSamples = actPcm;

  const tl = buildCabineTimelineMeasures({
    takeMode: 'pattern', project: proj, activePattern: activePat, cuePattern: cuePat, beatsPerMeasure: 4,
  });
  const cueBox = tl.measures.find((m) => m.kind === 'cue');
  const sungBox = tl.measures.find((m) => m.kind === 'sung');
  const tailBox = tl.measures.find((m) => m.kind === 'tail');
  assert.ok(cueBox?.waveformBins?.length, 'Silhouette d’onde Voix témoin présente dans PRÉCOMPTE');
  assert.ok(cueBox?.anacrusisWaveformBins?.length, 'Onde d’anacrouse enregistrée présente sur Ana');
  assert.ok(sungBox?.waveformBins?.length, 'Onde enregistrée présente sur M1..Mn');
  assert.ok(tailBox?.waveformBins?.length, 'Onde enregistrée présente sur +T1');
  console.log('✓ 3. Formes d’onde Cabine (Voix témoin, Ana, M1..Mn, +T1 via rawAudioSamples/recordingResult) validées.');
}

// 4. Filtrage [Phon.], Letra ao Vivo, absence de Karaoké et de ← ←, px-4 & badge BPM • bloc
{
  assert.equal(shouldDisplayPhoneticLine('Opanijé,', 'Opanijé,'), false, 'Masque [Phon.] identique à la casse/ponctuation près');
  assert.equal(shouldDisplayPhoneticLine('Opanijé,', 'opanijé'), false, 'Masque [Phon.] identique sans virgule');
  assert.equal(shouldDisplayPhoneticLine('Ajunssun,', 'Ajoussun'), true, 'Affiche [Phon.] lorsque la prononciation diffère');
  assert.equal(shouldDisplayPhoneticLine('Ajunssun,', ''), false);

  assert.equal(translationsFr.studentTabKaraoke, '2. Letra ao Vivo');
  assert.equal(translationsBr.studentTabKaraoke, '2. Letra ao Vivo');
  assert.equal(translationsFr.btnBackToStudio, 'Retour Studio');
  assert.equal(translationsBr.btnBackToStudio, 'Voltar ao Estúdio');

  for (const [k, v] of Object.entries(translationsFr)) {
    assert.ok(!/karaok/i.test(String(v)), `Mot Karaoké interdit dans translationsFr.${k} : ${v}`);
    assert.ok(!String(v).includes('← ←'), `Double flèche interdite dans translationsFr.${k}`);
  }
  for (const [k, v] of Object.entries(translationsBr)) {
    assert.ok(!/karaok/i.test(String(v)), `Mot Karaokê interdit dans translationsBr.${k} : ${v}`);
    assert.ok(!String(v).includes('← ←'), `Double flèche interdite dans translationsBr.${k}`);
  }

  const headerCode = fs.readFileSync(path.join(SRC, 'components/header/CompactStudioHeader.tsx'), 'utf8');
  assert.ok(headerCode.includes('px-4'), 'CompactStudioHeader doit avoir un padding horizontal franc px-4');
  const bpmCode = fs.readFileSync(path.join(SRC, 'components/header/BpmStampPopover.tsx'), 'utf8');
  assert.ok(bpmCode.includes("• ${isBr ? 'bloco' : 'bloc'}"), 'BpmStampPopover doit afficher BPM • bloc quand activePattern.bpm !== project.bpm');
  console.log('✓ 4. Filtrage [Phon.], Letra ao Vivo, absence totale de Karaoké / ← ←, px-4 et BPM • bloc validés.');
}

console.log('\n🎉 TOUS LES TESTS CABINE WAVEFORM, LETRA AO VIVO & SMART TOOL SONT PASSÉS AVEC SUCCÈS !');
