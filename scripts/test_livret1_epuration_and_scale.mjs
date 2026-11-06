/**
 * test_livret1_epuration_and_scale.mjs
 * Suite de tests de non-régression pour l'épuration radicale du Livret 1 :
 * 1. Séparation Mode Organizador Épuré vs Mode Création Locale (resolveDefaultManualStructureEdit).
 * 2. Badges [XM], [+Ana] / [+Ana T3], [+1T] et durée de prise sur PatternCardItem.
 * 3. Analyse globale de gamme (analyzeFullProjectScale) distinguant La Mineur (A3 / La3) de Do Majeur
 *    grâce aux notes de résolution de fin de phrase + extraction à la volée depuis PCM + applyDetectedScaleToProject.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDefaultManualStructureEdit } from '../src/components/livret-structure/LivretStructure.tsx';
import { resolveAnacrusisBadgeText, resolvePatternRecordedDurationSec } from '../src/components/conductor/PatternCardItem.tsx';
import {
  analyzeFullProjectScale,
  applyDetectedScaleToProject,
  formatReferencePitchSolfege,
} from '../src/audio/projectScaleAnalyzer.ts';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/types/toadaProject.types.ts';

console.log('🧪 Test 1 : Séparation Mode Organizador Épuré vs Mode Création Locale...');
{
  const orgProj = { ...createDefaultToadaProject(), source: 'organizador' };
  assert.equal(resolveDefaultManualStructureEdit(orgProj), false, 'Mode Organizador Épuré par défaut (isManualStructureEdit = false)');

  const localProj = { ...createDefaultToadaProject(), source: 'local' };
  assert.equal(resolveDefaultManualStructureEdit(localProj), true, 'Mode Création Locale actif sur + Nouvelle Toada (isManualStructureEdit = true)');

  const structCode = fs.readFileSync(path.resolve('src/components/livret-structure/LivretStructure.tsx'), 'utf8');
  assert.ok(!structCode.includes('ChordGridBar'), 'ChordGridBar doit être totalement supprimé du Livret 1');
}
console.log('✅ Test 1 OK');

console.log('🧪 Test 2 : Badges [XM], [+Ana], [+1T] et durée de prise dans la Bibliothèque...');
{
  const pat1 = {
    ...createDefaultVocalPattern('puxador', '1. Negro', 2, 90),
    hasAnacrusis: true,
    timeAnchors: [{ beat: 3, measureOffset: 0, isRest: false }],
    exitBeat: 1,
    recordingResult: { pcm: new Float32Array(44100 * 5.4), sampleRate: 44100 },
  };
  assert.equal(resolveAnacrusisBadgeText(pat1), '+Ana T3');
  assert.ok(Math.abs(resolvePatternRecordedDurationSec(pat1) - 5.4) < 0.05);

  const patNoAna = {
    ...createDefaultVocalPattern('coro', '2. Baque', 1, 90),
    hasAnacrusis: false,
    recordingResult: null,
  };
  assert.equal(resolveAnacrusisBadgeText(patNoAna), null);
  assert.equal(resolvePatternRecordedDurationSec(patNoAna), 0);
}
console.log('✅ Test 2 OK');

console.log('🧪 Test 3 : analyzeFullProjectScale (Distinction La Mineur vs Do Majeur + Diapason La3)...');
{
  // Mélodie en La Mineur naturel : utilise Do(60), Ré(62), Mi(64), Sol(55) et résout en fin de phrase sur La3 (57)
  const makeCurve = (notes) =>
    notes.flatMap((midi, idx) =>
      Array.from({ length: 6 }, (_, k) => ({
        timeSec: idx * 0.3 + k * 0.04,
        midiFloat: midi,
        confidence: 0.95,
      }))
    );

  const pux1 = {
    ...createDefaultVocalPattern('puxador', 'Phrase 1', 2, 88),
    rawPitchCurve: makeCurve([60, 62, 64, 60, 57, 57]),
    mainSteps: [
      { stepIndex: 0, active: true, isTie: false, note: 'Bb3', midiNumber: 58 }, // Faussé d'un demi-ton
    ],
  };

  // Phrase 2 avec uniquement du PCM vocal synthétique à 220 Hz (La3 = MIDI 57, fondamentale + harmoniques) sans rawPitchCurve pré-calculée
  const sr = 44100;
  const pcmLa3 = new Float32Array(Math.floor(sr * 0.8));
  for (let i = 0; i < pcmLa3.length; i++) {
    const t = i / sr;
    pcmLa3[i] = 0.55 * Math.sin(2 * Math.PI * 220 * t) + 0.25 * Math.sin(2 * Math.PI * 440 * t) + 0.12 * Math.sin(2 * Math.PI * 660 * t);
  }
  const coro1 = {
    ...createDefaultVocalPattern('coro', 'Coro 1', 2, 88),
    recordingResult: { pcm: pcmLa3, sampleRate: sr },
  };

  const analysis = analyzeFullProjectScale([pux1, coro1]);
  assert.equal(analysis.tonic, 'A', `La tonique détectée doit être A (La), obtenu: ${analysis.tonic}`);
  assert.equal(analysis.scaleType, 'natural_minor', `Le mode détecté doit être natural_minor, obtenu: ${analysis.scaleType}`);
  assert.equal(analysis.label, 'La Mineur');
  assert.equal(analysis.referencePitch, 'A3', `La note de repère doit passer sur A3, obtenu: ${analysis.referencePitch}`);
  assert.equal(analysis.referencePitchSolfege, 'La3');
  assert.equal(formatReferencePitchSolfege('A3'), 'La3');
  assert.equal(analysis.analyzedPatternsCount, 2, 'Les 2 phrases (dont celle avec PCM brut) ont été analysées');

  // Application à tout le projet et requantification des briques MIDI
  const proj = { ...createDefaultToadaProject(), patterns: analysis.updatedPatterns };
  const updatedProj = applyDetectedScaleToProject(proj, analysis.tonic, analysis.scaleType, analysis.referencePitch);
  assert.equal(updatedProj.toadaMeta?.tonaliteDefaut, 'La Mineur');
  assert.equal(updatedProj.patterns[0].referencePitch, 'A3');
  // Bb3 (58) n'est pas dans La Mineur -> doit être requantifié dans la gamme (A3=57 ou B3=59)
  const snappedMidi = updatedProj.patterns[0].mainSteps[0].midiNumber;
  assert.ok([57, 59, 60].includes(snappedMidi), `Bb3 (58) doit être requantifié sur La Mineur (57, 59 ou 60 sur la courbe), obtenu: ${snappedMidi}`);
}
console.log('✅ Test 3 OK');

console.log('🎉 TOUS LES TESTS DU LIVRET 1 ÉPURÉ ET DE L\'ANALYSE DE GAMME SONT PASSÉS AVEC SUCCÈS !');
