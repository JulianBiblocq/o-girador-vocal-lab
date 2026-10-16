/**
 * MaracatuVocalGames.tsx
 * Atelier 2 : Les 3 Exercices Vocaux du Maracatu (Tir Franc, O Chamado, Voz no Passo).
 * Strictement < 135 lignes, Zero Render Thrashing & Charte Zéro Rouge.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { MaracatuVocalGameEngine, registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import type { MaracatuGameId, VocalGameEvaluation } from '../../audio/vocalGameAnalyzers';
import type { VocalStepData, PitchCurvePoint } from '../../types/vocalPack.types';
import { loadVocalProfile } from '../../utils/ambitusStorage';
import { noteNameToMidi, midiToNoteName } from '../../utils/noteUtils';
import { PianoRollEditor } from '../livret-melodia/PianoRollEditor';
import { Play, Square, Volume2 } from 'lucide-react';

const CALL_SYLLABLES = ['Ô !', 'Ê !', 'Nagô !'] as const;
const BPM = 80;
const BEAT_DUR = 60 / BPM;

export const MaracatuVocalGames: React.FC = () => {
  const { t } = useLanguage();
  const engine = useMemo(() => new MaracatuVocalGameEngine(), []);
  const profile = useMemo(() => loadVocalProfile(), []);
  const baseMidi = useMemo(() => (profile ? noteNameToMidi(profile.vocalProfile.comfortCenterNote) : 60), [profile]);

  const [gameId, setGameId] = useState<MaracatuGameId>('tir_franc');
  const [transposeSt, setTransposeSt] = useState(0);
  const [syllable, setSyllable] = useState<string>(CALL_SYLLABLES[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [evaluation, setEvaluation] = useState<VocalGameEvaluation | null>(null);
  const [curve, setCurve] = useState<PitchCurvePoint[]>([]);

  const targetMidi = Math.max(36, Math.min(84, baseMidi + transposeSt));
  const targetNoteName = midiToNoteName(targetMidi);
  const playheadRef = useRef(0);
  const statusBannerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const liveCurveRef = useRef<PitchCurvePoint[]>([]);

  useEffect(() => {
    const unregister = registerTreinoKillSwitch(() => { engine.stop(); setIsRunning(false); });
    return () => { unregister(); engine.stop(); };
  }, [engine]);

  const stepBricks: VocalStepData[] = useMemo(() => (
    Array.from({ length: 48 }, (_, i) => ({
      stepIndex: i, active: i >= 16, note: i === 16 ? targetNoteName : '───',
      midiNumber: i >= 16 ? targetMidi : 0, velocity: 100, decay: 1,
      syllable: i === 16 ? 'Ô───' : '', syllableAttack: i === 16,
    }))
  ), [targetMidi, targetNoteName]);

  const handleToggleGame = useCallback(async () => {
    if (isRunning) { engine.stop(); setIsRunning(false); return; }
    setIsRunning(true); setEvaluation(null); setCurve([]);
    liveCurveRef.current = []; playheadRef.current = 0;

    await engine.startGame(gameId, targetMidi, BPM, (tick) => {
      playheadRef.current = 4 * BEAT_DUR + tick.elapsedSingSec;
      if (tick.liveCurvePoint) liveCurveRef.current.push(tick.liveCurvePoint);
      if (statusBannerRef.current) {
        statusBannerRef.current.textContent = tick.phase === 'precount'
          ? `${t('gamePrecountStatus')} (${tick.beatIndex + 1}/4)`
          : `${t('gameSingNowStatus')} — ${tick.pitchMidi > 0 ? midiToNoteName(Math.round(tick.pitchMidi)) : '...'}`;
      }
      if (progressBarRef.current) {
        const ratio = tick.phase === 'sing' ? Math.min(1, tick.elapsedSingSec / tick.totalSingSec) : 0;
        progressBarRef.current.style.transform = `scaleX(${ratio.toFixed(3)})`;
      }
    }, (res) => {
      setIsRunning(false); setEvaluation(res); setCurve(res.pitchCurve.length ? res.pitchCurve : [...liveCurveRef.current]);
    });
  }, [isRunning, engine, gameId, targetMidi, t]);

  return (
    <div className="space-y-4">
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {([
            { id: 'tir_franc', label: t('game1Tab') },
            { id: 'o_chamado', label: t('game2Tab') },
            { id: 'voz_no_passo', label: t('game3Tab') },
          ] as { id: MaracatuGameId; label: string }[]).map((g) => (
            <button key={g.id} type="button" onClick={() => { engine.stop(); setIsRunning(false); setEvaluation(null); setGameId(g.id); }} className={`p-2 text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] rounded-none text-left cursor-pointer ${gameId === g.id ? 'bg-[#8b2a1a] text-[#f4ecd8]' : 'bg-[#f4ecd8] dark:bg-[#2b2722]'}`}>{g.label}</button>
          ))}
        </div>
        <div className="p-3 bg-[#f5edd6] dark:bg-[#2b2722] border border-[#1a1a1a]/25 text-xs space-y-1.5">
          <p className="font-bold text-[#8b2a1a] dark:text-[#f4a261]">{gameId === 'tir_franc' ? t('game1Goal') : gameId === 'o_chamado' ? t('game2Goal') : t('game3Goal')}</p>
          <p className="italic opacity-90">{gameId === 'tir_franc' ? t('game1Instruction') : gameId === 'o_chamado' ? t('game2Instruction') : t('game3Instruction')}</p>
          {gameId === 'tir_franc' && (
            <div className="flex items-center gap-2 pt-1">
              {CALL_SYLLABLES.map((syl) => (
                <button key={syl} type="button" onClick={() => setSyllable(syl)} className={`px-2.5 py-1 text-xs font-bold border border-[#1a1a1a] cursor-pointer ${syllable === syl ? 'bg-[#2a9d8f] text-[#f4ecd8]' : 'bg-[#fcfaf2] dark:bg-[#1f1d1a]'}`}>{syl}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1a1a1a]/20 pt-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>{t('gameTargetNoteLabel')}</span>
            <button type="button" onClick={() => setTransposeSt((s) => s - 1)} className="px-2 py-1 bg-[#f4ecd8] dark:bg-[#2b2722] border border-[#1a1a1a] cursor-pointer">{t('gameTransposeDown')}</button>
            <span className="font-mono px-2.5 py-1 bg-[#f5edd6] dark:bg-[#26231e] border border-[#1a1a1a]/30">{targetNoteName} ({transposeSt >= 0 ? `+${transposeSt}` : transposeSt} st)</span>
            <button type="button" onClick={() => setTransposeSt((s) => s + 1)} className="px-2 py-1 bg-[#f4ecd8] dark:bg-[#2b2722] border border-[#1a1a1a] cursor-pointer">{t('gameTransposeUp')}</button>
            <button type="button" onClick={() => engine.playReference(targetMidi)} className="px-2.5 py-1 bg-[#f4ecd8] dark:bg-[#2b2722] border border-[#1a1a1a] flex items-center gap-1 cursor-pointer"><Volume2 className="w-3.5 h-3.5" /><span>{t('gameListenRefBtn')}</span></button>
          </div>
          <button type="button" onClick={handleToggleGame} className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] text-white cursor-pointer ${isRunning ? 'bg-[#d97706]' : 'bg-[#2a9d8f]'}`}>
            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? t('gameStopBtn') : t('gameStartBtn')}</span>
          </button>
        </div>
        <div className="space-y-1">
          <div ref={statusBannerRef} className="text-xs font-mono font-bold text-[#2a9d8f] min-h-[18px]" />
          <div className="w-full h-2.5 bg-[#e8dcbd] dark:bg-[#333] border border-[#1a1a1a]/30 overflow-hidden">
            <div ref={progressBarRef} className="h-full w-full origin-left bg-[#2a9d8f]" style={{ transform: 'scaleX(0)' }} />
          </div>
        </div>
        {gameId === 'voz_no_passo' && (
          <PianoRollEditor readOnly={true} allSteps={stepBricks} pitchCurve={curve} totalDurationSec={12 * BEAT_DUR} anacrusisDurationSec={4 * BEAT_DUR} beatsPerMeasure={4} beatResolutions={[4, 4, 4, 4]} seekStartSec={0} isPlaying={isRunning} tonic="C" scaleType="chromatic" smoothingLevel={1} getPlayheadSec={() => playheadRef.current} onUpdateSteps={() => {}} onSeek={() => {}} onSetTonic={() => {}} onSetScaleType={() => {}} onSetSmoothingLevel={() => {}} onPlayNotePreview={() => {}} />
        )}
        {evaluation && (
          <div className={`p-3 text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] space-y-1.5 ${evaluation.isSuccess ? 'bg-[#2a9d8f]/15 text-[#2a9d8f]' : 'bg-[#d97706]/15 text-[#d97706]'}`}>
            <div>{t(evaluation.feedbackKey)}</div>
            {gameId === 'o_chamado' && <div className="font-mono text-[11px]">{t('game2MetricsLabel', { rms: (evaluation.avgRms * 100).toFixed(1), cents: evaluation.centsDiff, brilliance: evaluation.brillianceRatio })}</div>}
            {gameId === 'voz_no_passo' && evaluation.beatStatuses && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span>{t('game3BeatsLabel')}</span>
                {evaluation.beatStatuses.map((ok, i) => <span key={i} className={`px-2 py-0.5 border border-[#1a1a1a] text-white ${ok ? 'bg-[#2a9d8f]' : 'bg-[#d97706]'}`}>T{i + 1}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
