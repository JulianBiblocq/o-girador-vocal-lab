/**
 * useMelodiaActions.ts
 * Actions de manipulation mélodique non-bloquantes via Web Worker DSP (Latest-Wins `dedupeKey`) :
 * Re-analyse sur ligne verte, Analyse batch de tout le chant, Octave, Reset, Simplification, Soudure (< 138 lignes).
 */
import { useCallback } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData, MelodyneRegion } from '../../types/vocalPack.types';
import type { ToadaProject } from '../../types/toadaProject.types';
import { buildAllowedPitchClasses, type ScaleType } from '../../audio/scaleQuantizer';
import { applyOctaveShiftToMelodia, alignPitchCurveOctaveToBricks } from '../../audio/pitchOctaveGuider';
import { resetLivret1MelodicData, buildUpdatedVocalPackExport } from '../../audio/livretResetHelper';
import { simplifyStepsToMainMelody } from '../../audio/melodicSimplifier';
import { reanalyzeSyllablesInWorker, isVocalDspCancelled } from '../../workers/vocalDspWorkerClient';
import { eraseBrick } from './pianoRollInteractions';
import { weldAdjacentBricks } from './pianoRollBrickInteractions';

interface UseMelodiaActionsParams {
  project?: ToadaProject; loadProject?: (p: ToadaProject) => void;
  rawPCM: Float32Array; sampleRate: number; totalDurationSec: number;
  activePattern: any; initialPack: VocalPackExport; beatsPerMeasure: number;
  measuresCount: number; hasAnac: boolean; t1OffsetSec: number; smoothingLevel: number;
  tonic: string; scaleType: ScaleType; customPitchClasses?: number[] | null;
  rawPitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[];
  selectedRegion: MelodyneRegion | null; selectedRegionId: string | null; selectedStepIdx: number | null;
  regions: MelodyneRegion[]; clearAllRegions: () => void; deleteSelected: () => void;
  commitCurrentSnapshot: (partial?: any) => void; setAllSteps: (steps: VocalStepData[], commit?: boolean) => void;
  updatePattern: (id: string, partial: any) => void; handleUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  t: (k: any) => string; rawTxtCode?: string;
}

export function useMelodiaActions(p: UseMelodiaActionsParams) {
  const handleSnapToGreenLine = useCallback((ton = p.tonic, sc: ScaleType = p.scaleType, cust: number[] | null = p.customPitchClasses ?? null) => {
    const resPerBeat = p.initialPack.metadata.beatResolutions?.[0] || 4;
    const stepDur = (60 / (p.initialPack.metadata.bpm || 88)) / resPerBeat;
    const allowed = sc !== 'chromatic' || (cust && cust.length < 12) ? buildAllowedPitchClasses(ton, sc, cust) : null;
    const hasPcm = Boolean(p.rawPCM && p.rawPCM.length > 0);
    reanalyzeSyllablesInWorker([{
      id: p.activePattern.id, steps: p.allSteps, pitchCurve: p.rawPitchCurve, extractCurveFromPcm: hasPcm,
      pcm: p.rawPCM, sampleRate: p.sampleRate, totalDurationSec: p.totalDurationSec, tessitura: p.activePattern.tessitura,
      gridStartSec: p.hasAnac ? 0 : p.t1OffsetSec, stepDurationSec: stepDur, tonic: ton, scaleType: sc,
      allowedPitchClasses: allowed, referenceMidiNotes: p.activePattern.referenceMidiNotes,
    }], { dedupeKey: `melodia_snap_${p.activePattern.id}` }).then((res) => {
      const out = res.items[0];
      if (!out) return;
      p.commitCurrentSnapshot({ steps: out.steps, rawPitchCurve: out.pitchCurve });
      p.handleUpdateSteps(out.steps, true);
      if (hasPcm) p.updatePattern(p.activePattern.id, { rawPitchCurve: out.pitchCurve, pitchCurve: out.pitchCurve });
    }).catch((err) => { if (!isVocalDspCancelled(err)) console.warn('[useMelodiaActions] Snap error:', err); });
  }, [p]);

  const handleAnalyzeFullSongMelody = useCallback(() => {
    if (!p.project || !p.loadProject) { handleSnapToGreenLine(); return; }
    const proj = p.project, loadProj = p.loadProject;
    const allowed = p.scaleType !== 'chromatic' || (p.customPitchClasses && p.customPitchClasses.length < 12)
      ? buildAllowedPitchClasses(p.tonic, p.scaleType, p.customPitchClasses ?? null) : null;

    const batchItems = proj.patterns.flatMap((pat) => {
      const pcm = pat.rawAudioSamples ?? pat.recordingResult?.pcm ?? pat.variants?.[pat.activeVariantKey]?.recordingResult?.pcm;
      const sr = pat.recordingResult?.sampleRate ?? p.sampleRate;
      const hasPcm = Boolean(pcm && pcm.length > 0), hasCurve = Boolean(pat.rawPitchCurve && pat.rawPitchCurve.length > 0);
      if (!hasPcm && !hasCurve) return [];
      const combinedSteps = pat.id === p.activePattern.id ? p.allSteps : [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])];
      if (combinedSteps.length === 0) return [];
      const bpm = pat.bpm ?? pat.baseBpm ?? proj.bpm ?? 88, resPerBeat = pat.pack?.metadata.beatResolutions?.[0] || 4;
      const hasAnac = pat.hasAnacrusis !== false, durSec = hasPcm ? pcm!.length / sr : p.totalDurationSec;
      return [{
        id: pat.id, steps: combinedSteps, pitchCurve: pat.rawPitchCurve || pat.pitchCurve || [],
        extractCurveFromPcm: hasPcm, pcm, sampleRate: sr, totalDurationSec: durSec, tessitura: pat.tessitura,
        gridStartSec: hasAnac ? 0 : (pat.t1OffsetSec ?? 0.15), stepDurationSec: (60 / bpm) / resPerBeat,
        tonic: p.tonic, scaleType: p.scaleType, allowedPitchClasses: allowed, referenceMidiNotes: pat.referenceMidiNotes,
      }];
    });
    if (batchItems.length === 0) return;

    reanalyzeSyllablesInWorker(batchItems, { dedupeKey: `melodia_full_song_${proj.id}` }).then((res) => {
      const byId = new Map(res.items.map((it) => [it.id, it]));
      let totalDoubts = 0;
      const updatedPatterns = proj.patterns.map((pat) => {
        const hit = byId.get(pat.id);
        if (!hit) return pat;
        const resPerBeat = pat.pack?.metadata.beatResolutions?.[0] || 4, hasAnac = pat.hasAnacrusis !== false;
        const anacLen = hasAnac ? p.beatsPerMeasure * resPerBeat : 0;
        totalDoubts += hit.steps.filter((s) => s.active && !s.isTie && s.note !== '───' && s.isUncertain).length;
        if (pat.id === p.activePattern.id) { p.commitCurrentSnapshot({ steps: hit.steps, rawPitchCurve: hit.pitchCurve }); p.setAllSteps(hit.steps, true); }
        const anacSteps = hasAnac ? hit.steps.slice(0, anacLen) : [];
        const mainSteps = (hasAnac ? hit.steps.slice(anacLen) : hit.steps).map((s, idx) => ({ ...s, stepIndex: idx }));
        const updatedPack = pat.pack ? buildUpdatedVocalPackExport(pat.pack, hit.steps, hasAnac, p.beatsPerMeasure, hit.pitchCurve) : pat.pack;
        return { ...pat, rawPitchCurve: hit.pitchCurve, pitchCurve: hit.pitchCurve, anacrusisSteps: anacSteps, mainSteps, pack: updatedPack, isMidiInitialized: true };
      });
      loadProj({ ...proj, patterns: updatedPatterns });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `Mélodie analysée sur ${byId.size} phrases (rythme conservé) — ${totalDoubts} note(s) en doute à vérifier.` } }));
    }).catch((err) => { if (!isVocalDspCancelled(err)) console.warn('[useMelodiaActions] Batch error:', err); });
  }, [p, handleSnapToGreenLine]);

  const handleReset = useCallback(() => {
    p.clearAllRegions();
    const res = resetLivret1MelodicData({
      rawAudio: p.rawPCM, sampleRate: p.sampleRate, totalDurationSec: p.totalDurationSec,
      activePattern: p.activePattern, initialPack: p.initialPack, beatsPerMeasure: p.beatsPerMeasure,
      measuresCount: p.measuresCount, hasAnacrusis: p.hasAnac, t1OffsetSec: p.t1OffsetSec,
      smoothingLevel: p.smoothingLevel, tonic: p.tonic, scaleType: p.scaleType, rawTxtCode: p.rawTxtCode,
    });
    p.commitCurrentSnapshot({ steps: res.newSteps, rawPitchCurve: res.freshCurve, melodyneRegions: [] });
    p.setAllSteps(res.newSteps, false);
    p.updatePattern(p.activePattern.id, {
      rawPitchCurve: res.freshCurve, pitchCurve: res.freshCurve, anacrusisSteps: res.anacrusisSteps,
      mainSteps: res.mainSteps, timeAnchors: res.freshAnchors ?? p.activePattern.timeAnchors,
      correctedAudioSamples: null, melodyneRegions: [], isMidiInitialized: true, midiLocked: false,
    });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: p.t('reExtractSuccessToast'), type: 'success' } }));
  }, [p]);

  const handleShiftOctave = useCallback((delta: -1 | 1) => {
    const { newCurve, newSteps } = applyOctaveShiftToMelodia(p.rawPitchCurve, p.allSteps, p.selectedRegion, p.totalDurationSec, delta, p.hasAnac, p.beatsPerMeasure, p.initialPack.metadata.beatResolutions?.[0] || 4);
    p.commitCurrentSnapshot({ steps: newSteps, rawPitchCurve: newCurve }); p.handleUpdateSteps(newSteps, false);
    p.updatePattern(p.activePattern.id, { rawPitchCurve: newCurve, pitchCurve: newCurve });
  }, [p]);

  const handleAlignOctaveToBricks = useCallback(() => {
    const tGridStart = p.hasAnac ? 0 : 0.15, gridDur = Math.max(0.05, p.totalDurationSec - tGridStart - 0.25);
    const stepDur = (p.allSteps[0]?.decay > 0 && p.allSteps[0]?.decay < 5) ? p.allSteps[0].decay : (gridDur / (p.allSteps.length || 1));
    const newCurve = alignPitchCurveOctaveToBricks(p.rawPitchCurve, p.allSteps, stepDur, 0, tGridStart);
    p.commitCurrentSnapshot({ rawPitchCurve: newCurve }); p.updatePattern(p.activePattern.id, { rawPitchCurve: newCurve, pitchCurve: newCurve });
  }, [p]);

  const handleDeleteSelected = useCallback(() => {
    if (p.selectedRegionId) { p.commitCurrentSnapshot({ melodyneRegions: p.regions.filter((r) => r.id !== p.selectedRegionId) }); p.deleteSelected(); }
    else if (p.selectedStepIdx !== null) { const next = eraseBrick(p.allSteps, p.selectedStepIdx); p.commitCurrentSnapshot({ steps: next }); p.handleUpdateSteps(next, false); }
  }, [p]);

  const handleSimplifyMelody = useCallback(() => {
    const simplified = simplifyStepsToMainMelody(p.allSteps, p.activePattern.timeAnchors, p.initialPack.metadata.beatResolutions?.[0] || 4, p.beatsPerMeasure, p.hasAnac);
    p.commitCurrentSnapshot({ steps: simplified }); p.handleUpdateSteps(simplified, true);
  }, [p]);

  const handleWeldSelected = useCallback(() => {
    const targetIdx = p.selectedStepIdx ?? p.allSteps.findIndex((s) => s.active && s.note !== '───');
    if (targetIdx === null || targetIdx < 0) return;
    const welded = weldAdjacentBricks(p.allSteps, targetIdx, 12);
    p.commitCurrentSnapshot({ steps: welded }); p.handleUpdateSteps(welded, true);
  }, [p]);

  return { handleSnapToGreenLine, handleAnalyzeFullSongMelody, handleReset, handleShiftOctave, handleAlignOctaveToBricks, handleDeleteSelected, handleSimplifyMelody, handleWeldSelected };
}
