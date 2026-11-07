/**
 * LivretCalage.tsx
 * Livret 3 : Calage & Découpe de l'onde vocale (WaveformTrimEditor + Slicer + Import) (< 140 lignes).
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { TwinPatternsManagerBar } from '../common/TwinPatternsManagerBar';
import { WaveformTrimEditor } from '../livret-prise/WaveformTrimEditor';
import { CalageEmptyNotice } from './CalageEmptyNotice';
import { LongAudioSlicerBanner } from './LongAudioSlicerBanner';
import { MasterTakeSlicerModal } from '../slicer/MasterTakeSlicerModal';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import { getPatternTotalDurationSec, getPatternT1OffsetSec } from '../../utils/anacrusisTimingHelper';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { extractPatternMelodicData, rebuildCanonicalCleanAudio } from '../../audio/melodicExtractionHelper';
import { autoSnapT1ToVocalOnset } from '../../audio/vocalOnsetDetector';
import { Upload, Scissors } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const LivretCalage: React.FC = () => {
  const { project, activePattern, activeVariant, updatePattern, updateVariant, updatePatternAndVariant, updateHarmonyConfig } = useToadaProject();
  const { selectedOutputDeviceId, recordedSampleRate, setRecordedSampleRate } = useAudioHardware();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const { t } = useLanguage();

  const [isSlicerOpen, setIsSlicerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawPCM = activeVariant.recordingResult?.pcm ?? null;
  const sampleRate = activeVariant.recordingResult?.sampleRate ?? recordedSampleRate;
  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88;
  const effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const referencePitch = activePattern.referencePitch ?? 'C4';
  const effectivePitch = transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones);
  const timeSignature = project.timeSignature, measuresCount = activePattern.measuresCount;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature), hasAnacrusis = activePattern.hasAnacrusis !== false;
  const beatResolutions = getDefaultBeatResolutions(timeSignature), beatDuration = 60 / effectiveBpm;
  const measureDuration = beatsPerMeasure * beatDuration;
  const totalDurationSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration);
  const audioDurationSec = rawPCM ? rawPCM.length / sampleRate : 0;
  const isLongAudio = rawPCM !== null && (audioDurationSec > 10 || audioDurationSec > totalDurationSec * 1.8);

  const activeAudio = useMemo(() => {
    if (!rawPCM || !isLongAudio) return null;
    return { pcm: rawPCM, sampleRate, durationSec: audioDurationSec, fileName: `${activePattern.name}.wav` };
  }, [rawPCM, isLongAudio, sampleRate, audioDurationSec, activePattern.name]);

  const syncCalageState = useCallback((nextTrimStart: number, nextTrimEnd: number, nextT1: number) => {
    if (!rawPCM) return;
    const cleanPCM = rebuildCanonicalCleanAudio({ rawPCM, sampleRate, bpm: effectiveBpm, measuresCount, beatsPerMeasure, hasAnacrusis, trimStartSec: nextTrimStart, trimEndSec: nextTrimEnd, t1OffsetSec: nextT1, lowCutEnabled: activeVariant.lowCutEnabled, enableTonePolish: activeVariant.enableTonePolish !== false });
    const rec = activeVariant.recordingResult ? { ...activeVariant.recordingResult, t1OffsetSec: nextT1 } : null;
    const preserveMidi = Boolean(activePattern.midiLocked && (activePattern.mainSteps?.length ?? 0) > 0);
    const vUpd = { ...(rec ? { recordingResult: rec } : {}), trimStartSec: nextTrimStart, trimEndSec: nextTrimEnd, t1OffsetSec: nextT1 };
    updatePatternAndVariant(activePattern.id, activeVariant.variantKey, { ...vUpd, rawAudioSamples: cleanPCM, hasCanonicalAlignment: preserveMidi as any, correctedAudioSamples: null }, vUpd);
  }, [rawPCM, sampleRate, effectiveBpm, measuresCount, beatsPerMeasure, hasAnacrusis, activeVariant, activePattern, updatePatternAndVariant]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await decodeAudioFile(file), trimEnd = res.durationSec;
    const snappedT1 = autoSnapT1ToVocalOnset({ pcm: res.pcm, sampleRate: res.sampleRate, bpm: effectiveBpm, timeAnchors: activePattern.timeAnchors, hasAnacrusis, beatsPerMeasure, expectedT1Sec: getPatternT1OffsetSec(hasAnacrusis, measureDuration) });
    const cleanPCM = rebuildCanonicalCleanAudio({ rawPCM: res.pcm, sampleRate: res.sampleRate, bpm: effectiveBpm, measuresCount, beatsPerMeasure, hasAnacrusis, trimStartSec: 0, trimEndSec: trimEnd, t1OffsetSec: snappedT1 });
    const rec = { pcm: res.pcm, sampleRate: res.sampleRate, recordedBpm: effectiveBpm, t1OffsetSec: snappedT1 };
    updatePatternAndVariant(activePattern.id, activeVariant.variantKey, { recordingResult: rec, trimStartSec: 0, trimEndSec: trimEnd, t1OffsetSec: snappedT1, rawAudioSamples: cleanPCM, hasCanonicalAlignment: false as any, correctedAudioSamples: null, melodyneRegions: [] }, { recordingResult: rec, trimStartSec: 0, trimEndSec: trimEnd, t1OffsetSec: snappedT1 });
    setRecordedSampleRate(res.sampleRate);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (res.durationSec > 10 || res.durationSec > totalDurationSec * 1.8) setIsSlicerOpen(true);
  }, [activePattern.id, activePattern.timeAnchors, activeVariant.variantKey, hasAnacrusis, measureDuration, effectiveBpm, beatsPerMeasure, measuresCount, totalDurationSec, updatePatternAndVariant, setRecordedSampleRate]);

  const handlePackReady = useCallback((_pack: unknown, meta?: { trimStartSec: number; trimEndSec: number; t1OffsetSec: number }) => {
    if (!rawPCM) return;
    const trimStartSec = meta?.trimStartSec ?? activeVariant.trimStartSec, trimEndSec = meta?.trimEndSec ?? activeVariant.trimEndSec;
    const rawT1 = meta?.t1OffsetSec ?? activeVariant.t1OffsetSec ?? activePattern.t1OffsetSec ?? activePattern.recordingResult?.t1OffsetSec;
    const res = extractPatternMelodicData({ rawPCM, sampleRate, bpm: effectiveBpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, hasAnacrusis, trimStartSec, trimEndSec, t1OffsetSec: rawT1, referencePitch: effectivePitch, pitchShiftSemitones: activeVariant.pitchShiftSemitones, tessitura: activePattern.tessitura, assignedLyricsText: activePattern.assignedLyricsText, timeAnchors: activePattern.timeAnchors, lowCutEnabled: activeVariant.lowCutEnabled, enableTonePolish: activeVariant.enableTonePolish !== false });
    updatePatternAndVariant(activePattern.id, activeVariant.variantKey, { pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve, anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, trimStartSec, trimEndSec, t1OffsetSec: rawT1, isMidiInitialized: true, midiLocked: false, hasCanonicalAlignment: true as any, correctedAudioSamples: null, melodyneRegions: [], stepStatus: { ...(activePattern.stepStatus || {}), recorded: true, trimmed: true } }, { trimStartSec, trimEndSec, t1OffsetSec: rawT1 });
    setActiveLivret('melodia');
  }, [rawPCM, sampleRate, effectiveBpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, hasAnacrusis, activeVariant, effectivePitch, activePattern, updatePatternAndVariant, setActiveLivret]);

  const curT1 = activeVariant.t1OffsetSec ?? activePattern.t1OffsetSec ?? activePattern.recordingResult?.t1OffsetSec;

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <PatternCompassBar />
      <TwinPatternsManagerBar />
      {isLongAudio && <LongAudioSlicerBanner durationSec={audioDurationSec} onOpenSlicer={() => setIsSlicerOpen(true)} />}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs font-mono font-bold text-[var(--cordel-secondary-text)] uppercase tracking-wider">{activePattern.name} ({activePattern.measuresCount}{t('measureAbbr')})</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="cordel-btn px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-theme-accent" /><span>{t('calageDirectImportBtn')}</span>
          </button>
          <button type="button" onClick={() => setIsSlicerOpen(true)} className="cordel-btn px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
            <Scissors className="w-3.5 h-3.5 text-theme-wood" /><span>{t('calageOpenSlicerBtn')}</span>
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
          initialT1OffsetSec={curT1} hasAnacrusis={hasAnacrusis} timeAnchors={activePattern.timeAnchors}
          harmonyGrid={activePattern.harmonyGrid} harmonyConfig={project.harmonyConfig ?? { enabled: true, profile: 'maracatu', volume: 0.7 }}
          pitchShiftSemitones={activeVariant.pitchShiftSemitones}
          onUpdateGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })} onUpdateHarmonyConfig={updateHarmonyConfig}
          onReset={() => updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null })}
          onTrimChange={(s, e) => syncCalageState(s, e, curT1 ?? getPatternT1OffsetSec(hasAnacrusis, measureDuration))}
          onT1OffsetChange={(t1) => syncCalageState(activeVariant.trimStartSec ?? 0, activeVariant.trimEndSec ?? audioDurationSec, t1)}
          onPackReady={handlePackReady}
        />
      ) : (
        <CalageEmptyNotice onDirectImport={() => fileInputRef.current?.click()} onOpenSlicer={() => setIsSlicerOpen(true)} />
      )}
      <MasterTakeSlicerModal isOpen={isSlicerOpen} onClose={() => setIsSlicerOpen(false)} initialAudio={activeAudio} defaultRole={activePattern.role} />
    </div>
  );
};
