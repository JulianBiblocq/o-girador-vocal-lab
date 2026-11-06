/**
 * useQuickScaleDetector.ts
 * Détection rapide de tonalité et mode (Majeur, Mineur naturel, Mixolydien, Dorien)
 * sur 4 secondes au micro ou depuis les prises enregistrées du projet (< 120 lignes).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import type { PitchCurvePoint } from '../types/vocalPack.types';
import { getSharedAudioContext } from '../audio/sharedAudioContext';
import { detectRealtimePitch } from '../audio/realtimePitchDetector';
import { detectBestScaleFromPitchCurve, SCALE_DEFINITIONS, type ScaleType } from '../audio/scaleQuantizer';

export interface QuickScaleSuggestion {
  tonic: string;
  scaleType: ScaleType;
  label: string;
}

const SOLFEGE_LABELS: Record<string, string> = {
  C: 'Do', 'C#': 'Do#', D: 'Ré', 'D#': 'Ré#', E: 'Mi', F: 'Fa',
  'F#': 'Fa#', G: 'Sol', 'G#': 'Sol#', A: 'La', 'A#': 'Sib', B: 'Si',
};

export function formatScaleDisplayLabel(tonic: string, scaleType: ScaleType): string {
  const clean = (tonic || 'C').replace(/\d+$/, '').trim();
  const rootFr = SOLFEGE_LABELS[clean] || clean;
  const modeLabel = SCALE_DEFINITIONS[scaleType]?.label.split('/')[0].trim() || 'Majeur';
  return `${rootFr} ${modeLabel}`;
}

export function useQuickScaleDetector(
  project: ToadaProject,
  loadProject: (p: ToadaProject) => void,
  selectedDeviceId?: string
) {
  const [isListeningScale, setIsListeningScale] = useState(false);
  const [suggestion, setSuggestion] = useState<QuickScaleSuggestion | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);

  const stopMicCapture = useCallback(() => {
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
    setIsListeningScale(false);
  }, []);

  useEffect(() => () => stopMicCapture(), [stopMicCapture]);

  // Auto-détection dès qu'une prise est enregistrée si aucune tonalité n'était fixée
  useEffect(() => {
    if (project.toadaMeta?.tonaliteDefaut) return;
    const allPoints: PitchCurvePoint[] = [];
    for (const pat of project.patterns) {
      if (pat.rawPitchCurve?.length) allPoints.push(...pat.rawPitchCurve);
    }
    if (allPoints.length >= 12 && !suggestion) {
      const res = detectBestScaleFromPitchCurve(allPoints);
      setSuggestion({
        tonic: res.tonic,
        scaleType: res.scaleType,
        label: formatScaleDisplayLabel(res.tonic, res.scaleType),
      });
    }
  }, [project.patterns, project.toadaMeta?.tonaliteDefaut, suggestion]);

  const applyScaleToProject = useCallback((tonic: string, scaleType: ScaleType) => {
    const cleanTonic = tonic.replace(/\d+$/, '');
    const keyLabel = formatScaleDisplayLabel(cleanTonic, scaleType);
    const refPitch = `${cleanTonic}4`;
    loadProject({
      ...project,
      toadaMeta: { ...(project.toadaMeta || {}), tonaliteDefaut: keyLabel },
      patterns: project.patterns.map((p) => ({ ...p, referencePitch: refPitch })),
    });
    setSuggestion(null);
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Gamme verrouillée sur toute la Toada : ${keyLabel}`, type: 'success' },
    }));
  }, [project, loadProject]);

  const startQuickScaleListen = useCallback(async () => {
    if (isListeningScale) { stopMicCapture(); return; }
    try {
      const ctx = await getSharedAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId && selectedDeviceId !== 'default' ? { deviceId: { exact: selectedDeviceId } } : true,
      });
      streamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(2048), collected: PitchCurvePoint[] = [];
      const t0 = performance.now();
      setIsListeningScale(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const { pitchMidi, rms, clarity } = detectRealtimePitch(buf, ctx.sampleRate);
        if (pitchMidi >= 36 && pitchMidi <= 92 && rms >= 0.015) {
          collected.push({ timeSec: (performance.now() - t0) / 1000, midiFloat: pitchMidi, confidence: clarity ?? 0.85 });
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

      timerRef.current = window.setTimeout(() => {
        stopMicCapture();
        try { src.disconnect(); analyser.disconnect(); } catch {}
        if (collected.length < 4) {
          const fallbackPts = project.patterns.flatMap((p) => p.rawPitchCurve || []);
          if (fallbackPts.length >= 4) collected.push(...fallbackPts);
        }
        if (collected.length >= 4) {
          const res = detectBestScaleFromPitchCurve(collected);
          setSuggestion({ tonic: res.tonic, scaleType: res.scaleType, label: formatScaleDisplayLabel(res.tonic, res.scaleType) });
        }
      }, 3800);
    } catch {
      stopMicCapture();
    }
  }, [isListeningScale, stopMicCapture, selectedDeviceId, project.patterns]);

  return { isListeningScale, suggestion, startQuickScaleListen, applyScaleToProject, clearSuggestion: () => setSuggestion(null) };
}

