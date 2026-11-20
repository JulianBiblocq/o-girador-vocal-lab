/**
 * useMestreDictationController.ts
 * Logique temps réel 60 FPS, Bourdon, gel anti-repisse et alignement forcé de MestreNoteDictationModal (< 120 lignes).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UnifiedPitchDialLiveState } from '../common/UnifiedPitchDialCanvas';
import type { MicLevel } from '../common/MicLevelMeter';
import { SlowNoteDetectorEngine } from '../../audio/slowNoteDetectorEngine';
import { sharedTonicDrone, playReferenceNotePing, resolveTonicDroneMidi } from '../../audio/tonicDroneSynth';
import { alignStepsWithReferenceMidiNotes, formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../../audio/forcedMelodyAligner';
import { resolveProjectDualScale } from '../../utils/scaleTranspositionHelper';
import { detectBestScaleFromPitchCurve } from '../../audio/scaleQuantizer';
import { applyDetectedScaleToProject } from '../../audio/projectScaleAnalyzer';
import { buildUpdatedVocalPackExport } from '../../audio/livretResetHelper';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { sanitizePitchHz } from '../../utils/pitchHzContract';

export function useMestreDictationController(isOpen: boolean, onClose: () => void) {
  const { project, activePattern, updatePattern, loadProject } = useToadaProject();
  const { selectedDeviceId } = useAudioHardware();
  const { t, language } = useLanguage();

  const dual = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const refHz = sanitizePitchHz(project.referencePitchHz);
  const [keyView, setKeyView] = useState<'sung' | 'troupe'>('sung');
  const [isMicOn, setIsMicOn] = useState(false), [isDroneOn, setIsDroneOn] = useState(false);
  const [curMidi, setCurMidi] = useState<number>(() => activePattern.referenceMidiNotes?.[0] ?? resolveTonicDroneMidi(dual.sungScaleRoot, 4));
  const [notes, setNotes] = useState<number[]>(() => activePattern.referenceMidiNotes ? [...activePattern.referenceMidiNotes] : []);

  const viewOffset = keyView === 'troupe' ? dual.transpositionSemitones : 0;
  const activeTonic = keyView === 'troupe' ? dual.troupeScaleRoot : dual.sungScaleRoot;
  const detectorRef = useRef<SlowNoteDetectorEngine | null>(null);
  const seqTimerIdsRef = useRef<number[]>([]), lastShownMidiRef = useRef<number>(curMidi), viewOffsetRef = useRef(viewOffset);
  viewOffsetRef.current = viewOffset;
  const micLevelRef = useRef<MicLevel>({ rms: 0, peak: 0 });

  const liveDialRef = useRef<UnifiedPitchDialLiveState>({
    isVoiced: false, centsDelta: 0, holdProgress01: 0,
    primaryNoteLabel: formatPaperNoteCode(curMidi + viewOffset),
    secondaryLabel: formatSolfegeNoteWithOctave(curMidi + viewOffset, language),
  });

  useEffect(() => { setNotes(activePattern.referenceMidiNotes ? [...activePattern.referenceMidiNotes] : []); }, [activePattern.id, isOpen]);

  useEffect(() => {
    liveDialRef.current.primaryNoteLabel = formatPaperNoteCode(curMidi + viewOffset);
    liveDialRef.current.secondaryLabel = formatSolfegeNoteWithOctave(curMidi + viewOffset, language);
    if (isDroneOn) sharedTonicDrone.updatePitch(activeTonic, refHz);
  }, [curMidi, viewOffset, language, isDroneOn, activeTonic, refHz]);

  const stopAllLocalAudio = useCallback(() => {
    seqTimerIdsRef.current.forEach((id) => window.clearTimeout(id)); seqTimerIdsRef.current = [];
    detectorRef.current?.stop(); detectorRef.current = null; setIsMicOn(false); micLevelRef.current.rms = 0; micLevelRef.current.peak = 0;
    sharedTonicDrone.stopImmediate(); setIsDroneOn(false);
  }, []);

  useEffect(() => { if (!isOpen) stopAllLocalAudio(); return () => stopAllLocalAudio(); }, [isOpen, stopAllLocalAudio]);

  const toggleMic = useCallback(async () => {
    if (isMicOn) { detectorRef.current?.stop(); detectorRef.current = null; setIsMicOn(false); liveDialRef.current.isVoiced = false; micLevelRef.current.rms = 0; micLevelRef.current.peak = 0; return; }
    const det = new SlowNoteDetectorEngine(); detectorRef.current = det;
    try {
    await det.start({ requiredHoldMs: 420, toleranceCents: 35, referencePitchHz: refHz, deviceId: selectedDeviceId }, (tk) => {
      micLevelRef.current.rms = tk.rms; micLevelRef.current.peak = tk.peak;
      const m = tk.displayedMidiNote > 0 ? tk.displayedMidiNote : lastShownMidiRef.current, disp = m + viewOffsetRef.current;
      liveDialRef.current = {
        isVoiced: tk.isVoiced, isFrozen: tk.isFrozen, centsDelta: tk.centsDelta, holdProgress01: tk.holdProgress01,
        primaryNoteLabel: formatPaperNoteCode(disp), secondaryLabel: formatSolfegeNoteWithOctave(disp, language),
      };
      if (tk.displayedMidiNote > 0 && tk.displayedMidiNote !== lastShownMidiRef.current) { lastShownMidiRef.current = tk.displayedMidiNote; setCurMidi(tk.displayedMidiNote); }
      if (tk.justValidatedMidi != null) setNotes((prev) => [...prev, tk.justValidatedMidi!]);
    });
    setIsMicOn(true);
    } catch (err) {
      console.warn('[Cherche-Notes] Micro indisponible :', err); det.stop(); detectorRef.current = null; setIsMicOn(false);
    }
  }, [isMicOn, refHz, selectedDeviceId, language]);

  const playNoteWithFreeze = useCallback(async (sungMidi: number, durMs = 560) => {
    const clamped = Math.max(36, Math.min(84, Math.round(sungMidi)));
    lastShownMidiRef.current = clamped; setCurMidi(clamped);
    detectorRef.current?.freezeForMs(durMs);
    await playReferenceNotePing(clamped + viewOffset, refHz, durMs);
  }, [viewOffset, refHz]);

  const handlePlaySequence = useCallback(() => {
    seqTimerIdsRef.current.forEach((id) => window.clearTimeout(id)); seqTimerIdsRef.current = [];
    detectorRef.current?.freezeForMs(notes.length * 460 + 200);
    notes.forEach((m, i) => { seqTimerIdsRef.current.push(window.setTimeout(() => { void playReferenceNotePing(m + viewOffset, refHz, 400); }, i * 440)); });
  }, [notes, viewOffset, refHz]);

  const handleAttach = useCallback(() => {
    if (!notes.length) return;
    const beatsPerM = getBeatsPerMeasure(project.timeSignature), hasAnac = activePattern.hasAnacrusis !== false;
    const resPerB = activePattern.pack?.metadata.beatResolutions?.[0] || 4, anacLen = hasAnac ? beatsPerM * resPerB : 0;
    const combined = [...(hasAnac ? (activePattern.anacrusisSteps || []) : []), ...(activePattern.mainSteps || [])];
    const aligned = combined.length > 0 ? alignStepsWithReferenceMidiNotes({ steps: combined, referenceMidiNotes: notes, pitchCurve: activePattern.rawPitchCurve || activePattern.pitchCurve || [], beatDurationSec: 60 / (activePattern.bpm || project.bpm || 88) }) : [];
    const nextPatch: Record<string, unknown> = {
      referenceMidiNotes: [...notes],
      ...(aligned.length > 0 ? {
        anacrusisSteps: hasAnac ? aligned.slice(0, anacLen) : [],
        mainSteps: (hasAnac ? aligned.slice(anacLen) : aligned).map((s, idx) => ({ ...s, stepIndex: idx })),
        isMidiInitialized: true,
        ...(activePattern.pack ? { pack: buildUpdatedVocalPackExport(activePattern.pack, aligned, hasAnac, beatsPerM, activePattern.pitchCurve || []) } : {}),
      } : {}),
    };
    if (!dual.isLocked && notes.length >= 2) {
      const detScale = detectBestScaleFromPitchCurve(notes.map((m, i) => ({ timeSec: i * 0.4, midiFloat: m, confidence: 0.95 })), dual.sungScaleRoot);
      loadProject(applyDetectedScaleToProject({ ...project, patterns: project.patterns.map((p) => p.id === activePattern.id ? { ...p, ...nextPatch } : p) }, detScale.tonic, detScale.scaleType, undefined, language));
    } else {
      updatePattern(activePattern.id, nextPatch as any);
    }
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('dialAttachedToast', { count: notes.length, name: activePattern.name }) } }));
    onClose();
  }, [notes, project, activePattern, dual, language, loadProject, updatePattern, t, onClose]);

  return { t, language, activePattern, dual, refHz, keyView, setKeyView, isMicOn, toggleMic, isDroneOn, setIsDroneOn, curMidi, notes, setNotes, viewOffset, activeTonic, liveDialRef, micLevelRef, playNoteWithFreeze, handlePlaySequence, handleAttach };
}
