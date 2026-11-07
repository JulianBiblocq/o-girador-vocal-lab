/**
 * PreTakeSetupAssistantBar.tsx
 * Bandeau guidé bilingue (FR / PT-BR) « Préparation avant de Chanter » :
 * 1. Latence, 2. Tempo (BPM + Tap), 3. Chanté en : [ Do# ▾ ] [ Majeur ▾ ] ➔ Tonalité pour Organizador / Troupe : [ Do ▾ ] (-1 demi-ton) (< 130 lignes).
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { isLatencyCalibrated } from '../../utils/latencyStorage';
import { buildDeviceSignature, getCalibratedLatency } from '../../utils/deviceSignature';
import { useQuickScaleDetector } from '../../hooks/useQuickScaleDetector';
import { analyzeFullProjectScale, SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR } from '../../audio/projectScaleAnalyzer';
import { resolveProjectDualScale, applyDualScaleToProject, clampTranspositionSemitones, computeSemitoneDistance } from '../../utils/scaleTranspositionHelper';
import { syncTonaliteToOrganizadorFirestore } from '../../services/organizadorToadaPublisher';
import { NOTE_NAMES, midiToNoteName } from '../../utils/noteUtils';
import { hasSavedAmbitusProfile, getEffectiveVocalBounds } from '../../utils/ambitusStorage';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { useLanguage } from '../../i18n/LanguageContext';
import { Zap, Check, Drum, Hand, Mic, Target, Ear, ChevronLeft, ChevronRight, HelpCircle, Unlock, Settings, Loader2, Sliders } from 'lucide-react';

const MODES_FR: Array<{ key: ScaleType; label: string }> = [
  { key: 'major', label: 'Majeur' }, { key: 'natural_minor', label: 'Mineur' },
  { key: 'mixolydian', label: 'Mixolydien' }, { key: 'dorian', label: 'Dorien' },
];
const MODES_BR: Array<{ key: ScaleType; label: string }> = [
  { key: 'major', label: 'Maior' }, { key: 'natural_minor', label: 'Menor' },
  { key: 'mixolydian', label: 'Mixolídio' }, { key: 'dorian', label: 'Dórico' },
];

export const PreTakeSetupAssistantBar: React.FC = () => {
  const { language } = useLanguage(), isBr = language === 'br';
  const solfegeNames = isBr ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES, modeList = isBr ? MODES_BR : MODES_FR;
  const { project, activePattern, loadProject, updateScopedBpm } = useToadaProject();
  const { engine, selectedDeviceId, selectedOutputDeviceId, recordedSampleRate } = useAudioHardware();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, recordedSampleRate);
  const [calibratedMs, setCalibratedMs] = useState<number | null>(() => getCalibratedLatency(sig));
  const tapTimesRef = useRef<number[]>([]), [tapCount, setTapCount] = useState(0);
  const bpm = activePattern?.bpm ?? activePattern?.baseBpm ?? project.bpm ?? 88;
  const { isListeningScale, suggestion, startQuickScaleListen, clearSuggestion } = useQuickScaleDetector(project, loadProject, selectedDeviceId);
  const projectAnalysis = useMemo(() => analyzeFullProjectScale(project.patterns, language), [project.patterns, language]);
  const dualScale = useMemo(() => resolveProjectDualScale(project, language, projectAnalysis), [project, language, projectAnalysis]);
  const activeSungTonic = suggestion?.tonic || dualScale.sungScaleRoot;
  const activeSungMode: ScaleType = suggestion?.scaleType || dualScale.sungScaleMode;
  const shiftSt = dualScale.transpositionSemitones;
  const stBadge = shiftSt === 0 ? (isBr ? '0 semitom' : '0 demi-ton') : `${shiftSt > 0 ? '+' : ''}${shiftSt} ${isBr ? 'semitom' : 'demi-ton'}`;
  const listenTarget: 'sung' | 'troupe' = project.previewListenTarget ?? (shiftSt !== 0 ? 'troupe' : 'sung');

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

  const applyDual = (sungRoot: string, mode: ScaleType, nextSt = shiftSt) => {
    const nextProj = applyDualScaleToProject(project, sungRoot, mode, nextSt, dualScale.sungReferencePitch, language);
    loadProject(nextProj);
    clearSuggestion();
    syncTonaliteToOrganizadorFirestore(nextProj);
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: {
        message: `✓ ${isBr ? 'Tonalidade para Organizador / Tropa' : 'Tonalité pour Organizador / Troupe'} : ${nextProj.toadaMeta?.tonaliteDefaut}`,
        type: 'success',
      },
    }));
  };

  const isDeviceCalibrated = calibratedMs !== null && isLatencyCalibrated(selectedDeviceId);
  const ambBounds = hasSavedAmbitusProfile() ? getEffectiveVocalBounds() : null;

  return (
    <div className="cordel-card p-2 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-1.5 flex-wrap">
        {!isDeviceCalibrated ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#9a3412]/15 border border-[#9a3412] text-[#9a3412] dark:text-amber-200 font-bold">
            <span>1. {isBr ? 'Latência não calibrada' : 'Latence non calée'}</span>
            <button type="button" onClick={() => setActiveLivret('reglages')} className="px-2 py-0.5 bg-[#9a3412] hover:opacity-90 text-white font-bold rounded flex items-center gap-1 cursor-pointer"><Zap className="w-3 h-3" /><span>{isBr ? 'Calibrar' : 'Calibrer'}</span></button>
          </div>
        ) : (
          <button type="button" onClick={() => setActiveLivret('reglages')} className="px-2.5 py-1 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer">
            <Check className="w-3.5 h-3.5" /><span>1. {isBr ? `Latência (${calibratedMs} ms)` : `Latence calée (${calibratedMs} ms)`}</span><Settings className="w-3 h-3 opacity-70" />
          </button>
        )}
        {ambBounds && (
          <span className="px-2 py-1 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 font-bold inline-flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5" />
            <span>Ambitus : {midiToNoteName(ambBounds.minMidi + 2)} → {midiToNoteName(ambBounds.maxMidi - 2)} ({isBr ? 'Conforto' : 'Confort'} : {midiToNoteName(ambBounds.comfortMidi)})</span>
          </span>
        )}
        <span className="px-2 py-1 cordel-card-sm rounded font-bold inline-flex items-center gap-1"><Drum className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" /><span>2. {isBr ? 'Andamento :' : 'Tempo :'} <strong className="text-[#9a3412] dark:text-amber-300">{bpm} BPM</strong></span></span>
        <button type="button" onClick={handleTapTempo} className="px-2 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer"><Hand className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" /><span>Tap {tapCount >= 2 ? `(${tapCount})` : ''}</span></button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Côte à côte 1 : Chanté en : [ Do# ▾ ] [ Majeur ▾ ] */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded cordel-card-sm">
          <Mic className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" />
          <span className="font-bold">{isBr ? 'Cantado em :' : 'Chanté en :'}</span>
          <select value={activeSungTonic} onChange={(e) => applyDual(e.target.value, activeSungMode === 'chromatic' ? 'major' : activeSungMode, shiftSt)} className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded px-1 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">
            {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeNames[i]} ({n})</option>)}
          </select>
          <select value={activeSungMode === 'chromatic' ? 'major' : activeSungMode} onChange={(e) => applyDual(activeSungTonic, e.target.value as ScaleType, shiftSt)} className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded px-1 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">
            {modeList.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        {/* Côte à côte 2 : Tonalité pour Organizador / Troupe : [ Do ▾ ] (-1 demi-ton) */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/50">
          <Target className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" />
          <span className="font-bold">{isBr ? 'Tonalidade para Organizador / Tropa :' : 'Tonalité pour Organizador / Troupe :'}</span>
          <button type="button" onClick={() => applyDual(activeSungTonic, activeSungMode, clampTranspositionSemitones(shiftSt - 1))} className="px-1 cordel-btn rounded font-bold flex items-center cursor-pointer"><ChevronLeft className="w-3 h-3" />-1</button>
          <select value={dualScale.troupeScaleRoot} onChange={(e) => applyDual(activeSungTonic, activeSungMode, computeSemitoneDistance(activeSungTonic, e.target.value))} className="bg-[var(--cordel-surface)] border border-amber-500/60 rounded px-1.5 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">
            {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeNames[i]} ({n})</option>)}
          </select>
          <span className="font-bold text-[#9a3412] dark:text-amber-300">({stBadge})</span>
          <button type="button" onClick={() => applyDual(activeSungTonic, activeSungMode, clampTranspositionSemitones(shiftSt + 1))} className="px-1 cordel-btn rounded font-bold flex items-center cursor-pointer">+1<ChevronRight className="w-3 h-3" /></button>
        </div>

        <button type="button" onClick={() => { const next = listenTarget === 'sung' ? 'troupe' : 'sung'; loadProject({ ...project, previewListenTarget: next }); engine.playReferencePitchPreview(next === 'troupe' ? dualScale.troupeReferencePitch : dualScale.sungReferencePitch, 1.2, selectedOutputDeviceId); }} className="px-2 py-1 rounded cordel-card-sm font-bold flex items-center gap-1 cursor-pointer" title={isBr ? 'Alternar escuta entre Gravação e Tropa' : "Basculer l'écoute entre Prise et Troupe"}>
          <Ear className="w-3.5 h-3.5 text-theme-accent" /><span>{listenTarget === 'troupe' ? `${isBr ? 'Tropa' : 'Troupe'} (${dualScale.troupeSolfegeRoot})` : `${isBr ? 'Gravação' : 'Prise'} (${dualScale.sungSolfegeRoot})`}</span>
        </button>
        <button type="button" onClick={() => projectAnalysis.analyzedPatternsCount > 0 ? applyDual(projectAnalysis.tonic, projectAnalysis.scaleType, shiftSt) : startQuickScaleListen()} className="px-2 py-1 rounded cordel-card-sm font-bold flex items-center gap-1 cursor-pointer">
          {isListeningScale ? <Loader2 className="w-3 h-3 animate-spin text-red-600" /> : <HelpCircle className="w-3 h-3 text-[#9a3412] dark:text-amber-300" />}<span>{isListeningScale ? '4s...' : (isBr ? 'Não sei' : 'Je ne sais pas')}</span>
        </button>
        <button type="button" onClick={() => applyDual(activeSungTonic, 'chromatic', shiftSt)} className="px-2 py-1 rounded bg-[#451a03] text-[#f4ecd8] font-bold flex items-center gap-1 cursor-pointer"><Unlock className="w-3 h-3" /><span>{isBr ? 'Desativar' : 'Débrayer'}</span></button>
      </div>
    </div>
  );
};
