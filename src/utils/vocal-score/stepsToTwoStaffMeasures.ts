/**
 * stepsToTwoStaffMeasures.ts
 * Déploiement pur de la Frise Conducteur (slots + patterns) sur 2 portées chorales (P1=Puxador, P2=Coro) :
 * Transposition troupeKey, armure, La=XXX Hz, clé auto/Sol/Sol 8vb, anacrouse M0, tuilages +1T, unisson et [PAUSE XM] (< 132 lignes).
 */
import { parseScoreKeySignature, resolveStaffClef, type ClefModeOption, type ResolvedStaffClef, type ParsedKeySignature } from './scoreTheoryHelper';

export interface ScoreStepLike {
  stepIndex?: number; active?: boolean; isTie?: boolean; isMelisma?: boolean; note?: string;
  midiNumber?: number; syllable?: string; syllableAttack?: boolean; tripletSlot?: 1 | 2 | 3 | 'unused';
}
export interface MeasureChordEvent { beat: number; symbol: string; }
export interface TwoStaffMeasure {
  measureNumber: number; isPickup: boolean; beatsCount: number; isBaquePause: boolean; pauseTotalMeasures?: number;
  pauseLabel?: string; isUnison: boolean; chords: MeasureChordEvent[]; puxSteps: ScoreStepLike[];
  corSteps: ScoreStepLike[]; puxRhythmOnly?: boolean; corRhythmOnly?: boolean;
}
export interface TwoStaffScoreModel {
  title: string; bpm: number; beatsPerMeasure: number; beatType: number; keySig: ParsedKeySignature;
  troupeKeyLabel: string; referencePitchHz: number; diapasonLabel: string;
  puxClef: ResolvedStaffClef; corClef: ResolvedStaffClef; measures: TwoStaffMeasure[];
}

const mkSilentSteps = (len: number): ScoreStepLike[] => Array.from({ length: len }, (_, i) => ({ stepIndex: i, active: false, midiNumber: 0, note: '' }));
const isAct = (s?: ScoreStepLike) => Boolean(s && s.tripletSlot !== 'unused' && s.active && ((s.midiNumber ?? 0) > 0 || (s.syllable && s.syllable !== '0')));

function preparePatternSteps(pat: any, projectShiftSt: number) {
  if (!pat) return { ana: [] as ScoreStepLike[], main: [] as ScoreStepLike[], rhythmOnly: false };
  const shift = pat.stepsInTroupeKey || pat.sungReferencePitch ? 0 : Math.round(projectShiftSt || 0);
  const refs: number[] = Array.isArray(pat.referenceMidiNotes) ? pat.referenceMidiNotes : [];
  let refCursor = 0, lastMidi = 60;
  const rhythmOnly = Boolean((pat.rhythmOnlyMode || pat.foldNotesView) && refs.length === 0);
  const normArr = (arr: any[] = []): ScoreStepLike[] => arr.map((raw, idx) => {
    if (!raw || !raw.active || raw.syllable === '0' || raw.syllable === '𝄽') return { stepIndex: idx, active: false, midiNumber: 0, note: '' };
    if (raw.note === '───' || (raw.isTie && !raw.isMelisma && raw.syllable !== '_')) return { ...raw, stepIndex: idx, active: true, isTie: true, note: '───', midiNumber: lastMidi };
    let baseMidi = Number(raw.midiNumber || 60);
    if ((pat.rhythmOnlyMode || pat.foldNotesView) && refs[refCursor]) baseMidi = refs[refCursor++];
    lastMidi = Math.max(24, Math.min(108, Math.round(baseMidi + shift)));
    return { ...raw, stepIndex: idx, active: true, isTie: false, midiNumber: lastMidi };
  });
  return { ana: normArr(pat.anacrusisSteps || pat.pack?.alignment?.anacrusis?.steps || []), main: normArr(pat.mainSteps || pat.pack?.grid?.steps || []), rhythmOnly };
}

function extractMeasureChords(grid: any, mIdx: number, beatsPerM: number): MeasureChordEvent[] {
  if (!grid) return [];
  const out: MeasureChordEvent[] = [], pushSym = (b: number, s: any) => {
    const sym = String(s || '').trim();
    if (sym && sym !== '-' && sym !== 'NC') out.push({ beat: Math.max(1, Math.min(beatsPerM, b)), symbol: sym });
  };
  if (Array.isArray(grid.measures)) {
    const mObj = grid.measures.find((x: any) => x?.measureIndex === mIdx) || grid.measures[mIdx];
    for (const [k, v] of Object.entries(mObj?.chordsByBeat || {})) pushSym(Number(k) + 1, v);
  } else if (grid.measures && typeof grid.measures === 'object' && grid.measures[mIdx]) {
    for (const [k, v] of Object.entries(grid.measures[mIdx])) pushSym(Number(String(k).replace(/^beat/i, '')) || 1, v);
  }
  for (const c of (grid.chords || grid.cells || grid.events || [])) {
    const cMeas = typeof c.measureIndex === 'number' ? c.measureIndex : typeof c.measure === 'number' ? c.measure - 1 : Math.floor((c.beatIndex ?? 0) / beatsPerM);
    if (cMeas === mIdx) pushSym(typeof c.beat === 'number' ? c.beat : ((c.beatIndex ?? 0) % beatsPerM) + 1, c?.chord || c?.symbol || c?.label);
  }
  return out;
}

export function buildTwoStaffMeasures(projectOrPack: any, options: { clefMode?: ClefModeOption; puxClefMode?: ClefModeOption; corClefMode?: ClefModeOption } = {}): TwoStaffScoreModel {
  const src = projectOrPack || {}, title = String(src.title || src.titre || src.metadata?.title || 'Toada').trim();
  const bpm = Math.max(30, Number(src.bpm || src.toadaMeta?.bpmDefaut || src.metadata?.bpm || 88));
  const [bStr, btStr] = String(src.timeSignature || src.signature || src.metadata?.timeSignature || '4/4').split('/');
  const beatsPerMeasure = Math.max(1, parseInt(bStr, 10) || 4), beatType = parseInt(btStr, 10) || 4, spm = beatsPerMeasure * 4;
  const shiftSt = Number(src.transpositionSemitones ?? src.toadaMeta?.transpositionSemitones ?? 0);
  const keySig = parseScoreKeySignature(src.troupeKey || src.toadaMeta?.tonaliteDefaut || src.troupeScaleRoot || src.sungScaleRoot || 'Do Majeur');
  const referencePitchHz = Math.max(415, Math.min(466, Math.round(Number(src.referencePitchHz ?? src.toadaMeta?.referencePitchHz ?? 440))));
  const diapasonLabel = referencePitchHz !== 440 ? `La = ${referencePitchHz} Hz` : '';

  const patterns: any[] = Array.isArray(src.patterns) ? src.patterns : [], patMap = new Map<string, any>(patterns.map((p) => [p.id, p]));
  const rawSlots: any[] = Array.isArray(src.slots) && src.slots.length > 0 ? src.slots : Array.isArray(src.arrangementSlots) && src.arrangementSlots.length > 0 ? src.arrangementSlots
    : patterns.map((p, i) => ({ slotId: `auto_${i}`, puxadorPatternId: p.role === 'puxador' ? p.id : null, coroPatternId: p.role === 'coro' ? p.id : null, advanceMeasures: p.measuresCount || 1 }));

  const measures: TwoStaffMeasure[] = [];
  let measNum = 1, pendingPuxTail: ScoreStepLike[] | null = null, pendingCorTail: ScoreStepLike[] | null = null;

  for (const sl of rawSlots) {
    const puxPat = sl.puxadorPatternId ? patMap.get(sl.puxadorPatternId) : null, corPat = sl.coroPatternId ? patMap.get(sl.coroPatternId) : null;
    if (!puxPat && !corPat) {
      const pCount = Math.max(1, Number(sl.advanceMeasures || 1));
      for (let k = 0; k < pCount; k++) {
        const pSteps = mkSilentSteps(spm), cSteps = mkSilentSteps(spm);
        if (k === 0 && pendingPuxTail) { pendingPuxTail.slice(0, 4).forEach((st, idx) => { pSteps[idx] = st; }); pendingPuxTail = null; }
        if (k === 0 && pendingCorTail) { pendingCorTail.slice(0, 4).forEach((st, idx) => { cSteps[idx] = st; }); pendingCorTail = null; }
        measures.push({ measureNumber: measNum++, isPickup: false, beatsCount: beatsPerMeasure, isBaquePause: true, pauseTotalMeasures: pCount, pauseLabel: k === 0 ? `Baque (${pCount} M)` : '', isUnison: false, chords: [], puxSteps: pSteps, corSteps: cSteps });
      }
      continue;
    }

    const pPrep = preparePatternSteps(puxPat, shiftSt), cPrep = preparePatternSteps(corPat, shiftSt);
    const hasPuxAna = Boolean(puxPat && puxPat.hasAnacrusis !== false && pPrep.ana.some(isAct)), hasCorAna = Boolean(corPat && corPat.hasAnacrusis !== false && cPrep.ana.some(isAct));
    if (hasPuxAna || hasCorAna) {
      if (measures.length === 0) {
        let firstBeat = beatsPerMeasure - 1;
        for (let b = 0; b < beatsPerMeasure; b++) if (pPrep.ana.slice(b * 4, b * 4 + 4).some(isAct) || cPrep.ana.slice(b * 4, b * 4 + 4).some(isAct)) { firstBeat = b; break; }
        const pBeats = beatsPerMeasure - firstBeat;
        measures.push({ measureNumber: 0, isPickup: true, beatsCount: pBeats, isBaquePause: false, isUnison: Boolean(hasPuxAna && hasCorAna), chords: [], puxSteps: hasPuxAna ? pPrep.ana.slice(firstBeat * 4, spm) : mkSilentSteps(pBeats * 4), corSteps: hasCorAna ? cPrep.ana.slice(firstBeat * 4, spm) : mkSilentSteps(pBeats * 4), puxRhythmOnly: pPrep.rhythmOnly, corRhythmOnly: cPrep.rhythmOnly });
      } else {
        const prev = measures[measures.length - 1];
        if (hasPuxAna) for (let i = 0; i < Math.min(prev.puxSteps.length, pPrep.ana.length); i++) if (!isAct(prev.puxSteps[i]) && isAct(pPrep.ana[i])) prev.puxSteps[i] = pPrep.ana[i];
        if (hasCorAna) for (let i = 0; i < Math.min(prev.corSteps.length, cPrep.ana.length); i++) if (!isAct(prev.corSteps[i]) && isAct(cPrep.ana[i])) prev.corSteps[i] = cPrep.ana[i];
      }
    }

    const mCount = Math.max(puxPat?.measuresCount || 0, corPat?.measuresCount || 0, Number(sl.advanceMeasures || 1), 1);
    const isUnison = Boolean(puxPat && corPat && (puxPat.id === corPat.id || corPat.linkedSourcePatternId === puxPat.id || (puxPat.rawLineCode && puxPat.rawLineCode === corPat.rawLineCode)));
    const hGrid = puxPat?.harmonyGrid || corPat?.harmonyGrid || src.globalHarmonyGrid || src.harmonyGrid;
    for (let m = 0; m < mCount; m++) {
      const pSlice = Array.from({ length: spm }, (_, i) => pPrep.main[m * spm + i] || { stepIndex: i, active: false, midiNumber: 0 });
      const cSlice = Array.from({ length: spm }, (_, i) => cPrep.main[m * spm + i] || { stepIndex: i, active: false, midiNumber: 0 });
      if (m === 0 && pendingPuxTail) { for (let i = 0; i < 4; i++) if (!isAct(pSlice[i]) && isAct(pendingPuxTail[i])) pSlice[i] = pendingPuxTail[i]; pendingPuxTail = null; }
      if (m === 0 && pendingCorTail) { for (let i = 0; i < 4; i++) if (!isAct(cSlice[i]) && isAct(pendingCorTail[i])) cSlice[i] = pendingCorTail[i]; pendingCorTail = null; }
      measures.push({ measureNumber: measNum++, isPickup: false, beatsCount: beatsPerMeasure, isBaquePause: false, isUnison, chords: extractMeasureChords(hGrid, m, beatsPerMeasure), puxSteps: pSlice, corSteps: cSlice, puxRhythmOnly: pPrep.rhythmOnly, corRhythmOnly: cPrep.rhythmOnly });
    }
    const pTail = pPrep.main.slice(mCount * spm, mCount * spm + 4), cTail = cPrep.main.slice(mCount * spm, mCount * spm + 4);
    pendingPuxTail = (puxPat?.hasTailBeat || puxPat?.exitBeat === 1) && pTail.some(isAct) ? pTail : null;
    pendingCorTail = (corPat?.hasTailBeat || corPat?.exitBeat === 1) && cTail.some(isAct) ? cTail : null;
  }

  if (pendingPuxTail || pendingCorTail) {
    const pS = mkSilentSteps(spm), cS = mkSilentSteps(spm);
    if (pendingPuxTail) pendingPuxTail.forEach((st, idx) => { pS[idx] = st; });
    if (pendingCorTail) pendingCorTail.forEach((st, idx) => { cS[idx] = st; });
    measures.push({ measureNumber: measNum++, isPickup: false, beatsCount: beatsPerMeasure, isBaquePause: false, isUnison: false, chords: [], puxSteps: pS, corSteps: cS });
  }
  const collectMidis = (g: (m: TwoStaffMeasure) => ScoreStepLike[]) => measures.flatMap((m) => g(m).filter((s) => s.active && !s.isTie && s.note !== '───' && (s.midiNumber ?? 0) > 0).map((s) => s.midiNumber!));
  const baseMode = options.clefMode || 'auto';
  return { title, bpm, beatsPerMeasure, beatType, keySig, troupeKeyLabel: keySig.label, referencePitchHz, diapasonLabel, puxClef: resolveStaffClef(collectMidis((m) => m.puxSteps), options.puxClefMode || baseMode), corClef: resolveStaffClef(collectMidis((m) => m.corSteps), options.corClefMode || baseMode), measures };
}
