/**
 * test_vocal_dsp_worker_pipeline.mjs
 * Suite automatisée Phase G — Web Worker DSP dédié de Cantador :
 * 1. Parité mathématique bit-pour-bit (appel direct vs vocalDspWorkerClient) sur les 4 familles DSP
 * 2. Non-mutation & non-détachement strict (`pcm.byteLength > 0`) du Float32Array source (Node + Mock Browser Worker)
 * 3. Annulation Latest-Wins (`dedupeKey`) sur rafale de 3 requêtes rapides
 * 4. Découpe asynchrone Slicer (`executeBatchAssignAsync`) & Prise continue (`sliceContinuousTakeAsync`).
 */
import assert from 'node:assert/strict';
import { extractPatternMelodicData } from '../src/audio/melodicExtractionHelper.ts';
import { extractContinuousPitchCurve } from '../src/audio/pitchExtractor.ts';
import { reanalyzeNotesOnAlignedSyllables } from '../src/audio/syllableGuidedPitchReanalyzer.ts';
import { computeCorrectedPitchCurve, correctAudioPitchWithMelodyne } from '../src/audio/melodynePitchCorrector.ts';
import { shiftVocalPitchFormantPreserved } from '../src/audio/formantPreservingPitchShifter.ts';
import { encodePcmToWavArrayBuffer } from '../src/utils/wavEncoder.ts';
import { getEffectiveVocalBounds } from '../src/utils/ambitusStorage.ts';
import { buildAllowedPitchClasses } from '../src/audio/scaleQuantizer.ts';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/types/toadaProject.types.ts';
import { executeBatchAssign, executeBatchAssignAsync } from '../src/utils/slicerBatchAssigner.ts';
import { runVocalDspTask, collectResultTransferables } from '../src/workers/vocalDspTaskRunner.ts';
import {
  extractMelodicDataInWorker,
  reanalyzeSyllablesInWorker,
  renderVoiceDspInWorker,
  encodeWavInWorker,
  isVocalDspCancelled,
  getVocalDspBusyCount,
} from '../src/workers/vocalDspWorkerClient.ts';

function buildSyntheticSungTake(sampleRate = 24000, durationSec = 3.2) {
  const n = Math.floor(sampleRate * durationSec);
  const pcm = new Float32Array(n);
  // 4 notes chantées harmoniques : E3 (164.81 Hz), G3 (196 Hz), A3 (220 Hz), G3 (196 Hz)
  const notesHz = [164.81, 196.0, 220.0, 196.0];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (t < 0.18 || t > durationSec - 0.18) continue;
    const noteIdx = Math.min(3, Math.floor(((t - 0.18) / (durationSec - 0.36)) * 4));
    const f0 = notesHz[noteIdx];
    phase += (2 * Math.PI * f0) / sampleRate;
    const env = Math.min(1, (t - 0.18) * 18) * 0.45;
    pcm[i] = env * (0.72 * Math.sin(phase) + 0.22 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase));
  }
  return pcm;
}

function assertFloat32BitIdentical(a, b, label) {
  assert.equal(a.length, b.length, `${label}: longueurs Float32Array différentes (${a.length} vs ${b.length})`);
  const bufA = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const bufB = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  assert.equal(Buffer.compare(bufA, bufB), 0, `${label}: divergence bit-pour-bit détectée dans le Float32Array`);
}

console.log('=== TEST SUITE PHASE G : WEB WORKER DSP DÉDIÉ (PARITÉ BIT-POUR-BIT, MÉMOIRE & LATEST-WINS) ===\n');

const sampleRate = 24000;
const sourcePcm = buildSyntheticSungTake(sampleRate, 3.2);
const originalByteLength = sourcePcm.byteLength;
const originalSnapshot = Buffer.from(sourcePcm.buffer.slice(0));
assert.ok(originalByteLength > 0);

// ---------------------------------------------------------------------------
// 1. Parité mathématique bit-pour-bit sur les 4 familles de tâches DSP
// ---------------------------------------------------------------------------
const fixedIso = '2026-11-16T12:00:00.000Z';
const vocalBounds = getEffectiveVocalBounds();
const extractParams = {
  rawPCM: sourcePcm,
  sampleRate,
  bpm: 96,
  timeSignature: '4/4',
  measuresCount: 1,
  beatsPerMeasure: 4,
  beatResolutions: [4, 4, 4, 4],
  hasAnacrusis: false,
  trimStartSec: 0,
  trimEndSec: 3.2,
  t1OffsetSec: 0.15,
  referencePitch: 'E3',
  assignedLyricsText: 'Vo-vó fa-lou',
  vocalBounds,
  createdAt: fixedIso,
};

const directExtract = extractPatternMelodicData(extractParams);
const workerExtract = await extractMelodicDataInWorker(extractParams);

assertFloat32BitIdentical(workerExtract.cleanPCM, directExtract.cleanPCM, 'EXTRACT_MELODIC_DATA cleanPCM');
assert.notEqual(workerExtract.cleanPCM.buffer, sourcePcm.buffer, 'cleanPCM doit posséder son propre ArrayBuffer');
assert.deepStrictEqual(workerExtract.pitchCurve, directExtract.pitchCurve, 'EXTRACT_MELODIC_DATA pitchCurve identique');
assert.deepStrictEqual(workerExtract.anacrusisSteps, directExtract.anacrusisSteps, 'EXTRACT_MELODIC_DATA anacrusisSteps identique');
assert.deepStrictEqual(workerExtract.mainSteps, directExtract.mainSteps, 'EXTRACT_MELODIC_DATA mainSteps identique');
assert.deepStrictEqual(workerExtract.pack, directExtract.pack, 'EXTRACT_MELODIC_DATA pack identique');

// Famille 2 : REANALYZE_ALIGNED_SYLLABLES (avec Set<number> converti proprement)
const allowedSet = buildAllowedPitchClasses('E', 'natural_minor', null);
const directFreshCurve = extractContinuousPitchCurve(workerExtract.cleanPCM, {
  sampleRate,
  totalDurationSec: workerExtract.totalDurationSec,
  trimStartSec: 0,
  trimEndSec: workerExtract.totalDurationSec,
  vocalBounds,
});
const directReanalyzed = reanalyzeNotesOnAlignedSyllables({
  steps: workerExtract.allSteps,
  pitchCurve: directFreshCurve,
  gridStartSec: 0.15,
  stepDurationSec: 60 / 96 / 4,
  tonic: 'E',
  scaleType: 'natural_minor',
  allowedPitchClasses: allowedSet,
  vocalBounds,
  pcm: workerExtract.cleanPCM,
  sampleRate,
});
const workerReanalyzed = await reanalyzeSyllablesInWorker([
  {
    id: 'pat_1',
    steps: workerExtract.allSteps,
    extractCurveFromPcm: true,
    pcm: workerExtract.cleanPCM,
    sampleRate,
    totalDurationSec: workerExtract.totalDurationSec,
    gridStartSec: 0.15,
    stepDurationSec: 60 / 96 / 4,
    tonic: 'E',
    scaleType: 'natural_minor',
    allowedPitchClasses: allowedSet,
    vocalBounds,
  },
]);
assert.deepStrictEqual(workerReanalyzed.items[0].pitchCurve, directFreshCurve, 'REANALYZE pitchCurve identique');
assert.deepStrictEqual(workerReanalyzed.items[0].steps, directReanalyzed, 'REANALYZE steps bit-pour-bit identiques');

// Famille 3 : RENDER_CORRECTED_OR_SHIFTED_VOICE (Melodyne TD-PSOLA + Formant Shift LPC)
const testRegions = [
  { id: 'reg_1', startSec: 0.2, endSec: 2.8, pitchCenterPct: 80, driftCorrectionPct: 70, flattenPct: 35 },
];
const directMelodynePcm = correctAudioPitchWithMelodyne(
  workerExtract.cleanPCM, sampleRate, workerExtract.totalDurationSec, workerExtract.pitchCurve, workerExtract.allSteps, testRegions
);
const directMelodyneCurve = computeCorrectedPitchCurve(
  workerExtract.pitchCurve, workerExtract.allSteps, workerExtract.totalDurationSec, testRegions
);
const workerMelodyne = await renderVoiceDspInWorker({
  mode: 'melodyne',
  pcm: workerExtract.cleanPCM,
  sampleRate,
  totalDurationSec: workerExtract.totalDurationSec,
  rawPitchCurve: workerExtract.pitchCurve,
  allSteps: workerExtract.allSteps,
  regions: testRegions,
});
assertFloat32BitIdentical(workerMelodyne.processedPCM, directMelodynePcm, 'RENDER_VOICE melodyne PCM');
assert.deepStrictEqual(workerMelodyne.correctedCurve, directMelodyneCurve, 'RENDER_VOICE melodyne correctedCurve');

const directFormantShift = shiftVocalPitchFormantPreserved(sourcePcm, sampleRate, 3);
const workerFormantShift = await renderVoiceDspInWorker({
  mode: 'formant_shift',
  pcm: sourcePcm,
  sampleRate,
  shiftSemitones: 3,
});
assertFloat32BitIdentical(workerFormantShift.processedPCM, directFormantShift, 'RENDER_VOICE formant_shift +3 st PCM');

// Famille 4 : ENCODE_WAV (avec rééchantillonnage Hermite 48 kHz)
const directWavBuf = encodePcmToWavArrayBuffer(sourcePcm, sampleRate, 48000);
const workerWav = await encodeWavInWorker({ pcm: sourcePcm, sampleRate, targetSampleRate: 48000 });
assert.equal(Buffer.compare(Buffer.from(directWavBuf), Buffer.from(workerWav.wavArrayBuffer)), 0, 'ENCODE_WAV octet-pour-octet identique');
assert.equal(Buffer.from(workerWav.wavArrayBuffer, 0, 4).toString('ascii'), 'RIFF');
assert.equal(Buffer.from(workerWav.wavArrayBuffer, 8, 4).toString('ascii'), 'WAVE');
console.log('✓ 1. Parité mathématique bit-pour-bit validée sur les 4 familles DSP (EXTRACT, REANALYZE, RENDER_VOICE, ENCODE_WAV).');

// ---------------------------------------------------------------------------
// 2. Non-mutation & Non-détachement du Float32Array source (Node + Mock Browser Worker)
// ---------------------------------------------------------------------------
assert.equal(sourcePcm.byteLength, originalByteLength, 'sourcePcm.byteLength ne doit jamais être détaché (Node fallback)');
assert.equal(Buffer.compare(Buffer.from(sourcePcm.buffer), originalSnapshot), 0, 'sourcePcm ne doit subir aucune mutation');

// Simulation d'un vrai navigateur avec globalThis.Worker vérifiant :
// - postMessage à l'aller reçoit transfer === undefined (0 détachement du buffer React/IndexedDB !)
// - collectResultTransferables au retour transfère bien l'ArrayBuffer fraîchement alloué
const outboundTransfers = [];
class MockBrowserWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(req, transfer) {
    outboundTransfers.push(transfer);
    // Si un ArrayBuffer source avait été passé par erreur dans transfer, cela aurait détaché sourcePcm !
    if (Array.isArray(transfer) && transfer.includes(sourcePcm.buffer)) {
      throw new Error('INTERDICTION VIOLÉE : sourcePcm.buffer passé dans transfer à l’aller !');
    }
    setTimeout(() => {
      const result = runVocalDspTask(req.taskType, req.payload);
      const returnTransfers = collectResultTransferables(req.taskType, result);
      assert.ok(returnTransfers.length === 1 && returnTransfers[0] instanceof ArrayBuffer, 'Le Worker doit transférer le nouveau buffer au retour');
      assert.notEqual(returnTransfers[0], sourcePcm.buffer, 'Le buffer transféré au retour ne doit jamais être sourcePcm.buffer');
      this.onmessage?.({ data: { requestId: req.requestId, taskType: req.taskType, ok: true, result } });
    }, 8);
  }
}

globalThis.Worker = MockBrowserWorker;
try {
  const mockRes = await renderVoiceDspInWorker({ mode: 'formant_shift', pcm: sourcePcm, sampleRate, shiftSemitones: 2 });
  assert.equal(outboundTransfers[0], undefined, 'worker.postMessage à l’aller ne doit passer aucune liste Transferable');
  assert.equal(sourcePcm.byteLength, originalByteLength, 'sourcePcm.byteLength reste > 0 après passage par Worker navigateur');
  assert.equal(Buffer.compare(Buffer.from(sourcePcm.buffer), originalSnapshot), 0, 'sourcePcm reste 100 % intact');
  assert.equal(mockRes.processedPCM.length, sourcePcm.length);

  // ---------------------------------------------------------------------------
  // 3. Annulation Latest-Wins (`dedupeKey`) sur 3 requêtes rapides coup sur coup
  // ---------------------------------------------------------------------------
  const p1 = renderVoiceDspInWorker({ mode: 'formant_shift', pcm: sourcePcm, sampleRate, shiftSemitones: 1 }, { dedupeKey: 'smart_tool_patA' });
  const p2 = renderVoiceDspInWorker({ mode: 'formant_shift', pcm: sourcePcm, sampleRate, shiftSemitones: 2 }, { dedupeKey: 'smart_tool_patA' });
  const p3 = renderVoiceDspInWorker({ mode: 'formant_shift', pcm: sourcePcm, sampleRate, shiftSemitones: 4 }, { dedupeKey: 'smart_tool_patA' });

  const settled = await Promise.allSettled([p1, p2, p3]);
  assert.equal(settled[0].status, 'rejected', 'Requête 1 supplantée doit être rejetée');
  assert.ok(isVocalDspCancelled(settled[0].reason), 'Requête 1 doit porter { cancelled: true }');
  assert.equal(settled[1].status, 'rejected', 'Requête 2 supplantée doit être rejetée');
  assert.ok(isVocalDspCancelled(settled[1].reason), 'Requête 2 doit porter { cancelled: true }');
  assert.equal(settled[2].status, 'fulfilled', 'Seule la 3e requête (Latest-Wins) doit aboutir');

  const expectedShift4 = shiftVocalPitchFormantPreserved(sourcePcm, sampleRate, 4);
  assertFloat32BitIdentical(settled[2].value.processedPCM, expectedShift4, 'Résultat Latest-Wins requête #3');
  assert.equal(getVocalDspBusyCount(), 0, 'Compteur busy revenu à 0 après résolution');
} finally {
  delete globalThis.Worker;
}
console.log('✓ 2 & 3. Non-détachement mémoire (pcm.byteLength > 0) & annulation Latest-Wins (dedupeKey x3) validés.');

// ---------------------------------------------------------------------------
// 4. Découpe par lot asynchrone Slicer (`executeBatchAssignAsync`) & progression X/N
// ---------------------------------------------------------------------------
const baseProj = createDefaultToadaProject();
const pat1 = createDefaultVocalPattern('puxador', 'Appel 1', 1, 96, 'E3');
const pat2 = createDefaultVocalPattern('coro', 'Réponse 1', 1, 96, 'E3');
const projForSlicer = { ...baseProj, bpm: 96, patterns: [pat1, pat2] };

const masterPcm = new Float32Array(sampleRate * 8);
masterPcm.set(sourcePcm, Math.floor(sampleRate * 0.5));
masterPcm.set(sourcePcm, Math.floor(sampleRate * 4.2));
const testSegments = [
  { id: 's1', startSec: 0.5, endSec: 3.5, metricT1Sec: 0.65, measuresCount: 1, hasAnacrusis: false, targetPatternId: pat1.id, role: 'puxador' },
  { id: 's2', startSec: 4.2, endSec: 7.2, metricT1Sec: 4.35, measuresCount: 1, hasAnacrusis: false, targetPatternId: pat2.id, role: 'coro' },
];

const progressSteps = [];
const syncBatch = executeBatchAssign({ project: projForSlicer, masterPCM: masterPcm, sampleRate, segments: testSegments });
const asyncBatch = await executeBatchAssignAsync({
  project: projForSlicer,
  masterPCM: masterPcm,
  sampleRate,
  segments: testSegments,
  onProgress: (cur, tot) => progressSteps.push(`${cur}/${tot}`),
});

assert.deepStrictEqual(progressSteps, ['1/2', '2/2'], 'Progression Analyse X / N reportée dans l’ordre');
assert.equal(asyncBatch.processedCount, 2);
assert.equal(masterPcm.byteLength, sampleRate * 8 * 4, 'masterPCM intact après executeBatchAssignAsync');
assert.deepStrictEqual(asyncBatch.updatedProject.patterns[0].mainSteps, syncBatch.updatedProject.patterns[0].mainSteps);
assert.deepStrictEqual(asyncBatch.updatedProject.patterns[1].mainSteps, syncBatch.updatedProject.patterns[1].mainSteps);
console.log('✓ 4. Assignation Slicer asynchrone (Analyse 1/2 -> 2/2) et mutation atomique validées.\n');

console.log('🎉 TOUS LES TESTS PHASE G (WEB WORKER DSP, ZÉRO DÉTACHEMENT & LATEST-WINS) SONT PASSÉS AVEC SUCCÈS !');
