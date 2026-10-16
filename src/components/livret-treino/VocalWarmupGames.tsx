/**
 * VocalWarmupGames.tsx
 * 4 jeux d'échauffement vocal Maracatu transposables avec retour Zéro Rouge.
 * Strictement < 150 lignes.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { WARMUP_EXERCISES, buildExerciseSteps, type ExerciseStep } from '../../utils/warmupExercisesData';
import { WarmupSynthEngine, type WarmupLiveState } from '../../audio/warmupSynthEngine';
import { loadVocalProfile } from '../../utils/ambitusStorage';
import { noteNameToMidi, midiToNoteName } from '../../utils/noteUtils';
import { Play, Square, Minus, Plus } from 'lucide-react';

export const VocalWarmupGames: React.FC = () => {
  const { t } = useLanguage();
  const engine = useMemo(() => new WarmupSynthEngine(), []);

  const [selectedGameId, setSelectedGameId] = useState(WARMUP_EXERCISES[0].id);
  const [transposeOffset, setTransposeOffset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveState, setLiveState] = useState<WarmupLiveState | null>(null);

  const profile = useMemo(() => loadVocalProfile(), []);
  const centerMidi = profile ? noteNameToMidi(profile.vocalProfile.comfortCenterNote) : 60;
  const activeDef = WARMUP_EXERCISES.find((g) => g.id === selectedGameId) ?? WARMUP_EXERCISES[0];
  const steps: ExerciseStep[] = useMemo(() => buildExerciseSteps(activeDef, centerMidi, transposeOffset), [activeDef, centerMidi, transposeOffset]);

  useEffect(() => () => { engine.stop(); }, [engine]);

  const handleStart = useCallback(() => {
    if (isPlaying) { engine.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    setLiveState(null);
    engine.startExercise(steps, 80, (st) => setLiveState(st), () => { setIsPlaying(false); setLiveState(null); });
  }, [isPlaying, engine, steps]);

  return (
    <div className="space-y-6">
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-4">
        {/* Sélecteur de Jeu */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {WARMUP_EXERCISES.map((g) => (
            <button
              key={g.id}
              onClick={() => { if (isPlaying) engine.stop(); setIsPlaying(false); setSelectedGameId(g.id); }}
              className={`p-2 text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] rounded-none text-left transition-all ${
                selectedGameId === g.id ? 'bg-[#8b2a1a] text-[#f4ecd8]' : 'bg-[#f4ecd8] dark:bg-[#2b2722] hover:bg-[#e8dcbd]'
              }`}
            >
              {t(g.nameKey as any)}
            </button>
          ))}
        </div>

        {/* Contrôles de transposition & Lancer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1a1a1a]/20 pt-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="opacity-75 uppercase">Transposition :</span>
            <button onClick={() => setTransposeOffset((o) => o - 1)} className="p-1 bg-[#f4ecd8] dark:bg-[#2b2722] border border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a]">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-2 py-0.5 bg-[#f5edd6] dark:bg-[#26231e] border border-[#1a1a1a]/20">
              {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset} dt
            </span>
            <button onClick={() => setTransposeOffset((o) => o + 1)} className="p-1 bg-[#f4ecd8] dark:bg-[#2b2722] border border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a]">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleStart}
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] rounded-none transition-all ${
              isPlaying ? 'bg-[#d97706] text-white hover:bg-[#b45309]' : 'bg-[#2a9d8f] text-white hover:bg-[#21867a]'
            }`}
          >
            {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Arrêter' : t('warmupStart')}</span>
          </button>
        </div>

        {/* Frise des étapes de l'exercice */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2">
          {steps.map((s, idx) => {
            const isCurrent = liveState?.currentStepIndex === idx;
            return (
              <div
                key={idx}
                className={`flex-1 min-w-[40px] text-center p-2 border border-[#1a1a1a] text-xs font-mono transition-all ${
                  isCurrent ? 'bg-[#2a9d8f] text-white font-bold scale-105 shadow-[2px_2px_0px_#1a1a1a]' : 'bg-[#f5edd6] dark:bg-[#2b2722]'
                }`}
              >
                <div className="text-[10px] opacity-75">{s.stepIndex + 1}</div>
                <div className="font-bold">{s.noteName}</div>
              </div>
            );
          })}
        </div>

        {/* Indicateur de justesse Zéro Rouge */}
        {isPlaying && liveState && (
          <div className={`p-3 text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-between ${
            liveState.isAccurate ? 'bg-[#2a9d8f]/20 text-[#2a9d8f]' : 'bg-[#d97706]/20 text-[#d97706]'
          }`}>
            <span>{liveState.isAccurate ? '✓ ' + t('warmupSuccess') : '⚡ Ajuste légèrement la hauteur'}</span>
            <span className="font-mono text-[11px]">
              Chanté: {liveState.sungMidi > 0 ? midiToNoteName(liveState.sungMidi) : '...'} (Δ {Math.round(liveState.centsDiff)} cents)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
