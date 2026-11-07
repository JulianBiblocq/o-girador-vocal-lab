/**
 * test_cantador_to_sequenciador_contract.mjs
 * Suite de tests E2E & unitaires validant le Contrat d'Intégration Directe Cantador -> Sequenciador (/toada_packs)
 * et l'Addendum Moteur DSP Studio (Fichier .wav 48 kHz unique par motif + Zéro GrainPlayer + 4 Étages DSP).
 */
import assert from 'node:assert/strict';
import './resolve-ts.mjs';

const {
  EXPORT_WAV_SAMPLE_RATE,
  pcmToWavBlob,
  sanitizePatternForFirestore,
} = await import('../src/services/toadaPublishHelpers.ts');

const {
  buildToadaConductorSlots,
  deployToadaCycle,
} = await import('../../o-girador-sequenciador/src/utils/toadaArrangement.ts');
const {
  convertToadaPattern,
} = await import('../../o-girador-sequenciador/src/utils/toadaPatternConverter.ts');
const {
  analyzeVocalFrames,
  extractTransientRegions,
  blendUnvoicedTransientsTimeStretched,
} = await import('../../o-girador-sequenciador/src/audio/vocalDsp/vocalTransientSeparator.ts');
const {
  filterZeroPhaseFundamentalBand,
  detectGlottalEpochs,
} = await import('../../o-girador-sequenciador/src/audio/vocalDsp/tdPsolaEpochDetector.ts');
const {
  synthesizeTimePitchHybridTdPsola,
} = await import('../../o-girador-sequenciador/src/audio/vocalDsp/formantPreservingTimePitchEngine.ts');
const {
  processVocalDspRequest,
} = await import('../../o-girador-sequenciador/src/audio/vocalDsp/vocalDspWorker.ts');
const {
  buildVocalDspCacheKey,
  computeScaledPatternTiming,
  getOrComputeVocalPatternDspSync,
} = await import('../../o-girador-sequenciador/src/audio/vocalDsp/vocalPatternBufferCache.ts');
const {
  resolveVocalPlaybackBuffer,
} = await import('../../o-girador-sequenciador/src/utils/vocal/vocalPlaybackHelper.ts');
const {
  computeTransposedTroupeKey,
  syncCloudToadaTransposition,
} = await import('../../o-girador-sequenciador/src/services/cloudToadas.ts');
const {
  resolveActiveVoiceState,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/resolveActiveVoiceState.ts');
const {
  extractSeparateVoiceStep,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/extractSeparateVoiceStep.ts');
const {
  buildVoiceBlocks,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/voiceBlockHelpers.ts');
const {
  getPatternWords,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/karaokeHelpers.ts');

console.log('=== 1. FICHIER AUDIO .WAV 48 KHZ UNIQUE PAR MOTIF DANS /toada_packs ===');
const sample44k = new Float32Array(44100); // 1.0s à 44.1 kHz
for (let i = 0; i < sample44k.length; i++) sample44k[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / 44100);
const wavBlob48k = pcmToWavBlob(sample44k, 44100);
assert.equal(EXPORT_WAV_SAMPLE_RATE, 48000);
// 44 octets d'entête + 48000 échantillons * 2 octets = 96044 octets
assert.equal(wavBlob48k.size, 44 + 48000 * 2, 'Le WAV exporté par Cantador doit toujours être ré-échantillonné en 48 kHz HD');

const sanitizedPat = sanitizePatternForFirestore(
  {
    id: 'pat_1',
    name: 'Puxador 1',
    role: 'puxador',
    bpm: 85,
    measuresCount: 2,
    hasAnacrusis: true,
    hasTailBeat: true,
    referencePitch: 'Bb3',
    anacrusisSteps: [],
    mainSteps: [],
    variants: {
      'spd100_pit+0': { key: 'spd100_pit+0', speedRatio: 1, pitchShiftSemitones: 0, trimStartSec: 0, trimEndSec: 3.2, t1OffsetSec: 1.4 },
    },
    activeVariantKey: 'spd100_pit+0',
  },
  'https://storage.googleapis.com/o-girador/pat_1.wav',
  3.2,
  1.4,
  -1.4,
  2
);
assert.equal(sanitizedPat.audioUrl, 'https://storage.googleapis.com/o-girador/pat_1.wav');
assert.equal(sanitizedPat.recordedBpm, 85);
assert.equal(sanitizedPat.sampleRate, 48000);
assert.equal(sanitizedPat.variants, undefined, 'Aucune variante multiple ne doit être envoyée dans /toada_packs');
assert.equal(sanitizedPat.speedVariants, undefined, 'Aucun speedVariants multiple ne doit être envoyé dans /toada_packs');
console.log('✓ 1. Fichier .wav 48 kHz unique par pattern validé.');

console.log('\n=== 2. MOTEUR DSP STUDIO ÉTAGES 1, 2, 3 & 4 (ZÉRO GRAINPLAYER) ===');
// Synthèse d'un motif vocal synthétique 48 kHz contenant :
// - Une consonne plosive/fricative non-voisée [0.10s .. 0.16s] ("t/s")
// - Une voyelle voisée à F0 = 200 Hz (T0 = 240 éch @ 48 kHz) avec formants F1=700 Hz, F2=1200 Hz [0.16s .. 0.80s]
const sr = 48000;
const durSec = 1.0;
const nSamples = sr * durSec;
const testVocalPcm = new Float32Array(nSamples);
const consStart = Math.round(0.10 * sr);
const consEnd = Math.round(0.16 * sr);
for (let i = consStart; i < consEnd; i++) {
  // Bruit haute fréquence déterministe simulant une consonne percussive/sifflante "t/s"
  testVocalPcm[i] = 0.35 * ((i % 2 === 0 ? 1 : -1) * Math.sin(i * 1.73));
}
const vowelStart = consEnd;
const vowelEnd = Math.round(0.85 * sr);
const f0 = 200; // Hz -> T0 = 240 samples
for (let i = vowelStart; i < vowelEnd; i++) {
  const t = (i - vowelStart) / sr;
  const glottalPhase = (t * f0) % 1;
  // Excitation glottique riche en harmoniques + résonance formantique F1 (800 Hz = 4*F0) & F2 (1400 Hz = 7*F0)
  const pulse = Math.exp(-glottalPhase * 6) * (
    Math.sin(2 * Math.PI * f0 * t) +
    0.7 * Math.sin(2 * Math.PI * 800 * t) +
    0.4 * Math.sin(2 * Math.PI * 1400 * t)
  );
  testVocalPcm[i] = 0.45 * pulse;
}

// Étage 1 : Détection Voisé / Non-Voisé par trames de 10 ms
const frames = analyzeVocalFrames(testVocalPcm, sr, 10);
assert.ok(frames.length === 100, `Attendu 100 trames de 10 ms pour 1.0s, obtenu ${frames.length}`);
const consonantFrame = frames[12]; // 120 ms (au cœur de la consonne)
const vowelFrame = frames[40];     // 400 ms (au cœur de la voyelle)
assert.equal(consonantFrame.isUnvoicedOrTransient, true, 'La consonne [100..160 ms] doit être classée Non-Voisée / Transitoire');
assert.equal(vowelFrame.isUnvoicedOrTransient, false, 'Le cœur de voyelle [400 ms] doit être classé Voisé');
assert.ok(Math.abs(vowelFrame.estimatedPeriodSamples - 240) <= 4, `Période T0 estimée attendue ~240 éch (200 Hz), obtenu ${vowelFrame.estimatedPeriodSamples}`);

// Étage 2 : Extraction des Époques Glottiques (GCI) à Phase Nulle (80-900 Hz)
const epochAnalysis = detectGlottalEpochs(testVocalPcm, sr, frames);
assert.ok(epochAnalysis.epochs.length > 100, 'Doit extraire les époques glottiques sur toute la voyelle');

// Étage 3 : Synthèse Conjointe Time-Stretch (alpha = 85 / 100 = 0.85) + Pitch-Shift (+3 demi-tons)
const recordedBpm = 85;
const liveBpm = 100;
const alpha = recordedBpm / liveBpm; // 0.85
const shiftSemitones = 3; // +3 demi-tons (entre ±1 et ±4 demi-tons)
const workerRes = processVocalDspRequest({
  requestId: 'req_1',
  cacheKey: 'pat_1_100_3',
  channels: [testVocalPcm],
  sampleRate: sr,
  alpha,
  semitones: shiftSemitones,
});
const stretchedPcm = workerRes.channels[0];
assert.equal(stretchedPcm.length, Math.round(nSamples * alpha), 'La longueur du buffer synthétisé doit valoir exactement round(N * alpha)');

// Vérification que la consonne est positionnée à t' = t * alpha et copiée à l'échelle 1:1 au centre (hors fondu 4ms)
const transientRegions = extractTransientRegions(frames, nSamples, sr, alpha);
const mainConsReg = transientRegions.find((r) => r.startSample <= consStart && r.endSample >= consEnd);
assert.ok(mainConsReg, 'Région transitoire de la consonne détectée');
const midOffset = Math.floor(mainConsReg.lengthSamples / 2);
assert.ok(
  Math.abs(stretchedPcm[mainConsReg.targetStartSample + midOffset] - testVocalPcm[mainConsReg.startSample + midOffset]) < 1e-5,
  'Au cœur de la consonne (hors fondu de 4 ms), les échantillons doivent être copiés strictement en 1:1 (ratio durée 1.0, ratio hauteur 1.0)'
);

// Étage 4 : Cache par motif `${patternId}_${liveBpm}_${transpositionSemitones}` & mise à l'échelle exacte de t1OffsetSec
const cacheKey = buildVocalDspCacheKey(1001, 100, 3);
assert.equal(cacheKey, '1001_100_3');

const slotMeasureT1Time = 10.0;
const scaledTiming = computeScaledPatternTiming(
  { recordedBpm: 85, t1OffsetSec: 1.60, trimStartSec: 0.20, trimEndSec: 3.40 },
  100,
  slotMeasureT1Time
);
assert.ok(Math.abs(scaledTiming.alpha - 0.85) < 1e-6);
assert.ok(Math.abs(scaledTiming.scaledT1OffsetSec - 1.60 * 0.85) < 1e-6);
assert.ok(Math.abs(scaledTiming.scaledTrimStartSec - 0.20 * 0.85) < 1e-6);
assert.ok(Math.abs(scaledTiming.scaledTrimEndSec - 3.40 * 0.85) < 1e-6);
const expectedWhen = 10.0 + (0.20 * 0.85 - 1.60 * 0.85); // 8.81s
assert.ok(Math.abs(scaledTiming.when - expectedWhen) < 1e-6, `when attendu = ${expectedWhen}, obtenu ${scaledTiming.when}`);

// Vérification de resolveVocalPlaybackBuffer : renvoie toujours playbackRate = 1.0 et detuneCents = 0
const mockAudioBuffer = {
  sampleRate: sr,
  length: testVocalPcm.length,
  duration: testVocalPcm.length / sr,
  numberOfChannels: 1,
  getChannelData: () => testVocalPcm,
};
const resolvedPlayback = resolveVocalPlaybackBuffer(
  {
    id: 1001,
    packTranspositionSemitones: 2,
    vocalClip: {
      recordedBpm: 85,
      t1OffsetSec: 0.40,
      trimStartSec: 0.05,
      trimEndSec: 0.95,
      packTranspositionSemitones: 2,
    },
  },
  { id: 10, tuning: 0 },
  100, // liveBpm = 100
  85,  // recordedBpm = 85
  mockAudioBuffer,
  {},
  4    // transpositionSemitones = +4 (soit +2 demi-tons par rapport au pack à +2)
);
assert.equal(resolvedPlayback.playbackRate, 1.0, 'Le lecteur natif doit TOUJOURS tourner à playbackRate = 1.0 (Zéro GrainPlayer)');
assert.equal(resolvedPlayback.detuneCents, 0, 'Le lecteur natif doit TOUJOURS tourner à detuneCents = 0');
assert.ok(Math.abs(resolvedPlayback.scaledT1OffsetSec - 0.40 * 0.85) < 1e-6);
assert.ok(Math.abs(resolvedPlayback.scaledTrimStartSec - 0.05 * 0.85) < 1e-6);
assert.ok(Math.abs(resolvedPlayback.scaledTrimEndSec - Math.min(resolvedPlayback.buffer.duration, 0.95 * 0.85)) < 1e-6);
console.log('✓ 2. Moteur DSP Studio 4 Étages (Consonnes 1:1, Époques GCI, TD-PSOLA + Formants LPC, Cache & Scaling) validé.');

console.log('\n=== 3. FRISE CONDUCTEUR (SLOTS), CHANT SIMULTANÉ, PAUSE DU BATUQUE & RODA ===');
const rawPatterns = [
  { id: 'pat_pux_1', name: 'Puxador 1', role: 'puxador', measuresCount: 2 },
  { id: 'pat_coro_1', name: 'Coro 1', role: 'coro', measuresCount: 2 },
];
const patIdMap = new Map([['pat_pux_1', 1001], ['pat_coro_1', 2001]]);
const rawSlots = [
  { id: 's1', puxadorPatternId: 'pat_pux_1', coroPatternId: null, advanceMeasures: 2 },
  { id: 's2', puxadorPatternId: null, coroPatternId: 'pat_coro_1', advanceMeasures: 2 },
  { id: 's3', puxadorPatternId: 'pat_pux_1', coroPatternId: 'pat_coro_1', advanceMeasures: 2 },
  { id: 's4', puxadorPatternId: null, coroPatternId: null, advanceMeasures: 2, isSilenceSlot: true },
];
const conductorSlots = buildToadaConductorSlots(rawSlots, rawPatterns, patIdMap);
const deployed = deployToadaCycle({
  totalMeasures: 8, bpm: 88, timeSig: '4/4', toadaConductorSlots: conductorSlots,
  tracks: [
    { id: 10, instrumentIdx: 10, patterns: [{ id: 1001, name: 'Puxador 1', steps: 32, activeSteps: Array(32).fill('P'), measureAssignments: Array(8).fill(false) }] },
    { id: 11, instrumentIdx: 11, patterns: [{ id: 2001, name: 'Coro 1', steps: 32, activeSteps: Array(32).fill('C'), measureAssignments: Array(8).fill(false) }] },
  ],
  measureBpms: Array(8).fill(88), measureTimeSigs: Array(8).fill('4/4'), measureVols: Array(8).fill(100),
  measureBpmTransitions: Array(8).fill('immediate'), measureVolTransitions: Array(8).fill('immediate'), measureSignals: Array(8).fill(null),
}, 0);

assert.deepEqual(deployed.tracks[0].patterns[0].measureAssignments, [true, true, false, false, true, true, false, false]);
assert.deepEqual(deployed.tracks[1].patterns[0].measureAssignments, [false, false, true, true, true, true, false, false]);
const pauseVoiceState = resolveActiveVoiceState({ step: 0, measure: 6, maxTicks: 96, ratio: 0 }, deployed.tracks, 8);
assert.equal(pauseVoiceState.activeRole, 'baque');

// Mode "🥁 Rythme seul" (ignoreMelodyPitch: true)
const rhythmOnlyPattern = convertToadaPattern(
  {
    id: 'pat_rhythm_only', name: 'Vovó falou (Rythme seul)', measuresCount: 1, hasAnacrusis: false, ignoreMelodyPitch: true,
    mainSteps: [
      { stepIndex: 0, active: true, isTie: false, note: 'G3', syllable: 'Vo-' },
      { stepIndex: 1, active: true, isTie: true,  note: 'G3', syllable: '───' },
      { stepIndex: 2, active: true, isTie: false, note: 'A3', syllable: 'vó ' },
      ...Array.from({ length: 13 }, (_, i) => ({ stepIndex: i + 3, active: false, isTie: false, note: '', syllable: '' })),
    ],
  },
  'puxador', 5001, 85, 4
);
assert.equal(rhythmOnlyPattern.notes[0], '');
assert.equal(rhythmOnlyPattern.notes[1], '───');
const karaokeWords = getPatternWords(rhythmOnlyPattern, false, 16);
assert.equal(karaokeWords[0].syllables[0].note, undefined);
assert.equal(computeTransposedTroupeKey('Sib Majeur', 2), 'Do Majeur');
await syncCloudToadaTransposition(undefined, 4, 'Sib Majeur');
console.log('✓ 3. Frise Conducteur, Pause du Batuque (🥁 Baque) et Roda (ignoreMelodyPitch) validés.');

console.log('\n🎉 CONTRAT CANTADOR -> SEQUENCIADOR & MOTEUR DSP STUDIO (ZÉRO GRAINPLAYER) VALIDÉS À 100 % !');
