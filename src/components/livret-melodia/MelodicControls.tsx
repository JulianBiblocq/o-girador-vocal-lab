/**
 * MelodicControls.tsx
 * Barre de contrôle de transport centré :
 * Revenir au début [⏮ Début], Play/Stop, Sélecteur 3-états et Clic métronome.
 */
import React from 'react';
import type { MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import { Play, Square, Volume2, ArrowLeft, Download, SkipBack } from 'lucide-react';

interface MelodicControlsProps {
  isPlaying: boolean;
  playMode: MelodicPlayMode;
  clickEnabled: boolean;
  onTogglePlay: () => void;
  onResetSeek?: () => void;
  onSetPlayMode: (mode: MelodicPlayMode) => void;
  onToggleClick: () => void;
  onBackToPrise: () => void;
  onDownloadPack: () => void;
}

export const MelodicControls: React.FC<MelodicControlsProps> = (props) => {
  const { isPlaying, playMode, clickEnabled, onTogglePlay, onResetSeek, onSetPlayMode, onToggleClick, onBackToPrise, onDownloadPack } = props;

  return (
    <div className="flex flex-col gap-1.5 w-full py-1">
      {/* 1. Sélecteur 3-États d'Écoute Comparative & Clic */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-black/50 border border-theme-border/50 rounded-xl">
        <span className="text-[11px] font-mono font-bold text-theme-ink/70 px-1">ÉCOUTE :</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetPlayMode('voice')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
              playMode === 'voice'
                ? 'bg-sky-500/30 text-sky-300 font-bold border border-sky-400/50 shadow-sm'
                : 'bg-white/5 text-theme-ink/80 hover:bg-white/10'
            }`}
          >
            🎙️ Voix seule
          </button>
          <button
            type="button"
            onClick={() => onSetPlayMode('synth')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
              playMode === 'synth'
                ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-400/50 shadow-sm'
                : 'bg-white/5 text-theme-ink/80 hover:bg-white/10'
            }`}
          >
            🎹 Synthé seul
          </button>
          <button
            type="button"
            onClick={() => onSetPlayMode('duo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
              playMode === 'duo'
                ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-400/50 shadow-sm'
                : 'bg-white/5 text-theme-ink/80 hover:bg-white/10'
            }`}
          >
            🎙️+🎹 Duo
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleClick}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
            clickEnabled
              ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300'
              : 'bg-white/5 text-theme-ink/40'
          }`}
          title="Activer/désactiver le clic métronome"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Clic</span>
        </button>
      </div>

      {/* 2. Commandes de Transport Centré et Téléchargement */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToPrise}
          className="cordel-btn px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 opacity-80 hover:opacity-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Prise (Livret 1)</span>
        </button>

        <div className="flex items-center gap-2">
          {onResetSeek && (
            <button
              type="button"
              onClick={onResetSeek}
              className="cordel-btn px-2.5 py-1.5 text-xs font-mono flex items-center gap-1 bg-white/5 hover:bg-white/10 text-theme-ink/80"
              title="Revenir au tout début (0:00)"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Début</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            className={`cordel-btn px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md ${
              isPlaying ? 'bg-amber-600 text-white' : 'bg-theme-accent text-white'
            }`}
            title="Lancer / Stopper la lecture (ou barre d'Espace)"
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Arrêter' : 'Écouter'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPack}
            className="cordel-btn px-3.5 py-1.5 text-xs font-mono font-bold bg-emerald-700 text-white flex items-center gap-1.5 hover:bg-emerald-600 shadow-md"
            title="Télécharger le fichier VocalPackExport v1.0 complet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pack JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
