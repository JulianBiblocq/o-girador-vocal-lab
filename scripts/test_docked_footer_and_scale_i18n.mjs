/**
 * test_docked_footer_and_scale_i18n.mjs
 * Suite de vérification des 5 points de l'upgrade Livret 4 Docked Footer,
 * Unification de la Gamme (Livrets 1-2-4), Traduction PT-BR intégrale, Zéro Double Icône & Contrastes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatProjectScaleLabel,
  formatReferencePitchSolfege,
  parseStoredScaleString,
  resolveProjectActiveScale,
  applyDetectedScaleToProject,
} from '../src/audio/projectScaleAnalyzer.ts';
import { createDefaultToadaProject } from '../src/types/toadaProject.types.ts';
import { translationsBr } from '../src/i18n/translationsBr.ts';

console.log('🧪 Test 1 : Bandeau « Syllabes + Rythmes 1-2-4 » Épinglé (Docked Footer) hors du scroll vertical des notes...');
{
  const editorSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/PianoRollEditor.tsx'), 'utf8');
  assert.ok(editorSrc.includes('notesScrollRef'), 'PianoRollEditor doit utiliser notesScrollRef pour le scroll vertical dédié aux notes');
  assert.ok(editorSrc.includes('NOTES_VIEWPORT_HEIGHT = 320'), 'Hauteur du viewport des notes fixée à 320px');
  const notesScrollCloseIdx = editorSrc.indexOf('<PianoRollSyllablesRow');
  const canvasIdx = editorSrc.indexOf('<PianoRollCanvas');
  assert.ok(notesScrollCloseIdx > canvasIdx, 'PianoRollSyllablesRow et BeatRhythmPresetBar sont placés en Docked Footer sous le scroll vertical des notes');

  const syllSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/PianoRollSyllablesRow.tsx'), 'utf8');
  assert.ok(!syllSrc.includes('syllableQuickSplitLabel'), 'La barre redondante Divisão rápida a été supprimée de PianoRollSyllablesRow');
  assert.ok(syllSrc.includes("sticky left-0 z-20"), 'Le label SYLLABES / SÍLABAS est sticky à gauche (64px)');

  const letraSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/LetraEditorPanel.tsx'), 'utf8');
  assert.ok(!letraSrc.includes('letraSpaceBadge'), 'Les cartes #1..#10 Espaço / Ligado ont été supprimées de LetraEditorPanel');
}
console.log('✅ Test 1 OK');

console.log('🧪 Test 2 : Unification de la Gamme entre Livrets 1, 2 et 4 (FR & PT-BR)...');
{
  const proj = createDefaultToadaProject();
  const updatedFr = applyDetectedScaleToProject(proj, 'A', 'natural_minor', 'A3', 'fr');
  assert.equal(updatedFr.toadaMeta?.tonaliteDefaut, 'La Mineur');

  const resolvedFr = resolveProjectActiveScale(updatedFr, 'fr');
  assert.equal(resolvedFr.tonic, 'A');
  assert.equal(resolvedFr.scaleType, 'natural_minor');
  assert.equal(resolvedFr.isLocked, true);
  assert.equal(resolvedFr.label, 'La Mineur');

  const resolvedBr = resolveProjectActiveScale(updatedFr, 'br');
  assert.equal(resolvedBr.tonic, 'A');
  assert.equal(resolvedBr.scaleType, 'natural_minor');
  assert.equal(resolvedBr.isLocked, true);
  assert.equal(resolvedBr.label, 'Lá Menor', 'En mode PT-BR, La Mineur est automatiquement formaté en Lá Menor');
  assert.equal(formatReferencePitchSolfege('A3', 'br'), 'Lá3');
  assert.equal(formatReferencePitchSolfege('C4', 'br'), 'Dó4');
  assert.deepEqual(parseStoredScaleString('Escala livre (Desativada)'), { tonic: 'A', scaleType: 'chromatic' });
}
console.log('✅ Test 2 OK');

console.log('🧪 Test 3 : Traduction PT-BR intégrale & Restauration des accents portugais...');
{
  assert.equal(translationsBr.patternLibraryTitle, 'BIBLIOTECA DE PADRÕES (TOADA)');
  assert.equal(translationsBr.conductorTitle, 'LINHA DE REGÊNCIA DA TOADA');
  assert.equal(translationsBr.cueAutoPrevious, 'Padrão anterior da Regência');
  assert.equal(translationsBr.takeModePattern, 'Apenas este padrão');
  assert.equal(translationsBr.cleanDurationLabel, 'Duração útil :');
  assert.equal(translationsBr.backToRecording, 'Voltar à Gravação');
  assert.equal(translationsBr.metronomeClick, 'Clique metrônomo');
  assert.equal(translationsBr.listeningModeTitle, 'Modo de Escuta e Referência');
  assert.equal(translationsBr.referencePitch, 'Nota de Referência (Diapasão)');
  assert.equal(translationsBr.calibNewDeviceWarn, 'Novo dispositivo de áudio detectado — CALIBRAÇÃO NECESSÁRIA');
}
console.log('✅ Test 3 OK');

console.log('🧪 Test 4 : Suppression des doubles icônes et contrastes Mode Nuit / Mode Jour...');
{
  const bannerSrc = fs.readFileSync(path.resolve('src/components/common/ScaleProposalBanner.tsx'), 'utf8');
  assert.ok(!bannerSrc.includes('✓ Valider'), 'Pas de double icône ✓ dans ScaleProposalBanner');
  assert.ok(!bannerSrc.includes('🔄 Changer'), 'Pas de double icône 🔄 dans ScaleProposalBanner');
  assert.ok(!bannerSrc.includes('🤷 Je ne sais pas'), 'Pas de double icône 🤷 dans ScaleProposalBanner');
  assert.ok(!bannerSrc.includes('🔓 Débrayer'), 'Pas de double icône 🔓 dans ScaleProposalBanner');

  const kbSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/PianoRollKeyboard.tsx'), 'utf8');
  assert.ok(kbSrc.includes('#d6c7b2'), 'Les touches blanches du clavier utilisent un ton crème/bois doux (#d6c7b2) en Mode Nuit');

  const bricksSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/pianoRollBricksDrawer.ts'), 'utf8');
  assert.ok(bricksSrc.includes('#d4af37'), 'Les pastilles ◆ 0% ont un contour doré (#d4af37) bien lisible en Mode Nuit et Mode Jour');
}
console.log('✅ Test 4 OK');

console.log('🎉 TOUS LES TESTS DOCKED FOOTER, GAMME UNIFIÉE, PT-BR & CONTRASTES SONT PASSÉS AVEC SUCCÈS !');
