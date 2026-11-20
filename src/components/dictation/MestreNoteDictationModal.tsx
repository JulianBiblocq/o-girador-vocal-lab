/**
 * MestreNoteDictationModal.tsx
 * Modale Puxador « Cherche-Notes & Dictée Lente » : UnifiedPitchDialCanvas 60 FPS, Bourdon tonique,
 * écoute tactile avec gel anti-repisse (freezeForMs), ruban éditable et alignement forcé (< 95 lignes).
 */
import React, { useCallback } from 'react';
import { Compass, Mic, MicOff, Volume2, X } from 'lucide-react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { UnifiedPitchDialCanvas } from '../common/UnifiedPitchDialCanvas';
import { MicLevelMeter } from '../common/MicLevelMeter';
import { DictationNoteRibbon } from './DictationNoteRibbon';
import { useMestreDictationController } from './useMestreDictationController';
import { sharedTonicDrone } from '../../audio/tonicDroneSynth';
import { formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../../audio/forcedMelodyAligner';

export const MestreNoteDictationModal: React.FC = () => {
  const isOpen = useVocalTransportStore((s) => s.isDictationModalOpen);
  const close = useCallback(() => useVocalTransportStore.getState().setDictationModalOpen(false), []);
  const c = useMestreDictationController(isOpen, close);

  if (!isOpen) return null;
  const { t, language, activePattern, dual, refHz, keyView, setKeyView, isMicOn, toggleMic, isDroneOn, setIsDroneOn, curMidi, notes, setNotes, viewOffset, activeTonic, liveDialRef, micLevelRef, playNoteWithFreeze, handlePlaySequence, handleAttach } = c;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-3">
      <div className="cordel-card w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-lg p-4 flex flex-col gap-3 shadow-2xl border-2 border-[var(--cordel-wood)]">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--cordel-border-sub)] font-mono">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#9a3412] dark:text-amber-300" />
            <div>
              <h2 className="text-sm font-black uppercase text-theme-ink">{t('dialModalTitle')}</h2>
              <p className="text-[11px] opacity-75">[{activePattern.role.toUpperCase()}] {activePattern.name} • A4 = {refHz} Hz</p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded cordel-btn cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="inline-flex rounded border border-[var(--cordel-border-sub)] overflow-hidden">
            <button type="button" onClick={() => setKeyView('sung')} className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${keyView === 'sung' ? 'cordel-btn-primary' : 'cordel-btn opacity-75'}`}>{t('dialViewSungKey')} ({dual.sungSolfegeRoot})</button>
            <button type="button" onClick={() => setKeyView('troupe')} className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${keyView === 'troupe' ? 'cordel-btn-primary' : 'cordel-btn opacity-75'}`}>{t('dialViewTroupeKey')} ({dual.troupeSolfegeRoot})</button>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { if (isDroneOn) { sharedTonicDrone.stopImmediate(); setIsDroneOn(false); } else { void sharedTonicDrone.start(activeTonic, refHz); setIsDroneOn(true); } }} className={`px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border ${isDroneOn ? 'bg-emerald-700 text-white border-emerald-500' : 'cordel-btn'}`}>
              <Volume2 className="w-3.5 h-3.5" /><span>{isDroneOn ? `${t('dialDroneActive')} (${activeTonic})` : `${t('dialDroneBtn')} (${activeTonic})`}</span>
            </button>
            <button type="button" onClick={toggleMic} className={`px-3 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border ${isMicOn ? 'bg-[#c25e38] text-white border-[#c25e38]' : 'cordel-btn-primary'}`}>
              {isMicOn ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}<span>{isMicOn ? t('dialMicStopBtn') : t('dialMicStartBtn')}</span>
            </button>
          </div>
        </div>

        <MicLevelMeter levelRef={micLevelRef} active={isMicOn} />

        <UnifiedPitchDialCanvas liveStateRef={liveDialRef} heightPx={190} onCenterTap={() => void playNoteWithFreeze(curMidi)} centerTapTitle={t('dialListenNoteTitle')} />

        <div className="flex items-center justify-center gap-1.5 font-mono text-xs flex-wrap">
          {[{ d: -12, l: '-1 Oct' }, { d: -1, l: '-½' }, { d: 0, l: `${formatPaperNoteCode(curMidi + viewOffset)} • ${formatSolfegeNoteWithOctave(curMidi + viewOffset, language)}` }, { d: 1, l: '+½' }, { d: 12, l: '+1 Oct' }].map((b) => (
            <button key={b.l} type="button" onClick={() => void playNoteWithFreeze(curMidi + b.d)} className={`px-2.5 py-1 rounded font-bold cursor-pointer ${b.d === 0 ? 'cordel-btn-primary' : 'cordel-btn'}`}>{b.l}</button>
          ))}
        </div>

        <DictationNoteRibbon
          notes={notes} viewOffsetSt={viewOffset} currentCandidateMidi={curMidi}
          onAddCurrentNote={() => setNotes((prev) => [...prev, curMidi])}
          onPlayNote={(m) => void playNoteWithFreeze(m, 480)}
          onRemoveAt={(idx) => setNotes((prev) => prev.filter((_, i) => i !== idx))}
          onPlaySequence={handlePlaySequence}
          onCopyPaperLine={() => { const line = notes.map((m) => formatPaperNoteCode(m + viewOffset)).join('  '); void navigator.clipboard?.writeText(line); window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `${t('dialCopiedToast')} : ${line}` } })); }}
          onClear={() => setNotes([])}
          onAttachToPattern={handleAttach}
        />
      </div>
    </div>
  );
};
