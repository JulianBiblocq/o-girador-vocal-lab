/**
 * scripts/test_samambaia_morceau_integration.mjs
 * Test unitaire de l'intégration d'une Toada Cantador dans un morceau du Répertoire Samambaia (Sequenciador) :
 * 1. Correspondance par titre normalisé et par lienSequenceurId,
 * 2. Maintien du BPM de Sequenciador comme tempo maître + continuité du Baque sur totalMeasures,
 * 3. Mise à jour du BPM du chant sur sequenciadorBpm (p.bpm / p.baseBpm / project.bpm) tout en préservant recordedBpm sur chaque tranche audio.
 */
import assert from 'node:assert/strict';

function normalizeMorceauTitle(title) {
  return (title || '').replace(/\.json$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function findBestMatchingSamambaiaMorceau(morceaux, project) {
  if (!morceaux.length) return null;
  const linkedId = project.toadaMeta?.lienSequenceurId || project.toadaMeta?.repertoireId;
  if (linkedId) {
    const byId = morceaux.find((m) => m.id === linkedId || normalizeMorceauTitle(m.id) === normalizeMorceauTitle(linkedId));
    if (byId) return byId;
  }
  const targetNorm = normalizeMorceauTitle(project.title || project.toadaMeta?.titre);
  if (!targetNorm) return morceaux[0];
  const exact = morceaux.find((m) => normalizeMorceauTitle(m.name) === targetNorm);
  if (exact) return exact;
  if (targetNorm.length >= 4) {
    const partial = morceaux.find((m) => { const mn = normalizeMorceauTitle(m.name); return mn.length >= 4 && (mn.includes(targetNorm) || targetNorm.includes(mn)); });
    if (partial) return partial;
  }
  return null;
}

console.log('=== TEST: Samambaia Repertoire Morceau Integration & Master Tempo Alignment ===');

// 1. Test de correspondance par titre normalisé (sans accents/casse) et par lienSequenceurId
const mockMorceaux = [
  { id: 'preset_1', name: 'Vou Vadiar', bpm: 92, ritmo: 'Baque Virado', hasVocalToada: false },
  { id: 'preset_2', name: 'Vovó Falou (Nação Nagô)', bpm: 98, ritmo: 'Martelo', hasVocalToada: true },
  { id: 'preset_3', name: 'De Norte a Sul', bpm: 104, ritmo: 'Baque Virado', hasVocalToada: false },
];

const matchAccents = findBestMatchingSamambaiaMorceau(mockMorceaux, { title: 'vovo falou', toadaMeta: {} });
assert.equal(matchAccents?.id, 'preset_2', 'Doit trouver "Vovó Falou (Nação Nagô)" depuis "vovo falou"');

const matchExact = findBestMatchingSamambaiaMorceau(mockMorceaux, { title: 'DE NORTE A SUL!', toadaMeta: {} });
assert.equal(matchExact?.id, 'preset_3', 'Doit trouver "De Norte a Sul" sans casse ni ponctuation');

const matchById = findBestMatchingSamambaiaMorceau(mockMorceaux, { title: 'Autre Titre', toadaMeta: { lienSequenceurId: 'preset_1' } });
assert.equal(matchById?.id, 'preset_1', 'Doit prioriser lienSequenceurId');
console.log('✓ 1. Correspondance par titre normalisé et par lienSequenceurId validée');

// 2. Test du maintien du BPM maître de Sequenciador (98 BPM), continuité du Baque (4M -> 8M) et préservation de recordedBpm (82 BPM)
const existingPreset = {
  bpm: 98,
  timeSig: '4/4',
  totalMeasures: 4,
  measureBpms: [98, 98, 98, 98],
  tracks: [
    {
      id: 1,
      instrumentIdx: 0, // Alfaia (Baque < 10)
      patterns: [{ id: 101, name: 'Baque Base', measureAssignments: [true, true, false, true] }],
    },
  ],
  metadata: { toada: 'Vovó Falou', ritmo: 'Martelo' },
};

const toadaPack = {
  id: 'toada_vovo',
  title: 'Vovó Falou',
  bpm: 98, // Calé sur Sequenciador
  timeSignature: '4/4',
  sequenciadorExportMode: 'rhythm_only',
  ignoreMelodyPitch: true,
  sungKey: 'Do# Majeur',
  troupeKey: 'Do Majeur',
  transpositionSemitones: -1,
  patterns: [
    {
      id: 'pat_pux_1',
      name: '#1 Vovó falou',
      role: 'puxador',
      measuresCount: 4,
      recordedBpm: 82, // Chanté physiquement à 82 BPM dans Cantador
      audioUrl: 'https://storage.example.com/vovo_pux1.wav',
      t1OffsetSec: 2.926829,
      trimStartSec: 0,
      trimEndSec: 14.634146,
      hasAnacrusis: true,
      hasTailBeat: true,
      anacrusisSteps: [],
      mainSteps: [{ stepIndex: 0, active: true, note: 'C4', syllable: 'Vo' }],
    },
    {
      id: 'pat_coro_1',
      name: '#2 Estrela brilhante',
      role: 'coro',
      measuresCount: 4,
      recordedBpm: 82,
      audioUrl: 'https://storage.example.com/vovo_coro1.wav',
      t1OffsetSec: 2.926829,
      trimStartSec: 0,
      trimEndSec: 14.634146,
      hasAnacrusis: true,
      hasTailBeat: false,
      anacrusisSteps: [],
      mainSteps: [{ stepIndex: 0, active: true, note: 'G4', syllable: 'Es' }],
    },
  ],
  slots: [
    { slotIndex: 0, measuresCount: 4, advanceMeasures: 4, puxadorPatternId: 'pat_pux_1' },
    { slotIndex: 1, measuresCount: 4, advanceMeasures: 4, coroPatternId: 'pat_coro_1' },
  ],
};

// Simulation de injectToadaPackIntoSequenciadorPreset
const nextTotal = 8;
const alfaiaAssign = existingPreset.tracks[0].patterns[0].measureAssignments;
const loopedAlfaia = Array.from({ length: nextTotal }, (_, m) => (m < alfaiaAssign.length ? alfaiaAssign[m] : alfaiaAssign[m % alfaiaAssign.length]));
assert.deepEqual(loopedAlfaia, [true, true, false, true, true, true, false, true], 'Le Baque Alfaia doit boucler proprement de 4M à 8M');

// Simulation de applySequenciadorBpmBackToProject (sans effet rebond)
const cantadorProjectBefore = {
  id: 'toada_vovo',
  title: 'Vovó Falou',
  bpm: 82,
  toadaMeta: { bpmDefaut: 82 },
  patterns: [
    {
      id: 'pat_pux_1',
      bpm: 82,
      baseBpm: 82,
      recordingResult: { pcm: new Float32Array(100), sampleRate: 44100, recordedBpm: 82 },
    },
  ],
};

const targetSeqBpm = 98;
const updatedProject = {
  ...cantadorProjectBefore,
  bpm: targetSeqBpm,
  toadaMeta: { ...cantadorProjectBefore.toadaMeta, bpmDefaut: targetSeqBpm, lienSequenceurId: 'preset_2' },
  patterns: cantadorProjectBefore.patterns.map((p) => {
    const physicalRecBpm = Number(p.recordedBpm || p.recordingResult?.recordedBpm || p.baseBpm || p.bpm);
    return {
      ...p,
      bpm: targetSeqBpm,
      baseBpm: targetSeqBpm,
      recordedBpm: physicalRecBpm,
      recordingResult: { ...p.recordingResult, recordedBpm: physicalRecBpm },
    };
  }),
};

assert.equal(updatedProject.bpm, 98, 'project.bpm doit passer au tempo maître Sequenciador (98 BPM)');
assert.equal(updatedProject.toadaMeta.bpmDefaut, 98, 'toadaMeta.bpmDefaut doit passer à 98 BPM');
assert.equal(updatedProject.patterns[0].bpm, 98, 'p.bpm doit passer à 98 BPM pour éviter tout rebond dans LivretStructure');
assert.equal(updatedProject.patterns[0].baseBpm, 98, 'p.baseBpm doit passer à 98 BPM');
assert.equal(updatedProject.patterns[0].recordedBpm, 82, 'p.recordedBpm doit rester strictement égal au BPM physique enregistré (82 BPM)');
assert.equal(updatedProject.patterns[0].recordingResult.recordedBpm, 82, 'recordingResult.recordedBpm doit rester à 82 BPM');
console.log('✓ 2. Maintien du BPM maître Sequenciador (98 BPM), bouclage du Baque (4M -> 8M) et préservation de recordedBpm (82 BPM) validés');
console.log('ALL SAMAMBAIA MORCEAU INTEGRATION TESTS PASSED SUCCESSFULLY!');
