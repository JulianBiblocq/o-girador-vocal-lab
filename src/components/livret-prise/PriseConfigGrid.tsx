/**
 * PriseConfigGrid.tsx
 * Colonnes de configuration de la prise : Metrique, Mode d ecoute / Note repere, Audio & Calibration.
 */
import React from 'react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import type { ListeningMode, MetronomeEngine } from '../../audio/MetronomeEngine';
import { MetricConfigPanel } from './MetricConfigPanel';
import { ListeningModePanel } from './ListeningModePanel';
import { DeviceSelector } from './DeviceSelector';
import { CalibrationBanner } from './CalibrationBanner';

interface PriseConfigGridProps {
  timeSignature: TimeSignatureString;
  onTimeSignatureChange: (ts: TimeSignatureString) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measuresCount: number;
  onMeasuresCountChange: (count: number) => void;
  beatResolutions: number[];
  onBeatResolutionsChange: (res: number[]) => void;
  listeningMode: ListeningMode;
  onListeningModeChange: (mode: ListeningMode) => void;
  referencePitch: string;
  onReferencePitchChange: (pitch: string) => void;
  engine: MetronomeEngine;
  selectedDeviceId: string;
  onSelectedDeviceChange: (id: string) => void;
  selectedOutputDeviceId: string;
  onSelectedOutputDeviceChange: (id: string) => void;
  recordedSampleRate: number;
  isCycleActive: boolean;
}

export const PriseConfigGrid: React.FC<PriseConfigGridProps> = ({
  timeSignature, onTimeSignatureChange, bpm, onBpmChange, measuresCount,
  onMeasuresCountChange, beatResolutions, onBeatResolutionsChange,
  listeningMode, onListeningModeChange, referencePitch, onReferencePitchChange,
  engine, selectedDeviceId, onSelectedDeviceChange, selectedOutputDeviceId,
  onSelectedOutputDeviceChange, recordedSampleRate, isCycleActive,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch pt-1">
      <MetricConfigPanel
        timeSignature={timeSignature} onTimeSignatureChange={onTimeSignatureChange}
        bpm={bpm} onBpmChange={onBpmChange} measuresCount={measuresCount}
        onMeasuresCountChange={onMeasuresCountChange} beatResolutions={beatResolutions}
        onBeatResolutionsChange={onBeatResolutionsChange} disabled={isCycleActive}
      />
      <ListeningModePanel
        listeningMode={listeningMode} onListeningModeChange={onListeningModeChange}
        referencePitch={referencePitch} onReferencePitchChange={onReferencePitchChange}
        onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
        disabled={isCycleActive}
      />
      <div className="h-full flex flex-col justify-between gap-4">
        <CalibrationBanner
          inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId}
          sampleRate={recordedSampleRate} onCalibrationComplete={() => {}} disabled={isCycleActive}
        />
        <DeviceSelector
          selectedDeviceId={selectedDeviceId} onDeviceChange={onSelectedDeviceChange}
          selectedOutputDeviceId={selectedOutputDeviceId}
          onOutputDeviceChange={(id) => { onSelectedOutputDeviceChange(id); engine.setOutputDevice(id); }}
          disabled={isCycleActive}
        />
      </div>
    </div>
  );
};
