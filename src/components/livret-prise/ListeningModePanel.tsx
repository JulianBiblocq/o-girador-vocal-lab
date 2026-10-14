/**
 * ListeningModePanel.tsx
 * Panneau du Mode d'Écoute (Casque / Visuel) et de la Note Repère (Note + Octave) bilingue.
 */
import React, { useState } from 'react';
import { Headphones, VolumeX, Volume2, Play, Sliders } from 'lucide-react';
import type { ListeningMode } from '../../audio/MetronomeEngine';
import { getSavedClickVolume, saveClickVolume } from '../../utils/clickVolumeStorage';
import { useLanguage } from '../../i18n/LanguageContext';

interface ListeningModePanelProps {
  listeningMode: ListeningMode;
  onListeningModeChange: (mode: ListeningMode) => void;
  referencePitch: string;
  onReferencePitchChange: (pitch: string) => void;
  onPlayReferencePreview: () => void;
  disabled?: boolean;
}

const NOTE_OPTIONS_FR = [
  { c: 'C', l: 'Do (C)' }, { c: 'C#', l: 'Do# (C#)' }, { c: 'D', l: 'Ré (D)' }, { c: 'D#', l: 'Ré# (D#)' },
  { c: 'E', l: 'Mi (E)' }, { c: 'F', l: 'Fa (F)' }, { c: 'F#', l: 'Fa# (F#)' }, { c: 'G', l: 'Sol (G)' },
  { c: 'G#', l: 'Sol# (G#)' }, { c: 'A', l: 'La (A)' }, { c: 'A#', l: 'La# (A#)' }, { c: 'B', l: 'Si (B)' },
];

const NOTE_OPTIONS_PT = [
  { c: 'C', l: 'Dó (C)' }, { c: 'C#', l: 'Dó# (C#)' }, { c: 'D', l: 'Ré (D)' }, { c: 'D#', l: 'Ré# (D#)' },
  { c: 'E', l: 'Mi (E)' }, { c: 'F', l: 'Fá (F)' }, { c: 'F#', l: 'Fá# (F#)' }, { c: 'G', l: 'Sol (G)' },
  { c: 'G#', l: 'Sol# (G#)' }, { c: 'A', l: 'Lá (A)' }, { c: 'A#', l: 'Lá# (A#)' }, { c: 'B', l: 'Si (B)' },
];

export const ListeningModePanel: React.FC<ListeningModePanelProps> = ({
  listeningMode, onListeningModeChange, referencePitch, onReferencePitchChange, onPlayReferencePreview, disabled = false,
}) => {
  const { t, locale } = useLanguage();
  const isPt = locale === 'pt';
  const [clickVolume, setClickVolume] = useState<number>(getSavedClickVolume);
  const handleVolumeChange = (newVal: number) => { setClickVolume(newVal); saveClickVolume(newVal); };

  const match = referencePitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
  const currentNote = match ? match[1].toUpperCase() : 'C';
  const currentOctave = match ? match[2] : '4';
  const noteOptions = isPt ? NOTE_OPTIONS_PT : NOTE_OPTIONS_FR;

  return (
    <div className="cordel-card p-3 h-full flex flex-col justify-between gap-2.5">
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          {listeningMode === 'headphones' ? <Headphones className="w-3.5 h-3.5 text-theme-accent" /> : <VolumeX className="w-3.5 h-3.5 text-theme-wood" />}
          <span>{t('listeningModeTitle')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button" disabled={disabled} onClick={() => onListeningModeChange('headphones')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer ${listeningMode === 'headphones' ? 'cordel-btn-primary' : 'cordel-btn opacity-70'}`}
          >
            <div className="flex items-center gap-1.5"><Headphones className="w-4 h-4" /><span>{t('modeHeadphones')}</span></div>
          </button>
          <button
            type="button" disabled={disabled} onClick={() => onListeningModeChange('speakers')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer ${listeningMode === 'speakers' ? 'cordel-btn-primary' : 'cordel-btn opacity-70'}`}
          >
            <div className="flex items-center gap-1.5"><VolumeX className="w-4 h-4" /><span>{t('modeVisual')}</span></div>
          </button>
        </div>
      </div>

      {listeningMode === 'headphones' && (
        <div className="flex flex-col gap-1 p-2 bg-black/40 border border-theme-border/30">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 font-bold uppercase text-[11px] text-theme-ink">
              <Sliders className="w-3 h-3 text-theme-accent" /><span>{t('volumeClick')}</span>
            </span>
            <span className="text-theme-accent font-bold text-[11px]">{Math.round(clickVolume * 100)} %</span>
          </div>
          <input
            type="range" min={0} max={2.0} step={0.05} value={clickVolume} disabled={disabled}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full accent-[var(--cordel-wood)] cursor-pointer"
          />
        </div>
      )}

      {/* Double Sélecteur : Note + Octave */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-theme-border/20">
        <div className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('referencePitch')}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentNote} onChange={(e) => onReferencePitchChange(`${e.target.value}${currentOctave}`)} disabled={disabled}
            className="flex-1 bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-1.5 font-mono font-bold focus:outline-none focus:border-theme-accent"
          >
            {noteOptions.map((n) => <option key={n.c} value={n.c} className="bg-theme-bg text-theme-ink">{n.l}</option>)}
          </select>
          <select
            value={currentOctave} onChange={(e) => onReferencePitchChange(`${currentNote}${e.target.value}`)} disabled={disabled}
            className="w-20 bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-1.5 font-mono font-bold focus:outline-none focus:border-theme-accent"
          >
            {['2', '3', '4', '5', '6'].map((oct) => (
              <option key={oct} value={oct} className="bg-theme-bg text-theme-ink">
                {isPt ? 'Oit ' : 'Oct '}{oct}
              </option>
            ))}
          </select>
          <button
            type="button" onClick={onPlayReferencePreview} disabled={disabled}
            className="cordel-btn px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-theme-accent" />
            <span>{t('testPitch')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
