import React, { useState } from 'react';
import { Headphones, VolumeX, Volume2, Play, AlertTriangle, ShieldCheck, Sliders } from 'lucide-react';
import type { ListeningMode } from '../../audio/MetronomeEngine';
import { getSavedClickVolume, saveClickVolume } from '../../utils/clickVolumeStorage';

interface ListeningModePanelProps {
  listeningMode: ListeningMode;
  onListeningModeChange: (mode: ListeningMode) => void;
  referencePitch: string;
  onReferencePitchChange: (pitch: string) => void;
  onPlayReferencePreview: () => void;
  disabled?: boolean;
}

const COMMON_PITCHES = ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'];

export const ListeningModePanel: React.FC<ListeningModePanelProps> = ({
  listeningMode, onListeningModeChange, referencePitch,
  onReferencePitchChange, onPlayReferencePreview, disabled = false,
}) => {
  const [clickVolume, setClickVolume] = useState<number>(getSavedClickVolume);

  const handleVolumeChange = (newVal: number) => {
    setClickVolume(newVal);
    saveClickVolume(newVal);
  };

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5">
      {/* 1. Bascule d ecoute */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          {listeningMode === 'headphones' ? (
            <Headphones key="mode-hp-icon" className="w-3.5 h-3.5 text-theme-accent" />
          ) : (
            <VolumeX key="mode-spk-icon" className="w-3.5 h-3.5 text-theme-wood" />
          )}
          <span>Mode d ecoute & Monitoring</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button" disabled={disabled}
            onClick={() => onListeningModeChange('headphones')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${
              listeningMode === 'headphones' ? 'cordel-btn-primary' : 'cordel-btn opacity-70'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4" />
              <span>Avec Casque</span>
            </div>
            <span className="text-[10px] font-normal opacity-80">Clic continu + Diapason</span>
          </button>

          <button
            type="button" disabled={disabled}
            onClick={() => onListeningModeChange('speakers')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${
              listeningMode === 'speakers' ? 'cordel-btn-primary' : 'cordel-btn opacity-70'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-4 h-4" />
              <span>Sans Casque</span>
            </div>
            <span className="text-[10px] font-normal opacity-80">100% Silencieux (Zero repisse)</span>
          </button>
        </div>
      </div>

      {/* 2. Volume du Clic Boosté (Métronome) */}
      {listeningMode === 'headphones' && (
        <div className="flex flex-col gap-1 p-2 bg-black/40 border border-theme-border/30">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 font-bold uppercase text-[11px] text-theme-ink">
              <Sliders className="w-3 h-3 text-theme-accent" />
              <span>Volume Clic (Métronome)</span>
            </span>
            <span className="text-theme-accent font-bold text-[11px]">
              {Math.round(clickVolume * 100)} %
            </span>
          </div>
          <input
            type="range" min={0} max={2.0} step={0.05} value={clickVolume} disabled={disabled}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full accent-[var(--cordel-wood)] cursor-pointer"
          />
        </div>
      )}

      {/* 3. Avertissement materiel */}
      <div className="p-2 border border-theme-border/40 text-[11px] font-mono leading-tight bg-black/40">
        {listeningMode === 'headphones' ? (
          <div key="warn-headphones" className="flex items-start gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-theme-accent" />
            <span>
              <strong>Carte son :</strong> baissez vos enceintes (potard Monitor) pour garder le son 100% au casque.
            </span>
          </div>
        ) : (
          <div key="warn-speakers" className="flex items-start gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Sortie coupee :</strong> aucun son ne sortira sur les enceintes (repisse micro impossible).
            </span>
          </div>
        )}
      </div>

      {/* 4. Note repere / Diapason */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-theme-border/20">
        <div className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>Note Repere d Attaque (Diapason M-2)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={referencePitch} onChange={(e) => onReferencePitchChange(e.target.value)} disabled={disabled}
            className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-1.5 font-mono font-bold focus:outline-none focus:border-theme-accent"
          >
            {COMMON_PITCHES.map((note) => (
              <option key={note} value={note} className="bg-theme-bg text-theme-ink">{note}</option>
            ))}
          </select>
          <button
            type="button" onClick={onPlayReferencePreview} disabled={disabled}
            className="cordel-btn px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-theme-accent" />
            <span>Ecouter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
