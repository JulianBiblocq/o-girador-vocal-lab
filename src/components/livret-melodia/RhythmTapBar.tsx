/**
 * RhythmTapBar.tsx
 * Barre de capture rythmique live (Barre Espace / Clavier Maître MIDI / Bouton TAP)
 * avec 1 mesure de décompte, auto-compensation de latence et décalage global ±1 double (< 125 lignes).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { useWebMidiInput } from '../../hooks/useWebMidiInput';
import { convertTapsToSteps, shiftAllStepsBySubdivision, realignStepsToVocalOnsets } from '../../audio/RhythmTapCaptureEngine';
import { getSharedAudioContext } from '../../audio/sharedAudioContext';
import { scheduleWoodClick } from '../../audio/metronomeAudioNodes';
import { Circle, Square, Piano, Drum, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';

export interface RhythmTapBarProps {
  allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[]; pcm: Float32Array; sampleRate: number;
  bpm: number; beatsPerMeasure: number; stepsPerBeat: number; gridStartSec: number; totalDurationSec: number;
  allowedPitchClasses: Set<number>; lyricsText?: string; isPlaying: boolean; getPlayheadSec: () => number;
  onStartVoicePlayback: () => void; onStopVoicePlayback: () => void;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void; onCommitHistory: () => void;
}

export const RhythmTapBar: React.FC<RhythmTapBarProps> = ({
  allSteps, pitchCurve, pcm, sampleRate, bpm, beatsPerMeasure, stepsPerBeat,
  gridStartSec, totalDurationSec, allowedPitchClasses, lyricsText,
  isPlaying, getPlayheadSec, onStartVoicePlayback, onStopVoicePlayback, onUpdateSteps, onCommitHistory,
}) => {
  const [phase, setPhase] = useState<'idle' | 'countin' | 'recording'>('idle');
  const [countInBeat, setCountInBeat] = useState(4);
  const [useMidiPitches, setUseMidiPitches] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepDurSec = (60 / Math.max(30, bpm)) / Math.max(1, stepsPerBeat);

  const { midiConnected, midiDeviceName, taps, getTapsSnapshot, clearTaps, triggerManualTapDown, triggerManualTapUp } = useWebMidiInput({
    isCapturing: phase === 'recording',
    getCurrentTimeSec: () => Math.max(0, getPlayheadSec()),
  });

  const finishCapture = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    const recorded = getTapsSnapshot();
    setPhase('idle'); onStopVoicePlayback();
    if (recorded.length > 0) {
      onCommitHistory();
      const { steps, latencyMs } = convertTapsToSteps({
        taps: recorded, existingSteps: allSteps, pitchCurve, pcm, sampleRate,
        gridStartSec, stepDurationSec: stepDurSec, stepsPerBeat, useMidiPitches,
        allowedPitchClasses, lyricsText,
      });
      setLastLatencyMs(latencyMs); onUpdateSteps(steps, true);
    }
  }, [getTapsSnapshot, onStopVoicePlayback, onCommitHistory, allSteps, pitchCurve, pcm, sampleRate, gridStartSec, stepDurSec, stepsPerBeat, useMidiPitches, allowedPitchClasses, lyricsText, onUpdateSteps]);

  useEffect(() => {
    if (phase === 'recording' && !isPlaying && taps.length > 0) finishCapture();
  }, [phase, isPlaying, taps.length, finishCapture]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const handleToggleCapture = async () => {
    if (phase !== 'idle') { finishCapture(); return; }
    clearTaps(); setPhase('countin'); setCountInBeat(beatsPerMeasure);
    const beatMs = (60 / Math.max(30, bpm)) * 1000;
    try {
      const ctx = await getSharedAudioContext(), clickNodes: AudioNode[] = [];
      for (let b = 0; b < beatsPerMeasure; b++) scheduleWoodClick(ctx, ctx.currentTime + 0.03 + b * (beatMs / 1000), b === 0, clickNodes);
    } catch {}
    let rem = beatsPerMeasure;
    timerRef.current = window.setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setPhase('recording'); onStartVoicePlayback();
        timerRef.current = window.setTimeout(() => finishCapture(), (totalDurationSec + 0.4) * 1000) as unknown as number;
      } else setCountInBeat(rem);
    }, beatMs);
  };

  return (
    <div className="cordel-card px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 rounded text-[11px] font-mono">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleToggleCapture} className={`px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${phase !== 'idle' ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-theme-wood text-[#f4ecd8] border-amber-600/50 hover:opacity-95'}`}>
          {phase !== 'idle' ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 fill-red-400 text-red-400" />}
          <span>{phase === 'countin' ? `Décompte : ${countInBeat}...` : phase === 'recording' ? `⏹ Valider (${taps.length} frappes)` : 'Taper le Rythme (Espace / Clavier MIDI)'}</span>
        </button>
        {phase === 'recording' && (
          <button type="button" onPointerDown={() => triggerManualTapDown()} onPointerUp={() => triggerManualTapUp()} className="px-3 py-1 rounded bg-amber-500 text-stone-950 font-black flex items-center gap-1 cursor-pointer active:scale-95">
            <Drum className="w-3.5 h-3.5" /><span>TAP (Maintenir = Tenue)</span>
          </button>
        )}
        <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${midiConnected ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold' : 'opacity-65 border-transparent'}`}>
          <Piano className="w-3.5 h-3.5" /><span>{midiConnected ? `Clavier MIDI détecté${midiDeviceName ? ` (${midiDeviceName})` : ''}` : 'Barre Espace prête'}</span>
        </span>
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={useMidiPitches} onChange={(e) => setUseMidiPitches(e.target.checked)} className="accent-amber-600 cursor-pointer" />
          <span>Prendre aussi les notes du clavier MIDI</span>
        </label>
        {lastLatencyMs !== null && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Auto-latence : {lastLatencyMs >= 0 ? `-${lastLatencyMs}` : `+${Math.abs(lastLatencyMs)}`} ms</span>}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => { onCommitHistory(); onUpdateSteps(shiftAllStepsBySubdivision(allSteps, -1), true); }} className="px-2 py-0.5 cordel-card-sm rounded font-bold flex items-center gap-0.5 cursor-pointer hover:border-amber-500" title="Décaler toutes les briques et syllabes d'une double-croche vers la gauche"><ChevronLeft className="w-3 h-3" /><span>-1 double</span></button>
        <button type="button" onClick={() => { onCommitHistory(); onUpdateSteps(shiftAllStepsBySubdivision(allSteps, 1), true); }} className="px-2 py-0.5 cordel-card-sm rounded font-bold flex items-center gap-0.5 cursor-pointer hover:border-amber-500" title="Décaler toutes les briques et syllabes d'une double-croche vers la droite"><span>+1 double</span><ChevronRight className="w-3 h-3" /></button>
        <button type="button" onClick={() => { onCommitHistory(); onUpdateSteps(realignStepsToVocalOnsets(allSteps, pcm, sampleRate, gridStartSec, stepDurSec), true); }} className="px-2 py-0.5 cordel-card-sm rounded font-bold flex items-center gap-1 cursor-pointer text-amber-600 dark:text-amber-400 hover:border-amber-500" title="Recaler automatiquement la latence des briques sur les attaques de voyelles de la voix"><Crosshair className="w-3 h-3" /><span>Recaler sur les attaques de la voix</span></button>
      </div>
    </div>
  );
};
