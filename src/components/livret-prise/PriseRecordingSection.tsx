/**
 * PriseRecordingSection.tsx
 * Zone d'Enregistrement & Déclinaisons en tête du Livret 1 :
 * Matrice 4 déclinaisons, Balancier pendulaire, Trim Editor ou Grand Bouton Rouge + Appel.
 */
import React from 'react';
import type { TimeSignatureString, VocalPackExport } from '../../types/vocalPack.types';
import type { VocalAudioVariant } from '../../types/toadaProject.types';
import type { MetronomeEngine } from '../../audio/MetronomeEngine';
import { PatternVariantSelector } from './PatternVariantSelector';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { WaveformTrimEditor } from './WaveformTrimEditor';
import { RecordActionButton } from './RecordActionButton';
import { CuePatternSelector } from './CuePatternSelector';
import { AudioImportActionsBar } from './AudioImportActionsBar';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { DEFAULT_HARMONY_CONFIG } from '../../types/harmony.types';

interface PriseRecordingSectionProps {
  engine: MetronomeEngine;
  isCycleActive: boolean;
  bpm: number;
  effectiveBpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  referencePitch: string;
  effectivePitch: string;
  selectedOutputDeviceId: string;
  recordedPCM: Float32Array | null;
  recordedSampleRate: number;
  activeVariant: VocalAudioVariant;
  hasAnacrusis?: boolean;
  onToggleRecord: () => void;
  onResetRecording: () => void;
  onTrimChange?: (startSec: number, endSec: number) => void;
  onPackReady: (pack: VocalPackExport) => void;
  onOpenSlicerModal?: () => void;
  onDirectImportAudio?: (file: File) => void;
}

export const PriseRecordingSection: React.FC<PriseRecordingSectionProps> = ({
  engine, isCycleActive, bpm, effectiveBpm, timeSignature, measuresCount, beatsPerMeasure,
  beatResolutions, referencePitch, effectivePitch, selectedOutputDeviceId, recordedPCM,
  recordedSampleRate, activeVariant, hasAnacrusis = true, onToggleRecord, onResetRecording, onTrimChange, onPackReady,
  onOpenSlicerModal, onDirectImportAudio,
}) => {
  const { t } = useLanguage();
  const { activePattern, project, updatePattern, updateVariant, updateHarmonyConfig } = useToadaProject();

  return (
    <div className="flex flex-col gap-3 w-full">
      <PatternVariantSelector
        baseBpm={bpm} referencePitch={referencePitch} disabled={isCycleActive}
        onPlayPitchPreview={(p) => engine.playReferencePitchPreview(p, 1.5, selectedOutputDeviceId)}
      />
      {recordedPCM ? (
        <>
          <PendulumVisualizer
            engine={engine} isActive={isCycleActive}
            measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure}
          />
          <WaveformTrimEditor
            rawPCM={recordedPCM} sampleRate={recordedSampleRate} bpm={effectiveBpm} timeSignature={timeSignature}
            measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
            referencePitch={effectivePitch} outputDeviceId={selectedOutputDeviceId}
            initialTrimStartSec={activeVariant.trimStartSec}
            initialTrimEndSec={activeVariant.trimEndSec}
            initialT1OffsetSec={activeVariant.t1OffsetSec ?? activePattern.t1OffsetSec ?? activePattern.recordingResult?.t1OffsetSec}
            hasAnacrusis={hasAnacrusis}
            harmonyGrid={activePattern.harmonyGrid}
            harmonyConfig={project.harmonyConfig ?? DEFAULT_HARMONY_CONFIG}
            pitchShiftSemitones={activeVariant.pitchShiftSemitones}
            onUpdateGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })}
            onUpdateHarmonyConfig={updateHarmonyConfig}
            onReset={onResetRecording} onTrimChange={onTrimChange}
            onT1OffsetChange={(t1) => {
              updateVariant(activePattern.id, activeVariant.variantKey, { t1OffsetSec: t1 });
              updatePattern(activePattern.id, { t1OffsetSec: t1 });
            }}
            onPackReady={onPackReady}
          />
        </>
      ) : (
        <PendulumVisualizer
          engine={engine} isActive={isCycleActive}
          measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure}
        >
          {(activeVariant.speedRatio !== 1.0 || activeVariant.pitchShiftSemitones !== 0) && (
            <div className="p-2 bg-amber-950/25 border border-amber-500/30 text-[11px] font-mono text-amber-200 flex flex-wrap items-center justify-between gap-1 rounded">
              <span>{t('variant_tempo_banner', { nominal: bpm, effective: effectiveBpm, ratio: Math.round(activeVariant.speedRatio * 100) })}</span>
              {activeVariant.pitchShiftSemitones !== 0 && (
                <span className="text-amber-300 font-bold">{t('variant_pitch_banner', { nominal: referencePitch, effective: effectivePitch, semitones: activeVariant.pitchShiftSemitones })}</span>
              )}
            </div>
          )}
          <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={onToggleRecord} />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
            <div className="flex-1">
              <CuePatternSelector disabled={isCycleActive} />
            </div>
            {onOpenSlicerModal && onDirectImportAudio && (
              <div className="flex-1">
                <AudioImportActionsBar disabled={isCycleActive} onOpenSlicerModal={onOpenSlicerModal} onDirectImportAudio={onDirectImportAudio} />
              </div>
            )}
          </div>
        </PendulumVisualizer>
      )}
    </div>
  );
};
