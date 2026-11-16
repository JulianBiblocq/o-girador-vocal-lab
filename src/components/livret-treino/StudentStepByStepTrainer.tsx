/**
 * StudentStepByStepTrainer.tsx
 * Mode Élève « Pas-à-pas (Cherche-Notes) » sur Bourdon tonique (troupeKey) :
 * Validation syllabe par syllabe en mod 12 (<= 35 cents / 500 ms) ➔ bascule directe Bourdon + Clic (< 132 lignes).
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, RotateCcw, Check, ArrowRight } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { UnifiedPitchDialCanvas, type UnifiedPitchDialLiveState } from '../common/UnifiedPitchDialCanvas';
import { SlowNoteDetectorEngine } from '../../audio/slowNoteDetectorEngine';
import { sharedTonicDrone, playReferenceNotePing } from '../../audio/tonicDroneSynth';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { resolveProjectDualScale } from '../../utils/scaleTranspositionHelper';
import { sanitizePitchHz } from '../../utils/pitchHzContract';
import { buildStudentStepByStepTargets, SamePitchReImpulseGate } from './studentStepByStepHelper';
import type { TrainerPatternOption } from './TrainerConfigBar';

export interface StudentStepByStepTrainerProps {
  patternOptions: TrainerPatternOption[]; activePatternId: string;
  onSelectPattern: (id: string) => void; onLaunchDroneClickRhythm: () => void;
}

export const StudentStepByStepTrainer: React.FC<StudentStepByStepTrainerProps> = ({
  patternOptions, activePatternId, onSelectPattern, onLaunchDroneClickRhythm,
}) => {
  const { project, activePattern } = useToadaProject();
  const { selectedDeviceId } = useAudioHardware();
  const { t, language } = useLanguage();
  const dual = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const refHz = sanitizePitchHz(project.referencePitchHz);
  const targets = useMemo(() => buildStudentStepByStepTargets(activePattern, dual.transpositionSemitones, language), [activePattern, dual.transpositionSemitones, language]);

  const [curIdx, setCurIdx] = useState(0), [isMicOn, setIsMicOn] = useState(false), [isDroneOn, setIsDroneOn] = useState(false);
  const curIdxRef = useRef(0), targetsRef = useRef(targets), detectorRef = useRef<SlowNoteDetectorEngine | null>(null);
  const gateRef = useRef(new SamePitchReImpulseGate());
  curIdxRef.current = curIdx; targetsRef.current = targets;
  const curTarget = targets[curIdx] ?? null, allValidated = targets.length > 0 && curIdx >= targets.length;

  const liveDialRef = useRef<UnifiedPitchDialLiveState>({
    isVoiced: false, centsDelta: 0, holdProgress01: 0,
    primaryNoteLabel: curTarget ? curTarget.syllable : '✓',
    secondaryLabel: curTarget ? `${curTarget.paperCode} • ${curTarget.solfegeLabel}` : '',
  });

  const stopAll = useCallback(() => {
    detectorRef.current?.stop(); detectorRef.current = null; setIsMicOn(false);
    sharedTonicDrone.stopImmediate(); setIsDroneOn(false);
    liveDialRef.current.isVoiced = false; liveDialRef.current.holdProgress01 = 0;
  }, []);

  useEffect(() => {
    setCurIdx(0); gateRef.current.prepareNextTarget(false);
    if (targets[0]) detectorRef.current?.updateOptions({ targetMidi: targets[0].targetMidi });
  }, [activePattern.id, targets]);

  useEffect(() => {
    const tgt = targets[curIdx];
    liveDialRef.current.primaryNoteLabel = tgt ? tgt.syllable : '✓';
    liveDialRef.current.secondaryLabel = tgt ? `${tgt.paperCode} • ${tgt.solfegeLabel}` : '';
    liveDialRef.current.holdProgress01 = 0;
    if (tgt) detectorRef.current?.updateOptions({ targetMidi: tgt.targetMidi });
  }, [curIdx, targets]);

  useEffect(() => { const unreg = registerTreinoKillSwitch(stopAll); return () => { unreg(); stopAll(); }; }, [stopAll]);

  const toggleMic = useCallback(async () => {
    if (isMicOn) { detectorRef.current?.stop(); detectorRef.current = null; setIsMicOn(false); return; }
    if (!sharedTonicDrone.isPlaying()) { await sharedTonicDrone.start(dual.troupeScaleRoot, refHz, 0.15); setIsDroneOn(true); }
    const det = new SlowNoteDetectorEngine(); detectorRef.current = det;
    const firstTgt = targetsRef.current[curIdxRef.current] ?? targetsRef.current[0];
    gateRef.current.prepareNextTarget(false);
    await det.start({ targetMidi: firstTgt?.targetMidi ?? 60, octaveInvariant: true, requiredHoldMs: 500, toleranceCents: 35, referencePitchHz: refHz, deviceId: selectedDeviceId }, (tk) => {
      const idx = curIdxRef.current, tgt = targetsRef.current[idx];
      if (!tgt) { liveDialRef.current = { isVoiced: false, centsDelta: 0, holdProgress01: 1, primaryNoteLabel: '✓', secondaryLabel: '' }; return; }
      const armed = gateRef.current.observeTick(tk, 16);
      if (!armed) det.resetHold();
      liveDialRef.current = { isVoiced: tk.isVoiced, isFrozen: tk.isFrozen, centsDelta: tk.centsDelta, holdProgress01: armed ? tk.holdProgress01 : 0, primaryNoteLabel: tgt.syllable, secondaryLabel: `${tgt.paperCode} • ${tgt.solfegeLabel}` };
      if (armed && tk.justValidatedMidi != null) {
        const nextIdx = idx + 1, nextTgt = targetsRef.current[nextIdx];
        curIdxRef.current = nextIdx; setCurIdx(nextIdx); det.resetHold();
        gateRef.current.prepareNextTarget(Boolean(nextTgt?.requiresReImpulseFromPrev));
        if (nextTgt) det.updateOptions({ targetMidi: nextTgt.targetMidi });
      }
    });
    setIsMicOn(true);
  }, [isMicOn, dual.troupeScaleRoot, refHz, selectedDeviceId]);

  const pingNote = useCallback(async (midi: number) => { detectorRef.current?.freezeForMs(620); await playReferenceNotePing(midi, refHz, 620); }, [refHz]);

  return (
    <div className="cordel-card p-3.5 flex flex-col gap-3 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={activePatternId} onChange={(e) => onSelectPattern(e.target.value)} className="cordel-input px-2 py-1 text-[11px] font-bold rounded cursor-pointer">
          {patternOptions.map((po) => <option key={po.id} value={po.id}>{po.badge ? `${po.badge} ` : ''}[{po.role.toUpperCase()}] {po.name}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => { if (isDroneOn) { sharedTonicDrone.stopImmediate(); setIsDroneOn(false); } else { void sharedTonicDrone.start(dual.troupeScaleRoot, refHz, 0.16); setIsDroneOn(true); } }} className={`px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border ${isDroneOn ? 'bg-emerald-700 text-white border-emerald-500' : 'cordel-btn'}`}>
            <Volume2 className="w-3.5 h-3.5" /><span>{isDroneOn ? `${t('dialDroneActive')} (${dual.troupeSolfegeRoot})` : `${t('dialDroneBtn')} (${dual.troupeSolfegeRoot})`}</span>
          </button>
          {targets[0] && <button type="button" onClick={() => void pingNote(targets[0].targetMidi)} className="cordel-btn px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer">{t('stepListenFirstNoteBtn')}</button>}
          {curTarget && <button type="button" onClick={() => void pingNote(curTarget.targetMidi)} className="cordel-btn px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer">{t('stepListenCurrentNoteBtn')}</button>}
          <button type="button" onClick={() => { setCurIdx(0); detectorRef.current?.resetHold(); gateRef.current.prepareNextTarget(false); }} className="cordel-btn px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3 h-3" /><span>{t('stepResetSyllablesBtn')}</span></button>
          <button type="button" onClick={toggleMic} className={`px-3 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border ${isMicOn ? 'bg-[#c25e38] text-white border-[#c25e38]' : 'cordel-btn-primary'}`}>
            {isMicOn ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}<span>{isMicOn ? t('dialMicStopBtn') : t('dialMicStartBtn')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)]">
        {targets.map((tg, idx) => {
          const done = idx < curIdx, active = idx === curIdx;
          return (
            <button key={`${tg.stepIndex}-${idx}`} type="button" onClick={() => { setCurIdx(idx); gateRef.current.prepareNextTarget(false); void pingNote(tg.targetMidi); }} className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border cursor-pointer transition-colors ${done ? 'bg-emerald-600 text-white border-emerald-500' : active ? 'bg-[#9a3412] text-[#f4ecd8] border-amber-400 shadow-sm' : 'cordel-card-sm opacity-75 hover:opacity-100'}`}>
              {done && <Check className="w-3 h-3" />}<span>{tg.syllable}</span><span className="text-[10px] opacity-80">({tg.paperCode})</span>
            </button>
          );
        })}
      </div>

      <UnifiedPitchDialCanvas liveStateRef={liveDialRef} heightPx={190} onCenterTap={() => { if (curTarget) void pingNote(curTarget.targetMidi); }} centerTapTitle={t('dialListenNoteTitle')} />

      {allValidated && (
        <div className="p-3 rounded border-2 border-emerald-500 bg-emerald-600/15 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-bold text-emerald-900 dark:text-emerald-200">{t('stepAllValidatedBanner')}</span>
          <button type="button" onClick={() => { stopAll(); onLaunchDroneClickRhythm(); }} className="cordel-btn-primary px-3.5 py-2 rounded font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>{t('stepStartDroneClickNowBtn')}</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
