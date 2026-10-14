import React from 'react';
import { Headphones, VolumeX, Volume2, Play } from 'lucide-react';
import type { ListeningMode } from '../../audio/MetronomeEngine';

interface ListeningModePanelProps {
  listeningMode: ListeningMode;
  onListeningModeChange: (mode: ListeningMode) => void;
  referencePitch: string;
  onReferencePitchChange: (pitch: string) => void;
  onPlayReferencePreview: () => void;
  disabled?: boolean;
}

const COMMON_PITCHES = [
  'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'
];

export const ListeningModePanel: React.FC<ListeningModePanelProps> = ({
  listeningMode,
  onListeningModeChange,
  referencePitch,
  onReferencePitchChange,
  onPlayReferencePreview,
  disabled = false,
}) => {
  return (
    <div className="cordel-card p-3 flex flex-col gap-3">
      {/* 1. Bascule franche d'écoute */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          {listeningMode === 'headphones' ? (
            <Headphones className="w-3.5 h-3.5 text-theme-accent" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-theme-wood" />
          )}
          Mode d'écoute & Monitoring
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onListeningModeChange('headphones')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
              listeningMode === 'headphones'
                ? 'cordel-btn-primary'
                : 'cordel-btn opacity-70'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4" />
              <span>Avec Casque</span>
            </div>
            <span className="text-[10px] font-normal opacity-80">
              Clic continu + Diapason élan
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onListeningModeChange('speakers')}
            className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
              listeningMode === 'speakers'
                ? 'cordel-btn-primary'
                : 'cordel-btn opacity-70'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-4 h-4" />
              <span>Sans Casque</span>
            </div>
            <span className="text-[10px] font-normal opacity-80">
              100% Silencieux (Zéro repisse)
            </span>
          </button>
        </div>
      </div>

      {/* 2. Note repère / Diapason */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-theme-border/20">
        <span className="text-xs font-bold uppercase text-theme-ink flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-theme-accent" />
          Note Repère d'Attaque (Diapason)
        </span>

        <div className="flex items-center gap-2">
          <select
            value={referencePitch}
            onChange={(e) => onReferencePitchChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-2 rounded-none font-mono font-bold focus:outline-none focus:border-theme-accent"
          >
            {COMMON_PITCHES.map((note) => (
              <option key={note} value={note} className="bg-theme-bg text-theme-ink">
                {note}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onPlayReferencePreview}
            disabled={disabled}
            className="cordel-btn px-3 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap"
            title="Tester la note repère au casque ou haut-parleur avant la prise"
          >
            <Play className="w-3.5 h-3.5 text-theme-accent" />
            <span>Écouter la note</span>
          </button>
        </div>
      </div>
    </div>
  );
};
