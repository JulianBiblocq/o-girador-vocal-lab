/**
 * LivretCalage.tsx
 * Livret 3 : Calage & Découpe de l'onde vocale (WaveformTrimEditor + Slicer + Import) (< 145 lignes).
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { WaveformTrimEditor } from '../livret-prise/WaveformTrimEditor';
import { CalageEmptyNotice } from './CalageEmptyNotice';
import { LongAudioSlicerBanner } from './LongAudioSlicerBanner';
import { MasterTakeSlicerModal } from '../slicer/MasterTakeSlicerModal';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import { getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { extractPatternMelodicData } from '../../audio/melodicExtractionHelper';
import { Upload, Scissors } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const LivretCalage: React.FC = () => {
  const { project, activePattern, activeVariant, updatePattern, updateVariant, updateHarmonyConfig } = useToadaProject();
  const { selectedOutputDeviceId, recordedSampleRate, setRecordedSampleRate } = useAudioHardware();
  const { setActiveLivret } = useVocalTransportStore();
  const { t } = useLanguage();

  const [isSlicerOpen, setIsSlicerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawPCM = activeVariant.recordingResult?.pcm ?? null;
  const sampleRate = activeVariant.recordingResult?.sampleRate ?? recordedSampleRate;
  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88;
  const effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const referencePitch = activePattern.referencePitch ?? 'C4';
  const effectivePitch = transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones);
  const timeSignature = project.timeSignature;
  const measuresCount = activePattern.measuresCount;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const hasAnacrusis = activePattern.hasAnacrusis !== false;
  const beatResolutions = getDefaultBeatResolutions(timeSignature);

  const beatDuration = 60 / effectiveBpm;
  const measureDuration = beatsPerMeasure * beatDuration;
  const totalDurationSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration);
  const audioDurationSec = rawPCM ? rawPCM.length / sampleRate : 0;
  const isLongAudio = rawPCM !== null && (audioDurationSec > 10 || audioDurationSec > totalDurationSec * 1.8);

  const activeAudio = useMemo(() => {
    if (!rawPCM) return null;
    return { pcm: rawPCM, sampleRate, durationSec: audioDurationSec, fileName: `${activePattern.name}.wav` };
  }, [rawPCM, sampleRate, audioDurationSec, activePattern.name]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await decodeAudioFile(file);
    updateVariant(activePattern.id, activeVariant.variantKey, {
      recordingResult: { pcm: res.pcm, sampleRate: res.sampleRate },
      trimStartSec: 0,
      trimEndSec: Math.min(totalDurationSec, res.durationSec),
    });
    setRecordedSampleRate(res.sampleRate);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (res.durationSec > 10 || res.durationSec > totalDurationSec * 1.8) {
      setIsSlicerOpen(true);
    }
  }, [activePattern.id, activeVariant.variantKey, totalDurationSec, updateVariant, setRecordedSampleRate]);

  const handlePackReady = useCallback(() => {
    if (!rawPCM) return;
    const res = extractPatternMelodicData({
      rawPCM, sampleRate, bpm: effectiveBpm, timeSignature, measuresCount,
      beatsPerMeasure, beatResolutions, hasAnacrusis,
      trimStartSec: activeVariant.trimStartSec, trimEndSec: activeVariant.trimEndSec,
      referencePitch: effectivePitch, pitchShiftSemitones: activeVariant.pitchShiftSemitones,
      tessitura: activePattern.tessitura, assignedLyricsText: activePattern.assignedLyricsText,
      lowCutEnabled: activeVariant.lowCutEnabled, enableTonePolish: activeVariant.enableTonePolish !== false,
    });
    updatePattern(activePattern.id, {
      pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve,
      pitchCurve: res.pitchCurve, anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps,
      isMidiInitialized: true, midiLocked: true,
    });
    setActiveLivret('melodia');
  }, [rawPCM, sampleRate, effectiveBpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, hasAnacrusis, activeVariant, effectivePitch, activePattern, updatePattern, setActiveLivret]);

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <PatternCompassBar />
      {isLongAudio && <LongAudioSlicerBanner durationSec={audioDurationSec} onOpenSlicer={() => setIsSlicerOpen(true)} />}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs font-mono font-bold text-[var(--cordel-secondary-text)] uppercase tracking-wider">
          {activePattern.name} ({activePattern.measuresCount}M)
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="cordel-btn px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-theme-accent" />
            <span>{t('calageDirectImportBtn')}</span>
          </button>
          <button type="button" onClick={() => setIsSlicerOpen(true)} className="cordel-btn px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
            <Scissors className="w-3.5 h-3.5 text-theme-wood" />
            <span>{t('calageOpenSlicerBtn')}</span>
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

      {rawPCM ? (
        <WaveformTrimEditor
          rawPCM={rawPCM} sampleRate={sampleRate} bpm={effectiveBpm} timeSignature={timeSignature}
          measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
          referencePitch={effectivePitch} outputDeviceId={selectedOutputDeviceId}
          initialTrimStartSec={activeVariant.trimStartSec} initialTrimEndSec={activeVariant.trimEndSec}
          initialT1OffsetSec={activeVariant.t1OffsetSec ?? activePattern.t1OffsetSec ?? activePattern.recordingResult?.t1OffsetSec}
          hasAnacrusis={hasAnacrusis} harmonyGrid={activePattern.harmonyGrid}
          harmonyConfig={project.harmonyConfig ?? { enabled: true, profile: 'maracatu', volume: 0.7 }}
          pitchShiftSemitones={activeVariant.pitchShiftSemitones}
          onUpdateGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })}
          onUpdateHarmonyConfig={updateHarmonyConfig}
          onReset={() => updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null })}
          onTrimChange={(s, e) => updateVariant(activePattern.id, activeVariant.variantKey, { trimStartSec: s, trimEndSec: e })}
          onT1OffsetChange={(t1) => {
            updateVariant(activePattern.id, activeVariant.variantKey, { t1OffsetSec: t1 });
            updatePattern(activePattern.id, { t1OffsetSec: t1 });
          }}
          onPackReady={handlePackReady}
        />
      ) : (
        <CalageEmptyNotice onDirectImport={() => fileInputRef.current?.click()} onOpenSlicer={() => setIsSlicerOpen(true)} />
      )}

      <MasterTakeSlicerModal isOpen={isSlicerOpen} onClose={() => setIsSlicerOpen(false)} initialAudio={activeAudio} defaultRole={activePattern.role} />
    </div>
  );
};
