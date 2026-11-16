/**
 * PianoRollToolbar.tsx — Barre d'outils compacte bilingue (FR / PT-BR) du Piano Roll :
 * Boutons courts (Icône + 1-2 mots + title complet), 5 outils, Cadrage et Correction Voix (< 120 lignes).
 */
import React from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { MousePointer, Pencil, Scissors, Link2, Eraser, ZoomIn, Undo2, Redo2, RefreshCw, Target, X, Drum, Piano, Globe, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { resolvePatternStepStatus } from '../../utils/projectProgressTracker';
import { confirmAsync } from '../../stores/useCordelDialogStore';

export interface PianoRollToolbarProps {
  activeTool: PianoRollTool; onSelectTool: (tool: PianoRollTool) => void;
  zoomLevel: number; onSetZoom: (zoom: number) => void;
  foldNotesView?: boolean; onToggleFoldNotes?: (folded: boolean) => void; onApplyFoldToAllPatterns?: (folded: boolean) => void;
  alignedPatternsCount?: number; totalPatternsCount?: number;
  canUndo?: boolean; canRedo?: boolean; historyCount?: number; onUndo?: () => void; onRedo?: () => void;
  onSnapToGreenLine?: () => void; onAnalyzeFullSongMelody?: () => void; onReExtractNotes?: () => void;
  globalVariAudioPct?: number; onChangeGlobalVariAudioPct?: (pct: number) => void; onPurgeVariAudio?: () => void;
}

export const PianoRollToolbar: React.FC<PianoRollToolbarProps> = (props) => {
  const {
    activeTool, onSelectTool, zoomLevel, onSetZoom, foldNotesView = false, onToggleFoldNotes, onApplyFoldToAllPatterns,
    alignedPatternsCount, totalPatternsCount, canUndo, canRedo, historyCount, onUndo, onRedo,
    onSnapToGreenLine, onAnalyzeFullSongMelody, onReExtractNotes, globalVariAudioPct = 0, onChangeGlobalVariAudioPct, onPurgeVariAudio,
  } = props;
  const { t, language } = useLanguage(), isBr = language === 'br';
  const { activePattern, project, updatePatternStepStatus } = useToadaProject();
  const patStatus = resolvePatternStepStatus(activePattern, project);
  const tools: { id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'pointer', label: isBr ? 'Seleção' : 'Sélection', icon: MousePointer },
    { id: 'draw_move', label: isBr ? 'Lápis' : 'Crayon', icon: Pencil },
    { id: 'cut', label: isBr ? 'Tesoura' : 'Ciseaux', icon: Scissors },
    { id: 'glue', label: isBr ? 'Cola' : 'Colle', icon: Link2 },
    { id: 'erase', label: isBr ? 'Borracha' : 'Gomme', icon: Eraser },
  ];

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-2 select-none">
      <div className="flex flex-wrap items-center gap-1.5">
        {onToggleFoldNotes && (
          <div className="flex items-center gap-1">
            <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
              <button type="button" onClick={() => onToggleFoldNotes(true)} className={`px-2 py-1 text-xs font-mono font-bold flex items-center gap-1 border-r border-[var(--cordel-border-sub)] cursor-pointer ${foldNotesView ? 'bg-[#9a3412] text-white' : 'text-theme-ink/75 hover:bg-white/10'}`} title={isBr ? 'Recolher notas em uma única linha rítmica' : 'Replier le Piano Roll sur une seule ligne rythmique'}>
                <Drum className="w-3.5 h-3.5" /><span>{isBr ? 'Ritmo' : 'Rythme'}</span>
              </button>
              <button type="button" onClick={() => onToggleFoldNotes(false)} className={`px-2 py-1 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer ${!foldNotesView ? 'bg-theme-wood text-[#f4ecd8]' : 'text-theme-ink/75 hover:bg-white/10'}`} title={isBr ? 'Expandir todas as notas (C2..C5)' : 'Déplier la grille complète des notes (C2..C5)'}>
                <Piano className="w-3.5 h-3.5" /><span>{isBr ? 'Melodia' : 'Mélodie'}</span>
              </button>
            </div>
            {onApplyFoldToAllPatterns && (
              <button type="button" onClick={() => onApplyFoldToAllPatterns(foldNotesView)} className="px-2 py-1 text-[11px] font-mono font-bold flex items-center gap-1 rounded cordel-card-sm cursor-pointer" title={isBr ? 'Aplicar a todos os padrões da toada' : 'Appliquer ce mode à tous les patterns du chant'}>
                <Globe className="w-3 h-3 text-theme-accent" /><span>{isBr ? 'Todos' : 'Tout'}</span>
              </button>
            )}
            {typeof alignedPatternsCount === 'number' && typeof totalPatternsCount === 'number' && (
              <span className="px-2 py-0.5 rounded bg-emerald-600/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-300 text-[10.5px] font-mono font-bold" title={isBr ? 'Padrões alinhados' : 'Patterns calés'}>
                {alignedPatternsCount}/{totalPatternsCount}
              </span>
            )}
            <button type="button" onClick={() => updatePatternStepStatus(activePattern.id, { rhythmValidated: !patStatus.rhythmValidated })} className={`px-2 py-1 text-[11px] font-mono font-bold flex items-center gap-1 rounded border cursor-pointer ${patStatus.rhythmValidated ? 'bg-emerald-700 text-white border-emerald-500' : 'border-emerald-500/50 bg-emerald-600/10 text-emerald-900 dark:text-emerald-300'}`} title={isBr ? 'Validar o ritmo e as sílabas deste bloco' : 'Valider le rythme et les syllabes de ce pattern'}>
              <Check className="w-3 h-3" /><span>{isBr ? 'Ritmo OK' : 'Rythme OK'}</span>
            </button>
            <button type="button" onClick={() => updatePatternStepStatus(activePattern.id, { notesValidated: !patStatus.notesValidated })} className={`px-2 py-1 text-[11px] font-mono font-bold flex items-center gap-1 rounded border cursor-pointer ${patStatus.notesValidated ? 'bg-emerald-700 text-white border-emerald-500' : 'border-emerald-500/50 bg-emerald-600/10 text-emerald-900 dark:text-emerald-300'}`} title={isBr ? 'Validar as notas (melodia) deste bloco' : 'Valider les hauteurs de notes de ce pattern'}>
              <Check className="w-3 h-3" /><span>{isBr ? 'Notas OK' : 'Notes OK'}</span>
            </button>
          </div>
        )}

        <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
          {tools.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onSelectTool(id)} title={label} className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r last:border-r-0 border-[var(--cordel-border-sub)] cursor-pointer ${activeTool === id ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'text-theme-ink/75 hover:bg-white/10'}`}>
              <Icon className="w-3.5 h-3.5" /><span className="hidden 2xl:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
          <button type="button" onClick={onUndo} disabled={!canUndo} title={t('undo')} className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r border-[var(--cordel-border-sub)] cursor-pointer ${canUndo ? 'text-theme-ink hover:bg-white/10' : 'opacity-40 cursor-not-allowed'}`}>
            <Undo2 className="w-3.5 h-3.5" />{historyCount !== undefined && historyCount > 0 && <span className="text-[10px] text-theme-accent font-bold">({historyCount})</span>}
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title={t('redo')} className={`px-2 py-1 text-xs font-mono flex items-center gap-1 cursor-pointer ${canRedo ? 'text-theme-ink hover:bg-white/10' : 'opacity-40 cursor-not-allowed'}`}><Redo2 className="w-3.5 h-3.5" /></button>
        </div>

        {!foldNotesView && onSnapToGreenLine && (
          <button type="button" onClick={onSnapToGreenLine} title={isBr ? 'Alinhar notas na linha verde' : 'Poser les notes sur la ligne verte'} className="px-2 py-1 text-xs font-mono font-bold flex items-center gap-1 border border-emerald-500/60 bg-emerald-600/15 text-emerald-900 dark:text-emerald-300 rounded cursor-pointer">
            <Target className="w-3.5 h-3.5" /><span>{isBr ? 'Alinhar' : 'Cadrer'}</span>
          </button>
        )}
        {onAnalyzeFullSongMelody && (
          <button type="button" onClick={onAnalyzeFullSongMelody} title={isBr ? 'Re-analisar a melodia de toda a toada preservando o ritmo' : 'Analyser la mélodie de tout le chant en préservant le rythme'} className="px-2 py-1 text-xs font-mono font-bold flex items-center gap-1 border border-teal-500/60 bg-teal-600/15 text-teal-900 dark:text-teal-300 rounded cursor-pointer">
            <Globe className="w-3.5 h-3.5" /><span>{isBr ? 'Analisar tudo' : 'Analyser tout'}</span>
          </button>
        )}
        {onReExtractNotes && (
          <button type="button" onClick={async () => { const ok = await confirmAsync({ title: t('reExtractNotes'), message: t('reExtractNotesConfirm'), confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning' }); if (ok) onReExtractNotes(); }} title={isBr ? 'Reiniciar Ritmo e Notas deste bloco' : 'Réinitialiser le rythme et les notes de ce bloc'} className="px-2 py-1 text-xs font-mono font-bold flex items-center gap-1 border border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-300 rounded cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /><span>{isBr ? 'Reiniciar' : 'Ré-extraire'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        {!foldNotesView && onChangeGlobalVariAudioPct && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)]" title={isBr ? 'Correção de Voz Global' : 'Correction Voix Globale'}>
            <span className="font-bold text-theme-ink/85">{isBr ? 'Voz :' : 'Voix :'}</span>
            <input type="range" min={0} max={100} step={5} value={globalVariAudioPct} onChange={(e) => onChangeGlobalVariAudioPct(Number(e.target.value))} className="w-16 accent-[#9a3412] cursor-pointer" />
            <span className={`font-bold min-w-[34px] ${globalVariAudioPct > 0 ? 'text-[#9a3412] dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{globalVariAudioPct}%</span>
            {onPurgeVariAudio && globalVariAudioPct > 0 && (
              <button type="button" onClick={onPurgeVariAudio} title={isBr ? 'Limpar (0 %)' : 'Purger (0 %)'} className="p-0.5 rounded bg-red-600/20 text-red-600 dark:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
            )}
          </div>
        )}
        <div className="flex items-center border border-theme-border/60 rounded overflow-hidden">
          <span className="px-1.5 py-0.5 text-xs text-theme-ink/60 border-r border-theme-border/40"><ZoomIn className="w-3.5 h-3.5" /></span>
          {[1, 2, 4, 8].map((z) => (
            <button key={z} type="button" onClick={() => onSetZoom(z)} className={`px-2 py-0.5 text-[11px] font-mono border-r last:border-r-0 border-theme-border/40 cursor-pointer ${zoomLevel === z ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'text-theme-ink/70 hover:bg-white/10'}`}>{z}x</button>
          ))}
        </div>
      </div>
    </div>
  );
};
