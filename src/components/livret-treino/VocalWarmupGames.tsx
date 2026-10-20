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
      <div className="cordel-card p-4 space-y-4">
        {/* Sélecteur de Jeu */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {WARMUP_EXERCISES.map((g) => (
            <button
              key={g.id}
              onClick={() => { if (isPlaying) engine.stop(); setIsPlaying(false); setSelectedGameId(g.id); }}
              className={`p-2 text-xs font-bold border rounded text-left transition-all cursor-pointer ${
                selectedGameId === g.id
                  ? 'bg-[#9a3412] text-[#f4ecd8] border-[#9a3412] shadow-sm -translate-y-0.5'
                  : 'bg-[var(--cordel-subcard-bg)] text-[var(--cordel-text)] border-[var(--cordel-border-sub)] hover:border-[var(--cordel-accent)]'
              }`}
            >
              {t(g.nameKey as any)}
            </button>
          ))}
        </div>

        {/* Contrôles de transposition & Lancer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cordel-border-sub)] pt-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--cordel-text)]">
            <span className="opacity-75 uppercase">Transposition :</span>
            <button onClick={() => setTransposeOffset((o) => o - 1)} className="cordel-btn p-1 rounded cursor-pointer">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-2 py-0.5 cordel-card-sm rounded border border-[var(--cordel-border-sub)]">
              {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset} dt
            </span>
            <button onClick={() => setTransposeOffset((o) => o + 1)} className="cordel-btn p-1 rounded cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleStart}
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border rounded cursor-pointer transition-all ${
              isPlaying ? 'bg-[#c25e38] text-white border-[#c25e38]' : 'cordel-btn-primary'
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
                className={`flex-1 min-w-[40px] text-center p-2 border rounded text-xs font-mono transition-all ${
                  isCurrent ? 'bg-[var(--cordel-coro)] text-white font-bold scale-105 shadow-sm border-[var(--cordel-coro)]' : 'cordel-card-sm border-[var(--cordel-border-sub)]'
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
          <div className={`p-3 text-xs font-bold border rounded flex items-center justify-between ${
            liveState.isAccurate ? 'bg-[#0f766e]/15 text-[#0f766e] dark:text-[#2dd4bf] border-[#0f766e]/40' : 'bg-[#c25e38]/15 text-[#9a3412] dark:text-[#e69d35] border-[#c25e38]/40'
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
