/**
 * useMelodiaActions.ts
 * Actions de manipulation mélodique (Octave, Reset, Suppression, Quantize) (< 65 lignes).
 */
import { useCallback } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData, MelodyneRegion } from '../../types/vocalPack.types';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { applyOctaveShiftToMelodia, alignPitchCurveOctaveToBricks } from '../../audio/pitchOctaveGuider';
import { resetLivret1MelodicData } from '../../audio/livretResetHelper';
import { simplifyStepsToMainMelody } from '../../audio/melodicSimplifier';
import { eraseBrick } from './pianoRollInteractions';
import { weldAdjacentBricks } from './pianoRollBrickInteractions';

interface UseMelodiaActionsParams {
  rawPCM: Float32Array; sampleRate: number; totalDurationSec: number;
  activePattern: any; initialPack: VocalPackExport; beatsPerMeasure: number;
  measuresCount: number; hasAnac: boolean; t1OffsetSec: number; smoothingLevel: number;
  tonic: string; scaleType: ScaleType; rawPitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[];
  selectedRegion: MelodyneRegion | null; selectedRegionId: string | null; selectedStepIdx: number | null;
  regions: MelodyneRegion[]; clearAllRegions: () => void; deleteSelected: () => void;
  commitCurrentSnapshot: (partial?: any) => void; setAllSteps: (steps: VocalStepData[], commit?: boolean) => void;
  updatePattern: (id: string, partial: any) => void; handleUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  t: (k: any) => string;
}

export function useMelodiaActions(p: UseMelodiaActionsParams) {
  const handleReset = useCallback(() => {
    p.clearAllRegions();
    const res = resetLivret1MelodicData({
      rawAudio: p.rawPCM, sampleRate: p.sampleRate, totalDurationSec: p.totalDurationSec,
      activePattern: p.activePattern, initialPack: p.initialPack, beatsPerMeasure: p.beatsPerMeasure,
      measuresCount: p.measuresCount, hasAnacrusis: p.hasAnac, t1OffsetSec: p.t1OffsetSec,
      smoothingLevel: p.smoothingLevel, tonic: p.tonic, scaleType: p.scaleType,
    });
    p.commitCurrentSnapshot({ steps: res.newSteps, rawPitchCurve: res.freshCurve, melodyneRegions: [] });
    p.setAllSteps(res.newSteps, false);
    p.updatePattern(p.activePattern.id, {
      rawPitchCurve: res.freshCurve, pitchCurve: res.freshCurve, anacrusisSteps: res.anacrusisSteps,
      mainSteps: res.mainSteps, correctedAudioSamples: null, melodyneRegions: [], isMidiInitialized: true, midiLocked: false,
    });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: p.t('reExtractSuccessToast'), type: 'success' } }));
  }, [p]);

  const handleShiftOctave = useCallback((delta: -1 | 1) => {
    const { newCurve, newSteps } = applyOctaveShiftToMelodia(
      p.rawPitchCurve, p.allSteps, p.selectedRegion, p.totalDurationSec, delta, p.hasAnac, p.beatsPerMeasure, p.initialPack.metadata.beatResolutions?.[0] || 4
    );
    p.commitCurrentSnapshot({ steps: newSteps, rawPitchCurve: newCurve });
    p.handleUpdateSteps(newSteps, false);
    p.updatePattern(p.activePattern.id, { rawPitchCurve: newCurve, pitchCurve: newCurve });
  }, [p]);

  const handleAlignOctaveToBricks = useCallback(() => {
    const tGridStart = p.hasAnac ? 0 : 0.15;
    const gridDur = Math.max(0.05, p.totalDurationSec - tGridStart - 0.25);
    const stepDur = (p.allSteps[0]?.decay > 0 && p.allSteps[0]?.decay < 5) ? p.allSteps[0].decay : (gridDur / (p.allSteps.length || 1));
    const newCurve = alignPitchCurveOctaveToBricks(p.rawPitchCurve, p.allSteps, stepDur, 0, tGridStart);
    p.commitCurrentSnapshot({ rawPitchCurve: newCurve });
    p.updatePattern(p.activePattern.id, { rawPitchCurve: newCurve, pitchCurve: newCurve });
  }, [p]);

  const handleDeleteSelected = useCallback(() => {
    if (p.selectedRegionId) {
      p.commitCurrentSnapshot({ melodyneRegions: p.regions.filter((r) => r.id !== p.selectedRegionId) });
      p.deleteSelected();
    } else if (p.selectedStepIdx !== null) {
      const next = eraseBrick(p.allSteps, p.selectedStepIdx);
      p.commitCurrentSnapshot({ steps: next });
      p.handleUpdateSteps(next, false);
    }
  }, [p]);

  const handleSimplifyMelody = useCallback(() => {
    const subdiv = p.initialPack.metadata.beatResolutions?.[0] || 4;
    const simplified = simplifyStepsToMainMelody(p.allSteps, p.activePattern.timeAnchors, subdiv, p.beatsPerMeasure, p.hasAnac);
    p.commitCurrentSnapshot({ steps: simplified });
    p.handleUpdateSteps(simplified, true);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: p.t('simplifyMelodyToast'), type: 'success' } }));
  }, [p]);

  const handleWeldSelected = useCallback(() => {
    const targetIdx = p.selectedStepIdx ?? p.allSteps.findIndex((s) => s.active && s.note !== '───');
    if (targetIdx === null || targetIdx < 0) return;
    const welded = weldAdjacentBricks(p.allSteps, targetIdx, 12);
    p.commitCurrentSnapshot({ steps: welded });
    p.handleUpdateSteps(welded, true);
  }, [p]);

  return { handleReset, handleShiftOctave, handleAlignOctaveToBricks, handleDeleteSelected, handleSimplifyMelody, handleWeldSelected };
}
