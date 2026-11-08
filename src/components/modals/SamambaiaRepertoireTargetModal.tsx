/**
 * SamambaiaRepertoireTargetModal.tsx
 * Modale Cordel d'intégration directe d'une Toada Cantador dans un morceau sauvegardé du Répertoire Samambaia (Sequenciador) (< 135 lignes).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drum, Search, Plus, Check, Loader2, X, Clock, Target, Piano, ExternalLink } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { resolveProjectDualScale } from '../../utils/scaleTranspositionHelper';
import { type SamambaiaMorceauSummary, findBestMatchingSamambaiaMorceau } from '../../utils/sequenciadorPresetBuilder';
import { fetchSamambaiaSavedMorceaux, integrateToadaIntoSamambaiaMorceau, type IntegrateMorceauResult } from '../../services/samambaiaMorceauIntegrator';

export interface SamambaiaRepertoireTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SamambaiaRepertoireTargetModal: React.FC<SamambaiaRepertoireTargetModalProps> = ({ isOpen, onClose }) => {
  const { project, loadProject, setSequenciadorExportMode } = useToadaProject();
  const { language } = useLanguage(), isBr = language === 'br';
  const [morceaux, setMorceaux] = useState<SamambaiaMorceauSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState(''), [selectedId, setSelectedId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState(project.title || ''), [newBpm, setNewBpm] = useState<number>(project.bpm || 96);
  const [isSubmitting, setIsSubmitting] = useState(false), [progressMsg, setProgressMsg] = useState('');
  const [doneResult, setDoneResult] = useState<IntegrateMorceauResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDoneResult(null); setIsSubmitting(false); setProgressMsg('');
    setNewTitle(project.title || 'Nouvelle Toada'); setNewBpm(project.bpm || 96); setLoadingList(true);
    fetchSamambaiaSavedMorceaux().then((list) => {
      setMorceaux(list);
      const match = findBestMatchingSamambaiaMorceau(list, project);
      if (match) { setSelectedId(match.id); setIsCreatingNew(false); }
      else if (list.length > 0) { setSelectedId(list[0].id); setIsCreatingNew(false); }
      else setIsCreatingNew(true);
    }).finally(() => setLoadingList(false));
  }, [isOpen, project.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? morceaux.filter((m) => m.name.toLowerCase().includes(q) || (m.ritmo || '').toLowerCase().includes(q) || (m.nacao || '').toLowerCase().includes(q)) : morceaux;
  }, [morceaux, search]);

  if (!isOpen) return null;

  const selectedMorceau = morceaux.find((m) => m.id === selectedId) || null, firstPat = project.patterns[0];
  const recordedBpm = Math.round(Number((firstPat as any)?.recordedBpm || firstPat?.recordingResult?.recordedBpm || firstPat?.baseBpm || project.bpm || 88));
  const sequenciadorBpm = isCreatingNew ? Math.max(30, Math.round(newBpm || 96)) : (selectedMorceau?.bpm || project.bpm || 96);
  const dualScale = resolveProjectDualScale(project, language), exportMode = project.sequenciadorExportMode ?? 'rhythm_only';

  const handleIntegrate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await integrateToadaIntoSamambaiaMorceau(
        project,
        isCreatingNew ? { createNewMorceau: { name: newTitle, bpm: sequenciadorBpm } } : { targetMorceau: selectedMorceau },
        (msg) => setProgressMsg(msg)
      );
      loadProject(res.updatedProject); setDoneResult(res);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `✓ Toada intégrée dans "${res.morceauName}" (${res.sequenciadorBpm} BPM) !` } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err?.message || 'Erreur lors de l’intégration' } }));
    } finally { setIsSubmitting(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono text-xs" onClick={onClose}>
      <div className="w-full max-w-xl cordel-card bg-[var(--cordel-surface)] text-[var(--cordel-text)] border-2 border-[var(--cordel-border)] p-4 rounded flex flex-col gap-3 max-h-[88vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--cordel-border-sub)] pb-2">
          <div className="flex items-center gap-2 font-bold text-sm"><Drum className="w-4 h-4 text-theme-accent shrink-0" /><span>{isBr ? 'Integrar a Toada num música do Repertório (Samambaia)' : 'Intégrer la Toada dans un morceau du Répertoire (Samambaia)'}</span></div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-black/10 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {doneResult ? (
          <div className="flex flex-col gap-3 py-3">
            <div className="p-3 rounded bg-emerald-700/15 border border-emerald-600 text-emerald-950 dark:text-emerald-200 font-bold text-xs leading-relaxed">
              ✓ {isBr ? `Toada integrada em "${doneResult.morceauName}" (ajustada ao andamento do Sequenciador : ${doneResult.sequenciadorBpm} BPM) !` : `Toada intégrée dans "${doneResult.morceauName}" (calée au tempo Sequenciador : ${doneResult.sequenciadorBpm} BPM) !`}
              <div className="mt-1 text-[11px] opacity-85 font-normal">{doneResult.exportedPatternsCount} patterns • Audio maître @ {doneResult.recordedBpm} BPM ➔ joué à {doneResult.sequenciadorBpm} BPM ({doneResult.savedMegabytes} Mo économisés).</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => window.open(doneResult.sequenciadorMorceauUrl, '_blank', 'noopener,noreferrer')} className="px-3 py-1.5 rounded cordel-btn font-bold inline-flex items-center gap-1.5 cursor-pointer"><Drum className="w-3.5 h-3.5 text-theme-accent" /><span>{isBr ? 'Ver a música no Sequenciador' : 'Voir le morceau dans Sequenciador'}</span><ExternalLink className="w-3 h-3 opacity-70" /></button>
              <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"><Check className="w-3.5 h-3.5" /><span>{isBr ? '✓ Ficar no Cantador' : '✓ Rester dans Cantador'}</span></button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/50 flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[#9a3412] dark:text-amber-300"><Clock className="w-3.5 h-3.5 shrink-0" /><span>{isBr ? `Andamento alvo : o canto (gravado a ${recordedBpm} BPM) será automaticamente ajustado ao andamento da música no Sequenciador (${sequenciadorBpm} BPM)` : `Tempo cible : le chant (enregistré à ${recordedBpm} BPM) sera automatiquement calé au tempo du morceau Sequenciador (${sequenciadorBpm} BPM)`}</span></div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/30">
                <div className="inline-flex items-center gap-1">
                  <button type="button" onClick={() => setSequenciadorExportMode('rhythm_only')} className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${exportMode === 'rhythm_only' ? 'bg-[#9a3412] text-white' : 'cordel-btn'}`}><Drum className="w-3 h-3" /><span>{isBr ? 'Ritmo & Voz (Sem MIDI)' : 'Rythme & Voix (Sans notes MIDI)'}</span></button>
                  <button type="button" onClick={() => setSequenciadorExportMode('full_notes')} className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${exportMode === 'full_notes' ? 'bg-theme-wood text-[#f4ecd8]' : 'cordel-btn'}`}><Piano className="w-3 h-3" /><span>{isBr ? 'Completo com MIDI' : 'Complet avec notes MIDI'}</span></button>
                </div>
                <span className="inline-flex items-center gap-1 font-bold text-[#9a3412] dark:text-amber-300"><Target className="w-3.5 h-3.5" />{isBr ? 'Tonalidade Tropa :' : 'Tonalité Troupe :'} {dualScale.troupeScaleLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1"><Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-60" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isBr ? 'Filtrar repertório Samambaia...' : 'Rechercher un morceau du répertoire Samambaia...'} className="w-full pl-8 pr-2.5 py-1.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] outline-none" /></div>
              <button type="button" onClick={() => setIsCreatingNew((v) => !v)} className={`px-2.5 py-1.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer border ${isCreatingNew ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}><Plus className="w-3.5 h-3.5" /><span>{isBr ? 'Criar nova música' : 'Créer un nouveau morceau dans le répertoire Samambaia'}</span></button>
            </div>

            {isCreatingNew ? (
              <div className="p-2.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] flex flex-wrap items-center gap-2">
                <label className="flex-1 min-w-[180px] flex flex-col gap-1"><span className="font-bold opacity-80">{isBr ? 'Título da música Samambaia :' : 'Titre du morceau Samambaia :'}</span><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="px-2 py-1 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] font-bold" /></label>
                <label className="w-28 flex flex-col gap-1"><span className="font-bold opacity-80">BPM Sequenciador :</span><input type="number" min={30} max={240} value={newBpm} onChange={(e) => setNewBpm(Number(e.target.value) || 96)} className="px-2 py-1 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] font-bold text-center" /></label>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-56 flex flex-col gap-1.5 pr-1">
                {loadingList ? <div className="py-8 flex items-center justify-center gap-2 opacity-75"><Loader2 className="w-4 h-4 animate-spin text-theme-accent" /><span>{isBr ? 'Carregando repertório Samambaia...' : 'Chargement du répertoire Samambaia...'}</span></div> : filtered.map((m) => (
                  <button key={m.id} type="button" onClick={() => setSelectedId(m.id)} className={`w-full text-left p-2 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${m.id === selectedId ? 'bg-amber-500/15 border-amber-500 font-bold' : 'bg-[var(--cordel-subcard-bg)] border-[var(--cordel-border-sub)] hover:border-amber-500/50'}`}>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 truncate"><Drum className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span className="truncate">{m.name}</span>{m.hasVocalToada && <span className="px-1.5 py-0.2 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-[10px]">Toada associée</span>}</div>
                      <span className="text-[10.5px] opacity-75">{m.ritmo || 'Baque Virado'}{m.nacao ? ` • ${m.nacao}` : ''}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-theme-wood text-[#f4ecd8] font-bold shrink-0">{m.bpm} BPM</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
              <span className="text-[11px] opacity-80 truncate">{progressMsg}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1.5 rounded cordel-btn font-bold cursor-pointer">{isBr ? 'Cancelar' : 'Annuler'}</button>
                <button type="button" disabled={isSubmitting || (!isCreatingNew && !selectedMorceau)} onClick={handleIntegrate} className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}<span>{isBr ? 'Integrar nesta música Samambaia' : 'Intégrer dans ce morceau Samambaia'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
