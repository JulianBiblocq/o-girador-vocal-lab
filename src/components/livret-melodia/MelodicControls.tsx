/**
 * MelodicControls.tsx
 * Barre de contrôle épurée bilingue (FR / PT-BR) du Livret 4 :
 * [ Retour à la Prise ], [ Copier Notes & Syllabes ➔ Jumeaux ], [ Synthé | Voix seule | Duo ] et [ ÉCOUTER / ARRÊTER ] (< 130 lignes).
 */
import React from 'react';
import type { MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import { Play, Square, ArrowLeft, SkipBack, Music } from 'lucide-react';
import { CordelMic, CordelPiano, CordelSpeaker } from '../common/CordelIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { findTwinPatterns, copyMidiAndSyllablesToTwins } from '../../utils/twinPatternsHelper';

interface MelodicControlsProps {
  isPlaying: boolean;
  playMode: MelodicPlayMode;
  clickEnabled: boolean;
  ignoreMelodyPitch?: boolean;
  onToggleIgnoreMelodyPitch?: (ignore: boolean) => void;
  onTogglePlay: () => void;
  onResetSeek?: () => void;
  onSetPlayMode: (mode: MelodicPlayMode) => void;
  onToggleClick: () => void;
  onBackToPrise: () => void;
  onDownloadPack?: () => void;
}

export const MelodicControls: React.FC<MelodicControlsProps> = (props) => {
  const {
    isPlaying, playMode, clickEnabled,
    onTogglePlay, onResetSeek, onSetPlayMode, onToggleClick, onBackToPrise,
  } = props;
  const { t, language } = useLanguage();
  const { project, loadProject } = useToadaProject();

  const twins = findTwinPatterns(project, project.activePatternId);
  const handleCopyToTwins = () => {
    loadProject(copyMidiAndSyllablesToTwins(project, project.activePatternId));
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: language === 'br'
        ? 'Notas MIDI, ritmo e sílabas copiados para o padrão gêmeo (Áudio preservado)'
        : 'Notes MIDI, rythme et syllabes copiés vers le pattern jumeau (Audio conservé)',
    }));
  };

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-2 select-none rounded">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={onBackToPrise}
          className="cordel-btn px-2.5 py-1.5 text-xs font-mono flex items-center gap-1.5 rounded cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('backToRecording')}</span>
        </button>
        {twins.length > 1 && (
          <button
            type="button" onClick={handleCopyToTwins}
            className="cordel-btn px-2.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 rounded cursor-pointer border border-[var(--cordel-accent)] text-[var(--cordel-accent)]"
          >
            <span>{language === 'br' ? `Copiar Notas & Sílabas ➔ Gêmeos (${twins.length - 1}) (manter Áudio)` : `Copier Notes & Syllabes ➔ Jumeaux (${twins.length - 1}) (garder leur Audio)`}</span>
          </button>
        )}
      </div>

      {/* 2. Centre : Sélecteur d'écoute [ Synthé | Voix seule | Duo ] + Clic */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
          <button
            type="button" onClick={() => onSetPlayMode('synth')}
            className={`px-2.5 py-1 text-xs font-mono flex items-center gap-1.5 border-r border-[var(--cordel-border-sub)] transition-all cursor-pointer ${
              playMode === 'synth' ? 'bg-theme-wood text-[#f4ecd8] font-bold shadow-sm' : 'text-theme-ink/75 hover:bg-white/10'
            }`}
          >
            <CordelPiano className="w-3.5 h-3.5" /><span>{t('modeSynthesizer')}</span>
          </button>
          <button
            type="button" onClick={() => onSetPlayMode('voice')}
            className={`px-2.5 py-1 text-xs font-mono flex items-center gap-1.5 border-r border-[var(--cordel-border-sub)] transition-all cursor-pointer ${
              playMode === 'voice' ? 'bg-theme-wood text-[#f4ecd8] font-bold shadow-sm' : 'text-theme-ink/75 hover:bg-white/10'
            }`}
          >
            <CordelMic className="w-3.5 h-3.5" /><span>{t('modeIsolatedVoice')}</span>
          </button>
          <button
            type="button" onClick={() => onSetPlayMode('duo')}
            className={`px-2.5 py-1 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              playMode === 'duo' ? 'bg-theme-wood text-[#f4ecd8] font-bold shadow-sm' : 'text-theme-ink/75 hover:bg-white/10'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>{t('modeDuo')}</span>
          </button>
        </div>

        <button
          type="button" onClick={onToggleClick} title={t('metronomeClick')}
          className={`px-2.5 py-1 text-xs font-mono flex items-center gap-1 border border-theme-border/60 transition-all rounded cursor-pointer ${
            clickEnabled ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'text-theme-ink/40 hover:bg-white/5'
          }`}
        >
          <CordelSpeaker className="w-3.5 h-3.5" /><span>{t('metronomeClick')}</span>
        </button>
      </div>

      {/* 3. Droite : [ › ÉCOUTER / OUVIR | ■ ARRÊTER LA LECTURE / PARAR A LEITURA ] */}
      <div className="flex items-center gap-2">
        {onResetSeek && (
          <button type="button" onClick={onResetSeek} className="cordel-btn px-2.5 py-1.5 text-xs font-mono flex items-center gap-1 rounded cursor-pointer" title="0:00">
            <SkipBack className="w-3.5 h-3.5 text-theme-accent" /><span>0:00</span>
          </button>
        )}
        <button
          type="button" onClick={onTogglePlay}
          className={`cordel-btn px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 rounded cursor-pointer ${
            isPlaying ? 'bg-red-800 text-[#f4ecd8]' : 'bg-theme-wood text-[#f4ecd8]'
          }`}
        >
          {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current text-[#f4ecd8]" />}
          <span>{isPlaying ? t('stopPlayback') : (language === 'br' ? 'OUVIR' : 'ÉCOUTER')}</span>
        </button>
      </div>
    </div>
  );
};
