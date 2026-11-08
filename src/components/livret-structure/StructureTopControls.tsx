/**
 * StructureTopControls.tsx
 * Bandeau supérieur épuré bilingue (FR / PT-BR) du Livret 1 : Tempo (BPM -/+ & saisie, Tap Tempo, Importer Batuque .wav),
 * Double Tonalité ultra-simple (Chanté en : [ Do# ▾ ] [ Majeur ▾ ] ➔ Tonalité pour Organizador / Troupe : [ Do ▾ ] (-1 demi-ton))
 * et bouton interrupteur [ Structure Organizador ] ⟷ [ Modifier la structure ] (< 138 lignes).
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Drum, Volume2, Search, Lock, Edit3, Minus, Plus, Hand, Mic, Target, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import { getActiveBackingTrack, setActiveBackingTrack, subscribeBackingTrack, extractBpmFromFileName, type BackingTrackData } from '../../utils/backingTrackStorage';
import { formatReferencePitchSolfege, SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR } from '../../audio/projectScaleAnalyzer';
import { resolveProjectDualScale, applyDualScaleToProject, clampTranspositionSemitones, computeSemitoneDistance } from '../../utils/scaleTranspositionHelper';
import { syncTonaliteToOrganizadorFirestore } from '../../services/organizadorToadaPublisher';
import { NOTE_NAMES } from '../../utils/noteUtils';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SequenciadorExportBar } from '../common/SequenciadorExportBar';
import { VocalPaperWorkshopModal } from '../modals/vocal-paper/VocalPaperWorkshopModal';

export interface StructureTopControlsProps {
  projectId: string; bpm: number; onBpmChange: (bpm: number) => void; activeScaleLabel: string; referencePitch: string;
  onPlayTonicPreview: () => void; onAnalyzeProjectScale: () => void; isManualStructureEdit: boolean; onToggleManualStructureEdit: () => void;
}
const MODES_FR: Array<{ key: ScaleType; label: string }> = [{ key: 'major', label: 'Majeur' }, { key: 'natural_minor', label: 'Mineur' }, { key: 'mixolydian', label: 'Mixolydien' }, { key: 'dorian', label: 'Dorien' }];
const MODES_BR: Array<{ key: ScaleType; label: string }> = [{ key: 'major', label: 'Maior' }, { key: 'natural_minor', label: 'Menor' }, { key: 'mixolydian', label: 'Mixolídio' }, { key: 'dorian', label: 'Dórico' }];

export const StructureTopControls: React.FC<StructureTopControlsProps> = ({
  projectId, bpm, onBpmChange, referencePitch, onPlayTonicPreview, onAnalyzeProjectScale, isManualStructureEdit, onToggleManualStructureEdit,
}) => {
  const { language } = useLanguage(), isBr = language === 'br', { project, loadProject } = useToadaProject();
  const solfegeNames = isBr ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES, modeList = isBr ? MODES_BR : MODES_FR;
  const fileRef = useRef<HTMLInputElement>(null), tapTimesRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0), [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [backingTrack, setBackingTrack] = useState<BackingTrackData | null>(() => getActiveBackingTrack(projectId));

  useEffect(() => {
    setBackingTrack(getActiveBackingTrack(projectId));
    return subscribeBackingTrack(() => setBackingTrack(getActiveBackingTrack(projectId)));
  }, [projectId]);

  const dualScale = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const activeSungTonic = dualScale.sungScaleRoot;
  const activeSungMode: ScaleType = dualScale.sungScaleMode === 'chromatic' ? 'major' : dualScale.sungScaleMode;
  const shiftSt = dualScale.transpositionSemitones;
  const stBadge = shiftSt === 0 ? (isBr ? '0 semitom' : '0 demi-ton') : `${shiftSt > 0 ? '+' : ''}${shiftSt} ${isBr ? 'semitom' : 'demi-ton'}`;

  const handleApplyDualScale = (sungRoot: string, mode: ScaleType, nextSt = shiftSt) => {
    const nextProj = applyDualScaleToProject(project, sungRoot, mode, nextSt, dualScale.sungReferencePitch, language);
    loadProject(nextProj);
    syncTonaliteToOrganizadorFirestore(nextProj);
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `✓ ${isBr ? 'Tonalidade para Organizador' : 'Tonalité pour Organizador'} : ${nextProj.toadaMeta?.tonaliteDefaut}`, type: 'success' },
    }));
  };

  const handleTapTempo = useCallback(() => {
    const now = performance.now(), next = [...tapTimesRef.current.filter((t) => now - t < 2600), now].slice(-6);
    tapTimesRef.current = next; setTapCount(next.length);
    if (next.length >= 3) {
      const intervals = next.slice(1).map((t, i) => t - next[i]).sort((a, b) => a - b);
      onBpmChange(Math.max(35, Math.min(220, Math.round(60000 / Math.max(200, intervals[Math.floor(intervals.length / 2)])))));
    }
  }, [onBpmChange]);

  const handleImportBatuqueWav = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const decoded = await decodeAudioFile(file);
    const refBpm = extractBpmFromFileName(file.name, bpm || 88);
    setActiveBackingTrack({
      projectId, fileName: file.name, pcm: decoded.pcm, sampleRate: decoded.sampleRate,
      referenceBpm: refBpm, firstDownbeatOffsetSec: 0, volume: 0.65, enabled: true,
      loopTrack: decoded.durationSec <= 4 * (60 / refBpm) * 8.5,
    }, projectId);
    e.target.value = '';
  };

  const tonicSolfege = formatReferencePitchSolfege(referencePitch, language);

  return (
    <div className="cordel-card p-2.5 rounded flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold uppercase text-[10.5px] text-theme-ink">{isBr ? 'Andamento :' : 'Tempo :'}</span>
        <div className="inline-flex items-center cordel-card-sm rounded overflow-hidden">
          <button type="button" onClick={() => onBpmChange(Math.max(30, bpm - 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer"><Minus className="w-3 h-3" /></button>
          <NumericDraftInput min={30} max={240} value={bpm} onChange={onBpmChange} className="w-12 bg-transparent text-center font-mono font-bold text-xs py-0.5 text-[#9a3412] dark:text-amber-300" />
          <span className="pr-1.5 text-[10px] opacity-80 font-bold">BPM</span>
          <button type="button" onClick={() => onBpmChange(Math.min(240, bpm + 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer"><Plus className="w-3 h-3" /></button>
        </div>
        <button type="button" onClick={handleTapTempo} className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer hover:bg-amber-500/20"><Hand className="w-3.5 h-3.5 text-theme-accent" /><span>Tap {tapCount >= 2 ? `(${tapCount})` : ''}</span></button>
        <button type="button" onClick={() => fileRef.current?.click()} className="px-2.5 py-1 cordel-card-sm hover:border-amber-500 font-bold flex items-center gap-1 rounded cursor-pointer text-theme-accent"><Drum className="w-3.5 h-3.5" /><span>{backingTrack ? backingTrack.fileName.slice(0, 14) : 'Batuque (.wav)'}</span></button>
        <input ref={fileRef} type="file" accept=".wav,.mp3,.ogg,audio/*" onChange={handleImportBatuqueWav} className="hidden" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded cordel-card-sm">
          <Mic className="w-3.5 h-3.5 text-theme-accent" />
          <span className="font-bold">{isBr ? 'Cantado em :' : 'Chanté en :'}</span>
          <select value={activeSungTonic} onChange={(e) => handleApplyDualScale(e.target.value, activeSungMode, shiftSt)} className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded px-1 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">{NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeNames[i]} ({n})</option>)}</select>
          <select value={activeSungMode} onChange={(e) => handleApplyDualScale(activeSungTonic, e.target.value as ScaleType, shiftSt)} className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded px-1 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">{modeList.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        </div>

        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/50">
          <Target className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" />
          <span className="font-bold">{isBr ? 'Tonalidade para Organizador / Tropa :' : 'Tonalité pour Organizador / Troupe :'}</span>
          <button type="button" onClick={() => handleApplyDualScale(activeSungTonic, activeSungMode, clampTranspositionSemitones(shiftSt - 1))} className="px-1 cordel-btn rounded font-bold flex items-center cursor-pointer"><ChevronLeft className="w-3 h-3" />-1</button>
          <select value={dualScale.troupeScaleRoot} onChange={(e) => handleApplyDualScale(activeSungTonic, activeSungMode, computeSemitoneDistance(activeSungTonic, e.target.value))} className="bg-[var(--cordel-surface)] border border-amber-500/60 rounded px-1.5 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 cursor-pointer">{NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeNames[i]} ({n})</option>)}</select>
          <span className="font-bold text-[#9a3412] dark:text-amber-300">({stBadge})</span>
          <button type="button" onClick={() => handleApplyDualScale(activeSungTonic, activeSungMode, clampTranspositionSemitones(shiftSt + 1))} className="px-1 cordel-btn rounded font-bold flex items-center cursor-pointer">+1<ChevronRight className="w-3 h-3" /></button>
        </div>

        <button type="button" onClick={onPlayTonicPreview} className="px-2 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer" title={isBr ? `Ouvir a tônica (${tonicSolfege})` : `Écouter la tonique (${tonicSolfege})`}><Volume2 className="w-3.5 h-3.5 text-theme-accent" /><span>{tonicSolfege}</span></button>
        <button type="button" onClick={onAnalyzeProjectScale} className="px-2 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/60 text-amber-900 dark:text-amber-200 font-bold flex items-center gap-1 cursor-pointer" title={isBr ? 'Analisar escala da toada' : 'Analyser la gamme du chant'}><Search className="w-3.5 h-3.5" /><span>Auto</span></button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SequenciadorExportBar compact />
        <button type="button" onClick={() => setIsPaperModalOpen(true)} className="px-2.5 py-1 rounded cordel-card-sm font-bold flex items-center gap-1.5 cursor-pointer hover:border-amber-500 text-theme-ink">
          <Printer className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" />
          <span>{isBr ? 'Oficina Papel' : 'Atelier Papier'}</span>
        </button>
        <button type="button" onClick={onToggleManualStructureEdit} className={`px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${isManualStructureEdit ? 'bg-[#9a3412] text-white border-[#9a3412] shadow-2xs' : 'cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-theme-ink'}`}>
          {isManualStructureEdit ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
          <span>{isManualStructureEdit ? (isBr ? 'Editar estrutura' : 'Modifier la structure') : (isBr ? 'Estrutura Organizador' : 'Structure Organizador')}</span>
        </button>
      </div>
      {isPaperModalOpen && <VocalPaperWorkshopModal isOpen={isPaperModalOpen} onClose={() => setIsPaperModalOpen(false)} project={project} isBr={isBr} onProjectUpdate={loadProject} />}
    </div>
  );
};
