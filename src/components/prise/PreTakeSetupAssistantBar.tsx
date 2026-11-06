/**
 * PreTakeSetupAssistantBar.tsx
 * Bandeau guidé « Préparation avant de Chanter » en 3 étapes (1. Latence, 2. Tap Tempo & Baque, 3. Auto-Tonalité/Gamme) (< 135 lignes).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { isLatencyCalibrated, markLatencyCalibrated, getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { useQuickScaleDetector } from '../../hooks/useQuickScaleDetector';
import { Zap, Check, Drum, Mic, Lock, Settings, Loader2 } from 'lucide-react';

export const PreTakeSetupAssistantBar: React.FC = () => {
  const { project, activePattern, loadProject, updateScopedBpm } = useToadaProject();
  const { selectedDeviceId, selectedOutputDeviceId, recordedSampleRate } = useAudioHardware();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);

  const [calibrated, setCalibrated] = useState(() => isLatencyCalibrated(selectedDeviceId));
  const tapTimesRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);

  const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, recordedSampleRate);
  const latencyMs = getSavedLatencyOffsetMs(sig);
  const bpm = activePattern?.bpm ?? activePattern?.baseBpm ?? project.bpm ?? 88;
  const currentKey = project.toadaMeta?.tonaliteDefaut || activePattern?.referencePitch || 'C4';

  const { isListeningScale, suggestion, startQuickScaleListen, applyScaleToProject } = useQuickScaleDetector(
    project, loadProject, selectedDeviceId
  );

  useEffect(() => {
    setCalibrated(isLatencyCalibrated(selectedDeviceId));
    const onCal = () => setCalibrated(true);
    window.addEventListener('ogirador-latency-calibrated', onCal);
    return () => window.removeEventListener('ogirador-latency-calibrated', onCal);
  }, [selectedDeviceId]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const prev = tapTimesRef.current.filter((t) => now - t < 2600);
    const next = [...prev, now].slice(-6);
    tapTimesRef.current = next;
    setTapCount(next.length);
    if (next.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i - 1]);
      intervals.sort((a, b) => a - b);
      const medMs = intervals[Math.floor(intervals.length / 2)];
      const newBpm = Math.max(40, Math.min(220, Math.round(60000 / Math.max(200, medMs))));
      updateScopedBpm(newBpm);
    }
  }, [updateScopedBpm]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); handleTapTempo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTapTempo]);

  return (
    <div className="cordel-card p-2 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      {/* Étape 1 : Calage Latence Machine */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {!calibrated ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/60 text-amber-900 dark:text-amber-200">
            <span className="font-bold">⚠️ 1. Latence non calée sur cet appareil</span>
            <button
              type="button" onClick={() => setActiveLivret('reglages')}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3 h-3" /><span>Caler maintenant</span>
            </button>
            <button
              type="button" onClick={() => { markLatencyCalibrated(selectedDeviceId); setCalibrated(true); }}
              className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" /><span>Déjà calé</span>
            </button>
          </div>
        ) : (
          <button
            type="button" onClick={() => setActiveLivret('reglages')}
            className="px-2.5 py-1 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            title="Ouvrir les réglages de latence matérielle"
          >
            <span>✅ 1. Latence calée ({latencyMs} ms)</span>
            <Settings className="w-3 h-3 opacity-70" />
          </button>
        )}
      </div>

      {/* Étape 2 : Tempo & Tap Tempo (Baque / Métronome) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-1 cordel-card-sm rounded font-bold">
          🥁 2. Tempo Baque : <strong className="text-amber-600 dark:text-amber-400">{bpm} BPM</strong> ({project.timeSignature || '4/4'})
        </span>
        <button
          type="button" onClick={handleTapTempo}
          className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer hover:bg-amber-500/20"
          title="Cliquez 3 à 4 fois en rythme (ou appuyez sur la touche T) pour fixer le tempo du chant"
        >
          <Drum className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Tap Tempo {tapCount >= 2 ? `(${tapCount})` : ''}</span>
        </button>
      </div>

      {/* Étape 3 : Tonalité & Gamme Automatique */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-1 cordel-card-sm rounded font-bold">
          🎼 3. Gamme : <strong className="text-theme-accent">{currentKey}</strong>
        </span>
        <button
          type="button" onClick={startQuickScaleListen}
          className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 cursor-pointer transition-colors ${
            isListeningScale ? 'bg-red-700 text-white animate-pulse' : 'cordel-btn hover:bg-theme-accent/20'
          }`}
          title="Écoute 4 secondes au micro (ou analyse vos prises) pour détecter la tonalité et le mode Maracatu"
        >
          {isListeningScale ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5 text-theme-accent" />}
          <span>{isListeningScale ? 'Chantez 4s...' : '🎙️ Auto-Tonalité'}</span>
        </button>
        {suggestion && (
          <button
            type="button" onClick={() => applyScaleToProject(suggestion.tonic, suggestion.scaleType)}
            className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer shadow-xs"
            title="Verrouiller cette gamme détectée sur toute la Toada"
          >
            <Lock className="w-3 h-3" />
            <span>Verrouiller {suggestion.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

