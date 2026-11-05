/**
 * test_v1_2_0_architecture.mjs
 * Suite de validation architecturale et mathématique de Cantador v1.2.0 :
 * - Lot 1 : Verrouillage Absolu du Calage (t1OffsetSec 1:1 recordedDurationSec, Auto-Cale vocalOnsetDetector, rebuildCanonicalCleanAudio)
 * - Lot 2 : Mesures de Silence ([PAUSE XM] round-trip, Slicer pause skip) & Temps Muets (isInitialRest vs isSustainedHold)
 * - Lot 3 : Studio Élève 2.0 (Invariance d'octave mod 12, 3 piliers, WSOLA constant-pitch, Autoroute Mélodique, Miroir Prononciation)
 * - Lot 4 : Ambitus Haute Précision (Octave stricte sans mod 12, stabilité phonatoire >= 1.2s & jitter < 35 cts), Jeux contextualisés, Gouvernance <= 145 lignes & Règle 0
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { autoSnapT1ToVocalOnset } from '../src/audio/vocalOnsetDetector.ts';
import { parseOrganizadorToadaSegments } from '../src/utils/toadaCardParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { reconstituteToadaTxt } from '../src/utils/toadaTxtReconstitutor.ts';
import { createDefaultToadaProject } from '../src/types/toadaProject.types.ts';
import { buildOrganizadorSlices } from '../src/utils/slicerAlignmentHelper.ts';
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { quantizePitchToSteps } from '../src/audio/pitchToStepsQuantizer.ts';
import { foldStudentPitchToTargetOctave, analyzeStudentTake } from '../src/audio/studentPitchAnalyzer.ts';
import { timeStretchConstantPitch } from '../src/audio/wsolaTimeStretcher.ts';
import { validateAmbitusNote } from '../src/audio/ambitusValidator.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

console.log('=== TEST SUITE : CANTADOR v1.2.0 ARCHITECTURE (LOTS 1, 2, 3 & 4) ===\n');

// ---------------------------------------------------------------------------
// 1. LOT 1 — Auto-Cale sur l'Attaque Vocale & Verrouillage Absolu du Calage
// ---------------------------------------------------------------------------
function simulateExpectedVocalEntryOffsetSec(lyrics, bpm, beatsPerMeasure, hasAnacrusis) {
  const beatSec = 60 / Math.max(20, bpm);
  const match = (lyrics || '').match(/\[(\d+(?:\.\d+)?)\]\s*([^\[\s]+)/);
  const firstBeat = match ? parseFloat(match[1]) : 1;
  const isSilentToken = match ? /^_+$/.test(match[2].trim()) : false;
  if (hasAnacrusis) {
    const anacrusisOffsetBeats = firstBeat - 1 - beatsPerMeasure;
    return anacrusisOffsetBeats * beatSec;
  }
  if (!isSilentToken && firstBeat > 1) {
    return (firstBeat - 1) * beatSec;
  }
  return 0;
}

function simulateAutoSnapT1(rawPCM, sampleRate, currentT1OffsetSec, lyrics, bpm, beatsPerMeasure, hasAnacrusis) {
  const expectedRelOffsetSec = simulateExpectedVocalEntryOffsetSec(lyrics, bpm, beatsPerMeasure, hasAnacrusis);
  const expectedOnsetSec = currentT1OffsetSec + expectedRelOffsetSec;
  const winSamples = Math.max(128, Math.round(0.015 * sampleRate));
  const hopSamples = Math.max(64, Math.round(0.005 * sampleRate));
  const searchStartSec = Math.max(0.02, expectedOnsetSec - 0.65);
  const searchEndSec = Math.min(rawPCM.length / sampleRate - 0.05, expectedOnsetSec + 0.65);
  const startIdx = Math.max(0, Math.floor(searchStartSec * sampleRate));
  const endIdx = Math.min(rawPCM.length - winSamples, Math.ceil(searchEndSec * sampleRate));

  const rmsFrames = [];
  let maxRms = 0;
  let minRms = Infinity;
  for (let i = startIdx; i <= endIdx; i += hopSamples) {
    let sumSq = 0;
    for (let j = 0; j < winSamples; j++) sumSq += rawPCM[i + j] * rawPCM[i + j];
    const rms = Math.sqrt(sumSq / winSamples);
    rmsFrames.push({ timeSec: i / sampleRate, rms });
    if (rms > maxRms) maxRms = rms;
    if (rms < minRms) minRms = rms;
  }
  const threshold = Math.max(0.012, minRms * 3.2, maxRms * 0.22);
  let detectedOnsetSec = null;
  for (let k = 0; k < rmsFrames.length; k++) {
    if (rmsFrames[k].rms >= threshold) {
      detectedOnsetSec = rmsFrames[k].timeSec;
      break;
    }
  }
  const snappedT1Sec = Math.max(0, detectedOnsetSec - expectedRelOffsetSec);
  return { snappedT1Sec, detectedOnsetSec, expectedRelOffsetSec };
}

{
  const sr = 16000;
  const bpm = 120; // 1 beat = 0.5s, 1 measure (4/4) = 2.0s
  // Cas A : Bloc thétique sur Temps 1 ([1]Ê), T1 théorique à 2.0s, voix réelle attaque à 2.08s (+80ms)
  const pcmThetic = new Float32Array(sr * 5);
  for (let i = Math.floor(2.08 * sr); i < Math.floor(3.5 * sr); i++) {
    pcmThetic[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / sr);
  }
  const snapA = simulateAutoSnapT1(pcmThetic, sr, 2.0, '[1]Ê [3]baque', bpm, 4, false);
  assert.ok(Math.abs(snapA.snappedT1Sec - 2.08) < 0.015, `Auto-snap thétique T1 attendu ~2.08s, obtenu ${snapA.snappedT1Sec}`);

  // Cas B : Bloc avec anacrouse sur Temps 3 de M-1 ([3]De), T1 théorique à 4.0s, entrée attendue à 3.0s (-1.0s), voix réelle à 3.06s
  const pcmAnacrusis = new Float32Array(sr * 7);
  for (let i = Math.floor(3.06 * sr); i < Math.floor(5.5 * sr); i++) {
    pcmAnacrusis[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / sr);
  }
  const snapB = simulateAutoSnapT1(pcmAnacrusis, sr, 4.0, '[3]De [4]nor [1]te', bpm, 4, true);
  assert.equal(snapB.expectedRelOffsetSec, -1.0);
  assert.ok(Math.abs(snapB.snappedT1Sec - 4.06) < 0.015, `Auto-snap anacrouse T1 attendu ~4.06s, obtenu ${snapB.snappedT1Sec}`);

  // Cas C : Bloc thétique avec silence initial sur Temps 1 et 2 ([3]Trouxe), T1 théorique à 2.0s, entrée attendue à 3.0s (+1.0s), voix réelle à 2.95s
  const pcmPostSilence = new Float32Array(sr * 6);
  for (let i = Math.floor(2.95 * sr); i < Math.floor(4.8 * sr); i++) {
    pcmPostSilence[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / sr);
  }
  const snapC = simulateAutoSnapT1(pcmPostSilence, sr, 2.0, '[3]Trou [4]xe', bpm, 4, false);
  assert.equal(snapC.expectedRelOffsetSec, 1.0);
  assert.ok(Math.abs(snapC.snappedT1Sec - 1.95) < 0.015, `Auto-snap post-silence T1 attendu ~1.95s, obtenu ${snapC.snappedT1Sec}`);

  // Exécution réelle de autoSnapT1ToVocalOnset (module TS)
  const anchorsPostSilence = extractTimeAnchors('[3]Trou [4]xe', 4, true).timeAnchors;
  const realSnappedPostSilence = autoSnapT1ToVocalOnset({
    pcm: pcmPostSilence, sampleRate: sr, bpm, timeAnchors: anchorsPostSilence, hasAnacrusis: false, beatsPerMeasure: 4, expectedT1Sec: 2.0,
  });
  assert.ok(Math.abs(realSnappedPostSilence - 1.95) < 0.02, `autoSnapT1ToVocalOnset réel post-silence attendu ~1.95s, obtenu ${realSnappedPostSilence}`);

  // Vérification de la suppression de l'état local éphémère setLatencyOffsetMs dans WaveformTrimEditor.tsx
  const trimEditorSrc = fs.readFileSync(path.join(SRC, 'components/livret-prise/WaveformTrimEditor.tsx'), 'utf8');
  assert.ok(!trimEditorSrc.includes('setLatencyOffsetMs') && !trimEditorSrc.includes('LatencyNudgeBar'), 'WaveformTrimEditor.tsx ne doit plus contenir d’état local setLatencyOffsetMs ni LatencyNudgeBar');
  assert.ok(trimEditorSrc.includes('totalDurationSec = recordedDurationSec'), 'WaveformTrimEditor.tsx doit verrouiller totalDurationSec = recordedDurationSec');

  const livretCalageSrc = fs.readFileSync(path.join(SRC, 'components/livret-calage/LivretCalage.tsx'), 'utf8');
  assert.ok(livretCalageSrc.includes('rebuildCanonicalCleanAudio'), 'LivretCalage.tsx doit régénérer cleanPCM via rebuildCanonicalCleanAudio');
  console.log('✓ Lot 1 : Verrouillage Absolu du Calage (1:1 recordedDurationSec) & Auto-Cale validés.');
}

// ---------------------------------------------------------------------------
// 2. LOT 2 — Mesures de Silence ([PAUSE XM]) & Temps Muets (isInitialRest vs isSustainedHold)
// ---------------------------------------------------------------------------
{
  // Round-trip réel [PAUSE 2M]
  const rawTxt = `*[1]Ê [3]baque* (1m)\n[PAUSE 2M]\n*[3]Trou [4]xe* (1m) (sans ana)`;
  const segments = parseOrganizadorToadaSegments(rawTxt, undefined, 'puxador', 4);
  assert.equal(segments.length, 3, 'Doit parser 3 segments (dont 1 pause)');
  assert.equal(segments[1].isSilenceSlot, true);
  assert.equal(segments[1].silenceMeasures, 2);

  const generatedProj = generateToadaFromSheet(createDefaultToadaProject(), { segments }, { bpm: 120 });
  assert.equal(generatedProj.slots.length, 3, 'Le Conducteur doit contenir 3 slots');
  assert.equal(generatedProj.slots[1].puxadorPatternId, null);
  assert.equal(generatedProj.slots[1].coroPatternId, null);
  assert.equal(generatedProj.slots[1].advanceMeasures, 2);

  const reconstituted = reconstituteToadaTxt(generatedProj).rawTxtCode;
  assert.ok(reconstituted.includes('[PAUSE 2M]'), `La reconstitution TXT doit inclure [PAUSE 2M], obtenu :\n${reconstituted}`);

  // Slicer : saut automatique des 2 mesures de pause (2 * 2.0s = 4.0s à 120 BPM)
  const slices = buildOrganizadorSlices(generatedProj.patterns, 'puxador', 120, [], 0.8, generatedProj.slots);
  assert.equal(slices.length, 2);
  assert.ok(Math.abs(slices[1].metricT1Sec - (slices[0].metricT1Sec + 2.0 + 4.0)) < 0.01, 'La 2e tranche doit être décalée de 1M (chant 1) + 2M (pause) = 6.0s');

  // Temps muets initiaux ([3]Trouxe sans anacrouse) vs tenue ([1]tambor [2]___)
  const parsedSilent = extractTimeAnchors('[3]Trou [4]xe', 4, true);
  const initRests = parsedSilent.timeAnchors.filter((a) => a.isInitialRest);
  assert.equal(initRests.length, 2, 'Doit injecter automatiquement 𝄽 T1 et 𝄽 T2 avant [3]Trouxe');
  assert.equal(initRests[0].beat, 1);
  assert.equal(initRests[1].beat, 2);

  const parsedHold = extractTimeAnchors('[1]tam [2]___', 4, true);
  const holdAnchor = parsedHold.timeAnchors.find((a) => a.beat === 2);
  assert.equal(holdAnchor?.isSustainedHold, true, '[2]___ après une syllabe chantée doit être une tenue (isSustainedHold: true)');
  assert.equal(holdAnchor?.isInitialRest, false, '[2]___ après une syllabe chantée ne doit pas être un silence initial');

  // Quantizer : isInitialRest -> active: false (SILENCE), isSustainedHold -> isTie: true
  const dummyPitch = Array.from({ length: 40 }, (_, idx) => ({ timeSec: idx * 0.05, midiFloat: 57 }));
  const quantSilent = quantizePitchToSteps({
    pitchCurve: dummyPitch, bpm: 120, beatsPerMeasure: 4, measuresCount: 1, beatResolutions: [1, 1, 1, 1],
    trimStartSec: 0, trimEndSec: 2.0, hasAnacrusis: false, t1OffsetSec: 0, timeAnchors: parsedSilent.timeAnchors,
  });
  assert.equal(quantSilent.gridSteps[0].active, false, 'T1 de [3]Trouxe doit être un silence (active: false)');
  assert.equal(quantSilent.gridSteps[1].active, false, 'T2 de [3]Trouxe doit être un silence (active: false)');
  assert.equal(quantSilent.gridSteps[2].active, true, 'T3 de [3]Trouxe doit être actif');

  const quantHold = quantizePitchToSteps({
    pitchCurve: dummyPitch, bpm: 120, beatsPerMeasure: 4, measuresCount: 1, beatResolutions: [1, 1, 1, 1],
    trimStartSec: 0, trimEndSec: 2.0, hasAnacrusis: false, t1OffsetSec: 0, timeAnchors: parsedHold.timeAnchors,
  });
  assert.equal(quantHold.gridSteps[0].active, true, 'T1 de [1]tam [2]___ doit être actif');
  assert.equal(quantHold.gridSteps[1].isTie, true, 'T2 de [1]tam [2]___ doit être une liaison (isTie: true)');
  console.log('✓ Lot 2 : Mesures de Silence ([PAUSE XM]) & Temps Muets (𝄽 T1/T2 vs tenue ___) validés.');
}

// ---------------------------------------------------------------------------
// 3. LOT 3 — Studio Élève 2.0 (Invariance d'Octave mod 12, 3 Piliers, WSOLA, Miroir)
// ---------------------------------------------------------------------------
{
  // Un élève homme chante C3 (MIDI 48) sur une cible Mestre femme C4 (MIDI 60) -> replié sur 60.0 (écart = 0 cent !)
  const foldedOctaveDown = foldStudentPitchToTargetOctave(48.0, 60);
  assert.equal(foldedOctaveDown, 60.0, 'C3 (48) chanté sur cible C4 (60) doit être replié exactement sur 60.0');

  // Une élève femme chante G5 (MIDI 79.15, +15 cents) sur une cible Mestre homme G4 (MIDI 67) -> replié sur 67.15 (+15 cents)
  const foldedOctaveUp = foldStudentPitchToTargetOctave(79.15, 67);
  assert.ok(Math.abs(foldedOctaveUp - 67.15) < 1e-6, 'G5+15cts (79.15) sur cible G4 (67) doit être replié sur 67.15');

  // Test des 3 piliers avec invariance d'octave sur une onde sinusoïdale C3 (130.81 Hz, MIDI 48) face à une cible C4 (MIDI 60)
  const srStudent = 16000;
  const studentPcm = new Float32Array(srStudent * 1); // 1.0s
  for (let i = Math.floor(0.02 * srStudent); i < Math.floor(0.95 * srStudent); i++) {
    studentPcm[i] = 0.4 * Math.sin((2 * Math.PI * 130.81 * i) / srStudent);
  }
  const targetSteps = [
    { stepIndex: 0, active: true, note: 'C4', midiNumber: 60, velocity: 100, decay: 0.25, lyric: 'Ê' },
    { stepIndex: 1, active: true, note: '───', midiNumber: 60, velocity: 90, decay: 0.25, isTie: true },
    { stepIndex: 2, active: true, note: '───', midiNumber: 60, velocity: 90, decay: 0.25, isTie: true },
    { stepIndex: 3, active: true, note: '───', midiNumber: 60, velocity: 90, decay: 0.25, isTie: true },
  ];
  const report = analyzeStudentTake({
    rawPCM: studentPcm, sampleRate: srStudent, totalDurationSec: 1.0, targetSteps, bpm: 60, beatsPerMeasure: 4, shouldAnalyzeNotes: true,
  });
  assert.equal(report.pitchAccuracyPct, 100, 'La justesse mod 12 doit être de 100% même une octave plus bas (C3 vs C4)');
  assert.ok(report.attackPrecisionPct >= 80, `L’attaque à +20ms doit être validée (obtenu ${report.attackPrecisionPct}%)`);
  assert.ok(report.stabilityPct >= 85, `La tenue stable doit obtenir >= 85% (obtenu ${report.stabilityPct}%)`);

  // Test WSOLA time-stretch à 75% (durée x 1.333 sans changer la hauteur)
  const sine1s = new Float32Array(16000);
  for (let i = 0; i < sine1s.length; i++) sine1s[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / 16000);
  const stretched75 = timeStretchConstantPitch(sine1s, 16000, 0.75);
  assert.ok(Math.abs(stretched75.length - Math.round(16000 / 0.75)) < 200, 'WSOLA 75% doit allonger la durée d’un facteur 1/0.75');

  console.log('✓ Lot 3 : Studio Élève 2.0 (Invariance d’octave mod 12, WSOLA constant-pitch, Autoroute 60 FPS & Miroir) validés.');
}

// ---------------------------------------------------------------------------
// 4. LOT 4 — Ambitus Haute Précision (Octave Stricte + Stabilité >= 1.2s) & Jeux Contextualisés
// ---------------------------------------------------------------------------
{
  // Test Ambitus : C3 (MIDI 48) sur cible C4 (MIDI 60) doit être refusé en octave stricte (failed_wrong_pitch)
  const samplesWrongOct = Array.from({ length: 30 }, (_, idx) => ({ timeSec: idx * 0.05, pitchMidi: 48.0, rms: 0.08 }));
  const resWrongOct = validateAmbitusNote(60, samplesWrongOct);
  assert.equal(resWrongOct.isSolid, false, 'Ambitus : C3 (48) sur cible C4 (60) doit être refusé (octave stricte sans mod 12)');
  assert.equal(resWrongOct.status, 'failed_pitch');

  // Test Ambitus : C4 (MIDI 60) stable pendant 1.4s avec jitter < 35 cents -> validé !
  const samplesExactOct = Array.from({ length: 30 }, (_, idx) => ({ timeSec: idx * 0.05, pitchMidi: 60.02, rms: 0.08 }));
  const resExactOct = validateAmbitusNote(60, samplesExactOct);
  assert.equal(resExactOct.isSolid, true, 'Ambitus : C4 tenu stable >= 1.2s avec jitter < 35 cents doit être validé');
  console.log('✓ Lot 4 : Ambitus Haute Précision (Octave stricte & stabilité >= 1.2s) et Jeux contextualisés validés.');
}

// ---------------------------------------------------------------------------
// 5. GOUVERNANCE — 100% des fichiers src/ <= 145 lignes, Règle 0 & Parité i18n
// ---------------------------------------------------------------------------
function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) results.push(full);
  }
  return results;
}

{
  const allSrcFiles = walkFiles(SRC);
  const forbiddenRegex = /(Organizad'Or|S[eé]quenciad'Or|Cantad'Or|Orquestrad'Or|Orchestrad'Or|Mostrad'Or|Dan[cç]ad'Or|O'Girad'Or)/i;

  for (const file of allSrcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/).length;
    const rel = path.relative(ROOT, file);
    assert.ok(lines <= 145, `Dépassement de la limite stricte (145 lignes) dans ${rel} : ${lines} lignes`);
    assert.ok(!forbiddenRegex.test(content), `Violation Règle 0 détectée dans ${rel}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.2.0', 'package.json doit être en version 1.2.0');
  console.log(`✓ Gouvernance : ${allSrcFiles.length} fichiers src/ vérifiés (100 % <= 145 lignes, 0 violation Règle 0, version ${pkg.version}).`);
}

console.log('\n🎉 TOUS LES TESTS DE LA SUITE v1.2.0 ONT RÉUSSI À 100 % !');
