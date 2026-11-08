/**
 * sequenciadorPresetBuilder.ts
 * Construction et injection directe d'un pack Toada Cantador dans un Preset Sequenciador (Répertoire Samambaia).
 * Garantit : 1) le maintien du BPM maître de Sequenciador, 2) la continuité du Baque sur totalMeasures,
 * et 3) la préservation stricte de `recordedBpm` sur chaque tranche audio (< 130 lignes).
 */
import type { ToadaProject } from '../types/toadaProject.types';

export interface SamambaiaMorceauSummary {
  id: string; name: string; bpm: number; ritmo?: string; nacao?: string;
  toadaPackId?: string; hasVocalToada: boolean; updatedAt?: number;
  rawDoc?: Record<string, any>; parsedPreset?: Record<string, any>;
}

export function normalizeMorceauTitle(title?: string | null): string {
  return (title || '').replace(/\.json$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export function findBestMatchingSamambaiaMorceau(morceaux: SamambaiaMorceauSummary[], project: ToadaProject): SamambaiaMorceauSummary | null {
  if (!morceaux.length) return null;
  const linkedId = (project.toadaMeta as any)?.lienSequenceurId || project.toadaMeta?.repertoireId;
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

function convertStepsForSequenciador(rawSteps: any[] = [], count: number, roleSymbol: 'P' | 'C', ignorePitch: boolean) {
  const activeSteps: any[] = Array(count).fill(0), notes: string[] = Array(count).fill(''), lyrics: string[] = Array(count).fill('');
  const volumes: number[] = Array(count).fill(80), decays: number[] = Array(count).fill(20);
  let lastPitch = '';
  for (let i = 0; i < count; i++) {
    const s = rawSteps[i];
    if (!s || (!s.active && !s.isTie && s.note !== '───')) continue;
    const isHold = Boolean(s.isTie || s.note === '───' || s.syllable === '───');
    const pitch = (s.note && s.note !== '0' && s.note !== '───') ? s.note : (lastPitch || 'C4');
    lastPitch = pitch; activeSteps[i] = roleSymbol;
    notes[i] = isHold ? (ignorePitch ? '───' : pitch) : (ignorePitch ? '' : pitch);
    lyrics[i] = isHold ? '───' : ((s.syllable || s.lyricSyllable || '').replace(/^_$/, ''));
    if (typeof s.velocity === 'number') volumes[i] = s.velocity;
  }
  return { activeSteps, notes, lyrics, volumes, decays };
}

export function injectToadaPackIntoSequenciadorPreset(
  existingPreset: Record<string, any> | null, toadaPack: Record<string, any>, sequenciadorBpm: number, presetId?: string
): Record<string, any> {
  const masterBpm = Math.max(30, Math.round(Number(sequenciadorBpm || existingPreset?.bpm || 96)));
  const base = existingPreset ? JSON.parse(JSON.stringify(existingPreset)) : { bpm: masterBpm, timeSig: toadaPack.timeSignature || '4/4', totalMeasures: 8, tracks: [], metadata: {} };
  const rawSlots: any[] = toadaPack.slots || toadaPack.arrangementSlots || [], rawPatterns: any[] = toadaPack.patterns || [];
  const baseId = Date.now() + 10000, patIdMap = new Map<string, number>();
  rawPatterns.forEach((p, idx) => patIdMap.set(p.id, baseId + idx * 1000));

  const conductorSlots = rawSlots.map((s) => {
    const pPat = rawPatterns.find((x) => x.id === s.puxadorPatternId), cPat = rawPatterns.find((x) => x.id === s.coroPatternId);
    const span = Math.max(1, Number(s.advanceMeasures || s.measuresCount || Math.max(pPat?.measuresCount || 0, cPat?.measuresCount || 0, 1)));
    return { puxadorPatternId: s.puxadorPatternId ? patIdMap.get(s.puxadorPatternId) : undefined, coroPatternId: s.coroPatternId ? patIdMap.get(s.coroPatternId) : undefined, measuresCount: span, advanceMeasures: span, isSilenceSlot: Boolean(s.isSilenceSlot) || (!s.puxadorPatternId && !s.coroPatternId) };
  });

  const cycleMeasures = conductorSlots.reduce((acc, s) => acc + s.advanceMeasures, 0);
  const nextTotal = Math.max(Number(base.totalMeasures) || 8, cycleMeasures || 8);
  const packIgnorePitch = Boolean(toadaPack.ignoreMelodyPitch ?? (toadaPack.sequenciadorExportMode === 'rhythm_only')), shiftSt = Number(toadaPack.transpositionSemitones ?? 0);

  // Continuité du Baque : bouclage des measureAssignments des pistes d'instruments (< 10) jusqu'à nextTotal
  const baqueTracks = (Array.isArray(base.tracks) ? base.tracks : []).filter((t: any) => t && t.instrumentIdx !== 10 && t.instrumentIdx !== 11).map((t: any) => ({
    ...t,
    patterns: (t.patterns || []).map((ptn: any) => {
      const prev: boolean[] = Array.isArray(ptn.measureAssignments) ? ptn.measureAssignments.map(Boolean) : [];
      const hasAny = prev.some(Boolean);
      return { ...ptn, measureAssignments: Array.from({ length: nextTotal }, (_, m) => (m < prev.length ? prev[m] : (hasAny && prev.length > 0 ? prev[m % prev.length] : false))) };
    }),
  }));

  const buildRolePatterns = (role: 'puxador' | 'coro') => rawPatterns.filter((p) => (p.role === 'coro' ? 'coro' : 'puxador') === role).map((p) => {
    const numId = patIdMap.get(p.id)!, roleSym: 'P' | 'C' = role === 'coro' ? 'C' : 'P';
    const recBpm = Number(p.recordedBpm || p.baseBpm || p.bpm || masterBpm), stepsCount = Math.max(1, Number(p.measuresCount) || 1) * 16;
    const ignorePitch = p.ignoreMelodyPitch !== undefined ? Boolean(p.ignoreMelodyPitch) : packIgnorePitch;
    const mainConv = convertStepsForSequenciador(p.mainSteps || [], stepsCount + 4, roleSym, ignorePitch), preConv = convertStepsForSequenciador(p.anacrusisSteps || [], 16, roleSym, ignorePitch);
    const hasAudio = Boolean(p.audioUrl), t1Off = Number(p.t1OffsetSec ?? 0), trimStart = Number(p.trimStartSec ?? 0), trimEnd = Number(p.trimEndSec ?? 0);
    const startOff = trimStart - t1Off, anacSec = Math.max(0, -startOff), assign = Array(nextTotal).fill(false);
    let curM = 0;
    for (const slot of conductorSlots) {
      if (!slot.isSilenceSlot && (role === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId) === numId) {
        for (let m = curM; m < curM + slot.advanceMeasures && m < nextTotal; m++) assign[m] = true;
      }
      curM += slot.advanceMeasures;
    }
    return {
      id: numId, name: p.name || (role === 'coro' ? 'Coro' : 'Puxador'), steps: stepsCount,
      activeSteps: mainConv.activeSteps.slice(0, stepsCount), notes: mainConv.notes.slice(0, stepsCount), lyrics: mainConv.lyrics.slice(0, stepsCount), volumes: mainConv.volumes.slice(0, stepsCount), decays: mainConv.decays.slice(0, stepsCount),
      tailActiveSteps: mainConv.activeSteps.slice(stepsCount, stepsCount + 4), tailNotes: mainConv.notes.slice(stepsCount, stepsCount + 4), tailLyrics: mainConv.lyrics.slice(stepsCount, stepsCount + 4),
      preRollActiveSteps: preConv.activeSteps, preRollNotes: preConv.notes, preRollLyrics: preConv.lyrics, preRollVolumes: preConv.volumes, preRollDecays: preConv.decays,
      hasAnacrusis: p.hasAnacrusis !== false, hasTailBeat: Boolean(p.hasTailBeat), ignoreMelodyPitch: ignorePitch, sungKey: toadaPack.sungKey, troupeKey: toadaPack.troupeKey, packTranspositionSemitones: shiftSt,
      measureAssignments: assign, vocalMode: hasAudio ? 'micro' : 'synth', hasVocalAudio: hasAudio, vocalBpmSync: true, vocalBaseBpm: recBpm, vocalAudioUrl: p.audioUrl,
      vocalClip: hasAudio ? { id: numId, patternId: numId, baseBpm: recBpm, sampleBpm: recBpm, recordedBpm: recBpm, trimStartSec: trimStart, trimEndSec: trimEnd, t1OffsetSec: t1Off, startOffsetSec: startOff, hasTailBeat: Boolean(p.hasTailBeat), nudgeMs: 0, anacrusisBeats: anacSec > 0 ? anacSec / (60 / recBpm) : 0, anacrusisSec: anacSec, packTranspositionSemitones: shiftSt, updatedAt: Date.now() } : undefined,
    };
  });

  const makeVocalTrack = (id: number, instIdx: number, pats: any[]) => ({ id, instrumentIdx: instIdx, patterns: pats, selectedPatternId: pats[0]?.id ?? 0, isMute: false, isSolo: false, isHidden: false, volumeVal: 80, reverbVal: 0, panVal: 0, pan: 0, tuning: 0, fxSends: { reverb: 0, distortion: 0 } });
  const padArr = <T>(arr: T[] | undefined, fill: T): T[] => Array.from({ length: nextTotal }, (_, i) => (Array.isArray(arr) && arr[i] !== undefined ? arr[i] : fill));

  return {
    ...base, bpm: masterBpm, totalMeasures: nextTotal, tracks: [...baqueTracks, makeVocalTrack(9101, 10, buildRolePatterns('puxador')), makeVocalTrack(9102, 11, buildRolePatterns('coro'))],
    toadaConductorSlots: conductorSlots, vocalTransposeSteps: shiftSt, measureBpms: padArr(base.measureBpms, masterBpm),
    measureTimeSigs: padArr(base.measureTimeSigs, base.timeSig || toadaPack.timeSignature || '4/4'), measureVols: padArr(base.measureVols, 100),
    measureBpmTransitions: padArr(base.measureBpmTransitions, 'immediate'), measureVolTransitions: padArr(base.measureVolTransitions, 'immediate'), measureSignals: padArr(base.measureSignals, null),
    metadata: {
      ...(base.metadata || {}), toada: toadaPack.title || base.metadata?.toada || '', morceauId: presetId || base.metadata?.morceauId,
      toadaPackId: toadaPack.id, ignoreMelodyPitch: packIgnorePitch, sequenciadorExportMode: packIgnorePitch ? 'rhythm_only' : 'with_notes',
      sungKey: toadaPack.sungKey, troupeKey: toadaPack.troupeKey, sungScaleMode: toadaPack.sungScaleMode, packTranspositionSemitones: shiftSt, transpositionSemitones: shiftSt,
    },
  };
}

export function applySequenciadorBpmBackToProject(project: ToadaProject, sequenciadorBpm: number, linkedMorceauId: string): ToadaProject {
  const targetBpm = Math.max(30, Math.round(Number(sequenciadorBpm || project.bpm || 88)));
  return {
    ...project, bpm: targetBpm, sequenciadorSyncedAt: Date.now(),
    toadaMeta: { ...(project.toadaMeta || {}), bpmDefaut: targetBpm, lienSequenceurId: linkedMorceauId, repertoireId: project.toadaMeta?.repertoireId || linkedMorceauId },
    patterns: project.patterns.map((p) => {
      const hasAudio = Boolean(p.recordingResult?.pcm?.length || p.rawAudioSamples?.length || (p as any).audioUrl);
      const physicalRecBpm = Number((p as any).recordedBpm || p.recordingResult?.recordedBpm || p.baseBpm || p.bpm || project.bpm || targetBpm);
      return { ...p, bpm: targetBpm, baseBpm: targetBpm, ...(hasAudio ? { recordedBpm: physicalRecBpm, recordingResult: p.recordingResult ? { ...p.recordingResult, recordedBpm: physicalRecBpm } : p.recordingResult } : {}) } as any;
    }),
  };
}
