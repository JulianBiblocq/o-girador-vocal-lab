/**
 * PianoRollToolbar.tsx
 * Barre d'outils épurée bilingue (FR / PT-BR) façon Cubase VariAudio :
 * 5 outils (Sélection, Crayon, Ciseaux, Colle, Gomme), [ 🎯 Poser les notes sur la ligne verte ],
 * [ 🔄 Réinitialiser Rythme & Notes ] et Correction Voix Globale (0..100%) (< 130 lignes).
 */
import React from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { MousePointer, Pencil, Scissors, Link2, Eraser, ZoomIn, Undo2, Redo2, RefreshCw, Target, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { confirmAsync } from '../../stores/useCordelDialogStore';

export interface PianoRollToolbarProps {
  activeTool: PianoRollTool;
  onSelectTool: (tool: PianoRollTool) => void;
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  historyCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onSnapToGreenLine?: () => void;
  onReExtractNotes?: () => void;
  globalVariAudioPct?: number;
  onChangeGlobalVariAudioPct?: (pct: number) => void;
  onPurgeVariAudio?: () => void;
}

export const PianoRollToolbar: React.FC<PianoRollToolbarProps> = (props) => {
  const {
    activeTool, onSelectTool, zoomLevel, onSetZoom,
    canUndo, canRedo, historyCount, onUndo, onRedo,
    onSnapToGreenLine, onReExtractNotes,
    globalVariAudioPct = 0, onChangeGlobalVariAudioPct, onPurgeVariAudio,
  } = props;
  const { t, language } = useLanguage();
  const isBr = language === 'br';

  const tools: { id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'pointer', label: isBr ? 'Seleção' : 'Sélection', icon: MousePointer },
    { id: 'draw_move', label: isBr ? 'Lápis' : 'Crayon', icon: Pencil },
    { id: 'cut', label: isBr ? 'Tesoura' : 'Ciseaux', icon: Scissors },
    { id: 'glue', label: isBr ? 'Cola (Unir)' : 'Colle (Souder)', icon: Link2 },
    { id: 'erase', label: isBr ? 'Borracha' : 'Gomme', icon: Eraser },
  ];

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-2 select-none">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
          {tools.map((item) => {
            const Icon = item.icon, isActive = activeTool === item.id;
            return (
              <button
                key={item.id} type="button" onClick={() => onSelectTool(item.id)} title={item.label}
                className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r last:border-r-0 border-[var(--cordel-border-sub)] transition-all cursor-pointer ${
                  isActive ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'text-theme-ink/75 hover:bg-white/10 hover:text-theme-ink'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /><span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
          <button type="button" onClick={onUndo} disabled={!canUndo} title={t('undo')} className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r border-[var(--cordel-border-sub)] cursor-pointer ${canUndo ? 'text-theme-ink hover:bg-white/10' : 'text-stone-600 cursor-not-allowed opacity-40'}`}>
            <Undo2 className="w-3.5 h-3.5" />{historyCount !== undefined && historyCount > 0 && <span className="text-[10px] text-theme-accent font-bold">({historyCount})</span>}
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title={t('redo')} className={`px-2 py-1 text-xs font-mono flex items-center gap-1 cursor-pointer ${canRedo ? 'text-theme-ink hover:bg-white/10' : 'text-stone-600 cursor-not-allowed opacity-40'}`}>
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {onSnapToGreenLine && (
          <button
            type="button" onClick={onSnapToGreenLine}
            title={isBr ? 'Mantém o ritmo e as sílabas intactos e alinha cada bloco MIDI exatamente na linha verde da voz' : 'Garde le rythme et les syllabes intacts et pose chaque brique MIDI exactement sur la courbe verte de la voix'}
            className="px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 border border-emerald-500/60 bg-emerald-600/15 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-600/25 rounded cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" /><span>{isBr ? 'Alinhar notas na linha verde' : 'Poser les notes sur la ligne verte'}</span>
          </button>
        )}

        {onReExtractNotes && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmAsync({ title: t('reExtractNotes'), message: t('reExtractNotesConfirm'), confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning' });
              if (ok) onReExtractNotes();
            }}
            title={isBr ? 'Recalcula a divisão rítmica Maracatu e as alturas a partir da onda' : "Recalcule le découpage rythmique Maracatu et les hauteurs depuis l'onde"}
            className="px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 border border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-300 hover:bg-amber-500/25 rounded cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /><span>{isBr ? 'Reiniciar Ritmo e Notas' : 'Réinitialiser Rythme & Notes'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        {onChangeGlobalVariAudioPct && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)]">
            <span className="font-bold text-theme-ink/85">{isBr ? 'Correção de Voz Global :' : 'Correction Voix Globale :'}</span>
            <input
              type="range" min={0} max={100} step={5} value={globalVariAudioPct}
              onChange={(e) => onChangeGlobalVariAudioPct(Number(e.target.value))}
              className="w-20 accent-[#9a3412] cursor-pointer"
            />
            <span className={`font-bold min-w-[78px] ${globalVariAudioPct > 0 ? 'text-[#9a3412] dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {globalVariAudioPct === 0 ? (isBr ? '0 % (Voz crua)' : '0 % (Voix brute)') : `${globalVariAudioPct} %`}
            </span>
            {onPurgeVariAudio && globalVariAudioPct > 0 && (
              <button type="button" onClick={onPurgeVariAudio} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30 flex items-center gap-0.5 cursor-pointer">
                <X className="w-3 h-3" /><span>{isBr ? 'Limpar (0 %)' : 'Purger (0 %)'}</span>
              </button>
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
