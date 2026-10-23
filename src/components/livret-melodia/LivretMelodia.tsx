/**
 * LivretMelodia.tsx
 * Livret 4 : Melodia & Letra (Piano Roll, Letra, Melodyne & Boussole de pattern) (< 45 lignes).
 */
import React from 'react';
import type { VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { MelodiaEmptyNotice } from './MelodiaEmptyNotice';
import { LivretMelodiaWorkspace } from './LivretMelodiaWorkspace';

export interface LivretMelodiaProps {
  initialPack?: VocalPackExport | null;
  cleanPCM?: Float32Array;
  sampleRate?: number;
  totalDurationSec?: number;
  anacrusisDurationSec?: number;
  beatsPerMeasure?: number;
  measuresCount?: number;
  pitchCurve?: PitchCurvePoint[];
  initialSteps?: VocalStepData[];
  outputDeviceId?: string;
  pitchShiftSemitones?: number;
  onBackToPrise?: () => void;
  onPackUpdated?: (pack: VocalPackExport) => void;
}

export const LivretMelodia: React.FC<LivretMelodiaProps> = (props) => {
  const { activePattern } = useToadaProject();
  const pack = props.initialPack ?? activePattern.pack;

  if (!pack) {
    return (
      <div className="flex flex-col gap-3.5 w-full">
        <PatternCompassBar />
        <MelodiaEmptyNotice />
      </div>
    );
  }

  return <LivretMelodiaWorkspace {...props} initialPack={pack} />;
};
