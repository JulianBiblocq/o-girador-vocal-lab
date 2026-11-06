/**
 * PreTakeSetupAssistantBar.tsx
 * Bandeau guidé bilingue (FR / PT-BR) « Préparation avant de Chanter » en 3 étapes cohérentes :
 * 1. Latence matérielle (vérifiée via signature d'appareil), 2. Tempo (BPM + Tap), 3. Gamme unifiée (< 138 lignes).
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { isLatencyCalibrated } from '../../utils/latencyStorage';
import { buildDeviceSignature, getCalibratedLatency } from '../../utils/deviceSignature';
import { useQuickScaleDetector } from '../../hooks/useQuickScaleDetector';
import {
  analyzeFullProjectScale, applyDetectedScaleToProject, resolveProjectActiveScale,
  formatProjectScaleLabel, SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR,
} from '../../audio/projectScaleAnalyzer';
import { NOTE_NAMES } from '../../utils/noteUtils';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { useLanguage } from '../../i18n/LanguageContext';
import { Zap, Check, Drum, RefreshCw, HelpCircle, Unlock, Settings, Loader2 } from 'lucide-react';

const MODES_FR: Array<{ key: ScaleType; label: string }> = [
  { key: 'natural_minor', label: 'Mineur' }, { key: 'major', label: 'Majeur' },
  { key: 'mixolydian', label: 'Mixolydien' }, { key: 'dorian', label: 'Dorien' },
];
const MODES_BR: Array<{ key: ScaleType; label: string }> = [
  { key: 'natural_minor', label: 'Menor' }, { key: 'major', label: 'Maior' },
  { key: 'mixolydian', label: 'Mixolídio' }, { key: 'dorian', label: 'Dórico' },
];

export const PreTakeSetupAssistantBar: React.FC = () => {
  const { language } = useLanguage(), isBr = language === 'br';
  const solfegeNames = isBr ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES, modeList = isBr ? MODES_BR : MODES_FR;
  const { project, activePattern, loadProject, updateScopedBpm } = useToadaProject();
  const { selectedDeviceId, selectedOutputDeviceId, recordedSampleRate } = useAudioHardware();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);

  const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, recordedSampleRate);
  const [calibratedMs, setCalibratedMs] = useState<number | null>(() => getCalibratedLatency(sig));
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [selTonic, setSelTonic] = useState('A'), [selMode, setSelMode] = useState<ScaleType>('natural_minor');
  const tapTimesRef = useRef<number[]>([]), [tapCount, setTapCount] = useState(0);

  const bpm = activePattern?.bpm ?? activePattern?.baseBpm ?? project.bpm ?? 88;
  const { isListeningScale, suggestion, startQuickScaleListen, clearSuggestion } = useQuickScaleDetector(project, loadProject, selectedDeviceId);

  const projectAnalysis = useMemo(() => analyzeFullProjectScale(project.patterns, language), [project.patterns, language]);
  const resolvedScale = useMemo(() => resolveProjectActiveScale(project, language, projectAnalysis), [project, language, projectAnalysis]);
  const activeTonic = suggestion?.tonic || resolvedScale.tonic;
  const activeScaleType: ScaleType = suggestion?.scaleType || resolvedScale.scaleType;
  const activeScaleText = suggestion ? formatProjectScaleLabel(suggestion.tonic, suggestion.scaleType, language) : resolvedScale.label;

  useEffect(() => {
    setCalibratedMs(getCalibratedLatency(sig));
    const onCal = () => setCalibratedMs(getCalibratedLatency(sig));
    window.addEventListener('ogirador-latency-calibrated', onCal);
    return () => window.removeEventListener('ogirador-latency-calibrated', onCal);
  }, [sig]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now(), next = [...tapTimesRef.current.filter((t) => now - t < 2600), now].slice(-6);
    tapTimesRef.current = next; setTapCount(next.length);
    if (next.length >= 3) {
      const ivs = next.slice(1).map((t, i) => t - next[i]).sort((a, b) => a - b);
      updateScopedBpm(Math.max(40, Math.min(220, Math.round(60000 / Math.max(200, ivs[Math.floor(ivs.length / 2)])))));
    }
  }, [updateScopedBpm]);

  const applyScale = (tonic: string, mode: ScaleType) => {
    const nextProj = applyDetectedScaleToProject(project, tonic, mode, resolvedScale.referencePitch, language);
    loadProject(nextProj); clearSuggestion(); setIsEditingScale(false);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `${isBr ? 'Escala aplicada' : 'Gamme appliquée'} : ${nextProj.toadaMeta?.tonaliteDefaut}`, type: 'success' } }));
  };

  const isDeviceCalibrated = calibratedMs !== null && isLatencyCalibrated(selectedDeviceId);

  return (
    <div className="cordel-card p-2 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-1.5 flex-wrap">
        {!isDeviceCalibrated ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#9a3412]/15 border border-[#9a3412] text-[#9a3412] dark:text-amber-200 font-bold">
            <span>1. {isBr ? 'Latência não calibrada' : 'Latence non calée'}</span>
            <button type="button" onClick={() => setActiveLivret('reglages')} className="px-2 py-0.5 bg-[#9a3412] hover:opacity-90 text-white font-bold rounded flex items-center gap-1 cursor-pointer">
              <Zap className="w-3 h-3" /><span>{isBr ? 'Calibrar' : 'Calibrer'}</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setActiveLivret('reglages')} className="px-2.5 py-1 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer">
            <Check className="w-3.5 h-3.5" />
            <span>1. {isBr ? `Latência calibrada (${calibratedMs} ms)` : `Latence calée (${calibratedMs} ms)`}</span>
            <Settings className="w-3 h-3 opacity-70" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-1 cordel-card-sm rounded font-bold">
          2. {isBr ? 'Andamento :' : 'Tempo :'} <strong className="text-[#9a3412] dark:text-amber-300">{bpm} BPM</strong> ({project.timeSignature || '4/4'})
        </span>
        <button type="button" onClick={handleTapTempo} className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer">
          <Drum className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" /><span>Tap Tempo {tapCount >= 2 ? `(${tapCount})` : ''}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-1 cordel-card-sm rounded font-bold">
          3. {isBr ? 'Escala detectada :' : 'Gamme détectée :'} <strong className="text-[#9a3412] dark:text-amber-300">{activeScaleText}</strong>
        </span>
        <button type="button" onClick={() => applyScale(activeTonic, activeScaleType)} className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer">
          <Check className="w-3 h-3" /><span>{isBr ? 'Validar' : 'Valider'}</span>
        </button>
        <button type="button" onClick={() => { setSelTonic(activeTonic); setSelMode(activeScaleType === 'chromatic' ? 'natural_minor' : activeScaleType); setIsEditingScale((v) => !v); }} className="px-2 py-1 rounded cordel-btn font-bold flex items-center gap-1 cursor-pointer">
          <RefreshCw className="w-3 h-3 text-[#9a3412] dark:text-amber-300" /><span>{isBr ? 'Alterar ▾' : 'Changer ▾'}</span>
        </button>
        {isEditingScale && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded cordel-card-sm">
            <select value={selTonic} onChange={(e) => setSelTonic(e.target.value)} className="bg-transparent font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">
              {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeNames[i]} ({n})</option>)}
            </select>
            <select value={selMode} onChange={(e) => setSelMode(e.target.value as ScaleType)} className="bg-transparent font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">
              {modeList.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <button type="button" onClick={() => applyScale(selTonic, selMode)} className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold cursor-pointer">OK</button>
          </div>
        )}
        <button type="button" onClick={() => projectAnalysis.analyzedPatternsCount > 0 ? applyScale(projectAnalysis.tonic, projectAnalysis.scaleType) : startQuickScaleListen()} className="px-2 py-1 rounded cordel-card-sm font-bold flex items-center gap-1 cursor-pointer">
          {isListeningScale ? <Loader2 className="w-3 h-3 animate-spin text-red-600" /> : <HelpCircle className="w-3 h-3 text-[#9a3412] dark:text-amber-300" />}
          <span>{isListeningScale ? (isBr ? 'Cante 4s...' : 'Chantez 4s...') : (isBr ? 'Não sei' : 'Je ne sais pas')}</span>
        </button>
        <button type="button" onClick={() => applyScale(activeTonic, 'chromatic')} className="px-2 py-1 rounded bg-[#451a03] text-[#f4ecd8] font-bold flex items-center gap-1 cursor-pointer">
          <Unlock className="w-3 h-3" /><span>{isBr ? 'Desativar' : 'Débrayer'}</span>
        </button>
      </div>
    </div>
  );
};
