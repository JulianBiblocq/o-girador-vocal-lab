/**
 * test_studio_formant_transposition_and_locks.mjs
 * Suite de tests E2E & unitaires pour :
 * - Volet 1 : Transposition vocale Studio (Séparation consonnes/transitoires + LPC Formant-Preserving Pitch Shifter)
 * - Volet 2 : Double Tonalité (Prise chantée vs Tonalité Troupe) sans désaligner le Piano Roll
 * - Volet 3 : Verrous de sécurité dans Organizador (Tonalité de la troupe en lecture seule)
 * - Volet 4 : Contrat complet /toada_packs pour Sequenciador (Audio + MIDI transposés + passerelle retour)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './resolve-ts.mjs';

const {
  analyzeVocalFrames,
  blendUnvoicedTransientsAtUnityRatio,
} = await import('../src/audio/vocalTransientSeparator.ts');
const {
  shiftVocalPitchFormantPreserved,
  getOrComputeTroupeTransposedPCM,
} = await import('../src/audio/formantPreservingPitchShifter.ts');
const {
  transposePitchClass,
  transposeVocalSteps,
  resolveProjectDualScale,
  applyDualScaleToProject,
} = await import('../src/utils/scaleTranspositionHelper.ts');
const { buildOrganizadorDocumentPayload } = await import('../src/services/organizadorToadaPublisher.ts');
const { sanitizePatternForFirestore } = await import('../src/services/toadaPublishHelpers.ts');
const { buildSequencerToadaPackDocument } = await import('../src/services/cloudToadaPublisher.ts');
const { applySequenciadorPackTranspositionToProject } = await import('../src/utils/toadaSyncService.ts');
const { formatCantadorLockedTonalite } = await import('../../o-girador-organizador/src/components/documents/form/DocumentFormToadaFields.jsx');

console.log('=== TEST VOLET 1 : MOTEUR DE TRANSPOSITION VOCALE STUDIO (CONSONNES + FORMANTS LPC) ===');

const sampleRate = 44100;
const durationSec = 0.60;
const totalSamples = Math.floor(sampleRate * durationSec);
const syntheticVocalPcm = new Float32Array(totalSamples);

// 0.00s..0.12s : Consonne fricative non-voisée (bruit haute fréquence / sibilante 's'/'ch')
let lcg = 123456789;
for (let i = 0; i < Math.floor(0.12 * sampleRate); i++) {
  lcg = (1103515245 * lcg + 12345) & 0x7fffffff;
  const white = (lcg / 0x3fffffff) - 1.0;
  const prev = i > 0 ? syntheticVocalPcm[i - 1] : 0;
  syntheticVocalPcm[i] = (white - prev) * 0.25;
}

// 0.12s..0.60s : Voyelle voisée en Sib3 (Bb3 = 233.08 Hz) avec formants vers ~700 Hz (H3) et ~1165 Hz (H5)
const f0Bb3 = 233.08;
for (let i = Math.floor(0.12 * sampleRate); i < totalSamples; i++) {
  const t = i / sampleRate;
  const h1 = 0.55 * Math.sin(2 * Math.PI * f0Bb3 * t);
  const h2 = 0.35 * Math.sin(2 * Math.PI * (2 * f0Bb3) * t);
  const h3 = 0.80 * Math.sin(2 * Math.PI * (3 * f0Bb3) * t); // Formant F1 ~ 700 Hz
  const h4 = 0.25 * Math.sin(2 * Math.PI * (4 * f0Bb3) * t);
  const h5 = 0.60 * Math.sin(2 * Math.PI * (5 * f0Bb3) * t); // Formant F2 ~ 1165 Hz
  syntheticVocalPcm[i] = 0.35 * (h1 + h2 + h3 + h4 + h5);
}

// 1.A Vérification de la détection Consonnes / Transitoires vs Voyelles voisées
const frames = analyzeVocalFrames(syntheticVocalPcm, sampleRate);
assert.ok(frames.length > 20, 'Devrait analyser les trames de 10 ms');
const consonantFrames = frames.slice(1, 9); // Au cœur du segment 0.01s..0.09s
const vowelFrames = frames.slice(20, 50);   // Au cœur du segment 0.20s..0.50s
assert.ok(
  consonantFrames.every((f) => f.isUnvoicedOrTransient),
  'Les trames de consonne sibilante doivent être classées isUnvoicedOrTransient = true'
);
assert.ok(
  vowelFrames.filter((f) => !f.isUnvoicedOrTransient).length >= vowelFrames.length * 0.85,
  'Les trames de voyelle stable doivent être classées voisée (isUnvoicedOrTransient = false)'
);

// 1.B Vérification de la transposition Formant-Preserved (+2 demi-tons : Sib3 -> Do4)
const rawCopyBefore = new Float32Array(syntheticVocalPcm);
const shiftedPlus2 = shiftVocalPitchFormantPreserved(syntheticVocalPcm, sampleRate, 2);

assert.equal(
  shiftedPlus2.length,
  syntheticVocalPcm.length,
  'La longueur exacte des échantillons doit être 100% invariante (aucun décalage de t1OffsetSec)'
);
assert.deepEqual(
  syntheticVocalPcm,
  rawCopyBefore,
  'Le buffer original (0 st) ne doit jamais être muté en place'
);

// Vérifier que les consonnes non-voisées restent verrouillées au ratio 1.0 (identiques au signal original hors zone de crossfade)
let maxConsonantDiff = 0;
for (let i = Math.floor(0.02 * sampleRate); i < Math.floor(0.08 * sampleRate); i++) {
  maxConsonantDiff = Math.max(maxConsonantDiff, Math.abs(shiftedPlus2[i] - syntheticVocalPcm[i]));
}
assert.ok(
  maxConsonantDiff < 1e-6,
  `Les consonnes non-voisées doivent rester à 1.0x sans altération (diff max = ${maxConsonantDiff})`
);

// Vérifier que l'énergie RMS de la voyelle transposée est fidèlement conservée
let rmsOrig = 0;
let rmsShifted = 0;
const vStart = Math.floor(0.22 * sampleRate);
const vEnd = Math.floor(0.52 * sampleRate);
for (let i = vStart; i < vEnd; i++) {
  rmsOrig += syntheticVocalPcm[i] * syntheticVocalPcm[i];
  rmsShifted += shiftedPlus2[i] * shiftedPlus2[i];
}
rmsOrig = Math.sqrt(rmsOrig / (vEnd - vStart));
rmsShifted = Math.sqrt(rmsShifted / (vEnd - vStart));
const rmsRatio = rmsShifted / rmsOrig;
assert.ok(
  rmsRatio > 0.85 && rmsRatio < 1.15,
  `L'énergie RMS de la voyelle transposée doit être préservée (ratio = ${rmsRatio.toFixed(3)})`
);

// Vérifier via autocorrélation que la fréquence fondamentale F0 est bien montée de Sib3 (233.08 Hz) à Do4 (~261.63 Hz)
function estimateF0Autocorr(buf, sr, startIdx, endIdx) {
  const minLag = Math.floor(sr / 400);
  const maxLag = Math.ceil(sr / 150);
  let bestLag = minLag;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = startIdx; i < endIdx - lag; i++) {
      corr += buf[i] * buf[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  return sr / bestLag;
}

const f0OrigEst = estimateF0Autocorr(syntheticVocalPcm, sampleRate, vStart, vEnd);
const f0ShiftedEst = estimateF0Autocorr(shiftedPlus2, sampleRate, vStart, vEnd);
console.log(`   -> F0 originale estimée : ${f0OrigEst.toFixed(1)} Hz (attendu ~233.1 Hz Sib3)`);
console.log(`   -> F0 transposée (+2 st) : ${f0ShiftedEst.toFixed(1)} Hz (attendu ~261.6 Hz Do4)`);
assert.ok(Math.abs(f0OrigEst - 233.1) < 6, 'F0 originale doit être ~233.1 Hz');
assert.ok(Math.abs(f0ShiftedEst - 261.6) < 8, 'F0 transposée (+2 st) doit être ~261.6 Hz');

// 1.C Vérification du cache WeakMap getOrComputeTroupeTransposedPCM
const cached1 = getOrComputeTroupeTransposedPCM(syntheticVocalPcm, sampleRate, 2);
const cached2 = getOrComputeTroupeTransposedPCM(syntheticVocalPcm, sampleRate, 2);
assert.equal(cached1, cached2, 'getOrComputeTroupeTransposedPCM doit renvoyer la même instance depuis le cache WeakMap');

console.log('✅ VOLET 1 VALIDÉ !');

console.log('=== TEST VOLET 2 : DOUBLE TONALITÉ (CHANTÉE VS TROUPE) & PRÉSERVATION DU PIANO ROLL ===');

const baseProject = {
  id: 'proj-vovo-falou',
  name: 'Vovó falou',
  bpm: 85,
  timeSignature: '4/4',
  source: 'organizador',
  sungScaleRoot: 'A#',
  sungScaleMode: 'major',
  transpositionSemitones: 0,
  troupeScaleRoot: 'A#',
  toadaMeta: {
    id: 'doc-vovo-1',
    titre: 'Vovó falou',
    bpmDefaut: 85,
    tonaliteDefaut: 'Sib Majeur',
  },
  slots: [
    { id: 'slot-1', orderIndex: 0, label: 'M1', puxadorPatternId: 'pat-pux-1', coroPatternId: null },
  ],
  patterns: [
    {
      id: 'pat-pux-1',
      name: 'Puxador 1',
      role: 'puxador',
      measuresCount: 1,
      bpm: 85,
      baseBpm: 85,
      hasAnacrusis: true,
      anacrusisBeats: 2,
      hasTailBeat: true,
      t1OffsetSec: 1.41,
      referencePitch: 'A#3',
      assignedLyricsText: 'Vovó falou',
      rawLineCode: '*[3]Vo[4]vó fa[1]lou*',
      rawAudioSamples: syntheticVocalPcm,
      anacrusisSteps: [
        { stepIndex: 0, active: false, midiNumber: 0, note: '', syllable: '' },
        { stepIndex: 1, active: false, midiNumber: 0, note: '', syllable: '' },
        { stepIndex: 2, active: true, midiNumber: 58, note: 'A#3', syllable: 'Vo-' },
        { stepIndex: 3, active: true, midiNumber: 60, note: 'C4', syllable: 'vó' },
      ],
      mainSteps: [
        { stepIndex: 0, active: true, midiNumber: 62, note: 'D4', syllable: 'fa-' },
        { stepIndex: 1, active: true, midiNumber: 58, note: 'A#3', syllable: 'lou' },
        { stepIndex: 2, active: true, midiNumber: 58, note: '───', syllable: '───' },
        { stepIndex: 3, active: false, midiNumber: 0, note: '', syllable: '' },
      ],
      harmonyGrid: {
        measures: [{ measureIndex: 0, chordsByBeat: { 0: 'Bb', 2: 'F7' } }],
      },
      pack: null,
      pitchCurve: [],
      melodyneRegions: [],
    },
  ],
};

// Le Mestre choisit de transposer la Tonalité Troupe de +2 demi-tons (Sib Majeur -> Do Majeur)
const transposedProject = applyDualScaleToProject(baseProject, 'A#', 'major', 2, 'A#3', 'fr');

const dualState = resolveProjectDualScale(transposedProject, 'fr');
assert.equal(dualState.sungScaleRoot, 'A#', 'La prise chantée reste en Sib (A#)');
assert.equal(dualState.troupeScaleRoot, 'C', 'La tonalité troupe passe en Do (C)');
assert.equal(dualState.transpositionSemitones, 2, 'La transposition est de +2 demi-tons');
assert.equal(transposedProject.toadaMeta.tonaliteDefaut, 'Do Majeur', 'tonaliteDefaut stocke toujours la Tonalité Troupe');
assert.equal(transposedProject.toadaMeta.tonaliteChanteeOrigine, 'Sib Majeur', 'tonaliteChanteeOrigine stocke la prise chantée');

// Vérifier que les briques MIDI du Piano Roll restent sur la prise chantée (A#3 = MIDI 58) pour coller à la courbe verte
assert.equal(
  transposedProject.patterns[0].anacrusisSteps[2].midiNumber,
  58,
  'Les briques MIDI du Piano Roll doivent rester sur la Prise chantée (58 = A#3) pour rester alignées sur la courbe verte'
);

console.log('✅ VOLET 2 VALIDÉ !');

console.log('=== TEST VOLET 3 : VERROUS DE SÉCURITÉ DANS ORGANIZADOR ===');

const { payload: organizadorPayload } = buildOrganizadorDocumentPayload(transposedProject, 'ibiriba');
assert.equal(organizadorPayload.tonaliteDefaut, 'Do Majeur', 'Organizador reçoit la Tonalité Troupe dans tonaliteDefaut');
assert.equal(organizadorPayload.tonaliteChanteeOrigine, 'Sib Majeur', 'Organizador reçoit la Tonalité Chantée dans tonaliteChanteeOrigine');
assert.equal(organizadorPayload.transpositionSemitones, 2, 'Organizador reçoit transpositionSemitones = 2');

const lockedDisplay = formatCantadorLockedTonalite(
  organizadorPayload.tonaliteDefaut,
  organizadorPayload.tonaliteChanteeOrigine,
  organizadorPayload.transpositionSemitones
);
console.log(`   -> Affichage verrouillé dans Organizador : "${lockedDisplay}"`);
assert.equal(
  lockedDisplay,
  '🔒 Do Majeur (prise chantée en Sib • +2 st)',
  'Le formatage du champ verrouillé dans Organizador doit afficher la tonalité troupe, la prise chantée et les demi-tons'
);

// Vérifier dans le code source de ToadaHeaderMetadataForm.jsx que le champ est bien readOnly et porte le libellé TONALITÉ DE LA TROUPE (GAMME)
const headerFormSrc = fs.readFileSync(
  path.resolve('../o-girador-organizador/src/components/documents/toada/ToadaHeaderMetadataForm.jsx'),
  'utf8'
);
assert.ok(
  headerFormSrc.includes('TONALITÉ DE LA TROUPE (GAMME)'),
  'ToadaHeaderMetadataForm.jsx doit afficher le libellé TONALITÉ DE LA TROUPE (GAMME)'
);
assert.ok(
  headerFormSrc.includes('readOnly'),
  'ToadaHeaderMetadataForm.jsx doit verrouiller la tonalité en lecture seule (readOnly)'
);

console.log('✅ VOLET 3 VALIDÉ !');

console.log('=== TEST VOLET 4 : CONTRAT COMPLET /toada_packs POUR SEQUENCIADOR & PASSERELLE RETOUR ===');

const sanitizedPat = sanitizePatternForFirestore(
  transposedProject.patterns[0],
  'https://storage.example/puxador_1_transposed_C.wav',
  0.6,
  1.41,
  -1.41,
  2
);

const packDoc = buildSequencerToadaPackDocument(
  transposedProject,
  [sanitizedPat]
);

assert.equal(packDoc.sungKey, 'Sib Majeur', 'Le pack /toada_packs doit exposer sungKey = "Sib Majeur"');
assert.equal(packDoc.troupeKey, 'Do Majeur', 'Le pack /toada_packs doit exposer troupeKey = "Do Majeur"');
assert.equal(packDoc.transpositionSemitones, 2, 'Le pack /toada_packs doit exposer transpositionSemitones = 2');
assert.equal(
  packDoc.patterns[0].anacrusisSteps[2].midiNumber,
  60,
  'Les pas MIDI envoyés à Sequenciador doivent être transposés de +2 st (58 A#3 -> 60 C4)'
);
assert.equal(
  packDoc.patterns[0].anacrusisSteps[2].note,
  'C4',
  'Le nom de note envoyé à Sequenciador doit être C4'
);
assert.equal(
  packDoc.patterns[0].mainSteps[2].isTie,
  true,
  'Les pas de prolongation ─── doivent porter isTie = true pour Sequenciador'
);

// Tester la passerelle retour Sequenciador -> Cantador (ex. le Mestre change la transposition à +3 st dans Sequenciador)
const updatedFromSequenciador = applySequenciadorPackTranspositionToProject(transposedProject, {
  transpositionSemitones: 3,
  troupeKey: 'Do# Majeur',
  sungKey: 'Sib Majeur',
});
assert.equal(updatedFromSequenciador.transpositionSemitones, 3, 'La passerelle retour met à jour transpositionSemitones = 3');
assert.equal(updatedFromSequenciador.troupeScaleRoot, 'C#', 'La passerelle retour met à jour troupeScaleRoot = C#');
assert.equal(updatedFromSequenciador.toadaMeta.tonaliteDefaut, 'Do# Majeur', 'La passerelle retour met à jour tonaliteDefaut = Do# Majeur');

console.log('✅ VOLET 4 VALIDÉ !');
console.log('🎉 100% DES TESTS STUDIO FORMANT TRANSPOSITION, DOUBLE TONALITÉ, VERROUS ORGANIZADOR & /toada_packs SONT PASSÉS AVEC SUCCÈS !');
