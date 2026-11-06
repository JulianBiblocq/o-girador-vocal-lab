/**
 * ScaleLockBar.tsx
 * Bandeau de Gamme Maracatu Débrayable ([ 🔓 Gamme débrayée (Libre) ] ⟷ [ 🔒 Verrouiller sur la gamme ])
 * et détection automatique sur la voix (< 125 lignes).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PitchCurvePoint } from '../../types/vocalPack.types';
import { type ScaleType, buildAllowedPitchClasses, detectBestScaleFromPitchCurve, getTonicSemitone } from '../../audio/scaleQuantizer';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { detectRealtimePitch } from '../../audio/realtimePitchDetector';
import { useWebMidiInput } from '../../hooks/useWebMidiInput';
import { Lock, Unlock, Target, Mic, Piano } from 'lucide-react';

const SOLFEGE_LABELS = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

const SCALE_MODES: Array<{ key: ScaleType; label: string }> = [
  { key: 'chromatic', label: 'Libre / Chromatique' }, { key: 'major', label: 'Majeur' },
  { key: 'natural_minor', label: 'Mineur naturel' }, { key: 'mixolydian', label: 'Mixolydien (Nordeste)' },
  { key: 'dorian', label: 'Dorien' }, { key: 'harmonic_minor', label: 'Mineur harm.' },
  { key: 'pentatonic_minor', label: 'Pentatonique min.' }, { key: 'pentatonic_major', label: 'Pentatonique maj.' },
];

export interface ScaleLockBarProps {
  tonic: string; scaleType: ScaleType; customPitchClasses?: number[] | null;
  pitchCurve: PitchCurvePoint[]; defaultKeyStr?: string;
  onUpdateScale: (tonic: string, scaleType: ScaleType, customPitchClasses: number[] | null) => void;
  onAnalyzeFullProjectScale?: () => void;
}

export const ScaleLockBar: React.FC<ScaleLockBarProps> = ({
  tonic, scaleType, customPitchClasses = null, pitchCurve, defaultKeyStr, onUpdateScale, onAnalyzeFullProjectScale,
}) => {
  const [isLearning, setIsLearning] = useState(false), [countdown, setCountdown] = useState(5);
  const [lastActiveMode, setLastActiveMode] = useState<ScaleType>('natural_minor');
  const learnedSetRef = useRef<Set<number>>(new Set()), streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null), rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (scaleType !== 'chromatic') setLastActiveMode(scaleType);
  }, [scaleType]);

  const allowedSet = buildAllowedPitchClasses(tonic, scaleType, customPitchClasses);
  const isLocked = scaleType !== 'chromatic' || (customPitchClasses !== null && customPitchClasses.length < 12);
  const tonicIdx = getTonicSemitone(tonic);
  const activeModeLabel = SCALE_MODES.find((m) => m.key === (isLocked ? scaleType : lastActiveMode))?.label || 'Mineur';

  useWebMidiInput({
    isCapturing: isLearning,
    onMidiNoteOn: (midiNote) => { if (isLearning) learnedSetRef.current.add(((midiNote % 12) + 12) % 12); },
  });

  const stopLearning = useCallback((applyResult: boolean) => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setIsLearning(false);
    if (!applyResult) return;
    if (learnedSetRef.current.size === 0 && pitchCurve.length > 0) {
      const det = detectBestScaleFromPitchCurve(pitchCurve, defaultKeyStr);
      onUpdateScale(det.tonic, det.scaleType, null);
    } else if (learnedSetRef.current.size > 0) {
      onUpdateScale(tonic, scaleType === 'chromatic' ? lastActiveMode : scaleType, Array.from(learnedSetRef.current).sort((a, b) => a - b));
    }
  }, [pitchCurve, defaultKeyStr, tonic, scaleType, lastActiveMode, onUpdateScale]);

  useEffect(() => () => stopLearning(false), [stopLearning]);

  const startLearning = async () => {
    if (isLearning) { stopLearning(true); return; }
    learnedSetRef.current = new Set(); setIsLearning(true); setCountdown(5);
    let audioCtx: AudioContext | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream), analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const pollPitch = () => {
        analyser.getFloatTimeDomainData(buf);
        const det = detectRealtimePitch(buf, audioCtx!.sampleRate);
        if (det.pitchMidi >= 36 && det.pitchMidi <= 96) learnedSetRef.current.add(((Math.round(det.pitchMidi) % 12) + 12) % 12);
        rafRef.current = requestAnimationFrame(pollPitch);
      };
      rafRef.current = requestAnimationFrame(pollPitch);
    } catch {}
    let rem = 5;
    timerRef.current = window.setInterval(() => {
      rem -= 1;
      if (rem <= 0) { if (audioCtx) audioCtx.close().catch(() => {}); stopLearning(true); }
      else setCountdown(rem);
    }, 1000);
  };

  return (
    <div className="cordel-card px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 rounded text-[11px] font-mono">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onUpdateScale(tonic, isLocked ? 'chromatic' : lastActiveMode, null)}
          className={`px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${
            isLocked
              ? 'bg-emerald-700 text-white border-emerald-500 shadow-2xs'
              : 'bg-stone-800/80 text-amber-300 border-amber-500/50 hover:bg-stone-700'
          }`}
          title="Débrayer ou verrouiller la gamme à tout moment en 1 clic"
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isLocked ? `🔒 Gamme verrouillée : ${SOLFEGE_LABELS[tonicIdx]} ${activeModeLabel}` : '🔓 Gamme débrayée (Libre)'}</span>
        </button>

        <select value={tonic} onChange={(e) => onUpdateScale(e.target.value, isLocked ? scaleType : lastActiveMode, null)} className="cordel-card-sm px-1.5 py-1 font-bold text-theme-accent rounded cursor-pointer">
          {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{SOLFEGE_LABELS[i]} ({n})</option>)}
        </select>
        <select value={scaleType} onChange={(e) => onUpdateScale(tonic, e.target.value as ScaleType, null)} className="cordel-card-sm px-1.5 py-1 font-bold text-theme-accent rounded cursor-pointer">
          {SCALE_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>

        <button
          type="button"
          onClick={() => {
            if (onAnalyzeFullProjectScale) onAnalyzeFullProjectScale();
            const det = detectBestScaleFromPitchCurve(pitchCurve, defaultKeyStr);
            onUpdateScale(det.tonic, det.scaleType, null);
          }}
          className="px-2.5 py-1 rounded cordel-card-sm hover:border-amber-500 font-bold flex items-center gap-1 cursor-pointer text-amber-600 dark:text-amber-300"
          title="Analyser la gamme sur l'ensemble des phrases enregistrées du chant"
        >
          <Target className="w-3.5 h-3.5" /><span>🔍 Analyser la gamme du chant</span>
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {SOLFEGE_LABELS.map((lbl, pc) => (
          <button key={pc} type="button" onClick={() => { const next = new Set(allowedSet); if (next.has(pc) && next.size > 1) next.delete(pc); else next.add(pc); onUpdateScale(tonic, scaleType === 'chromatic' ? lastActiveMode : scaleType, Array.from(next).sort((a, b) => a - b)); }} className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${allowedSet.has(pc) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-stone-500/10 text-theme-ink/40 border-transparent'}`}>{lbl}</button>
        ))}
        <button type="button" onClick={startLearning} className={`ml-1 px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer border ${isLearning ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/50'}`}>
          <Mic className="w-3 h-3" /><Piano className="w-3 h-3" /><span>{isLearning ? `${countdown}s...` : '5s'}</span>
        </button>
      </div>
    </div>
  );
};
