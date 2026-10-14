/**
 * MelodicControls.tsx
 * Barre de contrôle de transport centré bilingue :
 * Revenir au début, Play/Stop, Modes d'écoute et Clic métronome.
 */
import React from 'react';
import type { MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import { Play, Square, Volume2, ArrowLeft, Download, SkipBack } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

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
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5 w-full py-1">
      {/* 1. Modes d'Écoute Comparative & Clic */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-black/50 border border-theme-border/50 rounded-xl">
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
            🎙️ {t('modeIsolatedVoice')}
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
            🎹 {t('modeSynthesizer')}
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
            🎙️+🎹 {t('modeDuo')}
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
          title={t('metronomeClick')}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{t('metronomeClick')}</span>
        </button>
      </div>

      {/* 2. Transport et Téléchargement */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToPrise}
          className="cordel-btn px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 opacity-80 hover:opacity-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('backToRecording')}</span>
        </button>

        <div className="flex items-center gap-2">
          {onResetSeek && (
            <button
              type="button"
              onClick={onResetSeek}
              className="cordel-btn px-2.5 py-1.5 text-xs font-mono flex items-center gap-1 bg-white/5 hover:bg-white/10 text-theme-ink/80"
              title="0:00"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">0:00</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            className={`cordel-btn px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md ${
              isPlaying ? 'bg-amber-600 text-white' : 'bg-theme-accent text-white'
            }`}
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? t('recordBtnStop') : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPack}
            className="cordel-btn px-3.5 py-1.5 text-xs font-mono font-bold bg-emerald-700 text-white flex items-center gap-1.5 hover:bg-emerald-600 shadow-md"
            title="VocalPackExport JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('downloadPack')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
