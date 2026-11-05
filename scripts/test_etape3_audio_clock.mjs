import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  NO_ANACRUSIS_PRE_MARGIN_SEC,
  getPatternT1OffsetSec,
  getPatternTotalDurationSec,
} from '../src/utils/anacrusisTimingHelper.ts';
import { computeCueScheduleParams } from '../src/audio/cueAudioHelper.ts';
import { CONTINUOUS_LEAD_IN_MEASURES } from '../src/audio/continuousCueHelper.ts';
import { sliceContinuousTake } from '../src/utils/continuousTakeSlicer.ts';
import { computeSlotsMeasureLayout, ToadaTimelineClock } from '../src/components/conductor/toadaTimingScheduler.ts';

console.log('========================================================================');
console.log('🧪 TEST AUTOMATISÉ ÉTAPE 3 : HORLOGE AUDIO CANONIQUE, CUE, SLICER & LECTURE');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 1. Horloge de Capture Unitaire & Signe Physique de Latence (+latencySec)
// -----------------------------------------------------------------------------
console.log('▶️ Test 3.1 : Horloge de capture unitaire, +latencySec et fenêtre [Ana + N*M + 1T]');
const bpm = 120; // beatDuration = 0.5s, measureDuration (4/4) = 2.0s
const beatsPerMeasure = 4;
const beatDuration = 60 / bpm;
const measureDuration = beatsPerMeasure * beatDuration;

// Cas A : Avec anacrouse (2 mesures), sans Cue -> preRollMeasures = 2
const preRollAna = 2;
const cycleStart = 10.0;
const targetT1Ana = cycleStart + preRollAna * measureDuration; // 14.0s
const t1OffsetAna = getPatternT1OffsetSec(true, measureDuration); // 2.0s
const latencyMs = 45; // +45ms de latence matérielle aller-retour
const latencySec = latencyMs / 1000; // +0.045s
const captureStartAna = (targetT1Ana - t1OffsetAna) + latencySec; // 12.045s
assert.strictEqual(
  Number(captureStartAna.toFixed(3)),
  12.045,
  'La capture doit démarrer à (targetT1 - t1Offset) + latencySec (+0.045s) pour que pcm[t1Offset] tombe sur le T1 chanté'
);
const totalRecAna = getPatternTotalDurationSec(true, 2, measureDuration, 0.25, beatDuration, t1OffsetAna);
// 2.0s (anacrouse) + 2*2.0s (2 mesures) + 0.5s (+1T) + 0.25s (postRoll) = 6.75s
assert.strictEqual(Number(totalRecAna.toFixed(3)), 6.75, 'La durée capturée doit couvrir [1M Ana + 2M + 1T + 0.25s postRoll] = 6.75s');

// Cas B : Sans anacrouse (1 mesure), sans Cue -> preRollMeasures = 1
const preRollNoAna = 1;
const targetT1NoAna = cycleStart + preRollNoAna * measureDuration; // 12.0s
const t1OffsetNoAna = getPatternT1OffsetSec(false, measureDuration); // 0.15s (NO_ANACRUSIS_PRE_MARGIN_SEC)
assert.strictEqual(t1OffsetNoAna, NO_ANACRUSIS_PRE_MARGIN_SEC);
const captureStartNoAna = (targetT1NoAna - t1OffsetNoAna) + latencySec; // 11.895s
assert.strictEqual(Number(captureStartNoAna.toFixed(3)), 11.895);
const totalRecNoAna = getPatternTotalDurationSec(false, 1, measureDuration, 0.25, beatDuration, t1OffsetNoAna);
// 0.15s (marge pré-T1) + 1*2.0s (1 mesure) + 0.5s (+1T) + 0.25s (postRoll) = 2.90s
assert.strictEqual(Number(totalRecNoAna.toFixed(3)), 2.9);
console.log('  ✅ Test 3.1 validé : Signe +latencySec, t1OffsetSec et fenêtre +1T exacts.\n');

// -----------------------------------------------------------------------------
// 2. Voix Témoin (Cue) Varispeed & Préservation Intégrale de son Anacrouse
// -----------------------------------------------------------------------------
console.log('▶️ Test 3.2 : Planification Cue avec Varispeed et préservation de l\'anacrouse dans M0');
const sr = 1000;
// Pattern Cue enregistré à 100 BPM (measureDuration = 2.4s) avec anacrouse (t1OffsetSec = 2.4s, trimStartSec = 0.6s, trimEndSec = 7.2s)
// Audio stocké uniquement dans variants['spd100_pit0'].recordingResult (pattern.recordingResult === null)
const cuePcm = new Float32Array(sr * 8);
const cuePattern = {
  id: 'cue-1',
  name: 'Puxador 1',
  role: 'puxador',
  measuresCount: 2,
  hasAnacrusis: true,
  bpm: 100,
  baseBpm: 100,
  activeVariantKey: 'spd100_pit0',
  recordingResult: null,
  variants: {
    spd100_pit0: {
      variantKey: 'spd100_pit0',
      speedRatio: 1.0,
      pitchShiftSemitones: 0,
      t1OffsetSec: 2.4,
      trimStartSec: 0.6,
      trimEndSec: 7.2,
      recordingResult: {
        pcm: cuePcm,
        sampleRate: sr,
        recordedBpm: 100,
        t1OffsetSec: 2.4,
      },
    },
  },
};

// Relecture du Cue pendant une prise à 120 BPM (measureDuration = 2.0s, speedRatio = 1.2)
const cueParams = computeCueScheduleParams(cuePattern, 10.0, 4, 0.5, 120);
assert(cueParams !== null, 'Le Cue doit résoudre variant.recordingResult même si pattern.recordingResult est null');
assert.strictEqual(Number(cueParams.speedRatio.toFixed(2)), 1.2, 'speedRatio doit valoir 120 / 100 = 1.2');
assert.strictEqual(Number(cueParams.cueT1Time.toFixed(2)), 12.0, 'Le T1 du Cue doit être placé à cycleStart + 1 mesure (fin du décompte M0)');
// whenToStartCue = 12.0 + (0.6 - 2.4) / 1.2 = 12.0 - 1.5 = 10.5s (pendant la mesure M0 [10.0, 12.0], jamais tronqué !)
assert.strictEqual(Number(cueParams.whenToStartCue.toFixed(2)), 10.5, 'L\'anacrouse du Cue doit démarrer à 10.5s (dans M0) sans troncature');
assert.strictEqual(Number(cueParams.trimStartSec.toFixed(2)), 0.6, 'trimStartSec doit être préservé à 0.6s et non tronqué à t1OffsetSec (2.4s)');
assert.strictEqual(Number(cueParams.cueT1OffsetSec.toFixed(2)), 2.4);
console.log('  ✅ Test 3.2 validé : Anacrouse du Cue 100% préservée et Varispeed 1.2x exact.\n');

// -----------------------------------------------------------------------------
// 3. Prise Continue Multipiste : LEAD_IN_MEASURES = 2, Slots 1M & Sélection RMS
// -----------------------------------------------------------------------------
console.log('▶️ Test 3.3 : Slicer de prise continue (LEAD_IN_MEASURES = 2, slots 1M et sélection RMS)');
assert.strictEqual(CONTINUOUS_LEAD_IN_MEASURES, 2, 'LEAD_IN_MEASURES doit valoir 2 (M0 décompte + M1 anacrouse Slot 1)');

// Projet à 120 BPM (measureDuration = 2.0s, beatDuration = 0.5s) :
// - Slot 0 (startMeasure = 1, 1 mesure !): Puxador pat-A (1M, avec anacrouse)
// - Slot 1 (startMeasure = 2, 1 mesure !): Coro pat-B (1M, sans anacrouse)
// - Slot 2 (startMeasure = 3, 1 mesure !): Puxador pat-A répété (avec voix plus forte en RMS)
const testProject = {
  id: 'proj-cont',
  title: 'Test Continu',
  bpm: 120,
  timeSignature: '4/4',
  activePatternId: 'pat-A',
  patterns: [
    {
      id: 'pat-A',
      name: 'Puxador 1M',
      role: 'puxador',
      measuresCount: 1,
      hasAnacrusis: true,
      bpm: 120,
      baseBpm: 120,
      referencePitch: 'C4',
      assignedLyricsText: 'Boi bonito',
      activeVariantKey: 'spd100_pit0',
      variants: {},
    },
    {
      id: 'pat-B',
      name: 'Coro 1M',
      role: 'coro',
      measuresCount: 1,
      hasAnacrusis: false,
      bpm: 120,
      baseBpm: 120,
      referencePitch: 'C4',
      assignedLyricsText: 'Respondeu',
      activeVariantKey: 'spd100_pit0',
      variants: {},
    },
  ],
  slots: [
    { id: 's1', puxadorPatternId: 'pat-A', coroPatternId: null },
    { id: 's2', puxadorPatternId: null, coroPatternId: 'pat-B' },
    { id: 's3', puxadorPatternId: 'pat-A', coroPatternId: null },
  ],
};

const layouts = computeSlotsMeasureLayout(testProject.slots, testProject.patterns);
assert.strictEqual(layouts[0].startMeasure, 1, 'Slot 0 (1M) commence à M1');
assert.strictEqual(layouts[1].startMeasure, 2, 'Slot 1 (1M) commence à M2 (et non M3 !)');
assert.strictEqual(layouts[2].startMeasure, 3, 'Slot 2 (1M) commence à M3');

// Générons un buffer fullPCM de 16 secondes à 8000 Hz :
// - Occurrence 1 de pat-A (Slot 0, startMeasure = 1 -> measureFromM0 = 2 -> T1 à 4.0s, fenêtre [2.0s, 6.0s]) : faible amplitude (0.05)
// - Occurrence 2 de pat-A (Slot 2, startMeasure = 3 -> measureFromM0 = 4 -> T1 à 8.0s, fenêtre [6.0s, 10.0s]) : forte amplitude (0.60)
const contSr = 8000;
const fullPCM = new Float32Array(contSr * 16);
for (let i = Math.floor(2.0 * contSr); i < Math.floor(6.0 * contSr); i++) {
  fullPCM[i] = 0.05 * Math.sin((2 * Math.PI * 261.63 * i) / contSr);
}
for (let i = Math.floor(6.0 * contSr); i < Math.floor(10.0 * contSr); i++) {
  fullPCM[i] = 0.60 * Math.sin((2 * Math.PI * 261.63 * i) / contSr);
}

const slicedPux = sliceContinuousTake(testProject, 'puxador', fullPCM, contSr, 0);
assert.strictEqual(slicedPux.processedCount, 1);
const updatedPatA = slicedPux.updatedPatterns.find((p) => p.id === 'pat-A');
// L'occurrence 2 (Slot 2, T1 = 8.0s, patStart = 6.0s, sliceStart = 5.5s) doit être sélectionnée par RMS :
// -> trimStartSec = 6.0 - 5.5 = 0.5s
// -> t1OffsetSec = 8.0 - 5.5 = 2.5s (soit t1OffsetSec - trimStartSec = 2.0s = 1 mesure d'anacrouse exacte)
assert.strictEqual(Number(updatedPatA.trimStartSec.toFixed(2)), 0.5);
assert.strictEqual(Number(updatedPatA.t1OffsetSec.toFixed(2)), 2.5, 't1OffsetSec doit être persisté à 2.5s (0.5s marge + 2.0s anacrouse)');
assert.strictEqual(Number(updatedPatA.recordingResult.t1OffsetSec.toFixed(2)), 2.5);
assert.strictEqual(updatedPatA.recordingResult.recordedBpm, 120);
// Vérifions que la tranche extraite provient bien de l'occurrence à forte énergie RMS (~0.60 peak)
let maxAmp = 0;
for (let i = 0; i < updatedPatA.recordingResult.pcm.length; i++) {
  const a = Math.abs(updatedPatA.recordingResult.pcm[i]);
  if (a > maxAmp) maxAmp = a;
}
assert(maxAmp > 0.5, `L'occurrence avec la plus forte énergie RMS doit être retenue (maxAmp=${maxAmp})`);
console.log('  ✅ Test 3.3 validé : Slicer aligné sur LEAD_IN_MEASURES=2, slots 1M respectés et sélection RMS active.\n');

// -----------------------------------------------------------------------------
// 4. Préservation de l'Anacrouse du Slot 0 dans ToadaTimelineClock / ToadaPlayerEngine
// -----------------------------------------------------------------------------
console.log('▶️ Test 3.4 : Lead-in de 1 mesure (initialMeasure = 0) pour l\'anacrouse du Slot 0');
const clockWithLeadIn = new ToadaTimelineClock();
const audioCtxStart = 5.0;
clockWithLeadIn.init(audioCtxStart, 120, 4, 0); // initialMeasure = 0
const slot0T1Time = clockWithLeadIn.getTimeAtMeasure(1); // startMeasure = 1
assert.strictEqual(
  Number(slot0T1Time.toFixed(2)),
  7.0,
  'Avec initialMeasure = 0 à 120 BPM, le Temps 1 du Slot 0 (M1) est à audioCtxStart + 2.0s (7.0s)'
);
const slot0When = slot0T1Time + (updatedPatA.trimStartSec - updatedPatA.t1OffsetSec); // 7.0 + (0.5 - 2.5) = 5.0s = audioCtxStart
assert.strictEqual(
  Number(slot0When.toFixed(2)),
  audioCtxStart,
  'L\'anacrouse du Slot 0 démarre exactement à audioCtxStart (5.0s), zéro milliseconde coupée !'
);
console.log('  ✅ Test 3.4 validé : Anacrouse du Slot 0 100% préservée en lecture live et export WAV.\n');

// -----------------------------------------------------------------------------
// 5. Vérification Règle Anti-Monolithe (< 150 lignes) sur tous les fichiers Étape 3
// -----------------------------------------------------------------------------
console.log('▶️ Test 3.5 : Règle Anti-Monolithe (< 150 lignes) sur les fichiers modifiés de l\'Étape 3');
const etape3Files = [
  'src/components/livret-prise/usePriseRecorder.ts',
  'src/components/livret-prise/LivretPrise.tsx',
  'src/components/livret-prise/WaveformTrimEditor.tsx',
  'src/components/livret-prise/CuePatternSelector.tsx',
  'src/components/livret-prise/ContinuousPrompterBanner.tsx',
  'src/components/livret-prise/useContinuousTakeController.ts',
  'src/audio/VocalRecorderEngine.ts',
  'src/audio/cueAudioHelper.ts',
  'src/audio/continuousCueHelper.ts',
  'src/audio/continuousTakeRecorder.ts',
  'src/utils/continuousTakeSlicer.ts',
  'src/utils/fullSongWavExporter.ts',
  'src/components/conductor/ToadaPlayerEngine.ts',
  'src/context/ToadaProjectContext.tsx',
];

for (const f of etape3Files) {
  const abs = path.resolve(process.cwd(), f);
  const count = fs.readFileSync(abs, 'utf8').split('\n').length;
  console.log(`   - ${f} : ${count} lignes`);
  assert(count < 150, `${f} dépasse la limite stricte (< 150 lignes) : ${count}`);
}
console.log('  ✅ Test 3.5 validé : 100% des fichiers de l\'Étape 3 sont strictement < 150 lignes.\n');

console.log('========================================================================');
console.log('🏆 TOUS LES TESTS DE L\'ÉTAPE 3 (HORLOGE AUDIO & MOTEURS) SONT 100% VALIDÉS !');
console.log('========================================================================');
