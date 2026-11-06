/**
 * StructureTopControls.tsx
 * Bandeau supérieur épuré bilingue (FR / PT-BR) du Livret 1 : Tempo (BPM -/+ & saisie, Tap Tempo, Importer Batuque .wav),
 * Gamme & Tonique auto-détectée (Écouter la tonique ex. La3 / Lá3, Analyser/Relancer la gamme du chant)
 * et bouton interrupteur [ 🔒 Structure Organizador ] ⟷ [ ✏️ Modifier la structure ] (< 130 lignes).
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Drum, Volume2, Search, Lock, Edit3, Minus, Plus } from 'lucide-react';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import {
  getActiveBackingTrack, setActiveBackingTrack, subscribeBackingTrack,
  extractBpmFromFileName, type BackingTrackData,
} from '../../utils/backingTrackStorage';
import { formatReferencePitchSolfege } from '../../audio/projectScaleAnalyzer';
import { useLanguage } from '../../i18n/LanguageContext';

export interface StructureTopControlsProps {
  projectId: string; bpm: number; onBpmChange: (bpm: number) => void;
  activeScaleLabel: string; referencePitch: string;
  onPlayTonicPreview: () => void; onAnalyzeProjectScale: () => void;
  isManualStructureEdit: boolean; onToggleManualStructureEdit: () => void;
}

export const StructureTopControls: React.FC<StructureTopControlsProps> = ({
  projectId, bpm, onBpmChange, activeScaleLabel, referencePitch,
  onPlayTonicPreview, onAnalyzeProjectScale, isManualStructureEdit, onToggleManualStructureEdit,
}) => {
  const { language } = useLanguage();
  const isBr = language === 'br';
  const fileRef = useRef<HTMLInputElement>(null), tapTimesRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [backingTrack, setBackingTrack] = useState<BackingTrackData | null>(() => getActiveBackingTrack(projectId));

  useEffect(() => {
    setBackingTrack(getActiveBackingTrack(projectId));
    return subscribeBackingTrack(() => setBackingTrack(getActiveBackingTrack(projectId)));
  }, [projectId]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const prev = tapTimesRef.current.filter((t) => now - t < 2600);
    const next = [...prev, now].slice(-6);
    tapTimesRef.current = next; setTapCount(next.length);
    if (next.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i - 1]);
      intervals.sort((a, b) => a - b);
      const medMs = intervals[Math.floor(intervals.length / 2)];
      onBpmChange(Math.max(35, Math.min(220, Math.round(60000 / Math.max(200, medMs)))));
    }
  }, [onBpmChange]);

  const handleImportBatuqueWav = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const decoded = await decodeAudioFile(file);
    const refBpm = extractBpmFromFileName(file.name, bpm || 88);
    const measureSec = 4 * (60 / refBpm);
    setActiveBackingTrack({
      projectId, fileName: file.name, pcm: decoded.pcm, sampleRate: decoded.sampleRate,
      referenceBpm: refBpm, firstDownbeatOffsetSec: 0, volume: 0.65, enabled: true,
      loopTrack: decoded.durationSec <= measureSec * 8.5,
    }, projectId);
    e.target.value = '';
  };

  const tonicSolfege = formatReferencePitchSolfege(referencePitch, language);

  return (
    <div className="cordel-card p-2.5 rounded flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
      {/* 1. Tempo : BPM (-/+ & saisie) + Tap Tempo + Importer Batuque (.wav) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold uppercase text-[10.5px] text-theme-ink">{isBr ? 'Andamento :' : 'Tempo :'}</span>
        <div className="inline-flex items-center cordel-card-sm rounded overflow-hidden">
          <button type="button" onClick={() => onBpmChange(Math.max(30, bpm - 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer" title={isBr ? 'Diminuir o BPM (-1)' : 'Diminuer le BPM (-1)'}>
            <Minus className="w-3 h-3" />
          </button>
          <NumericDraftInput min={30} max={240} value={bpm} onChange={onBpmChange} className="w-12 bg-transparent text-center font-mono font-bold text-xs py-0.5 text-[#9a3412] dark:text-amber-300" />
          <span className="pr-1.5 text-[10px] opacity-80 font-bold">BPM</span>
          <button type="button" onClick={() => onBpmChange(Math.min(240, bpm + 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer" title={isBr ? 'Aumentar o BPM (+1)' : 'Augmenter le BPM (+1)'}>
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <button type="button" onClick={handleTapTempo} className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer hover:bg-amber-500/20" title={isBr ? 'Clique 3 a 4 vezes no ritmo para definir o andamento' : 'Cliquez 3 à 4 fois en rythme pour fixer le tempo'}>
          <span>👆 Tap Tempo {tapCount >= 2 ? `(${tapCount})` : ''}</span>
        </button>

        <button type="button" onClick={() => fileRef.current?.click()} className="px-2.5 py-1 cordel-card-sm hover:border-amber-500 font-bold flex items-center gap-1 rounded cursor-pointer text-theme-accent" title={isBr ? 'Importar um arquivo de áudio de acompanhamento do Batuque (.wav)' : "Importer un fichier audio d'accompagnement Batuque (.wav)"}>
          <Drum className="w-3.5 h-3.5" />
          <span>{backingTrack ? backingTrack.fileName.slice(0, 16) : (isBr ? 'Importar Batuque (.wav)' : 'Importer Batuque (.wav)')}</span>
        </button>
        <input ref={fileRef} type="file" accept=".wav,.mp3,.ogg,audio/*" onChange={handleImportBatuqueWav} className="hidden" />
      </div>

      {/* 2. Gamme & Tonique du Chant (Auto-détectée) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-2 py-1 cordel-card-sm rounded font-bold">
          🎼 {isBr ? 'Escala :' : 'Gamme :'} <strong className="text-theme-accent">{activeScaleLabel}</strong>
        </span>
        <button type="button" onClick={onPlayTonicPreview} className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer" title={isBr ? `Ouvir a tônica da toada (${tonicSolfege} / ${referencePitch})` : `Écouter la tonique du chant (${tonicSolfege} / ${referencePitch})`}>
          <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>{isBr ? `Ouvir a tônica (${tonicSolfege})` : `Écouter la tonique (${tonicSolfege})`}</span>
        </button>
        <button type="button" onClick={onAnalyzeProjectScale} className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/60 text-amber-900 dark:text-amber-200 font-bold flex items-center gap-1 cursor-pointer" title={isBr ? 'Analisar ou recalcular a escala em todas as frases gravadas da toada' : 'Analyser ou relancer la détection de gamme sur toutes les phrases enregistrées du chant'}>
          <Search className="w-3.5 h-3.5" />
          <span>{isBr ? 'Analisar / Recalcular escala da toada' : 'Analyser / Relancer la gamme du chant'}</span>
        </button>
      </div>

      {/* 3. Interrupteur Mode Organizador Épuré ⟷ Mode Édition Manuelle */}
      <button
        type="button" onClick={onToggleManualStructureEdit}
        className={`px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${
          isManualStructureEdit ? 'bg-[#9a3412] text-white border-[#9a3412] shadow-2xs' : 'cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-theme-ink'
        }`}
        title={isBr ? 'Desbloquear ou bloquear as ferramentas de edição manual da estrutura' : "Déverrouiller ou verrouiller les outils d'édition manuelle de la structure"}
      >
        {isManualStructureEdit ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
        <span>{isManualStructureEdit ? (isBr ? 'Editar estrutura' : 'Modifier la structure') : (isBr ? 'Estrutura Organizador' : 'Structure Organizador')}</span>
      </button>
    </div>
  );
};
